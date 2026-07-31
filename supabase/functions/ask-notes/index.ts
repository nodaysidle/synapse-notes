import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  configuredModels,
  createEmbedding,
  openRouterRequest,
  responseText,
} from "../_shared/openrouter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

serve(async (req) => {
  const corsH = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsH });
  }

  try {
    const { question, workspaceId, limit = 5 } = await req.json();

    if (!question || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "question and workspaceId are required" }),
        {
          status: 400,
          headers: { ...corsH, "Content-Type": "application/json" },
        },
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsH, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Embed the question with the same model and dimensions as stored notes.
    const queryEmbedding = (await createEmbedding(question)).embedding;

    // Step 2: Retrieve relevant notes via vector search
    const { data: relevantNotes, error: searchError } = await supabase.rpc(
      "match_notes",
      {
        query_embedding: queryEmbedding,
        match_workspace_id: workspaceId,
        match_count: limit,
      },
    );

    if (searchError) {
      console.error("Vector search error:", searchError);
      return new Response(
        JSON.stringify({ error: "Failed to search notes" }),
        {
          status: 500,
          headers: { ...corsH, "Content-Type": "application/json" },
        },
      );
    }

    if (!relevantNotes || relevantNotes.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            "I couldn't find any notes related to your question. Try recording some notes first!",
          sources: [],
        }),
        { headers: { ...corsH, "Content-Type": "application/json" } },
      );
    }

    // Step 3: Build context from retrieved notes
    const context = relevantNotes
      .map((note: any, i: number) =>
        `[Note ${i + 1}] (similarity: ${
          note.similarity?.toFixed(3)
        })\nTitle: ${note.title}\n${
          note.transcript ? `Content: ${note.transcript}` : ""
        }`
      )
      .join("\n\n");

    // Step 4: Ask an OpenRouter chat model with RAG context.
    const models = configuredModels(
      "OPENROUTER_QA_MODEL",
      "openai/gpt-5.6-luna",
      "OPENROUTER_QA_FALLBACK_MODELS",
      ["google/gemini-2.5-flash-lite"],
    );
    const modelFailures: string[] = [];
    let answer = "";
    let modelUsed = "";

    for (const model of models) {
      try {
        const completion = await openRouterRequest<ChatCompletionResponse>(
          "/chat/completions",
          model,
          {
            messages: [
              {
                role: "system",
                content:
                  "You are the Synapse Notes memory assistant. Answer only from the supplied notes. If the notes do not support an answer, say so. Be concise and cite note titles when useful.",
              },
              {
                role: "user",
                content:
                  `RELEVANT NOTES:\n${context}\n\nQUESTION:\n${question}`,
              },
            ],
            max_tokens: 700,
          },
        );
        answer = responseText(completion.choices?.[0]?.message?.content);
        if (answer) {
          modelUsed = model;
          break;
        }
        modelFailures.push(`${model}: empty answer`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `OpenRouter question answering failed for ${model}:`,
          message,
        );
        modelFailures.push(`${model}: ${message}`);
      }
    }

    if (!answer) {
      return new Response(
        JSON.stringify({
          error: "Failed to generate answer",
          details: modelFailures,
        }),
        {
          status: 502,
          headers: { ...corsH, "Content-Type": "application/json" },
        },
      );
    }

    const sources = relevantNotes.map((note: any) => ({
      id: note.id,
      title: note.title,
      similarity: note.similarity,
      created_at: note.created_at,
    }));

    return new Response(
      JSON.stringify({ answer, sources, model: modelUsed }),
      { headers: { ...corsH, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("ask-notes error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsH, "Content-Type": "application/json" },
      },
    );
  }
});
