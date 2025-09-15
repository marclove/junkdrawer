use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use thiserror::Error;

const HEALTH_ENDPOINT: &str = "http://localhost:8108/health";
const STARTUP_DELAY_SECS: u64 = 2;
const HEALTH_CHECK_INTERVAL_SECS: u64 = 5;

#[derive(Error, Debug)]
pub enum TypesenseError {
    #[error("Failed to create typesense-server sidecar: {0}")]
    SidecarCreation(#[from] tauri_plugin_shell::Error),
    #[error("Failed to spawn typesense-server process: {0}")]
    ProcessSpawn(String),
    #[error("Failed to manage process state: {0}")]
    ProcessState(String),
    #[error("No typesense process is currently running")]
    NoProcessRunning,
    #[error("Failed to kill typesense process: {0}")]
    ProcessKill(String),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HealthResponse {
    pub ok: bool,
}

#[derive(Serialize, Debug)]
pub struct ServerStatus {
    pub is_healthy: bool,
    pub message: String,
}

impl ServerStatus {
    fn healthy() -> Self {
        Self {
            is_healthy: true,
            message: "Typesense server is healthy".to_string(),
        }
    }

    fn unhealthy(message: impl Into<String>) -> Self {
        Self {
            is_healthy: false,
            message: message.into(),
        }
    }
}

pub struct TypesenseState {
    pub child: Arc<Mutex<Option<CommandChild>>>,
}

impl TypesenseState {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }
}

pub async fn check_health() -> ServerStatus {
    match reqwest::get(HEALTH_ENDPOINT).await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<HealthResponse>().await {
                    Ok(health) => {
                        if health.ok {
                            ServerStatus::healthy()
                        } else {
                            ServerStatus::unhealthy("Typesense server health check failed")
                        }
                    }
                    Err(_) => ServerStatus::unhealthy(
                        "Invalid health response format from Typesense server",
                    ),
                }
            } else {
                ServerStatus::unhealthy(format!(
                    "Typesense server health check failed with status: {}",
                    response.status()
                ))
            }
        }
        Err(e) => ServerStatus::unhealthy(format!("Failed to connect to Typesense server: {}", e)),
    }
}

pub fn start_server(app: tauri::AppHandle) -> Result<(), TypesenseError> {
    let typesense_command = app.shell().sidecar("typesense-server")?;

    let (_rx, child) = typesense_command
        .spawn()
        .map_err(|e| TypesenseError::ProcessSpawn(e.to_string()))?;

    // Store the child process in app state
    let state: tauri::State<TypesenseState> = app.state();
    {
        let mut child_guard = state.child.lock().map_err(|e| {
            TypesenseError::ProcessState(format!("Failed to lock child process: {}", e))
        })?;
        *child_guard = Some(child);
    }

    start_health_monitoring(app);
    Ok(())
}

pub fn stop_server(app: tauri::AppHandle) -> Result<(), TypesenseError> {
    let state: tauri::State<TypesenseState> = app.state();
    let mut child_guard = state.child.lock().map_err(|e| {
        TypesenseError::ProcessState(format!("Failed to lock child process: {}", e))
    })?;

    if let Some(child) = child_guard.take() {
        child
            .kill()
            .map_err(|e| TypesenseError::ProcessKill(e.to_string()))?;
        Ok(())
    } else {
        Err(TypesenseError::NoProcessRunning)
    }
}

pub fn is_server_running(app: tauri::AppHandle) -> Result<bool, TypesenseError> {
    let state: tauri::State<TypesenseState> = app.state();
    let child_guard = state.child.lock().map_err(|e| {
        TypesenseError::ProcessState(format!("Failed to lock child process: {}", e))
    })?;

    Ok(child_guard.is_some())
}

fn start_health_monitoring(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(STARTUP_DELAY_SECS)).await;

        loop {
            let status = check_health().await;

            if app.emit("typesense-server-status", &status).is_err() {
                break;
            }

            tokio::time::sleep(Duration::from_secs(HEALTH_CHECK_INTERVAL_SECS)).await;
        }
    });
}
