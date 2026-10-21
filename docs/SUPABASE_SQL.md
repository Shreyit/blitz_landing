# Learn the BLITZ database, one migration at a time

SQL is the language used to define and query our data. PostgreSQL is the database engine. Supabase hosts PostgreSQL and adds Auth, Storage, Realtime, and Edge Functions. The SQL below is executable project code, not a diagram pretending to be a backend.

Read the four migrations in order. The detailed comments in each file explain the main boundaries. This guide explains the statements, data relationships, and decisions around them.

## Vocabulary used throughout

| SQL | Meaning in BLITZ |
| --- | --- |
| `schema` | A namespace grouping tables and functions. `blitz` holds private records; `public` exposes a narrow interface. |
| `table` / `row` / `column` | A collection, one record, and one field: teams / one team / its purse. |
| `uuid` | An identifier used for people, commands, and worker leases. |
| `integer` | A whole number. Purses and bids use whole rupees, avoiding floating-point rounding. |
| `timestamptz` | An instant with time-zone-aware handling, used for expiry and audit timestamps. |
| `text[]` / `uuid[]` | A PostgreSQL array: selected sports or an ordered auction queue. SQL arrays start at position 1. |
| `jsonb` | Structured JSON stored in PostgreSQL: command requests and the public snapshot. |
| `primary key` | A row's unique identity. |
| `references` | A foreign key requiring a related row to exist. |
| `not null` | Require a value; `NULL` means absent/unknown. |
| `check` | A rule the database enforces even if an application has a bug. |
| `unique` | Prevent duplicates, such as the same email and registration role. |
| `index` | Help PostgreSQL find rows efficiently; a unique index also prevents duplicates. |
| `function` | A named operation we can call. RPC exposes selected public functions over HTTP. |
| `transaction` | Changes commit together or roll back together on an unhandled error. |
| `grant` / `revoke` | Give or remove a database privilege. |
| RLS / `policy` | Row-level access rules applied to ordinary database roles. |

## Migration 001: tables and boundaries

[Open the schema migration](../supabase/migrations/202610210001_schema.sql).

`create schema blitz` groups our authoritative data. `revoke all ... from public, anon, authenticated` stops normal browser roles from entering that schema. The SQL role `public` means every role; it is different from the schema named `public`.

### Identity and intake

`organiser_users.user_id` references Supabase's `auth.users`. It is an allowlist, separate from having an account. Only a trusted SQL operator can add membership; a user cannot promote themselves.

`sports` and `regions` are lookup tables. Their seeds match the eight sports and 36 states/union territories in the frontend. Registration's region foreign key rejects invented regions. The registration function checks each selected sport against the sport catalogue.

`registrations` stores identity, institutional email, role, programme/year, demographics, previous participation, selected sports or a volunteer department/rationale, photo identifier, consent timestamp, and verification state.

- `unique(email, role)` permits a player entry and a volunteer entry with the same email, but rejects a second entry for the same role.
- The role `check` accepts only player or volunteer. Other checks constrain programme, year, age, gender, name, and the two email domains.
- The final compound `check` requires sports for a player and no volunteer details. A volunteer must have exactly one supported department, a nonempty rationale, and no sports.
- `verification_hash` stores a SHA-256 digest, not the usable verification token. The outgoing email job contains the link needed for delivery and stays private.
- `photo_key = id::text || '.jpg'` ties each image path to its registration. `::text` converts the UUID to text; `||` joins strings.
- `not null` matters alongside checks: a PostgreSQL check alone can pass an unknown/NULL condition, so required values also have explicit non-null constraints.

### Auction records

`teams` seeds exactly eight identities with ₹2,000 purses. `check(purse between 0 and 2000)` protects balances. `name_key` is a generated lowercase name, giving case-insensitive uniqueness. Its unique constraint is deferrable so teams can exchange names within one transaction without a temporary collision.

`auction` is a singleton: `check(id = 1)` allows one auction state. It stores phase, round, frozen queue, unsold queue, current position, bid, leader, version, and initial player count. A compound check requires bid and leader to agree: either no bid/no leader, or a positive bid with a leader.

`bids` records amounts, teams, rounds, command IDs, and cancellation status. Cancelling a lot preserves the bid rows as cancelled history.

`assignments.player_id` is unique: a player cannot join two teams. Team/player foreign keys require real records. Source distinguishes a paid sale from free random allocation.

`audit_events.command_id` is unique. It stores who issued a command, its request, and its result details. This supports safe retry checks and a saved record of decisions.

### Mail, rate limits, and spectator state

`email_outbox` is a queue. Unique logical keys such as `assignment:PLAYER_UUID` prevent duplicate enqueueing. Status, attempt count, retry time, lease expiry, and lease token support recovery after failure.

`rate_limits` stores counts and expiry keyed by a server-generated HMAC of purpose and caller IP. It does not store raw IP addresses. Production assumes Vercel supplies the forwarded client IP; another ingress must enforce trusted forwarding headers.

The `do ... loop` enables RLS on every private table. We also withhold schema/table access. This protects personal data even if someone later broadens a table grant accidentally.

`public.auction_public_state` contains one safe JSON snapshot. Spectators receive SELECT access and a SELECT policy, never INSERT/UPDATE/DELETE. Building one projection per mutation avoids repeating expensive roster joins for every viewer and keeps purse, roster, and lot from the same version together.

## Migration 002: server-authoritative auction commands

[Open the auction migration](../supabase/migrations/202610210002_auction.sql).

`language sql` expresses a query directly. `language plpgsql` adds variables, conditions, loops, and exceptions. `declare` introduces variables; `begin ... end` encloses a function body. This PL/pgSQL block is not an extra transaction: the RPC invocation already runs inside a database transaction.

`security definer` executes with the function owner's privileges. That lets a carefully restricted function access private tables. It does not automatically make a function safe. We pin `search_path = ''`, use schema-qualified names, check the organiser explicitly, and revoke default execution grants. `auth.uid()` comes from the authenticated request, never from a client-supplied actor field.

| Function | What it does |
| --- | --- |
| `blitz.is_organiser()` | Check the signed-in user's private allowlist membership. |
| `public.blitz_admin_me()` | Return authorised session information or reject the caller. |
| `blitz.next_bid()` | Calculate the opening bid and increment from round/current amount. |
| `blitz.player_view()` | Select only a player's public fields; private answers never enter this object. |
| `blitz.publish_snapshot()` | Assemble current player, teams/purses/rosters, and recent history into one JSON object and upsert the public projection. |
| `blitz.assign_player()` | Validate eligibility, insert an assignment, and enqueue the assignment email. |
| `blitz.advance_lot()` | Clear bid/leader and move the cursor, rapid round, allocation phase, or completion state. |
| `public.blitz_auction_command()` | Authenticate, serialize, validate, apply, audit, and publish one command. |

`select ... into strict` requires exactly one result. `for update` locks a row until transaction completion. Every command first locks the same auction singleton, so two concurrent commands cannot both act on the same old state. Registration and verification take this lock too, coordinating queue freeze with intake.

The command compares its UUID to prior audit entries. An identical retry from the same organiser returns current state without repeating the effect. Reusing that UUID for a different action/payload is rejected. A new command must match the current `version`; otherwise it raises a stale-state error. `raise exception` aborts the command and rolls back its changes.

### Action by action

| Action | Checks and changes |
| --- | --- |
| `teams` | Require idle phase and eight distinct names/IDs; defer the name uniqueness check and update identities. |
| `start` | Require idle phase and verified players; shuffle and freeze their IDs, close intake, start the normal round. |
| `bid` | Require an active lot and real team, reject self-bidding, calculate the next amount, check purse, save bid and leader. |
| `sell` | Require a winning bid, check purse again, assign player, deduct price, queue email, and advance. |
| `cancel` | Mark the current lot's live bid rows cancelled, record previous amount/leader, and clear the bid. |
| `unsold` | Require no current bid, append player to the unsold list, and advance. |
| `allocate` | Require the final allocation phase, shuffle remaining players and team order per eight-player cycle, assign at ₹0, then complete. |

`gen_random_uuid()` supplies random ordering keys for saved draws. The outcome is persisted inside the transaction; a retry cannot reroll it. This is a random allocation mechanism, not a publicly verifiable draw protocol.

`jsonb_build_object` creates named JSON fields; `jsonb_agg` collects rows into JSON arrays. `coalesce(..., '[]')` supplies an empty array instead of NULL. `on conflict ... do update` replaces the existing singleton projection.

After a successful action, the command increments the version, inserts the audit event, and publishes the snapshot. A failure at any point rolls back all these effects, including assignment and purse changes. The RPC returns the same authoritative projection the organiser can render immediately.

## Migration 003: registration, verification, and background mail

[Open the registration/mail migration](../supabase/migrations/202610210003_registration_and_mail.sql).

| Function | Access | Explanation |
| --- | --- | --- |
| `blitz_register` | Server secret only | Check intake phase, consent, selected sports; insert constrained registration and its verification email job together. |
| `blitz_verify` | Server secret only | Look up the token digest, check expiry/frozen queue, mark verified, and handle repeated clicks safely. |
| `blitz_photo` | Public, with checks | Return a photo key for a verified player or for an authorised organiser; other records return NULL. |
| `blitz_admin_data` | Signed-in organiser | Return registration, mail metadata, or audit records after checking membership. Verification secrets are excluded. |
| `blitz_rate_limit` | Server secret only | Atomically create/increment a caller-purpose counter, reject over-limit requests, reset expired windows, remove old entries. |
| `blitz_mail_claim` | Server secret only | Exclusively lease the next due job and increment attempts. Recover expired leases; permanently fail exhausted jobs. |
| `blitz_mail_finish` | Server secret only | Match job ID and lease token before saving success or delayed retry. Return false if another worker owns the lease. |

`->` reads a JSON value; `->>` reads it as text. Casts such as `::integer` reject non-integer fields. SQL checks back up the more friendly validation in the Next.js route. Extra JSON like `verified: true` is ignored because the INSERT never reads that field.

`for update skip locked` lets concurrent mail workers take different jobs without waiting for each other. `lease_token` identifies the exact attempt; an old worker cannot overwrite a later attempt. `make_interval` constructs retry durations; exponential backoff grows between attempts and is capped at one hour. Attempts stop after eight.

No SMTP/HTTP request occurs inside the sale function. It only inserts an email job. The Edge Function performs external delivery later. The database can guarantee one logical queued job; it cannot guarantee exactly-once delivery across a crash and an external provider.

## Migration 004: private photos and realtime notifications

[Open the storage/realtime migration](../supabase/migrations/202610210004_storage_and_realtime.sql).

The `storage.buckets` insert creates `blitz-photos` as private, JPEG-only, with a size limit. There is no browser upload/read policy. Next.js normalizes images before upload, then checks `blitz_photo` eligibility before serving image bytes. Volunteer photos are not public.

`create trigger ... after update ... for each row` invokes `blitz.notify_auction()` when the public projection changes. Its call to `realtime.send` inserts a version notification for the public `blitz:auction` channel. Database-originated notifications follow committed changes.

A public channel can receive messages from untrusted publishers. Consequently, the browser never uses a broadcast payload as auction state. A notification schedules a read of the authoritative, read-only projection. A forged message can at most request another read; it cannot change the displayed purse to an invented value. Fetches are coalesced for 50ms, and older HTTP responses cannot overwrite newer state.

The Realtime protocol adapter joins, heartbeats, reconnects with backoff, and cleans up on unmount. Joining triggers a fresh snapshot to close the initial-subscription race. Four-second HTTP polling is recovery behavior when the socket or HTTP read is unhealthy. A 30-second checkpoint also repairs a silently missed notification; neither is the main live-update mechanism.

## Operational SQL files

[add_organiser.sql](../supabase/operations/add_organiser.sql) is a manual bootstrap operation. `insert ... select` links an existing Auth user to the allowlist; `on conflict do nothing` makes repeating it harmless. Replace the example email and check the resulting membership. It is not a public application endpoint.

[schedule_mail.sql](../supabase/operations/schedule_mail.sql) is an optional hosted operation after configuring secrets. It checks Vault entries, then uses `cron.schedule` to POST to the mail Edge Function every minute with a dedicated worker secret. Secrets are read from Vault at execution rather than committed to source. The Postgres `net.http_post` call queues an HTTP request; it does not send assignment emails inside an auction transaction.

## How the tests help you learn

Run `npm run test:supabase`. Read each test name, find the corresponding SQL function, and predict its result before running it. Tests exercise RLS/grants, eligibility, intake validation, bid thresholds, duplicate/stale commands, purse boundaries, transactional rollback, allocation, mail leases, and notification privacy. Adapter tests cover input validation, credentials, reconnects, stale responses, and provider failures.

PGlite runs actual PostgreSQL but supplies platform stubs. Hosted Auth, Storage, Realtime transport, concurrent network connections, and browser rendering require separate integration tests. Measuring one local SQL call is not a measurement of an auction update reaching a spectator's phone.
