# src/contexts/

## Responsibility
React Context providers for global session state: authentication identity and the auto-bootstrapped personal workspace.

## Design
Two independent Context + Provider pairs, composed in `App.tsx` with `AuthProvider` wrapping `WorkspaceProvider`.

- **AuthContext** — Wraps Supabase `onAuthStateChange`. Exposes `user`, `session`, `loading`, `signInAnonymously()`, `signOut()`. Anonymous sign-in is the default flow (no password required).
- **WorkspaceContext** — After auth resolves, loads the user's workspace from `workspace_members`, or auto-creates a personal "My Notes" workspace. Exposes `workspace`, `members`, `loading`.

## Flow
1. App starts → `AuthProvider` subscribes to Supabase auth state.
2. Once `user` is set → `WorkspaceProvider` queries for existing membership.
3. If no membership found → auto-creates a "My Notes" workspace (no join/create UI).
4. `RequireReady` guard in `App.tsx` blocks all routes until both `authLoading` and `wsLoading` are false.

## Integration
- Consumed by: every page and `Layout` component
- Depends on: `lib/supabase`, `lib/database.types`
