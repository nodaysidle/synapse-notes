import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Workspace, WorkspaceMember } from '../lib/database.types'

interface WorkspaceContextType {
  workspace: Workspace | null
  members: WorkspaceMember[]
  loading: boolean
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

  return (
    <WorkspaceContext.Provider
      value={{ workspace, members, loading }}
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
