import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { configuredModels, openRouterRequest } from "../_shared/openrouter.ts";

interface TranscriptionRequest {
  audioBase64?: string;
  audioUrl?: string;
  mimeType?: string;
  language?: string;
}

interface TranscriptionResponse {
  text?: string;
}

function getAudioFormat(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("m4a")) return "m4a";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("flac")) return "flac";
  if (normalized.includes("aac")) return "aac";
  return "webm";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];
  const chunkSize = 8192;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    parts.push(
      String.fromCharCode(...bytes.subarray(index, index + chunkSize)),
    );
  }

  return btoa(parts.join(""));
}

serve(async (req) => {
  const corsH = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  try {
    const {
      audioBase64: requestBase64,
      audioUrl,
      mimeType = "audio/webm",
      language,
    } = await req.json() as TranscriptionRequest;

    let audioBase64 = requestBase64;
    if (!audioBase64 && audioUrl) {
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(
          `Failed to fetch audio from storage: ${audioResponse.status}`,
        );
      }
      audioBase64 = arrayBufferToBase64(await audioResponse.arrayBuffer());
    }

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: "Audio data or URL required" }),
        {
          status: 400,
          headers: { ...corsH, "Content-Type": "application/json" },
        },
      );
    }

    const models = configuredModels(
      "OPENROUTER_TRANSCRIPTION_MODEL",
      "openai/gpt-4o-mini-transcribe",
      "OPENROUTER_TRANSCRIPTION_FALLBACK_MODELS",
      ["openai/whisper-large-v3", "google/chirp-3"],
    );
    const failures: string[] = [];

    for (const model of models) {
      try {
        const response = await openRouterRequest<TranscriptionResponse>(
          "/audio/transcriptions",
          model,
          {
            input_audio: {
              data: audioBase64,
              format: getAudioFormat(mimeType),
            },
            ...(language ? { language } : {}),
            temperature: 0,
          },
        );
        const transcript = response.text?.trim();

        if (transcript) {
          return new Response(
            JSON.stringify({ transcript, provider: "openrouter", model }),
            { headers: { ...corsH, "Content-Type": "application/json" } },
          );
        }

        failures.push(`${model}: empty transcript`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`OpenRouter transcription failed for ${model}:`, message);
        failures.push(`${model}: ${message}`);
      }
    }

    return new Response(
      JSON.stringify({
        error: "No transcript returned by OpenRouter",
        details: failures,
      }),
      {
        status: 502,
        headers: { ...corsH, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(
      "Transcription error:",
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
