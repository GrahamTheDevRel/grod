import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import { createEventBus } from "./events/event-bus.js"
import { createPerformanceMonitor } from "./utils/performance-monitor.js"
import { createBudgetManager } from "./utils/budget-manager.js"
import { createConsoleLogger } from "./utils/logger.js"
import { createInMemoryAdapter } from "./utils/memory-adapter-in-memory.js"

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Create instances for the server
const logger = createConsoleLogger("debug")
const eventBus = createEventBus({ logger })
const performanceMonitor = createPerformanceMonitor({ logger })
const memoryAdapter = createInMemoryAdapter()
const budgetManager = createBudgetManager({
  store: memoryAdapter,
  logger,
})

// Store recent jobs in memory for the UI
const jobs = new Map()

// Subscribe to event bus to track jobs
eventBus.on("job:started", (event) => {
  const { jobId } = event.payload
  jobs.set(jobId, {
    id: jobId,
    status: "running",
    startTime: event.meta.timestamp,
    steps: [],
    cost: 0,
  })
  io.emit("job:updated", jobs.get(jobId))
})

eventBus.on("job:completed", (event) => {
  const { jobId } = event.payload
  const job = jobs.get(jobId)
  if (job) {
    job.status = "completed"
    job.endTime = event.meta.timestamp
    job.duration = job.endTime - job.startTime
    io.emit("job:updated", job)
  }
})

eventBus.on("job:failed", (event) => {
  const { jobId, error } = event.payload
  const job = jobs.get(jobId)
  if (job) {
    job.status = "failed"
    job.error = error
    job.endTime = event.meta.timestamp
    io.emit("job:updated", job)
  }
})

// API Endpoints
app.get("/api/jobs", (req, res) => {
  res.json(Array.from(jobs.values()))
})

app.get("/api/metrics", async (req, res) => {
  res.json({
    performance: {},
    budget: { totalSpend: 0 },
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Grod API Server running on port ${PORT}`)
})
