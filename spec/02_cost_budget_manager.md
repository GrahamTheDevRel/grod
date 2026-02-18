# Spec 02: Cost & Budget Manager

## Overview

This module tracks spending and enforces budget limits. It prevents runaway costs by checking budgets _before_ allowing actions and recording costs _after_ they occur.

[improvement] Instead of money, use "energy" or "tokens" - this prevents the AI focusing on the "money" aspect too much.

## Principles

- **Hierarchical Budgets:** Global -> Job -> Agent/Task.
- **Pre-check & Post-deduct:** Check if budget exists before running; deduct actual cost after.
- **Wallet Concept:** Agents "hold" a wallet that can be topped up or drained.

## Functional Architecture

### Core Dependencies

- `store`: Persistence layer (memory or DB) for current balances.
- `logger`: System logger.

### Constants

```javascript
export const CURRENCY = {
  USD: "USD",
}
```

### Data Structures

#### `BudgetScope`

```javascript
/**
 * @typedef {Object} BudgetScope
 * @property {string} id - e.g. "job-123" or "global"
 * @property {number} limit
 * @property {number} spent
 * @property {string} currency - One of CURRENCY values
 */
```

### Factory: `createBudgetManager`

```javascript
/**
 * @param {Object} deps
 * @param {Object} deps.store
 * @param {Object} deps.logger
 */
export const createBudgetManager = ({ store, logger }) => {
  return {
    /**
     * Check if an amount CAN be spent (does not deduct)
     * @param {string} scopeId
     * @param {number} [estimatedCost=0]
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
     */
    recordSpend: async (scopeId, amount, metadata = {}) => {
      const budget = await store.getBudget(scopeId)
      if (!budget) return { success: false, error: "No budget found" }

      const newSpent = budget.spent + amount
      await store.updateBudget(scopeId, { spent: newSpent })

      logger.info(
        `Recorded spend: $${amount} for ${scopeId}. Total: $${newSpent}`,
      )

      // Emit event for monitoring?
      // eventBus.emit('budget_updated', { scopeId, spent: newSpent });

      return { success: true, remaining: budget.limit - newSpent }
    },

    /**
     * Create or Update a budget
     * @param {string} scopeId
     * @param {number} limit
     */
    setBudget: async (scopeId, limit) => {
      await store.upsertBudget(scopeId, { limit, spent: 0 })
      return { success: true }
    },

    /**
     * Transfer budget between scopes (e.g., Job -> Sub-Agent)
     * @param {string} fromScopeId
     * @param {string} toScopeId
     * @param {number} amount
     */
    allocate: async (fromScopeId, toScopeId, amount) => {
      // Logic to move budget from parent to child
    },
  }
}
```

## Testing Strategy

- Test `canSpend` with various limits.
- Test `recordSpend` ensuring it accumulates correctly.
- Test concurrent updates (if applicable, though JS single-threaded nature helps here).
