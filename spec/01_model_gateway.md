# Spec 01: Model Gateway

## Overview

The Model Gateway is the single point of entry for all LLM interactions. It abstracts away provider-specific API details (OpenAI, Anthropic, etc.) and enforces capabilities, costs, and validation.

## Principles

- **Standard Interface:** All models look the same to the rest of the system.
- **Capability Guarding:** A request fails _before_ the network call if the model doesn't support the required features (e.g., tools, vision).
- **Cost Tracking:** Every call must report its usage and cost.

## Functional Architecture

### Core Dependencies

- `config`: Model configuration (prices, limits, capabilities).
- `logger`: System logger.
- `performanceMonitor`: For tracking latency, throughput, and errors.
- `providerQueues`: Map of `ProviderQueue` instances (one per provider), managing concurrency and rate limits.

### ProviderQueue System

To handle rate limits and outages gracefully, we use a `ProviderQueue` for each provider (e.g., one for OpenAI, one for Anthropic).

- **Token Bucket Rate Limiting:**
  - Each queue tracks `requests_per_minute` and `tokens_per_minute`.
  - Requests wait in the queue until tokens are available.
  - Prioritizes higher-priority jobs if queue depth > 0.

- **Circuit Breaker:**
  - If a provider returns 5xx errors or timeouts > X% of the time, the circuit opens.
  - Fast-fails requests for a cooldown period (e.g., 30s) before attempting a "half-open" check.
  - Prevents cascading failures and wasted retry loops.

### Constants

```javascript
export const PROVIDER = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
}

export const CAPABILITY = {
  TOOLS: "tools",
  VISION: "vision",
  JSON_MODE: "json_mode",
}
```

### Data Structures

#### `ModelConfig`

```javascript
/**
 * @typedef {Object} CostConfig
 * @property {number} input1k
 * @property {number} output1k
 */

/**
 * @typedef {Object} ModelConfig
 * @property {string} id - e.g. "gpt-4-turbo"
 * @property {string} provider - One of PROVIDER values
 * @property {number} contextWindow
 * @property {string[]} capabilities - Array of CAPABILITY values
 * @property {CostConfig} cost
 */
```

#### `ModelRequest`

```javascript
/**
 * @typedef {Object} Message
 * @property {string} role
 * @property {string} content
 */

/**
 * @typedef {Object} ToolDefinition
 * @property {string} name
 * @property {string} description
 * @property {Object} parameters - JSON Schema object
 */

/**
 * @typedef {Object} ModelRequest
 * @property {string} modelId
 * @property {Message[]} messages
 * @property {ToolDefinition[]} [tools]
 * @property {Object} [schema] - JSON Schema for structured output
 * @property {number} [temperature]
 */
```

#### `ModelResponse` (Result Pattern)

```javascript
/**
 * @typedef {Object} UsageStats
 * @property {number} promptTokens
 * @property {number} completionTokens
 * @property {number} totalTokens
 * @property {number} cost
 */

/**
 * @typedef {Object} ResponseMeta
 * @property {string} modelId
 * @property {string} provider
 * @property {UsageStats} usage
 * @property {number} latencyMs
 */

/**
 * @typedef {Object} ModelResponseData
 * @property {string} content
 * @property {ToolCall[]} [toolCalls]
 */

/**
 * @typedef {Object} ModelResponse
 * @property {boolean} success
 * @property {ModelResponseData} [data]
 * @property {ResponseMeta} [meta]
 * @property {string} [error]
 */
```

### Factory: `createModelGateway`

```javascript
/**
 * @param {Object} deps
 * @param {Object} deps.config
 * @param {Object} deps.providers
 * @param {Object} deps.logger
 * @param {Object} deps.performanceMonitor
 */
export const createModelGateway = ({
  config,
  providers,
  logger,
  performanceMonitor,
  jobLogger,
}) => {
  // Internal helper: Validate request against capabilities
  const validateCapabilities = (modelId, request) => {
    const modelConf = config.models[modelId]
    if (!modelConf) return { success: false, error: "Unknown model" }

    if (request.tools && !modelConf.capabilities.includes(CAPABILITY.TOOLS)) {
      return { success: false, error: "Model does not support tools" }
    }
    return { success: true }
  }

  // Internal helper: Calculate cost
  const calculateCost = (modelId, usage) => {
    // ... logic based on config ...
    return 0 // Placeholder
  }

  return {
    /**
     * Main Public Method
     * @param {ModelRequest} request
     * @param {string} [jobId] - Optional Job ID for cost tracking
     * @returns {Promise<ModelResponse>}
     */
    call: async (request, jobId) => {
      const startTime = Date.now()

      // 1. Validate
      const validation = validateCapabilities(request.modelId, request)
      if (!validation.success) return validation

      // 2. Route to Provider Queue
      const modelConf = config.models[request.modelId]
      const queue = providerQueues[modelConf.provider]

      if (!queue) {
        return {
          success: false,
          error: `No queue for provider: ${modelConf.provider}`,
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

        // 5. Log Work (if jobId provided)
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
        logger.error(err)
        if (performanceMonitor) {
          performanceMonitor.recordError({
            modelId: request.modelId,
            provider: modelConf.provider,
            error: err.name,
          })
        }
        return { success: false, error: err.message }
      }
    },

    // Utility: List available models
    listModels: () => Object.values(config.models),
  }
}
```

## Testing Strategy

- Mock `providers` to return deterministic responses.
- Test `validateCapabilities` with various invalid requests.
- Verify cost calculation logic.
- **AI Judge / Random Sampling:**
  - Implement a mechanism to randomly sample x% of production requests.
  - Send the input + output to a stronger "Judge" model (e.g., GPT-4o).
  - The Judge evaluates correctness, safety, or adherence to schema.
  - Log failures for human review to improve system reliability.
