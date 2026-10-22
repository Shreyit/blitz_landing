# Verification

## Auction Dome, team branding and site updates — 23 October 2026

Changes: maintainer contact pill in the footer (Bolt reacts on hover), redrawn tug-of-war sport icon, BLITZ header logo, square auction photos, three confirmed teams with logos and owners (migrations 010–012), redesigned team cards with a squad popup and two cards per row on phones, and the new Auction Dome with the auctioneer screen at `/admin/auction`.

Executed checks: TypeScript (`npm run typecheck`) passes. `npm run test:mascot` (11), `npm run test:registration` (11) and `npm run test:supabase` (31 + 17 + 15 + 6 + 1) pass. A headless-Chromium script against the dev server, with mocked API responses, ran the auctioneer flow at 1440px and 390px: three bids stepped ₹20 → ₹25 → ₹30, the panel showed the leader and next bid ₹35, **Sold** showed the celebration, the overlay cleared after about three seconds, and the next player loaded with course, ordinal year and organiser-only gender. No page errors or horizontal overflow occurred. The team-card squad popup was checked for open, Escape and backdrop-click close. Team cards and the sold overlay were visually inspected from screenshots.

Not yet run: the browser suites `npm run test:e2e` and `npm run test:mobile` (they expect Chromium at `/usr/bin/chromium` or `CHROMIUM_PATH`); their auction and team-card selectors were updated to `.dome-kpi` and `.team-squad-button`. The backend pytest suite was not run (pytest is not installed in this environment). Migrations 010–012 have not been applied to the hosted database; until they are, the hosted site shows the old placeholder names.

## Hosted status — 22 October 2026

The user confirmed successful hosted organiser login, application of migrations through 009, and deployment of the updated `deliver-mail` function. Their final cleanup command reported removal of 30 dummy bids, one assignment, one registration, one uploaded photo and two related email records. Team purses returned to ₹2,000 and registration reopened. The retained auction singleton is idle with empty queues; it is required application state. These results were reported from the user's terminal and dashboard, rather than independently queried from this environment.

An earlier mail invocation reported one provider acceptance and zero retries. Actual receipt of the new HTML emails, Vault/Cron activation, physical-device checks and auction latency with 100 spectators remain unverified. The dated implementation notes below describe verification at each earlier stage; their pending hosted cleanup steps have since been completed as reported above.

## Hosted safe-update correction — 22 October 2026

The user's hosted reset failed with “DELETE requires a WHERE clause.” The function call rolled back before profile or photo deletion began. The original reset omitted filters on bid/assignment deletion and purse restoration; PGlite did not reproduce Supabase's native safeupdate extension. Forward migration 009 replaces the reset function with exact pilot-ID filters and a changed-purse predicate. Hosted protection remains enabled. The existing real SQL reset behavior tests execute the replacement, and an additional contract check inspects the installed function for WHERE clauses on each mutation. This contract check does not claim to run the native extension. The full Supabase suite contains 85 checks after this addition. The user still needs to apply migration 009 and rerun cleanup before hosted deletion can be confirmed.


## Started dummy auction reset — 22 October 2026

The user's hosted cleanup stopped before deleting anything because the auction had started. After the user confirmed all auction activity was dummy, migration 008 and the explicit `--all --reset-auction` command were added. The SQL checks a complete participant snapshot and expected version, refuses active mail leases, clears dummy bids/sales/assignments, restores purses, reopens intake and republishes state at a higher version. Team identities, organiser access and mail configuration are preserved. Two additional SQL checks exercise a completed sale reset and stale-version/participant/mail-lease refusal; an additional helper check verifies explicit reset inspection. The Supabase suite passes 84 checks (30 SQL, 17 adapters, 15 routes, 6 admin setup, 1 mail setup, 7 templates and 8 cleanup). Hosted reset/deletion still require the user's terminal; neither has been performed from this environment.


## Dummy registration cleanup — 22 October 2026

The user authorised deletion of the current dummy registrations and their uploaded photos. This environment still cannot reach Supabase (`EAI_AGAIN`) and no connected Supabase tools are exposed, so no hosted deletion has been performed here. A terminal command and migration 007 prepare the operation for the user's working network connection. Applying the migration only installs service-only cleanup functions; the separate command performs exact-ID deletion and Storage API removal. It preserves teams, purses, organiser identity and configuration, refuses active auction/mail work, and resumes interrupted photo cleanup from a private manifest without expanding its scope. The added tests run locally and use platform/HTTP stubs; they do not establish successful hosted deletion. [Instructions](docs/PILOT_CLEANUP.md).


## Confirmation receipts and sale announcements — 22 October 2026

Registration now completes on submit, with no participant email-verification step. Migration 006 backfills existing registrations, clears obsolete hashes/expiries, upgrades only queued receipts, and records structured team/price/sport details for sale notifications. A new trigger requests the mail worker after commit through pg_net/Vault, with scheduled recovery retained. Mail wake-up failure is isolated from registration and sale transactions.

The Supabase suite now has 72 checks: 26 SQL/PGlite, 17 adapters, 15 routes, 6 admin setup, 1 mail setup, and 7 email template/delivery checks. Added checks cover the real migration backfill, no-token intake, correct sale payload, duplicate-sale protection, wake-up rollback, failure isolation, all eight sports in the receipt, volunteer versus player content, allocation wording, escaped HTML, inline PNG assets, SMTP MIME fields, and Resend CID attachments. SVG artwork was visually inspected after rasterisation. Standalone HTML previews are provided; Gmail/browser rendering remains to be checked on the deployed worker.

The user reported an earlier SMTP invocation with one message accepted and zero retries. This confirms acceptance of that older text email, not inbox delivery or the new HTML worker. Hosted migration 006, redeployment, Vault/Cron activation, and receipt/sale inbox tests remain required. No student messages or auction actions were sent by these local tests.


## Registration admin phase — 22 October 2026

The production build and TypeScript checks pass with the focused `/admin` registration dashboard. `npm run test:supabase` now includes 22 PostgreSQL/PGlite checks, 17 adapter checks, 15 API-route checks, 6 admin-provisioning checks, and 1 mail-setup check (61 total). The added cases cover confirmed first-admin creation, service-only bootstrap grants, repeat setup, refusal to replace an existing organiser, all submitted profile fields, and organiser access to pending registration photos. Provisioning HTTP is mocked; no hosted account or registration is created by these tests.

The dashboard gates private fetches behind organiser authentication, unmounts private profiles after sign-out or authorisation expiry, provides search/role/verification filters and CSV, and opens a keyboard-accessible photo/profile dialog. Mobile test coverage has been updated for cards and profile dialogs. Browser execution remains subject to the Chromium restrictions described below.

The Supabase project exists and the public website is deployed. This environment's hosted connection check fails with `EAI_AGAIN`. The user subsequently reported successful hosted admin setup; browser login then exposed an origin-configuration mismatch. The origin regression check now covers the canonical website alongside an explicit local/preview list and URL trailing slashes, while rejecting unrelated origins. End-to-end hosted login remains unverified here. Follow [Registration and admin pilot](docs/REGISTRATION_PILOT.md) to apply migrations and run the hidden-password setup command. Email worker/provider activation remains separate. No auction controls are exposed in the new registration dashboard, and no test records have been deleted.

The SMTP follow-up adds a Gmail/Workspace transport using TLS port 465, authenticated queue consumption, retry handling, stable Message-IDs, and private setup files. At the user’s explicit request, the provided app password was saved only in the ignored local SMTP settings file with mode 600. It was not written into tracked source or printed. Tests use an injected SMTP transport. The generated settings and activation SQL are ignored by Git and mode 600. Hosted SMTP/Cron activation and inbox delivery are still pending; the environment cannot reach Supabase and has no Deno CLI to validate the actual Edge bundle. See [SMTP setup](docs/SMTP_SETUP.md).

## Supabase implementation — 21 October 2026

The new Supabase backend passes the Next.js production build/type checking, 20 PostgreSQL migration/behavior tests, 10 HTTP/realtime/mail adapter tests, and 14 in-process Next.js API route tests. The existing 11 mascot/rules and 11 registration/email/map/crop tests also pass. Run `npm run test:supabase` for the 44 new checks.

Database checks execute all four migrations in real PostgreSQL/PLpgSQL through PGlite. Only the Supabase platform schemas are stubbed: Auth users/identity, Storage bucket metadata, and the Realtime send function. They verify grants/RLS, organiser allowlisting, private intake, role separation, verification, bid thresholds, purse limits, stale and repeated commands, atomic sale rollback, rapid rounds, persisted allocation, rate limits, mail leases/retries, and sanitized notifications. They do not establish concurrent-session behavior on a hosted database.

Adapter tests cover validation, API-key versus user-token headers, error mapping, old-response rejection, subscription handshake/heartbeat/reconnect cleanup, worker authorization, mail idempotency headers, and provider failures. Route tests invoke the real Next.js handlers with an in-memory cookie adapter and mocked upstream HTTP. They test anonymous access rejection, origin checks, named-organiser login/membership, token refresh, bounded/validated input, actual Sharp photo normalization, definite-error upload cleanup versus ambiguous failures, photo authorization/private byte serving, CSV formula protection, and explicit legacy proxy behavior. No registrations are created in a hosted project and no emails are sent.

The production build compiles the `/api/[...path]` route alongside all public pages. At that stage, the work was prepared locally; the hosted project was created subsequently. Network restrictions prevent package downloads; the pinned PGlite test dependency was recovered from the existing local npm cache. Docker is installed but its daemon socket is inaccessible here, so the complete local Supabase stack and CLI integration were not launched.

Hosted Auth/Storage/Realtime integration, actual email delivery/Cron invocation, browser cookies, physical devices, networked PostgreSQL contention, and action-to-screen latency with 100 spectators remain unverified. No one-second guarantee is claimed. The browser uses notification-triggered reads, four-second disconnected/error recovery, a 30-second checkpoint, and monotonic auction versions. Match fixtures/results/overall standings remain unimplemented. The older FastAPI verification below is retained as historical context.

## Earlier frontend and FastAPI checks

The current implementation passes the Next.js production build (including TypeScript checking), 11 mascot/rules behavior tests, and 11 registration/email/map/crop tests. The latest backend verification from the registration update passed 83 Python tests against an isolated SQLite database; the mobile update changes no backend code.

The mobile update adds tablet navigation, 44px touch controls, 16px text inputs, safe-area spacing, narrower registration/review/roster layouts, landscape crop sizing, native touch scrolling, and a lower WebGL pixel-density limit for touch devices. On registration and organiser screens up to 1024px wide, the companion sits below the page instead of overlaying form actions.

`npm run test:mobile` supplies 12 touch-enabled Chromium checks spanning 320, 360, 390, 430, 768, and 1024px widths, plus 844 × 390 landscape. These check all public routes and the missing-page view, navigation dismissal, every sport dialog, bracket scrolling, both registration flows, actual touch crop dragging, map zoom/panning, long team/player names, and organiser tables. API and map requests are mocked; submissions never create registrations or send email. The suite was attempted here, but Chromium failed in its launch hook with `setsockopt: Operation not permitted` and SIGTRAP before any page checks ran. Its syntax check passes. Browser layout, iPhone Safari, Android Chrome, keyboard behavior, and device performance remain unverified in this environment.

The mascot revamp passes eight deterministic behavior tests: Auction Dome exclusion, registration state priorities, volunteer-specific guidance, password-field classification, exact eight-sport frontend/scene parity, scene-cycle coverage, equal opposing tug pulls, and both winning directions with result locking. The backend suite now explicitly accepts each of the eight requested sports and rejects removed Basketball/Volleyball entries. Existing registration data is not rewritten.

The backwards cap, swoosh sneakers, revised shaded football, and six differently shirted tug athletes were visually inspected using rasterised versions of the generated SVGs. This checks vector artwork, not browser layout or WebGL rendering. Production HTML checks confirm six tug athletes on the homepage, unique SVG identifiers, inline sports backdrops, transparent floating mascots on seven non-auction routes, and mascot exclusion from the Auction Dome.

Browser tests include football tricks, scene switching, minimise/restore, page coverage, password privacy, tug pulls/rematch/team colours, mobile overflow, and the eight registration choices. They remain unexecuted under the environment’s browser restrictions.

The Python suite covers bid thresholds, exact purse limits, stale and repeated commands, audited bid cancellation, every rapid-fire transition, saved random distribution for 1/7/8/9/19 players, volunteer exclusion, public email privacy, institutional domain validation, normalized image uploads, email verification and expiry, admin sessions, team configuration, CSV formula protection, and SMTP retry state.

Environment restrictions prevented binding local server ports, launching Chromium, starting Docker PostgreSQL/Mailpit, and fetching packages from the network. Dependencies were recovered from local caches. Python HTTP tests used an in-process ASGI client, with a test-only periodic event-loop wakeup (`BLITZ_SANDBOX_TESTS=1`). No production code bypasses the environment restrictions.

Browser tests are supplied in `tests/e2e.test.mjs` for a normal local environment. They have not been executed here. Live PostgreSQL concurrency, actual SMTP delivery, responsive visual rendering, and a supplied Rive binary still require verification before a public event. The Rive adapter is implemented; the site currently uses its SVG fallback because no authored `.riv` asset is available.
