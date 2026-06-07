# Synapse Notes Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Synapse Notes into a modern glassmorphism voice-first app with real-time collaboration, deployed on Supabase + Vercel.

**Architecture:** Replace Express backend with Supabase (Postgres + Auth + Realtime + Storage + Edge Functions). Redesign React frontend with glassmorphism UI. Add workspace-based collaboration.

**Tech Stack:** React 18, Vite, Tailwind CSS, Supabase JS, Three.js, Vercel

---

## Phase 1: Supabase Foundation

### Task 1: Install Supabase Dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install Supabase client**

```bash
cd frontend && npm install @supabase/supabase-js
```

**Step 2: Verify installation**

```bash
cat package.json | grep supabase
```
Expected: `"@supabase/supabase-js": "^2.x.x"`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add supabase-js dependency"
```

---

### Task 2: Create Supabase Client Configuration

**Files:**
- Create: `frontend/src/lib/supabase.ts`
- Create: `frontend/.env.example`
- Modify: `frontend/.gitignore`

**Step 1: Create Supabase client**

Create `frontend/src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})
```

**Step 2: Create env example**

Create `frontend/.env.example`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_API_KEY=your-google-api-key
```

**Step 3: Update gitignore**

Add to `frontend/.gitignore`:

```
.env
.env.local
```

**Step 4: Commit**

```bash
git add frontend/src/lib/supabase.ts frontend/.env.example frontend/.gitignore
git commit -m "feat: add Supabase client configuration"
```

---

### Task 3: Create Database Types

**Files:**
- Create: `frontend/src/lib/database.types.ts`

**Step 1: Create database types**

Create `frontend/src/lib/database.types.ts`:

```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          created_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          display_name: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          display_name: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          display_name?: string
          created_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          workspace_id: string
          created_by: string
          title: string
          content: string | null
          transcript: string | null
          audio_url: string | null
          image_url: string | null
          duration: number | null
          embedding: number[] | null
          embedding_status: 'pending' | 'processing' | 'completed' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          created_by: string
          title: string
          content?: string | null
          transcript?: string | null
          audio_url?: string | null
          image_url?: string | null
          duration?: number | null
          embedding?: number[] | null
          embedding_status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          created_by?: string
          title?: string
          content?: string | null
          transcript?: string | null
          audio_url?: string | null
          image_url?: string | null
          duration?: number | null
          embedding?: number[] | null
          embedding_status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          name: string
          workspace_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          workspace_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          workspace_id?: string
          created_at?: string
        }
      }
      note_tags: {
        Row: {
          note_id: string
          tag_id: string
        }
        Insert: {
          note_id: string
          tag_id: string
        }
        Update: {
          note_id?: string
          tag_id?: string
        }
      }
    }
  }
}

// Convenience types
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type Note = Database['public']['Tables']['notes']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
```

**Step 2: Commit**

```bash
git add frontend/src/lib/database.types.ts
git commit -m "feat: add Supabase database types"
```

---

### Task 4: Create Supabase SQL Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Create migrations directory**

```bash
mkdir -p supabase/migrations
```

**Step 2: Create schema migration**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspaces table
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace members table
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Notes table
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  transcript TEXT,
  audio_url TEXT,
  image_url TEXT,
  duration INTEGER,
  embedding vector(768),
  embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tags table
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, workspace_id)
);

-- Note tags junction table
CREATE TABLE note_tags (
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (note_id, tag_id)
);

-- Indexes for performance
CREATE INDEX idx_notes_workspace_id ON notes(workspace_id);
CREATE INDEX idx_notes_created_by ON notes(created_by);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_tags_workspace_id ON tags(workspace_id);

-- Enable Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspaces
CREATE POLICY "Users can view workspaces they belong to"
  ON workspaces FOR SELECT
  USING (
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (true);

-- RLS Policies for workspace_members
CREATE POLICY "Users can view members of their workspaces"
  ON workspace_members FOR SELECT
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can join workspaces"
  ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave workspaces"
  ON workspace_members FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for notes
CREATE POLICY "Users can view notes in their workspaces"
  ON notes FOR SELECT
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create notes in their workspaces"
  ON notes FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update notes in their workspaces"
  ON notes FOR UPDATE
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete notes in their workspaces"
  ON notes FOR DELETE
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- RLS Policies for tags
CREATE POLICY "Users can view tags in their workspaces"
  ON tags FOR SELECT
  USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create tags in their workspaces"
  ON tags FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- RLS Policies for note_tags
CREATE POLICY "Users can view note_tags in their workspaces"
  ON note_tags FOR SELECT
  USING (
    note_id IN (SELECT id FROM notes WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "Users can manage note_tags in their workspaces"
  ON note_tags FOR ALL
  USING (
    note_id IN (SELECT id FROM notes WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for notes updated_at
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to generate invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'SYNAPSE-';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Enable realtime for notes table
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
```

**Step 3: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add Supabase database schema with RLS"
```

---

### Task 5: Create Auth Context with Supabase

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx`

**Step 1: Rewrite AuthContext for Supabase**

Replace `frontend/src/contexts/AuthContext.tsx`:

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInAnonymously: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInAnonymously = async () => {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signInAnonymously, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

**Step 2: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx
git commit -m "feat: rewrite AuthContext for Supabase auth"
```

---

### Task 6: Create Workspace Context

**Files:**
- Create: `frontend/src/contexts/WorkspaceContext.tsx`

**Step 1: Create WorkspaceContext**

Create `frontend/src/contexts/WorkspaceContext.tsx`:

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Workspace, WorkspaceMember } from '../lib/database.types'

interface WorkspaceContextType {
  workspace: Workspace | null
  members: WorkspaceMember[]
  loading: boolean
  createWorkspace: (name: string) => Promise<Workspace>
  joinWorkspace: (inviteCode: string, displayName: string) => Promise<void>
  leaveWorkspace: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch user's workspace on mount
  useEffect(() => {
    if (!user) {
      setWorkspace(null)
      setMembers([])
      setLoading(false)
      return
    }

    const fetchWorkspace = async () => {
      setLoading(true)

      // Get user's workspace membership
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (membership) {
        // Get workspace details
        const { data: ws } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', membership.workspace_id)
          .single()

        if (ws) {
          setWorkspace(ws)

          // Get all members
          const { data: mems } = await supabase
            .from('workspace_members')
            .select('*')
            .eq('workspace_id', ws.id)

          setMembers(mems || [])
        }
      }

      setLoading(false)
    }

    fetchWorkspace()
  }, [user])

  // Subscribe to member changes
  useEffect(() => {
    if (!workspace) return

    const channel = supabase
      .channel('workspace_members')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        async () => {
          // Refresh members list
          const { data } = await supabase
            .from('workspace_members')
            .select('*')
            .eq('workspace_id', workspace.id)
          setMembers(data || [])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspace])

  const createWorkspace = async (name: string): Promise<Workspace> => {
    if (!user) throw new Error('Must be logged in')

    // Generate invite code
    const { data: code } = await supabase.rpc('generate_invite_code')

    // Create workspace
    const { data: ws, error: wsError } = await supabase
      .from('workspaces')
      .insert({ name, invite_code: code })
      .select()
      .single()

    if (wsError) throw wsError

    // Add creator as member
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: ws.id,
        user_id: user.id,
        display_name: 'Me',
      })

    if (memberError) throw memberError

    setWorkspace(ws)
    return ws
  }

  const joinWorkspace = async (inviteCode: string, displayName: string) => {
    if (!user) throw new Error('Must be logged in')

    // Find workspace by invite code
    const { data: ws, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (wsError || !ws) throw new Error('Invalid invite code')

    // Join workspace
    const { error: joinError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: ws.id,
        user_id: user.id,
        display_name: displayName,
      })

    if (joinError) throw joinError

    setWorkspace(ws)
  }

  const leaveWorkspace = async () => {
    if (!user || !workspace) return

    await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)

    setWorkspace(null)
    setMembers([])
  }

  return (
    <WorkspaceContext.Provider
      value={{ workspace, members, loading, createWorkspace, joinWorkspace, leaveWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
```

**Step 2: Commit**

```bash
git add frontend/src/contexts/WorkspaceContext.tsx
git commit -m "feat: add WorkspaceContext for collaboration"
```

---

## Phase 2: UI Redesign - Design System

### Task 7: Configure Tailwind for Glassmorphism

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/index.css`

**Step 1: Update Tailwind config**

Replace `frontend/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base backgrounds
        'base': '#0f1419',
        'base-dark': '#0a1a1f',
        // Accent colors
        'accent': {
          DEFAULT: '#14b8a6',
          light: '#2dd4bf',
          dark: '#0d9488',
        },
        'accent-secondary': {
          DEFAULT: '#06b6d4',
          light: '#22d3ee',
          dark: '#0891b2',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'aurora': 'linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(6,182,212,0.1) 50%, rgba(139,92,246,0.05) 100%)',
      },
      backdropBlur: {
        'glass': '20px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 20px rgba(20, 184, 166, 0.3)',
        'glow-lg': '0 0 40px rgba(20, 184, 166, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(20, 184, 166, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(20, 184, 166, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}
```

**Step 2: Update global CSS**

Replace `frontend/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@layer base {
  html {
    font-family: 'Inter', system-ui, sans-serif;
  }

  body {
    @apply bg-base text-white antialiased;
    background: linear-gradient(135deg, #0f1419 0%, #0a1a1f 100%);
    min-height: 100vh;
  }
}

@layer components {
  /* Glass panel effect */
  .glass {
    @apply bg-white/[0.08] backdrop-blur-glass border border-white/10 rounded-2xl;
  }

  .glass-dark {
    @apply bg-black/30 backdrop-blur-glass border border-white/10 rounded-xl;
  }

  .glass-elevated {
    @apply glass shadow-glass;
  }

  /* Glass input */
  .glass-input {
    @apply bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-400
           focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20
           transition-all duration-200;
  }

  /* Buttons */
  .btn-primary {
    @apply bg-accent hover:bg-accent-light text-white font-medium px-6 py-3 rounded-xl
           transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
           focus:outline-none focus:ring-2 focus:ring-accent/50;
  }

  .btn-secondary {
    @apply glass hover:bg-white/[0.12] text-white font-medium px-6 py-3
           transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
           focus:outline-none focus:ring-2 focus:ring-white/20;
  }

  .btn-icon {
    @apply p-3 rounded-full glass hover:bg-white/[0.12] transition-all duration-200
           hover:scale-105 active:scale-95;
  }

  /* Mic button special */
  .btn-mic {
    @apply w-20 h-20 rounded-full bg-accent flex items-center justify-center
           shadow-glow animate-glow-pulse hover:scale-105 active:scale-95
           transition-transform duration-200;
  }

  .btn-mic-recording {
    @apply w-20 h-20 rounded-full bg-rose-500 flex items-center justify-center
           shadow-[0_0_30px_rgba(244,63,94,0.5)] animate-pulse
           hover:scale-105 active:scale-95 transition-transform duration-200;
  }

  /* Cards */
  .card {
    @apply glass-elevated p-5 hover:bg-white/[0.12] transition-all duration-200;
  }

  /* Text styles */
  .text-heading {
    @apply text-white font-semibold tracking-tight;
  }

  .text-body {
    @apply text-slate-300 leading-relaxed;
  }

  .text-muted {
    @apply text-slate-400;
  }
}

@layer utilities {
  /* Aurora background effect */
  .aurora-bg {
    position: relative;
    overflow: hidden;
  }

  .aurora-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 20% 20%, rgba(20, 184, 166, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.05) 0%, transparent 50%);
    animation: aurora 20s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes aurora {
    0%, 100% {
      transform: translate(0, 0) scale(1);
    }
    33% {
      transform: translate(30px, -30px) scale(1.1);
    }
    66% {
      transform: translate(-20px, 20px) scale(0.9);
    }
  }

  /* Hide scrollbar but keep functionality */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

**Step 3: Commit**

```bash
git add frontend/tailwind.config.js frontend/src/index.css
git commit -m "feat: add glassmorphism design system with Tailwind"
```

---

### Task 8: Create Shared UI Components

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Input.tsx`
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/index.ts`

**Step 1: Create Button component**

Create `frontend/src/components/ui/Button.tsx`:

```typescript
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'hover:bg-white/[0.08] text-white px-4 py-2 rounded-xl transition-all',
  icon: 'btn-icon',
}

const sizes = {
  sm: 'text-sm px-4 py-2',
  md: 'text-base px-6 py-3',
  lg: 'text-lg px-8 py-4',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseClasses = variant === 'icon' ? variants.icon : `${variants[variant]} ${sizes[size]}`

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {children}
          </span>
        ) : children}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

**Step 2: Create Input component**

Create `frontend/src/components/ui/Input.tsx`:

```typescript
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`glass-input w-full ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="text-sm text-rose-400">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
```

**Step 3: Create Card component**

Create `frontend/src/components/ui/Card.tsx`:

```typescript
import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'glass p-5',
      elevated: 'glass-elevated p-5',
      interactive: 'card cursor-pointer',
    }

    return (
      <div ref={ref} className={`${variants[variant]} ${className}`} {...props}>
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
```

**Step 4: Create barrel export**

Create `frontend/src/components/ui/index.ts`:

```typescript
export { Button } from './Button'
export { Input } from './Input'
export { Card } from './Card'
```

**Step 5: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat: add glassmorphism UI components"
```

---

### Task 9: Redesign Layout Component

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: Rewrite Layout**

Replace `frontend/src/components/Layout.tsx`:

```typescript
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'

export default function Layout() {
  const location = useLocation()
  const { workspace } = useWorkspace()

  // Hide nav on workspace setup pages
  const showNav = workspace && !location.pathname.startsWith('/setup')

  return (
    <div className="min-h-screen aurora-bg">
      {/* Main content */}
      <main className={`${showNav ? 'pb-24' : ''}`}>
        <Outlet />
      </main>

      {/* Bottom navigation */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 glass border-t border-white/10 px-6 py-4 safe-area-pb">
          <div className="max-w-md mx-auto flex justify-around items-center">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 transition-colors ${
                  isActive ? 'text-accent' : 'text-slate-400 hover:text-white'
                }`
              }
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span className="text-xs font-medium">Capture</span>
            </NavLink>

            <NavLink
              to="/notes"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 transition-colors ${
                  isActive ? 'text-accent' : 'text-slate-400 hover:text-white'
                }`
              }
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-xs font-medium">Notes</span>
            </NavLink>

            <NavLink
              to="/graph"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 transition-colors ${
                  isActive ? 'text-accent' : 'text-slate-400 hover:text-white'
                }`
              }
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span className="text-xs font-medium">Graph</span>
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: redesign Layout with glassmorphism nav"
```

---

### Task 10: Create Voice-First Home Page

**Files:**
- Modify: `frontend/src/pages/Home.tsx`

**Step 1: Rewrite Home page**

Replace `frontend/src/pages/Home.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui'
import type { Note } from '../lib/database.types'

export default function Home() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const [recentNotes, setRecentNotes] = useState<Note[]>([])
  const [isRecording, setIsRecording] = useState(false)

  useEffect(() => {
    if (!workspace) return

    const fetchRecent = async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (data) setRecentNotes(data)
    }

    fetchRecent()

    // Subscribe to new notes
    const channel = supabase
      .channel('recent_notes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => fetchRecent()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspace])

  const handleMicClick = () => {
    setIsRecording(true)
    navigate('/record')
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-heading mb-2">Synapse</h1>
        <p className="text-muted">Capture your thoughts</p>
      </div>

      {/* Big mic button */}
      <button
        onClick={handleMicClick}
        className={isRecording ? 'btn-mic-recording' : 'btn-mic'}
        aria-label="Start recording"
      >
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>

      <p className="text-muted mt-6 mb-12">Tap to capture a thought</p>

      {/* Recent notes */}
      {recentNotes.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="text-sm font-medium text-muted mb-4">Recent</h2>
          <div className="space-y-3">
            {recentNotes.map((note) => (
              <Card
                key={note.id}
                variant="interactive"
                onClick={() => navigate(`/notes/${note.id}`)}
                className="flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{note.title}</h3>
                  <p className="text-sm text-muted truncate">
                    {note.transcript?.slice(0, 60) || note.content?.slice(0, 60) || 'No content'}
                  </p>
                </div>
                <span className="text-xs text-muted whitespace-nowrap">
                  {formatDate(note.created_at)}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Home.tsx
git commit -m "feat: create voice-first Home page with glassmorphism"
```

---

## Phase 2 Continued: More Pages

### Task 11: Create Recording Page

**Files:**
- Create: `frontend/src/pages/Record.tsx`
- Modify: `frontend/src/App.tsx` (add route)

**Step 1: Create Record page**

Create `frontend/src/pages/Record.tsx`:

```typescript
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

export default function Record() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const { user } = useAuth()

  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [saving, setSaving] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Set up audio analyser for waveform
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)

      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1)
      }, 1000)

      // Start waveform animation
      drawWaveform()
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }

  // Draw waveform
  const drawWaveform = () => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      if (!isRecording) return

      animationRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      ctx.fillStyle = 'rgba(15, 20, 25, 0.3)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8

        // Gradient from teal to cyan
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height)
        gradient.addColorStop(0, '#14b8a6')
        gradient.addColorStop(1, '#06b6d4')

        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }
    }

    draw()
  }

  // Cancel recording
  const handleCancel = () => {
    stopRecording()
    navigate('/')
  }

  // Save recording
  const handleSave = async () => {
    if (!audioBlob || !workspace || !user) return

    setSaving(true)
    try {
      // Upload audio to Supabase Storage
      const filename = `${workspace.id}/${user.id}/${Date.now()}.webm`
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filename, audioBlob)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(filename)

      // Create note
      const { data: note, error: noteError } = await supabase
        .from('notes')
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          title: `Note - ${new Date().toLocaleDateString()}`,
          audio_url: publicUrl,
          duration: duration,
          embedding_status: 'pending',
        })
        .select()
        .single()

      if (noteError) throw noteError

      // TODO: Trigger transcription via Edge Function
      // For now, navigate to the note
      navigate(`/notes/${note.id}`)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Start recording on mount
  useEffect(() => {
    startRecording()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-base-dark/95 backdrop-blur-xl flex flex-col items-center justify-center px-6">
      {/* Duration */}
      <div className="text-5xl font-mono font-bold text-white mb-8">
        {formatDuration(duration)}
      </div>

      {/* Waveform */}
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        className="rounded-xl mb-8"
      />

      {/* Transcript preview */}
      {transcript && (
        <div className="glass p-4 max-w-md w-full mb-8 max-h-32 overflow-y-auto">
          <p className="text-slate-300 text-sm">{transcript}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-6">
        <Button variant="ghost" onClick={handleCancel} className="w-14 h-14 rounded-full">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>

        {isRecording ? (
          <button
            onClick={stopRecording}
            className="w-20 h-20 rounded-full bg-rose-500 flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.5)] hover:scale-105 active:scale-95 transition-transform"
          >
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <Button onClick={handleSave} loading={saving} className="px-8">
            Save
          </Button>
        )}

        {!isRecording && audioBlob && (
          <Button variant="ghost" onClick={startRecording} className="w-14 h-14 rounded-full">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Add route to App.tsx**

This will be done in a later task when we update all routes.

**Step 3: Commit**

```bash
git add frontend/src/pages/Record.tsx
git commit -m "feat: create Recording page with waveform visualization"
```

---

## Summary: Remaining Tasks

The plan continues with:

- **Task 12**: Redesign NotesList page
- **Task 13**: Redesign NoteDetail page
- **Task 14**: Create Workspace Setup pages (create/join)
- **Task 15**: Update App.tsx with all routes and providers
- **Task 16**: Redesign GraphView with aurora background
- **Phase 3**: Supabase Edge Functions for AI (transcription, embeddings, image gen)
- **Phase 4**: Real-time collaboration features
- **Phase 5**: Vercel deployment configuration

---

## Verification Checkpoints

After every 3 tasks, verify:

```bash
# TypeScript compiles
cd frontend && npm run typecheck

# Dev server runs
npm run dev

# Visual check in browser
# - Glassmorphism effects working
# - Colors match design system
# - Responsive on mobile viewport
```

---

## Notes for Implementation

1. **Supabase Setup Required**: Before running the app, you need to:
   - Create a Supabase project at supabase.com
   - Run the migration SQL in the Supabase SQL editor
   - Copy the project URL and anon key to `.env`
   - Enable anonymous auth in Authentication settings
   - Create an `audio` storage bucket (public)

2. **Edge Functions**: Transcription/embedding will be added in Phase 3. For now, notes save without AI processing.

3. **Testing**: Test on mobile viewport (375px width) to ensure glassmorphism and touch targets work.
