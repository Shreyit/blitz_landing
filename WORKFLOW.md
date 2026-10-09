# Workflow

## Build order

1. Architecture, workflow, README and configuration.
2. Responsive public pages, sports illustrations and Three.js mascot.
3. Lenis/GSAP choreography and the Rive asset adapter.
4. Registration, image processing, verification and mail outbox.
5. Database-backed auction rules, authenticated controls and live snapshots.
6. Team rosters and end-to-end event rehearsal.

## Student registration

Choose Player or Volunteer → fill institutional identity → choose programme/year → select sports → upload photo → review and consent → submit → receive confirmation/verification email → verify. Photos and email addresses are personal information; the form explains which fields appear publicly. Volunteers never enter an auction queue.

## Organiser workflow

Configure event copy → start API, database and SMTP worker → review registrations → log in at `/admin` → set the eight team names → start auction when verified players are ready → click a team to bid → explicitly sell or mark unsold → finish each round → allocate final remaining players → inspect teams, email status and audit history.

Starting the auction freezes the verified player queue and closes registration. A bid reserves no money permanently: the final sale deducts the amount. Insufficient-purse teams cannot bid. A current leader cannot bid against itself. A cancellation clears the active lot’s bids and is recorded. There is no automatic timer closing a player’s auction.

## Rehearsal cases

- Exact email domain validation and duplicate role registration.
- Invalid/malicious image, excessive size and expired verification link.
- Player/volunteer isolation and public email privacy.
- First bid ₹20; transitions ₹95→₹100→₹110 and ₹190→₹200→₹225.
- A purse equal to the next bid is valid; a lower purse is rejected.
- Duplicate commands, stale auction versions and simultaneous requests.
- Normal/rapid round transitions and persistence after refresh.
- Random distribution with zero, fewer than eight, and more than eight players.
- SMTP failure/retry and no accidental re-enqueue after a sale.
- Keyboard navigation, mobile menu, form errors and reduced motion.

## Assets and configuration

Use the local SVG sports art and original Three.js mascot initially. A custom Rive export can be placed in `public/animations/blitz.riv` and enabled using frontend environment variables. Do not substitute an unrelated third-party mascot or claim an SVG is a Rive animation. Rive source files must have a documented licence or be owned by the organisers.

Bolt’s shared kit is a backwards cap, swoosh sneakers, gloves and football. Keep both the Three.js rig and `BoltPortrait` in sync when changing it. Inline sports scenes should match the eight registration options; the floating mascot must stay background-free. The football SVG is shared through `FootballBall`. The tug-of-war reuses the vector portrait with a pulling pose and team-colour shirts; it is an interactive warm-up, not an official scoreboard. Test opposing pulls, both winning directions, reset, team-colour changes, scene switching and reduced motion. Keep every mascot and warm-up scene out of the Auction Dome.

Do not add real credentials to source control. Keep `.env` local. Use Mailpit for rehearsal and an isolated database before opening the public event.
