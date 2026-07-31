import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { processNote } from '../lib/edgeFunctions'
import { Button } from '../components/ui'
import { formatDurationPadded } from '../utils/formatting'

export default function Record() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const { user } = useAuth()

  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [saving, setSaving] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const recordingStartRef = useRef<number>(0)   // for drift-free timer
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isRecordingRef = useRef(false)

  // Start recording
  const startRecording = async () => {
    setRecordingError(null)
    setSaveError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up audio analyser for waveform
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      isRecordingRef.current = true

      // Drift-free timer: poll Date.now() delta every 500 ms so the displayed
      // duration stays accurate even when Android throttles setInterval.
      recordingStartRef.current = Date.now()
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - recordingStartRef.current) / 1000))
      }, 500)

      // Start waveform animation
      drawWaveform()
    } catch (err) {
      const error = err as Error
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setRecordingError('Microphone access was denied. Please enable it in your device settings.')
      } else if (error.name === 'NotFoundError') {
        setRecordingError('No microphone found. Please connect a microphone and try again.')
      } else {
        setRecordingError('Could not start recording. Please try again.')
      }
      console.error('Failed to start recording:', err)
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      isRecordingRef.current = false

      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }

  // Draw waveform with DPR-aware canvas
  const drawWaveform = () => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set up DPR-aware canvas
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const logicalWidth = rect.width
    const logicalHeight = rect.height

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      if (!isRecordingRef.current) return

      animationRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      ctx.fillStyle = 'rgba(6, 6, 9, 0.58)'
      ctx.fillRect(0, 0, logicalWidth, logicalHeight)

      const barWidth = (logicalWidth / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * logicalHeight * 0.8

        ctx.fillStyle = '#C8FF00'
        ctx.fillRect(x, logicalHeight - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }
    }

    draw()
  }

  // Cancel recording
  const handleCancel = () => {
    stopRecording()
    navigate('/')
  }

  // Save recording
  const handleSave = async () => {
    if (!audioBlob || !workspace || !user) return

    setSaving(true)
    setSaveError(null)
    try {
      // Upload audio to Supabase Storage
      const filename = `${workspace.id}/${user.id}/${Date.now()}.webm`
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filename, audioBlob)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(filename)

      // Create note
      const { data: note, error: noteError } = await supabase
        .from('notes')
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          title: `Note - ${new Date().toLocaleDateString()}`,
          audio_url: publicUrl,
          duration: duration,
          embedding_status: 'pending',
        })
        .select()
        .single()

      if (noteError) throw noteError

      // Navigate immediately for better UX
      navigate(`/notes/${note.id}`)

      // Process note in background (transcription, embedding, image)
      const blobToProcess = audioBlob
      // Pass the URL already uploaded above so processNote skips the re-upload
      processNote(note.id, blobToProcess, publicUrl)
        .then(() => console.log('Processing complete'))
        .catch((err) => {
          console.error('Background processing failed:', err)
          // NoteDetail's real-time subscription will show 'Failed' status badge
        })
    } catch (err) {
      console.error('Failed to save:', err)
      setSaveError('Your recording is still here, but the note could not be saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // Start recording on mount
  useEffect(() => {
    startRecording()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      isRecordingRef.current = false
    }
  }, [])

  return (
    <div className="fixed inset-0 synapse-record-surface backdrop-blur-xl flex flex-col items-center justify-center px-6">
      {/* Error message */}
      {recordingError && (
        <div className="absolute top-6 left-6 right-6 bg-rose-500/20 border border-rose-500/40 rounded-2xl px-4 py-3 text-rose-300 text-sm text-center">
          {recordingError}
          <button
            onClick={() => navigate('/')}
            className="block w-full mt-3 text-rose-400 underline text-xs"
          >
            Go back
          </button>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="absolute top-6 left-6 right-6 mx-auto max-w-sm rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-200 backdrop-blur-xl"
        >
          <p className="font-semibold text-rose-100">Could not save note</p>
          <p className="mt-1 leading-relaxed">{saveError}</p>
        </div>
      )}

      <div className="record-stage">
        <div className={`status-pill mx-auto mb-6 w-fit ${isRecording ? 'status-failed' : 'status-ready'}`}>
          {isRecording ? 'Recording' : 'Captured'}
        </div>

        {/* Duration */}
        <div className="text-6xl font-mono font-bold tracking-tight text-white mb-6">
          {formatDurationPadded(duration)}
        </div>

        {/* Waveform - DPR-aware canvas */}
        <canvas
          ref={canvasRef}
          className="waveform-canvas w-full max-w-xs h-[132px] rounded-2xl mb-7"
          style={{ width: '100%', maxWidth: '320px', height: '132px' }}
        />

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="w-14 h-14 rounded-full"
            aria-label="Cancel recording"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>

          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="record-stop"
              aria-label="Stop recording"
            >
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <Button onClick={handleSave} loading={saving} className="px-8">
              {saveError ? 'Try save again' : 'Save note'}
            </Button>
          )}

          {!isRecording && audioBlob ? (
            <Button
              variant="ghost"
              onClick={startRecording}
              className="w-14 h-14 rounded-full"
              aria-label="Record again"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          ) : (
            <div className="w-14 h-14" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  )
}
