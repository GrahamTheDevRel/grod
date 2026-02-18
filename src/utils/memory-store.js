/**
 * @fileoverview Memory & Context Store for Grod.
 * Implements Spec 06.
 */

/**
 * @typedef {Object<string, any>} Context
 */

/**
 * @typedef {Object} MemoryEntryMetadata
 * @property {string} source - e.g. "user", "agent-x"
 * @property {number} timestamp
 * @property {number[]} [embedding] - For vector search later
 */

/**
 * @typedef {Object} MemoryEntry
 * @property {string} id
 * @property {string} content
 * @property {MemoryEntryMetadata} metadata
 */

/**
 * Creates a Memory Store instance.
 * @param {Object} deps
 * @param {Object} deps.adapter - Persistence adapter (must implement get, set, del, push, getList)
 * @param {Object} deps.logger - Logger instance
 */
export const createMemoryStore = ({ adapter, logger }) => {
  if (!adapter) throw new Error("MemoryStore requires an adapter")
  if (!logger) throw new Error("MemoryStore requires a logger")

  return {
    /**
     * Key-Value Context
     * @param {string} scopeId
     * @returns {Promise<Context>}
     */
    getContext: async (scopeId) => {
      try {
        return (await adapter.get(`context:${scopeId}`)) || {}
      } catch (error) {
        logger.error(`Failed to get context for ${scopeId}: ${error.message}`)
        return {}
      }
    },

    /**
     * Updates context by merging patch.
     * @param {string} scopeId
     * @param {Object} patch
     * @returns {Promise<Context>}
     */
    updateContext: async (scopeId, patch) => {
      try {
        const current = (await adapter.get(`context:${scopeId}`)) || {}
        const next = { ...current, ...patch }
        await adapter.set(`context:${scopeId}`, next)
        logger.debug(`Context updated for ${scopeId}`)
        return next
      } catch (error) {
        logger.error(
          `Failed to update context for ${scopeId}: ${error.message}`,
        )
        throw error
      }
    },

    /**
     * Log / Episodic Memory (Append-only)
     * @param {string} scopeId
     * @param {MemoryEntry} entry
     * @returns {Promise<void>}
     */
    addLog: async (scopeId, entry) => {
      try {
        await adapter.push(`logs:${scopeId}`, entry)
        logger.debug(`Log entry added to ${scopeId}`)
      } catch (error) {
        logger.error(`Failed to add log to ${scopeId}: ${error.message}`)
        throw error
      }
    },

    /**
     * Retrieves all logs for a scope.
     * @param {string} scopeId
     * @returns {Promise<MemoryEntry[]>}
     */
    getLogs: async (scopeId) => {
      try {
        return (await adapter.getList(`logs:${scopeId}`)) || []
      } catch (error) {
        logger.error(`Failed to get logs for ${scopeId}: ${error.message}`)
        return []
      }
    },

    /**
     * Saves a checkpoint of the current context.
     * @param {string} scopeId
     * @returns {Promise<string>} checkpointId (timestamp)
     */
    saveCheckpoint: async (scopeId) => {
      try {
        const context = (await adapter.get(`context:${scopeId}`)) || {}
        const timestamp = Date.now()
        await adapter.set(`checkpoint:${scopeId}:${timestamp}`, context)
        logger.info(`Checkpoint saved for ${scopeId} at ${timestamp}`)
        return timestamp.toString()
      } catch (error) {
        logger.error(
          `Failed to save checkpoint for ${scopeId}: ${error.message}`,
        )
        throw error
      }
    },

    /**
     * Restores a checkpoint to the current context.
     * @param {string} scopeId
     * @param {string} timestamp
     * @returns {Promise<Context>}
     */
    restoreCheckpoint: async (scopeId, timestamp) => {
      try {
        const checkpoint = await adapter.get(
          `checkpoint:${scopeId}:${timestamp}`,
        )
        if (!checkpoint) {
          throw new Error(`Checkpoint ${timestamp} not found for ${scopeId}`)
        }
        await adapter.set(`context:${scopeId}`, checkpoint)
        logger.info(`Checkpoint restored for ${scopeId} from ${timestamp}`)
        return checkpoint
      } catch (error) {
        logger.error(
          `Failed to restore checkpoint for ${scopeId}: ${error.message}`,
        )
        throw error
      }
    },
  }
}
