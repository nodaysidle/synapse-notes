import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Button, Input } from '../components/ui'
import { Spinner } from '../components/ui/Spinner'
import { semanticSearch } from '../lib/edgeFunctions'
import type { SimilarNote } from '../lib/edgeFunctions'
import type { Note } from '../lib/database.types'
import { formatDuration, formatDateLong } from '../utils/formatting'

function statusClass(status: string) {
  if (status === 'failed') return 'status-failed'
  if (status === 'completed') return 'status-ready'
  return 'status-waiting'
}

function statusLabel(status: string) {
  if (status === 'completed') return 'Ready'
  if (status === 'failed') return 'Failed'
  if (status === 'processing') return 'Processing'
  return 'Queued'
}

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [similarNotes, setSimilarNotes] = useState<SimilarNote[]>([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const [showSimilar, setShowSimilar] = useState(false)

  const fetchNote = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
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
      }, () => fetchNote())
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [id, fetchNote])

  const handleSave = async () => {
    if (!id || !note) return
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('notes')
        .update({ title: editTitle, content: editContent })
        .eq('id', id)

      if (updateError) throw updateError
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
      setError('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id || deleting) return
    setDeleting(true)
    try {
      await supabase.from('notes').delete().eq('id', id)
      navigate('/notes')
    } catch (err) {
      console.error('Failed to delete:', err)
      setError('Failed to delete note')
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner label="Loading note..." />
      </div>
    )
  }

  if (error || !note) {
    return (
      <div className="screen-shell">
        <Card className="max-w-md mx-auto text-center py-12">
          <p className="text-rose-400 mb-4">{error || 'Note not found'}</p>
          <Button onClick={() => navigate('/notes')}>Back to Notes</Button>
        </Card>
      </div>
    )
  }

  const isProcessing = ['pending', 'processing'].includes(note.embedding_status)
  const shouldShowVisualizationState =
    note.image_url === null && (note.transcript || isProcessing) && note.embedding_status !== 'failed'
  const visualizationIsActivelyGenerating = isProcessing || !note.transcript

  return (
    <div className="screen-shell">
      <div className="max-w-2xl mx-auto">
        {/* Back button - 48px touch target */}
        <button
          onClick={() => navigate('/notes')}
          className="flex items-center gap-2 text-muted hover:text-white mb-6 transition-colors min-h-[48px] px-2 -ml-2 rounded-xl active:bg-white/5"
          aria-label="Back to notes list"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>

        {/* Main Card */}
        <Card className="mb-6">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            {isEditing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 text-xl font-bold"
                placeholder="Note title"
              />
            ) : (
              <h1 className="text-2xl font-bold leading-tight text-white">{note.title}</h1>
            )}
            {!isEditing && (
              <span className={`status-pill ${statusClass(note.embedding_status)} shrink-0`}>
                {statusLabel(note.embedding_status)}
              </span>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-muted mb-6 flex-wrap">
            <span>{formatDateLong(note.created_at)}</span>
            {note.duration && (
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-accent">
                {formatDuration(note.duration)}
              </span>
            )}
          </div>

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
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">AI Visualization</h2>
              <span className="status-pill status-ready">Ready</span>
            </div>
            <div className="visual-frame aspect-square">
              <img
                src={note.image_url}
                alt="AI visualization"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
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
              <div className="text-center">
                {visualizationIsActivelyGenerating ? (
                  <>
                    <Spinner label="Generating visualization..." className="flex justify-center mb-3" />
                    <p className="text-muted text-sm">Generating visualization...</p>
                  </>
                ) : (
                  <>
                    <div className="empty-orbit" aria-hidden="true" />
                    <p className="text-muted text-sm">Visualization pending</p>
                  </>
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
