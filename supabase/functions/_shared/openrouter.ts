const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const APP_REFERER = "https://github.com/nodaysidle/synapse-notes";
const APP_TITLE = "Synapse Notes";

interface OpenRouterErrorResponse {
  error?: {
    message?: string;
  };
}

export class OpenRouterRequestError extends Error {
  constructor(
    public readonly model: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OpenRouterRequestError";
  }
}

function apiKey(): string {
  const key = Deno.env.get("OPENROUTER_API_KEY")?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY not configured");
  return key;
}

export function configuredModels(
  primaryEnv: string,
  primaryDefault: string,
  fallbackEnv: string,
  fallbackDefaults: string[],
): string[] {
  const primary = Deno.env.get(primaryEnv)?.trim() || primaryDefault;
  const configuredFallbacks = Deno.env.get(fallbackEnv)
    ?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return [
    ...new Set([
      primary,
      ...(configuredFallbacks?.length ? configuredFallbacks : fallbackDefaults),
    ]),
  ];
}

export async function openRouterRequest<T>(
  path: string,
  model: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${OPENROUTER_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": APP_REFERER,
      "X-Title": APP_TITLE,
    },
    body: JSON.stringify({ model, ...body }),
  });

  const rawBody = await response.text();
  let data: T & OpenRouterErrorResponse;
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new OpenRouterRequestError(
      model,
      response.status,
      "OpenRouter returned an invalid JSON response",
    );
  }

  if (!response.ok) {
    const detail = data.error?.message?.slice(0, 300) ||
      `request failed with status ${response.status}`;
    throw new OpenRouterRequestError(model, response.status, detail);
  }

  return data;
}

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
}

export async function createEmbedding(
  text: string,
): Promise<{ embedding: number[]; model: string }> {
  const model = Deno.env.get("OPENROUTER_EMBEDDING_MODEL")?.trim() ||
    "google/gemini-embedding-001";
  const dimensions = Number(
    Deno.env.get("OPENROUTER_EMBEDDING_DIMENSIONS") || "768",
  );

  if (!Number.isInteger(dimensions) || dimensions !== 768) {
    throw new Error(
      "OPENROUTER_EMBEDDING_DIMENSIONS must remain 768 for the current pgvector schema",
    );
  }

  const response = await openRouterRequest<EmbeddingResponse>(
    "/embeddings",
    model,
    {
      input: text,
      dimensions,
      encoding_format: "float",
    },
  );
  const embedding = response.data?.[0]?.embedding;

  if (!embedding || embedding.length !== dimensions) {
    throw new Error(
      `OpenRouter returned ${
        embedding?.length || 0
      } embedding dimensions; expected ${dimensions}`,
    );
  }

  return { embedding, model };
}

export function responseText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
}
