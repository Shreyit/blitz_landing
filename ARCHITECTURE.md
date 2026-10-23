# Architecture

BLITZ contains the public sports website, player/volunteer registration, a spectator Auction Dome, an organiser console, and eight team rosters. Supabase mode is implemented, the hosted project exists, and the Next.js website is deployed on Vercel. Hosted database activation and production rehearsal remain pending. The current `/admin` route focuses on the registration pilot: searchable private profiles, photos, filters, and CSV export. Auction controls will be connected in the next phase.

## Supabase mode

```text
Browser: Next.js / React / TypeScript
  ├─ pages, registration form, admin controls, and team rosters
  ├─ GSAP + Lenis + Three.js mascot / SVG fallbacks
  ├─ same-origin /api requests
  │       Next.js route handlers on Vercel
  │         ├─ bounded intake and normalized photo uploads
  │         ├─ Supabase Auth and HttpOnly organiser sessions
  │         └─ permission-checked PostgreSQL RPC calls
  └─ Supabase Realtime notifications → authoritative snapshot read
                ↓
Supabase PostgreSQL
  ├─ private blitz schema: registrations, auction, bids, teams,
  │  assignments, organiser allowlist, audit, outbox, rate limits
  ├─ restricted public RPC functions
  └─ public read-only snapshot: lot + purse + roster, one version
                ↓
Supabase Storage: private normalized JPEGs
Supabase Edge Function: leased email jobs → Resend API → inbox
```

The frontend never determines legal prices or changes purse balances directly. `blitz_auction_command` checks organiser membership, locks the singleton auction row, checks idempotency and version, executes one action, records its audit event, and publishes a coherent snapshot in the same transaction. A sale also assigns the player, deducts the purse, and enqueues email before committing. All those effects roll back together on an unhandled failure.

## Data and access boundaries

The private `blitz` schema is not exposed through the Data API and normal browser roles have no schema access. RLS is enabled on its tables. Public RPC functions are SECURITY DEFINER operations with an empty search path, explicit schema qualification, restricted execution grants, and in-function permission checks.

Supabase Auth identifies organisers. The private `organiser_users` allowlist grants application access; simply having an account grants no auction permissions. Next.js keeps access and refresh tokens in HttpOnly, SameSite=Strict cookies and checks allowed origins for mutations. Production cookies are Secure. Server secrets stay behind `server-only` imports and never use `NEXT_PUBLIC_` names.

The first-admin setup command creates a confirmed Supabase Auth identity and calls a service-only bootstrap RPC. The function serialises setup attempts, checks the matching confirmed identity, permits repeat setup for that organiser, and refuses a different account once an organiser exists. Credentials are entered in a hidden terminal prompt.

Participant registration is complete when the form is saved; no email-verification step or participant Auth account is required. Organiser accounts retain their separate Auth checks. Player and volunteer entries are distinct, allowing one of each per institutional email. Both require demographics, state/UT, prior participation, consent, and a square photo. Players choose sports; volunteers choose one department and give a rationale. All completed player registrations enter the frozen auction queue; volunteers remain outside it. The legacy database column `verified` is retained as an accepted-registration flag, not evidence of mailbox ownership.

The public snapshot includes player name, programme/year, sports, eligible photo URL, bids/leader, team identities/purses/rosters, and recent assignments. It excludes email, verification secrets, demographics, prior participation, and volunteer statements. The auctioneer screen (`/admin/auction`) shows the current player's gender by looking it up in the organiser-only registration list, so gender never enters the public snapshot. Organiser data functions exclude verification hashes/links even in private dashboard responses. CSV export escapes cells that could execute spreadsheet formulas.

## Team branding

Team identities (name, colour, symbol) are database rows, changed by migration or by the idle-phase `teams` command. Logos and owner names are static frontend data in `TEAM_BRANDING` (`src/lib/event.ts`), keyed by team id, with square WebP files in `public/teams/`. They need no database change and are public by design.

The Auction Dome detects a sale on the client by comparing consecutive snapshots: when `sold` increases and the newest history entry is an auction sale of the previous lot's player, it shows a three-second "Sold!" overlay with confetti. The first snapshot after page load only sets the baseline, so reconnecting never replays a celebration.

## Photos

The client crops to a square JPEG; the Next.js route bounds the body, validates actual image content and pixel count, and normalizes to 600 × 600 JPEG without metadata using Sharp. The private bucket accepts JPEG only. Photo requests check accepted player registration or organiser membership before server-credential access to bytes. Volunteer photos remain organiser-only.

A definite registration rejection attempts upload cleanup. An ambiguous network error intentionally leaves the private object because the database might already have committed; deleting then could corrupt a valid registration. Hosted operations should reconcile orphan objects against registrations rather than deleting on uncertain errors.

## Realtime

Every successful mutation rebuilds a single sanitized JSON projection. Spectator reads do not lock the auction or rebuild roster joins. A projection-update trigger sends a version notification through Supabase Realtime.

The public channel is an invalidation channel. Browser code never applies a broadcast payload as state, since public publishers are untrusted. A notification coalesces reads for 50ms and fetches the authoritative projection. The protocol adapter joins, heartbeats, detects dead sockets, reconnects with backoff, and unsubscribes on unmount. A read after joining closes the initial-load race. Monotonic version checks keep old HTTP responses from restoring an earlier purse/roster.

Healthy subscribers stop four-second polling. Disconnects or HTTP failure enable four-second recovery, while a 30-second checkpoint repairs silently missed notifications. These are recovery intervals. The one-second normal-path target requires measured, hosted action-to-render testing with about 100 spectators and the venue network; it is not established by local SQL speed.

## Auction lifecycle

Idle → normal queue → ₹10/+₹5 queue → ₹2/+₹2 queue → ₹1/+₹1 queue → final allocation → complete. Only unsold players move to a later round. The eight ₹2,000 purses carry across rounds. The organiser explicitly sells or marks unsold; no timer silently closes a sale.

Idempotency keys and expected versions protect repeated/stale commands. The current leader cannot bid against itself. Insufficient purse is rejected. Bid cancellation preserves history and is audited. Final allocation shuffles remaining players and team order for each eight-player cycle, costs ₹0, persists once, and cannot be rerolled. Sold-player undo/reassignment is not exposed.

## Mail and shared rate limits

Registration and assignments create unique logical outbox jobs transactionally. A bounded Edge Function claims due jobs with `FOR UPDATE SKIP LOCKED`, a three-minute lease, and a unique attempt token. It calls the provider outside auction transactions, then acknowledges only its own lease. Failures use exponential backoff, capped at one hour, up to eight attempts. A dedicated worker secret protects the function; API keys for the browser do not authorise it.

Delivery is at-least-once. Provider idempotency keys reduce duplicates but cannot establish exactly-once inbox delivery across every crash/provider-retention window. `sent` records provider acceptance. Hosted scheduling uses Vault-backed Cron invocation; no scheduler credentials are committed.

Shared rate-limit counters live in PostgreSQL. Next.js HMACs the purpose and trusted forwarded caller IP before invoking the service-only counter. On a different hosting ingress, configure trusted client-IP forwarding explicitly.

## Frontend motion

GSAP owns DOM choreography, Lenis owns fine-pointer smooth scrolling, and Three.js owns the forest/lime chibi speedster. SVG poses cover reduced motion and unavailable WebGL. Bolt responds to context, high-fives, and four tricks. It stays out of the Auction Dome, and sits below forms on small screens. The homepage tug-of-war is browser-only and never changes official points or auction allocations. The optional Rive adapter uses SVG until an authored asset is supplied.

## Local verification and remaining work

Fourteen versioned SQL migrations define the schema and functions; 010–014 only rename confirmed teams and republish the snapshot. PGlite tests run real PostgreSQL with Supabase platform stubs; adapter/route tests mock network and cookies while exercising actual application handlers. See [verification](VERIFICATION.md), [setup](docs/SUPABASE_SETUP.md), and [SQL lessons](docs/SUPABASE_SQL.md).

Hosted service integration, a real SMTP/provider rehearsal, browser/device checks, and multi-connection/load testing remain pending. Sports fixture/result management and persisted overall standings are separate unfinished features. Existing Python/SQLite data needs an explicit import if any real event data must move to Supabase.

## Explicit FastAPI development option

`NEXT_PUBLIC_BACKEND_PROVIDER=fastapi` retains the existing Python implementation. Next.js forwards HTTP to `API_INTERNAL_URL`; the browser uses `NEXT_PUBLIC_WS_URL`. The Python API owns its SQLAlchemy transactions, local JPEG storage, signed shared-password admin cookie, database-polling sockets, and separate SMTP outbox worker. SQLite remains its local fallback; production concurrency requires PostgreSQL. Supabase mode never silently falls back to these processes.

The mail worker supports the chosen Google Workspace sender through Gmail SMTP on TLS port 465 (`MAIL_PROVIDER=smtp`), with Resend retained as an alternative. Both transports consume the same leased outbox after a dedicated worker-secret check. SMTP uses stable Message-IDs but does not guarantee exactly-once external delivery. [Activation and queue diagnostics](docs/SMTP_SETUP.md) remain a hosted setup step.

Registration and assignment emails now render branded HTML with plain-text alternatives and inline PNG artwork derived from repository SVGs. Sale payloads capture the team and exact price in the sale transaction. An outbox-insert trigger queues a Vault-authenticated pg_net call after commit, and the minute Cron job remains a retry/recovery path. SMTP/inbox latency is separate from the atomic purse and roster update.
