# Plan: Convert Spec Files to JSDoc

## Objective

Convert all TypeScript syntax in the `spec/` directory to Vanilla JavaScript with JSDoc annotations to align with the project's "Drift to Deterministic" and "No Compile Step" philosophy.

## Strategy

I will process each file in the `spec/` directory, locating ``typescript` code blocks and converting them to ``javascript` blocks with appropriate JSDoc comments.

## detailed Conversion Rules

1.  **Interfaces & Types**
    - **Source:** `interface User { name: string; age: number; }`
    - **Target:**
      ```javascript
      /**
       * @typedef {Object} User
       * @property {string} name
       * @property {number} age
       */
      ```

2.  **Generics & Union Types**
    - **Source:** `type Result<T> = { success: true; data: T } | { success: false; error: Error }`
    - **Target:**
      ```javascript
      /**
       * @template T
       * @typedef {({ success: true, data: T } | { success: false, error: Error })} Result
       */
      ```

3.  **Function Signatures**
    - **Source:** `execute: (input: any, context: JobContext) => Promise<Result<any>>`
    - **Target:**
      ```javascript
      /**
       * @param {any} input
       * @param {JobContext} context
       * @returns {Promise<Result<any>>}
       */
      execute: async (input, context) => { ... }
      ```

4.  **Code Block Labels**
    - Change all ``typescript` fences to ``javascript`.

## File-by-File Execution Plan

1.  **`spec/01_model_gateway.md`**
    - Convert `ModelConfig`, `ModelRequest`, `ModelResponse` interfaces to `@typedef`.
    - Update factory function example to standard JS.

2.  **`spec/02_cost_budget_manager.md`**
    - Convert `BudgetScope` interface to `@typedef`.
    - Update factory function example.

3.  **`spec/03_job_orchestrator.md`**
    - Convert `Job` interface to `@typedef`.
    - Update factory function example.

4.  **`spec/04_composable_agent_interface.md`**
    - Convert `Agent` interface to `@typedef`.
    - Update `createAgent` and `PipelineAgent` examples.

5.  **`spec/05_event_bus.md`**
    - Convert `TraceContext`, `EventMetadata`, `Event` interfaces to `@typedef`.
    - Update `createEventBus` example.

6.  **`spec/06_memory_store.md`**
    - Convert `Context`, `MemoryEntry` interfaces to `@typedef`.
    - Update `createMemoryStore` example.

7.  **`spec/07_schema_types.md`**
    - Convert `UUID`, `ISODate`, `Result`, `AgentMessage`, `ToolCall` types/interfaces to `@typedef`.
    - Keep Zod schema examples as `javascript` (they are already JS libraries, just ensuring the block label is correct).

8.  **`spec/98_design_patterns.md`**
    - Review for any stray TS blocks (e.g., in "Functional Dependency Injection").

## Verification

- Ensure all ````typescript` blocks are gone.
- Ensure JSDoc syntax is valid.
