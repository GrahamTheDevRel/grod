# Design Patterns & Practices

_This document captures patterns we discover and like. It is a living document._

## 1. Functional Dependency Injection

Instead of classes, use factory functions that accept a `dependencies` object.

**Pattern:**

```javascript
/**
 * @typedef {Object} Logger
 * @property {(msg: string) => void} log
 */

/**
 * @param {Object} deps
 * @param {Logger} deps.logger
 */
export const createService = (deps) => {
  // Extract deps
  const { logger } = deps

  /**
   * @param {number} data
   * @returns {number}
   */
  const performTask = (data) => {
    logger.log("Starting task")
    return data * 2
  }

  // Return public interface
  return {
    performTask,
  }
}
```

**Benefit:** Testing is trivial. You just pass mock functions in the `deps` object.

## 2. The "Result" Pattern

Avoid throwing errors for expected failure states. Return a Result object (tuple or object).

**Pattern:**

```javascript
/**
 * @returns {import('./07_schema_types').Result<string, string>}
 */
const safeOperation = () => {
  const somethingBad = false // Simulator

  if (somethingBad) {
    return { success: false, error: "Failed" }
  }
  return { success: true, data: "Success" }
}
```

**Benefit:** Forces the caller to handle the failure case explicitly.

## 3. Configuration as Code

Models, capabilities, and system limits should be defined in strict configuration objects/files, not magic strings.

## 4. Event-Driven State

State changes should be broadcast as events. Agents should react to events or allow the Orchestrator to subscribe to them.
