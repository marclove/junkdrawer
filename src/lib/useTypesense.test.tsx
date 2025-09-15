import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  isTypesenseServerRunning: vi.fn(),
  isTauriEnvironment: vi.fn().mockReturnValue(true),
  onTypesenseStatusUpdate: vi.fn(),
  startTypesenseServer: vi.fn(),
  stopTypesenseServer: vi.fn(),
}))

vi.mock("./typesense", () => mocks)

import { useTypesense } from "./useTypesense"

const resetMocks = () => {
  mocks.isTypesenseServerRunning.mockReset()
  mocks.isTypesenseServerRunning.mockResolvedValue(false)
  mocks.isTauriEnvironment.mockReset()
  mocks.isTauriEnvironment.mockReturnValue(true)
  mocks.onTypesenseStatusUpdate.mockReset()
  mocks.startTypesenseServer.mockReset()
  mocks.stopTypesenseServer.mockReset()
}

describe("useTypesense", () => {
  afterEach(() => {
    resetMocks()
  })

  it("initially checks server status when in tauri", async () => {
    mocks.isTypesenseServerRunning.mockResolvedValueOnce(true)

    const { result } = renderHook(() => useTypesense())

    await act(async () => {
      await Promise.resolve()
    })

    expect(mocks.isTypesenseServerRunning).toHaveBeenCalled()
    expect(result.current.isRunning).toBe(true)
  })

  it("skips initial check outside tauri", async () => {
    mocks.isTauriEnvironment.mockReturnValueOnce(false)

    const { result } = renderHook(() => useTypesense())

    await act(async () => {
      await Promise.resolve()
    })

    expect(mocks.isTypesenseServerRunning).not.toHaveBeenCalled()
    expect(result.current.isRunning).toBe(false)
  })

  it("updates state when start succeeds", async () => {
    mocks.startTypesenseServer.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useTypesense())

    await act(async () => {
      await result.current.startServer()
    })

    expect(result.current.isRunning).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("captures errors when start fails", async () => {
    mocks.startTypesenseServer.mockRejectedValueOnce(new Error("boom"))

    const { result } = renderHook(() => useTypesense())

    await act(async () => {
      await result.current.startServer()
    })

    expect(result.current.error).toBe("boom")
    expect(result.current.isRunning).toBe(false)
  })

  it("stops server and clears status", async () => {
    mocks.stopTypesenseServer.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useTypesense())

    await act(async () => {
      await result.current.stopServer()
    })

    expect(result.current.isRunning).toBe(false)
    expect(result.current.serverStatus).toBeNull()
  })

  it("listens for status updates", async () => {
    const callbacks: Array<(status: unknown) => void> = []
    mocks.onTypesenseStatusUpdate.mockImplementation(async (callback: (status: unknown) => void) => {
      callbacks.push(callback)
      return () => {}
    })

    const { result } = renderHook(() => useTypesense())

    await act(async () => {
      callbacks.forEach((callback) => callback({ is_healthy: false, message: "down" }))
    })

    expect(result.current.isRunning).toBe(false)
    expect(result.current.error).toBe("down")
    expect(result.current.serverStatus).toEqual({ is_healthy: false, message: "down" })
  })

  it("refreshes status on demand", async () => {
    mocks.isTypesenseServerRunning.mockResolvedValueOnce(false)
    mocks.isTypesenseServerRunning.mockResolvedValueOnce(true)

    const { result } = renderHook(() => useTypesense())

    await act(async () => {
      await result.current.refreshStatus()
    })

    expect(mocks.isTypesenseServerRunning).toHaveBeenCalledTimes(2)
    expect(result.current.isRunning).toBe(true)
  })
})
