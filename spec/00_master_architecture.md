# Master Architecture & Principles

## Guiding Principle: Drift to Deterministic

**Goal:** Replace AI wherever possible with deterministic code/process. Use AI only for the fuzzy parts, then lock it down into structured data or logic.

## Core Architectural Style

- **Functional Programming (FP):**
  - No `class` keywords.
  - Pure functions where possible.
  - Data last, functions first.
- **Dependency Injection (DI):**
  - All side effects (API calls, DB access, time) must be injected as dependencies.
  - Factory functions return the "instance" (object with methods) with dependencies closed over.
  - Enables 100% unit testability without complex mocking frameworks.

## Core Library Pattern

The system is designed as a **Core Library** that can be embedded in various host applications (CLI, REST API, Electron App).

- **Swappability:** The core logic is agnostic to the host environment.
- **Interfaces:** Key infrastructure components (Event Bus, Persistence, Logger) are defined by strict interfaces.
- **Feature Flags:** A feature flag system allows toggling experimental features or specific behaviors without code changes.

### Explicit Interfaces

To ensure swappability, the core system relies on explicit interfaces for infrastructure.

#### Event Bus Interface

The Event Bus is the nervous system. Implementations (In-Memory, Redis, RabbitMQ) must satisfy:

```javascript
/**
 * @typedef {Object} EventBus
 * @property {(event: string, payload: any) => Promise<void>} emit
 * @property {(event: string, handler: (payload: any) => void) => void} on
 * @property {(event: string, handler: (payload: any) => void) => void} off
 */
```

## System Components

This system is composed of loose, single-purpose modules that communicate via a central Event Bus or direct composition.

### 1. The Core Loop

The system does not run as a monolith but as a series of **Jobs** composed of **Agents/Steps**.

- **Job:** A high-level task with a globally unique ID.
- **Agent/Step:** A composable unit of work (AI or deterministic).

### 2. Core Library & Feature Flags

The system is designed as a **Core Library** that can be embedded in various consumers (CLI, REST API, React Dashboard, Electron App).

- **Feature Flags:**
  - All experimental or optional features must be gated behind feature flags.
  - Flags are passed via the configuration object during initialization.
  - Enables safe rollout and A/B testing of prompts or logic.

- **Swappable Infrastructure:**
  - The **Event Bus** and **Persistence Layer** are defined by interfaces, not concrete implementations.
  - This allows the system to run in memory (for testing/local) or on distributed infrastructure (Redis/Postgres) without code changes.

### 3. Module Structure (Pattern)

Every module should follow this structure:

```javascript
// types.js (or JSDoc) defines the shape

/**
 * Core logic (pure)
 * @param {any} input
 */
export const calculateSomething = (input) => { ... }

/**
 * Factory (dependency injection)
 * @param {Object} deps
 * @param {import('./db').Database} deps.db
 * @param {import('./logger').Logger} deps.logger
 * @param {Object} deps.config
 * @returns {{ doAction: (input: any) => Promise<void> }}
 */
export const createModule = ({ db, logger, config }) => {
  return {
    doAction: async (input) => {
      // implementation using dependencies
    }
  }
}
```

## Directory Structure

- `/spec`: Architecture and Design documentation.
- `/src`: Source code.
- `/src/core`: Framework level code (Bus, Orchestrator).
- `/src/agents`: Specific agent implementations.
- `/tests`: Co-located or top-level tests mirroring src.

## Cross-Cutting Concerns

- **Observability:** Everything emits events.
- **Cost:** Every AI call is tracked against a budget.
- **Safety:** Tool capabilities are strictly guarded.
