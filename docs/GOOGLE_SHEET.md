# Live registrations Google Sheet

A Google Sheet that refreshes itself every 10 minutes with every registration, for the core organising team. People you share it with only need to open it; they never touch code.

The Sheet has three tabs:

| Tab | What's in it |
| :--- | :--- |
| **Summary** | Totals, players per sport, programme and year, gender, volunteers per department, sign-ups per day, auction status, last updated time |
| **Players** | One row per player: registered time, name, email, WhatsApp, programme, year, age, gender, home state, played before, sports, and (after the auction) team, price and how they were assigned |
| **Volunteers** | One row per volunteer: the same personal details, department and their "why I'm suitable" answer |

Each table has filters on its header row, so anyone can sort or filter by sport, year or department.

## How it works

```text
Google Sheet (Apps Script, every 10 min)
   │  GET /api/sheets/registrations
   │  Authorization: Bearer <SHEETS_EXPORT_TOKEN>
   ▼
Vercel API ── checks the token ──► Supabase blitz_sheet_export() (server key only)
```

The export address does nothing without the secret token: with no token configured on Vercel it answers "not found", and a wrong token gets "invalid". The token lives in Vercel and in the Sheet's private script settings, never in the website code or the Sheet's cells.

## One-time setup (about 10 minutes)

### 1. Apply the database update

```bash
npx supabase db push
```

This adds migration 019, the read-only `blitz_sheet_export()` function.

### 2. Create the secret token

In Terminal:

```bash
openssl rand -hex 32
```

Copy the 64-character result. Treat it like a password.

### 3. Add it to Vercel

1. Open the project on [vercel.com](https://vercel.com) → **Settings** → **Environment Variables**.
2. Add **Key** `SHEETS_EXPORT_TOKEN`, **Value** the token, environment **Production**.
3. Go to **Deployments**, open the latest one, and choose **Redeploy**. The token only takes effect after a redeploy.

### 4. Create the Sheet and paste the script

1. Create a new Google Sheet, for example "BLITZ registrations (live)".
2. **Extensions → Apps Script.**
3. Delete the sample code, paste the whole of [`scripts/google-sheet/Code.gs`](../scripts/google-sheet/Code.gs), and press **Save**.
4. Click the gear (**Project Settings**) → **Script properties** → **Add script property**:
   - Property: `BLITZ_SHEETS_TOKEN`
   - Value: the same token from step 2
   - **Save script properties.**

### 5. Turn it on

1. Back in the editor, choose the function **`turnOnAutoRefresh`** in the dropdown at the top and press **Run**.
2. Google asks for permission. Choose your account → **Advanced** → **Go to … (unsafe)** → **Allow**. This warning appears for every personal script; it only lets the script fetch the export and write to this Sheet.
3. Switch to the Sheet. The **Summary**, **Players** and **Volunteers** tabs appear and fill in. From now on they refresh every 10 minutes, even when nobody has the Sheet open.

After reloading the Sheet you'll also see a **BLITZ** menu with **Refresh now**.

## Share it safely

The Sheet contains WhatsApp numbers, emails, ages and genders. Registrants were told these go only to the organising team.

1. **Share → add each core team member by email** as **Viewer**. Don't use "Anyone with the link".
2. Click the gear in the Share dialog and **untick "Viewers and commenters can see the option to download, print and copy"**.
3. Keep editing rights to yourself, so nobody can change the script or see the token.
4. When the event is over, delete the Sheet (or remove people), then delete `SHEETS_EXPORT_TOKEN` on Vercel and redeploy.

## If something goes wrong

Open **Extensions → Apps Script → Executions** to see the last runs.

| Message | Fix |
| :--- | :--- |
| Add the BLITZ_SHEETS_TOKEN script property first | Step 4.4 was skipped |
| The token is wrong | The script property and Vercel's `SHEETS_EXPORT_TOKEN` don't match |
| The website has no SHEETS_EXPORT_TOKEN yet | Add it on Vercel (step 3) and **redeploy** |
| The website answered 500 / function does not exist | Run `npx supabase db push` (step 1) |

To change the refresh interval, edit `REFRESH_MINUTES` at the top of the script (1, 5, 10, 15 or 30), save, and run `turnOnAutoRefresh` again.

To replace the token: make a new one, update Vercel and redeploy, then update the script property.
