# src/pages/

## Responsibility
Route-level views. Each page owns its own data-fetching, local state, and layout.

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| `Home` | `/` | Dashboard with 3 most recent notes; quick-access Record button |
| `NotesList` | `/notes` | Paginated list with keyword search + semantic search toggle |
| `NoteDetail` | `/notes/:id` | Full note view: transcript, retryable processing, audio playback, downloadable AI image, similar notes |
| `Gallery` | `/gallery` | Grid of AI-generated note images with date labels and device-save shortcuts |
| `GraphView` | `/graph` | Interactive Three.js 3D force-directed graph of note connections |
| `Record` | `/record` | Full-screen recorder; uses `useAudioRecorder` directly, uploads blob, triggers `processNote()` |
| `WorkspaceSetup` | `/setup` | Auto signs in anonymously, routes to Create or Join workspace |
| `CreateWorkspace` | `/setup/create` | Creates workspace, displays shareable invite code |
| `JoinWorkspace` | `/setup/join` | Joins existing workspace by invite code + display name |

## Design Patterns
- **Data fetching**: `useEffect` + `supabase.from(…).select(…)` directly in pages (no dedicated query layer).
- **Realtime**: `NoteDetail` subscribes to `supabase.channel()` to watch transcription and image generation progress live.
- **3D Graph** (`GraphView`): Three.js scene + `OrbitControls` in a `useRef` canvas. Force-directed positions computed via `textAnalysis.getSharedKeywords()`. Nodes are `THREE.Mesh` spheres; edges are `THREE.Line` objects. Click handler navigates to note.

## Flow (Record → Note appears in list)
1. User taps Record → `useAudioRecorder` captures blob.
2. On save → blob uploaded to Supabase Storage.
3. `processNote()` called → transcribe → generate image + embedding in parallel, awaiting both before completion.
4. Realtime channel in `NoteDetail` fires UI updates as each step completes.

Failed or interrupted processing can be retried from the stored `audio_url`; users do not need to record again. Android image downloads use the native `ImageSaver` MediaStore bridge and appear under `Pictures/Synapse Notes`.

## Integration
- Depends on: `contexts/`, `hooks/`, `lib/supabase`, `lib/edgeFunctions`, `utils/`
- Consumed by: `App.tsx` router
