use crate::database::DatabaseState;
use crate::entities::{Item, ItemActiveModel, ItemModel};
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CreateItemRequest {
    pub title: String,
    pub content: Option<String>,
    pub item_type: String,
    pub tags: Option<String>,
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
        ..Default::default()
    };

    let item = item.insert(&db).await.map_err(|e| e.to_string())?;
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

    let items = Item::find().all(&db).await.map_err(|e| e.to_string())?;
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
    Ok(())
}
