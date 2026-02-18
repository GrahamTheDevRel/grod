/**
 * @fileoverview Performance Monitor for tracking system health and latency.
 * Based on spec/09_performance_monitor.md
 */

/**
 * @typedef {import('../schemas/core').MetricPoint} MetricPoint
 * @typedef {import('../schemas/core').AggregatedStats} AggregatedStats
 */

export const METRIC_TYPE = {
  LATENCY: "latency",
  TOKEN_THROUGHPUT: "token_throughput",
  ERROR_RATE: "error_rate",
  JOB_DURATION: "job_duration",
}

export const AGGREGATION_WINDOW = {
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
}

/**
 * Helper to calculate percentiles
 * @param {number[]} values
 * @param {number} p
 * @returns {number}
 */
const getPercentile = (values, p) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[index]
}

/**
 * Creates a Performance Monitor instance
 * @param {Object} deps
 * @param {Object} deps.logger
 * @param {Object} [deps.config]
 * @returns {Object}
 */
export const createPerformanceMonitor = ({ logger, config = {} }) => {
  /** @type {MetricPoint[]} */
  let metricBuffer = []

  /**
   * Flushes the buffer and calculates statistics
   */
  const flushMetrics = () => {
    if (metricBuffer.length === 0) return

    // Group by type and tags (simplified tag grouping by JSON.stringify)
    const groups = {}
    for (const point of metricBuffer) {
      const tagKey = JSON.stringify(point.tags)
      const groupKey = `${point.type}:${tagKey}`
      if (!groups[groupKey]) {
        groups[groupKey] = {
          type: point.type,
          tags: point.tags,
          values: [],
        }
      }
      groups[groupKey].values.push(point.value)
    }

    const report = {}

    for (const key in groups) {
      const { type, tags, values } = groups[key]
      const count = values.length
      const sum = values.reduce((a, b) => a + b, 0)
      const min = Math.min(...values)
      const max = Math.max(...values)
      const avg = sum / count

      /** @type {AggregatedStats} */
      const stats = {
        count,
        min,
        max,
        avg,
        p50: getPercentile(values, 50),
        p90: getPercentile(values, 90),
        p99: getPercentile(values, 99),
      }

      if (!report[type]) report[type] = []
      report[type].push({ tags, stats })
    }

    logger.info("Performance Metrics Flushed", report)

    // Clear buffer
    metricBuffer = []
  }

  // Start periodic flush if interval is provided and not 0
  const flushIntervalMs = config.flushIntervalMs || 60000
  let intervalId = null
  if (flushIntervalMs > 0) {
    intervalId = setInterval(flushMetrics, flushIntervalMs)
  }

  return {
    /**
     * Record a latency measurement
     * @param {number} durationMs
     * @param {Object} tags
     */
    recordLatency: (durationMs, tags = {}) => {
      metricBuffer.push({
        type: METRIC_TYPE.LATENCY,
        value: durationMs,
        timestamp: Date.now(),
        tags,
      })
    },

    /**
     * Record token throughput
     * @param {number} tokenCount
     * @param {number} durationMs
     * @param {Object} tags
     */
    recordThroughput: (tokenCount, durationMs, tags = {}) => {
      const tps = durationMs > 0 ? tokenCount / (durationMs / 1000) : 0
      metricBuffer.push({
        type: METRIC_TYPE.TOKEN_THROUGHPUT,
        value: tps,
        timestamp: Date.now(),
        tags,
      })
    },

    /**
     * Record an error occurrence
     * @param {Object} tags
     */
    recordError: (tags = {}) => {
      metricBuffer.push({
        type: METRIC_TYPE.ERROR_RATE,
        value: 1,
        timestamp: Date.now(),
        tags,
      })
    },

    /**
     * Track job duration
     * @param {string} jobId
     * @param {number} durationMs
     * @param {Object} tags
     */
    recordJobDuration: (jobId, durationMs, tags = {}) => {
      metricBuffer.push({
        type: METRIC_TYPE.JOB_DURATION,
        value: durationMs,
        timestamp: Date.now(),
        tags: { ...tags, jobId },
      })

      if (durationMs > (config.longRunningThresholdMs || 300000)) {
        logger.warn(`Long running job detected: ${jobId}`, { durationMs, tags })
      }
    },

    /**
     * Manual flush
     */
    flush: flushMetrics,

    /**
     * Stop the periodic flush
     */
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    },

    // Utility for testing
    getBuffer: () => [...metricBuffer],
    clearBuffer: () => {
      metricBuffer = []
    },
  }
}
