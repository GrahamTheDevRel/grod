/**
 * @typedef {Object} JobPermissions
 * @property {boolean} allowTools
 * @property {boolean} requireApproval
 * @property {number} maxSteps
 */

/**
 * @typedef {Object} JobTiming
 * @property {number} created
 * @property {number} [started]
 * @property {number} [completed]
 */

/**
 * @typedef {Object} Job
 * @property {string} id - UUID
 * @property {string} status - One of JOB_STATUS values
 * @property {Object} context - Shared memory
 * @property {JobPermissions} permissions
 * @property {Array<Object>} history
 * @property {JobTiming} timing
 */

export const JOB_STATUS = {
  CREATED: "created",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  FAILED: "failed",
}

/**
 * Creates a Job Orchestrator.
 *
 * @param {Object} deps
 * @param {Object} deps.store - Persistence layer for jobs
 * @param {Object} deps.eventBus - Global event bus
 * @param {Object} deps.budgetManager - Cost and budget enforcer
 * @param {Object} [deps.performanceMonitor] - Optional performance tracker
 * @param {Function} [deps.generateId] - ID generator function
 */
export const createOrchestrator = ({
  store,
  eventBus,
  budgetManager,
  performanceMonitor,
  generateId = () => Math.random().toString(36).substring(2, 15),
}) => {
  return {
    /**
     * Creates a new job and saves it to the store.
     *
     * @param {Object} initialContext
     * @param {JobPermissions} permissions
     * @returns {Promise<string>} jobId
     */
    createJob: async (initialContext, permissions) => {
      const job = {
        id: generateId(),
        status: JOB_STATUS.CREATED,
        context: initialContext || {},
        permissions: permissions || {
          allowTools: false,
          requireApproval: true,
          maxSteps: 10,
        },
        history: [],
        timing: { created: Date.now() },
      }
      await store.saveJob(job)
      return job.id
    },

    /**
     * Starts or resumes a job.
     *
     * @param {string} jobId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    startJob: async (jobId) => {
      const job = await store.getJob(jobId)
      if (!job) {
        return { success: false, error: "Job not found" }
      }

      if (
        job.status !== JOB_STATUS.CREATED &&
        job.status !== JOB_STATUS.PAUSED
      ) {
        return {
          success: false,
          error: `Invalid state transition from ${job.status}`,
        }
      }

      // Check budget
      const budgetOk = await budgetManager.canSpend(jobId)
      if (!budgetOk.success) return budgetOk

      // Update state
      job.status = JOB_STATUS.RUNNING
      if (!job.timing.started) job.timing.started = Date.now()

      await store.saveJob(job)
      eventBus.emit("job_started", { jobId })

      return { success: true }
    },

    /**
     * Pauses a running job.
     *
     * @param {string} jobId
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    pauseJob: async (jobId) => {
      const job = await store.getJob(jobId)
      if (!job) {
        return { success: false, error: "Job not found" }
      }

      if (job.status !== JOB_STATUS.RUNNING) {
        return { success: false, error: "Only running jobs can be paused" }
      }

      job.status = JOB_STATUS.PAUSED
      await store.saveJob(job)
      eventBus.emit("job_paused", { jobId })
      return { success: true }
    },

    /**
     * The main "step" logic (Placeholder for now)
     * @param {string} jobId
     * @param {any} input
     */
    nextStep: async (jobId, input) => {
      const job = await store.getJob(jobId)
      if (!job || job.status !== JOB_STATUS.RUNNING) {
        return { success: false, error: "Job not running" }
      }

      // 1. Load Job
      // 2. Check permissions/limits
      // 3. Determine next agent (via routing logic or fixed plan)
      // 4. Delegate to Agent Interface
      // 5. Update Context

      // Placeholder: Mark as completed if we've "reached the end"
      // In a real implementation, this would be more complex

      return { success: true, message: "Step processed (placeholder)" }
    },
  }
}
