# PrismRAG JavaScript/TypeScript migration report

Date: 2026-05-13

## Summary

The repository now uses a **single Bun workspace** at the repository root (`frontend/` + `mcp-server/`), one **`bun.lock`**, **oxlint** + **oxfmt** (Oxc) instead of ESLint, aligned **TypeScript 6** across packages, upgraded **Vite 8** and related tooling, **Husky + lint-staged** pre-commit hooks, and a **GitHub Actions** workflow for CI.

## Major package upgrades

| Area | Before (approx.) | After |
|------|------------------|--------|
| Workspace | Two isolated `bun.lock` files | Root `package.json` + single `bun.lock` |
| Lint / format | ESLint 9 stack (no committed config) | `oxlint@^1.64.0`, `oxfmt@^0.49.0` |
| TypeScript | ~5.9 (frontend), ~5.9 (mcp) | **~6.0.3** (both) |
| Vite | ^7.3.3 | **^8.0.12** |
| @vitejs/plugin-react | ^5.2.0 | **^6.0.1** |
| lucide-react | ^0.563.0 | **^1.14.0** |
| @types/node | ^24.x (frontend) | **^25.7.0** (frontend + mcp) |
| Root tooling | — | `husky@^9.1.7`, `lint-staged@^17.0.4` |

Other dependency ranges were already current or resolved to latest compatible versions by the lockfile.

## Removed / replaced packages

**Removed (frontend `devDependencies`):**

- `eslint`, `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`, `globals`

**Replaced by (root `devDependencies`):**

- **oxlint** — fast linter with `--react-plugin`, `--import-plugin`, `--node-plugin`
- **oxfmt** — formatter; `format` / `format:check` scripts

Prettier was not in use; nothing to remove there.

## Breaking changes handled

1. **TypeScript 6** — `baseUrl` was removed; `paths` for `@/*` are relative to `frontend/tsconfig.app.json` (TS 7–ready). If you still use `baseUrl` elsewhere, `ignoreDeprecations: "6.0"` remains an option per [TypeScript 6 guidance](https://aka.ms/ts6).
2. **Vite 8** — Build verified; Rolldown-related chunk-size hint text changed; no config change required for this app.
3. **lucide-react 1.x** — Major from `0.x`; build and typecheck succeeded (icon imports unchanged for this codebase).
4. **@vitejs/plugin-react 6** — Matched to Vite 8; build verified.
5. **MCP HTTP handler** — Replaced `req as any, res as any` with typed **`Request` / `Response`** from Express; aligned with SDK `handleRequest(req, res, parsedBody)` (Node `IncomingMessage` / `ServerResponse` compatible).
6. **Axios errors** — Centralized **`axiosErrorDetail(unknown)`** with `axios.isAxiosError` narrowing instead of `catch (error: any)`.

## Config and architecture

- **[`package.json`](package.json)** (root): `workspaces`, aggregate scripts (`lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `build`), `lint-staged`, `prepare` → Husky.
- **[`.oxlintrc.json`](.oxlintrc.json)** — shared rules and `ignorePatterns` for `dist` / `node_modules`.
- **[`.oxfmtrc.json`](.oxfmtrc.json)** — shared formatter ignores.
- **[`mcp-server/tsconfig.json`](mcp-server/tsconfig.json)** — stricter: `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
- **[`frontend/tsconfig.app.json`](frontend/tsconfig.app.json)** / **[`frontend/tsconfig.node.json`](frontend/tsconfig.node.json)** — `noImplicitOverride: true`.
- **Scripts** — [`setup.sh`](setup.sh) runs `bun install` at repo root; [`run_fe.sh`](run_fe.sh) installs from root if needed, then `cd frontend && bun dev`.

## Lint rule parity note

Oxlint does not mirror every `typescript-eslint` rule. Type safety remains enforced by **`tsc -b`** / **`tsc --noEmit`**. Oxlint covers correctness, React, imports, and Node patterns at high speed.

## Performance / DX

- **Oxlint / oxfmt** run on ~50 source files in sub-second range on this machine (8 threads).
- **Single lockfile** reduces duplicate installs and simplifies CI caching.
- **CI** uses `bun install --frozen-lockfile` for reproducible installs.

## Validation checklist (post-migration)

| Check | Command |
|--------|---------|
| Install | `bun install` (repo root) |
| Typecheck | `bun run typecheck` |
| Lint | `bun run lint` |
| Format | `bun run format:check` |
| Build | `bun run build` |
| Tests | `bun run test` (Vitest in `frontend/`) |
| E2E | Not present |

## Risks and rollback

| Risk | Mitigation | Rollback |
|------|------------|----------|
| Workspace root install breaks old `cd frontend && bun install` flow | Documented in README + setup.sh | Remove root `package.json`, restore per-package `bun.lock`, revert scripts |
| TS 6 `baseUrl` deprecation | `ignoreDeprecations: "6.0"` | Revert to TypeScript 5.9 and remove flag |
| Vite 8 / lucide 1 subtle runtime regressions | Full `build` + manual smoke of UI | Pin previous versions in `frontend/package.json` and `bun install` |
| Husky blocks commits | Fix lint/format or use `git commit --no-verify` only in emergencies | Delete `.husky/pre-commit` or remove `prepare` script |
| Oxlint false positive | Narrow with `oxlint-disable-next-line` or rule config | Temporarily reintroduce ESLint (not recommended long-term) |

## Recommended next steps

1. ~~Migrate off `baseUrl`~~ — **Done (2026-05-14):** removed `baseUrl`; `@/*` paths stay relative to `frontend/tsconfig.app.json` (TS 7–ready).
2. ~~Add **Vitest** and wire `bun run test` + CI~~ — **Done:** Vitest 4, `src/lib/utils.test.ts`, root `test` script, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
3. ~~Split large Vite bundle~~ — **Done:** `React.lazy` for route pages, `build.rollupOptions.output.codeSplitting.groups` (Rolldown; replaces deprecated `manualChunks`) for react / router / query / motion vendors (workspace chunk may still warrant deeper splits, e.g. markdown / syntax-highlighter).
4. ~~Dependency updates on a schedule~~ — **Done:** [`.github/dependabot.yml`](../.github/dependabot.yml) weekly on `/`; still run **`bun outdated`** locally when triaging upgrades.

**Follow-ups (optional):** add component tests with Testing Library, split `WorkspacePage` dependencies further, add Vitest to `mcp-server`, raise `chunkSizeWarningLimit` only if the warning is accepted noise.
