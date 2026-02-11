# Spec 07: Schema & Types

## Overview

Defines the core types and schemas used across the system. This ensures type safety and predictable data structures, critical for the "Drift to Deterministic" principle.

We use `zod` for runtime validation and TypeScript for static analysis.

## Core Types

### 1. Primitives

```javascript
/**
 * @typedef {string} UUID
 */

/**
 * @typedef {string} ISODate
 */
```

### 2. Result Pattern (Monad-ish)

```javascript
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
 * @template E
 * @typedef {SuccessResult<T> | ErrorResult<E>} Result
 */
```

### 3. Agent Communication

```javascript
/**
 * @typedef {Object} ToolCall
 * @property {string} id
 * @property {"function"} type
 * @property {Object} function
 * @property {string} function.name
 * @property {string} function.arguments - JSON string
 */

/**
 * @typedef {Object} AgentMessage
 * @property {"system" | "user" | "assistant" | "tool"} role
 * @property {string} content
 * @property {string} [name] - Optional name for the speaker
 * @property {ToolCall[]} [tool_calls]
 * @property {string} [tool_call_id]
 */
```

## Zod Schemas

### Configuration Schema

```javascript
import { z } from "zod"

export const ModelConfigSchema = z.object({
  id: z.string(),
  provider: z.enum(["openai", "anthropic", "local"]),
  contextWindow: z.number().positive(),
  cost: z.object({
    input1k: z.number().min(0),
    output1k: z.number().min(0),
  }),
})

export const GlobalConfigSchema = z.object({
  models: z.record(ModelConfigSchema),
  defaultModel: z.string(),
})
```

### Job Schema

```javascript
export const JobSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["created", "running", "paused", "completed", "failed"]),
  permissions: z.object({
    allowTools: z.boolean(),
    maxCost: z.number().optional(),
  }),
})
```

## Usage Pattern

All incoming data from external sources (user input, API responses, file reads) MUST be parsed through a Zod schema before being used by the core logic.

```javascript
const config = GlobalConfigSchema.parse(rawConfig) // Throws if invalid
```
