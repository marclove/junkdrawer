mod typesense;

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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(TypesenseState::new())
        .invoke_handler(tauri::generate_handler![
            start_typesense_server,
            stop_typesense_server,
            is_typesense_server_running
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            if let Err(e) = typesense::start_server(app_handle) {
                eprintln!("Failed to start Typesense server: {}", e);
                // Don't fail app startup if Typesense fails to start
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
