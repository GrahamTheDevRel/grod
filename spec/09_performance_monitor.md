# Spec 09: Performance Monitor

## Overview

The Performance Monitor is a centralized system for tracking, analyzing, and reporting on the operational health of the AI platform. It aggregates metrics from the Model Gateway (latency, token throughput, errors) and the Job Orchestrator (job duration, step execution times) to provide a comprehensive view of system performance.

## Principles

- **Low Overhead:** Monitoring should be asynchronous and non-blocking. It must not degrade the performance of the core application.
- **Granularity:** Metrics should be tagged by model, provider, and operation type to allow for detailed drill-downs.
- **Percentile-Based Latency:** Averages are misleading. We track P50, P90, and P99 latencies to understand tail performance.
- **Anomaly Detection:** The system should be capable of identifying outliers, such as unusually long-running jobs or spikes in error rates.

## Functional Architecture

### Core Dependencies

- `config`: Configuration for metric aggregation windows and alert thresholds.
- `logger`: For persisting aggregated metrics or alerts.
- `eventBus`: To listen for relevant system events (optional, if passive monitoring is desired).

### Constants

```javascript
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
```

### Data Structures

#### `MetricPoint`

```javascript
/**
 * @typedef {Object} MetricPoint
 * @property {string} type - One of METRIC_TYPE
 * @property {number} value - The raw value (ms, count, etc.)
 * @property {number} timestamp - Unix timestamp
 * @property {Object} tags - Dimensions like { modelId: 'gpt-4', provider: 'openai' }
 */
```

#### `AggregatedStats`

```javascript
/**
 * @typedef {Object} AggregatedStats
 * @property {number} count
 * @property {number} min
 * @property {number} max
 * @property {number} avg
 * @property {number} p50
 * @property {number} p90
 * @property {number} p99
 */
```

### Factory: `createPerformanceMonitor`

```javascript
/**
 * @param {Object} deps
 * @param {Object} deps.logger
 * @param {Object} deps.config
 */
export const createPerformanceMonitor = ({ logger, config }) => {
  // Internal buffer for metrics
  const metricBuffer = []

  // Internal: Flush buffer and calculate stats
  const flushMetrics = () => {
    if (metricBuffer.length === 0) return

    // Group by type and tags, then calculate percentiles
    // This is a simplified example; a real implementation might use a time-series DB or specialized library

    // Example: Calculate P99 for latency
    // ... logic ...

    // Log aggregated stats
    logger.info("Performance Metrics Flushed", {
      /* stats */
    })

    // Clear buffer
    metricBuffer.length = 0
  }

  // Start periodic flush
  setInterval(flushMetrics, config.flushIntervalMs || 60000)

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
     * Record token throughput (tokens per second calculation handled by caller or during aggregation)
     * @param {number} tokenCount
     * @param {number} durationMs
     * @param {Object} tags
     */
    recordThroughput: (tokenCount, durationMs, tags = {}) => {
      // Calculate tokens per second
      const tps = tokenCount / (durationMs / 1000)
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

      // Check for long-running job anomaly
      if (durationMs > (config.longRunningThresholdMs || 300000)) {
        // 5 mins default
        logger.warn(`Long running job detected: ${jobId}`, { durationMs, tags })
      }
    },

    // Utility for testing
    getBuffer: () => [...metricBuffer],
    clearBuffer: () => {
      metricBuffer.length = 0
    },
  }
}
```

## Integration Points

### Model Gateway

- **Latency:** Record time from request start to response received.
- **Throughput:** Calculate TPS based on `usage.totalTokens` and latency.
- **Errors:** Track failed provider calls.

### Job Orchestrator

- **Job Duration:** Track time from `JOB_STATUS.RUNNING` to `COMPLETED` or `FAILED`.
- **Step Latency:** (Optional) Track duration of individual agent steps.

## Testing Strategy

- **Unit Tests:** Verify `record*` methods add to the buffer.
- **Aggregation Logic:** Feed known data points and verify P50/P90/P99 calculations.
- **Threshold Alerts:** Simulate a long-running job and verify the warning log.
- **Concurrency:** Ensure high volume of metric recording doesn't crash the monitor (though JS is single-threaded, memory usage is key).
