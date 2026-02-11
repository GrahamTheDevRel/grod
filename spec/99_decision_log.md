# Architectural Decision Log (ADR)

_Chronological log of major decisions and their context._

## [DATE] 001. Functional over Object-Oriented

**Decision:** We will use functional programming patterns (factory functions, closures) instead of ES6 Classes.
**Context:** We want to ensure 100% testability and enforce strict dependency injection. Classes often encourage internal state mutation and tight coupling.
**Consequences:**

- All modules must expose a `createX({ deps })` factory.
- State must be managed explicitly (passed through or held in closure).

## [DATE] 002. Drift to Deterministic

**Decision:** AI should be the "glue" or the "generator", but not the "engine" for everything.
**Context:** AI is probabilistic. To build reliable systems, we need to constrain the AI's output into deterministic structures (JSON, Code) that are then executed by rigid code.
**Consequences:**

- Strict schemas for all LLM interactions.
- Validation steps are mandatory after every generation.

## [DATE] 003. Deep Tracing & Causality

**Decision:** The Event Bus will enforce `traceId` and `parentId` on every event.
**Context:** In complex agentic workflows, side effects (mutations, API calls) can happen asynchronously. Debugging "why did the context change?" is impossible without a causal link.
**Consequences:**

- All `emit` calls require awareness of the "triggering event" (the parent).
- Handlers must be wrapped to ensure they don't break the trace chain.
- State mutations must explicitly emit `state:updated` events to be visible in the trace.
