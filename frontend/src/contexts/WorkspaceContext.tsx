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

  useEffect(() => {
    if (!user) {
      setWorkspace(null)
      setMembers([])
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchOrCreateWorkspace = async () => {
      setLoading(true)

      // Try to find existing workspace membership
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (cancelled) return

      if (membership) {
        const { data: ws } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', membership.workspace_id)
          .single()

        if (ws && !cancelled) {
          setWorkspace(ws)

          const { data: mems } = await supabase
            .from('workspace_members')
            .select('*')
            .eq('workspace_id', ws.id)

          if (!cancelled) {
            setMembers(mems || [])
            setLoading(false)
          }
          return
        }
      }

      // No workspace found — auto-create one so the user goes straight to the app.
      // Uses create_workspace_with_member() RPC (SECURITY DEFINER) so the new
      // workspace row is readable in the same transaction before any membership
      // SELECT policy would otherwise block it.
      try {
        const code = `SYNAPSE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        const { data: rows, error: wsError } = await supabase.rpc('create_workspace_with_member', {
          workspace_name: 'My Notes',
          invite_code_param: code,
          display_name_param: 'Me',
        })

        if (wsError || !rows?.length) throw wsError
        const newWs = rows[0] as Workspace

        if (!cancelled) {
          setWorkspace(newWs)
          setMembers([{ workspace_id: newWs.id, user_id: user.id, display_name: 'Me' } as WorkspaceMember])
        }
      } catch (err) {
        console.error('Auto-create workspace failed:', err)
      }

      if (!cancelled) setLoading(false)
    }

    fetchOrCreateWorkspace()
    return () => { cancelled = true }
  }, [user])

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

    const code = `SYNAPSE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    const { data: rows, error: wsError } = await supabase.rpc('create_workspace_with_member', {
      workspace_name: name,
      invite_code_param: code,
      display_name_param: 'Owner',
    })

    if (wsError || !rows?.length) throw wsError
    const ws = rows[0] as Workspace

    setWorkspace(ws)
    return ws
  }

  const joinWorkspace = async (inviteCode: string, displayName: string) => {
    if (!user) throw new Error('Must be logged in')

    // get_workspace_by_invite_code() is SECURITY DEFINER — allows a non-member
    // to look up a workspace before they have joined it.
    const { data: rows, error: wsError } = await supabase
      .rpc('get_workspace_by_invite_code', { invite_code_param: inviteCode })

    if (wsError || !rows?.length) throw new Error('Invalid invite code')
    const ws = rows[0] as Workspace

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

    // leave_workspace() RPC atomically removes the member and deletes the workspace
    // if the caller was the last member, preventing orphaned workspace rows.
    const { error } = await supabase.rpc('leave_workspace', {
      workspace_id_param: workspace.id,
    })
    if (error) throw error

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
