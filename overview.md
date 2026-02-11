# Grod

Guiding Principle: Drift to Deterministic: replace AI wherever we can with deterministic code / process.

## core architecture

- model switching and calling
  - standard interface for any agent call that routes to provider specific syntax / capabilities
  - capability guarding (temperature, tools, stop someone using a model if it requires tools but they are not available i.e. we have a function that needs a thing a model does not have, it will stop execution / warn)
  - configuration object for model capabilities and costs.
  - validation for addition of models (mini test suite)
- per "task" level permissions i.e. "this task can use tools, this one requires user confirmation, this one can access this memory block etc."
- cost management
  - per task / per call / per job level costings based on model used (costs configured in model config) for tight control.
  - "budget" / "wallet" per agent / per job that lets us set a maximum spend. This can extend over exploration, processing, running existing workflows etc.
  - Agents allowed to allocate some of its own budget toi other agents (orchestration agents can "subcontract" work)
- global stop / start
- job IDs - everything that starts from an action has a global job ID and sub job IDs.
- per "client" (or job) cost management.
- composable parts with common interface
  - globally recognised things like "agentStarted", "agentFinished", "requestContext", "updateContext", "store", "passToAgent" etc. Are common to all composable parts.
  - composable parts expose inputs and outputs to allow for visual builder / workflow design
  - composable parts can be individually upgraded but the interface must remain the same.
- Event system
  - core part of signalling when an agent starts, when it wants context etc.
- basic memory system
- interface to watch and monitor:
  - what agent / node is active
  - slow play mode (x seconds between requests / throttling for overview)
  - internal monlogue inspection
  - pause (dumps current state to file so can resume anytime)
  - checkpoints (so we can edit something and start from previous good state)
- Basic tools / "skills"
- Schemas
  - all communication toi a LLM must include a schema for responses etc.
- Type first communication (everything is an object with a known shape)
  - all communication between agents / steps / tools must be "typed" with a known object shape and requirements to ensure data integrity.
- different modes (for designing and improving processes), with ability to allow or dsiallow a agent to switch modes automatically. (like Roo)
  - The user interface allows switching to "ask" or " orchestrate" or "debug" modes while designing workflows, that gfive different capabilities and job goals etc.
