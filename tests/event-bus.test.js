const { createEventBus } = require("../src/events/event-bus")
const { createConsoleLogger } = require("../src/utils/logger")
const assert = require("assert")

describe("Event Bus Integration", () => {
  it("should propagate traceId and spanId correctly", (done) => {
    const logger = createConsoleLogger("debug")
    const bus = createEventBus({ logger })

    const testPayload = { foo: "bar" }
    const source = "test-suite"

    bus.on("test:event", (event) => {
      try {
        assert.strictEqual(event.type, "test:event")
        assert.deepStrictEqual(event.payload, testPayload)
        assert.strictEqual(event.meta.source, source)
        assert.ok(event.id, "Event should have an ID")
        assert.strictEqual(
          event.trace.traceId,
          event.id,
          "First event traceId should match its id",
        )

        // Test causal tracing
        const childEvent = bus.emit(
          "child:event",
          { baz: 1 },
          "child-source",
          event.trace,
        )

        assert.strictEqual(
          childEvent.trace.traceId,
          event.trace.traceId,
          "Child should share parent traceId",
        )
        assert.strictEqual(
          childEvent.trace.parentId,
          event.id,
          "Child parentId should match parent spanId",
        )

        done()
      } catch (err) {
        done(err)
      }
    })

    bus.emit("test:event", testPayload, source)
  })

  it("should handle multiple subscribers", async () => {
    const logger = createConsoleLogger("error")
    const bus = createEventBus({ logger })
    let count = 0

    bus.on("incr", () => {
      count++
    })
    bus.on("incr", () => {
      count++
    })

    bus.emit("incr", {})

    // Give it a tick for async handlers
    await new Promise((resolve) => setTimeout(resolve, 10))
    assert.strictEqual(count, 2)
  })
})
