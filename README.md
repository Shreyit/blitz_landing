# BLITZ

A sports event website and live auction dashboard for the Bachelor’s in Analytics and Sustainability Studies programme at TISS Mumbai.

## Stack

Next.js + React + TypeScript; Lenis smooth scrolling; GSAP scroll choreography; Three.js mascot; a Rive vector-animation adapter. Python/FastAPI owns registration and auction rules. PostgreSQL stores event data; SMTP delivers confirmation, verification, and assignment emails.

## Run locally

```bash
npm install
npm run dev
```

The website runs at http://localhost:3000. Start the API separately:

```bash
uv venv backend/.venv --python 3.12
uv pip install --python backend/.venv/bin/python -r backend/requirements.txt
cp backend/.env.example backend/.env
# Edit backend/.env: choose an admin password and a session secret.
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

For local development, the API defaults to SQLite when DATABASE_URL is absent. Production uses PostgreSQL. The website proxies `/api/*` to the Python server; `API_INTERNAL_URL` defaults to http://127.0.0.1:8000. Without the API, public pages still render and the Auction Dome clearly identifies its read-only preview; registration never pretends to save data.

## PostgreSQL and mail

```bash
docker compose up -d db mailpit
```

Set `DATABASE_URL=postgresql+psycopg://blitz:blitz_local@localhost:5432/blitz`. Mailpit receives development mail at port 1025; view it at http://localhost:8025. Run the persistent email worker:

```bash
cd backend
.venv/bin/python -m app.worker
```

Configure SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_STARTTLS for real delivery. No real email is sent without an SMTP host. Registration emails include a verification link; unverified players cannot enter the auction.

## Verification

```bash
npm run typecheck
npm run build
npm run test:mascot
npm run test:registration
npm run test:e2e
npm run test:mobile
cd backend
.venv/bin/python -m pytest
```

Browser tests require a running website and Chromium (`CHROMIUM_PATH` overrides `/usr/bin/chromium`). They intercept registration submissions so they never create event registrations or send real mail. In restricted environments that block event-loop socket wakeups, use `BLITZ_SANDBOX_TESTS=1` for the Python suite.

The mobile suite uses touch-enabled browser contexts at widths 320, 360, 390, 430, 768, and 1024 pixels, plus 844 × 390 landscape. It covers public-page overflow, navigation, every sport popup, bracket scrolling, player/volunteer registration, touch photo cropping, long auction/team labels, and organiser tables. It stubs the API and map data; it does not require a backend or send emails. Set `BLITZ_TEST_URL` to test a different frontend address. Check iPhone Safari and Android Chrome on actual devices as well, including keyboard entry, rotation, safe areas, scrolling around the map, and photo upload from the camera/library; Chromium emulation does not verify Safari or mobile hardware performance.

## Event configuration

The sports lineup is Football, Cricket, Badminton, Table tennis, Weightlifting, Chess, Tug of war, and Dodgeball. Frontend options live in `src/lib/event.ts`; the backend allowlist lives in `backend/app/config.py`. Basketball and Volleyball are no longer accepted for new registrations. Existing registrations are preserved. Eight working team identities are configurable in the organiser dashboard before the auction. Dates, venue, and the supplied preamble are intentionally not fabricated; the displayed preamble is clearly marked as a working draft.

Players and volunteers submit separate registrations and may use the same email for both roles. Both forms require age (whole years, 1–120), gender (male/female/others), and an Indian state or union territory. Players select sports; volunteers choose exactly one of Digital & Marketing, Operations, Medical, or Sustainability and provide a suitability/contribution statement of up to 2,000 characters. These new details appear only in organiser views and CSV exports. Existing database rows receive nullable intake columns at startup, preserving previous data; new submissions must complete them. The backend deployment must include `shared/registration-options.json` alongside the `backend` directory.

The India selector loads GeoJSON boundaries from Vardhan Maps, with OpenStreetMap attribution; its dropdown remains available if the map cannot load. See `public/maps/README.md` for source and licensing. Run `npm run test:registration` for email, shared-option, and map projection checks.

Both registration roles also answer “Have you played Bachelor’s BLITZ before?” with an explicit Yes or No. The answer is private to organisers and included in their CSV export; older registrations keep an unknown/null answer. Selecting a photo opens a local square crop editor with drag, zoom, reset, cancel, and recropping from the original. Only the confirmed 600 × 600 JPEG is uploaded, and the backend normalizes photos to the same square dimensions without changing the selected framing. Existing stored photos are preserved.

Auction rules: normal ₹20 / +5 to ₹100 / +10 to ₹200 / +25 thereafter; rapid-fire rounds ₹10/+5, ₹2/+2, ₹1/+1. Each team has ₹2,000 across all rounds. The organiser explicitly closes a sale. Final random allocation is free, one player per team per shuffled cycle, and can happen only once.

## Animation assets

Bolt is an original jointed Three.js athlete wearing a backwards adjustable cap, lightning jersey, gloves, and Nike-swoosh sneakers, with a black-and-white football. It follows the pointer, jogs while scrolling, guides registration, celebrates submissions and team rosters, and looks away while password fields have focus. Click for a high-five or request football keep-ups. Eight inline vector sports grounds change by route, sports-card hover/keyboard focus, selected registration sport, or the scene-switch control. The floating companion has no backdrop and appears on every page except the Auction Dome; it tucks away while a larger inline Bolt is visible and can be minimised. Reduced motion and unavailable WebGL use the matching SVG character with static poses. The football card and SVG mascot share a shaded, clipped-panel ball illustration with unique gradient identifiers.

The homepage tug-of-war uses six versions of the same Bolt with only their shirts changing to distinguish squads. Pick any two distinct team identities, pull either side, and replay after a win. Equal-strength explicit pulls move the rope; there are no automatic advantages. This browser-only warm-up never changes official scores, auction purses, or player allocation.

The Rive adapter loads the official web runtime only where needed and accepts `NEXT_PUBLIC_RIVE_SRC` plus `NEXT_PUBLIC_RIVE_STATE_MACHINE`. Until a custom `.riv` export is provided, the vector guide uses its local SVG fallback; a runtime package alone does not create Rive artwork. See [architecture](ARCHITECTURE.md) and [workflow](WORKFLOW.md) for ownership and asset details. Mascot behavior tests use Node 22.18+ native TypeScript stripping.

## Before a public event

Set unique secrets, PostgreSQL, SMTP, the public website URL, persistent upload storage, HTTPS, backups, and the final event copy. Run an auction rehearsal. The initial schema is bootstrapped on startup; introduce versioned migrations before changing a deployed database schema. Registration has an in-memory rate limiter; use an ingress/shared limiter for a public multi-instance deployment. Local upload storage requires a persistent volume or replacement with private object storage.

## Sources

For executed checks and environment limits, see [verification](VERIFICATION.md).

- [Lenis integration](https://github.com/darkroomengineering/lenis)
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [Three.js installation](https://threejs.org/manual/pages/installation.html)
- [Rive web runtime](https://rive.app/docs/runtimes/web/web-js)
- [Frontend design guidance](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)

No campus photographs, student identities, or official institutional marks are invented. All illustrations are repository-owned SVG or Three.js geometry. Preview auction entries are clearly labelled fictitious.
