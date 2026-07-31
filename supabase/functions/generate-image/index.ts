import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { configuredModels, openRouterRequest } from "../_shared/openrouter.ts";

interface ImageResponse {
  data?: Array<{
    b64_json?: string;
    media_type?: string;
  }>;
}

serve(async (req) => {
  const corsH = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Prompt required" }),
        {
          status: 400,
          headers: { ...corsH, "Content-Type": "application/json" },
        },
      );
    }

    const visualPrompt = `Abstract digital art visualization of: ${
      prompt.substring(0, 200)
    }. Minimalist geometric forms, dark background, acid-lime and cool-white accents, no text, no people, sophisticated editorial atmosphere.`;
    const models = configuredModels(
      "OPENROUTER_IMAGE_MODEL",
      "krea/krea-2-medium-turbo",
      "OPENROUTER_IMAGE_FALLBACK_MODELS",
      ["google/gemini-3.1-flash-lite-image"],
    );
    const failures: string[] = [];

    for (const model of models) {
      try {
        const response = await openRouterRequest<ImageResponse>(
          "/images",
          model,
          {
            prompt: visualPrompt,
            resolution: "1K",
            aspect_ratio: "1:1",
            n: 1,
          },
        );
        const image = response.data?.[0];

        if (image?.b64_json) {
          return new Response(
            JSON.stringify({
              imageBase64: image.b64_json,
              mimeType: image.media_type || "image/png",
              source: "openrouter",
              model,
              errors: failures.length ? failures : undefined,
            }),
            { headers: { ...corsH, "Content-Type": "application/json" } },
          );
        }

        failures.push(`${model}: no image data returned`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `OpenRouter image generation failed for ${model}:`,
          message,
        );
        failures.push(`${model}: ${message}`);
      }
    }

    return new Response(
      JSON.stringify({
        error: "All OpenRouter image models failed",
        details: failures,
      }),
      {
        status: 502,
        headers: { ...corsH, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(
      "Image generation error:",
      error instanceof Error ? error.message : error,
    );
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsH, "Content-Type": "application/json" },
      },
    );
  }
});
