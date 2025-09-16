import { invoke } from "@tauri-apps/api/core"
import type { CreateItemRequest, Item, UpdateItemRequest } from "../types/database"

export async function createItem(request: CreateItemRequest): Promise<Item> {
  return invoke("create_item", { request })
}

export async function getAllItems(): Promise<Item[]> {
  return invoke("get_all_items")
}

export async function getItemById(id: number): Promise<Item | null> {
  return invoke("get_item_by_id", { id })
}

export async function deleteItem(id: number): Promise<void> {
  return invoke("delete_item", { id })
}

export async function updateItem(request: UpdateItemRequest): Promise<Item> {
  return invoke("update_item", { request })
}

export async function createBookmark(url: string): Promise<Item> {
  return invoke("create_bookmark", { url })
}
