import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Button, Input } from '../components/ui'
import { Spinner } from '../components/ui/Spinner'
import { retryProcessNote, semanticSearch } from '../lib/edgeFunctions'
import type { SimilarNote } from '../lib/edgeFunctions'
import type { Note } from '../lib/database.types'
import { formatDuration, formatDateLong } from '../utils/formatting'
import { saveImageToDevice } from '../utils/saveImageToDevice'

const STUCK_PROCESSING_MS = 3 * 60 * 1000

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

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [similarNotes, setSimilarNotes] = useState<SimilarNote[]>([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const [showSimilar, setShowSimilar] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [downloadState, setDownloadState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [downloadMessage, setDownloadMessage] = useState('')
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const [, setClock] = useState(() => Date.now())

  const fetchNote = useCallback(async (showLoading = true) => {
    if (!id) return
    try {
      if (showLoading) setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError
      if (data) {
        setNote(data)
        setEditTitle(data.title)
        setEditContent(data.content || '')
      }
    } catch (err) {
      console.error('Failed to fetch note:', err)
      setError('Failed to load note')
    } finally {
      setLoading(false)
    }
  }, [id])

  // Reset state when navigating between notes
  useEffect(() => {
    setShowSimilar(false)
    setSimilarNotes([])
    setLoadingSimilar(false)
    setShowDeleteConfirm(false)
    setIsEditing(false)
    setError(null)
    setActionError(null)
    setRetryError(null)
    setDownloadState('idle')
    setDownloadMessage('')
    setImageLoadFailed(false)
  }, [id])

  useEffect(() => {
    fetchNote()

    // Real-time subscription
    const channel = supabase
      .channel(`note_${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notes',
        filter: `id=eq.${id}`,
      }, () => fetchNote(false))
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [id, fetchNote])

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    setImageLoadFailed(false)
    setDownloadState('idle')
    setDownloadMessage('')
  }, [note?.image_url])

  const handleSave = async () => {
    if (!id || !note) return
    setSaving(true)
    setActionError(null)
    try {
      const { error: updateError } = await supabase
        .from('notes')
        .update({ title: editTitle, content: editContent })
        .eq('id', id)

      if (updateError) throw updateError
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
      setActionError('Could not save your changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id || deleting) return
    setDeleting(true)
    setActionError(null)
    try {
      await supabase.from('notes').delete().eq('id', id)
      navigate('/notes')
    } catch (err) {
      console.error('Failed to delete:', err)
      setActionError('Could not delete this note. Please try again.')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleCancel = () => {
    if (note) {
      setEditTitle(note.title)
      setEditContent(note.content || '')
    }
    setIsEditing(false)
  }

  const handleFindSimilar = async () => {
    if (!note?.workspace_id || !id) return
    setLoadingSimilar(true)
    setShowSimilar(true)
    try {
      const result = await semanticSearch(note.workspace_id, { noteId: id, limit: 5 })
      setSimilarNotes(result.notes || [])
    } catch (err) {
      console.error('Failed to find similar notes:', err)
      setSimilarNotes([])
    } finally {
      setLoadingSimilar(false)
    }
  }

  const handleRetryProcessing = async () => {
    if (!id || !note?.audio_url || retrying) return
    setRetrying(true)
    setRetryError(null)
    setActionError(null)
    try {
      await retryProcessNote(id, note.audio_url)
      await fetchNote(false)
    } catch (err) {
      console.error('Retry processing failed:', err)
      setRetryError('Processing failed again. Your recording is safe; check your connection and retry.')
    } finally {
      setRetrying(false)
    }
  }

  const handleSaveImage = async () => {
    if (!note?.image_url || downloadState === 'saving') return
    setDownloadState('saving')
    setDownloadMessage('')
    try {
      const message = await saveImageToDevice(note.image_url, note.title)
      setDownloadState('saved')
      setDownloadMessage(message)
    } catch (err) {
      console.error('Failed to save image:', err)
      setDownloadState('error')
      setDownloadMessage('Could not save the image. Check your connection and try again.')
    }
  }

  if (loading) {
    return (
      <div className="screen-void min-h-screen flex items-center justify-center">
        <Spinner label="Loading note..." />
      </div>
    )
  }

  if (error || !note) {
    return (
      <div className="screen-shell screen-void void-readable">
        <Card className="max-w-md mx-auto text-center py-12">
          <p className="text-rose-400 mb-4">{error || 'Note not found'}</p>
          <Button onClick={() => navigate('/notes')}>Back to Notes</Button>
        </Card>
      </div>
    )
  }

  const isProcessing = ['pending', 'processing'].includes(note.embedding_status)
  const processingAge = Date.now() - new Date(note.updated_at).getTime()
  const isStuck = isProcessing && processingAge > STUCK_PROCESSING_MS
  const needsRecovery = note.embedding_status === 'failed' || isStuck
  const shouldShowVisualizationState =
    note.image_url === null && (note.transcript || isProcessing) && note.embedding_status !== 'failed'
  const visualizationIsActivelyGenerating = isProcessing || !note.transcript

  return (
    <div className="screen-shell screen-void void-readable">
      <div className="screen-stack">
        {/* Back button - 48px touch target */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted hover:text-white mb-4 transition-colors min-h-[48px] px-2 -ml-2 rounded-xl active:bg-white/5"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>

        {/* Main Card */}
        <Card className="mb-4 !p-4">
          {/* Header */}
          <div className="mb-3 flex min-w-0 flex-col gap-2">
            {isEditing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-lg font-bold"
                placeholder="Note title"
              />
            ) : (
              <h1 className="text-xl font-bold leading-tight text-white break-words">{note.title}</h1>
            )}
            {!isEditing && (
              <div className="note-row-meta">
                <span className={`status-pill ${statusClass(note.embedding_status)}`}>
                  {statusLabel(note.embedding_status)}
                </span>
                <span className="text-xs text-muted">{formatDateLong(note.created_at)}</span>
                {note.duration && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
                    {formatDuration(note.duration)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Metadata while editing */}
          {isEditing && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{formatDateLong(note.created_at)}</span>
              {note.duration && (
                <span className="rounded-full bg-accent/15 px-2.5 py-1 text-accent">
                  {formatDuration(note.duration)}
                </span>
              )}
            </div>
          )}

          {needsRecovery && (
            <div
              role="alert"
              className={`mb-6 rounded-2xl border px-4 py-4 backdrop-blur-xl ${
                note.embedding_status === 'failed'
                  ? 'border-rose-400/40 bg-rose-500/10 text-rose-100'
                  : 'border-amber-300/35 bg-amber-400/10 text-amber-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 4.5h.008v.008H12V16.5z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {note.embedding_status === 'failed' ? 'Note processing failed' : 'Processing was interrupted'}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed opacity-80">
                    {note.embedding_status === 'failed'
                      ? 'Synapse could not finish the transcript or search index.'
                      : 'This note has been processing for more than three minutes.'}
                    {' '}Your recording is safe—retry without recording again.
                  </p>
                  {!note.audio_url && (
                    <p className="mt-2 text-xs opacity-80">This note has no stored audio to retry.</p>
                  )}
                  {retryError && <p className="mt-2 text-sm text-rose-200">{retryError}</p>}
                  <Button
                    size="sm"
                    onClick={handleRetryProcessing}
                    loading={retrying}
                    disabled={!note.audio_url}
                    className="mt-3"
                  >
                    {retrying ? 'Retrying processing' : 'Retry processing'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {actionError && (
            <div role="alert" className="mb-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {actionError}
            </div>
          )}

          {/* Content/Transcript */}
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-48 glass-input resize-none"
              placeholder="Note content..."
            />
          ) : note.embedding_status === 'processing' && !note.transcript ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-sm">
                <Spinner size="sm" label="Transcribing audio..." />
                Transcribing audio...
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-white/5 rounded animate-pulse" />
                <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-white/5 rounded animate-pulse w-5/6" />
              </div>
            </div>
          ) : (
            <div className="text-body whitespace-pre-wrap text-[15px]">
              {note.transcript || note.content || <span className="text-muted italic">No content</span>}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-white/10">
            {isEditing ? (
              <>
                <Button onClick={handleSave} loading={saving}>Save</Button>
                <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm text-slate-300 mr-2">Delete this note?</span>
                    <Button
                      onClick={handleDelete}
                      loading={deleting}
                      size="sm"
                      className="bg-rose-500/80 hover:bg-rose-500 text-white border-0"
                    >
                      Yes, delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Audio Player */}
        {note.audio_url && (
          <Card className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Audio Recording</h2>
              {note.duration && <span className="text-xs text-muted">{formatDuration(note.duration)}</span>}
            </div>
            <audio controls className="w-full" src={note.audio_url}>
              Your browser does not support audio playback.
            </audio>
          </Card>
        )}

        {/* AI Visualization */}
        {note.image_url ? (
          <Card className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">AI Visualization</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveImage}
                loading={downloadState === 'saving'}
                className="shrink-0"
              >
                {downloadState !== 'saving' && (
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" />
                  </svg>
                )}
                {downloadState === 'saving' ? 'Saving' : 'Save to phone'}
              </Button>
            </div>
            {downloadMessage && (
              <p
                role="status"
                className={`mb-3 text-sm ${downloadState === 'error' ? 'text-rose-300' : 'text-accent'}`}
              >
                {downloadMessage}
              </p>
            )}
            <div className="visual-frame aspect-square flex items-center justify-center">
              <img
                src={note.image_url}
                alt="AI visualization"
                className={imageLoadFailed ? 'hidden' : ''}
                onError={() => setImageLoadFailed(true)}
              />
              {imageLoadFailed && (
                <div className="px-6 text-center">
                  <p className="text-sm text-rose-300">The visualization could not be loaded.</p>
                </div>
              )}
            </div>
          </Card>
        ) : note.image_url === '' ? (
          <Card className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">AI Visualization</h2>
              <span className="status-pill status-failed">Failed</span>
            </div>
            <div className="visual-frame aspect-square flex items-center justify-center px-6 text-center">
              <p className="text-sm text-muted">
                The note is ready, but its optional visualization could not be generated.
              </p>
            </div>
          </Card>
        ) : shouldShowVisualizationState && (
          <Card className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">AI Visualization</h2>
              <span className="status-pill status-waiting">
                {visualizationIsActivelyGenerating ? 'Generating' : 'Pending'}
              </span>
            </div>
            <div className="visual-frame aspect-square flex items-center justify-center">
              <div className="text-center px-6">
                {visualizationIsActivelyGenerating ? (
                  <>
                    <Spinner label="Generating visualization..." className="flex justify-center mb-3" />
                    <p className="text-muted text-sm">Generating visualization...</p>
                  </>
                ) : (
                  <p className="text-muted text-sm">Visualization pending</p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Find Similar Notes */}
        {note.embedding_status === 'completed' && (
          <Card className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted">Similar Notes</h2>
              {!showSimilar && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleFindSimilar}
                  loading={loadingSimilar}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Find Similar
                </Button>
              )}
            </div>

            {loadingSimilar && (
              <div className="flex items-center gap-2 text-muted py-4">
                <Spinner size="sm" label="Searching for similar notes..." />
                <span className="text-sm">Searching for similar notes...</span>
              </div>
            )}

            {showSimilar && !loadingSimilar && similarNotes.length === 0 && (
              <p className="text-muted text-sm py-4">No similar notes found. Record more notes to see connections!</p>
            )}

            {showSimilar && !loadingSimilar && similarNotes.length > 0 && (
              <div className="space-y-2">
                {similarNotes.map((similar) => (
                  <button
                    key={similar.id}
                    type="button"
                    onClick={() => navigate(`/notes/${similar.id}`)}
                    className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
                  >
                    <div className="flex items-start gap-3">
                      {similar.image_url && (
                        <img
                          src={similar.image_url}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate">{similar.title}</h4>
                        <p className="text-xs text-muted line-clamp-1 mt-0.5">
                          {similar.transcript}
                        </p>
                      </div>
                      <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full shrink-0">
                        {Math.round(similar.similarity * 100)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
