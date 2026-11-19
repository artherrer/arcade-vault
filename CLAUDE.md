# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault is an online platform for playing games and competing for the highest score. It is currently a fresh `create-next-app` scaffold (only `app/layout.tsx`, `app/page.tsx`, `app/globals.css`); the product is to be built with Spec Driven Design using the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (`npx skills@latest add Klerith/fernando-skills`). Follow that spec → implement workflow for new features. The README is written in Spanish.

## Commands

- `npm run dev` — dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build (also the type check; there is no separate `tsc` script)
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

No test runner is configured yet.

## Stack and non-default config

- Next.js 16.4 (App Router, `app/`), React 19.3, TypeScript strict, Tailwind CSS v4. As AGENTS.md says, this Next.js differs from training data — check `node_modules/next/dist/docs/` (`01-app/` for App Router) before using an API.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, and `experimental.agentFeedback`. With Cache Components on, data fetching/caching follows the `"use cache"` / Suspense model rather than older route-segment config — read the docs before writing data-loading code.
- Tailwind v4 is CSS-first: no `tailwind.config.*`; theme tokens live in `@theme inline` in `app/globals.css`. CSS is processed by the `@tailwindcss/turbopack` loader configured under `turbopack.rules` in `next.config.ts` (not PostCSS).
- Layouts use the global `LayoutProps<"/">` / `PageProps` route-typed helpers (generated types, no import needed).
- Import alias `@/*` maps to the repo root.
