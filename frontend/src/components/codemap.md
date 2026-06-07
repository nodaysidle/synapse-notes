# src/components/

## Responsibility
Reusable UI components: domain-specific audio controls and a generic design-system layer under `ui/`.

## Design
- **AudioRecorder** — Delegates all recording state to `useAudioRecorder` hook; renders start/stop/pause controls.
- **AudioPlayer** — Standalone playback widget with variable speed (0.5×–2×), progress bar, and elapsed/total time.
- **Layout** — Shell wrapper using React Router `<Outlet>`. Renders a bottom `<nav>` with NavLink tabs (Home, Notes, Gallery, Graph). Hides nav on workspace-setup pages and during loading.
- **ui/** — Design-system atoms (Button, Card, Input, Spinner) with `glass-input` / `aurora-bg` Tailwind utility classes; barrel-exported via `index.ts`.

## Flow
1. `App.tsx` mounts `<Layout>` as the parent route, which renders child page via `<Outlet>`.
2. Recording screen uses `<AudioRecorder>` (standalone) or raw `useAudioRecorder` directly.
3. Note detail page uses `<AudioPlayer audioUrl={…} duration={…}>`.

## Integration
- Consumed by: all pages
- Depends on: `hooks/useAudioRecorder`, `contexts/WorkspaceContext`, React Router
