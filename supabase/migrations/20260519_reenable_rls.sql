-- =============================================================================
-- Re-enable Row Level Security with non-recursive policies
-- =============================================================================
-- Context: 20260131_disable_rls.sql and 20260226_disable_rls_clean.sql both
-- disabled RLS as a "temporary" workaround for infinite-recursion errors in
-- policies that subqueried the same table they were protecting.
--
-- Fix: SECURITY DEFINER helper functions break the recursion. These functions
-- execute as the postgres role (bypassing RLS) and are called from within
-- policies safely.
--
-- Additional helpers:
--   create_workspace_with_member() — atomic workspace + first member creation
--   get_workspace_by_invite_code() — lets non-members look up a workspace to join
-- =============================================================================


-- ── Step 1: Drop all existing policies (clean slate) ─────────────────────────

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE tablename IN ('workspaces', 'workspace_members', 'notes')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;


-- ── Step 2: SECURITY DEFINER helpers ─────────────────────────────────────────

-- Returns the workspace IDs the current user belongs to.
-- SECURITY DEFINER + search_path lock ensures RLS is bypassed for the inner
-- query so that policies using this function don't recurse.
CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = auth.uid()
$$;

-- Looks up a workspace by invite code so a non-member can find it before joining.
CREATE OR REPLACE FUNCTION public.get_workspace_by_invite_code(invite_code_param TEXT)
RETURNS TABLE(id UUID, name TEXT, invite_code TEXT, created_at TIMESTAMPTZ)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT w.id, w.name, w.invite_code, w.created_at
  FROM workspaces w
  WHERE w.invite_code = upper(invite_code_param)
$$;

-- Creates a workspace and adds the calling user as a member in one transaction.
-- Needed because INSERT...RETURNING can't see the new row under a strict
-- membership-based SELECT policy before the membership row exists.
CREATE OR REPLACE FUNCTION public.create_workspace_with_member(
  workspace_name     TEXT,
  invite_code_param  TEXT,
  display_name_param TEXT
)
RETURNS TABLE(id UUID, name TEXT, invite_code TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  -- Require an authenticated caller
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO workspaces (name, invite_code)
  VALUES (workspace_name, upper(invite_code_param))
  RETURNING workspaces.id INTO new_id;

  INSERT INTO workspace_members (workspace_id, user_id, display_name)
  VALUES (new_id, auth.uid(), display_name_param);

  RETURN QUERY
    SELECT w.id, w.name, w.invite_code, w.created_at
    FROM workspaces w
    WHERE w.id = new_id;
END;
$$;


-- ── Step 3: Re-enable RLS ─────────────────────────────────────────────────────

ALTER TABLE workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes             ENABLE ROW LEVEL SECURITY;


-- ── Step 4: workspace_members policies ───────────────────────────────────────

-- Users can see all members in any workspace they belong to.
-- Uses get_my_workspace_ids() to avoid self-referential recursion.
CREATE POLICY "workspace_members_select"
  ON workspace_members FOR SELECT
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- Users can only insert their own membership row.
CREATE POLICY "workspace_members_insert"
  ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own membership row.
CREATE POLICY "workspace_members_delete"
  ON workspace_members FOR DELETE
  USING (user_id = auth.uid());


-- ── Step 5: workspaces policies ──────────────────────────────────────────────

-- Any authenticated user may create a workspace.
CREATE POLICY "workspaces_insert"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can see workspaces they are a member of.
CREATE POLICY "workspaces_select"
  ON workspaces FOR SELECT
  USING (id IN (SELECT public.get_my_workspace_ids()));


-- ── Step 6: notes policies ───────────────────────────────────────────────────

CREATE POLICY "notes_select"
  ON notes FOR SELECT
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "notes_insert"
  ON notes FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "notes_update"
  ON notes FOR UPDATE
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "notes_delete"
  ON notes FOR DELETE
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
