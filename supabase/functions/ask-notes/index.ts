import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'
import { getCorsHeaders } from '../_shared/cors.ts'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  const corsH = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsH })
  }

  try {
    const { question, workspaceId, limit = 5 } = await req.json()

    if (!question || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'question and workspaceId are required' }),
        { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    if (!GOOGLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Step 1: Embed the question — must use the SAME model as generate-embedding
    // (gemini-embedding-001) so that cosine similarity is meaningful.
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: question }] },
          outputDimensionality: 768
        })
      }
    )

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text()
      console.error('Embedding API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate question embedding' }),
        { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.embedding?.values

    if (!queryEmbedding) {
      return new Response(
        JSON.stringify({ error: 'Failed to extract embedding' }),
        { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Retrieve relevant notes via vector search
    const { data: relevantNotes, error: searchError } = await supabase.rpc(
      'match_notes',
      {
        query_embedding: queryEmbedding,
        match_workspace_id: workspaceId,
        match_count: limit
      }
    )

    if (searchError) {
      console.error('Vector search error:', searchError)
      return new Response(
        JSON.stringify({ error: 'Failed to search notes' }),
        { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    if (!relevantNotes || relevantNotes.length === 0) {
      return new Response(
        JSON.stringify({ answer: "I couldn't find any notes related to your question. Try recording some notes first!", sources: [] }),
        { headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Build context from retrieved notes
    const context = relevantNotes
      .map((note: any, i: number) => `[Note ${i + 1}] (similarity: ${note.similarity?.toFixed(3)})\nTitle: ${note.title}\n${note.transcript ? `Content: ${note.transcript}` : ''}`)
      .join('\n\n')

    // Step 4: Ask Gemini with RAG context
    const ragPrompt = `You are a helpful memory assistant for Synapse Notes. Answer the user's question based ONLY on the provided notes. If the notes don't contain enough information to answer, say so honestly. Be concise and specific. Reference which notes you're drawing from.\n\nRELEVANT NOTES:\n${context}\n\nUSER QUESTION: ${question}\n\nAnswer based on the notes above:`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: ragPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const error = await geminiResponse.text()
      console.error('Gemini API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate answer' }),
        { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
      )
    }

    const geminiData = await geminiResponse.json()
    const answer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate answer.'

    const sources = relevantNotes.map((note: any) => ({
      id: note.id,
      title: note.title,
      similarity: note.similarity,
      created_at: note.created_at
    }))

    return new Response(
      JSON.stringify({ answer, sources }),
      { headers: { ...corsH, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('ask-notes error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
    )
  }
})
