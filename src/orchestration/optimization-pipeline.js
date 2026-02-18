import { z } from "zod"

/**
 * @typedef {Object} OptimizationCandidate
 * @property {string} taskType - e.g., "log_summarizer"
 * @property {number} frequency - Daily volume
 * @property {number} avgCost - Average cost per run
 * @property {string} status - "analyzing", "shadow_testing", "optimized"
 */

/**
 * @typedef {Object} DeterministicFunction
 * @property {string} id
 * @property {string} taskType
 * @property {string} code - The actual JS code body
 * @property {string[]} testCases - IDs of historical jobs used for verification
 * @property {number} confidenceScore - 0.0 to 1.0
 */

/**
 * Optimization Pipeline Classes
 */

export class OptimizationPipeline {
  /**
   * @param {Object} dependencies
   * @param {import("../events/event-bus").EventBus} dependencies.eventBus
   * @param {import("../utils/logger").Logger} dependencies.logger
   * @param {Object} [options]
   * @param {number} [options.optimizationThreshold=100] - Frequency threshold for optimization
   */
  constructor({ eventBus, logger }, options = {}) {
    this.eventBus = eventBus
    this.logger = logger
    this.optimizationThreshold = options.optimizationThreshold || 100

    /** @type {Map<string, OptimizationCandidate>} */
    this.candidates = new Map()

    /** @type {Map<string, DeterministicFunction>} */
    this.activeFunctions = new Map() // taskType -> DeterministicFunction

    /** @type {Map<string, DeterministicFunction>} */
    this.shadowFunctions = new Map() // taskType -> DeterministicFunction

    /** @type {Map<string, any[]>} */
    this.taskHistory = new Map() // taskType -> Array of {input, output}

    this._setupListeners()
  }

  _setupListeners() {
    this.eventBus.on("JOB_COMPLETED", (event) => {
      this._handleJobCompleted(event)
    })
  }

  /**
   * @param {import("./core").Event} event
   */
  _handleJobCompleted(event) {
    const { taskType, input, output, cost } = event.payload
    if (!taskType) return

    // Track history for optimization
    if (!this.taskHistory.has(taskType)) {
      this.taskHistory.set(taskType, [])
    }
    const history = this.taskHistory.get(taskType)
    history.push({ input, output })
    if (history.length > 200) history.shift() // Keep a rolling window

    // Update candidate stats
    let candidate = this.candidates.get(taskType)
    if (!candidate) {
      candidate = {
        taskType,
        frequency: 0,
        avgCost: 0,
        status: "analyzing",
      }
      this.candidates.set(taskType, candidate)
    }

    candidate.frequency++
    // Simple moving average for cost
    candidate.avgCost =
      (candidate.avgCost * (candidate.frequency - 1) + (cost || 0)) /
      candidate.frequency

    // Check if we should start shadow testing if not already optimized or shadow testing
    if (
      candidate.status === "analyzing" &&
      candidate.frequency >= this.optimizationThreshold
    ) {
      this.logger.info(
        `Task type "${taskType}" reached optimization threshold.`,
        { taskType, frequency: candidate.frequency },
      )
      // In a real system, this would trigger the "Optimizer" (Auto-Coder)
      // For now, we'll provide a hook or manual way to inject optimized functions
    }

    // Shadow testing logic
    const shadowFn = this.shadowFunctions.get(taskType)
    if (shadowFn) {
      this._runShadowTest(taskType, shadowFn, input, output)
    }
  }

  /**
   * Manually register an optimized function for shadow testing or active use
   * @param {string} taskType
   * @param {Function} fn
   * @param {boolean} [active=false]
   */
  registerFunction(taskType, fn, active = false) {
    const deterministicFn = {
      id: `fn_${Date.now()}_${taskType}`,
      taskType,
      code: fn.toString(),
      testCases: [],
      confidenceScore: active ? 1.0 : 0.0,
      implementation: fn,
    }

    if (active) {
      this.activeFunctions.set(taskType, deterministicFn)
      if (!this.candidates.has(taskType)) {
        this.candidates.set(taskType, {
          taskType,
          frequency: 0,
          avgCost: 0,
          status: "optimized",
        })
      } else {
        this.candidates.get(taskType).status = "optimized"
      }
    } else {
      this.shadowFunctions.set(taskType, deterministicFn)
      if (!this.candidates.has(taskType)) {
        this.candidates.set(taskType, {
          taskType,
          frequency: 0,
          avgCost: 0,
          status: "shadow_testing",
        })
      } else {
        this.candidates.get(taskType).status = "shadow_testing"
      }
    }

    return deterministicFn.id
  }

  /**
   * @param {string} taskType
   * @param {Object} shadowFnRecord
   * @param {any} input
   * @param {any} expectedOutput
   */
  _runShadowTest(taskType, shadowFnRecord, input, expectedOutput) {
    try {
      const actualOutput = shadowFnRecord.implementation(input)
      const match =
        JSON.stringify(actualOutput) === JSON.stringify(expectedOutput)

      // Update confidence score (simple moving average of matches)
      const alpha = 0.05 // weight for new result
      shadowFnRecord.confidenceScore =
        (shadowFnRecord.confidenceScore || 0) * (1 - alpha) +
        (match ? 1 : 0) * alpha

      this.logger.debug(
        `Shadow test for "${taskType}": ${match ? "MATCH" : "MISMATCH"}`,
        {
          taskType,
          confidence: shadowFnRecord.confidenceScore,
        },
      )

      // Auto-promote if confidence is high enough (e.g., > 0.99)
      if (shadowFnRecord.confidenceScore > 0.99) {
        this.promoteToActive(taskType)
      }
    } catch (error) {
      this.logger.error(`Shadow test error for "${taskType}"`, {
        error: error.message,
        taskType,
      })
      shadowFnRecord.confidenceScore *= 0.8 // Penalize errors heavily
    }
  }

  promoteToActive(taskType) {
    const shadowFn = this.shadowFunctions.get(taskType)
    if (shadowFn) {
      this.logger.info(
        `Promoting shadow function for "${taskType}" to ACTIVE.`,
        { taskType },
      )
      this.activeFunctions.set(taskType, shadowFn)
      this.shadowFunctions.delete(taskType)
      const candidate = this.candidates.get(taskType)
      if (candidate) candidate.status = "optimized"
    }
  }

  /**
   * Returns a deterministic function if one is active for the task type
   * @param {string} taskType
   * @returns {Function|null}
   */
  getOptimizedFunction(taskType) {
    const record = this.activeFunctions.get(taskType)
    return record ? record.implementation : null
  }
}
