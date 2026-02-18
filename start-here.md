# Grod: Start Here

Welcome to the **Grod** development project. Grod is a system designed with the guiding principle of **"Drift to Deterministic"**—replacing AI wherever possible with deterministic code and process.

## 🗺️ Navigation

- **[Overview](overview.md):** The core philosophy and high-level feature set.
- **[Master Architecture](spec/00_master_architecture.md):** The technical foundation, including FP principles and DI patterns.
- **[System Instructions](instructions.md):** **READ THIS FIRST.** This is the master prompt for any LLM/Agent working on this repo.
- **[Progress Tracker](progress.md):** The source of truth for what has been built, what is in progress, and what is next.
- **[Specifications Folder](spec/):** Deep dives into every sub-system.

## 🛠️ How to Work on Grod

This project is built iteratively, one feature or task at a time.

1. **Check [Progress](progress.md):** See the current status and find the next task.
2. **Read the Relevant Spec:** Before coding, read the specific `.md` file in `/spec` related to your task.
3. **Follow [Instructions](instructions.md):** Ensure you follow the master prompt requirements, especially regarding updating documentation and testability.
4. **Update as You Go:** When a task is finished, or a new bug is found, update the [Progress Tracker](progress.md) and the [System Instructions](instructions.md) if necessary.

## 🧪 Testing New Features

As features become usable, you must provide manual test instructions.

- All new features should have a corresponding test script or a clear CLI command sequence.
- Documentation for manual testing should be added to the relevant spec file or a dedicated `testing.md` if complex.
- **Deterministic First:** Always prefer unit tests (via dependency injection) over manual fuzzy testing.

---

_Grod: Building deterministic futures with fuzzy tools._
