import assert from "node:assert"
import { createMemoryStore } from "../src/utils/memory-store.js"
import { createInMemoryAdapter } from "../src/utils/memory-adapter-in-memory.js"
import { createConsoleLogger } from "../src/utils/logger.js"

describe("Memory Store", () => {
  let memoryStore
  let adapter
  const logger = createConsoleLogger("error")

  beforeEach(() => {
    adapter = createInMemoryAdapter()
    memoryStore = createMemoryStore({ adapter, logger })
  })

  it("should initialize with empty context", async () => {
    const context = await memoryStore.getContext("job-1")
    assert.deepStrictEqual(context, {})
  })

  it("should update and retrieve context", async () => {
    await memoryStore.updateContext("job-1", { key: "value" })
    const context = await memoryStore.getContext("job-1")
    assert.deepStrictEqual(context, { key: "value" })
  })

  it("should merge context updates", async () => {
    await memoryStore.updateContext("job-1", { a: 1 })
    await memoryStore.updateContext("job-1", { b: 2 })
    const context = await memoryStore.getContext("job-1")
    assert.deepStrictEqual(context, { a: 1, b: 2 })
  })

  it("should maintain separate contexts for different scopes", async () => {
    await memoryStore.updateContext("job-1", { id: 1 })
    await memoryStore.updateContext("job-2", { id: 2 })

    assert.deepStrictEqual(await memoryStore.getContext("job-1"), { id: 1 })
    assert.deepStrictEqual(await memoryStore.getContext("job-2"), { id: 2 })
  })

  it("should add and retrieve logs", async () => {
    const entry = {
      id: "e1",
      content: "hello",
      metadata: { source: "user", timestamp: Date.now() },
    }

    await memoryStore.addLog("job-1", entry)
    const logs = await memoryStore.getLogs("job-1")

    assert.strictEqual(logs.length, 1)
    assert.deepStrictEqual(logs[0], entry)
  })

  it("should save and restore checkpoints", async () => {
    await memoryStore.updateContext("job-1", { step: 1 })
    const checkpointId = await memoryStore.saveCheckpoint("job-1")

    await memoryStore.updateContext("job-1", { step: 2 })
    assert.deepStrictEqual(await memoryStore.getContext("job-1"), { step: 2 })

    await memoryStore.restoreCheckpoint("job-1", checkpointId)
    assert.deepStrictEqual(await memoryStore.getContext("job-1"), { step: 1 })
  })

  it("should throw error when restoring non-existent checkpoint", async () => {
    await assert.rejects(
      memoryStore.restoreCheckpoint("job-1", "non-existent"),
      /Checkpoint non-existent not found for job-1/,
    )
  })
})
