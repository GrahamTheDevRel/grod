import assert from "node:assert"
import {
  createPerformanceMonitor,
  METRIC_TYPE,
} from "../src/utils/performance-monitor.js"

describe("Performance Monitor", () => {
  let monitor
  const mockLogger = {
    info: (msg, data) => {
      mockLogger.lastInfo = { msg, data }
    },
    warn: (msg, data) => {
      mockLogger.lastWarn = { msg, data }
    },
    lastInfo: null,
    lastWarn: null,
  }

  beforeEach(() => {
    monitor = createPerformanceMonitor({
      logger: mockLogger,
      config: { flushIntervalMs: 0 }, // Disable periodic flush
    })
    mockLogger.lastInfo = null
    mockLogger.lastWarn = null
  })

  afterEach(() => {
    monitor.stop()
  })

  it("should record latency metrics", () => {
    monitor.recordLatency(100, { model: "gpt-4" })
    const buffer = monitor.getBuffer()
    assert.strictEqual(buffer.length, 1)
    assert.strictEqual(buffer[0].type, METRIC_TYPE.LATENCY)
    assert.strictEqual(buffer[0].value, 100)
    assert.deepStrictEqual(buffer[0].tags, { model: "gpt-4" })
  })

  it("should record throughput metrics", () => {
    monitor.recordThroughput(1000, 2000, { model: "gpt-4" }) // 500 TPS
    const buffer = monitor.getBuffer()
    assert.strictEqual(buffer.length, 1)
    assert.strictEqual(buffer[0].type, METRIC_TYPE.TOKEN_THROUGHPUT)
    assert.strictEqual(buffer[0].value, 500)
  })

  it("should record errors", () => {
    monitor.recordError({ provider: "openai" })
    const buffer = monitor.getBuffer()
    assert.strictEqual(buffer.length, 1)
    assert.strictEqual(buffer[0].type, METRIC_TYPE.ERROR_RATE)
    assert.strictEqual(buffer[0].value, 1)
  })

  it("should record job duration and warn on long jobs", () => {
    const longMonitor = createPerformanceMonitor({
      logger: mockLogger,
      config: { longRunningThresholdMs: 50 },
    })
    longMonitor.recordJobDuration("job-1", 100, { type: "task" })

    assert.ok(mockLogger.lastWarn)
    assert.strictEqual(
      mockLogger.lastWarn.msg,
      "Long running job detected: job-1",
    )
    assert.strictEqual(mockLogger.lastWarn.data.durationMs, 100)
  })

  it("should aggregate metrics on flush", () => {
    monitor.recordLatency(100, { model: "gpt-4" })
    monitor.recordLatency(200, { model: "gpt-4" })
    monitor.recordLatency(300, { model: "gpt-4" })

    monitor.flush()

    assert.ok(mockLogger.lastInfo)
    assert.strictEqual(mockLogger.lastInfo.msg, "Performance Metrics Flushed")

    const stats = mockLogger.lastInfo.data[METRIC_TYPE.LATENCY][0].stats
    assert.strictEqual(stats.count, 3)
    assert.strictEqual(stats.min, 100)
    assert.strictEqual(stats.max, 300)
    assert.strictEqual(stats.avg, 200)
    assert.strictEqual(stats.p50, 200)
    assert.strictEqual(stats.p90, 300)
    assert.strictEqual(stats.p99, 300)

    assert.strictEqual(monitor.getBuffer().length, 0)
  })

  it("should group metrics by tags", () => {
    monitor.recordLatency(100, { model: "gpt-4" })
    monitor.recordLatency(200, { model: "gpt-3.5" })

    monitor.flush()

    const latencyStats = mockLogger.lastInfo.data[METRIC_TYPE.LATENCY]
    assert.strictEqual(latencyStats.length, 2)
  })
})
