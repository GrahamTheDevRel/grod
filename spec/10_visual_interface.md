# Spec 10: Visual Interface

## Overview

The Visual Interface is a React-based Single Page Application (SPA) utilizing Material UI (MUI). It serves as the primary control plane for the system, allowing users to monitor jobs, inspect agent states, control system flow, and visually design workflows.

## Principles

- **Real-Time:** Updates should reflect system state immediately via WebSockets or polling.
- **Introspective:** Every internal state (memory, cost, logic path) should be inspectable.
- **Control:** The UI is not just a viewer; it allows pausing, resuming, and intervening.

## Tech Stack

- **Framework:** React
- **UI Library:** Material UI (MUI)
- **State Management:** React Query (server state) + Zustand (client state)
- **Visualization:** React Flow (for node graphs), Recharts (for metrics)
- **Communication:** REST API + WebSocket (Socket.io)

## Core Views

### 1. Dashboard (Job Monitor)

The landing page providing a high-level system overview.

- **Metrics Cards:**
  - Active Jobs
  - Total Cost (Session/Day)
  - Error Rate
  - Average Latency
- **Job List:**
  - Sortable table of recent jobs.
  - Columns: ID, Status (Running, Completed, Failed), Cost, Duration, Start Time.
  - Actions: Cancel, Pause, Retry.
- **Throughput Graph:** Real-time chart of tokens/sec and requests/sec.

### 2. Job Inspector (Introspection)

Detailed view of a single job execution.

- **Visual Graph (React Flow):**
  - Represents the job as a DAG (Directed Acyclic Graph) of agents/steps.
  - Node colors indicate status (Green=Success, Red=Fail, Blue=Running, Grey=Pending).
  - Animated edges show data flow.
- **Step Details Panel:**
  - Opens when a node is clicked.
  - Shows:
    - **Input/Output:** JSON view of data passed in and out.
    - **Logs:** Console logs specific to this step.
    - **Prompt/Response:** The exact prompt sent to the LLM and its raw response.
    - **Cost:** Cost incurred by this specific step.
- **Memory Inspector:**
  - View the current state of the Job's shared memory.
  - Diff view to see how memory changed after a specific step.

### 3. System Controls

Global settings and manual overrides.

- **Rate Limiting:**
  - Sliders to adjust max concurrency per provider.
  - Toggle "Slow Mode" (deliberate delay between steps for debugging).
- **Feature Flags:**
  - Toggle experimental features (defined in `00_master_architecture`).
- **Emergency Stop:**
  - Big red button to cancel all active jobs and halt queues.

### 4. Visual Designer (Workflow Builder)

A drag-and-drop interface for creating new Job templates.

- **Canvas:** Infinite canvas to drag nodes onto.
- **Toolbox:**
  - **Agents:** Drag pre-built agents (e.g., "Summarizer", "Coder").
  - **Logic:** Conditionals (If/Else), Loops (Map/Reduce).
  - **Triggers:** Webhooks, Schedule, Manual.
- **Configuration:**
  - Clicking a node opens a form to configure its parameters (prompts, models, timeouts).
- **Validation:**
  - Real-time checking for unconnected nodes or type mismatches.
- **Export:** Saves the graph as a JSON Job Definition.
- **Inline Component Creation:**
  - **Ad-Hoc Definition:** Double-click the canvas to create a "New Component" node.
  - **Mode Selection:** Choose "Agent" (Prompt + Model) or "Tool" (JavaScript Code).
  - **Immediate Usage:** Connect the new node into the flow immediately without saving to the global library first.
  - **Promotion:** Right-click a local component to "Save to Library" for reuse in other workflows.

## API Requirements

The Core Library must expose endpoints to support this UI:

- `GET /jobs`: List jobs with pagination.
- `GET /jobs/:id`: Get full job details and graph structure.
- `POST /jobs/:id/action`: Execute actions (pause, resume, cancel).
- `GET /system/metrics`: System-wide performance stats.
- `WS /events`: WebSocket stream for real-time updates.

## Directory Structure

```
/ui
  /src
    /components
      /Graph      # React Flow components
      /Metrics    # Charts
      /Layout     # Shell, Sidebar
    /pages
      Dashboard.jsx
      JobDetail.jsx
      Designer.jsx
    /hooks        # API hooks
    /store        # Zustand stores
```
