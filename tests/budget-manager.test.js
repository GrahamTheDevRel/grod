import assert from "node:assert"
import { createBudgetManager } from "../src/utils/budget-manager.js"

describe("Budget Manager", () => {
  let store
  let logger
  let manager

  beforeEach(() => {
    const budgets = new Map()
    store = {
      getBudget: async (id) => budgets.get(id),
      updateBudget: async (id, updates) => {
        const current = budgets.get(id)
        budgets.set(id, { ...current, ...updates })
      },
      upsertBudget: async (id, data) => {
        budgets.set(id, data)
      },
    }
    logger = {
      info: () => {},
      error: () => {},
    }
    manager = createBudgetManager({ store, logger })
  })

  it("should set and retrieve a budget", async () => {
    await manager.setBudget("global", 100)
    const result = await manager.canSpend("global", 50)
    assert.strictEqual(result.success, true)
  })

  it("should prevent spending over limit", async () => {
    await manager.setBudget("global", 100)
    const result = await manager.canSpend("global", 150)
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, "Budget exceeded")
  })

  it("should record spend and update remaining budget", async () => {
    await manager.setBudget("global", 100)
    const result = await manager.recordSpend("global", 40)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.remaining, 60)

    const canSpendMore = await manager.canSpend("global", 50)
    assert.strictEqual(canSpendMore.success, true)

    const canSpendTooMuch = await manager.canSpend("global", 70)
    assert.strictEqual(canSpendTooMuch.success, false)
  })

  it("should allocate budget from parent to child", async () => {
    await manager.setBudget("job-1", 100)
    const allocation = await manager.allocate("job-1", "agent-1", 40)
    assert.strictEqual(allocation.success, true)

    // Parent should have 40 spent
    const parentBudget = await store.getBudget("job-1")
    assert.strictEqual(parentBudget.spent, 40)

    // Child should have 40 limit
    const childBudget = await store.getBudget("agent-1")
    assert.strictEqual(childBudget.limit, 40)
    assert.strictEqual(childBudget.spent, 0)
  })

  it("should fail allocation if parent has insufficient budget", async () => {
    await manager.setBudget("job-1", 100)
    await manager.recordSpend("job-1", 70)
    const allocation = await manager.allocate("job-1", "agent-1", 40)
    assert.strictEqual(allocation.success, false)
    assert.strictEqual(allocation.error, "Insufficient budget in source")
  })
})
