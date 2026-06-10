# Synapse-Notes — AGENTS.md

## NODAYSIDLE Law

NODAYSIDLE quality bar: 9.7/10. Ship installable, polished apps. Finished beats fancy. Verified beats assumed.

## Repository Map

If `codemap.md` exists in the project root, read it first for architecture, entry points, directory responsibilities, and data-flow context.

If no root `codemap.md` exists, fall back to:
- this `AGENTS.md`
- the closest child `AGENTS.md` files on the path to the target
- `README.md`
- `PRD.md`, `ARD.md`, `TRD.md`, `TASKS.md`, `TODO.md`, and `CHANGELOG.md` when present
- real entry-point files and config files

## DOX Self-Documentation Contract

This repo uses a DOX-style self-documenting `AGENTS.md` hierarchy for Codex and other coding agents.

Before editing:
1. Read this root `AGENTS.md`.
2. Identify the exact files/folders to touch.
3. Walk the nearest `AGENTS.md` chain from root to target folder.
4. Use the closest `AGENTS.md` for local contracts.
5. Parent rules still apply. Child docs may specialize; they may not weaken parent rules or NODAYSIDLE law.

After meaningful edits:
1. Update the closest relevant `AGENTS.md` only if a durable local contract, file responsibility, verification command, or gotcha changed.
2. Update parent `Child DOX Index` sections only when child docs are added, removed, or repointed.
3. Do not write progress logs, task history, diary notes, or one-off implementation receipts into `AGENTS.md`.
4. Keep docs concise, operational, and true to live files.

Create child `AGENTS.md` files only for durable boundaries with distinct ownership, rules, verification, or architecture. Do not document generated folders such as `dist/`, `node_modules/`, `target/`, `.build/`, `artifacts/`, `.git/`, or release outputs.

## Global Rules

- Make the smallest correct change.
- Do not refactor unrelated code.
- Do not add dependencies without explicit approval.
- Do not change release, signing, notarization, deployment, billing, or credential settings unless asked.
- Do not clean the worktree, delete files, rewrite history, force-push, or remove backups without explicit approval.
- Preserve current stack and architecture unless the task explicitly requires changing them.
- If current code conflicts with these rules, report the conflict before editing.

## Stack Lock

- Voice-first notes app with frontend, Supabase functions/migrations, shared types, and docs.
- Preserve existing AI/service integration boundaries; do not move secrets into source or docs.
- Keep generated frontend build output out of architecture docs.

## Safety and Approval Policy

Agents must stop and request explicit NDI approval before any action that can destroy, expose, publish, spend, deploy, or permanently alter project state.

Approval required for:
- deleting files, directories, branches, tags, releases, backups, databases, caches, or generated assets outside normal build output
- force-push, history rewrite, branch deletion, tag deletion, or main-branch merges
- publishing releases, packages, installers, app bundles, websites, docs, or public artifacts
- deployment changes, production config changes, DNS changes, Vercel/Supabase/cloud settings, or webhook changes
- credential, token, signing, notarization, keychain, permission, entitlement, or billing changes
- installing/moving artifacts outside the repo, including `/Applications`, unless the task explicitly includes install/package verification
- dependency upgrades, framework swaps, runtime changes, or generated migration scripts
- destructive cleanup commands such as `rm -rf`, `git clean`, `reset --hard`, database wipes, or cache wipes without named scope

Allowed without extra approval when already within the requested task:
- reading files
- running non-destructive checks
- editing approved instruction files
- running format/lint/test/build commands that do not publish or deploy
- creating repo-local Markdown documentation within the approved scope

If unsure, stop and ask. Do not guess.

## Verification Ladder

Run the lowest sufficient rung for the change. Do not claim completion without recording the command and result.

1. **Read-only audit**
   - `git status --short`
   - Read `codemap.md`, this root `AGENTS.md`, the nearest child `AGENTS.md`, and the target files.
   - Do not modify files.

2. **Unit / fast checks**
   - Frontend typecheck: `cd frontend && npm run typecheck`
   - Supabase/functions/migrations: `UNKNOWN` — no verified root command was found.

3. **Full build / static checks**
   - Frontend build: `cd frontend && npm run build`

4. **Runtime smoke**
   - `UNKNOWN` — no dedicated runtime smoke command was verified in repo metadata.

5. **Package / install**
   - `UNKNOWN` — no verified packaging/install command was found.
   - Installing outside the repo, publishing mobile builds, or changing Supabase deployment state requires explicit NDI approval.

6. **Release gate**
   - Pushing branches is allowed only when requested.
   - Merging to `main`, publishing GitHub Releases, app-store/mobile distribution, Supabase deployment changes, credential changes, and destructive cleanup require explicit NDI approval.

For docs-only `AGENTS.md` changes, verify with:
- `find . -name AGENTS.md -not -path './.git/*' -not -path './node_modules/*' -not -path './src-tauri/target/*' -not -path './target/*' -not -path './.build/*' | sort`
- `git status --short`
- confirm no product source/config files changed unless explicitly intended.

## Prompt Commands

Reusable repo-local agent prompts live in `prompts/`.

- `prompts/repo-orientation.md` — read-only repo onboarding and command discovery.
- `prompts/dox-audit.md` — read-only DOX/AGENTS hierarchy audit.
- `prompts/release-check.md` — read-only release-readiness audit.

Prompt files are instruction templates, not executable scripts. Keep them short, current, and verified against live repo commands.

## Child DOX Index

- `docs/AGENTS.md` — Project documentation.
- `frontend/AGENTS.md` — Frontend application.
- `supabase/AGENTS.md` — Supabase backend.
- `shared/AGENTS.md` — Shared code/types.
- `assets/AGENTS.md` — Assets.

## Existing Project Contract (Preserved from pre-DOX root AGENTS.md)

## Repository Map

A full codemap is available at `codemap.md` in the project root.

Before working on any task, read `codemap.md` to understand:
- Project architecture and entry points
- Directory responsibilities and design patterns
- Data flow and integration points between modules

For deep work on a specific folder, also read that folder's `codemap.md`.
