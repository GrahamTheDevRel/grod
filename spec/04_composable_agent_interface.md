# Spec 04: Composable Agent Interface

## Overview

This spec defines the "Contract" that all Agents (or "Steps") must adhere to. This uniformity allows them to be chained, swapped, and visually composed.

## Principles

- **Uniform inputs/outputs:** Every agent takes a typed `input` and returns a typed `output`.
- **Stateless (mostly):** Agents should rely on the passed context, not internal hidden state.
- **Metadata:** Agents expose their "shape" (inputs, outputs, description) for tooling.

## Functional Architecture

### The Agent Contract

Every agent module must export a factory that produces an object with this structure:

```javascript
/**
 * @typedef {Object} AgentMetadata
 * @property {string} name
 * @property {string} description
 * @property {string} version
 * @property {JSONSchema} inputSchema
 * @property {JSONSchema} outputSchema
 */

/**
 * @callback AgentExecute
 * @param {any} input
 * @param {JobContext} context
 * @returns {Promise<Result<any>>}
 */

/**
 * @typedef {Object} Agent
 * @property {AgentMetadata} metadata
 * @property {AgentExecute} execute
 */
```

### Factory: `createAgent` Helper

A utility to make creating agents easier and safer.

```javascript
/**
 * Example usage of a factory creator
 * @param {AgentMetadata} metadata
 * @param {Function} executionLogic
 */
export const createAgent = (metadata, executionLogic) => {
  return (deps) => {
    return {
      metadata,
      /**
       * @param {any} input
       * @param {JobContext} context
       */
      execute: async (input, context) => {
        // 1. Validate Input against metadata.inputSchema
        // 2. Run logic (injected with deps)
        // 3. Validate Output against metadata.outputSchema
        // 4. Return Result
      },
    }
  }
}
```

### Example: "Summarizer Agent"

```javascript
const metadata = {
  name: "summarizer",
  // In a real JS file, these would be Zod schemas
  inputSchema: { type: "object", properties: { text: { type: "string" } } },
  outputSchema: { type: "object", properties: { summary: { type: "string" } } },
}

export const createSummarizerAgent = createAgent(
  metadata,
  async ({ input }, deps) => {
    const { modelGateway } = deps

    const response = await modelGateway.call({
      modelId: "gpt-4",
      messages: [{ role: "user", content: `Summarize: ${input.text}` }],
    })

    return { summary: response.data.content }
  },
)
```

## Composition

Because interfaces are standard, we can create a `PipelineAgent` that takes a list of agents and executes them in sequence.

```javascript
/**
 * @param {Array<Function>} agents - Array of agent factories
 */
export const createPipeline = (agents) => {
  return (deps) => {
    // Instantiate all agents with deps
    const instantiatedAgents = agents.map((a) => a(deps))

    return {
      execute: async (initialInput, context) => {
        let currentInput = initialInput
        for (const agent of instantiatedAgents) {
          const result = await agent.execute(currentInput, context)
          if (!result.success) return result
          currentInput = result.data
        }
        return { success: true, data: currentInput }
      },
    }
  }
}
```

## Testing Strategy

- Unit test individual agents by mocking `deps`.
- Test `PipelineAgent` with mock agents to verify data passing.
- Test schema validation failure cases.
