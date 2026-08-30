# frontend — Frontend application

## Purpose

Owns client app source, package configuration, UI, routing, and frontend build/test contracts.

## Ownership

- `android`
- `capacitor.config.ts`
- `codemap.md`
- `index.html`
- `package-lock.json`
- `package.json`
- `postcss.config.js`
- `src`
- `tailwind.config.js`
- `tsconfig.json`
- `vercel.json`
- `vite.config.ts`

## Local Contracts

- Preserve the current frontend stack and component architecture.
- Keep UI polished, accessible, and dark-mode friendly where applicable.
- Do not introduce new frameworks without approval.
- Android Capacitor only for mobile chrome fixes in this tree: hardware/gesture Back is handled by `src/hooks/useAndroidBackButton.ts` (exit only from Home). Bottom tab `NavLink`s use `replace` so tab switches do not stack a back trap.
- Non-Home screens that use `.home-void` / `.screen-shell` must stay single-column on phone widths (overflow-x contained; no sideways pan that can clip fixed `.bottom-nav`). Do not restyle Home when fixing other screens.

## Work Guidance

- Read this file after the root `AGENTS.md` before editing this subtree.
- Prefer extending existing modules/files over creating parallel duplicate systems.
- Update this `AGENTS.md` only when durable ownership, contracts, or verification guidance changes.

## Verification

- Frontend/build check from root package manifest when behavior changes.

## Child DOX Index

None.
