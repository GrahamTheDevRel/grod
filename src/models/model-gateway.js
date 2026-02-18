/**
 * @fileoverview Model Gateway Implementation
 * @see spec/01_model_gateway.md
 */

/**
 * @typedef {import('../schemas/core').ModelRequest} ModelRequest
 * @typedef {import('../schemas/core').ModelResponse} ModelResponse
 * @typedef {import('../schemas/core').ModelConfig} ModelConfig
 */

export const PROVIDER = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
}

export const CAPABILITY = {
  TOOLS: "tools",
  VISION: "vision",
  JSON_MODE: "json_mode",
}

/**
 * Factory to create a Model Gateway instance.
 *
 * @param {Object} deps
 * @param {Object} deps.config - System configuration containing model definitions
 * @param {Object} deps.providerQueues - Map of ProviderQueue instances
 * @param {Object} deps.logger - System logger
 * @param {Object} [deps.performanceMonitor] - Optional performance monitor
 * @param {Object} [deps.jobLogger] - Optional job logger for cost tracking
 * @param {Object} [deps.optimizationPipeline] - Optional optimization pipeline for deterministic bypass
 * @returns {Object} The Model Gateway instance
 */
export const createModelGateway = ({
  config,
  providerQueues,
  logger,
  performanceMonitor,
  jobLogger,
  optimizationPipeline,
}) => {
  /**
   * Internal helper: Validate request against capabilities
   * @param {string} modelId
   * @param {ModelRequest} request
   * @returns {{success: boolean, error?: string}}
   */
  const validateCapabilities = (modelId, request) => {
    const modelConf = config.models[modelId]
    if (!modelConf) return { success: false, error: "Unknown model" }

    if (request.tools && !modelConf.capabilities.includes(CAPABILITY.TOOLS)) {
      return { success: false, error: "Model does not support tools" }
    }

    // Add more capability checks here as needed (e.g., vision)

    return { success: true }
  }

  /**
   * Internal helper: Calculate cost
   * @param {string} modelId
   * @param {Object} usage
   * @returns {number}
   */
  const calculateCost = (modelId, usage) => {
    const modelConf = config.models[modelId]
    if (!modelConf || !modelConf.cost || !usage) return 0

    const inputCost = (usage.promptTokens / 1000) * modelConf.cost.input1k
    const outputCost = (usage.completionTokens / 1000) * modelConf.cost.output1k

    return Number((inputCost + outputCost).toFixed(6))
  }

  return {
    /**
     * Main Public Method to call an LLM
     * @param {ModelRequest} request
     * @param {string} [jobId] - Optional Job ID for cost tracking
     * @returns {Promise<ModelResponse>}
     */
    call: async (request, jobId) => {
      const startTime = Date.now()

      // 0. Check for Optimized Deterministic Bypass
      if (request.taskType && optimizationPipeline) {
        const optimizedFn = optimizationPipeline.getOptimizedFunction(
          request.taskType,
        )
        if (optimizedFn) {
          try {
            const result = optimizedFn(request.messages)
            const endTime = Date.now()
            const latencyMs = endTime - startTime

            logger.info(
              `Using deterministic bypass for taskType: ${request.taskType}`,
            )

            return {
              success: true,
              data: {
                content:
                  typeof result === "string" ? result : JSON.stringify(result),
              },
              meta: {
                modelId: "deterministic",
                provider: "internal",
                latencyMs,
                usage: {
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                  cost: 0,
                },
              },
            }
          } catch (error) {
            logger.error(
              `Deterministic bypass failed for ${request.taskType}: ${error.message}. Falling back to LLM.`,
            )
          }
        }
      }

      // 1. Validate
      const validation = validateCapabilities(request.modelId, request)
      if (!validation.success) {
        return {
          success: false,
          error: validation.error,
        }
      }

      // 2. Route to Provider Queue
      const modelConf = config.models[request.modelId]
      const queue = providerQueues[modelConf.provider]

      if (!queue) {
        const errorMsg = `No queue for provider: ${modelConf.provider}`
        logger.error(errorMsg)
        return {
          success: false,
          error: errorMsg,
        }
      }

      try {
        // Queue handles rate limiting and circuit breaking internally
        const rawResponse = await queue.enqueue(async () => {
          return await queue.client.generate(request)
        })

        const endTime = Date.now()
        const latencyMs = endTime - startTime

        // 3. Normalize & Cost
        const cost = calculateCost(request.modelId, rawResponse.usage)

        const meta = {
          modelId: request.modelId,
          provider: modelConf.provider,
          latencyMs,
          usage: {
            ...rawResponse.usage,
            cost,
          },
        }

        // 4. Record Metrics
        if (performanceMonitor) {
          performanceMonitor.recordLatency(latencyMs, {
            modelId: request.modelId,
            provider: modelConf.provider,
          })

          if (rawResponse.usage && rawResponse.usage.totalTokens) {
            performanceMonitor.recordThroughput(
              rawResponse.usage.totalTokens,
              latencyMs,
              { modelId: request.modelId, provider: modelConf.provider },
            )
          }
        }

        // 5. Log Work (if jobId provided and jobLogger exists)
        if (jobId && jobLogger) {
          await jobLogger.logWorkDone(jobId, {
            cost,
            tokens: meta.usage.totalTokens,
            model: request.modelId,
          })
        }

        return {
          success: true,
          data: {
            content: rawResponse.content,
            toolCalls: rawResponse.toolCalls,
          },
          meta,
        }
      } catch (err) {
        logger.error(`Model Gateway Error: ${err.message}`)

        if (performanceMonitor) {
          performanceMonitor.recordError({
            modelId: request.modelId,
            provider: modelConf.provider,
            error: err.name || "Error",
          })
        }

        return {
          success: false,
          error: err.message || "Unknown error during model call",
        }
      }
    },

    /**
     * Utility: List available models
     * @returns {ModelConfig[]}
     */
    listModels: () => Object.values(config.models),
  }
}
