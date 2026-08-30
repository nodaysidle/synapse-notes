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
    <div className="screen-shell home-void">
      {/* Header */}
      <div className="screen-header">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="screen-title">Notes</h1>
            <p className="screen-subtitle">Voice memory</p>
          </div>
          <div className="rounded-2xl border border-accent/15 bg-accent/10 px-3 py-2 text-right">
            <div className="text-lg font-bold text-accent">{notes.length}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Total</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto mb-6">
        <Input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner label="Loading notes..." />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-6">
          <Card className="bg-red-900/20 border-red-500/50">
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredNotes.length === 0 && (
        <div className="max-w-2xl mx-auto">
          <Card className="text-center py-12">
            <div className="empty-orbit" aria-hidden="true" />
            <h3 className="text-white font-medium mb-2">
              {searchQuery ? 'No matching notes' : 'No notes yet'}
            </h3>
            <p className="text-muted text-sm">
              {searchQuery
                ? 'Try a different search'
                : 'Tap the mic to capture your first thought'}
            </p>
          </Card>
        </div>
      )}

      {/* Notes Grid */}
      {!loading && filteredNotes.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-3">
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              variant="interactive"
              onClick={() => navigate(`/notes/${note.id}`)}
            >
              <div className="flex items-start gap-4">
                <div className="note-thumb">
                  {note.image_url && <img src={note.image_url} alt="" loading="lazy" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="min-w-0 truncate text-white font-semibold">{note.title}</h3>
                    <span className={`status-pill ${statusClass(note.embedding_status)} shrink-0`}>
                      {statusLabel(note.embedding_status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted line-clamp-2 mt-1">
                    {note.transcript || note.content || 'No content'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs text-muted">{formatDateShort(note.created_at)}</span>
                  {note.duration && (
                    <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                      {formatDuration(note.duration)}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
