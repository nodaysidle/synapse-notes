<p align="center">
  <img src="assets/synapse-notes-icon.png" alt="Synapse Notes logo" width="168">
</p>

<h1 align="center">Synapse Notes</h1>

<p align="center">
  Voice-first notes that become searchable memories, generated visuals, and a living knowledge graph.
</p>

<p align="center">
  <a href="https://github.com/nodaysidle/synapse-notes/releases/latest/download/debug.apk"><strong>Download the Android debug APK</strong></a>
  ·
  <a href="https://github.com/nodaysidle/synapse-notes/releases">Release history</a>
</p>

<p align="center">
  <img alt="Android" src="https://img.shields.io/badge/Android-24%2B-C8FF00?style=flat-square&logo=android&logoColor=0A0A0F">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black">
  <img alt="Supabase" src="https://img.shields.io/badge/Backend-Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white">
  <img alt="OpenRouter" src="https://img.shields.io/badge/AI-OpenRouter-6467F2?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-F0F0F5?style=flat-square">
</p>

## What it does

Synapse Notes turns a spoken thought into a durable, connected note. Tap the microphone and recording starts immediately. The app uploads the audio, transcribes it, generates a visual companion, creates a semantic embedding, and connects the result to related notes in a navigable 3D graph.

The Android experience is built around fast capture and transparent recovery: processing states remain visible, interrupted notes can retry from their stored audio, and generated images can be saved directly to the phone's gallery.

## Highlights

- **One-tap voice capture** with automatic recording, live waveform feedback, and visible save recovery.
- **OpenRouter AI pipeline** for transcription, embeddings, image generation, and question answering.
- **Truthful processing states** — Queued, Processing, Ready, and Failed — updated through Supabase Realtime.
- **Retry without re-recording** when processing fails or remains interrupted for more than three minutes.
- **AI visualization gallery** with native Android downloads into `Pictures/Synapse Notes`.
- **Semantic search and related notes** backed by 768-dimensional pgvector embeddings.
- **Interactive 3D knowledge graph** powered by Three.js.
- **Tap mic, notes show up** — the app signs in anonymously and auto-creates a personal notes space; there is no join step.

## How a note moves through Synapse

```text
Microphone
  → Supabase Storage
  → OpenRouter transcription
  → transcript + generated title
  ├─→ OpenRouter embedding → pgvector search and graph connections
  └─→ OpenRouter image generation → Supabase Storage → Gallery / phone
```

Embedding and visualization work runs in parallel after transcription. The note is marked Ready only after the required embedding succeeds and the optional image task has settled. Image failure does not discard a valid transcript.

## Model routing

AI calls stay in Supabase Edge Functions; the OpenRouter key is never shipped in the frontend or APK.

| Capability | Primary model | Fallback |
|---|---|---|
| Transcription | `openai/gpt-4o-mini-transcribe` | `openai/whisper-large-v3`, `google/chirp-3` |
| Embeddings | `google/gemini-embedding-001` at 768 dimensions | Provider routing for the same model |
| Image generation | `krea/krea-2-medium-turbo` | `google/gemini-3.1-flash-lite-image` |
| Question answering | `openai/gpt-5.6-luna` | `google/gemini-2.5-flash-lite` |

The defaults can be changed through the variables documented in [`supabase/.env.example`](supabase/.env.example). Keep embeddings at 768 dimensions unless the database schema is migrated and every stored note is re-embedded.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3 |
| Android | Capacitor 8, Java, Android MediaStore |
| Graph | Three.js |
| Backend | Supabase Postgres, Storage, Realtime, Edge Functions |
| Search | pgvector semantic embeddings |
| AI gateway | OpenRouter |

## Run locally

### Requirements

- Node.js 18 or newer
- npm
- Supabase project URL and publishable/anonymous key
- Supabase CLI for backend deployment
- JDK 21 and Android SDK for APK builds

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env
```

Set these public frontend values in `frontend/.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

Then run:

```bash
npm run typecheck
npm run build
```

### Supabase Edge Functions

Configure the OpenRouter key as a Supabase function secret. Do not put it in `frontend/.env` or pass the live value directly on the command line.

```bash
cp supabase/.env.example supabase/.env.local
# Add the live OPENROUTER_API_KEY to the ignored supabase/.env.local file.
supabase secrets set --env-file supabase/.env.local
supabase functions deploy transcribe --no-verify-jwt
supabase functions deploy generate-image --no-verify-jwt
supabase functions deploy generate-embedding --no-verify-jwt
supabase functions deploy semantic-search --no-verify-jwt
supabase functions deploy ask-notes --no-verify-jwt
```

Optional routing overrides are listed in [`supabase/.env.example`](supabase/.env.example).

### Build the Android debug APK

```bash
cd frontend
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The local artifact is written to:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Release builds in this repository are debug-signed testing artifacts intended for sideloading. They are not Play Store releases.

## Repository map

```text
synapse-notes/
├── assets/                    # source brand assets
├── frontend/
│   ├── src/                   # React routes, UI, data access, and utilities
│   └── android/               # Capacitor Android shell and native image saver
├── shared/                    # shared TypeScript types
├── supabase/
│   ├── functions/             # OpenRouter-backed Edge Functions
│   └── migrations/            # schema, policies, storage, and pgvector
├── docs/                      # project documentation
└── prompts/                   # repository maintenance prompts
```

## Release verification

The current Android build was validated on a Redmi 15 4G (`creek`) running Android 16:

- cold launch and authenticated workspace loading
- automatic recording start and cancellation
- existing note and graph rendering
- native image save with MediaStore confirmation
- Gallery download controls
- TypeScript, Vite, Capacitor sync, and Gradle debug build

## License

[MIT](LICENSE)
