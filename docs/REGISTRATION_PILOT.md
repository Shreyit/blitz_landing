# Registration and admin pilot

The first phase stores player and volunteer registrations in Supabase and provides a private roster at `/admin`. Auction controls are deferred until the registration pilot passes. The existing auction implementation remains in the repository; this dashboard does not start an auction or expose bidding controls.

## The three stages

1. **Registration and admin access — implemented locally.** Uploads are normalized to square JPEGs in private Supabase Storage. PostgreSQL stores the form details, consent, and completed registration state. Only an allowlisted organiser can review all submissions and their photos.
2. **Your 2–3 registrations — after hosted activation.** Submit test player and volunteer entries, confirm that all values and cropped photos match, and check the mobile form/dashboard. A person registering for both roles has two entries. Keep the IDs of the pilot entries for later targeted removal.
3. **Auction pilot and cleanup — next phase.** After registration works, enable the auction controls, configure confirmation mail, rehearse the test players and team purses, then remove only the identified pilot data and photos. When you authorise removal, use the [pilot cleanup command](PILOT_CLEANUP.md) to remove those registrations, related mail jobs and photos.

## Activate the hosted database

Run from the repository root in your terminal:

```bash
npx supabase login
npx supabase link --project-ref eyufbnjknvvadsthqqed
npx supabase db push --dry-run
npx supabase db push
```

`login` connects the CLI to your Supabase account. `link` selects the existing BLITZ project; it does not make a new project. `--dry-run` lists pending migrations without applying them. `db push` applies only migrations not yet recorded in the hosted migration history, including the new first-admin function. It does not reset or delete registrations.

Use the database password you chose when creating the project if prompted. This is separate from your website admin password. If the CLI reports existing objects or migration-history errors, stop and inspect the migration state rather than resetting the database.

Supabase recommends deploying schema changes through migrations to preserve that history: [database migration guide](https://supabase.com/docs/guides/deployment/database-migrations).

## Create the requested admin

Your ignored `.env.local` must contain these existing project values:

```dotenv
NEXT_PUBLIC_BACKEND_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://eyufbnjknvvadsthqqed.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-project-publishable-key
SUPABASE_SECRET_KEY=your-project-secret-key
```

Then run:

```bash
npm run setup:admin
```

The script uses `cuba@2024.com` as the requested login. Enter the password you chose in the hidden terminal prompt. It creates a confirmed Auth identity without sending mail, grants the first organiser membership, verifies password login and membership, and signs out its temporary session. The password is never written into tracked files, printed, or embedded in the browser bundle. Supabase documents the server-only admin API and `email_confirm` option in [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

Rerunning the command reuses the account and requires its existing password; it does not reset passwords. The bootstrap RPC refuses to add a different account when an organiser already exists. For that case, review [add_organiser.sql](../supabase/operations/add_organiser.sql) and manually grant the intended confirmed Auth identity. An Auth account alone is insufficient: admin login also checks the organiser allowlist.

An address without an inbox works for this confirmed pilot account. It cannot receive a password-recovery email, so replace it with your real organiser address before the event. Disable public Auth sign-ups in the Supabase dashboard; student registration uses the application form and does not need an Auth account.

## Deploy the website changes

In Vercel, use the same provider, URL, publishable key, and **server-only** `SUPABASE_SECRET_KEY` for the deployed project. Also set:

```dotenv
PUBLIC_URL=https://blitz-landing-theta.vercel.app
ALLOWED_ORIGINS=https://blitz-landing-theta.vercel.app
```

Commit/push the application changes and let Vercel rebuild. Public configuration values are included at build time, so changing them requires a redeployment. Keep `SUPABASE_SECRET_KEY` without any `NEXT_PUBLIC_` prefix.

Open:

- [Registration form](https://blitz-landing-theta.vercel.app/register)
- [Private registration dashboard](https://blitz-landing-theta.vercel.app/admin)

Sign in using `cuba@2024.com` and the password entered into the setup script.

### If login says “Origin is not permitted”

The request was rejected before checking the admin password. In the Vercel project's environment variables, set both `PUBLIC_URL` and `ALLOWED_ORIGINS` to `https://blitz-landing-theta.vercel.app` for Production, then redeploy the latest application code. Localhost values belong in `.env.local`, not the hosted Production settings. The server accepts the configured website plus explicitly listed extra origins, normalizes URL trailing slashes, and continues rejecting unrelated websites.

The current login page says “Your team starts here.” If it still says “Behind the scoreboard,” the browser is showing an older application build. Deploy the current changes before testing the new registration dashboard. For local testing, restart the development server after environment changes and use `http://localhost:3000/admin`.

## Check the pilot

1. Submit 2–3 entries through `/register`, using the institutional email domain options and cropped photos. Include a volunteer entry to check the department and rationale.
2. At `/admin`, refresh to load new submissions. Check total/player/volunteer/returning-participant counts, search, role filters, and CSV export.
3. Open each profile and check name, email, role, programme, year, age, gender, state/UT, previous BLITZ participation, sports or department/rationale, photo, registration ID, and consent/submission times.
4. Sign out. The roster should disappear. A separate signed-out browser must not be able to fetch private roster details or volunteer photos through the API.
5. Save the test registration IDs for the later auction rehearsal and cleanup.

Registration is complete on submit; players do not need to verify their institutional mailbox. Confirmation emails show the submitted details and all selected sports. After a sale, a separate email announces the team and final price. Mail delivery is separate from registration and purse updates; activate the worker and Vault/Cron setup using [Gmail SMTP setup](SMTP_SETUP.md).

## Current verification boundary

Local tests execute the application SQL in PostgreSQL/PGlite and cover authorisation, full-profile reads, private-photo access, intake validation, and admin provisioning using mocked HTTP. Production builds and TypeScript checks cover the new page. These do not prove the hosted credentials, deployed schema, actual Supabase Auth/Storage integration, mobile browser rendering, or email delivery. The hosted activation and browser pilot above are still required.
