import assert from "node:assert"
import { z } from "zod"
import {
  createAgent,
  createPipeline,
} from "../src/orchestration/agent-factory.js"

describe("Agent Factory", () => {
  const mockMetadata = {
    name: "test-agent",
    description: "A test agent",
    version: "1.0.0",
    inputSchema: z.object({ text: z.string() }),
    outputSchema: z.object({ result: z.string() }),
  }

  const mockDeps = {
    logger: { info: () => {} },
  }

  it("should create an agent and execute it successfully", async () => {
    const agentFactory = createAgent(mockMetadata, async ({ input }) => {
      return { result: `Processed: ${input.text}` }
    })

    const agent = agentFactory(mockDeps)
    const result = await agent.execute({ text: "hello" }, {})

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.result, "Processed: hello")
  })

  it("should fail validation if input is incorrect", async () => {
    const agentFactory = createAgent(mockMetadata, async ({ input }) => {
      return { result: input.text }
    })

    const agent = agentFactory(mockDeps)
    const result = await agent.execute({ notText: 123 }, {})

    assert.strictEqual(result.success, false)
    assert.ok(result.error instanceof Error)
    assert.ok(
      result.error.message.includes("invalid_type") ||
        result.error.name === "ZodError",
    )
  })

  it("should fail validation if output is incorrect", async () => {
    const agentFactory = createAgent(mockMetadata, async () => {
      return { wrongKey: "oops" }
    })

    const agent = agentFactory(mockDeps)
    const result = await agent.execute({ text: "hello" }, {})

    assert.strictEqual(result.success, false)
    assert.ok(result.error instanceof Error)
  })

  it("should pass dependencies to the execution logic", async () => {
    let capturedDeps = null
    const agentFactory = createAgent(mockMetadata, async ({ input }, deps) => {
      capturedDeps = deps
      return { result: input.text }
    })

    const agent = agentFactory(mockDeps)
    await agent.execute({ text: "hello" }, {})

    assert.strictEqual(capturedDeps, mockDeps)
  })
})

describe("Pipeline", () => {
  const step1Metadata = {
    name: "step1",
    description: "First step",
    version: "1.0.0",
    inputSchema: z.object({ val: z.number() }),
    outputSchema: z.object({ val: z.number() }),
  }

  const step2Metadata = {
    name: "step2",
    description: "Second step",
    version: "1.0.0",
    inputSchema: z.object({ val: z.number() }),
    outputSchema: z.object({ str: z.string() }),
  }

  const createStep1 = createAgent(step1Metadata, async ({ input }) => {
    return { val: input.val * 2 }
  })

  const createStep2 = createAgent(step2Metadata, async ({ input }) => {
    return { str: `Result: ${input.val}` }
  })

  it("should execute multiple agents in sequence", async () => {
    const pipelineFactory = createPipeline([createStep1, createStep2])
    const pipeline = pipelineFactory({})

    const result = await pipeline.execute({ val: 5 }, {})

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.data.str, "Result: 10")
  })

  it("should stop execution if an agent fails", async () => {
    const failingStep = createAgent(step1Metadata, async () => {
      throw new Error("Execution failed")
    })

    const pipelineFactory = createPipeline([failingStep, createStep2])
    const pipeline = pipelineFactory({})

    const result = await pipeline.execute({ val: 5 }, {})

    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error.message, "Execution failed")
  })

  it("should infer schemas from first and last agents", () => {
    const pipelineFactory = createPipeline([createStep1, createStep2])
    const pipeline = pipelineFactory({})

    assert.strictEqual(pipeline.metadata.inputSchema, step1Metadata.inputSchema)
    assert.strictEqual(
      pipeline.metadata.outputSchema,
      step2Metadata.outputSchema,
    )
  })
})
