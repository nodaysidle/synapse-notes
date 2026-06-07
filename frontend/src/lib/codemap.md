# src/lib/

## Responsibility
Data-access and integration layer: Supabase client, typed database schema, and edge-function call wrappers.

## Design
- **supabase.ts** — Creates a single typed `SupabaseClient<Database>` from env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Singleton exported as `supabase`. Realtime capped at 10 events/s.
- **database.types.ts** — Full TypeScript type map generated from the PostgreSQL schema. Key tables: `workspaces`, `workspace_members`, `notes` (with `embedding vector(768)`, `image_url`, `audio_url`, `transcript`).
- **edgeFunctions.ts** — Client-side wrappers for the four Supabase Edge Functions:
  - `transcribeAudio(blob)` → calls `transcribe`, returns `{ transcript }`
  - `generateImage(transcript)` → calls `generate-image`, returns `{ imageBase64 }`
  - `generateEmbedding(text)` → calls `generate-embedding`, returns `{ embedding: number[] }`
  - `semanticSearch(query, workspaceId)` → calls `semantic-search`, returns `SimilarNote[]`
  - `processNote(noteId, blob, workspaceId)` — orchestrates all four steps sequentially.

## Flow
`processNote()` pipeline:
```
upload audio → transcribe → save transcript → generate image → save image
            → generate embedding → save embedding
```

## Integration
- Consumed by: `pages/Record`, `pages/NoteDetail`, `pages/NotesList`
- Depends on: Supabase Edge Functions, env vars
