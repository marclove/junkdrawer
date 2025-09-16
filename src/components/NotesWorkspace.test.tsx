import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "../types/database"
import NotesWorkspace from "./NotesWorkspace"

const databaseMocks = vi.hoisted(() => ({
  getAllItems: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  createBookmark: vi.fn(),
}))

const typesenseMocks = vi.hoisted(() => {
  const state = {
    isRunning: true,
    isLoading: false,
    error: null as string | null,
    serverStatus: { is_healthy: true, message: "Typesense server is healthy" },
    startServer: vi.fn(),
    stopServer: vi.fn(),
    refreshStatus: vi.fn(),
  }

  return {
    state,
    reset() {
      state.isRunning = true
      state.isLoading = false
      state.error = null
      state.serverStatus = { is_healthy: true, message: "Typesense server is healthy" }
      state.startServer.mockReset()
      state.stopServer.mockReset()
      state.refreshStatus.mockReset()
    },
    useTypesense: vi.fn(() => state),
  }
})

vi.mock("../lib/database", () => databaseMocks)
vi.mock("../lib/useTypesense", () => typesenseMocks)

const { getAllItems, createItem, updateItem, deleteItem, createBookmark } = databaseMocks

const noteFactory = (overrides: Partial<Item> = {}): Item => ({
  id: 1,
  title: "First note",
  content: "Initial content",
  item_type: "note",
  tags: null,
  source_type: null,
  source_url: null,
  created_at: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  updated_at: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  ...overrides,
})

describe("NotesWorkspace", () => {
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  beforeEach(() => {
    getAllItems.mockReset()
    createItem.mockReset()
    updateItem.mockReset()
    deleteItem.mockReset()
    typesenseMocks.reset()
    typesenseMocks.useTypesense.mockClear()
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

    await screen.findByText("Create your first note or bookmark to get started.")

    fireEvent.click(screen.getByRole("button", { name: /new note/i }))

    await waitFor(() => {
      expect(createItem).toHaveBeenCalledWith({
        title: "Untitled note",
        content: "",
        item_type: "note",
      })
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
      })
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
      })
    )

    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument())
  })

  it("only shows the search warning after 10 seconds of downtime", async () => {
    getAllItems.mockResolvedValue([noteFactory()])
    typesenseMocks.state.serverStatus = { is_healthy: false, message: "Typesense offline" }

    render(<NotesWorkspace typesenseWarningDelayMs={60} />)

    await screen.findByDisplayValue("First note")

    expect(screen.queryByText(/search is temporarily unavailable/i)).not.toBeInTheDocument()

    await act(async () => {
      await wait(40)
    })
    expect(screen.queryByText(/search is temporarily unavailable/i)).not.toBeInTheDocument()

    await act(async () => {
      await wait(30)
    })
    expect(screen.getByText(/search is temporarily unavailable/i)).toBeInTheDocument()
  })

  it("hides the search warning when the server recovers", async () => {
    getAllItems.mockResolvedValue([noteFactory()])
    typesenseMocks.state.serverStatus = { is_healthy: false, message: "Typesense offline" }

    const { rerender } = render(<NotesWorkspace typesenseWarningDelayMs={60} />)

    await screen.findByDisplayValue("First note")

    await act(async () => {
      await wait(80)
    })
    expect(screen.getByText(/search is temporarily unavailable/i)).toBeInTheDocument()

    typesenseMocks.state.serverStatus = { is_healthy: true, message: "Healthy" }
    rerender(<NotesWorkspace typesenseWarningDelayMs={60} />)

    await waitFor(() => {
      expect(screen.queryByText(/search is temporarily unavailable/i)).not.toBeInTheDocument()
    })
  })

  describe("bookmark functionality", () => {
    it("creates a bookmark when URL is entered and bookmark button is clicked", async () => {
      const bookmarkItem = noteFactory({
        id: 2,
        title: "Example Site",
        content: "A great example website",
        item_type: "bookmark",
        source_type: "bookmark",
        source_url: "https://example.com",
      })

      getAllItems.mockResolvedValue([])
      createBookmark.mockResolvedValue(bookmarkItem)

      render(<NotesWorkspace />)

      await screen.findByText("Create your first note or bookmark to get started.")

      const urlInput = screen.getByPlaceholderText("Paste URL to bookmark...")
      const bookmarkButton = screen.getByRole("button", { name: /bookmark/i })

      // Initially bookmark button should be disabled
      expect(bookmarkButton).toBeDisabled()

      // Enter URL
      fireEvent.change(urlInput, { target: { value: "https://example.com" } })
      
      // Button should now be enabled
      expect(bookmarkButton).not.toBeDisabled()

      // Click bookmark button
      fireEvent.click(bookmarkButton)

      await waitFor(() => {
        expect(createBookmark).toHaveBeenCalledWith("https://example.com")
      })

      // URL input should be cleared
      expect(urlInput).toHaveValue("")
    })

    it("handles bookmark creation with Enter key", async () => {
      const bookmarkItem = noteFactory({
        id: 3,
        title: "Another Site",
        item_type: "bookmark",
        source_type: "bookmark", 
        source_url: "https://another.com",
      })

      getAllItems.mockResolvedValue([])
      createBookmark.mockResolvedValue(bookmarkItem)

      render(<NotesWorkspace />)

      await screen.findByText("Create your first note or bookmark to get started.")

      const urlInput = screen.getByPlaceholderText("Paste URL to bookmark...")

      await act(async () => {
        fireEvent.change(urlInput, { target: { value: "https://another.com" } })
        fireEvent.keyDown(urlInput, { key: "Enter", code: "Enter" })
      })

      await waitFor(() => {
        expect(createBookmark).toHaveBeenCalledWith("https://another.com")
      })
    })

    it("displays bookmarks with distinct visual treatment", async () => {
      const note = noteFactory()
      const bookmark = noteFactory({
        id: 2,
        title: "Example Bookmark",
        content: "A bookmark description",
        item_type: "bookmark",
        source_type: "bookmark",
        source_url: "https://example.com",
      })

      getAllItems.mockResolvedValue([note, bookmark])

      render(<NotesWorkspace />)

      await waitFor(() => {
        expect(screen.getByText("First note")).toBeInTheDocument()
        expect(screen.getByText("Example Bookmark")).toBeInTheDocument()
      })

      // Bookmark should have link emoji
      expect(screen.getByText("🔗")).toBeInTheDocument()
      
      // Bookmark should show URL instead of content in list
      expect(screen.getByText("https://example.com")).toBeInTheDocument()
    })

    it("displays bookmark details when selected", async () => {
      const bookmark = noteFactory({
        id: 1,
        title: "Example Bookmark",
        content: "A great example website",
        item_type: "bookmark",
        source_type: "bookmark",
        source_url: "https://example.com",
      })

      getAllItems.mockResolvedValue([bookmark])

      render(<NotesWorkspace />)

      // Wait for the bookmark to load and be auto-selected (first item)
      await waitFor(() => {
        // Should show bookmark title as heading
        expect(screen.getByRole("heading", { name: "Example Bookmark" })).toBeInTheDocument()
        
        // Should show URL section
        expect(screen.getByText("URL:")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "https://example.com" })).toBeInTheDocument()
        
        // Should show description section
        expect(screen.getByText("Description:")).toBeInTheDocument()
        expect(screen.getByText("A great example website")).toBeInTheDocument()
      })

      // URL should be clickable and open in new tab
      const urlLink = screen.getByRole("link", { name: "https://example.com" })
      expect(urlLink).toHaveAttribute("href", "https://example.com")
      expect(urlLink).toHaveAttribute("target", "_blank")
      expect(urlLink).toHaveAttribute("rel", "noopener noreferrer")
    })
  })
})
