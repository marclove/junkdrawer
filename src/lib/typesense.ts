import { invoke } from "@tauri-apps/api/core"

export interface ServerStatus {
  is_healthy: boolean
  message: string
}

/**
 * Start the Typesense server
 * @returns Promise that resolves when the server starts successfully
 * @throws Error if the server fails to start
 */
export async function startTypesenseServer(): Promise<void> {
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
export function onTypesenseStatusUpdate(callback: (status: ServerStatus) => void): () => void {
  // This would require importing the event system from Tauri
  // For now, this is a placeholder for the event listener
  const { listen } = require("@tauri-apps/api/event")

  const unlisten = listen("typesense-server-status", (event: { payload: ServerStatus }) => {
    callback(event.payload)
  })

  return unlisten
}
