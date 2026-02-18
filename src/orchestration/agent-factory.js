import { z } from "zod"

/**
 * @typedef {Object} AgentMetadata
 * @property {string} name
 * @property {string} description
 * @property {string} version
 * @property {z.ZodSchema} inputSchema
 * @property {z.ZodSchema} outputSchema
 */

/**
 * @callback AgentExecuteLogic
 * @param {Object} params
 * @param {any} params.input
 * @param {any} params.context
 * @param {any} deps
 * @returns {Promise<any>}
 */

/**
 * @typedef {Object} Agent
 * @property {AgentMetadata} metadata
 * @property {function(any, any): Promise<import("../schemas/core.js").Result<any>>} execute
 */

/**
 * Creates an agent factory.
 *
 * @param {AgentMetadata} metadata
 * @param {AgentExecuteLogic} executionLogic
 * @returns {function(any): Agent}
 */
export const createAgent = (metadata, executionLogic) => {
  return (deps) => {
    return {
      metadata,
      /**
       * @param {any} input
       * @param {any} context
       * @returns {Promise<import("../schemas/core.js").Result<any>>}
       */
      execute: async (input, context) => {
        try {
          // 1. Validate Input
          const validatedInput = metadata.inputSchema.parse(input)

          // 2. Run logic (injected with deps)
          const output = await executionLogic(
            { input: validatedInput, context },
            deps,
          )

          // 3. Validate Output
          const validatedOutput = metadata.outputSchema.parse(output)

          // 4. Return Success Result
          return { success: true, data: validatedOutput }
        } catch (error) {
          // Return Error Result
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          }
        }
      },
    }
  }
}

/**
 * Creates a pipeline agent that chains multiple agents together.
 *
 * @param {Array<function(any): Agent>} agentFactories - Array of agent factories
 * @param {Object} [pipelineMetadata] - Optional metadata for the pipeline itself
 * @returns {function(any): Agent}
 */
export const createPipeline = (agentFactories, pipelineMetadata = {}) => {
  return (deps) => {
    const instantiatedAgents = agentFactories.map((factory) => factory(deps))

    const metadata = {
      name: pipelineMetadata.name || "pipeline",
      description:
        pipelineMetadata.description || "Sequentially executes multiple agents",
      version: pipelineMetadata.version || "1.0.0",
      // Pipelines take the input of the first agent and return the output of the last
      inputSchema:
        pipelineMetadata.inputSchema ||
        instantiatedAgents[0]?.metadata.inputSchema ||
        z.any(),
      outputSchema:
        pipelineMetadata.outputSchema ||
        instantiatedAgents[instantiatedAgents.length - 1]?.metadata
          .outputSchema ||
        z.any(),
    }

    return {
      metadata,
      /**
       * @param {any} initialInput
       * @param {any} context
       * @returns {Promise<import("../schemas/core.js").Result<any>>}
       */
      execute: async (initialInput, context) => {
        let currentInput = initialInput

        for (const agent of instantiatedAgents) {
          const result = await agent.execute(currentInput, context)
          if (!result.success) {
            return result
          }
          currentInput = result.data
        }

        return { success: true, data: currentInput }
      },
    }
  }
}
