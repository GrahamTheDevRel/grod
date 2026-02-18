const { z } = require("zod")

/**
 * @template T
 * @typedef {Object} SuccessResult
 * @property {true} success
 * @property {T} data
 */

/**
 * @template E
 * @typedef {Object} ErrorResult
 * @property {false} success
 * @property {E} error
 */

/**
 * @template T
 * @template [E=Error]
 * @typedef {SuccessResult<T> | ErrorResult<E>} Result
 */

/**
 * Agent Communication Schemas
 */
const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(), // JSON string
  }),
})

/** @typedef {import("zod").infer<typeof ToolCallSchema>} ToolCall */

const AgentMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  name: z.string().optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
  tool_call_id: z.string().optional(),
})

/** @typedef {import("zod").infer<typeof AgentMessageSchema>} AgentMessage */

/**
 * Configuration Schemas
 */
const ModelConfigSchema = z.object({
  id: z.string(),
  provider: z.enum(["openai", "anthropic", "local"]),
  contextWindow: z.number().positive(),
  cost: z.object({
    input1k: z.number().min(0),
    output1k: z.number().min(0),
  }),
})

/** @typedef {import("zod").infer<typeof ModelConfigSchema>} ModelConfig */

const GlobalConfigSchema = z.object({
  models: z.record(ModelConfigSchema),
  defaultModel: z.string(),
})

/** @typedef {import("zod").infer<typeof GlobalConfigSchema>} GlobalConfig */

/**
 * Job Schemas
 */
const JobSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["created", "running", "paused", "completed", "failed"]),
  permissions: z.object({
    allowTools: z.boolean(),
    maxCost: z.number().optional(),
  }),
})

/** @typedef {import("zod").infer<typeof JobSchema>} Job */

/**
 * Event Bus Types
 */
const TraceContextSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  parentId: z.string().optional(),
})

/** @typedef {import("zod").infer<typeof TraceContextSchema>} TraceContext */

const EventMetadataSchema = z.object({
  timestamp: z.number(),
  source: z.string(),
  correlationId: z.string().optional(),
  actorId: z.string().optional(),
})

/** @typedef {import("zod").infer<typeof EventMetadataSchema>} EventMetadata */

const EventSchema = z.object({
  id: z.string(), // Same as spanId
  type: z.string(),
  payload: z.any(),
  trace: TraceContextSchema,
  meta: EventMetadataSchema,
})

/** @typedef {import("zod").infer<typeof EventSchema>} Event */

module.exports = {
  ToolCallSchema,
  AgentMessageSchema,
  ModelConfigSchema,
  GlobalConfigSchema,
  JobSchema,
  TraceContextSchema,
  EventMetadataSchema,
  EventSchema,
}
