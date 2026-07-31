import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createEmbedding } from "../_shared/openrouter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  const corsH = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsH });
  }

  try {
    const { query, workspaceId, noteId, limit = 5 } = await req.json();

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsH, "Content-Type": "application/json" },
        },
      );
    }

    // Validate the user's auth token to verify workspace membership
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const userClient = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY") || SUPABASE_SERVICE_ROLE_KEY,
        {
          global: { headers: { Authorization: authHeader } },
        },
      );
      const { data: { user } } = await userClient.auth.getUser();

      if (user && workspaceId) {
        // Verify user is a member of the workspace
        const adminClient = createClient(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
        );
        const { data: membership } = await adminClient
          .from("workspace_members")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", user.id)
          .single();

        if (!membership) {
          return new Response(
            JSON.stringify({ error: "Not authorized for this workspace" }),
            {
              status: 403,
              headers: { ...corsH, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let queryEmbedding: number[];

    // If noteId provided, use that note's embedding; otherwise generate from query text
    if (noteId) {
      const { data: note, error: noteError } = await supabase
        .from("notes")
        .select("embedding")
        .eq("id", noteId)
        .single();

      if (noteError || !note?.embedding) {
        return new Response(
          JSON.stringify({ error: "Note not found or has no embedding" }),
          {
            status: 404,
            headers: { ...corsH, "Content-Type": "application/json" },
          },
        );
      }
      queryEmbedding = note.embedding;
    } else if (query) {
      // Query and stored note vectors must use the same model and 768 dimensions.
      queryEmbedding = (await createEmbedding(query)).embedding;
    } else {
      return new Response(
        JSON.stringify({ error: "Either query or noteId is required" }),
        {
          status: 400,
          headers: { ...corsH, "Content-Type": "application/json" },
        },
      );
    }

    // Search for similar notes using cosine similarity via pgvector
    const { data: similarNotes, error: searchError } = await supabase.rpc(
      "match_notes",
      {
        query_embedding: queryEmbedding,
        match_workspace_id: workspaceId,
        match_count: limit + 1, // +1 to exclude the source note if searching by noteId
        exclude_note_id: noteId || null,
      },
    );

    if (searchError) {
      console.error("Search error:", searchError);
      // If the function doesn't exist, return empty results
      if (
        searchError.message?.includes("function") ||
        searchError.code === "42883"
      ) {
        return new Response(
          JSON.stringify({
            notes: [],
            message:
              "Semantic search not configured. Run the database migration to enable.",
          }),
          { headers: { ...corsH, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Search failed" }),
        {
          status: 500,
          headers: { ...corsH, "Content-Type": "application/json" },
        },
      );
    }

    // Filter out the source note and limit results
    const results = (similarNotes || [])
      .filter((note: any) => note.id !== noteId)
      .slice(0, limit);

    return new Response(
      JSON.stringify({ notes: results }),
      { headers: { ...corsH, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Semantic search error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsH, "Content-Type": "application/json" },
      },
    );
  }
});
