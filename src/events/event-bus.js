import EventEmitter from "events"
import { v4 as uuidv4 } from "uuid"

/**
 * @typedef {import("../schemas/core").Event} Event
 * @typedef {import("../schemas/core").TraceContext} TraceContext
 * @typedef {import("../utils/logger").Logger} Logger
 */

/**
 * @callback EventHandler
 * @param {Event} event
 * @returns {Promise<void> | void}
 */

/**
 * Creates an In-Memory Event Bus.
 *
 * @param {Object} deps
 * @param {Logger} deps.logger
 */
const createEventBus = ({ logger }) => {
  const emitter = new EventEmitter()

  /**
   * Helper to standardise event creation
   *
   * @param {string} type
   * @param {any} payload
   * @param {string} source
   * @param {Partial<TraceContext>} [parentContext={}]
   * @returns {Event}
   */
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
     *
     * @param {string} type
     * @param {any} payload
     * @param {string} [source="system"]
     * @param {TraceContext} [parentContext]
     * @returns {Event}
     */
    emit: (type, payload, source = "system", parentContext) => {
      const event = createEvent(type, payload, source, parentContext)

      logger.debug(`[Event] ${type} | Trace: ${event.trace.traceId}`, {
        id: event.id,
        parentId: event.trace.parentId,
      })

      // Emit strictly typed event
      emitter.emit(type, event)

      // Emit catch-all for firehose/logging
      emitter.emit("*", event)

      return event // Return event so caller knows the ID/Trace
    },

    /**
     * Subscribe to an event
     *
     * @param {string} type
     * @param {EventHandler} handler
     * @returns {Function} unsubscribe function
     */
    on: (type, handler) => {
      /** @param {Event} event */
      const wrappedHandler = async (event) => {
        try {
          const start = Date.now()
          await handler(event)
          const duration = Date.now() - start
          // logger.debug(`Handler for ${type} finished in ${duration}ms`);
        } catch (err) {
          logger.error(`Error in handler for ${type}`, { error: err, event })
        }
      }

      emitter.on(type, wrappedHandler)
      return () => emitter.off(type, wrappedHandler)
    },

    /**
     * Subscribe to all events
     *
     * @param {EventHandler} handler
     * @returns {Function} unsubscribe function
     */
    onAny: (handler) => {
      emitter.on("*", handler)
      return () => emitter.off("*", handler)
    },
  }
}

export { createEventBus }
