import { supabase } from './supabase'

interface TranscriptionResult {
  transcript: string
}

interface EmbeddingResult {
  embedding: number[]
}

interface ImageResult {
  imageBase64: string
  mimeType?: string
  source?: string
  model?: string
  errors?: string[]
}

export interface SimilarNote {
  id: string
  title: string
  transcript: string
  image_url: string | null
  created_at: string
  similarity: number
}

interface SemanticSearchResult {
  notes: SimilarNote[]
  message?: string
}

// Reject blobs larger than this — Supabase edge functions have a ~6 MB request
// limit on the free tier. Blobs this large are also slow to base64-encode on
// the main thread, degrading Android UX.
const MAX_AUDIO_BLOB_MB = 10
const MAX_AUDIO_BLOB_BYTES = MAX_AUDIO_BLOB_MB * 1024 * 1024

/**
 * Derive the file extension from a MIME type string.
 */
function audioExtension(mimeType: string): string {
  const t = mimeType.toLowerCase()
  if (t.includes('ogg')) return 'ogg'
  if (t.includes('mp4')) return 'mp4'
  if (t.includes('m4a')) return 'm4a'
  if (t.includes('wav')) return 'wav'
  if (t.includes('flac')) return 'flac'
  if (t.includes('mp3') || t.includes('mpeg')) return 'mp3'
  return 'webm'
}

function imageExtension(mimeType: string | undefined): string {
  const t = (mimeType || '').toLowerCase()
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
  if (t.includes('webp')) return 'webp'
  return 'png'
}

/**
 * Call Supabase Edge Function for audio transcription.
 * Prefers audioUrl (storage URL) over audioBase64 to avoid payload size limits.
 */
export async function transcribeAudio(
  audioBase64: string | null,
  mimeType: string = 'audio/webm',
  audioUrl?: string
): Promise<TranscriptionResult> {
  const body = audioUrl
    ? { audioUrl, mimeType }
    : { audioBase64, mimeType }

  const { data, error } = await supabase.functions.invoke('transcribe', { body })

  if (error) throw error
  return data as TranscriptionResult
}

/**
 * Call Supabase Edge Function for text embedding generation
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const { data, error } = await supabase.functions.invoke('generate-embedding', {
    body: { text },
  })

  if (error) throw error
  return data as EmbeddingResult
}

/**
 * Call Supabase Edge Function for image generation
 */
export async function generateImage(prompt: string): Promise<ImageResult> {
  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: { prompt },
  })

  if (error) throw error
  return data as ImageResult
}

/**
 * Process a note: upload audio to storage, transcribe, generate embedding + image.
 * Updates the note row in the database as each step completes.
 */
export async function processNote(
  noteId: string,
  audioBlob: Blob,
  existingAudioUrl?: string  // if caller already uploaded, skip Step 0
): Promise<void> {
  // ── Guard: reject blobs that are too large ──────────────────────────────
  if (audioBlob.size > MAX_AUDIO_BLOB_BYTES) {
    const sizeMB = (audioBlob.size / 1024 / 1024).toFixed(1)
    throw new Error(
      `Recording is too large (${sizeMB} MB). Please keep voice notes under ${MAX_AUDIO_BLOB_MB} MB ` +
      `(roughly ${Math.round(MAX_AUDIO_BLOB_MB * 60 / 0.5)} seconds at typical mobile bitrates).`
    )
  }

  try {
    console.log('Processing note:', noteId, 'Blob size:', audioBlob.size, 'Type:', audioBlob.type)

    // ── Step 0: Upload audio to Supabase Storage ────────────────────────────
    // If the caller already uploaded (e.g. Record.tsx), reuse that URL and skip
    // the redundant upload. Otherwise upload here so the transcribe function
    // can fetch by URL instead of receiving a large base64 payload.
    let audioUrl: string | undefined = existingAudioUrl

    if (!audioUrl) {
      const ext = audioExtension(audioBlob.type)
      const audioPath = `${noteId}/audio.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(audioPath, audioBlob, { contentType: audioBlob.type || 'audio/webm' })

      if (uploadError) {
        console.error('Audio upload to storage failed:', uploadError)
        // Non-fatal: fall back to base64 transcription below
      } else {
        const { data: { publicUrl } } = supabase.storage.from('audio').getPublicUrl(audioPath)
        audioUrl = publicUrl
        await supabase.from('notes').update({ audio_url: audioUrl }).eq('id', noteId)
      }
    }

    // ── Update status to processing ─────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('notes')
      .update({ embedding_status: 'processing' })
      .eq('id', noteId)

    if (updateError) {
      console.error('Failed to update status:', updateError)
    }

    // ── Step 1: Transcribe audio ────────────────────────────────────────────
    // Prefer the storage URL (avoids large base64 payload); fall back to
    // base64 if the upload failed.
    console.log('Calling transcribe function...')
    let audioBase64: string | null = null
    if (!audioUrl) {
      audioBase64 = await blobToBase64(audioBlob)
    }

    const { transcript } = await transcribeAudio(audioBase64, audioBlob.type || 'audio/webm', audioUrl)
    console.log('Transcript received:', transcript?.substring(0, 100))

    await supabase
      .from('notes')
      .update({ transcript, title: generateTitle(transcript) })
      .eq('id', noteId)

    // Generate the required embedding and optional visualization in parallel,
    // but do not report success until both tasks have settled. This makes a
    // Retry button truthful: its loading state maps to the whole pipeline.
    const embeddingTask = generateEmbedding(transcript)
    const imageTask = generateImage(transcript.substring(0, 500))
      .then(async ({ imageBase64: imgB64, mimeType }) => {
        const contentType = mimeType || 'image/png'
        const filename = `images/${noteId}-${Date.now()}.${imageExtension(contentType)}`
        const imageBuffer = base64ToUint8Array(imgB64)

        const { error: imgUploadError } = await supabase.storage
          .from('images')
          .upload(filename, imageBuffer, { contentType })

        if (imgUploadError) {
          console.error('Image upload failed:', imgUploadError)
          await supabase.from('notes').update({ image_url: '' }).eq('id', noteId)
          return
        }

        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filename)
        await supabase.from('notes').update({ image_url: publicUrl }).eq('id', noteId)
      })
      .catch(async (err) => {
        console.error('Image generation failed:', err)
        await supabase.from('notes').update({ image_url: '' }).eq('id', noteId)
      })

    const [embeddingResult] = await Promise.allSettled([embeddingTask, imageTask])
    if (embeddingResult.status === 'rejected') throw embeddingResult.reason

    const { embedding } = embeddingResult.value
    const { error: completionError } = await supabase
      .from('notes')
      .update({ embedding, embedding_status: 'completed' })
      .eq('id', noteId)

    if (completionError) throw completionError

  } catch (error) {
    console.error('Note processing failed:', error)
    await supabase.from('notes').update({ embedding_status: 'failed' }).eq('id', noteId)
    throw error
  }
}

/**
 * Re-run processing for an existing note without asking the user to record
 * again. The edge function can fetch the public audio URL directly, so a
 * browser CORS failure while reading the Blob locally is non-fatal.
 */
export async function retryProcessNote(noteId: string, audioUrl: string): Promise<void> {
  let audioBlob: Blob

  try {
    const response = await fetch(audioUrl)
    if (!response.ok) throw new Error(`Audio download failed (${response.status})`)
    audioBlob = await response.blob()
  } catch (error) {
    console.warn('Could not read stored audio locally; retrying by URL:', error)
    audioBlob = new Blob([], { type: audioMimeType(audioUrl) })
  }

  await processNote(noteId, audioBlob, audioUrl)
}

/**
 * Convert Blob to base64 string (fallback when storage upload fails)
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Strip the data URL prefix (e.g. "data:audio/webm;base64,")
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Generate a short title from the start of a transcript
 */
function generateTitle(transcript: string): string {
  const firstSentence = transcript.split(/[.!?]/)[0].trim()
  if (firstSentence.length > 0 && firstSentence.length <= 50) return firstSentence
  return transcript.substring(0, 47).trim() + '...'
}

function audioMimeType(url: string): string {
  const pathname = url.split('?')[0].toLowerCase()
  if (pathname.endsWith('.ogg')) return 'audio/ogg'
  if (pathname.endsWith('.mp4') || pathname.endsWith('.m4a')) return 'audio/mp4'
  if (pathname.endsWith('.wav')) return 'audio/wav'
  if (pathname.endsWith('.flac')) return 'audio/flac'
  if (pathname.endsWith('.mp3')) return 'audio/mpeg'
  return 'audio/webm'
}

/**
 * Search for semantically similar notes
 */
export async function semanticSearch(
  workspaceId: string,
  options: { noteId?: string; query?: string; limit?: number } = {}
): Promise<SemanticSearchResult> {
  const { noteId, query, limit = 5 } = options

  const { data, error } = await supabase.functions.invoke('semantic-search', {
    body: { workspaceId, noteId, query, limit },
  })

  if (error) throw error
  return data as SemanticSearchResult
}
