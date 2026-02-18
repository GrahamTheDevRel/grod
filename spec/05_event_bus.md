# Spec 05: Event Bus (Enhanced)

## Overview

The Event Bus is the central nervous system. It decouples components, allowing for observation, logging, and reactive behaviors without tight coupling.

[improvement] the events system should have an external API so we can swap another events system / integrate an external events system easily.

**Key Requirement:** We must be able to trace a chain of events and state mutations to understand _why_ something happened.

## Principles

- **Global & Local:** A global bus for system events, but jobs might have local scope.
- **Typed Events:** Events are not just strings; they have known payloads.
- **Async:** Handlers are executed asynchronously (usually), avoiding blocking the main flow.
- **Causal Tracing:** Every event must have a `traceId` (global operation) and `parentId` (what caused this).

## Functional Architecture

### Core Dependencies

- `logger`: For debugging the bus itself.
- `tracer`: (Optional) OpenTelemetry or similar interface.

### Data Structures

#### `TraceContext`

```javascript
/**
 * @typedef {Object} TraceContext
 * @property {string} traceId - The Global Job/Request ID
 * @property {string} spanId - Unique ID for this specific event
 * @property {string} [parentId] - The spanId of the event that caused this one
 */
```

#### `EventMetadata`

```javascript
/**
 * @typedef {Object} EventMetadata
 * @property {number} timestamp
 * @property {string} source - "orchestrator", "agent:summarizer"
 * @property {string} [correlationId] - Logic grouping (e.g. user-session-123)
 * @property {string} [actorId] - The user or agent principal
 */
```

#### `Event`

```javascript
/**
 * @typedef {Object} Event
 * @property {string} id - UUID (same as spanId)
 * @property {string} type - "job:started", "state:updated"
 * @property {any} payload
 * @property {TraceContext} trace
 * @property {EventMetadata} meta
 */
```

### Factory: `createEventBus`

```javascript
import EventEmitter from "events"
import { v4 as uuidv4 } from "uuid"

/**
 * @param {Object} deps
 * @param {Object} deps.logger
 */
export const createEventBus = ({ logger }) => {
  const emitter = new EventEmitter()

  // Helper to standardise event creation
  const createEvent = (type, payload, source, parentContext = {}) => {
    const spanId = uuidv4()
    return {
      id: spanId,
      type,
      payload,
      trace: {
        traceId: parentContext.traceId || spanId, // New trace if none exists
        spanId,
        parentId: parentContext.spanId,
      },
      meta: {
        timestamp: Date.now(),
        source,
      },
    }
  }

  return {
    /**
     * Publish an event
     * @param {string} type
     * @param {any} payload
     * @param {string} [source="system"]
     * @param {TraceContext} [parentContext]
     * @returns {Event}
     */
    emit: (type, payload, source = "system", parentContext) => {
      const event = createEvent(type, payload, source, parentContext)

      logger.debug(`[Event] ${type} | Trace: ${event.trace.traceId}`, event)

      // Emit strictly typed event
      emitter.emit(type, event)

      // Emit catch-all for firehose/logging
      emitter.emit("*", event)

      return event // Return event so caller knows the ID/Trace
    },

    /**
     * @callback EventHandler
     * @param {Event} event
     * @returns {Promise<void>}
     */

    /**
     * Subscribe with middleware support
     * @param {string} type
     * @param {EventHandler} handler
     * @returns {Function} unsubscribe function
     */
    on: (type, handler) => {
      // Wrap handler to catch errors and log execution
      const wrappedHandler = async (event) => {
        try {
          const start = Date.now()
          await handler(event)
          const duration = Date.now() - start

          // Optional: Emit a 'handler:completed' metric?
          // logger.trace(`Handler for ${type} finished in ${duration}ms`);
        } catch (err) {
          logger.error(`Error in handler for ${type}`, { error: err, event })
          // Potentially emit a system:error event here linked to the original trace
        }
      }

      emitter.on(type, wrappedHandler)
      return () => emitter.off(type, wrappedHandler)
    },

    onAny: (handler) => {
      emitter.on("*", handler)
    },
  }
}
```

## Mutation Tracking

If a handler modifies state (e.g., updating a variable in memory), it **must** emit a `state:updated` event linking back to the event that triggered the change.

**Flow:**

1. Event `A` (User: "Change color to blue") -> Fires.
2. Handler `H1` hears `A`.
3. `H1` updates DB.
4. `H1` emits `state:updated` (Payload: `{ key: 'color', old: 'red', new: 'blue' }`, Parent: `A.id`).

This creates a DAG (Directed Acyclic Graph) of: `Command -> [Mutation, Log, SideEffect]`.

## Trace Viewer Concept

By querying logs for a specific `traceId`, we can reconstruct the entire execution flow:

- `timestamp` sorts them linearly.
- `parentId` reconstructs the tree hierarchy.

## Common Events

- `job:created`, `job:started`, `job:completed`, `job:failed`
- `agent:start`, `agent:end`
- `model:request`, `model:response`
- `budget:threshold_reached`
- `state:updated`
- `system:error`

## Testing Strategy

- Verify that `traceId` propagates correctly from parent to child events.
- Verify `state:updated` events contain correct `old`/`new` values.
- Verify error handling in `wrappedHandler` catches exceptions without crashing the bus.
