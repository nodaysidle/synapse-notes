import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import type { Note } from '../lib/database.types'
import { formatDateShort } from '../utils/formatting'
import { saveImageToDevice } from '../utils/saveImageToDevice'

export default function Gallery() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingImageId, setSavingImageId] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  const fetchGalleryNotes = useCallback(async () => {
    if (!workspace) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', workspace.id)
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setNotes(data || [])
    } catch (err) {
      console.error('Failed to fetch gallery:', err)
      setError('Failed to load gallery')
    } finally {
      setLoading(false)
    }
  }, [workspace])

  useEffect(() => {
    if (!workspace) return

    fetchGalleryNotes()

    const channel = supabase
      .channel('gallery_notes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => fetchGalleryNotes()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspace, fetchGalleryNotes])

  const handleSaveImage = async (note: Note) => {
    if (!note.image_url || savingImageId) return
    setSavingImageId(note.id)
    setSaveMessage(null)
    setSaveFailed(false)
    try {
      const message = await saveImageToDevice(note.image_url, note.title)
      setSaveMessage(message)
    } catch (err) {
      console.error('Failed to save gallery image:', err)
      setSaveFailed(true)
      setSaveMessage('Could not save image. Please try again.')
    } finally {
      setSavingImageId(null)
    }
  }

  const [featured, ...rest] = notes

  return (
    <div className="screen-shell px-5">
      <div className="screen-header max-w-3xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="screen-title">Gallery</h1>
            <p className="screen-subtitle">Visual memory</p>
          </div>
          <div className="rounded-2xl border border-accent-secondary/20 bg-accent-secondary/10 px-3 py-2 text-right">
            <div className="text-lg font-bold text-accent-secondary">{notes.length}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Images</div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Spinner label="Loading gallery..." />
        </div>
      )}

      {error && (
        <div className="max-w-3xl mx-auto mb-6">
          <Card className="bg-red-900/20 border-red-500/50">
            <p className="text-red-400 text-sm">{error}</p>
          </Card>
        </div>
      )}

      {saveMessage && (
        <div
          role={saveFailed ? 'alert' : 'status'}
          className={`mx-auto mb-4 max-w-3xl rounded-xl border px-4 py-3 text-sm ${
            saveFailed
              ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
              : 'border-accent/20 bg-accent/10 text-accent'
          }`}
        >
          {saveMessage}
        </div>
      )}

      {!loading && notes.length === 0 && (
        <div className="max-w-3xl mx-auto">
          <Card className="text-center py-12">
            <div className="empty-orbit" aria-hidden="true" />
            <h3 className="text-white font-medium mb-2">No images yet</h3>
            <p className="text-muted text-sm">Record a note and wait for its visualization to appear here</p>
          </Card>
        </div>
      )}

      {!loading && notes.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-3">
          {featured && (
            <div key={featured.id} className="relative">
              <button
                type="button"
                onClick={() => navigate(`/notes/${featured.id}`)}
                className="gallery-tile group h-72 w-full"
              >
                <img
                  src={featured.image_url || ''}
                  alt={featured.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-secondary">Latest</p>
                  <h2 className="mt-1 text-xl font-bold text-white line-clamp-2">{featured.title}</h2>
                  <p className="text-xs text-slate-300 mt-2">{formatDateShort(featured.created_at)}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleSaveImage(featured)}
                disabled={savingImageId !== null}
                className="btn-icon absolute right-3 top-3 z-20 h-11 w-11 text-white disabled:opacity-50"
                aria-label={`Save ${featured.title} to phone`}
              >
                {savingImageId === featured.id ? (
                  <span className="block h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" />
                  </svg>
                )}
              </button>
            </div>
          )}

          {rest.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rest.map((note) => (
                <div key={note.id} className="relative">
                  <button
                    type="button"
                    onClick={() => navigate(`/notes/${note.id}`)}
                    className="gallery-tile group aspect-square w-full"
                  >
                    <img
                      src={note.image_url || ''}
                      alt={note.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 z-10 p-3">
                      <h2 className="text-sm font-semibold text-white line-clamp-2">{note.title}</h2>
                      <p className="text-xs text-slate-300 mt-1">{formatDateShort(note.created_at)}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveImage(note)}
                    disabled={savingImageId !== null}
                    className="btn-icon absolute right-2 top-2 z-20 h-11 w-11 text-white disabled:opacity-50"
                    aria-label={`Save ${note.title} to phone`}
                  >
                    {savingImageId === note.id ? (
                      <span className="block h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
