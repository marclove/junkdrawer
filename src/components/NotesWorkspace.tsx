import { useCallback, useEffect, useMemo, useState } from "react"
import { createItem, deleteItem, getAllItems, updateItem } from "../lib/database"
import { useTypesense } from "../lib/useTypesense"
import type { Item } from "../types/database"
import { cn } from "../lib/utils"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"

const AUTOSAVE_DELAY_MS = 500

interface DraftState {
  id: number
  title: string
  content: string
  tags: string
}

function toDraft(item: Item): DraftState {
  return {
    id: item.id,
    title: item.title,
    content: item.content ?? "",
    tags: item.tags ?? "",
  }
}

export default function NotesWorkspace() {
  const [notes, setNotes] = useState<Item[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const { isRunning: isTypesenseRunning, serverStatus } = useTypesense()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const fetched = await getAllItems()
        if (cancelled) return
        const notesOnly = fetched.filter((item) => item.item_type === "note")
        setNotes(notesOnly)
        if (notesOnly.length > 0) {
          const first = notesOnly[0]
          setSelectedId((prev) => prev ?? first.id)
        }
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(`Failed to load notes: ${err}`)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedNote = useMemo(() => notes.find((note) => note.id === selectedId) ?? null, [notes, selectedId])

  useEffect(() => {
    if (selectedNote) {
      setDraft(toDraft(selectedNote))
      setSaveState("saved")
    } else {
      setDraft(null)
      setSaveState("idle")
    }
  }, [selectedNote?.id])

  const handleCreateNote = useCallback(async () => {
    try {
      const created = await createItem({
        title: "Untitled note",
        content: "",
        item_type: "note",
      })
      setNotes((prev) => [created, ...prev])
      setSelectedId(created.id)
      setDraft(toDraft(created))
      setError(null)
      setSaveState("saved")
    } catch (err) {
      setError(`Failed to create note: ${err}`)
    }
  }, [])

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteItem(id)
        setNotes((prev) => {
          const next = prev.filter((note) => note.id !== id)
          if (selectedId === id) {
            setSelectedId(next[0]?.id ?? null)
          }
          return next
        })
        setError(null)
      } catch (err) {
        setError(`Failed to delete note: ${err}`)
      }
    },
    [selectedId],
  )

  useEffect(() => {
    if (!draft || !selectedNote) return

    const trimmedTitle = draft.title.trim() || "Untitled note"
    const normalizedContent = draft.content
    const normalizedTags = draft.tags.trim()

    if (
      selectedNote.title === trimmedTitle &&
      (selectedNote.content ?? "") === normalizedContent &&
      (selectedNote.tags ?? "") === normalizedTags
    ) {
      setSaveState((prev) => (prev === "saving" ? "saved" : prev))
      return
    }

    setSaveState("saving")
    setError(null)

    const timeout = window.setTimeout(() => {
      updateItem({
        id: draft.id,
        title: trimmedTitle,
        content: normalizedContent,
        item_type: "note",
        tags: normalizedTags || null,
      })
        .then((updated) => {
          setNotes((prev) => prev.map((note) => (note.id === updated.id ? updated : note)))
          setSaveState("saved")
        })
        .catch((err) => {
          setError(`Failed to save note: ${err}`)
          setSaveState("error")
        })
    }, AUTOSAVE_DELAY_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [draft, selectedNote])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading notes...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Junkdrawer</h1>
            <p className="text-sm text-muted-foreground">Plain text notes, synced to search.</p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 rounded-full border border-border/80 bg-muted px-3 py-1 text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <span className={isTypesenseRunning ? "h-2 w-2 rounded-full bg-emerald-500" : "h-2 w-2 rounded-full bg-amber-500"} />
              <span>{isTypesenseRunning ? "Search online" : "Search offline"}</span>
            </div>
            <Button onClick={handleCreateNote} size="sm">
              New note
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-6 py-8">
        <aside className="flex w-72 flex-col gap-3">
          <div className="rounded-lg border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium text-muted-foreground">Notes</h2>
              <span className="text-xs text-muted-foreground">{notes.length}</span>
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
              {notes.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">Create your first note to get started.</div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {notes.map((note) => {
                    const isActive = selectedId === note.id
                    return (
                      <li key={note.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(note.id)}
                          className={cn(
                            "group flex w-full items-start gap-2 px-4 py-3 text-left text-sm transition-colors",
                            isActive ? "bg-primary/10 text-foreground" : "hover:bg-muted",
                          )}
                        >
                          <div className="flex-1">
                            <p className="font-medium line-clamp-1">{note.title || "Untitled note"}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {(note.content ?? "").trim() || "No content yet."}
                            </p>
                          </div>
                          {isActive && (
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                          )}
                        </button>
                        <div className="border-t border-border/80 px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            className="text-xs font-medium text-destructive hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>

        <section className="flex flex-1 flex-col">
          {draft ? (
            <div className="flex h-full flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Input
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                  placeholder="Note title"
                  className="h-14 text-2xl font-semibold"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Last updated {new Date(selectedNote?.updated_at ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span>
                    {saveState === "saving" && "Saving..."}
                    {saveState === "saved" && "Saved"}
                    {saveState === "error" && "Save failed"}
                  </span>
                </div>
              </div>
              <Textarea
                value={draft.content}
                onChange={(event) => setDraft((prev) => (prev ? { ...prev, content: event.target.value } : prev))}
                placeholder="Start typing your note..."
                className="min-h-[60vh] flex-1 resize-none text-base leading-relaxed"
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Select a note to start editing.
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-border bg-card/50 py-3 text-center text-xs text-muted-foreground">
        {serverStatus?.message ?? "Typesense status unknown"}
      </footer>

      {error && (
        <div className="fixed bottom-6 right-6 max-w-sm rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
