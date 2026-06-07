# src/hooks/

## Responsibility
Custom React hooks that encapsulate side-effectful browser APIs.

## Design
- **useAudioRecorder** — Wraps the Web `MediaRecorder` API. Manages `isRecording`, `isPaused`, `duration`, `audioBlob`. Enforces a 10-minute hard cap and an 8-minute warning. Exposes `startRecording()`, `stopRecording()`, `pauseRecording()`, `resumeRecording()`, `getDuration()`, `error`.
- **useAuth** — Thin re-export alias for `useAuthContext()` from `AuthContext`. Allows pages to import from `hooks/` without reaching directly into `contexts/`.

## Flow
`useAudioRecorder`:
1. `startRecording()` → `getUserMedia({ audio: true })` → creates `MediaRecorder`, collects `Blob` chunks on `dataavailable`.
2. `stopRecording()` → finalizes blob, sets `audioBlob` state.
3. Calling code (Record page) uploads blob to Supabase Storage then calls `processNote()`.

## Integration
- Consumed by: `components/AudioRecorder`, `pages/Record`
- Depends on: browser `MediaRecorder` API, `contexts/AuthContext`
