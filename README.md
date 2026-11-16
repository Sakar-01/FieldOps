# FieldOps

Multi-tenant work orders for small field-service businesses (AC repair, plumbing, electrical).
An owner or dispatcher books a job and assigns a technician; the technician runs it from a phone
with photos and the customer's signature; the business downloads a PDF as proof of work; the
owner watches a dashboard. Built with Next.js 16, TypeScript, shadcn/ui and MongoDB. The
requirements are in `FieldOps.pdf`.

**Try it:** open the app and click **Try as Owner** or **Try as Technician** on the login page.
Both use a seeded demo business that resets every night.

<!-- Demo video: add the 2-minute walkthrough link here. -->

| Dashboard                                    | Technician (phone)                               |
| -------------------------------------------- | ------------------------------------------------ |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Technician job](docs/screenshots/tech-job.png) |

More: [jobs list](docs/screenshots/jobs.png), [job detail](docs/screenshots/job-detail.png),
[technician's day](docs/screenshots/tech-today.png),
[dark mode](docs/screenshots/dashboard-dark.png), [API docs](docs/screenshots/api-docs.png).

## Run it locally

You need Node 22+ and MongoDB installed locally (on Windows, the MongoDB service). Transactions
need a replica set, so run the one-time setup script from an **elevated** PowerShell first:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-local-mongo.ps1
```

```bash
cp .env.example .env   # then set JWT_SECRET
npm install
npm run indexes
npm run seed           # optional: the demo business behind the "Try as" buttons
npm run dev
```

Open http://localhost:3000 and create a business, or use the demo buttons.

On Windows, run the tests from a terminal whose path starts with an uppercase `C:\`. If the
folder was opened as `c:\...`, Vitest loads itself twice and every suite fails with "Vitest failed
to find the current suite".

## Deploy

FieldOps deploys to **Vercel**, with three free services alongside it:

| Service                                        | Needed?                    | Why                                                                                 |
| ---------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| [MongoDB Atlas](https://www.mongodb.com/atlas) | Yes                        | The database. Atlas clusters are replica sets, which booking transactions need.     |
| [Cloudinary](https://cloudinary.com)           | Yes, for photos/signatures | Vercel has no lasting disk, so uploads can't be kept on the server.                 |
| [Upstash Redis](https://upstash.com)           | Recommended                | Shared rate limits. Without it the app falls back to per-instance in-memory limits. |

### 1. Database (once)

1. Create an Atlas free cluster, a database user, and under **Network Access** allow
   `0.0.0.0/0` (Vercel has no fixed outbound IPs).
2. Copy the SRV URL with a database name, e.g.
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/fieldops`.
3. Put it in a local `.env.production.local` as `MONGODB_URI=...` (ignored by git), then run
   `npm run setup:prod`. That creates the indexes and the demo business.

### 2. Vercel

1. Import the repository in Vercel. The framework is detected; `vercel.json` sets the install
   command and the daily cron.
2. Add the environment variables from `.env.example`: `MONGODB_URI`, a random `JWT_SECRET`
   (`openssl rand -base64 32`), `STORAGE_DRIVER=cloudinary` and the three `CLOUDINARY_*` values,
   the two `UPSTASH_*` values, a random `CRON_SECRET`, and `APP_URL` (the production URL).
3. Deploy. Vercel calls `/api/cron/daily` at 20:30 UTC (02:00 in India) with the `CRON_SECRET`
   as a bearer token; it resets the demo and deletes orphan uploads.

### Checks on start-up

In production the server checks its configuration when it starts (`instrumentation.ts`). A
missing `MONGODB_URI`, a short `JWT_SECRET` or incomplete Cloudinary keys stop it with a clear
message in the logs; missing Upstash, `CRON_SECRET` or `APP_URL` are logged as warnings.

Finally, protect `main` on GitHub so the CI workflow must pass before merging.

## Scripts

| Command                 | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Start the dev server                                          |
| `npm test`              | Unit and integration tests (in-memory MongoDB replica set)    |
| `npm run test:coverage` | Tests with coverage on services and domain                    |
| `npm run test:e2e`      | Playwright smoke test against the built app (`build` first)   |
| `npm run typecheck`     | Generate route types and run `tsc`                            |
| `npm run lint`          | ESLint                                                        |
| `npm run format`        | Prettier                                                      |
| `npm run indexes`       | Create all MongoDB indexes (reads `.env`)                     |
| `npm run seed`          | Replace the demo business with fresh data (reads `.env`)      |
| `npm run setup:prod`    | Indexes and demo data on production (`.env.production.local`) |
| `npm run explain`       | Print the index each main query uses, from the seeded data    |

API documentation is at `/api-docs` (Swagger UI) and `/api/openapi` (JSON).

## Architecture

```mermaid
flowchart LR
  B["Browser<br/>owner: desktop dashboard<br/>technician: phone view"]
  subgraph V["Vercel: one Next.js app"]
    P["proxy.ts<br/>cookie + role check"]
    R["Pages (RSC)"]
    A["Route Handlers /api"]
    S["lib/services + lib/domain<br/>state machine, overlap, permissions"]
    D["lib/db repositories<br/>every query scoped by businessId"]
    P --> R & A
    R --> S
    A --> S
    S --> D
  end
  B -- HTTPS --> P
  A -- rate limits --> U[("Upstash Redis")]
  D --> M[("MongoDB Atlas")]
  B -- "direct upload,<br/>signed params" --> C[("Cloudinary<br/>photos, signatures")]
```

Every protected request goes: `proxy.ts` checks the cookie, then the handler calls
`requireRole()`, Zod parses the input, writes are rate limited, the service applies the business
rules, and the repository queries MongoDB with the `businessId` from the session. One
`handleError` turns any `AppError` into `{ error: { code, message, details } }`.

## Design decisions

- **Sessions are confirmed against the database.** A JWT lasts 7 days, so `requireRole()` also
  loads the user. Deactivating someone or changing their role takes effect on their next request,
  at the cost of one indexed read per request.
- **`users.email` is unique across all businesses.** Login is by email alone with no business
  picker, so an email has to identify one user. This adds to the spec's per-business index. The
  trade-off is that a person can't use one email at two businesses, and adding an email that's
  already in use elsewhere reveals that it exists.
- **MongoDB runs as a replica set everywhere**, including local development and tests, because booking a job
  uses a transaction and standalone MongoDB doesn't support them.
- **Double-booking is blocked inside a transaction.** Checking for an overlapping job and then
  writing is a race: two dispatchers could each see a free slot and both book it. Every booking
  therefore runs in a MongoDB transaction that first increments `scheduleVersion` on the
  technician's user document, then runs the overlap query, then writes the job. Two concurrent
  bookings for the same technician both write that user document, so one hits a write conflict;
  the driver retries it, and on retry it sees the other job and returns `409 JOB_OVERLAP`. An
  integration test fires three identical bookings at once and expects exactly one `201`.
- **Edits use optimistic locking; status changes guard on status.** `PATCH /api/jobs/:id` must
  send the `version` it loaded and gets `409 VERSION_CONFLICT` if anyone saved since. Status
  changes (`POST /api/jobs/:id/status`) don't take a version, so a technician's phone doesn't need
  a fresh copy; instead the update only matches while the job still has the status it was checked
  against. Status and its history entry are written in one `updateOne`.
- **Assignment drives `unassigned` ⇄ `scheduled`.** Setting or removing the technician through
  `PATCH` moves the status, and the change still goes through the state machine and the history.
  The status endpoint handles start, complete and cancel. A job in progress can't be reassigned.
- **Times are stored in UTC and shown in the business timezone** (default `Asia/Kolkata`),
  whatever the viewer's device says. A job in the form starts and ends on the same day; the
  12-hour limit makes that the normal case. "This week" on the dashboard starts on Monday.
- **"Overdue" is computed, never stored**, so the daily cron has nothing to mark.
- **Uploads never pass through the app in production.** The server picks the storage key
  (`fieldops/<business>/<job>/<kind>-<random>`) and signs it, the browser uploads straight to
  Cloudinary, and saving the metadata re-reads the file from Cloudinary to check its size and
  that the key belongs to that job. Cloudinary has no size cap for signed uploads, so oversize
  files are deleted at that step. Its signatures live for an hour from their timestamp, so the
  timestamp is back-dated to leave the 10-minute window the spec asks for. Locally,
  `STORAGE_DRIVER=local` stores files in `./uploads` through an HMAC-signed route that only
  serves a business its own files.
- **The PDF is rendered on request and never stored.** Photos come from storage as JPEG (Cloudinary
  converts on the fly). Locally, a WebP photo is left out of the PDF because react-pdf can't draw
  WebP; the browser upload keeps JPEG and PNG as they are.
- **The dashboard is one aggregation.** A `$match` narrows to the jobs any card needs (each `$or`
  branch has an index), then one `$facet` computes the cards, the per-technician chart (`$group`
  then `$lookup` users) and the average `$dateDiff` from start to completion.
- **Demo accounts can only be entered with the "Try as" buttons.** The seed gives them a random
  password, they can't change it, and the seeded accounts can't be deactivated or given another
  role, so one visitor can't break the demo for the next. Seeded completed jobs have no photo or
  signature files; their completion is history, not something a visitor repeats.
- **Rate limiting fails open.** Without Upstash variables it is off in development and tests (no
  cloud account needed). In production without Upstash it falls back to an in-memory limiter per
  server instance. On Vercel each instance counts separately, so this is weaker than Upstash, but
  never nothing. If Redis is configured but unreachable, the request is
  allowed and the outage logged, rather than locking everyone out.
- **The server refuses to start with a broken production config.** `instrumentation.ts` checks
  the environment once at start-up, so a missing database URL or Cloudinary key shows up as one
  clear log line on deploy instead of as failing requests later.
- **The Swagger UI is bundled from npm**, not a CDN, because the Content Security Policy only
  allows scripts from the app's own origin.
- **`proxy.ts` rather than `middleware.ts`.** Next 16 renamed the convention. It only checks the
  token signature; handlers and pages make the authoritative decision.
- **Cache Components is off.** Every screen is per-user and tenant-scoped, so a shared cache brings
  little benefit and adds a risk of showing one business's data to another.
- **Customer name search matches whole words**, because it uses a MongoDB text index: "Anita" finds
  "Anita Sharma", but "Ani" doesn't. Phone search matches by prefix. Job search by customer name
  matches any part of the name, within the business's jobs.
- **`field` instead of shadcn's `form` component.** Current shadcn no longer ships `form`; its
  `Field` components with react-hook-form's `Controller` replace it.

## Indexes, checked with explain()

`npm run explain` against the seeded demo business (505 jobs, 40 customers). No query scans a
collection; the script fails if one does. The job indexes add `_id` after `scheduledStart` so
filtered lists read rows in their page order with no in-memory sort.

| Query                       | Plan                                | Index                                              | Keys | Docs | Returned |
| --------------------------- | ----------------------------------- | -------------------------------------------------- | ---- | ---- | -------- |
| Overlap check (FR-JOB-05)   | IXSCAN → FETCH                      | `businessId_status_scheduledStart_-1__id_-1`       | 20   | 18   | 3        |
| Technician's day            | IXSCAN → OR → FETCH → SORT          | `businessId_technicianId_scheduledStart_-1__id_-1` | 5    | 8    | 3        |
| Job list, default order     | IXSCAN → FETCH → LIMIT              | `businessId_scheduledStart_-1__id_-1`              | 21   | 21   | 21       |
| Job list, status filter     | IXSCAN → FETCH → LIMIT              | `businessId_status_scheduledStart_-1__id_-1`       | 21   | 21   | 21       |
| Job list, technician filter | IXSCAN → FETCH → LIMIT              | `businessId_technicianId_scheduledStart_-1__id_-1` | 21   | 21   | 21       |
| Job by number               | IXSCAN → FETCH                      | `businessId_number` (unique)                       | 1    | 1    | 1        |
| Customer's jobs             | IXSCAN → FETCH → LIMIT              | `businessId_customerId_scheduledStart_-1__id_-1`   | 11   | 11   | 11       |
| Customer list               | IXSCAN → FETCH → LIMIT              | `businessId__id_-1`                                | 21   | 21   | 21       |
| Customer name search        | IXSCAN → FETCH → TEXT_MATCH → LIMIT | `businessId_name_text`                             | 4    | 4    | 4        |
| Customer phone search       | IXSCAN → FETCH → SORT               | `businessId_phone` (hinted)                        | 40   | 40   | 21       |
| Dashboard `$match`          | IXSCAN → FETCH → OR → GROUP         | status + scheduledStart, status + completedAt      | 465  | 383  | 1        |

The phone row examines all 40 customers because every demo number shares the searched prefix.

## Testing

- **Unit:** every pair of statuses in the state machine (25 cases), overlap and window rules,
  timezone helpers, Zod schemas, route access, JWT, and the login rate limit (429 on the sixth
  attempt in a minute, against a stand-in for Upstash).
- **Integration** (real Route Handlers, in-memory replica set): auth, tenant isolation, overlap
  and stale-version 409s, concurrent bookings, technician access (403 for another technician's
  job), the full technician flow with real uploads, dashboard numbers, the PDF, demo seed and
  reset, cron auth, password change, and that `/api/openapi` documents every route file.
- **E2E smoke** (Playwright, CI on `main`): the demo owner books and assigns a job; the demo
  technician starts it on a 360 px phone, adds a photo and signature and completes it; the owner
  downloads the PDF.

## Next steps

Out of the MVP's scope:

- Invoices with a parts and services catalog, prices copied onto the job
- Email or WhatsApp reminders to customers the day before
- Calendar view with drag-and-drop dispatch
- Offline queue for technicians (PWA)
- Public job status link for customers
- AI rewrite of technician notes into a customer-friendly summary
- Move storage to S3 by adding an `S3Storage` driver
- Multiple businesses per user, password reset by email
