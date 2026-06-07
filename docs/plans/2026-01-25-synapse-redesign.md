# Synapse Notes Redesign

## Overview

Complete redesign of Synapse Notes with modern glassmorphism UI, voice-first interaction, real-time collaboration, and Supabase deployment.

## Design Goals

1. **Visual**: Glassmorphism aesthetic with teal/cyan accents
2. **Interaction**: Voice-first note capture
3. **Mobile**: Fully responsive, touch-optimized
4. **Collaboration**: Simple workspace sharing with real-time sync
5. **Deployment**: Supabase (free tier) + Vercel

---

## Visual Design System

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `bg-base` | `#0f1419` | Main background |
| `bg-dark` | `#0a1a1f` | Gradient target, graph background |
| `glass-light` | `rgba(255,255,255,0.08)` | Card backgrounds |
| `glass-dark` | `rgba(0,0,0,0.3)` | Input backgrounds |
| `accent-primary` | `#14b8a6` (teal-500) | Buttons, active states, glows |
| `accent-secondary` | `#06b6d4` (cyan-500) | Links, highlights, graph links |
| `text-primary` | `#ffffff` | Headings |
| `text-secondary` | `#94a3b8` (slate-400) | Body text |
| `success` | `#10b981` (emerald-500) | Success states |
| `error` | `#f43f5e` (rose-500) | Error states |

### Glassmorphism Effects

```css
/* Card/Panel */
.glass-panel {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

/* Elevated panels with glow */
.glass-elevated {
  box-shadow: 0 8px 32px rgba(20, 184, 166, 0.15);
}

/* Input fields */
.glass-input {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-input:focus {
  border-color: #14b8a6;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.2);
}
```

### Typography

- **Font Family**: Inter (Google Fonts)
- **Headings**: 600 weight, -0.02em letter-spacing
- **Body**: 400 weight, 1.6 line-height
- **Scale**: 14px base, 1.25 ratio

### Motion

- **Transitions**: 200-300ms ease-out
- **Hover scale**: 1.02 on interactive elements
- **Page transitions**: Fade + subtle slide (150ms)

---

## Core Interaction Flow

### Home Screen (Voice-First)

```
┌─────────────────────────────────┐
│  Synapse          [workspace]   │
│                                 │
│                                 │
│         ┌─────────┐             │
│         │   🎤    │  ← 64px     │
│         │         │    pulsing  │
│         └─────────┘    glow     │
│                                 │
│    "Tap to capture a thought"   │
│                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Note │ │Note │ │Note │       │
│  │  1  │ │  2  │ │  3  │       │
│  └─────┘ └─────┘ └─────┘       │
│         Recent notes            │
│                                 │
│  [🏠]      [📝]      [✨]       │
│  Home     Notes     Graph       │
└─────────────────────────────────┘
```

### Recording Experience

1. Tap mic → Full-screen dark overlay
2. Animated waveform (teal/cyan gradient)
3. Live transcript appears below waveform
4. Duration counter at top
5. Cancel (X) / Done (✓) buttons at bottom
6. Haptic feedback on start/stop (mobile)

### Post-Recording

1. Smooth transition to note editor
2. Auto-generated title from transcript
3. Full transcript displayed (editable)
4. "Processing..." while AI generates embedding + image
5. Quick actions: Tags, View in graph, Share

### Notes List

- Search bar (semantic search via embeddings)
- Single-column glass cards
- Card content: Title, timestamp, preview, duration badge
- Swipe gestures: Left = delete, Right = favorite
- Pull to refresh

---

## Knowledge Graph

### Background

- Base: `#0a0f14`
- Aurora effect: Animated gradient blobs (teal, cyan, purple hints)
- Opacity: 20-30%
- Star particles: Tiny white dots with subtle twinkle

### Nodes

- Circular glass panels with title
- Size = connection count
- Soft teal glow halo
- Hover: Scale 1.1x, intensified glow, preview tooltip
- Tap: Slide-over panel (graph stays visible)

### Clusters & Links

- Force-directed layout (gentle drift)
- Curved gradient links (teal → cyan)
- Link opacity = similarity strength
- Faint nebula glow behind clusters

### Interactions

- Pinch zoom, drag pan
- Double-tap to center on node
- Long-press empty space → Quick record
- Toggle: "My notes" / "All workspace notes"

### Animation

- Gentle floating/bobbing motion
- New nodes: Scale + fade in
- Links draw themselves on connection

---

## Collaboration & Workspace

### Setup Flow

1. First launch: "Create workspace" / "Join workspace"
2. Create → Generates invite code (e.g., `SYNAPSE-7X3K`)
3. Join → Enter code
4. Simple display name prompt (no email/password)

### Real-Time Features

- Notes sync instantly (Supabase Realtime)
- Recording indicator: "Alex is recording..."
- Live edit sync (cursor/changes visible)
- Presence: Avatar dots on viewed notes
- Graph: Teammate's view position as subtle glow

### Workspace Settings

- Rename workspace
- View/regenerate invite code
- Leave workspace
- Member list (names, online status)

---

## Technical Architecture

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, Three.js |
| Hosting | Vercel (frontend) |
| Database | Supabase Postgres + pgvector |
| Auth | Supabase Auth (anonymous + optional email) |
| Storage | Supabase Storage (audio, images) |
| Realtime | Supabase Realtime subscriptions |
| Edge Functions | Supabase Edge (Deno) for AI APIs |

### Database Schema

```sql
-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace members
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Notes (modified)
ALTER TABLE notes ADD COLUMN workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE notes ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes in their workspace"
  ON notes FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert notes in their workspace"
  ON notes FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
```

### Edge Functions

1. **transcribe-audio**: Receives audio blob, calls Gemini API, returns transcript
2. **generate-embedding**: Takes text, calls text-embedding-004, returns vector
3. **generate-image**: Takes prompt, calls Imagen API, stores in Storage

### Deployment

1. Frontend: GitHub → Vercel (auto-deploy)
2. Supabase: Project via dashboard, Edge Functions via CLI
3. Environment: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_API_KEY`

---

## Performance Optimizations

- Supabase Edge: Globally distributed, low latency
- Audio/images: Supabase CDN
- Graph: Instanced rendering, frustum culling
- PWA: Offline viewing of cached notes
- Realtime: Subscribe only to workspace channel

---

## Implementation Phases

### Phase 1: Foundation
- Set up Supabase project
- Create database schema + RLS policies
- Set up Vercel deployment
- Basic Supabase auth (anonymous)

### Phase 2: UI Redesign
- Implement design system (colors, glass effects)
- Rebuild Home screen (voice-first)
- Rebuild Notes list
- Rebuild Note detail/editor

### Phase 3: Voice & AI
- Audio recording with waveform
- Edge function: Transcription
- Edge function: Embeddings
- Edge function: Image generation

### Phase 4: Knowledge Graph
- Aurora background effect
- Glass nodes with glow
- Force-directed clustering
- Interactions (zoom, pan, tap)

### Phase 5: Collaboration
- Workspace creation/joining
- Real-time subscriptions
- Presence indicators
- Live edit sync

### Phase 6: Polish
- Mobile optimization
- PWA setup
- Performance tuning
- Bug fixes
