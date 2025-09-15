use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use thiserror::Error;

use crate::entities::ItemModel;

const HEALTH_ENDPOINT: &str = "http://localhost:8108/health";
const STARTUP_DELAY_SECS: u64 = 2;
const HEALTH_CHECK_INTERVAL_SECS: u64 = 5;
const TYPESENSE_API_KEY: &str = "xyz";
const TYPESENSE_COLLECTION: &str = "notes";
const TYPESENSE_BASE_URL: &str = "http://localhost:8108";

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
    #[error("Failed to prepare typesense data directory: {0}")]
    DataDir(String),
    #[error("Typesense HTTP error: {0}")]
    Http(String),
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
    {
        let state: tauri::State<TypesenseState> = app.state();
        let child_guard = state.child.lock().map_err(|e| {
            TypesenseError::ProcessState(format!("Failed to lock child process: {}", e))
        })?;

        if child_guard.is_some() {
            return Ok(());
        }
    }

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| TypesenseError::DataDir(e.to_string()))?
        .join("typesense");

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| TypesenseError::DataDir(e.to_string()))?;

    std::env::set_var("TYPESENSE_DATA_DIR", &app_dir);
    std::env::set_var("TYPESENSE_API_KEY", TYPESENSE_API_KEY);
    std::env::set_var("TYPESENSE_ADMIN_API_KEY", TYPESENSE_API_KEY);
    std::env::set_var("TYPESENSE_ENABLE_CORS", "true");
    std::env::set_var("TYPESENSE_LISTEN_PORT", "8108");
    std::env::set_var("TYPESENSE_TELEMETRY", "false");

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

fn client() -> reqwest::Client {
    reqwest::Client::new()
}

fn tags_to_array(tags: &Option<String>) -> Vec<String> {
    tags
        .as_ref()
        .map(|value| {
            value
                .split(',')
                .map(|tag| tag.trim())
                .filter(|tag| !tag.is_empty())
                .map(|tag| tag.to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn timestamp(datetime: NaiveDateTime) -> i64 {
    datetime.and_utc().timestamp()
}

async fn ensure_collection() -> Result<(), TypesenseError> {
    let url = format!("{}/collections/{}", TYPESENSE_BASE_URL, TYPESENSE_COLLECTION);
    let response = client()
        .get(url.clone())
        .header("X-TYPESENSE-API-KEY", TYPESENSE_API_KEY)
        .send()
        .await
        .map_err(|e| TypesenseError::Http(e.to_string()))?;

    if response.status().is_success() {
        return Ok(());
    }

    if response.status() != reqwest::StatusCode::NOT_FOUND {
        return Err(TypesenseError::Http(format!(
            "Failed to check collection status: {}",
            response.status()
        )));
    }

    let create_response = client()
        .post(format!("{}/collections", TYPESENSE_BASE_URL))
        .header("X-TYPESENSE-API-KEY", TYPESENSE_API_KEY)
        .json(&serde_json::json!({
            "name": TYPESENSE_COLLECTION,
            "default_sorting_field": "updated_at",
            "fields": [
                {"name": "id", "type": "string"},
                {"name": "title", "type": "string"},
                {"name": "content", "type": "string"},
                {"name": "item_type", "type": "string", "facet": true},
                {"name": "tags", "type": "string[]", "facet": true},
                {"name": "created_at", "type": "int64"},
                {"name": "updated_at", "type": "int64"}
            ]
        }))
        .send()
        .await
        .map_err(|e| TypesenseError::Http(e.to_string()))?;

    if create_response.status().is_success()
        || create_response.status() == reqwest::StatusCode::CONFLICT
    {
        return Ok(());
    }

    Err(TypesenseError::Http(format!(
        "Failed to create collection: {}",
        create_response.status()
    )))
}

pub async fn upsert_item_document(item: &ItemModel) -> Result<(), TypesenseError> {
    ensure_collection().await?;

    let payload = serde_json::json!({
        "id": item.id.to_string(),
        "title": item.title,
        "content": item.content.clone().unwrap_or_default(),
        "item_type": item.item_type,
        "tags": tags_to_array(&item.tags),
        "created_at": timestamp(item.created_at),
        "updated_at": timestamp(item.updated_at)
    });

    let response = client()
        .post(format!(
            "{}/collections/{}/documents?action=upsert",
            TYPESENSE_BASE_URL, TYPESENSE_COLLECTION
        ))
        .header("X-TYPESENSE-API-KEY", TYPESENSE_API_KEY)
        .json(&payload)
        .send()
        .await
        .map_err(|e| TypesenseError::Http(e.to_string()))?;

    if !response.status().is_success() {
        return Err(TypesenseError::Http(format!(
            "Failed to upsert document: {}",
            response.status()
        )));
    }

    Ok(())
}

pub async fn delete_item_document(id: i32) -> Result<(), TypesenseError> {
    let response = client()
        .delete(format!(
            "{}/collections/{}/documents/{}",
            TYPESENSE_BASE_URL, TYPESENSE_COLLECTION, id
        ))
        .header("X-TYPESENSE-API-KEY", TYPESENSE_API_KEY)
        .send()
        .await
        .map_err(|e| TypesenseError::Http(e.to_string()))?;

    if response.status().is_success() || response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(());
    }

    Err(TypesenseError::Http(format!(
        "Failed to delete document: {}",
        response.status()
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tags_are_normalized() {
        let tags = Some("  personal, work , , ideas  ".to_string());
        assert_eq!(tags_to_array(&tags), vec!["personal", "work", "ideas"]);
        assert_eq!(tags_to_array(&None), Vec::<String>::new());
    }

    #[test]
    fn timestamp_converts_naive_datetime() {
        let datetime = NaiveDateTime::from_timestamp_opt(1_700_000_000, 0).expect("valid timestamp");
        assert_eq!(timestamp(datetime), 1_700_000_000);
    }
}
