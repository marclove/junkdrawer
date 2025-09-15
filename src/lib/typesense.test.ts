import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const invokeMock = vi.fn()
const listenMock = vi.fn()

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}))

// Import after mocks
import {
  isTauriEnvironment,
  isTypesenseServerRunning,
  onTypesenseStatusUpdate,
  startTypesenseServer,
  stopTypesenseServer,
} from "./typesense"

function clearTauriInternals() {
  if (typeof window !== "undefined") {
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  }
}

describe("typesense client", () => {
  beforeEach(() => {
    invokeMock.mockReset()
    listenMock.mockReset()
    clearTauriInternals()
  })

  afterEach(() => {
    clearTauriInternals()
  })

  it("detects non-tauri environment", () => {
    expect(isTauriEnvironment()).toBe(false)
  })

  it("detects tauri environment when internals exist", () => {
    ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    expect(isTauriEnvironment()).toBe(true)
  })

  it("skips invoking start when not running in tauri", async () => {
    await startTypesenseServer()
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("invokes start when tauri internals exist", async () => {
    invokeMock.mockResolvedValue(undefined)
    ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}

    await startTypesenseServer()
    expect(invokeMock).toHaveBeenCalledWith("start_typesense_server")
  })

  it("reports server offline when not in tauri", async () => {
    const result = await isTypesenseServerRunning()
    expect(result).toBe(false)
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("delegates server status check to invoke in tauri", async () => {
    invokeMock.mockResolvedValue(true)
    ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}

    const result = await isTypesenseServerRunning()
    expect(invokeMock).toHaveBeenCalledWith("is_typesense_server_running")
    expect(result).toBe(true)
  })

  it("subscribes to status updates in tauri", async () => {
    const unlisten = vi.fn()
    const received: unknown[] = []
    listenMock.mockImplementation(async (_event, callback: (event: { payload: unknown }) => void) => {
      callback({ payload: { is_healthy: true, message: "ok" } })
      return unlisten
    })
    ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}

    const dispose = await onTypesenseStatusUpdate((status) => {
      received.push(status)
    })
    expect(listenMock).toHaveBeenCalledWith("typesense-server-status", expect.any(Function))
    dispose()
    expect(unlisten).toHaveBeenCalled()
    expect(received).toEqual([{ is_healthy: true, message: "ok" }])
  })

  it("returns noop unsubscribe outside tauri", async () => {
    const dispose = await onTypesenseStatusUpdate(() => {})
    expect(listenMock).not.toHaveBeenCalled()
    expect(() => dispose()).not.toThrow()
  })

  it("skips stop request outside tauri", async () => {
    await stopTypesenseServer()
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("invokes stop when tauri internals exist", async () => {
    invokeMock.mockResolvedValue(undefined)
    ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}

    await stopTypesenseServer()
    expect(invokeMock).toHaveBeenCalledWith("stop_typesense_server")
  })
})
