# supabase — Supabase backend

## Purpose

Owns edge functions, migrations, and Supabase local/remote integration contracts.

## Ownership

- `functions`
- `migrations`

## Local Contracts

- Never commit secrets or local credentials.
- Treat migrations as persistent data changes; verify carefully before modifying.

## Work Guidance

- Read this file after the root `AGENTS.md` before editing this subtree.
- Prefer extending existing modules/files over creating parallel duplicate systems.
- Update this `AGENTS.md` only when durable ownership, contracts, or verification guidance changes.

## Verification

- Supabase local/function/migration checks appropriate to the changed file.

## Child DOX Index

None.
