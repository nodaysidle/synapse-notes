# frontend/src/

## Responsibility
React 18 + TypeScript SPA entry point and top-level application wiring.

## Entry Points
- `main.tsx` — `ReactDOM.createRoot` bootstrap.
- `App.tsx` — Router, context providers, and `RequireReady` auth guard.
- `index.css` — Global Tailwind base + custom utility classes (`aurora-bg`, `glass-input`).

## Provider Composition
```
<BrowserRouter>
  <AuthProvider>          ← anonymous Supabase session
    <WorkspaceProvider>   ← multi-user workspace auto-bootstrap
      <AppRoutes />
    </WorkspaceProvider>
  </AuthProvider>
</BrowserRouter>
```

## Route Map
| Path | Component | Notes |
|------|-----------|-------|
| `/` | `Home` (via `Layout`) | Recent notes dashboard |
| `/notes` | `NotesList` | Search + list |
| `/notes/:id` | `NoteDetail` | Realtime updates |
| `/gallery` | `Gallery` | Image grid |
| `/graph` | `GraphView` | Three.js 3D graph |
| `/record` | `Record` | Full-screen, no Layout shell |

## Directory Map
| Directory | Responsibility | Detailed Map |
|-----------|---------------|--------------|
| `components/` | Reusable UI: AudioRecorder, AudioPlayer, Layout, design-system atoms | [View](components/codemap.md) |
| `contexts/` | Global state: Auth + Workspace providers | [View](contexts/codemap.md) |
| `hooks/` | Browser API wrappers: useAudioRecorder | [View](hooks/codemap.md) |
| `lib/` | Supabase client, DB types, edge function wrappers | [View](lib/codemap.md) |
| `pages/` | Route-level views (9 pages) | [View](pages/codemap.md) |
| `utils/` | Pure helpers: formatting, keyword analysis | [View](utils/codemap.md) |
