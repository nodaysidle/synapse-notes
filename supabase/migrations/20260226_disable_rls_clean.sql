-- Drop ALL existing policies to eliminate infinite recursion
-- Then disable RLS for all tables (personal app with anonymous auth)

-- Drop all policies on workspace_members
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'workspace_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON workspace_members', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on workspaces
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'workspaces'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON workspaces', pol.policyname);
    END LOOP;
END $$;

-- Drop all policies on notes
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'notes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON notes', pol.policyname);
    END LOOP;
END $$;

-- Disable RLS on all tables
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes DISABLE ROW LEVEL SECURITY;
