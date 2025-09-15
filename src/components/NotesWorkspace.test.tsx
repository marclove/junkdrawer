import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import NotesWorkspace from "./NotesWorkspace"
import type { Item } from "../types/database"

const databaseMocks = vi.hoisted(() => ({
  getAllItems: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}))

const typesenseMocks = vi.hoisted(() => ({
  useTypesense: () => ({
    isRunning: true,
    isLoading: false,
    error: null,
    serverStatus: { is_healthy: true, message: "Typesense server is healthy" },
    startServer: vi.fn(),
    stopServer: vi.fn(),
    refreshStatus: vi.fn(),
  }),
}))

vi.mock("../lib/database", () => databaseMocks)
vi.mock("../lib/useTypesense", () => typesenseMocks)

const { getAllItems, createItem, updateItem, deleteItem } = databaseMocks

const noteFactory = (overrides: Partial<Item> = {}): Item => ({
  id: 1,
  title: "First note",
  content: "Initial content",
  item_type: "note",
  tags: null,
  created_at: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  updated_at: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  ...overrides,
})

describe("NotesWorkspace", () => {
  beforeEach(() => {
    getAllItems.mockReset()
    createItem.mockReset()
    updateItem.mockReset()
    deleteItem.mockReset()
  })

  it("renders notes returned from the database and selects the first", async () => {
    const notes = [noteFactory(), noteFactory({ id: 2, title: "Second note" })]
    getAllItems.mockResolvedValue(notes)

    render(<NotesWorkspace />)

    expect(await screen.findByDisplayValue("First note")).toBeInTheDocument()
    expect(screen.getByText("Second note")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /delete/i })).toHaveLength(2)
  })

  it("creates a new note with default values when the button is clicked", async () => {
    getAllItems.mockResolvedValue([])
    const created = noteFactory({ id: 99, title: "Untitled note", content: "" })
    createItem.mockResolvedValue(created)

    render(<NotesWorkspace />)

    await screen.findByText("Create your first note to get started.")

    fireEvent.click(screen.getByRole("button", { name: /new note/i }))

    await waitFor(() => {
      expect(createItem).toHaveBeenCalledWith({ title: "Untitled note", content: "", item_type: "note" })
    })

    expect(await screen.findByDisplayValue("Untitled note")).toBeInTheDocument()
  })

  it("autosaves edits after a short delay", async () => {
    const original = noteFactory()
    getAllItems.mockResolvedValue([original])
    updateItem.mockImplementation(async ({ id, title, content }) =>
      noteFactory({
        id,
        title: title ?? "",
        content: content ?? "",
        updated_at: new Date("2024-01-01T00:05:00.000Z").toISOString(),
      }),
    )

    render(<NotesWorkspace />)

    const editor = await screen.findByPlaceholderText("Start typing your note...")
    fireEvent.change(editor, { target: { value: "Updated content" } })

    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith({
        id: original.id,
        title: "First note",
        content: "Updated content",
        item_type: "note",
        tags: null,
      }),
    )

    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument())
  })
})
