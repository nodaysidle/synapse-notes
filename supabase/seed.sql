-- Local development seed data.
-- Creates the storage buckets the app expects at runtime. On hosted Supabase
-- these are provisioned via the dashboard; migrations only define their RLS
-- policies (see 20260132_fix_storage_policies.sql), so local stacks need the
-- buckets seeded here for audio uploads / generated images to work.
insert into storage.buckets (id, name, public)
values
  ('audio', 'audio', true),
  ('images', 'images', true)
on conflict (id) do nothing;

-- Local development table grants.
-- Hosted Supabase auto-grants API roles (anon / authenticated) DML on public
-- tables; the local stack does not, so direct client reads/writes (notes,
-- workspaces, etc.) fail with "permission denied" without these grants. RLS
-- policies from the migrations still enforce per-user access on top of them.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
