# Learn the BLITZ database, one migration at a time

SQL is the language used to define and query our data. PostgreSQL is the database engine. Supabase hosts PostgreSQL and adds Auth, Storage, Realtime, and Edge Functions. The SQL below is executable project code, not a diagram pretending to be a backend.

Read the twelve migrations in order. The detailed comments in each file explain the main boundaries. This guide explains the statements, data relationships, and decisions around them.

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

Migration 006 replaces the original participant email-verification flow described in migrations 001–003. The historical files remain unchanged so already applied migrations stay reproducible. The current flow completes registration on submit and sends a designed receipt. Organiser Auth confirmation remains separate.

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

## Migration 005: enabling the first organiser

[Open the admin bootstrap migration](../supabase/migrations/202610220005_admin_bootstrap.sql).

`create function public.blitz_bootstrap_organiser(p_user_id uuid, p_email text)` defines a narrow setup operation. The UUID identifies an existing Supabase Auth account; the email must match that account. The function checks `email_confirmed_at is not null`, so an unconfirmed identity cannot become the first admin.

`security definer set search_path = ''` runs with the function owner's permissions while requiring explicit schema names. It does not make the endpoint public: `revoke execute ... from public, anon, authenticated` removes ordinary access, and `grant execute ... to service_role` permits only trusted server credentials.

`pg_advisory_xact_lock(220005)` takes a lock lasting until the transaction ends. Concurrent bootstrap attempts cannot both see an empty organiser table and create two first admins. The number identifies this setup lock; it is not a password or a user ID.

The first `if not exists` checks the confirmed Auth identity. The second check rejects a different account once any organiser exists. `raise exception ... using errcode` aborts the operation with a useful SQL error. `insert ... on conflict do nothing` makes rerunning setup for the same account harmless. Finally, `jsonb_build_object` returns the enabled status and UUID; it contains no password.

The terminal-only `npm run setup:admin` script creates the confirmed Auth identity through Supabase's admin API, calls this function using the server secret, and then proves the account can pass the normal organiser check. The password is entered privately in the terminal. Additional admins require a deliberate manual membership grant rather than reusing this first-account bootstrap.

## Migration 006: completed registration and designed receipts

[Open the confirmation-mail migration](../supabase/migrations/202610220006_confirmation_emails.sql).

`alter table ... alter column ... drop not null` makes the obsolete verification hash and expiry nullable. The migration clears these values and sets existing registrations complete. The `verified` column remains for older auction functions, but now represents accepted registration, not mailbox ownership. The server sets it; a forged browser value still has no effect.

The two added outbox columns, `template` and `data`, separate message type from content. `template` selects `registration`, `assignment`, or the backwards-compatible `legacy` text format. `data jsonb` records the exact selected sports, form details, and (for a sale) team and price. `check` restricts the supported template names.

`blitz.registration_mail_data` builds structured content with `jsonb_build_object`; `blitz.registration_mail_text` provides a readable fallback. The replacement `blitz_register` keeps the original function signature for deployed-client compatibility but ignores the old token arguments. It saves a completed registration and a receipt job together. `blitz_verify` becomes an informational compatibility response and cannot change rows.

The replacement `blitz.assign_player` inserts the assignment and its announcement job in the existing sale transaction. The team and price are copied into the job, so delivery does not guess them from a later browser state. A random assignment records price zero and is worded as allocation. The unique `assignment:UUID` key continues preventing duplicate logical messages on repeated sale commands.

`blitz_mail_claim` returns `template` and `data` as part of the exclusive lease and prioritises sale announcements over registration receipts. The Edge worker renders escaped HTML, a plain-text alternative, and inline PNG artwork generated from SVG. Static artwork has no runtime URL fetch or filesystem dependency. SMTP and Resend use the same renderer.

The two backfill `update` statements upgrade pending/failed registration and assignment jobs. They leave already accepted messages and live worker leases alone. Completed registrations are not deleted or asked to register again.

`create trigger email_outbox_wakeup after insert` calls `blitz.notify_mail`. The trigger looks up the project URL and invocation secret in Vault, then uses `net.http_post` to queue a worker wake-up. Its HTTP operation starts after commit and does not wait for SMTP. A transaction rollback also removes its queued wake-up. If the platform extensions or credentials are missing, or enqueueing fails, the mail row remains available to the scheduled recovery worker; a mail wake-up must not break a sale or registration. References: [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Vault](https://supabase.com/docs/guides/database/vault).

`revoke execute` keeps the new helpers inaccessible to normal application callers. `create or replace` retains the grants already applied to the replaced RPCs. Supabase Auth organiser confirmation is unchanged.

## Migration 007: targeted pilot cleanup

[Open the cleanup migration](../supabase/migrations/202610220007_pilot_cleanup.sql). Its two RPCs are service-only: one lists the current pilot candidates, and the other deletes an exact array of registration UUIDs. Creating these functions does not itself delete anything. The SQL transaction checks idle auction state, locks the selected rows and mail jobs, refuses bid/assignment activity or live mail leases, then deletes only matching email jobs and registrations. It returns photo names for the terminal to remove through Storage's API. The terminal saves a private resumable manifest first, so a network failure cannot broaden deletion to later students. See the [command walkthrough](PILOT_CLEANUP.md).

## Migration 008: explicit reset of the dummy auction

[Open the reset migration](../supabase/migrations/202610220008_pilot_auction_reset.sql). This was added after the ordinary cleanup correctly refused a started auction and the user confirmed all auction activity was dummy. The new service-only function accepts a complete participant snapshot and expected auction version. It checks both under the auction lock, refuses live mail leases, deletes test bids/assignments and auction audit entries, restores ₹2,000 purses, and clears the auction state. It preserves team names, colours and organiser accounts. The version increases and `blitz.publish_snapshot()` broadcasts a coherent empty state, so old HTTP responses cannot restore the previous auction view. The terminal only calls this function with the explicit `--all --reset-auction` option, then performs profile/photo cleanup separately. Creating the function itself does not reset anything.

## Migration 009: hosted safe-update compatibility

[Open the scoped reset fix](../supabase/migrations/202610220009_scoped_pilot_reset.sql). Supabase's `safeupdate` protection requires a `WHERE` clause on `DELETE` and `UPDATE`. The first reset function had unfiltered bid/assignment deletion and purse restoration, so the hosted call was rejected and rolled back. `create or replace` installs the corrected function while retaining its service-only grant. `where player_id=any(p_ids)` restricts child records to the approved pilot IDs, and `where purse<>2000` restores only balances that need changing. This is a forward migration: already applied migration 008 remains unchanged. [Supabase's configuration reference](https://supabase.com/docs/guides/database/custom-postgres-config).

## Migrations 010–012: confirmed team identities

[010](../supabase/migrations/202610220010_x_force_united.sql), [011](../supabase/migrations/202610220011_vikings.sql) and [012](../supabase/migrations/202610220012_slytherwins.sql) each run one `update blitz.teams set name = …, color = …, symbol = … where id = N`, renaming placeholder teams 5, 6 and 4 to X Force United, Vikings and Slytherwins. The `where id = N` clause keeps them compatible with `safeupdate`. They change only the identity row: purses, bids and rosters are untouched, and the next published snapshot carries the new names. Team logos and owner names are not stored in the database; they live in `TEAM_BRANDING` in `src/lib/event.ts`.

[Migration 014](../supabase/migrations/202610230014_shadow_strikers.sql) renames team 7 to Shadow Strikers and restyles team 4 as SlytherWins, then republishes the same way. [Migration 015](../supabase/migrations/202610230015_the_symbiotes.sql) does the same for team 8, The Symbiotes, and [migration 016](../supabase/migrations/202610230016_united_spartans_shell_mates.sql) for teams 2 and 3, United Spartans and Shell Mates. [Migration 017](../supabase/migrations/202610230017_the_monarchs.sql) completes the set with team 1, The Monarchs.

Those first three did not rebuild the public projection, so the site kept showing the old names. [Migration 013](../supabase/migrations/202610230013_republish_team_names.sql) fixes that: it bumps `blitz.auction.version` (so open browsers accept the newer state) and calls `blitz.publish_snapshot()`.

Apply them before starting the auction (`npx supabase db push`). For each further confirmed team, write one migration with the scoped `update`, **followed by the same two statements as 013**:

```sql
update blitz.teams set name = 'New Name', color = '#123456', symbol = 'NN' where id = N;
update blitz.auction set version = version + 1 where id = 1;
select blitz.publish_snapshot();
```

Then mirror the change in `src/lib/event.ts` and `backend/app/config.py`.

## Operational SQL files

[add_organiser.sql](../supabase/operations/add_organiser.sql) is a manual bootstrap operation. `insert ... select` links an existing Auth user to the allowlist; `on conflict do nothing` makes repeating it harmless. Replace the example email and check the resulting membership. It is not a public application endpoint.

[schedule_mail.sql](../supabase/operations/schedule_mail.sql) is an optional hosted operation after configuring secrets. It checks Vault entries, then uses `cron.schedule` to POST to the mail Edge Function every minute with a dedicated worker secret. Secrets are read from Vault at execution rather than committed to source. The Postgres `net.http_post` call queues an HTTP request; it does not send assignment emails inside an auction transaction.

## How the tests help you learn

Run `npm run test:supabase`. Read each test name, find the corresponding SQL function, and predict its result before running it. Tests exercise RLS/grants, eligibility, intake validation, bid thresholds, duplicate/stale commands, purse boundaries, transactional rollback, allocation, mail leases, and notification privacy. Adapter tests cover input validation, credentials, reconnects, stale responses, and provider failures.

PGlite runs actual PostgreSQL but supplies platform stubs. Hosted Auth, Storage, Realtime transport, concurrent network connections, and browser rendering require separate integration tests. Measuring one local SQL call is not a measurement of an auction update reaching a spectator's phone.

## Migration 018: private WhatsApp number

[018](../supabase/migrations/202610240018_whatsapp_number.sql) adds `blitz.registrations.whatsapp`, stored in E.164 form (`+919876543210`) and checked by `^\+[1-9][0-9]{7,14}$`. `blitz_register` now rejects a registration without a valid number; the API normalises input first (`src/lib/whatsapp.ts`: a bare 10-digit Indian mobile gets `+91`). Rows registered before 018 keep `null`. The number reaches organisers only, through `blitz_admin_data('registrations')` (which returns whole rows) and the CSV export. It is not in `player_view`, the public snapshot, or `registration_mail_data`, so it never appears on the public site or in emails.
