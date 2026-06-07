import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
const TRANSCRIPTION_PROVIDER = (Deno.env.get('TRANSCRIPTION_PROVIDER') || 'gemini').toLowerCase()
const GEMINI_TRANSCRIPTION_MODEL = Deno.env.get('GEMINI_TRANSCRIPTION_MODEL') || 'gemini-3.5-flash'
const OPENROUTER_TRANSCRIPTION_MODEL = Deno.env.get('OPENROUTER_TRANSCRIPTION_MODEL') || 'openai/whisper-1'
const GROQ_TRANSCRIPTION_MODEL = Deno.env.get('GROQ_TRANSCRIPTION_MODEL') || 'whisper-large-v3-turbo'

interface TranscriptionRequest {
  audioBase64?: string
  audioUrl?: string
  mimeType?: string
  language?: string
}

function getAudioFormat(mimeType: string): string {
  const normalized = mimeType.toLowerCase()

  if (normalized.includes('webm')) return 'webm'
  if (normalized.includes('ogg')) return 'ogg'
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3'
  if (normalized.includes('mp4')) return 'mp4'
  if (normalized.includes('m4a')) return 'm4a'
  if (normalized.includes('wav')) return 'wav'
  if (normalized.includes('flac')) return 'flac'
  if (normalized.includes('aac')) return 'aac'

  return 'webm'
}

function base64ToBlob(audioBase64: string, mimeType: string): Blob {
  const binary = atob(audioBase64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Blob([bytes], { type: mimeType })
}

async function transcribeWithOpenRouter(
  audioBase64: string,
  mimeType: string,
  language?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://synapse-notes.local',
      'X-Title': 'Synapse Notes',
    },
    body: JSON.stringify({
      input_audio: {
        data: audioBase64,
        format: getAudioFormat(mimeType),
      },
      model: OPENROUTER_TRANSCRIPTION_MODEL,
      ...(language ? { language } : {}),
      temperature: 0,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('OpenRouter transcription error:', response.status, error)
    throw new Error(`OpenRouter transcription failed with status ${response.status}`)
  }

  const data = await response.json()
  return data.text || data.transcript || ''
}

async function transcribeWithGroq(
  audioBase64: string,
  mimeType: string,
  language?: string
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured')
  }

  const audioBlob = base64ToBlob(audioBase64, mimeType)
  const formData = new FormData()
  formData.append('file', audioBlob, `recording.${getAudioFormat(mimeType)}`)
  formData.append('model', GROQ_TRANSCRIPTION_MODEL)
  formData.append('temperature', '0')
  if (language) formData.append('language', language)

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Groq transcription error:', response.status, error)
    throw new Error(`Groq transcription failed with status ${response.status}`)
  }

  const data = await response.json()
  return data.text || ''
}

async function transcribeWithGemini(audioBase64: string, mimeType: string): Promise<string> {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY not configured')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TRANSCRIPTION_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64
              }
            },
            {
              text: 'Transcribe every word of this audio recording verbatim. Include all sentences, pauses (as "..."), filler words, and spoken punctuation. Do NOT summarize, paraphrase, or shorten — output the complete word-for-word transcript. Return only the raw transcript text with no labels or formatting.'
            }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.0
        }
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Gemini API error:', error)
    throw new Error(`Gemini transcription failed with status ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function transcriptionProviderOrder(): string[] {
  const supported = ['gemini', 'groq', 'openrouter']
  const preferred = supported.includes(TRANSCRIPTION_PROVIDER) ? TRANSCRIPTION_PROVIDER : 'gemini'
  return [preferred, ...supported.filter((provider) => provider !== preferred)]
}

async function transcribeWithProvider(
  provider: string,
  audioBase64: string,
  mimeType: string,
  language?: string,
): Promise<string> {
  if (provider === 'groq') {
    return transcribeWithGroq(audioBase64, mimeType, language)
  }

  if (provider === 'openrouter') {
    return transcribeWithOpenRouter(audioBase64, mimeType, language)
  }

  return transcribeWithGemini(audioBase64, mimeType)
}

serve(async (req) => {
  const corsH = getCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsH })
  }

  try {
    const { audioBase64: rawBase64, audioUrl, mimeType = 'audio/webm', language } = await req.json() as TranscriptionRequest

    // If a storage URL was provided, download and convert to base64
    let audioBase64 = rawBase64
    if (!audioBase64 && audioUrl) {
      const audioRes = await fetch(audioUrl)
      if (!audioRes.ok) {
        throw new Error(`Failed to fetch audio from storage: ${audioRes.status}`)
      }
      const buffer = await audioRes.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      // Chunked btoa avoids call-stack overflow on large arrays
      const CHUNK = 8192
      const parts: string[] = []
      for (let i = 0; i < bytes.length; i += CHUNK) {
        parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)))
      }
      audioBase64 = btoa(parts.join(''))
    }

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: 'Audio data or URL required' }),
        { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    let transcript = ''
    let providerUsed = ''
    const providerErrors: string[] = []

    for (const provider of transcriptionProviderOrder()) {
      try {
        transcript = await transcribeWithProvider(provider, audioBase64, mimeType, language)
        if (transcript.trim()) {
          providerUsed = provider
          break
        }

        providerErrors.push(`${provider}: empty transcript`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        providerErrors.push(`${provider}: ${message}`)
        console.error(`${provider} transcription failed:`, error)
      }
    }

    if (!transcript.trim()) {
      return new Response(
        JSON.stringify({ error: 'No transcript returned by transcription provider', details: providerErrors }),
        { status: 502, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ transcript, provider: providerUsed }),
      { headers: { ...corsH, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Transcription error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
    )
  }
})
