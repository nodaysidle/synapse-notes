<p align="center">
  <img src="assets/synapse-notes-icon.png" alt="Synapse Notes logo" width="168">
</p>

<h1 align="center">Synapse Notes</h1>

<p align="center">
  <strong>Voice-first Android notes app with transcription, semantic memory, and graph-based exploration.</strong><br>
  Speak → transcript → embedding → AI image → Home.
</p>

<p align="center">
  <a href="https://github.com/nodaysidle/synapse-notes/releases/download/v0.4.3/synapse-notes-0.4.3-debug.apk"><strong>Download v0.4.3 debug APK</strong></a>
  ·
  <a href="https://github.com/nodaysidle/synapse-notes/releases/tag/v0.4.3">v0.4.3 release</a>
  ·
  <a href="https://github.com/nodaysidle/synapse-notes/releases">All releases</a>
</p>

<p align="center">
  <img alt="Android" src="https://img.shields.io/badge/Android-24%2B-C8FF00?style=flat-square&logo=android&logoColor=0A0A0F">
  <img alt="Version" src="https://img.shields.io/badge/v0.4.3-debug-6B6B80?style=flat-square">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black">
  <img alt="Supabase" src="https://img.shields.io/badge/Backend-Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white">
  <img alt="OpenRouter" src="https://img.shields.io/badge/AI-OpenRouter-6467F2?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-F0F0F5?style=flat-square">
</p>

## The journey

Synapse Notes exists for one path: spoken words become a note you can open in a graph.

```text
Spoken words
  → mic capture → Supabase Storage
  → OpenRouter transcription
       title = first sentence of the transcript
  → OpenRouter embedding (768-d, stored on the note)
  → OpenRouter AI image (optional companion visual)
  → note lands on Home   ← capture pipeline ends here

Open Graph (nav): 3D visualization of your notes.
  Edges appear only when two notes share ≥2 keywords.
```

Speak → transcribe → embed → image is the automatic capture pipeline. Graph visualization is the product story’s destination — a **screen you open**, not a final pipeline stage that every note runs through.

| Stage | What happens |
|---|---|
| **Speak** | Tap the muted-green mic. Audio uploads to Supabase Storage. |
| **Transcribe** | OpenRouter turns speech into text. Title = first sentence. |
| **Embed** | A 768-d vector is stored with the note (used later for similar-notes on detail). |
| **Image** | An optional AI image is generated and stored. Failure here does **not** drop the note. |
| **Home** | Pipeline ends: the note shows up under the mic (last **5** notes). |

**Graph (screen):** Open anytime from nav. Three.js 3D view; links today are **shared keywords** (≥2), not embedding edges / `match_notes`. A note with no keyword overlap appears as an isolated node.

Statuses while the pipeline runs: Home, Notes, and note detail show **Queued** → **Live** → **Ready**, or **Failed**. Retry reuses the stored audio — no re-record required. Images can be saved to `Pictures/Synapse Notes` on the phone.

Android only (`com.synapse.notes`). Debug APK sideload — no iOS, no Play Store. First launch: anonymous auth and an auto-created **My Notes** space. No join or workspace onboarding.

## What’s on screen (v0.4.3)

Phone-tested on a **Xiaomi M2007J3SY** (Android 12). Notes and Gallery are compact single-column layouts (no sideways scroll). Bottom nav (**Capture** / **Notes** / **Gallery** / **Graph**) stays visible and tappable. Android Back pops in-app history and only exits the app from Home; the Capture tab stays `/` (Home).

| Screen | Role in the journey |
|---|---|
| **Home** | Start: void black, centered muted-green mic, header “Synapse Notes”. Lists the last **5** notes under the mic (status **Live** while in flight). Unchanged in v0.4.3. |
| **Record** | Capture the spoken words that enter the pipeline. |
| **Note detail** | Watch status (**Live** while in flight), read transcript, retry, view image. Optional **similar notes** via the `semantic-search` Edge Function (embeddings). |
| **Gallery** | Browse generated images in a compact single-column layout; save to device gallery. |
| **Graph** | Screen you open: 3D note visualization (keyword links ≥2, not embedding edges). |
| **Notes** | Full list (`/notes`) in a compact single-column layout; empty copy is “No notes yet.” Filter is substring `includes()` on title / transcript / **content** — not semantic search. |

**Not in the UI:** `ask-notes` (Edge Function exists; no screen calls it). Embeddings are stored; the list filter and graph edges do not use them yet. Similar-notes on detail does.

## Models (OpenRouter)

All of the journey’s AI steps run in Supabase Edge Functions. The OpenRouter key is never in the APK.

| Step in the journey | Primary | Fallback |
|---|---|---|
| Transcribe | `openai/gpt-4o-mini-transcribe` | `openai/whisper-large-v3`, `google/chirp-3` |
| Embed | `google/gemini-embedding-001` (768-d) | — (single model; no fallback in repo) |
| AI image | `krea/krea-2-medium-turbo` | `google/gemini-3.1-flash-lite-image` |
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

The APK is how you walk the journey on a phone.

1. Download [`synapse-notes-0.4.3-debug.apk`](https://github.com/nodaysidle/synapse-notes/releases/download/v0.4.3/synapse-notes-0.4.3-debug.apk) from the [v0.4.3 release](https://github.com/nodaysidle/synapse-notes/releases/tag/v0.4.3).
2. Sideload on Android 24+. Allow install from unknown sources for your file manager/browser.
3. Debug-signed testing build — not a Play Store release.

Sideloaded and phone-tested on a **Xiaomi M2007J3SY** (Android 12).

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
