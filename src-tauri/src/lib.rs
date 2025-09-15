mod database;
mod db_commands;
mod entities;
mod migration;
mod typesense;

use database::DatabaseState;
use tauri::Manager;
use typesense::TypesenseState;

#[tauri::command]
fn start_typesense_server(app: tauri::AppHandle) -> Result<(), String> {
    typesense::start_server(app).map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_typesense_server(app: tauri::AppHandle) -> Result<(), String> {
    typesense::stop_server(app).map_err(|e| e.to_string())
}

#[tauri::command]
fn is_typesense_server_running(app: tauri::AppHandle) -> Result<bool, String> {
    typesense::is_server_running(app).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(TypesenseState::new())
        .manage(DatabaseState::new())
        .invoke_handler(tauri::generate_handler![
            start_typesense_server,
            stop_typesense_server,
            is_typesense_server_running,
            db_commands::create_item,
            db_commands::get_all_items,
            db_commands::get_item_by_id,
            db_commands::delete_item
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Start Typesense server
            if let Err(e) = typesense::start_server(app_handle.clone()) {
                eprintln!("Failed to start Typesense server: {}", e);
                // Don't fail app startup if Typesense fails to start
            }

            // Initialize database in background
            let db_state = app.state::<DatabaseState>().inner().clone();
            std::thread::spawn(move || {
                tauri::async_runtime::block_on(async {
                    match database::DatabaseState::init_database(&app_handle.clone()).await {
                        Ok(conn) => {
                            // Run SeaORM migrations
                            use sea_orm_migration::MigratorTrait;
                            if let Err(e) = migration::Migrator::up(&conn, None).await {
                                eprintln!("Failed to run database migrations: {}", e);
                            } else {
                                db_state.set_connection(conn).await;
                                println!("Database initialized successfully");
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to initialize database: {}", e);
                        }
                    }
                });
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
