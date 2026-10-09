# BACHELORS BLITZ LANDING PAGE

![Bachelor’s BLITZ — eight sports, eight teams, one campus. Forest-green and lime sports court with animated lightning and tournament paths.](docs/readme/hero.svg)

An interactive campus sports website for the **Bachelor’s in Analytics and Sustainability Studies programme at TISS Mumbai**, with player and volunteer registration, a live Auction Dome, and an organiser console.

[Experience](#the-experience) · [Setup](#run-locally) · [Architecture](#how-it-connects) · [Workflow](#from-registration-to-team) · [Verification](#check-the-work) · [Deployment](#deployment-plan)

## The experience

| Area | What it does |
| :--- | :--- |
| Landing & spirit | Oversized BLITZ branding, the supplied TISS logo, illustrated sports equipment, and an interactive tug-of-war warm-up. |
| Rules & formats | Eight sport dialogs with animated entrances and glass-blurred backdrops, award points, and a connected knockout bracket. |
| Registration | Separate player and volunteer entries, institutional email selection, demographics, a zoomable India map, and a square photo crop editor. |
| Auction Dome | Public auction snapshots, team purses, current player, bidding history, and saved allocations. |
| Organiser console | Signed admin sessions, registration review, CSV exports, team setup, auction controls, email status, and audit history. |
| Team rosters | Persisted player assignments with team identities and jersey colours. |
| Bolt | A forest-green and lime chibi speedster with a big head, high-fives, page reactions, and four tricks: keep-ups, a lightning lap, a spin, and a flip. |

Touch navigation, safe-area spacing, native mobile scrolling, and reduced-motion fallbacks are implemented. Browser and physical-device verification status is recorded in [VERIFICATION.md](VERIFICATION.md).

### Eight sports. One connected bracket.

| Sport | Winner points | Runner-up points | Award categories |
| :--- | ---: | ---: | :--- |
| Football | 90 | 60 | Team |
| Cricket | 90 | 60 | Team |
| Dodgeball | 90 | 60 | Team |
| Chess | 90 | 60 | Event |
| Tug of war | 45 | 30 | Men and women, separately |
| Badminton | 30 | 20 | Men’s, women’s, and mixed doubles |
| Table tennis | 30 | 20 | Men’s, women’s, and mixed doubles |
| Power lifting | 15 | 10 | Each men’s and women’s weight category |

Power lifting categories: **Under 53, Under 59, Under 66, Under 74, Under 79, and Open**. The API uses `Weightlifting` as its canonical sport name.

The eight-team knockout diagram connects **A1 vs B4**, **A2 vs B3**, **B1 vs A4**, and **B2 vs A3** to four quarterfinal winners. Winners of QF1/QF2 meet in SF1; winners of QF3/QF4 meet in SF2. The two semifinal winners play the final. There is no third-place match or loser bracket. The rules page documents sport-specific formats separately, including Swiss chess.

Rules and award points are currently presentation data; fixture management, result entry, and persisted overall standings still need backend implementation.

## How it connects

![System architecture: the Next.js browser connects to FastAPI through HTTP and WebSocket snapshots. FastAPI writes PostgreSQL and its email outbox; a separate worker delivers messages through SMTP.](docs/readme/architecture.svg)

| Layer | Technology | Responsibility |
| :--- | :--- | :--- |
| Website | Next.js 16 · React 19 · TypeScript | Public pages, registration, organiser controls, and rosters |
| Motion | GSAP · Lenis · Three.js | Scroll choreography, the mascot, and interactive scenes |
| Vector guide | SVG · optional Rive adapter | Fallback artwork and optional authored animation |
| API | Python · FastAPI | Validation, verification, sessions, and authoritative auction commands |
| Persistence | SQLAlchemy · PostgreSQL | Registrations, auction state, purses, assignments, audit events, and email jobs |
| Development database | SQLite | Local development and isolated tests |
| Live updates | WebSocket snapshots · HTTP refresh | Spectator state and reconnect recovery |
| Mail | Persistent outbox worker · SMTP | Confirmation, verification, and team-assignment messages |

The API decides legal bids and purse changes. PostgreSQL row locks serialize auction commands; command IDs make retries idempotent, and stale versions are rejected. Selling a player saves the assignment, deducts the purse, appends an audit event, queues email, and advances the auction in one transaction.

Next.js proxies HTTP requests through `/api/*`. The browser connects directly to the API’s configured WebSocket endpoint. Public snapshots omit email addresses and verification tokens; demographic answers, volunteer rationale, and previous-participation answers stay in organiser views and exports.

## From registration to team

![Participant workflow: choose player or volunteer, complete the form, crop a photo, review and verify email. Verified players enter the auction and receive a team; volunteers choose one department and remain outside the auction.](docs/readme/workflow.svg)

### Participants

1. Choose **Player** or **Volunteer**. You can register for both using separate entries with the same institutional email.
2. Enter your email username and choose `stud.tiss.ac.in` or `tiss.edu`. Pasting a full supported email also works.
3. Complete identity, programme/year, age, gender, state or union territory, and “Have you played Bachelor’s BLITZ before?”
4. Players choose sports. Volunteers choose exactly one department—**Digital & Marketing, Operations, Medical, or Sustainability**—and explain their suitability and contribution.
5. Upload a photo, drag and zoom the **1:1 crop**, then review and consent. Only the confirmed 600 × 600 JPEG is uploaded.
6. Submit and verify your email. Verified players become eligible for the auction; volunteers stay outside its queue.

The India map supports zooming, panning, and all 36 states and union territories, including Andaman and Nicobar. A dropdown remains available if the external map data cannot load.

### Organisers

**Configure teams → review verified players → start the auction → bid → sell or mark unsold → complete rapid rounds → allocate remaining players → review rosters and mail.**

Starting the auction closes registration and freezes its verified-player queue. The organiser explicitly closes each sale; there is no automatic closing timer. The eight team purses start at **₹2,000 each** and carry across all rounds.

| Round | Opening bid | Increment |
| :--- | ---: | :--- |
| Normal | ₹20 | +₹5 up to ₹100, +₹10 up to ₹200, then +₹25 |
| Rapid 1 | ₹10 | +₹5 |
| Rapid 2 | ₹2 | +₹2 |
| Rapid 3 | ₹1 | +₹1 |
| Final allocation | Free | One player per team per shuffled cycle; saved once |

Unsold players move into the next round. A sale deducts the winning amount; teams with insufficient purses cannot bid. Active bids can be cancelled with an audit record. Final random allocation persists its result and cannot be rerolled.

See [WORKFLOW.md](WORKFLOW.md) for rehearsal cases and the development sequence.

## Run locally

Use **Node.js 22.18+**, **Python 3.12**, and [uv](https://docs.astral.sh/uv/). Docker is optional for local PostgreSQL and Mailpit.

### 1. Prepare the project

Run from the repository root:

```bash
npm install
cp .env.example .env.local

uv venv backend/.venv --python 3.12
uv pip install --python backend/.venv/bin/python -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Edit `backend/.env` to set a unique `ADMIN_PASSWORD` and `SESSION_SECRET`. SQLite is the development default. Environment values stay local.

### 2. Start three terminals

**Website**

```bash
npm run dev
```

**API**

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

**Email worker**

```bash
cd backend
.venv/bin/python -m app.worker
```

Open [the website](http://localhost:3000), [the organiser console](http://localhost:3000/admin), or [the API documentation](http://localhost:8000/docs).

### 3. Add PostgreSQL and development mail

From the repository root:

```bash
docker compose up -d db mailpit
```

Set this in `backend/.env`, then restart the API and worker:

```dotenv
DATABASE_URL=postgresql+psycopg://blitz:blitz_local@localhost:5432/blitz
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_STARTTLS=false
```

View development emails in [Mailpit](http://localhost:8025). For real delivery, configure your provider’s SMTP host, port, sender, credentials, and TLS settings. Without a configured SMTP host, the worker skips real delivery.

### Configuration reference

| Variable | Where | Purpose |
| :--- | :--- | :--- |
| `API_INTERNAL_URL` | `.env.local` | HTTP API proxy target; default `http://127.0.0.1:8000` |
| `NEXT_PUBLIC_WS_URL` | `.env.local` | Browser WebSocket endpoint; local `ws://localhost:8000/api/auction/live` |
| `DATABASE_URL` | `backend/.env` | SQLite locally; PostgreSQL for production concurrency |
| `ADMIN_PASSWORD`, `SESSION_SECRET` | `backend/.env` | Admin access and signed sessions |
| `PUBLIC_URL`, `ALLOWED_ORIGINS` | `backend/.env` | Verification-link host and allowed frontend origins |
| `UPLOAD_DIR` | `backend/.env` | Normalized photo storage directory |
| `SMTP_*` | `backend/.env` | Email transport settings |
| `PRODUCTION` | `backend/.env` | Production configuration, including secure cookies |
| `NEXT_PUBLIC_RIVE_SRC` | `.env.local` | Optional authored `.riv` asset |
| `NEXT_PUBLIC_RIVE_STATE_MACHINE` | `.env.local` | State-machine name in that asset |

Full templates: [frontend](.env.example) and [backend](backend/.env.example). Backend deployments must include `shared/registration-options.json` alongside the `backend` directory.

## Check the work

From the repository root:

```bash
npm run typecheck
npm run build
npm run test:mascot
npm run test:registration
```

For browser checks, start the website and run:

```bash
npm run test:e2e
npm run test:mobile
```

Browser tests require Chromium. Set `CHROMIUM_PATH` to override `/usr/bin/chromium`, or `BLITZ_TEST_URL` to use another frontend address. Registration requests are intercepted; test submissions do not create event registrations or send emails.

The mobile suite covers 320, 360, 390, 430, 768, and 1024px widths plus 844 × 390 landscape: navigation, every sport dialog, bracket scrolling, both registration roles, touch cropping, map controls, long labels, and organiser tables.

For API and worker tests:

```bash
cd backend
.venv/bin/python -m pytest
```

Restricted environments that block event-loop socket wakeups can use `BLITZ_SANDBOX_TESTS=1` for the Python suite. See [VERIFICATION.md](VERIFICATION.md) for executed checks and remaining browser, device, PostgreSQL, and SMTP verification.

## Inside the repository

```text
blitz_landing/
├── src/
│   ├── app/                 Public routes, admin console, and responsive styles
│   ├── components/          Registration, sports art, mascot, and live interfaces
│   └── lib/                 Rules, map projection, cropping, and shared UI behavior
├── backend/
│   ├── app/                 FastAPI, auction service, persistence, and mail worker
│   ├── tests/               API, auction, registration, and worker checks
│   └── requirements.txt     Python dependencies
├── shared/                  Registration options shared by frontend and API
├── public/                  Website assets, map notes, and optional Rive artwork
├── img/                     Supplied TISS logo
├── docs/readme/             Animated SVG documentation artwork
├── tests/                   Frontend behavior and browser suites
└── docker-compose.yml       Local PostgreSQL and Mailpit
```

## Deployment plan

The proposed production setup is **Vercel for Next.js**, **AWS EC2 in Mumbai for FastAPI and the email worker**, and **Supabase PostgreSQL in Mumbai**. Infrastructure provisioning and production rehearsal remain to be completed.

The live-auction target is **up to 100 spectators with updates within one second**. The current socket implementation checks database state approximately every second, while the frontend also refreshes over HTTP every four seconds. Meeting the target requires event-driven broadcasting, redundant-polling cleanup, and a load test against the chosen production setup and venue network. Current timing does not establish a one-second end-to-end guarantee.

An EC2 instance can be upgraded before the auction and resized afterward. Plan the required stop/start outside the event and retain a stable API endpoint. Choose the instance size from rehearsal results.

Before opening registration or running the event:

- Configure HTTPS, explicit secrets, PostgreSQL, SMTP, allowed origins, and the final public URL.
- Provide persistent photo storage and database backups. Private object storage integration is still pending.
- Add versioned database migrations before deployed schema changes; startup currently bootstraps the schema and adds nullable intake columns for older records.
- Rehearse concurrent bids, reconnects, stale commands, all auction rounds, allocation, and mail retries.
- Add a shared/ingress rate limiter for multiple API instances; registration currently uses an in-memory limiter.
- Complete device testing and the planned fixture, results, and overall-points backend.

Admin access currently uses a shared organiser password and signed HttpOnly sessions. Named accounts and role-based permissions would be a subsequent backend change.

## Artwork and motion

This README uses local, self-contained **SVG artwork**, with animated court traces, connection paths, and workflow markers. Each SVG includes a static composition, accessible title/description, and a `prefers-reduced-motion` fallback. There are no emoji icons or external image services. Edit [hero.svg](docs/readme/hero.svg), [architecture.svg](docs/readme/architecture.svg), or [workflow.svg](docs/readme/workflow.svg) to adjust the artwork.

Website motion belongs to GSAP/Lenis and the Three.js mascot. SVG poses provide reduced-motion and WebGL fallbacks. The floating mascot stays out of the Auction Dome. The optional Rive adapter uses its SVG fallback until an authored `.riv` file is supplied; see [animation asset notes](public/animations/README.md).

The India boundary data source and licensing are documented in [map asset notes](public/maps/README.md). Technical boundaries and transaction details are in [ARCHITECTURE.md](ARCHITECTURE.md).
