/**
 * @fileoverview In-memory persistence adapter for testing and light use.
 */

/**
 * Creates an In-Memory Persistence Adapter.
 */
export const createInMemoryAdapter = () => {
  const store = new Map()

  return {
    /**
     * @param {string} key
     * @returns {Promise<any>}
     */
    get: async (key) => {
      return store.get(key)
    },

    /**
     * @param {string} key
     * @param {any} value
     * @returns {Promise<void>}
     */
    set: async (key, value) => {
      // Deep copy to simulate serialization and ensure immutability
      store.set(key, JSON.parse(JSON.stringify(value)))
    },

    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    del: async (key) => {
      store.delete(key)
    },

    /**
     * @param {string} key
     * @param {any} item
     * @returns {Promise<void>}
     */
    push: async (key, item) => {
      const list = store.get(key) || []
      list.push(JSON.parse(JSON.stringify(item)))
      store.set(key, list)
    },

    /**
     * @param {string} key
     * @returns {Promise<any[]>}
     */
    getList: async (key) => {
      return store.get(key) || []
    },
  }
}
