import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'
import type { Note } from '../lib/database.types'
import { formatDuration, formatDateShort } from '../utils/formatting'

function statusClass(status: string) {
  if (status === 'failed') return 'status-failed'
  if (status === 'completed') return 'status-ready'
  return 'status-waiting'
}

function statusLabel(status: string) {
  if (status === 'completed') return 'Ready'
  if (status === 'failed') return 'Failed'
  if (status === 'processing') return 'Live'
  return 'Queued'
}

export default function NotesList() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchNotes = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      if (data) setNotes(data)
    } catch (err) {
      console.error('Failed to fetch notes:', err)
      setError('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [workspace])

  useEffect(() => {
    if (!workspace) return

    fetchNotes()

    // Real-time subscription
    const channel = supabase
      .channel('notes_list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => fetchNotes()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspace, fetchNotes])

  // Filter notes by search
  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes
    const query = searchQuery.toLowerCase()
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.transcript?.toLowerCase().includes(query) ||
        n.content?.toLowerCase().includes(query)
    )
  }, [notes, searchQuery])


  return (
    <div className="screen-shell screen-void void-readable">
      <div className="screen-header">
        <h1 className="screen-title">Notes</h1>
      </div>

      <div className="screen-stack mb-4">
        <Input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner label="Loading notes..." />
        </div>
      )}

      {error && (
        <div className="screen-stack mb-4">
          <Card className="bg-red-900/20 border-red-500/50 !p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        </div>
      )}

      {!loading && filteredNotes.length === 0 && (
        <div className="screen-stack">
          <Card className="text-center py-10 !p-4">
            <h3 className="text-white font-medium mb-2">
              {searchQuery ? 'No matching notes' : 'No notes yet'}
            </h3>
            <p className="text-muted text-sm">
              {searchQuery
                ? 'Try a different search'
                : 'Open Capture to record your first note.'}
            </p>
          </Card>
        </div>
      )}

      {!loading && filteredNotes.length > 0 && (
        <div className="screen-stack space-y-2">
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              variant="interactive"
              onClick={() => navigate(`/notes/${note.id}`)}
              className="!p-3"
            >
              <div className="note-row">
                <div className="note-thumb note-thumb--list">
                  {note.image_url && <img src={note.image_url} alt="" loading="lazy" />}
                </div>
                <div className="note-row-body">
                  <h3 className="truncate text-sm font-semibold text-white">{note.title}</h3>
                  <div className="note-row-meta">
                    <span className={`status-pill ${statusClass(note.embedding_status)}`}>
                      {statusLabel(note.embedding_status)}
                    </span>
                    <span className="text-xs text-muted">{formatDateShort(note.created_at)}</span>
                    {note.duration ? (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
                        {formatDuration(note.duration)}
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted">
                    {note.transcript || note.content || 'No content'}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
