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

    // Subscribe to new notes
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

  const visualCount = recentNotes.filter((note) => note.image_url).length
  const activeCount = recentNotes.filter((note) => ['pending', 'processing'].includes(note.embedding_status)).length

  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      {/* Header */}
      <div className="w-full max-w-md text-center mb-8">
        <div className="synapse-emblem mb-6" aria-hidden="true" />
        <h1 className="screen-title">Synapse</h1>
        <p className="screen-subtitle mx-auto max-w-xs">Thoughts in motion, gathered in one place.</p>

        <div className="stat-strip mt-6">
          <div className="stat-cell">
            <div className="text-lg font-bold text-white">{recentNotes.length}</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Recent</div>
          </div>
          <div className="stat-cell">
            <div className="text-lg font-bold text-accent-secondary">{visualCount}</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Visuals</div>
          </div>
          <div className="stat-cell">
            <div className="text-lg font-bold text-accent">{activeCount}</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Live</div>
          </div>
        </div>
      </div>

      {/* Big mic button */}
      <button
        onClick={handleMicClick}
        className="btn-mic"
        aria-label="Start recording"
      >
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>

      <p className="text-muted mt-5 mb-9 text-sm">Ready when you are</p>

      {/* Recent notes */}
      {recentNotes.length > 0 && (
        <div className="w-full max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent notes</h2>
            <button
              type="button"
              onClick={() => navigate('/notes')}
              className="text-xs font-semibold text-accent transition-colors hover:text-accent-light"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
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
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="min-w-0 truncate text-sm font-semibold text-white">{note.title}</h3>
                    <span className={`status-pill ${statusClass(note.embedding_status)} shrink-0`}>
                      {statusLabel(note.embedding_status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted truncate">
                    {note.transcript?.slice(0, 60) || note.content?.slice(0, 60) || 'No content'}
                  </p>
                </div>
                <span className="text-xs text-muted whitespace-nowrap">
                  {formatDateShort(note.created_at)}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
