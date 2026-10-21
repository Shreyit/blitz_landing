# Verification

## Supabase implementation — 21 October 2026

The new Supabase backend passes the Next.js production build/type checking, 20 PostgreSQL migration/behavior tests, 10 HTTP/realtime/mail adapter tests, and 14 in-process Next.js API route tests. The existing 11 mascot/rules and 11 registration/email/map/crop tests also pass. Run `npm run test:supabase` for the 44 new checks.

Database checks execute all four migrations in real PostgreSQL/PLpgSQL through PGlite. Only the Supabase platform schemas are stubbed: Auth users/identity, Storage bucket metadata, and the Realtime send function. They verify grants/RLS, organiser allowlisting, private intake, role separation, verification, bid thresholds, purse limits, stale and repeated commands, atomic sale rollback, rapid rounds, persisted allocation, rate limits, mail leases/retries, and sanitized notifications. They do not establish concurrent-session behavior on a hosted database.

Adapter tests cover validation, API-key versus user-token headers, error mapping, old-response rejection, subscription handshake/heartbeat/reconnect cleanup, worker authorization, mail idempotency headers, and provider failures. Route tests invoke the real Next.js handlers with an in-memory cookie adapter and mocked upstream HTTP. They test anonymous access rejection, origin checks, named-organiser login/membership, token refresh, bounded/validated input, actual Sharp photo normalization, definite-error upload cleanup versus ambiguous failures, photo authorization/private byte serving, CSV formula protection, and explicit legacy proxy behavior. No registrations are created in a hosted project and no emails are sent.

The production build compiles the `/api/[...path]` route alongside all public pages. An account/project has not yet been created: the user requested local preparation first. Network restrictions prevent package downloads; the pinned PGlite test dependency was recovered from the existing local npm cache. Docker is installed but its daemon socket is inaccessible here, so the complete local Supabase stack and CLI integration were not launched.

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
