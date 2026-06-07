<p align="center">
  <h1 align="center">Synapse Notes</h1>
</p>

<p align="center">
  <strong>Voice-first notes with AI transcription, generated visuals, semantic search, and a 3D knowledge graph.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20Android-black?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Frontend-React%2018-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Mobile-Capacitor%208-119EFF?style=flat-square" alt="Capacitor">
  <img src="https://img.shields.io/badge/Backend-Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=black" alt="Supabase">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

Synapse Notes turns spoken thoughts into searchable, connected notes. Record a voice note, transcribe it through AI, generate a visual companion, embed the transcript for semantic search, and explore related notes in a 3D graph.

This repository contains the public source for the React/Vite frontend, Capacitor Android shell, Supabase edge functions, and database migrations.

## Features

- Voice recording with waveform feedback.
- AI transcription through Supabase Edge Functions.
- AI image generation for note visuals.
- Semantic search backed by pgvector embeddings.
- 3D graph view powered by Three.js.
- Anonymous-first workspace flow.
- Android app shell via Capacitor.
- Web build via Vite.

## Architecture

```text
Record voice
  -> upload audio to Supabase Storage
  -> transcribe through Supabase Edge Function
  -> generate image + embedding
  -> store note, media, and vector data in Supabase/Postgres
  -> surface notes through search, gallery, and graph views
```

## Stack

- Frontend: React 18, TypeScript, Vite 5, Tailwind CSS 3
- Mobile: Capacitor 8 Android
- Graph: Three.js
- Backend: Supabase PostgreSQL, Storage, Realtime, Edge Functions
- Vector search: pgvector
- AI integrations: provider-backed transcription, image generation, and embeddings through edge functions

## Repository layout

```text
synapse-notes/
├── frontend/              # React/Vite app and Capacitor Android project
│   ├── src/               # app routes, components, hooks, contexts, Supabase client
│   ├── android/           # Capacitor Android native shell
│   └── package.json
├── supabase/
│   ├── functions/         # Deno edge functions
│   └── migrations/        # database schema/RLS/pgvector migrations
├── shared/types/          # shared TypeScript types
├── docs/                  # implementation notes
├── AGENTS.md              # agent instructions
└── codemap.md             # architecture map
```

## Build from source

### Prerequisites

- Node.js 18+
- Android Studio + Android SDK for APK builds
- Supabase project credentials
- Provider API keys configured in Supabase function secrets

Copy the environment template:

```bash
cd frontend
cp .env.example .env
```

Set:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Web build

```bash
cd frontend
npm ci
npm run typecheck
npm run build
```

### Android debug APK

```bash
cd frontend
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

Output:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

## Supabase functions

Deploy the edge functions from the project root or Supabase workspace after configuring secrets:

```bash
npx supabase functions deploy transcribe --no-verify-jwt
npx supabase functions deploy generate-image --no-verify-jwt
npx supabase functions deploy generate-embedding --no-verify-jwt
npx supabase functions deploy semantic-search --no-verify-jwt
npx supabase functions deploy ask-notes --no-verify-jwt
```

## Release

GitHub releases are published at:

```text
https://github.com/nodaysidle/synapse-notes/releases
```

The first GitHub migration release is a verified debug APK for testing and side-loading. It is not Play Store signed.

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/nodaysidle">NODAYSIDLE</a>
</p>
