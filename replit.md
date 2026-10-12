# PrimeGoal

PrimeGoal is a responsive football fixtures and scores site with competition standings and match details.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/primegoal/` — responsive React + TypeScript web app
- `lib/api-spec/openapi.yaml` — source of truth for generated app API contracts
- `artifacts/api-server/src/routes/football.ts` and `src/lib/football-data.ts` — football data endpoints and provider adapter

## Architecture decisions

- football-data.org is called only from the API server; configure `FOOTBALL_DATA_API_KEY` as a Replit Secret, never as a browser variable.
- Never show fabricated fixtures, scores, standings, team identities, live states, or streams. Without the provider key, return a clear configuration error; provider failures stay errors.
- Football score data does not imply broadcast rights. Keep match streams unavailable unless a licensed provider adapter supplies an authorized HTTPS embed and viewing URL.

## Product

- Browse fixtures by date, league, status, and team; open match details and competition tables.
- Provider fixtures and match details refresh periodically when live data is configured.

## User preferences

- Use PrimeGoal as the website name throughout; follow the supplied football-score site as a structural reference without reusing its protected branding or assets.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
