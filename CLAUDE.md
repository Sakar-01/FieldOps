# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

FieldOps is a multi-tenant work-order app (owners/dispatchers on desktop, technicians on phones)
built to the spec in `FieldOps.pdf`. Requirement IDs from that spec (`FR-JOB-05`, `NFR-SEC-02`,
...) are cited in code comments and test names; keep using them. Next 16, React 19, zod 4, the
official `mongodb` driver (no ORM), shadcn/ui (`radix-nova`, imports `cn` from the `cn` package).

## Commands

```bash
npm run dev                 # dev server (needs MongoDB as a replica set, see below)
npm test                    # Vitest unit + integration (starts an in-memory replica set)
npx vitest run tests/integration/jobs.test.ts        # one file
npx vitest run -t "stale version"                    # tests matching a name
npm run test:coverage       # 70% line threshold on lib/services and lib/domain
npm run typecheck           # next typegen && tsc --noEmit
npm run lint                # ESLint (slow on this machine, several minutes)
npm run format:check        # Prettier; `npm run format` to fix
npm run build && npm run test:e2e   # Playwright smoke test against the built app
npm run indexes             # create MongoDB indexes (reads .env)
npm run seed                # replace the demo business (reads .env)
npm run explain             # explain() the main queries on seeded data; fails on a COLLSCAN
```

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, tests and build on every push;
the Playwright step runs on `main` only.

**Windows:** run Vitest from a shell whose cwd is `C:\work\...` with an uppercase drive letter.
From `c:\...` Vitest loads twice and every suite fails with "failed to find the current suite".

**MongoDB must be a replica set** everywhere because job booking uses transactions. Docker
Compose and the tests already do this; a local Windows service needs
`scripts\setup-local-mongo.ps1` run once as Administrator. The Docker app container keeps its own
`node_modules` volume, so after dependency changes: `docker compose up -d --build --renew-anon-volumes`.

`npm run test:e2e` starts its own server via `scripts/e2e-server.ts` (in-memory replica set,
seeded demo, `next start` on port 3100) and uses the installed Chrome locally (no browser download).

## Architecture

**Layering (enforced by convention, spec section 11):** Route Handlers and Server Components
never touch MongoDB. They call `lib/services/*`, which call `lib/db/repositories/*`. Business rules
live in services and in pure `lib/domain/*` (state machine, overlap rules, timezone helpers), so
pages and the API share them. `lib/db/repositories/system.ts` is the one deliberately unscoped
repository, used only by the seed script and the cron job.

**Tenancy:** every collection except `businesses` carries `businessId`, every index starts with
it, and every repository method takes it as the first argument. It always comes from the session
(`AuthContext`), never from a request body. Technicians reach only jobs where `technicianId` is
their own; `loadJob()` in `lib/services/jobs.ts` enforces this (403) and every job operation goes
through it.

**Request flow for an API route:** `route()` wrapper (`lib/http/route.ts`: request ID, JSON log,
`handleError`) → `requireRole(req, roles)` (verifies the JWT _and_ re-loads the user, so
deactivation is immediate) → Zod `parse` (a `ZodError` becomes 400) → `enforceRateLimit` for
writes → service. Services throw `AppError` (`lib/http/errors.ts`); `handleError` maps it to
`{ error: { code, message, details } }`. Pages use `requirePageRole()` from
`lib/auth/current-user.ts` and `orNotFound`/`parseIdOr404` from `lib/http/page.ts`.
`proxy.ts` (Next 16's renamed middleware) only checks the token signature and redirects by role
using `decideAccess()` in `lib/auth/route-access.ts`; it is not the authoritative check.

**Jobs:**

- `lib/domain/job-status.ts` holds the state machine. `POST /api/jobs/:id/status` handles start,
  complete and cancel. `unassigned` ⇄ `scheduled` happens only by setting or clearing
  `technicianId` through `PATCH`, which derives the status with `statusForAssignment()`.
- Booking (create, assign, reschedule) runs inside `withTransaction()`: `usersRepo.claimSchedule`
  increments the technician's `scheduleVersion` first, so concurrent bookings write-conflict and
  the driver retries one, which then sees the overlap (409 `JOB_OVERLAP`). Callbacks passed to
  `withTransaction` may run more than once.
- `PATCH` requires the client's `version` (optimistic lock, 409 `VERSION_CONFLICT`). Status, notes
  and signature updates instead guard on the current status (`updateIfStatus`). Both bump `version`.
- Jobs embed a copy of the address and the customer's name and phone, plus `statusHistory`
  (written in the same update as the status).

**Times:** stored in UTC, always shown in the business timezone (default `Asia/Kolkata`) through
`lib/domain/time.ts`, on both server and client. Forms send UTC ISO strings built with
`zonedToIso()`; list filters take `yyyy-MM-dd` days interpreted in the business zone.

**Uploads:** `lib/storage` is one interface with `local` (dev; `./uploads`, HMAC-signed via
`/api/uploads/local`) and `cloudinary` drivers, chosen by `STORAGE_DRIVER`. The server chooses the
key (`fieldops/<businessId>/<jobId>/<kind>-<hex>`, checked by `KEY_PATTERN`); the browser
compresses (`lib/uploads/client.ts`) and uploads directly to storage; saving metadata re-reads the
file via `storage.describe()` rather than trusting the client.

**Validation:** Zod schemas in `lib/validators` are shared by forms (via `zodResolver`) and
handlers, and are registered in `lib/openapi/registry.ts` for `/api-docs`. An integration test
fails if any `app/api/**/route.ts` path is missing from the OpenAPI document, so new endpoints must
be registered there.

**Demo:** `lib/demo/generate.ts` deterministically builds the demo business (`isDemo: true`,
accounts on `@demo.example.com`). `resetDemo()` in `lib/services/demo.ts` backs `npm run seed`,
the "Try as" login buttons (`POST /api/auth/demo`) and the daily cron (`/api/cron/daily`,
`Authorization: Bearer CRON_SECRET`, scheduled in `vercel.json`).

**Other:**

- The dashboard is a single `$facet` aggregation (`lib/db/repositories/dashboard.ts`).
- The PDF is rendered on request with `@react-pdf/renderer`, which must stay in
  `serverExternalPackages`.
- Swagger UI is bundled from `swagger-ui-dist` because the CSP in `next.config.ts` allows only
  same-origin scripts. Nothing may load from a CDN.
- Cache Components stays off on purpose (all data is per tenant).
- Deploys to Vercel (`vercel.json`, cron included) or Render (`render.yaml`, daily cron via
  `.github/workflows/daily-cron.yml`). `instrumentation.ts` validates the production environment
  at start-up with `checkProductionConfig()` in `lib/env.ts`.

## Tests

Integration tests call real Route Handler exports with `NextRequest`s built by
`tests/helpers/api.ts` (`request`, `createBusiness`, `addMember`, `idContext`,
`sessionCookieFrom`), so they cover auth, validation and error mapping together. All files share
one in-memory replica set (`tests/helpers/global-setup.ts`); create fresh businesses per test
rather than cleaning up. `JWT_SECRET` comes from `vitest.config.mts`. Rate limiting is a no-op
outside production unless the Upstash variables are set (production falls back to an in-memory
limiter); `tests/unit/rate-limit.test.ts` mocks Upstash to test it.

## Conventions

- Design decisions and trade-offs are recorded in the README's "Design decisions" section; add to
  it when making a similar choice.
- Status badges use one fixed colour per status (`components/jobs/status-badge.tsx`) and always
  show the text label. Technician screens keep touch targets at least 44 px (`min-h-11`) and work
  at 360 px wide.
- 409 errors in the UI go through `showApiError()` (`components/shared/show-api-error.ts`), which
  offers "Reload" or a link to the conflicting job.
