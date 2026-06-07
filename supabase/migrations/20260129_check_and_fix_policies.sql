-- First, drop ALL policies on workspace_members to start fresh
DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can view own membership" ON workspace_members;
DROP POLICY IF EXISTS "Users can join workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Users can insert own membership" ON workspace_members;

-- Create simple non-recursive policies
-- SELECT: users can only see their own membership rows
CREATE POLICY "workspace_members_select" ON workspace_members
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: users can only insert their own membership
CREATE POLICY "workspace_members_insert" ON workspace_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- DELETE: users can only delete their own membership  
CREATE POLICY "workspace_members_delete" ON workspace_members
  FOR DELETE USING (user_id = auth.uid());
