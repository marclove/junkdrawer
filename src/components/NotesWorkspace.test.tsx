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
  createFileItem: vi.fn(),
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

const { getAllItems, createItem, updateItem, deleteItem, createBookmark, createFileItem } = databaseMocks

const noteFactory = (overrides: Partial<Item> = {}): Item => ({
  id: 1,
  title: "First note",
  content: "Initial content",
  item_type: "note",
  tags: null,
  source_type: null,
  source_url: null,
  mime_type: null,
  file_size: null,
  file_modified_at: null,
  metadata: null,
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
    createBookmark.mockReset()
    createFileItem.mockReset()
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

  describe("file drop functionality", () => {
    // Helper to create a mock file
    const createMockFile = (name: string, type: string = "text/plain") => {
      return new File(["test content"], name, { type, lastModified: Date.now() })
    }

    // Helper to simulate file drop event
    const simulateFileDrop = async (files: File[]) => {
      const dataTransfer = {
        files,
        items: files.map(file => ({ kind: "file", type: file.type, getAsFile: () => file })),
        types: ["Files"]
      }

      // Use fireEvent.drop with mock dataTransfer since DragEvent isn't available in test env
      const mockEvent = {
        dataTransfer,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }

      // Simulate drag enter first to show drop zone
      fireEvent.dragEnter(document.body, mockEvent)
      fireEvent.drop(document.body, mockEvent)
    }

    it("shows copy/move dialog when user drops a file", async () => {
      getAllItems.mockResolvedValue([])
      
      render(<NotesWorkspace />)
      
      await screen.findByText("Create your first note or bookmark to get started.")

      const testFile = createMockFile("test-document.pdf", "application/pdf")
      await simulateFileDrop([testFile])

      // Should show dialog with copy/move options
      await waitFor(() => {
        expect(screen.getByText(/copy to junkdrawer/i)).toBeInTheDocument()
        expect(screen.getByText(/move to junkdrawer/i)).toBeInTheDocument()
      })
    })

    it("creates file item when user chooses copy", async () => {
      const fileItem = noteFactory({
        id: 2,
        title: "test-document.pdf",
        content: null,
        item_type: "file",
        source_type: "file",
        source_url: "/Users/test/Documents/Junkdrawer/files/test-document.pdf",
      })

      getAllItems.mockResolvedValue([])
      createFileItem.mockResolvedValue(fileItem)

      render(<NotesWorkspace />)
      
      await screen.findByText("Create your first note or bookmark to get started.")

      const testFile = createMockFile("test-document.pdf", "application/pdf")
      await simulateFileDrop([testFile])

      // Wait for dialog and click copy
      await waitFor(() => {
        expect(screen.getByText(/copy to junkdrawer/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/copy to junkdrawer/i))

      await waitFor(() => {
        expect(createFileItem).toHaveBeenCalledWith({
          filePath: testFile.name, // Files don't have path property in browser
          operation: "copy"
        })
      })
    })

    it("creates file item when user chooses move", async () => {
      const fileItem = noteFactory({
        id: 3,
        title: "test-image.jpg",
        item_type: "file",
        source_type: "file",
      })

      getAllItems.mockResolvedValue([])
      createFileItem.mockResolvedValue(fileItem)

      render(<NotesWorkspace />)
      
      await screen.findByText("Create your first note or bookmark to get started.")

      const testFile = createMockFile("test-image.jpg", "image/jpeg")
      await simulateFileDrop([testFile])

      await waitFor(() => {
        expect(screen.getByText(/move to junkdrawer/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/move to junkdrawer/i))

      await waitFor(() => {
        expect(createFileItem).toHaveBeenCalledWith({
          filePath: testFile.name, // Files don't have path property in browser
          operation: "move"
        })
      })
    })

    it("handles multiple files drop", async () => {
      getAllItems.mockResolvedValue([])
      createFileItem
        .mockResolvedValueOnce(noteFactory({ id: 2, item_type: "file", title: "doc1.pdf" }))
        .mockResolvedValueOnce(noteFactory({ id: 3, item_type: "file", title: "image1.jpg" }))
        .mockResolvedValueOnce(noteFactory({ id: 4, item_type: "file", title: "text1.txt" }))

      render(<NotesWorkspace />)
      
      await screen.findByText("Create your first note or bookmark to get started.")

      const files = [
        createMockFile("doc1.pdf", "application/pdf"),
        createMockFile("image1.jpg", "image/jpeg"),
        createMockFile("text1.txt", "text/plain")
      ]

      await simulateFileDrop(files)

      await waitFor(() => {
        expect(screen.getByText(/copy to junkdrawer/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/copy to junkdrawer/i))

      // Should call createFileItem for each file
      await waitFor(() => {
        expect(createFileItem).toHaveBeenCalledTimes(3)
      })
    })

    it("displays files with appropriate icons in the list", async () => {
      const fileItems = [
        noteFactory({
          id: 1,
          title: "document.pdf",
          item_type: "file",
          source_type: "file",
          source_url: "/path/to/document.pdf"
        }),
        noteFactory({
          id: 2,
          title: "image.jpg", 
          item_type: "file",
          source_type: "file",
          source_url: "/path/to/image.jpg"
        }),
        noteFactory({
          id: 3,
          title: "unknown.xyz",
          item_type: "file", 
          source_type: "file",
          source_url: "/path/to/unknown.xyz"
        })
      ]

      getAllItems.mockResolvedValue(fileItems)

      render(<NotesWorkspace />)

      await waitFor(() => {
        expect(screen.getAllByText("document.pdf")).toHaveLength(2) // One in list, one in detail view
        expect(screen.getByText("image.jpg")).toBeInTheDocument()
        expect(screen.getByText("unknown.xyz")).toBeInTheDocument()
      })

      // Should show file icons (we'll implement specific icons later)
      // For now, just check that files are displayed differently from notes
      expect(screen.getAllByTitle(/file/i)).toHaveLength(3)
    })

    it("closes dialog when user clicks outside or presses escape", async () => {
      getAllItems.mockResolvedValue([])
      
      render(<NotesWorkspace />)
      
      await screen.findByText("Create your first note or bookmark to get started.")

      const testFile = createMockFile("test.txt")
      await simulateFileDrop([testFile])

      await waitFor(() => {
        expect(screen.getByText(/copy to junkdrawer/i)).toBeInTheDocument()
      })

      // Simulate clicking outside dialog
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" })

      await waitFor(() => {
        expect(screen.queryByText(/copy to junkdrawer/i)).not.toBeInTheDocument()
      })

      // File should not be created
      expect(createFileItem).not.toHaveBeenCalled()
    })
  })
})
