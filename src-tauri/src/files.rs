use anyhow::{Context, Result as AnyhowResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum FileError {
    #[error("Failed to access documents directory")]
    DocumentsDirectoryError,
    #[error("File operation failed: {0}")]
    FileOperationError(String),
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("Invalid file path: {0}")]
    InvalidPath(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub title: String,
    pub mime_type: Option<String>,
    pub file_size: u64,
    pub file_modified_at: chrono::NaiveDateTime,
    pub final_path: String,
}

#[derive(Debug, Deserialize)]
pub struct FileOperationRequest {
    pub file_path: String,
    pub operation: String, // "copy" or "move"
}

pub struct FileProcessor;

impl FileProcessor {
    pub fn new() -> Self {
        Self
    }

    /// Get the junkdrawer files directory, creating it if it doesn't exist
    fn get_files_directory(app_handle: &tauri::AppHandle) -> AnyhowResult<PathBuf> {
        // Use Tauri's path resolver to get the documents directory
        let documents_dir = app_handle
            .path()
            .document_dir()
            .map_err(|_| FileError::DocumentsDirectoryError)
            .context("Failed to get documents directory")?;
        
        let junkdrawer_files = documents_dir.join("Junkdrawer").join("files");
        
        if !junkdrawer_files.exists() {
            fs::create_dir_all(&junkdrawer_files)
                .context("Failed to create Junkdrawer files directory")?;
        }
        
        Ok(junkdrawer_files)
    }

    /// Extract basic file metadata
    fn extract_metadata(&self, source_path: &Path, final_path: &Path) -> AnyhowResult<FileMetadata> {
        let metadata = fs::metadata(source_path)
            .context("Failed to read file metadata")?;
        
        let file_name = source_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| FileError::InvalidPath(source_path.display().to_string()))?;
        
        let mime_type = mime_guess::from_path(source_path)
            .first()
            .map(|mime| mime.to_string());
        
        let modified_time = metadata
            .modified()
            .context("Failed to get file modification time")?
            .duration_since(std::time::UNIX_EPOCH)
            .context("Invalid modification time")?
            .as_secs();
        
        let file_modified_at = chrono::DateTime::from_timestamp(modified_time as i64, 0)
            .ok_or_else(|| FileError::FileOperationError("Invalid timestamp".to_string()))?
            .naive_utc();
        
        Ok(FileMetadata {
            title: file_name.to_string(),
            mime_type,
            file_size: metadata.len(),
            file_modified_at,
            final_path: final_path.display().to_string(),
        })
    }

    /// Generate a unique filename if a file with the same name already exists
    fn generate_unique_filename(&self, target_dir: &Path, filename: &str) -> String {
        let mut final_name = filename.to_string();
        let mut counter = 1;
        
        while target_dir.join(&final_name).exists() {
            if let Some(stem) = Path::new(filename).file_stem().and_then(|s| s.to_str()) {
                if let Some(ext) = Path::new(filename).extension().and_then(|s| s.to_str()) {
                    final_name = format!("{} ({}).{}", stem, counter, ext);
                } else {
                    final_name = format!("{} ({})", stem, counter);
                }
            } else {
                final_name = format!("{} ({})", filename, counter);
            }
            counter += 1;
        }
        
        final_name
    }

    /// Process a file operation (copy or move)
    pub fn process_file(&self, request: FileOperationRequest, app_handle: &tauri::AppHandle) -> AnyhowResult<FileMetadata> {
        let source_path = Path::new(&request.file_path);
        
        if !source_path.exists() {
            return Err(FileError::FileNotFound(request.file_path).into());
        }
        
        let files_dir = Self::get_files_directory(app_handle)?;
        
        let filename = source_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| FileError::InvalidPath(request.file_path.clone()))?;
        
        let unique_filename = self.generate_unique_filename(&files_dir, filename);
        let target_path = files_dir.join(&unique_filename);
        
        match request.operation.as_str() {
            "copy" => {
                fs::copy(source_path, &target_path)
                    .context("Failed to copy file")?;
            }
            "move" => {
                fs::rename(source_path, &target_path)
                    .context("Failed to move file")?;
            }
            _ => {
                return Err(FileError::FileOperationError(
                    format!("Invalid operation: {}", request.operation)
                ).into());
            }
        }
        
        self.extract_metadata(source_path, &target_path)
    }
}

impl Default for FileProcessor {
    fn default() -> Self {
        Self::new()
    }
}