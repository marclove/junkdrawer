import { beforeEach, describe, expect, it, vi } from "vitest"

const invokeMock = vi.fn()

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

import { createItem, deleteItem, getAllItems, getItemById, updateItem } from "./database"

describe("database client", () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it("creates an item", async () => {
    const response = { id: 1 }
    invokeMock.mockResolvedValueOnce(response)

    const result = await createItem({ title: "Note", item_type: "note" })

    expect(invokeMock).toHaveBeenCalledWith("create_item", {
      request: { title: "Note", item_type: "note" },
    })
    expect(result).toBe(response)
  })

  it("fetches all items", async () => {
    invokeMock.mockResolvedValueOnce([{ id: 1 }])

    const result = await getAllItems()

    expect(invokeMock).toHaveBeenCalledWith("get_all_items")
    expect(result).toEqual([{ id: 1 }])
  })

  it("fetches a note by id", async () => {
    invokeMock.mockResolvedValueOnce({ id: 1 })

    const result = await getItemById(1)

    expect(invokeMock).toHaveBeenCalledWith("get_item_by_id", { id: 1 })
    expect(result).toEqual({ id: 1 })
  })

  it("deletes a note", async () => {
    invokeMock.mockResolvedValueOnce(undefined)

    await deleteItem(5)

    expect(invokeMock).toHaveBeenCalledWith("delete_item", { id: 5 })
  })

  it("updates a note", async () => {
    invokeMock.mockResolvedValueOnce({ id: 5 })

    const result = await updateItem({ id: 5, title: "Updated", item_type: "note" })

    expect(invokeMock).toHaveBeenCalledWith("update_item", {
      request: { id: 5, title: "Updated", item_type: "note" },
    })
    expect(result).toEqual({ id: 5 })
  })
})
