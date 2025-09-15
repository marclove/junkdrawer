import { invoke } from '@tauri-apps/api/core';
import { Item, CreateItemRequest } from '../types/database';

export async function createItem(request: CreateItemRequest): Promise<Item> {
  return invoke('create_item', { request });
}

export async function getAllItems(): Promise<Item[]> {
  return invoke('get_all_items');
}

export async function getItemById(id: number): Promise<Item | null> {
  return invoke('get_item_by_id', { id });
}

export async function deleteItem(id: number): Promise<void> {
  return invoke('delete_item', { id });
}
