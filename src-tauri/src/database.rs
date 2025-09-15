use sea_orm::{Database, DatabaseConnection, DbErr};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct DatabaseState {
    pub connection: Arc<Mutex<Option<DatabaseConnection>>>,
}

impl DatabaseState {
    pub fn new() -> Self {
        Self {
            connection: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn init_database(app_handle: &tauri::AppHandle) -> Result<DatabaseConnection, DbErr> {
        // Get the app data directory for storing the SQLite database
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| DbErr::Custom(format!("Failed to get app data dir: {}", e)))?;

        // Create the app data directory if it doesn't exist
        tokio::fs::create_dir_all(&app_data_dir)
            .await
            .map_err(|e| DbErr::Custom(format!("Failed to create app data dir: {}", e)))?;

        // Construct the database file path
        let db_path = app_data_dir.join("junkdrawer.sqlite");
        let database_url = format!("sqlite://{}?mode=rwc", db_path.display());

        // Connect to the database
        let db = Database::connect(&database_url).await?;

        println!("Database connected successfully at: {}", db_path.display());
        Ok(db)
    }

    pub async fn get_connection(&self) -> Option<DatabaseConnection> {
        let connection_guard = self.connection.lock().await;
        connection_guard.clone()
    }

    pub async fn set_connection(&self, conn: DatabaseConnection) {
        let mut connection_guard = self.connection.lock().await;
        *connection_guard = Some(conn);
    }
}
