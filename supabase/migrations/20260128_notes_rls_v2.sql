-- Drop old notes policies (if they exist)
DROP POLICY IF EXISTS "Users can view notes in their workspace" ON notes;
DROP POLICY IF EXISTS "Users can create notes in their workspace" ON notes;
DROP POLICY IF EXISTS "Users can update notes in their workspace" ON notes;
DROP POLICY IF EXISTS "Users can delete notes in their workspace" ON notes;

-- Recreate with EXISTS to avoid recursion
CREATE POLICY "Users can view notes in their workspace"
  ON notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = notes.workspace_id AND workspace_members.user_id = auth.uid()
  ));

CREATE POLICY "Users can create notes in their workspace"
  ON notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = notes.workspace_id AND workspace_members.user_id = auth.uid()
  ));

CREATE POLICY "Users can update notes in their workspace"
  ON notes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = notes.workspace_id AND workspace_members.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete notes in their workspace"
  ON notes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = notes.workspace_id AND workspace_members.user_id = auth.uid()
  ));
