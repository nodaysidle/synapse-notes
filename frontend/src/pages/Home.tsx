import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui'
import type { Note } from '../lib/database.types'
import { formatDateShort } from '../utils/formatting'

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

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const [recentNotes, setRecentNotes] = useState<Note[]>([])

  useEffect(() => {
    if (!workspace) return

    const fetchRecent = async () => {
      try {
        const { data } = await supabase
          .from('notes')
          .select('*')
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (data) setRecentNotes(data)
      } catch (error) {
        console.error('Failed to fetch recent notes:', error)
      }
    }

    fetchRecent()

    const channel = supabase
      .channel('recent_notes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => fetchRecent()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspace])

  const handleMicClick = () => {
    navigate('/record')
  }

  return (
    <div className="screen-shell">
      <div className="screen-header">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="screen-title">Notes</h1>
          {recentNotes.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/notes')}
              className="text-sm text-muted transition-colors hover:text-white"
            >
              View all
            </button>
          )}
        </div>
      </div>

      {recentNotes.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
          <p className="mb-8 text-sm text-muted">No notes yet</p>
          <button type="button" onClick={handleMicClick} className="btn-mic" aria-label="Start recording">
            <MicIcon className="h-7 w-7 text-white" />
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-md space-y-3">
          {recentNotes.map((note) => (
            <Card
              key={note.id}
              variant="interactive"
              onClick={() => navigate(`/notes/${note.id}`)}
              className="flex items-center gap-4"
            >
              <div className="note-thumb">
                {note.image_url && <img src={note.image_url} alt="" loading="lazy" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="min-w-0 truncate text-sm font-semibold text-white">{note.title}</h3>
                  <span className={`status-pill ${statusClass(note.embedding_status)} shrink-0`}>
                    {statusLabel(note.embedding_status)}
                  </span>
                </div>
                <p className="truncate text-sm text-muted">
                  {note.transcript?.slice(0, 60) || note.content?.slice(0, 60) || 'No content'}
                </p>
              </div>
              <span className="whitespace-nowrap text-xs text-muted">{formatDateShort(note.created_at)}</span>
            </Card>
          ))}
        </div>
      )}

      {recentNotes.length > 0 && (
        <button
          type="button"
          onClick={handleMicClick}
          className="btn-mic btn-mic-fab"
          aria-label="Start recording"
        >
          <MicIcon className="h-6 w-6 text-white" />
        </button>
      )}
    </div>
  )
}
