# Spec 03: Job Orchestrator

## Overview

The Job Orchestrator manages the lifecycle of "Jobs". A Job is a container for a workflow, consisting of multiple steps or agents. It handles state, permissions, and global start/stop/pause.

## Principles

- **State Machine:** Jobs move through strict states: `created` -> `running` -> `paused` -> `completed` | `failed`.
- **Permissions:** Capabilities are defined at the Job level and passed down.
- **Determinism:** The orchestrator decides _what_ runs next based on the plan, it doesn't "guess".

## Functional Architecture

### Core Dependencies

- `eventBus`: To broadcast job events.
- `store`: To save job state.
- `budgetManager`: To enforce limits.
- `performanceMonitor`: To track job duration and health.
- `agentRegistry`: To look up available agents.

### Constants

```javascript
export const JOB_STATUS = {
  CREATED: "created",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  FAILED: "failed",
}
```

### Data Structures

#### `Job`

```javascript
/**
 * @typedef {Object} JobPermissions
 * @property {boolean} allowTools
 * @property {boolean} requireApproval
 * @property {number} maxSteps
 */

/**
 * @typedef {Object} Job
 * @property {string} id - UUID
 * @property {string} status - One of JOB_STATUS values
 * @property {Object} context - Shared memory
 * @property {JobPermissions} permissions
 * @property {Array<import('./05_event_bus').Event>} history
 */
```

### Factory: `createOrchestrator`

```javascript
/**
 * @param {Object} deps
 * @param {Object} deps.store
 * @param {Object} deps.eventBus
 * @param {Object} deps.budgetManager
 * @param {Object} deps.performanceMonitor
 */
export const createOrchestrator = ({
  store,
  eventBus,
  budgetManager,
  performanceMonitor,
}) => {
  return {
    /**
     * @param {Object} initialContext
     * @param {JobPermissions} permissions
     * @returns {Promise<string>} jobId
     */
    createJob: async (initialContext, permissions) => {
      const job = {
        id: generateId(),
        status: JOB_STATUS.CREATED,
        context: initialContext,
        permissions,
        history: [],
        timing: { created: Date.now() },
      }
      await store.saveJob(job)
      return job.id
    },

    /**
     * @param {string} jobId
     */
    startJob: async (jobId) => {
      const job = await store.getJob(jobId)
      if (
        job.status !== JOB_STATUS.CREATED &&
        job.status !== JOB_STATUS.PAUSED
      ) {
        return { success: false, error: "Invalid state transition" }
      }

      // Check budget
      const budgetOk = await budgetManager.canSpend(jobId)
      if (!budgetOk.success) return budgetOk

      // Update state
      job.status = JOB_STATUS.RUNNING
      if (!job.timing.started) job.timing.started = Date.now()

      await store.saveJob(job)
      eventBus.emit("job_started", { jobId })

      // Trigger execution loop (internal or external)
      return { success: true }
    },

    /**
     * @param {string} jobId
     */
    pauseJob: async (jobId) => {
      const job = await store.getJob(jobId)
      job.status = JOB_STATUS.PAUSED
      await store.saveJob(job)
      eventBus.emit("job_paused", { jobId })
      return { success: true }
    },

    /**
     * The main "step" logic
     * @param {string} jobId
     * @param {any} input
     */
    nextStep: async (jobId, input) => {
      // 1. Load Job
      // 2. Check permissions/limits
      // 3. Determine next agent (via routing logic or fixed plan)
      // 4. Delegate to Agent Interface
      // 5. Update Context
      // On completion/failure:
      // if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED) {
      //   const duration = Date.now() - job.timing.started
      //   if (performanceMonitor) {
      //     performanceMonitor.recordJobDuration(jobId, duration, { status: job.status })
      //   }
      // }
    },
  }
}
```

## "Slow Play" Mode

The orchestrator can implement a "throttle" middleware or logic in `nextStep` to introduce delays between actions for observability.

## Testing Strategy

- Verify state transitions (cannot go from `created` to `completed` directly).
- Verify permission checks block execution.
- Verify persistence (pause/resume).
