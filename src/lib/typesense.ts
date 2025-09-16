import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

export interface ServerStatus {
  is_healthy: boolean
  message: string
}

export function isTauriEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  )
}

/**
 * Start the Typesense server
 * @returns Promise that resolves when the server starts successfully
 * @throws Error if the server fails to start
 */
export async function startTypesenseServer(): Promise<void> {
  if (!isTauriEnvironment()) {
    return Promise.resolve()
  }
  try {
    await invoke("start_typesense_server")
  } catch (error) {
    throw new Error(`Failed to start Typesense server: ${error}`)
  }
}

/**
 * Stop the Typesense server
 * @returns Promise that resolves when the server stops successfully
 * @throws Error if the server fails to stop or is not running
 */
export async function stopTypesenseServer(): Promise<void> {
  if (!isTauriEnvironment()) {
    return Promise.resolve()
  }
  try {
    await invoke("stop_typesense_server")
  } catch (error) {
    throw new Error(`Failed to stop Typesense server: ${error}`)
  }
}

/**
 * Check if the Typesense server is currently running
 * @returns Promise that resolves to true if the server is running, false otherwise
 */
export async function isTypesenseServerRunning(): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return false
  }
  try {
    return await invoke("is_typesense_server_running")
  } catch (error) {
    console.error("Failed to check Typesense server status:", error)
    return false
  }
}

/**
 * Listen for Typesense server status updates
 * @param callback Function to call when status updates are received
 * @returns Function to unsubscribe from status updates
 */
export async function onTypesenseStatusUpdate(
  callback: (status: ServerStatus) => void
): Promise<() => void> {
  if (!isTauriEnvironment()) {
    return Promise.resolve(() => {})
  }
  const unlisten = await listen<ServerStatus>("typesense-server-status", (event) => {
    callback(event.payload)
  })

  return () => {
    unlisten()
  }
}
