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

  const hasNotes = recentNotes.length > 0

  return (
    <div className="screen-shell home-void">
      <div className="screen-header home-header">
        <h1 className="screen-title home-title">Synapse Notes</h1>
        {hasNotes && (
          <button
            type="button"
            onClick={() => navigate('/notes')}
            className="home-view-all text-sm text-muted transition-colors hover:text-white"
          >
            View all
          </button>
        )}
      </div>

      <div className={`home-stage${hasNotes ? ' home-stage--with-notes' : ''}`}>
        <div className="home-mic-slot">
          <button type="button" onClick={handleMicClick} className="btn-mic" aria-label="Start recording">
            <MicIcon className="h-8 w-8 text-white" />
          </button>
        </div>

        {hasNotes && (
          <div className="home-notes mx-auto w-full max-w-md space-y-3">
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
      </div>
    </div>
  )
}
