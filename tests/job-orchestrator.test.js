import assert from "node:assert"
import {
  createOrchestrator,
  JOB_STATUS,
} from "../src/orchestration/job-orchestrator.js"

describe("Job Orchestrator", () => {
  let store
  let eventBus
  let budgetManager
  let orchestrator
  let jobs = {}

  beforeEach(() => {
    jobs = {}
    store = {
      saveJob: async (job) => {
        jobs[job.id] = { ...job }
      },
      getJob: async (id) => jobs[id],
    }

    eventBus = {
      events: [],
      emit: (name, data) => {
        eventBus.events.push({ name, data })
      },
    }

    budgetManager = {
      canSpend: async (jobId) => ({ success: true }),
    }

    orchestrator = createOrchestrator({
      store,
      eventBus,
      budgetManager,
      generateId: () => "test-job-id",
    })
  })

  it("should create a job", async () => {
    const jobId = await orchestrator.createJob({ foo: "bar" }, { maxSteps: 5 })
    assert.strictEqual(jobId, "test-job-id")
    assert.strictEqual(jobs[jobId].status, JOB_STATUS.CREATED)
    assert.strictEqual(jobs[jobId].context.foo, "bar")
    assert.strictEqual(jobs[jobId].permissions.maxSteps, 5)
  })

  it("should start a job", async () => {
    const jobId = await orchestrator.createJob()
    const result = await orchestrator.startJob(jobId)

    assert.strictEqual(result.success, true)
    assert.strictEqual(jobs[jobId].status, JOB_STATUS.RUNNING)
    assert.ok(jobs[jobId].timing.started)
    assert.deepStrictEqual(eventBus.events[0], {
      name: "job_started",
      data: { jobId },
    })
  })

  it("should fail to start a job if budget check fails", async () => {
    budgetManager.canSpend = async () => ({ success: false, error: "No money" })
    const jobId = await orchestrator.createJob()
    const result = await orchestrator.startJob(jobId)

    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, "No money")
    assert.strictEqual(jobs[jobId].status, JOB_STATUS.CREATED)
  })

  it("should pause a running job", async () => {
    const jobId = await orchestrator.createJob()
    await orchestrator.startJob(jobId)
    const result = await orchestrator.pauseJob(jobId)

    assert.strictEqual(result.success, true)
    assert.strictEqual(jobs[jobId].status, JOB_STATUS.PAUSED)
    assert.deepStrictEqual(eventBus.events[1], {
      name: "job_paused",
      data: { jobId },
    })
  })

  it("should fail to pause a job that is not running", async () => {
    const jobId = await orchestrator.createJob()
    const result = await orchestrator.pauseJob(jobId)

    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, "Only running jobs can be paused")
  })

  it("should resume a paused job", async () => {
    const jobId = await orchestrator.createJob()
    await orchestrator.startJob(jobId)
    await orchestrator.pauseJob(jobId)
    const result = await orchestrator.startJob(jobId)

    assert.strictEqual(result.success, true)
    assert.strictEqual(jobs[jobId].status, JOB_STATUS.RUNNING)
  })
})
