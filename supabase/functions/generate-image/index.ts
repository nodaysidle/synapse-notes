import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
const IMAGEN_MODEL = Deno.env.get('IMAGEN_MODEL') || 'imagen-4.0-generate-001'
const IMAGE_PROVIDER = (Deno.env.get('IMAGE_PROVIDER') || 'replicate').toLowerCase()
const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN')
const REPLICATE_MODEL = Deno.env.get('REPLICATE_MODEL') || 'black-forest-labs/flux-schnell'

interface ImageGenerationResult {
  base64: string | null
  mimeType: string
  source: string
  error?: string
}

// Efficient base64 from ArrayBuffer (chunked to avoid call-stack overflow)
function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const CHUNK = 8192
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)))
  }
  return btoa(parts.join(''))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function firstOutputUrl(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    const first = output.find((item) => typeof item === 'string')
    return typeof first === 'string' ? first : null
  }
  return null
}

async function imageUrlToResult(url: string, source: string): Promise<ImageGenerationResult> {
  const res = await fetch(url)
  if (!res.ok) {
    return {
      base64: null,
      mimeType: 'image/jpeg',
      source,
      error: `${source} image download ${res.status}`,
    }
  }

  const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
  return {
    base64: bufToBase64(await res.arrayBuffer()),
    mimeType,
    source,
  }
}

function replicateInput(prompt: string): Record<string, unknown> {
  if (REPLICATE_MODEL === 'black-forest-labs/flux-schnell') {
    return {
      prompt,
      aspect_ratio: '1:1',
      num_outputs: 1,
      output_format: 'webp',
      output_quality: 82,
      go_fast: true,
      megapixels: '1',
    }
  }

  return {
    prompt,
    aspect_ratio: '1:1',
  }
}

/** Generate with the configured Replicate-hosted image model. */
async function tryReplicate(prompt: string): Promise<ImageGenerationResult> {
  if (!REPLICATE_API_TOKEN) {
    return {
      base64: null,
      mimeType: 'image/jpeg',
      source: 'replicate',
      error: 'REPLICATE_API_TOKEN not configured',
    }
  }

  const [owner, model] = REPLICATE_MODEL.split('/')
  if (!owner || !model) {
    return {
      base64: null,
      mimeType: 'image/jpeg',
      source: 'replicate',
      error: `Invalid REPLICATE_MODEL: ${REPLICATE_MODEL}`,
    }
  }

  const createRes = await fetch(`https://api.replicate.com/v1/models/${owner}/${model}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
    },
    body: JSON.stringify({
      input: replicateInput(prompt),
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    console.error('Replicate API error:', createRes.status, err.substring(0, 300))
    return {
      base64: null,
      mimeType: 'image/jpeg',
      source: 'replicate',
      error: `${REPLICATE_MODEL} ${createRes.status}: ${err.substring(0, 150)}`,
    }
  }

  let prediction = await createRes.json()

  for (let attempt = 0; attempt < 8 && ['starting', 'processing'].includes(prediction.status); attempt++) {
    if (!prediction.urls?.get) break
    await sleep(2000)
    const pollRes = await fetch(prediction.urls.get, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
    })
    if (!pollRes.ok) break
    prediction = await pollRes.json()
  }

  if (prediction.status !== 'succeeded') {
    return {
      base64: null,
      mimeType: 'image/jpeg',
      source: 'replicate',
      error: `${REPLICATE_MODEL} ${prediction.status || 'unknown'}: ${String(prediction.error || 'no output').substring(0, 150)}`,
    }
  }

  const outputUrl = firstOutputUrl(prediction.output)
  if (!outputUrl) {
    return {
      base64: null,
      mimeType: 'image/jpeg',
      source: 'replicate',
      error: `${REPLICATE_MODEL}: no image URL in output`,
    }
  }

  return imageUrlToResult(outputUrl, 'replicate')
}

/** Generate with the configured Imagen 4 model. */
async function tryImagen(prompt: string): Promise<ImageGenerationResult> {
  if (!GOOGLE_API_KEY) {
    return {
      base64: null,
      mimeType: 'image/png',
      source: 'imagen4',
      error: 'GOOGLE_API_KEY not configured',
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_API_KEY || '',
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '1:1', personGeneration: 'dont_allow' }
      })
    }
  )
  if (!res.ok) {
    const err = await res.text()
    console.error('Imagen API error:', res.status, err.substring(0, 300))
    return {
      base64: null,
      mimeType: 'image/png',
      source: 'imagen4',
      error: `${IMAGEN_MODEL} ${res.status}: ${err.substring(0, 150)}`,
    }
  }
  const data = await res.json()
  const base64 = data.predictions?.[0]?.bytesBase64Encoded ?? null
  return {
    base64,
    mimeType: 'image/png',
    source: 'imagen4',
    error: base64 ? undefined : `${IMAGEN_MODEL}: no image in response`,
  }
}

function providerOrder(): string[] {
  if (IMAGE_PROVIDER === 'replicate') return ['replicate', 'imagen4', 'pollinations']
  if (IMAGE_PROVIDER === 'pollinations') return ['pollinations']
  return ['imagen4', 'replicate', 'pollinations']
}

/** Pollinations.ai fallback — keeps note processing from blocking on image API errors. */
async function tryPollinations(prompt: string): Promise<ImageGenerationResult> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`
  const res = await fetch(url)
  if (!res.ok) {
    return {
      base64: null,
      mimeType: 'image/jpeg',
      source: 'pollinations',
      error: `Pollinations ${res.status}`,
    }
  }
  return {
    base64: bufToBase64(await res.arrayBuffer()),
    mimeType: 'image/jpeg',
    source: 'pollinations',
  }
}

serve(async (req) => {
  const corsH = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsH })
  }

  try {
    const { prompt } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt required' }),
        { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    const visualPrompt = `Abstract digital art visualization of: ${prompt.substring(0, 200)}. Minimalist, geometric shapes, gradient colors, no text, no people, dreamy atmosphere`

    // Try image backends in env-selected priority order while preserving
    // fallbacks so note processing keeps moving.
    const errors: string[] = []
    let imageBase64: string | null = null
    let source = ''
    let mimeType = 'image/png'

    for (const provider of providerOrder()) {
      let result: ImageGenerationResult
      if (provider === 'replicate') {
        result = await tryReplicate(visualPrompt)
      } else if (provider === 'imagen4') {
        result = await tryImagen(visualPrompt)
      } else {
        result = await tryPollinations(visualPrompt)
      }

      if (result.base64) {
        imageBase64 = result.base64
        source = result.source
        mimeType = result.mimeType
        break
      }

      if (result.error) {
        errors.push(result.error)
      }
    }

    console.log(`Image source: ${source || 'none'}`, errors.length ? `errors: ${errors.join(' | ')}` : '')

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'All image generation backends failed', details: errors }),
        { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        imageBase64,
        mimeType,
        source,
        model: source === 'imagen4' ? IMAGEN_MODEL : source === 'replicate' ? REPLICATE_MODEL : undefined,
        errors: errors.length ? errors : undefined,
      }),
      { headers: { ...corsH, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Image generation error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
    )
  }
})
