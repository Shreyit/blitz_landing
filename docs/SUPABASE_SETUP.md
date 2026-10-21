# BLITZ: Supabase setup and first lesson

The new backend uses Supabase PostgreSQL for data and auction commands, Supabase Auth for organiser accounts, private Storage for photos, and Realtime for auction notifications. Small Next.js routes on Vercel validate uploads and manage HttpOnly organiser sessions. A Supabase Edge Function delivers queued emails through Resend. No separate Python server is needed in Supabase mode.

The website is deployed on Vercel. For the current registration-first phase and exact hosted activation steps, start with [Registration and admin pilot](REGISTRATION_PILOT.md). Local preparation alone does not activate hosted migrations, accounts, or mail. The Python implementation remains available under `NEXT_PUBLIC_BACKEND_PROVIDER=fastapi`; selecting `supabase` never silently falls back to Python when credentials are missing.

## 1. Run the database lessons without a Supabase account

```bash
npm install
npm run test:supabase
```

These tests run real PostgreSQL and PL/pgSQL using PGlite, inside Node. They require no Docker, hosted account, credentials, or email provider. The tests supply small stand-ins for Supabase Auth, Storage, and Realtime transport; they do not test those hosted services or simulate production network latency.

Start reading [the SQL walkthrough](SUPABASE_SQL.md) alongside [migration 001](../supabase/migrations/202610210001_schema.sql). A migration is a versioned file describing a database change. Keep these files in Git; do not create a separate, undocumented schema only through dashboard clicks.

## 2. Start the actual local Supabase stack

Install/use the Supabase CLI and make sure a Docker-compatible runtime is running and accessible to your account. From the repository root:

```bash
npx supabase start
npx supabase status
```

The repository already contains `supabase/config.toml`; there is no need to run `supabase init` again. The initial database migrations create the eight team identities and purses. No student or organiser accounts are seeded.

To recreate the local database while developing:

```bash
npx supabase db reset --local
```

This command deletes local database records and reapplies migrations. Use it only with disposable local data. It is not an upgrade procedure for a real event database.

## 3. Configure the website

Copy `.env.example` to `.env.local` if the file does not exist yet. Set:

```dotenv
NEXT_PUBLIC_BACKEND_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-local-publishable-key
SUPABASE_SECRET_KEY=your-local-server-secret
PUBLIC_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Use the keys from your CLI status/Connect output. New publishable and secret keys are preferred; the REST adapter also accepts the corresponding legacy anon/service-role keys when an older local CLI provides them. The publishable key belongs in the browser. The secret key bypasses normal data access policies and stays in trusted server code; never give it a `NEXT_PUBLIC_` prefix or commit `.env.local`.

```bash
npm run dev
```

Visit `http://localhost:3000/api/health`. A configured, migrated project returns `{"status":"ok","backend":"supabase"}`. Without configuration, writes fail explicitly and the Auction Dome retains its labelled preview. A public-state read needs the project URL and publishable key; registration/login/photo access also need the server secret.

For phone testing on your LAN, use the development machine's LAN address instead of `localhost`/`127.0.0.1` in browser-facing URLs and allowed origins. Restart Next.js after changing public environment variables.

## 4. Create your first organiser

Open local Studio at `http://127.0.0.1:54323`. In Authentication, add a confirmed user with an email and password. Public sign-up is disabled in the local configuration.

Open [add_organiser.sql](../supabase/operations/add_organiser.sql), replace the example address with that user's address, and run it in the local SQL editor. It links an existing Auth user to the private organiser allowlist. Check that the final query returns the intended user.

Sign in at `/admin` using that email/password. A valid Auth account without this allowlist entry is rejected. Account creation and organiser membership are separate actions. No public API can grant organiser membership.

## 5. Try registration and confirmation mail

Submit one disposable player registration and one volunteer registration. Player intake selects sports; volunteer intake selects exactly one department and a contribution statement. You can use the same institutional email for both roles.

The server validates the form, normalizes the confirmed crop to a 600 × 600 JPEG without metadata, uploads it to private Storage, and calls a service-only registration function. The database completes registration immediately and saves a confirmation-email job in the same transaction. No participant verification link is generated. The email includes the submitted details and selected sports.

For local development without a mail provider, inspect the queued message for your own disposable registration in the SQL editor:

```sql
select subject, body
from blitz.email_outbox
where key like 'registration:%'
order by id desc
limit 1;
```

Review the receipt text for the disposable entry. Message bodies contain participant details and stay private. The organiser email tab deliberately shows delivery metadata only. Local Inbucket catches Supabase Auth's own emails; our custom registration messages stay in the outbox until the Edge Function processes them.

## 6. Set up custom email delivery

For the chosen Google Workspace sender, follow [Gmail SMTP activation](SMTP_SETUP.md). SMTP support and private setup helpers are now available; the Resend setup below is an alternative.

The email provider must accept your chosen sender domain. Copy `supabase/functions/.env.example` to a local, ignored `supabase/functions/.env` and fill in the provider key, sender, project secret, and a random `MAIL_WORKER_SECRET` of at least 32 characters. Do not use `tiss.edu` as a sender unless the institution has authorised and verified it with the provider.

```bash
npx supabase functions serve deliver-mail --env-file supabase/functions/.env
```

Invoke `deliver-mail` with a POST request bearing that worker secret. It processes up to 20 available jobs within a bounded invocation, leases each job, sends through Resend's HTTP API, and saves success or retry state. A failed send receives exponential backoff. A stale worker cannot acknowledge another worker's lease. Provider idempotency keys reduce duplicate sends, but this remains at-least-once delivery; `sent` means the provider accepted the message, not that the recipient read it.

Hosted deployment later uses the hosted project's server key in the function secrets; a local development key cannot authorise requests to the hosted database:

```bash
npx supabase functions deploy deliver-mail
npx supabase secrets set --env-file supabase/functions/.env
```

`BLITZ_SUPABASE_SECRET_KEY` is deliberately named without the reserved `SUPABASE_` prefix. Supabase automatically supplies the function's project URL. After deployment, set up the Vault secrets and Cron job described in [schedule_mail.sql](../supabase/operations/schedule_mail.sql). Its once-per-minute schedule means email delivery can wait roughly a minute before processing, plus retries/provider delay. It does not delay a sale or live purse update.

SMTP in Supabase Auth handles authentication emails separately. Configuring Auth SMTP alone does not process custom registration/assignment jobs.

## 7. Rehearse the auction in the next phase

The current `/admin` route is focused on registration review. Restore the auction control view in the next pilot phase. With registered players ready, set the team names, start the auction, bid, sell, cancel bids, and mark players unsold. Starting closes registration and freezes the registered-player queue. Walk through all rapid rounds and final allocation. Open a spectator tab alongside the organiser dashboard.

Each command locks the singleton auction row, checks permissions and the expected version, applies the change, records an audit entry, builds one coherent public snapshot, and commits. A sale deducts the purse and assigns the player in that same transaction. Assignment mail is queued, not sent during the command.

Realtime carries a version notification. The browser treats it as an invalidation and fetches authoritative state; it never trusts a public-channel message as a purse or roster. Once subscribed and healthy, it stops four-second polling and retains a 30-second recovery checkpoint for silently missed notifications. On disconnect or HTTP failure it resumes four-second recovery polling, reconnects, and resynchronizes. Older responses cannot overwrite newer auction versions.

## 8. Connect the hosted development project

The development project's URL is `https://eyufbnjknvvadsthqqed.supabase.co`, and its project reference is `eyufbnjknvvadsthqqed`. Keep development and production data separate. When ready to link this repository:

```bash
npx supabase login
npx supabase link --project-ref eyufbnjknvvadsthqqed
npx supabase db push --dry-run
```

Review the target and pending migrations, then apply them with `npx supabase db push`. These migrations install a fresh Supabase backend; they do not import existing Python/SQLite registrations or photos. Existing real data would need a separate, rehearsed import.

Configure the hosted Auth settings explicitly: `config.toml` describes the local stack and does not automatically apply all dashboard settings to a hosted project. Disable public organiser sign-up, configure SMTP, create the organiser account, and add its allowlist entry.

Put the hosted URL, keys, allowed origins, and real `PUBLIC_URL` in Vercel's environment settings. Rebuild after public-variable changes. Next.js handles uploads and sessions; Supabase owns the data and auction rules. No EC2 or separate FastAPI process is needed in this mode.

The current website URL is [https://blitz-landing-theta.vercel.app/](https://blitz-landing-theta.vercel.app/). In Vercel, set these values for that deployment, then redeploy:

```dotenv
PUBLIC_URL=https://blitz-landing-theta.vercel.app
ALLOWED_ORIGINS=https://blitz-landing-theta.vercel.app
```

Keep localhost values in `.env.local` for local development. These hosted URL values control our registration verification links and allowed mutation origins; they do not apply database migrations or configure mail automatically. Configure Supabase Auth's Site URL and intended redirect URLs for the hosted website separately.

## What is still unverified

The hosted Auth/Storage/Realtime integration, actual provider delivery, simultaneous transactions on a networked PostgreSQL server, browser session flows, mobile rendering, and end-to-end latency need a real-stack rehearsal. The target remains at most one second from an organiser action to spectator render for about 100 connected viewers; local SQL execution time does not establish that target. Test network failures and reconnects as well as the normal path.

Fixture/result persistence and overall sport standings remain a separate backend feature. This implementation covers registration and the player auction.

Primary references: [CLI development](https://supabase.com/docs/guides/local-development/cli/getting-started), [database functions](https://supabase.com/docs/guides/database/functions), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Realtime protocol](https://supabase.com/docs/guides/realtime/protocol), [email functions](https://supabase.com/docs/guides/functions/examples/send-emails).
