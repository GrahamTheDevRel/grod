# Spec 06: Memory & Context Store

## Overview

A simple, swappable memory system. It manages the "Short Term Memory" (Working Context) of a Job and the "Long Term Memory" (Project knowledge).

## Principles

- **Event-Sourced (Light):** Changes to memory should be traceable.
- **Scope-Based:** Memory is tied to a `jobId` or `global` scope.
- **Immutable Updates:** Updates return _new_ state rather than mutating in place (where possible, for safety).

## Functional Architecture

### Core Dependencies

- `persistenceAdapter`: The actual storage mechanism (File System, Redis, SQLite).
- `logger`: Logging.

### The Adapter Interface

The core system is agnostic to _where_ data is stored. Any storage backend must implement this interface:

```javascript
/**
 * @interface PersistenceAdapter
 */
const PersistenceAdapter = {
  /**
   * Retrieve a value by key.
   * @param {string} key
   * @returns {Promise<any | null>}
   */
  get: async (key) => {},

  /**
   * Set a value for a key.
   * @param {string} key
   * @param {any} value - Must be JSON serializable
   * @returns {Promise<void>}
   */
  set: async (key, value) => {},

  /**
   * Delete a key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  del: async (key) => {},

  /**
   * Append an item to a list stored at key.
   * @param {string} key
   * @param {any} item
   * @returns {Promise<void>}
   */
  push: async (key, item) => {},

  /**
   * Retrieve all items from a list.
   * @param {string} key
   * @returns {Promise<any[]>}
   */
  getList: async (key) => {},
}
```

### Data Structures

#### `Context`

A simple key-value store, but typed.

```javascript
/**
 * @typedef {Object<string, any>} Context
 */
```

#### `MemoryEntry`

```javascript
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
```

### Factory: `createMemoryStore`

```javascript
/**
 * @param {Object} deps
 * @param {Object} deps.adapter
 * @param {Object} deps.logger
 */
export const createMemoryStore = ({ adapter, logger }) => {
  return {
    /**
     * Key-Value Context (Fast, Synchronous-ish)
     * @param {string} scopeId
     * @returns {Promise<Context>}
     */
    getContext: async (scopeId) => {
      return (await adapter.get(`context:${scopeId}`)) || {}
    },

    /**
     * @param {string} scopeId
     * @param {Object} patch
     * @returns {Promise<Context>}
     */
    updateContext: async (scopeId, patch) => {
      const current = (await adapter.get(`context:${scopeId}`)) || {}
      const next = { ...current, ...patch }
      await adapter.set(`context:${scopeId}`, next)
      logger.debug(`Context updated for ${scopeId}`)
      return next
    },

    /**
     * Log / Episodic Memory (Append-only)
     * @param {string} scopeId
     * @param {MemoryEntry} entry
     */
    addLog: async (scopeId, entry) => {
      await adapter.push(`logs:${scopeId}`, entry)
    },

    /**
     * @param {string} scopeId
     * @returns {Promise<MemoryEntry[]>}
     */
    getLogs: async (scopeId) => {
      return await adapter.getList(`logs:${scopeId}`)
    },
  }
}
```

## "Checkpointing"

Because memory is just serialized JSON in this model, implementing "Checkpoints" is trivial:

1. `saveCheckpoint(jobId)` -> copies `context:jobId` to `checkpoint:jobId:timestamp`.
2. `restoreCheckpoint(jobId, timestamp)` -> overwrites `context:jobId` with the saved version.

## Testing Strategy

- Verify `updateContext` merges keys correctly.
- Verify persistence across "restarts" (if adapter supports it).
- Verify separation of scopes (Job A vs Job B).
