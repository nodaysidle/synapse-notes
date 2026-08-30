<p align="center">
  <img src="assets/synapse-notes-icon.png" alt="Synapse Notes logo" width="168">
</p>

<h1 align="center">Synapse Notes</h1>

<p align="center">
  Voice notes on Android. Tap the mic, get a transcript, optional image, and a keyword graph.
</p>

<p align="center">
  <a href="https://github.com/nodaysidle/synapse-notes/releases/download/v0.4.1/synapse-notes-0.4.1-debug.apk"><strong>Download v0.4.1 debug APK</strong></a>
  ·
  <a href="https://github.com/nodaysidle/synapse-notes/releases/tag/v0.4.1">v0.4.1 release</a>
  ·
  <a href="https://github.com/nodaysidle/synapse-notes/releases">All releases</a>
</p>

<p align="center">
  <img alt="Android" src="https://img.shields.io/badge/Android-24%2B-C8FF00?style=flat-square&logo=android&logoColor=0A0A0F">
  <img alt="Version" src="https://img.shields.io/badge/v0.4.1-debug-6B6B80?style=flat-square">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black">
  <img alt="Supabase" src="https://img.shields.io/badge/Backend-Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white">
  <img alt="OpenRouter" src="https://img.shields.io/badge/AI-OpenRouter-6467F2?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-F0F0F5?style=flat-square">
</p>

## What it does

Synapse Notes is a voice-first Android app (`com.synapse.notes`). You record a thought; the backend stores the audio, transcribes it, embeds it, and may generate an image. Notes land on Home. There is no iOS build and no Play Store listing — current releases are debug APKs for sideload only.

On first launch the app signs in anonymously and creates a personal **My Notes** workspace. There is no join screen or multi-user onboarding.

## How a note is made

```text
Tap mic
  → audio → Supabase Storage
  → OpenRouter transcription  (+ title = first sentence of transcript)
  ├─→ OpenRouter embedding (768-d, stored)
  └─→ OpenRouter image (optional) → Supabase Storage → Gallery
  → note appears on Home
```

Statuses: **Queued** → **Processing** → **Ready**, or **Failed**. Failed or stuck notes can retry from the stored audio. Image failure does not drop a valid transcript. Generated images can be saved to `Pictures/Synapse Notes` on the device.

## What’s on screen (v0.4.1)

| Screen | What you get |
|---|---|
| **Home** | Void black, muted green mic centered, header “Synapse Notes”. Recent notes list under the mic when notes exist. |
| **Notes** | Full list with substring search (`includes()` on title / transcript / content). Not semantic search. |
| **Gallery** | Generated images; save to the phone gallery. |
| **Graph** | Three.js view; edges from shared keywords (≥2). Not embedding edges / `match_notes`. |
| **Note detail** | Transcript, status, retry, image; optional “similar notes” via the `semantic-search` Edge Function. |

**Not in the UI:** `ask-notes` question answering (Edge Function exists; no screen calls it).

Embeddings are generated and stored. The notes list filter and the graph do not use them yet.

## Models (OpenRouter)

AI runs in Supabase Edge Functions. The OpenRouter key is never shipped in the APK.

| Capability | Primary | Fallback |
|---|---|---|
| Transcription | `openai/gpt-4o-mini-transcribe` | `openai/whisper-large-v3`, `google/chirp-3` |
| Embeddings | `google/gemini-embedding-001` (768-d) | same model via provider routing |
| Image | `krea/krea-2-medium-turbo` | `google/gemini-3.1-flash-lite-image` |
| Ask notes (no UI) | `openai/gpt-5.6-luna` | `google/gemini-2.5-flash-lite` |

Overrides: [`supabase/.env.example`](supabase/.env.example). Keep embeddings at 768 dimensions unless you migrate the schema and re-embed every note.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3 |
| Android | Capacitor 8, `com.synapse.notes`, MediaStore image saver |
| Graph | Three.js |
| Backend | Supabase (Postgres, Storage, Realtime, Edge Functions) |
| AI | OpenRouter |

## Install the APK

1. Download [`synapse-notes-0.4.1-debug.apk`](https://github.com/nodaysidle/synapse-notes/releases/download/v0.4.1/synapse-notes-0.4.1-debug.apk) from the [v0.4.1 release](https://github.com/nodaysidle/synapse-notes/releases/tag/v0.4.1).
2. Sideload on Android 24+. Allow install from unknown sources for your file manager/browser.
3. This is a **debug-signed** build for testing, not a Play Store release.

Sideloaded and used on a **Xiaomi M2007J3SY**.

## Run locally

### Requirements

- Node.js 18+
- npm
- Supabase project URL and anon/publishable key
- Supabase CLI for function deploy
- JDK 21 + Android SDK for APK builds

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env
```

In `frontend/.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

```bash
npm run typecheck
npm run build
# optional: npm run dev
```

### Supabase Edge Functions

Keep `OPENROUTER_API_KEY` in Supabase secrets — not in Vite env or the APK.

```bash
cp supabase/.env.example supabase/.env.local
# put OPENROUTER_API_KEY in supabase/.env.local (gitignored)
supabase secrets set --env-file supabase/.env.local
supabase functions deploy transcribe --no-verify-jwt
supabase functions deploy generate-image --no-verify-jwt
supabase functions deploy generate-embedding --no-verify-jwt
supabase functions deploy semantic-search --no-verify-jwt
supabase functions deploy ask-notes --no-verify-jwt
```

### Android debug APK (local)

```bash
cd frontend
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

Artifact:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

## Repository map

```text
synapse-notes/
├── assets/           # brand assets
├── frontend/         # React app + Capacitor Android shell
├── shared/           # shared TypeScript types
├── supabase/         # Edge Functions + migrations
├── docs/             # project docs
└── prompts/          # agent prompt templates
```

## License

[MIT](LICENSE)
