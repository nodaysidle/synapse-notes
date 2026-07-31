import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createEmbedding } from "../_shared/openrouter.ts";

serve(async (req) => {
  const corsH = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Text required" }),
        {
          status: 400,
          headers: { ...corsH, "Content-Type": "application/json" },
        },
      );
    }

    const result = await createEmbedding(text);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsH, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(
      "Embedding error:",
      error instanceof Error ? error.message : error,
    );
    return new Response(
      JSON.stringify({ error: "Embedding generation failed" }),
      {
        status: 500,
        headers: { ...corsH, "Content-Type": "application/json" },
      },
    );
  }
});
