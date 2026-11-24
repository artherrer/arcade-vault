# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault is an online platform for playing retro games and competing for the highest score. UI copy, code comments, specs and the README are in Spanish.

Built with Spec Driven Design: every feature is a spec in `specs/NN-slug.md`, written with `/spec` and implemented with `/spec-impl` (from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills), installed as user skills). Specs 01–09 are implemented. `specs/.spec-config.yml`: `AutoCreateBranch: true` (`/spec-impl` creates `spec-NN-slug` itself), `AutoCommitSteps: false` (never commit steps automatically).

## Skills

- Usa siempre `/frontend-design` para diseñar la interfaz de usuario (estética CRT/neón).
- `/spec` → `/spec-impl` for any new feature.
- `/spec-juego` (project skill, `.claude/skills/spec-juego/`, user-invoked only): writes the spec to make a catalog game playable and connected to the leaderboard, following SPEC 05 (engine + player) and SPEC 06 (persistence). Its "Invariantes heredadas" section is the authoritative contract for game engines and arenas — read it before touching any game.

## Commands

- `npm run dev` — dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build (also the type check; there is no separate `tsc` script)
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `npm run format` / `npm run format:check` — Prettier (`.prettierrc.json`: semi, double quotes)

No test runner is configured; verify games in the browser (Playwright MCP is available).

## Claude Code config

- `.claude/settings.json` registers a PostToolUse hook on `Write|Edit` → `.claude/hooks/format-and-lint.sh`: runs Prettier on the edited file, then `eslint --fix --max-warnings 0` on JS/TS files. Exit 2 means ESLint errors remain — fix them, don't ignore the hook output.
- `.mcp.json` configures the Supabase MCP server (project ref `smayrjdsljptftvxasxs`). Use it for schema inspection, `apply_migration`, advisors and `generate_typescript_types`.

## Stack and non-default config

- Next.js 16.4 (App Router, `app/`), React 19.3, TypeScript strict, Tailwind CSS v4, Supabase (`@supabase/ssr`, `@supabase/supabase-js`). As AGENTS.md says, this Next.js differs from training data — check `node_modules/next/dist/docs/` (`01-app/` for App Router) before using an API.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, and `experimental.agentFeedback`. With Cache Components on, data fetching follows the `"use cache"` / Suspense model. Anything reading cookies/session calls `await connection()` and must render inside `<Suspense>` (see `lib/auth.ts`, `lib/scores.ts`).
- Middleware is `proxy.ts` (Next 16 name, exports `proxy`): refreshes the Supabase session via `getClaims()` on every request and redirects logged-in users away from `/login`.
- Tailwind v4 is CSS-first: no `tailwind.config.*`; theme tokens live in `@theme inline` in `app/globals.css`. CSS is processed by the `@tailwindcss/turbopack` loader under `turbopack.rules` in `next.config.ts` (not PostCSS). Fonts (Press Start 2P, JetBrains Mono, Courier Prime) load via `next/font` in `app/layout.tsx`.
- Layouts use the global `LayoutProps<"/">` / `PageProps` route-typed helpers (generated types, no import needed).
- Import alias `@/*` maps to the repo root.
- Env vars (`.env.local`, template in `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD`; `RESEND_*` / `CONTACT_*` are reserved for a contact form not yet implemented.

## Architecture

- Routes: `/` (landing), `/games` (library), `/games/[id]` (detail + leaderboard), `/games/[id]/play`, `/hall-of-fame`, `/login`.
- Auth: Supabase email/password. Server Actions in `app/login/actions.ts` (`signIn`, `signUp`, `signOut`); `lib/auth.ts#getCurrentProfile` (cached per request, verifies JWT with `getClaims()`). `lib/supabase/server.ts` is the only Supabase client factory (server-only); there is no browser client.
- Database (`supabase/migrations/`): `profiles` (created by trigger on signup), `games` (connected game ids, inserted only by migration), `scores`, and the `leaderboard` view (best score per player). RLS on every table. After schema changes regenerate `lib/supabase/database.types.ts` and run security advisors.
- Scores: `app/games/actions.ts#saveScore` validates untrusted input (generic bounds + per-game rule) and inserts. `lib/scoring.ts#SCORE_RULES` holds the per-game plausibility rule and defines which games are "connected" (`isConnected`). `lib/scores.ts` reads rankings.
- Catalog: `lib/games.ts#GAMES` lists only real games (no mock games, records or seeded leaderboards). Invariant: every catalog `id` has an `ARENAS` entry, a `SCORE_RULES` key and a `games` row — add a game to the catalog only when all three exist.
- Games: pure TS engine `lib/<id>/engine.ts` (no React, state per instance, `{ setPaused, end, destroy }`) + thin client arena `components/<id>-canvas.tsx` registered in `components/arenas.ts#ARENAS` (contract in `lib/game-types.ts`). `components/game-player.tsx` owns HUD, pause (`P`/`Escape`), game over and auto-save for every game. Playable: `rocas`, `apila` (7 classic pieces), `bloque-buster`, `serpentina`.
- Adding a game = engine + arena + `ARENAS` entry + `SCORE_RULES` entry + migration `connect_<id>` inserting into `public.games` + `GAMES` entry. Use `/spec-juego`.
- The home page (`app/page.tsx`) still uses hardcoded showcase data (activity ticker, top players).

## References

`references/` holds source material, not app code: `started-games/` (original JS games to port without changing physics, balance or scoring), `resources/templates/` (the JSX design mockups the UI was built from) and `resources/snake-assets/`. `demos/` is scratch, not part of the app.
