import React, { useState, useEffect } from 'react';
import { Item, CreateItemRequest } from '../types/database';
import { createItem, getAllItems, deleteItem } from '../lib/database';

export default function ItemManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<CreateItemRequest>({
    title: '',
    content: '',
    item_type: 'note',
    tags: ''
  });

  const loadItems = async () => {
    try {
      setLoading(true);
      const fetchedItems = await getAllItems();
      setItems(fetchedItems);
      setError(null);
    } catch (err) {
      setError(`Failed to load items: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createItem(newItem);
      setItems(prev => [...prev, created]);
      setNewItem({ title: '', content: '', item_type: 'note', tags: '' });
      setError(null);
    } catch (err) {
      setError(`Failed to create item: ${err}`);
    }
  };

  const handleDeleteItem = async (id: number) => {
    try {
      await deleteItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
      setError(null);
    } catch (err) {
      setError(`Failed to delete item: ${err}`);
    }
  };

  if (loading) {
    return <div className="p-4">Loading items...</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Item Manager (SeaORM Demo)</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Create Item Form */}
      <form onSubmit={handleCreateItem} className="mb-8 p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Create New Item</h2>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={newItem.title}
              onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Content</label>
            <textarea
              value={newItem.content || ''}
              onChange={(e) => setNewItem(prev => ({ ...prev, content: e.target.value }))}
              className="w-full p-2 border rounded h-24"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={newItem.item_type}
              onChange={(e) => setNewItem(prev => ({ ...prev, item_type: e.target.value }))}
              className="w-full p-2 border rounded"
            >
              <option value="note">Note</option>
              <option value="link">Link</option>
              <option value="image">Image</option>
              <option value="document">Document</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={newItem.tags || ''}
              onChange={(e) => setNewItem(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full p-2 border rounded"
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Create Item
          </button>
        </div>
      </form>

      {/* Items List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Items ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-gray-500">No items found. Create one above!</p>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
                {item.content && (
                  <p className="text-gray-700 mb-2">{item.content}</p>
                )}
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>Type: {item.item_type}</span>
                  {item.tags && <span>Tags: {item.tags}</span>}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Created: {new Date(item.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
