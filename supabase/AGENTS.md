# supabase — Supabase backend

## Purpose

Owns edge functions, migrations, and Supabase local/remote integration contracts.

## Ownership

- `functions`
- `migrations`

## Local Contracts

- Never commit secrets or local credentials.
- Treat migrations as persistent data changes; verify carefully before modifying.
- Route all AI inference through OpenRouter from Edge Functions; never expose `OPENROUTER_API_KEY` to the frontend.
- Keep note, query, and RAG embeddings on the shared `google/gemini-embedding-001` 768-dimensional vector space unless an explicit migration and full re-embedding are approved.
- Keep shared OpenRouter request and embedding behavior in `functions/_shared/openrouter.ts`.

## Work Guidance

- Read this file after the root `AGENTS.md` before editing this subtree.
- Prefer extending existing modules/files over creating parallel duplicate systems.
- Update this `AGENTS.md` only when durable ownership, contracts, or verification guidance changes.

## Verification

- Supabase local/function/migration checks appropriate to the changed file.

## Child DOX Index

None.
