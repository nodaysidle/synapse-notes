import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')

serve(async (req) => {
  const corsH = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsH })
  }

  try {
    const { text } = await req.json()

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text required' }),
        { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google API key not configured' }),
        { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    // Call Google embedding API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text }] },
          outputDimensionality: 768
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Embedding API error:', error)
      return new Response(
        JSON.stringify({ error: 'Embedding generation failed' }),
        { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const embedding = data.embedding?.values || []

    return new Response(
      JSON.stringify({ embedding }),
      { headers: { ...corsH, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Embedding error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
    )
  }
})
