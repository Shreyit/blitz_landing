# Architecture

## Product and visual system

BLITZ has a public event site, verified player/volunteer registration, a spectator Auction Dome, an authenticated organiser console, and eight team rosters.

Design tokens: paper #F7F8F2, ink #202820, court green #315A36, lime #D9F46B, clay court #E68B61, muted #6B7468. Display typography uses a heavy condensed system stack; body typography uses a clean system sans. The main visual is an oversized BLITZ wordmark and an illustrated sports court with an original lightning athlete. Quiet form layouts and scoreboard tables support that one memorable visual. Layouts are left-aligned, with a two-column desktop hero and one-column mobile flow. Borders represent actual separations; team colour represents team identity.

```text
Browser: Next.js / TypeScript
  ├─ Lenis → GSAP ticker → ScrollTrigger
  ├─ Three.js → procedural mascot / SVG fallback
  ├─ Rive adapter → supplied .riv / SVG fallback
  └─ same-origin /api proxy
            ↓
Python FastAPI ─── WebSocket snapshots
  ├─ registration + photo validation + verification
  ├─ signed HttpOnly admin sessions
  ├─ server-authoritative auction service
  └─ SQLAlchemy transactions
            ↓
PostgreSQL: registrations, teams, auction, bids,
assignments, audit events, email outbox
            ↓
Persistent worker → SMTP → institutional inbox
```

## Boundaries

The frontend never determines a legal bid or writes a purse. Python calculates bids from persisted state. PostgreSQL row locks serialize every auction command; request IDs make repeated commands idempotent. Mutation responses contain the full authoritative snapshot. Public snapshots exclude email addresses and verification tokens. Admin-only registration views include email.

The API is the only database writer. Next.js proxies HTTP API calls; live WebSocket connections use NEXT_PUBLIC_WS_URL or the local API host. Snapshot polling is a fallback. The socket reads persisted state so reconnecting and multiple API workers do not depend on an in-memory auction broadcaster.

## Data

- Registration: UUID, role, name, institutional email, programme, year, sports, photo identifier, verified timestamp, hashed verification token, token expiry.
- Team: stable ID, name, colour, opening purse and remaining purse.
- Auction: singleton row, phase, round, frozen queue, cursor, current bid, leading team, version.
- Bid: player, team, amount, round, command ID, timestamp.
- Assignment: one unique player, team, price, auction/random source.
- Audit event: immutable command ID, action, actor, details and timestamp.
- Email job: unique logical key, recipient, content, retry count, delivery state, next attempt and lease expiry.

Sports use a validated configuration list. Amounts are integer rupees. Registration closes when the auction starts. Volunteers are never queued. A registration can have one entry per email per role.

## Auction lifecycle

Idle → normal queue → ₹10 queue → ₹2 queue → ₹1 queue → awaiting allocation → complete. At each round boundary the next queue contains only the previous round’s unsold players. A current lot has no bid until a team explicitly bids the round’s opening amount. Sale atomically creates an assignment, subtracts the purse, records an audit event, queues an email, and advances the lot. Unsold can advance only a lot without an active bid. Admins can cancel the current lot’s bids with an audit record before marking it unsold.

Final allocation uses a cryptographically strong shuffle of players and a new team permutation per cycle. Persisted assignments are free. The locked auction row prevents rerolls or parallel allocation.

## Motion ownership

Lenis owns scrolling, GSAP owns DOM animation, Three.js owns the 3D mascot, and Rive owns an optional exported vector state machine. Avoid two libraries animating the same object. Respect prefers-reduced-motion; dispose scenes, observers, tickers and runtimes on unmount. Mascot expressions communicate the current step rather than covering form controls.

The shared `MascotProvider` coordinates deterministic page and interaction reactions. Registration, teams, verification and admin screens send typed signals; the renderer updates a jointed rig in place rather than rebuilding a scene for each reaction. Pointer tracking updates the head and eyes without React updates for each frame. Password focus holds a privacy pose until blur, and the behavior layer never reads input values. A floating companion covers routes without an inline character and appears after an inline character scrolls away. The Auction Dome excludes the companion, inline characters, and mascot loading artwork entirely. Reduced motion changes the character to SVG with static expressive poses. Team-roster reactions temporarily adopt that team’s jersey colour; the cap, socks and footwear keep their own materials.

`MascotBackdrop` renders eight original SVG sports environments for inline mascots only; floating companions remain transparent. Sport context is independent of temporary action timers so a high-five or scrolling cannot reset the active ground. Context changes on route navigation, supported sport hover/focus, registration choices, and manual scene cycling. Deep links to registration honour the selected sport on hydration. The Three.js and SVG rigs share the backwards cap, swoosh sneakers, and football identity. `FootballBall` shares the shaded SVG football between sports cards and the fallback mascot; React-generated IDs keep gradients and clipping unique across instances.

`TugOfWar` reuses `BoltPortrait` six times as vector instances rather than opening six WebGL contexts. Shirt CSS variables distinguish two selectable squads; the hat, face, gloves and sneakers remain identical. The pure `pullRope` state transition moves one unit per explicit click/keyboard activation, clamps at ±6, freezes the result after a win, and is reset on team changes or rematch. Animation is presentational and disabled for reduced motion. No backend requests are made by the mini-game.

## Operational limits

SQLite is a single-process development/test fallback; PostgreSQL is required for production concurrency. Photo files are normalized to JPEG, stripped of metadata, and served only through API lookups. Public photos are available only for verified players, while volunteer photos remain admin-only. Sessions use SameSite=Strict, HttpOnly cookies and origin validation. Production requires secure cookies and explicit secrets. The initial implementation provides audited bid cancellation; sold-player reassignment/undo is intentionally not exposed because it must also reconcile purse balances and already-sent mail.

SMTP delivery is at-least-once: outbox deduplication prevents repeated enqueueing, but a worker crash after SMTP acceptance can still cause a duplicate email. Document this instead of claiming exactly-once external delivery.
