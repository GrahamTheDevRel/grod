# Spec 08: Optimization Pipeline (Drift to Deterministic)

## Overview

The Optimization Pipeline is a background system designed to reduce cost and latency over time by observing repetitive LLM tasks and "drifting" them toward cheaper, deterministic solutions. It embodies the principle that **mature systems should become less intelligent (and more efficient) over time**.

## The "Drift to Deterministic" Lifecycle

All repetitive cognitive tasks (e.g., summarizing logs, classifying support tickets, extracting JSON) follow a lifecycle:

1.  **Pure LLM (Exploration):** High intelligence, high cost. Used when the problem is new or data is highly variable.
2.  **Cached LLM (Stabilization):** Identical inputs return cached outputs. Reduces cost for exact repeats.
3.  **Few-Shot / Fine-Tuned (Specialization):** Using smaller, faster models (e.g., Haiku vs. Opus) with proven examples.
4.  **Deterministic (Optimization):** Replacing the LLM entirely with code (Regex, heuristics, simple algorithms) once the pattern is fully understood.

## Functional Architecture

### 1. Data Collection (The "Observer")

The `JobOrchestrator` and `ModelGateway` emit events for every task completion. The Optimization Pipeline subscribes to these events.

**Data Points Captured:**

- Input Prompt / Context
- Model Output
- User Feedback (Thumbs up/down, corrections)
- Latency & Cost
- Task ID / Category (e.g., "summarize_daily_logs")

### 2. Analysis Engine

Periodically (e.g., nightly batch job), the Analysis Engine reviews high-volume Task IDs.

**Heuristics for Optimization candidates:**

- **High Volume:** Tasks running > 100 times/day.
- **Low Variance:** Outputs are structurally very similar.
- **High Cost:** Tasks consuming significant budget.

### 3. Function Registry & Semantic Search

To prevent code duplication, the system maintains a **Function Registry** indexed by vector embeddings of the function's purpose (derived from its description and code).

**Registry Capabilities:**

- **Semantic Search:** Allows the Optimizer to find existing functions that solve similar problems (e.g., "extract email" might match an existing "parse_contact_info" function).
- **Version Control:** Tracks changes to functions over time.

### 4. The "Optimizer" (Auto-Coder)

For tasks identified as candidates, the Optimizer attempts to generate a deterministic function.

**Workflow:**

1.  **Select Samples:** Grab 50 successful input/output pairs for a specific task.
2.  **Check Registry:**
    - Generate a description of the desired logic.
    - Perform a semantic search against the Function Registry.
    - **If Match Found (> 85% similarity):** Propose a **Merge/Update Strategy**. The Optimizer tries to refactor the _existing_ function to handle the new cases while maintaining backward compatibility with its original tests.
    - **If No Match:** Proceed to create a new function.
3.  **Draft Solution:** Ask a strong model (e.g., Claude 3.5 Sonnet) to write (or update) a JavaScript function that transforms the inputs to the outputs _without_ using an LLM.
4.  **Verify:** Run the generated function against a hold-out set of 20 examples (plus all original regression tests if updating).
5.  **Deploy Candidate:** If the verification pass rate is 100%, save the function code to a "Shadow Registry".

### 5. Shadow Testing & Promotion

1.  **Shadow Mode:** The system continues to use the LLM, but _also_ runs the Shadow Function silently. It compares the results.
2.  **Promotion:** If the Shadow Function matches the LLM output > 99% of the time over a week, the system promotes it to "Active".
3.  **Active Mode:** The application now calls the deterministic function instead of the LLM. The LLM is only used as a fallback if the function throws an error.

## Example: The "Summarizer"

**Scenario:** An agent summarizes daily server logs into a status ("OK", "WARNING", "CRITICAL").

1.  **Phase 1 (LLM):** Prompt: "Analyze these logs and return status..." -> Model returns "OK". Cost: $0.01/run.
2.  **Analysis:** System sees 1000 runs. 95% of "OK" results contain the string "exit code 0" and no "error".
3.  **Optimizer:** Generates function:
    ```javascript
    function summarize(logs) {
      if (logs.includes("error") || logs.includes("exception"))
        return "CRITICAL"
      return "OK"
    }
    ```
4.  **Verification:** Passes 100% of test cases.
5.  **Promotion:** Replaces LLM call. Cost: $0.00/run. Speed: 1ms.

## Data Structures

### `OptimizationCandidate`

```javascript
/**
 * @typedef {Object} OptimizationCandidate
 * @property {string} taskType - e.g., "log_summarizer"
 * @property {number} frequency - Daily volume
 * @property {number} avgCost - Average cost per run
 * @property {string} status - "analyzing", "shadow_testing", "optimized"
 */
```

### `DeterministicFunction`

```javascript
/**
 * @typedef {Object} DeterministicFunction
 * @property {string} id
 * @property {string} code - The actual JS code body
 * @property {string[]} testCases - IDs of historical jobs used for verification
 * @property {number} confidenceScore - 0.0 to 1.0
 */
```

## Integration Points

- **Model Gateway:** Before calling an LLM, check if a `DeterministicFunction` exists for this `taskType`.
- **Event Bus:** Listens for `JOB_COMPLETED` events to gather training data.
