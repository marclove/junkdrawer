use crate::bookmarks::BookmarkProcessor;
use crate::database::DatabaseState;
use crate::entities::{Item, ItemActiveModel, ItemModel};
use crate::typesense;
use chrono::Utc;
use sea_orm::{ActiveModelTrait, EntityTrait, QueryOrder, Set};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CreateItemRequest {
    pub title: String,
    pub content: Option<String>,
    pub item_type: String,
    pub tags: Option<String>,
    pub source_type: Option<String>,
    pub source_url: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateItemRequest {
    pub id: i32,
    pub title: String,
    pub content: Option<String>,
    pub item_type: String,
    pub tags: Option<String>,
    pub source_type: Option<String>,
    pub source_url: Option<String>,
}

#[tauri::command]
pub async fn create_item(
    request: CreateItemRequest,
    state: tauri::State<'_, DatabaseState>,
) -> Result<ItemModel, String> {
    let db = state
        .get_connection()
        .await
        .ok_or("Database not connected")?;

    let item = ItemActiveModel {
        title: Set(request.title),
        content: Set(request.content),
        item_type: Set(request.item_type),
        tags: Set(request.tags),
        source_type: Set(request.source_type),
        source_url: Set(request.source_url),
        ..Default::default()
    };

    let item = item.insert(&db).await.map_err(|e| e.to_string())?;
    typesense::upsert_item_document(&item)
        .await
        .map_err(|e| e.to_string())?;
    Ok(item)
}

#[tauri::command]
pub async fn get_all_items(
    state: tauri::State<'_, DatabaseState>,
) -> Result<Vec<ItemModel>, String> {
    let db = state
        .get_connection()
        .await
        .ok_or("Database not connected")?;

    let items = Item::find()
        .order_by_desc(crate::entities::item::Column::UpdatedAt)
        .all(&db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(items)
}

#[tauri::command]
pub async fn get_item_by_id(
    id: i32,
    state: tauri::State<'_, DatabaseState>,
) -> Result<Option<ItemModel>, String> {
    let db = state
        .get_connection()
        .await
        .ok_or("Database not connected")?;

    let item = Item::find_by_id(id)
        .one(&db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(item)
}

#[tauri::command]
pub async fn delete_item(id: i32, state: tauri::State<'_, DatabaseState>) -> Result<(), String> {
    let db = state
        .get_connection()
        .await
        .ok_or("Database not connected")?;

    Item::delete_by_id(id)
        .exec(&db)
        .await
        .map_err(|e| e.to_string())?;
    typesense::delete_item_document(id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_item(
    request: UpdateItemRequest,
    state: tauri::State<'_, DatabaseState>,
) -> Result<ItemModel, String> {
    let db = state
        .get_connection()
        .await
        .ok_or("Database not connected")?;

    let existing = Item::find_by_id(request.id)
        .one(&db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Item not found")?;

    let mut active: ItemActiveModel = existing.into();
    active.title = Set(request.title);
    active.content = Set(request.content);
    active.item_type = Set(request.item_type);
    active.tags = Set(request.tags);
    active.source_type = Set(request.source_type);
    active.source_url = Set(request.source_url);
    active.updated_at = Set(Utc::now().naive_utc());

    let updated = active.update(&db).await.map_err(|e| e.to_string())?;

    typesense::upsert_item_document(&updated)
        .await
        .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub async fn create_bookmark(
    url: String,
    state: tauri::State<'_, DatabaseState>,
) -> Result<ItemModel, String> {
    let processor = BookmarkProcessor::new();
    
    // Fetch metadata from URL
    let metadata = processor
        .fetch_metadata(&url)
        .await
        .map_err(|e| format!("Failed to fetch bookmark metadata: {}", e))?;
    
    let db = state
        .get_connection()
        .await
        .ok_or("Database not connected")?;

    // Create bookmark item with fetched metadata
    let item = ItemActiveModel {
        title: Set(metadata.title),
        content: Set(metadata.description),
        item_type: Set("bookmark".to_string()),
        tags: Set(None),
        source_type: Set(Some("bookmark".to_string())),
        source_url: Set(Some(metadata.url)),
        ..Default::default()
    };

    let item = item.insert(&db).await.map_err(|e| e.to_string())?;
    
    // Add to search index
    typesense::upsert_item_document(&item)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(item)
}
