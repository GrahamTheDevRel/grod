import assert from "node:assert"
import { OptimizationPipeline } from "../src/orchestration/optimization-pipeline.js"
import { createEventBus } from "../src/events/event-bus.js"
import { createConsoleLogger } from "../src/utils/logger.js"
import { createModelGateway } from "../src/models/model-gateway.js"

describe("Optimization Pipeline", () => {
  let eventBus
  let logger
  let pipeline

  beforeEach(() => {
    logger = createConsoleLogger("error")
    eventBus = createEventBus({ logger })
    pipeline = new OptimizationPipeline(
      { eventBus, logger },
      { optimizationThreshold: 5 },
    )
  })

  it("should track task frequency and cost from events", () => {
    eventBus.emit("JOB_COMPLETED", {
      taskType: "summarize",
      input: "long text",
      output: "short text",
      cost: 0.01,
    })

    const candidate = pipeline.candidates.get("summarize")
    assert.strictEqual(candidate.frequency, 1)
    assert.strictEqual(candidate.avgCost, 0.01)
    assert.strictEqual(candidate.status, "analyzing")
  })

  it("should run shadow tests and update confidence", async () => {
    const shadowFn = (input) => input.toUpperCase()
    pipeline.registerFunction("shout", shadowFn, false)

    const candidate = pipeline.candidates.get("shout")
    assert.strictEqual(candidate.status, "shadow_testing")

    // Publish a matching event
    eventBus.emit("JOB_COMPLETED", {
      taskType: "shout",
      input: "hello",
      output: "HELLO",
      cost: 0.01,
    })

    const fnRecord = pipeline.shadowFunctions.get("shout")
    assert.ok(fnRecord.confidenceScore > 0)
  })

  it("should promote to active when confidence is high", () => {
    // Force high confidence
    const shadowFn = (input) => "FIXED"
    pipeline.registerFunction("fixed", shadowFn, false)

    const record = pipeline.shadowFunctions.get("fixed")
    record.confidenceScore = 0.995 // Just below threshold

    // One more match should push it over
    eventBus.emit("JOB_COMPLETED", {
      taskType: "fixed",
      input: "any",
      output: "FIXED",
      cost: 0.01,
    })

    assert.strictEqual(pipeline.activeFunctions.has("fixed"), true)
    assert.strictEqual(pipeline.shadowFunctions.has("fixed"), false)
    assert.strictEqual(pipeline.candidates.get("fixed").status, "optimized")
  })

  it("should integrate with Model Gateway for bypass", async () => {
    const optimizedFn = (messages) => "DET_RESULT"
    pipeline.registerFunction("bypass_task", optimizedFn, true)

    const gateway = createModelGateway({
      config: { models: {} },
      providerQueues: {},
      logger,
      optimizationPipeline: pipeline,
    })

    const result = await gateway.call({
      taskType: "bypass_task",
      modelId: "gpt-4",
      messages: [{ role: "user", content: "test" }],
    })

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.content, "DET_RESULT")
    assert.strictEqual(result.meta.modelId, "deterministic")
  })
})
