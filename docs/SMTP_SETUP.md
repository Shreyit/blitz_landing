# Gmail SMTP and the missing registration email

Registration and delivery are separate operations. The registration transaction stores the form and queues its confirmation email in `blitz.email_outbox`. The success page means the registration was saved; it does not mean a mail server accepted the message. Supabase Auth's SMTP setting handles Auth emails, while this application's registration and assignment queue is processed by `deliver-mail`.

For this project the sender is **bachelorsblitz@tiss.ac.in**, hosted in Google Workspace. SMTP support has been prepared locally; it is not activated on the hosted project until the steps below succeed.

## 1. Find the saved student

In Supabase Table Editor, change the schema selector from `public` to `blitz`, then open `registrations`. The application tables deliberately live in a private schema. You do not need to add that schema to the Data API's exposed schemas.

If the schema is not offered by the editor, open SQL Editor and run:

```sql
select id, name, email, role, verified, created_at
from blitz.registrations
order by created_at desc
limit 20;

select recipient, subject, status, attempts, next_attempt
from blitz.email_outbox
order by created_at desc
limit 20;
```

`select` names the columns to read. `from blitz.registrations` selects the private schema and table explicitly. `order by created_at desc` puts the newest entry first, and `limit 20` bounds the result. The second query reads delivery metadata without displaying message bodies. `pending` means queued, `sending` means a worker holds a lease, `sent` means the provider accepted the message, and `failed` means the retry limit was reached.

A fuller read-only diagnostic, including photo existence, is available in [inspect_registration.sql](../supabase/operations/inspect_registration.sql). Photos themselves are in Storage's private `blitz-photos` bucket, served through the authorised application endpoint.

## 2. Review the private SMTP settings

The sender app password has been saved privately at the user’s explicit request. Creating a new password is not required to activate SMTP. If a replacement is needed later, use [Google app passwords](https://myaccount.google.com/apppasswords). Google requires 2-Step Verification and may restrict app passwords through the Workspace administrator. See [Google's app-password guide](https://support.google.com/accounts/answer/185833).

Run from the repository root:

```bash
npm run setup:mail
nano supabase/functions/.env
```

The helper creates an ignored file with the sender, Gmail host, TLS port 465, a random worker secret, and the existing project's server key. It preserves an existing file on rerun. The file has mode 600 and must stay out of Git and screenshots.

The password is already configured. If updating it later, change only this line, using the app password without Google's display spaces:

```dotenv
SMTP_PASSWORD="your-app-password"
```

Keep the other generated settings. Save in nano with Ctrl+O, Enter, then Ctrl+X. Do not put the password in a shell command or in this tracked guide.

We use `smtp.gmail.com:465` with TLS. Supabase Edge Functions block outgoing ports 25 and 587, so the usual STARTTLS port 587 is unsuitable for this worker. References: [Supabase runtime limits](https://supabase.com/docs/guides/functions/limits), [Nodemailer SMTP options](https://nodemailer.com/smtp), and [Supabase's SMTP example](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/send-email-smtp).

## 3. Upload settings and deploy the worker

The repository must already be linked to `eyufbnjknvvadsthqqed`, as in the admin setup. Run these one at a time:

```bash
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy deliver-mail --use-api
npm run mail:process
```

The first command uploads the private function settings; these are Supabase Edge Function secrets, not browser or Vercel variables. `--use-api` bundles the function server-side without requiring Docker. The function keeps platform JWT verification disabled in `config.toml` and checks its own dedicated, random worker secret before claiming mail. A publishable project key alone cannot run it. References: [CLI deployment/secrets](https://supabase.com/docs/reference/cli/supabase-functions-deploy), [function secrets](https://supabase.com/docs/guides/functions/secrets).

`npm run mail:process` invokes the worker once to process existing queued messages. It does not ask for a new registration or invent a test recipient. It prints counts only. “Provider accepted: 1” means the SMTP server accepted a message; confirm delivery by checking the student's actual inbox and spam folder. A nonzero retry count means delivery failed and the queue saved its retry state. The application never logs SMTP credentials, message bodies.

An SMTP send cannot provide Resend's HTTP idempotency guarantee. We retain database leases and use a stable Message-ID across retries, but SMTP delivery is at least once: a crash after acceptance and before acknowledgement can produce a duplicate email.

## 4. Turn on automatic queue processing

`npm run setup:mail` also generates this private, ignored SQL file:

```text
supabase/.temp/activate-mail.sql
```

Open it in your editor, copy its contents into the existing project's Supabase SQL Editor, and run it after the worker is deployed. It contains the worker invocation secret, so do not paste it into chat or commit it. It does not contain the Google app password or the Supabase server key.

The generated SQL:

1. `begin` opens one transaction so setup changes commit together.
2. `create extension if not exists` enables `pg_cron` and `pg_net` without dropping existing jobs or data.
3. A `do` block finds each named Vault secret. `vault.create_secret` adds a missing entry; `vault.update_secret` updates an existing entry. The values are the project URL and dedicated worker secret.
4. The shared [schedule_mail.sql](../supabase/operations/schedule_mail.sql) checks that both secrets exist, then `cron.schedule('blitz-deliver-mail', '* * * * *', ...)` creates or updates one named job to run every minute.
5. `net.http_post` queues a request to `deliver-mail` with the Vault-backed bearer secret. It does not send email inside a student registration or auction transaction.
6. `commit` saves setup. Migration 006 adds an outbox-insert trigger that requests a worker run as soon as a registration or sale transaction commits. The minute schedule remains a recovery path for missed wake-ups and due retries. Mail-server and inbox delivery still have their own latency.

References: [Supabase Cron](https://supabase.com/docs/guides/cron), [Vault create/update](https://supabase.com/docs/guides/database/vault), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).

To inspect automatic processing, run:

```sql
select jobname, schedule, active
from cron.job
where jobname = 'blitz-deliver-mail';

select status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (
  select jobid from cron.job where jobname = 'blitz-deliver-mail'
)
order by start_time desc
limit 10;
```

Cron success confirms the SQL job ran; it does not prove inbox delivery. Check the outbox statuses and the Edge Function's invocation logs too. No new public schema exposure, recipient override endpoint, or auction action is required.

## Updated confirmation designs and sale notifications

Registration is complete when the form is saved. No verification link is sent. Player receipts show all selected sports and submitted details; volunteer receipts show the department and contribution. Sale announcements identify the team and exact price, with distinct wording for free allocation.

After updating the code, deploy the new mail worker before applying migration 006:

```bash
npx supabase functions deploy deliver-mail --use-api
npx supabase db push
```

Deploy the latest frontend changes through Vercel too. If the private activation SQL has not yet been run, complete step 4 above; its Vault secrets and pg_net extension are required for immediate queue wake-ups. Existing saved registrations are made complete. Pending receipts are upgraded to the new design; mail already accepted by the provider is not automatically resent.

Inspect standalone design previews: [registration](email-previews/registration.html), [volunteer](email-previews/volunteer.html), [sale](email-previews/assignment.html), and [allocation](email-previews/allocation.html). Their data is illustrative. Rebuild them with `npm run preview:emails`. SVG artwork is rasterised by `npm run build:email-assets` and embedded through CID, so the Gmail layout does not depend on inline SVG support. References: [Nodemailer embedded images](https://nodemailer.com/message/embedded-images), [SVG email compatibility](https://www.caniemail.com/features/html-svg/).

## Verification boundary

Local tests cover TLS configuration, delayed SMTP transport creation, recipient acceptance, stable Message-IDs, authorisation before network activity, failure/retry acknowledgement, and secret-file permissions/preservation. The Nodemailer dependency is pinned to 10.1.7 in the Edge entry point, based on its [official release](https://github.com/nodemailer/nodemailer/releases/tag/v10.1.7). SMTP tests inject a transport; they do not open a real Gmail connection. The hosted function bundle, Workspace policy, actual app password, Cron/extensions, and inbox delivery must be verified using the activation steps above.
