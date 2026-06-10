# Repository Atlas: synapse-notes

## Project Purpose

**Synapse Notes** is a voice-first AI notes app. You speak, the app transcribes the note, enriches it with generated media, creates embeddings for semantic search, and connects related notes in a 3D graph.

Distributed as:

- **Web app** through Vite/React
- **Android app** through Capacitor 8

## Data Flow

```text
Record voice
  -> upload audio to Supabase Storage
  -> transcribe through Supabase Edge Function
  -> generate image + embedding
  -> store note, media, and vector data in Supabase/Postgres
  -> surface notes through search, gallery, and graph views
```

## System Entry Points

- `frontend/src/main.tsx` — React app bootstrap
- `frontend/src/App.tsx` — router and provider composition
- `frontend/android/` — Capacitor Android shell
- `supabase/functions/` — Edge functions in Deno/TypeScript
- `supabase/migrations/` — PostgreSQL schema, RLS, and pgvector setup

## Tech Stack

- Frontend: React 18, TypeScript, Vite 5, Tailwind CSS 3
- Mobile: Capacitor 8 Android
- 3D Graph: Three.js
- Backend: Supabase PostgreSQL, Storage, Realtime, Edge Functions
- Vector Search: pgvector cosine similarity
- AI integrations: transcription, image generation, and embeddings through edge functions

## Directory Map

- `frontend/src/` — SPA entry, router, provider composition
- `frontend/src/components/` — reusable UI components
- `frontend/src/contexts/` — auth and workspace state
- `frontend/src/hooks/` — browser API wrappers such as audio recording
- `frontend/src/lib/` — Supabase client, DB types, edge function wrappers
- `frontend/src/pages/` — route-level views
- `frontend/src/utils/` — formatting and text-analysis helpers
- `frontend/android/` — Capacitor Android native project
- `supabase/functions/` — edge functions: transcribe, generate-image, generate-embedding, semantic-search, ask-notes
- `supabase/migrations/` — database migrations and pgvector setup
- `shared/types/` — shared TypeScript types

## Key Design Decisions

- Anonymous auth first: Supabase anonymous sign-in on first launch.
- Workspace model: notes are scoped to a workspace.
- Realtime updates: notes can update as transcription and enrichment complete.
- pgvector: embeddings support semantic search.
- No custom backend server: server logic lives in Supabase Edge Functions.
