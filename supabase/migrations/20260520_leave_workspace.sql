-- =============================================================================
-- leave_workspace(): atomic member removal + workspace deletion when last member
-- =============================================================================
-- Without this, leaveWorkspace() in the frontend would need a separate DELETE on
-- workspaces, which (a) requires a broad DELETE policy and (b) is not atomic.
-- Using SECURITY DEFINER ensures the workspace is deleted before the session
-- that owns it signs out, without exposing a general-purpose workspace-delete policy.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.leave_workspace(workspace_id_param UUID)
RETURNS BOOLEAN   -- TRUE if workspace was deleted (caller was the last member)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Count current members BEFORE removing this one
  SELECT count(*) INTO member_count
  FROM workspace_members
  WHERE workspace_id = workspace_id_param;

  -- Remove the calling user
  DELETE FROM workspace_members
  WHERE workspace_id = workspace_id_param
    AND user_id = auth.uid();

  -- If the user was the last member, clean up the workspace too
  IF member_count <= 1 THEN
    DELETE FROM workspaces WHERE id = workspace_id_param;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
