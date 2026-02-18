/**
 * @typedef {Object} BudgetScope
 * @property {string} id - e.g. "job-123" or "global"
 * @property {number} limit
 * @property {number} spent
 * @property {string} currency - One of CURRENCY values
 */

export const CURRENCY = {
  USD: "USD",
}

/**
 * Creates a Cost & Budget Manager.
 *
 * @param {Object} deps
 * @param {Object} deps.store - Persistence layer for balances
 * @param {Object} deps.logger - System logger
 * @returns {Object} The budget manager instance
 */
export const createBudgetManager = ({ store, logger }) => {
  return {
    /**
     * Check if an amount CAN be spent (does not deduct)
     * @param {string} scopeId
     * @param {number} [estimatedCost=0]
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    canSpend: async (scopeId, estimatedCost = 0) => {
      const budget = await store.getBudget(scopeId)
      if (!budget) return { success: false, error: "No budget found" }

      if (budget.spent + estimatedCost > budget.limit) {
        return { success: false, error: "Budget exceeded" }
      }
      return { success: true }
    },

    /**
     * Record actual spend
     * @param {string} scopeId
     * @param {number} amount
     * @param {Object} [metadata={}]
     * @returns {Promise<{success: boolean, remaining?: number, error?: string}>}
     */
    recordSpend: async (scopeId, amount, metadata = {}) => {
      const budget = await store.getBudget(scopeId)
      if (!budget) return { success: false, error: "No budget found" }

      const newSpent = budget.spent + amount
      await store.updateBudget(scopeId, { spent: newSpent })

      logger.info(
        `Recorded spend: $${amount} for ${scopeId}. Total: $${newSpent}`,
      )

      return { success: true, remaining: budget.limit - newSpent }
    },

    /**
     * Create or Update a budget
     * @param {string} scopeId
     * @param {number} limit
     * @returns {Promise<{success: boolean}>}
     */
    setBudget: async (scopeId, limit) => {
      await store.upsertBudget(scopeId, {
        id: scopeId,
        limit,
        spent: 0,
        currency: CURRENCY.USD,
      })
      return { success: true }
    },

    /**
     * Transfer budget between scopes (e.g., Job -> Sub-Agent)
     * @param {string} fromScopeId
     * @param {string} toScopeId
     * @param {number} amount
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    allocate: async (fromScopeId, toScopeId, amount) => {
      const parentBudget = await store.getBudget(fromScopeId)
      if (!parentBudget)
        return { success: false, error: "Source budget not found" }

      if (parentBudget.spent + amount > parentBudget.limit) {
        return { success: false, error: "Insufficient budget in source" }
      }

      // Deduct from parent (by increasing spent)
      await store.updateBudget(fromScopeId, {
        spent: parentBudget.spent + amount,
      })

      // Add to child (new budget or update existing)
      const childBudget = await store.getBudget(toScopeId)
      if (childBudget) {
        await store.updateBudget(toScopeId, {
          limit: childBudget.limit + amount,
        })
      } else {
        await store.upsertBudget(toScopeId, {
          id: toScopeId,
          limit: amount,
          spent: 0,
          currency: CURRENCY.USD,
        })
      }

      logger.info(`Allocated ${amount} from ${fromScopeId} to ${toScopeId}`)
      return { success: true }
    },
  }
}
