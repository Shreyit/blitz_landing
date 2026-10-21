# Remove the dummy registrations and their photos

The user confirmed that both the current student registrations and all auction activity are dummy test data and requested a clean start. The cleanup command removes the selected registration rows, matching registration/assignment email jobs, and their exact photo objects in the private `blitz-photos` bucket. The explicit auction-reset option clears test bids, sales, assignments and auction audit entries, restores team purses to ₹2,000, and reopens registration. It preserves team names/colours, the organiser Auth account, SMTP credentials, scheduled mail processing, and application configuration.

From the project terminal:

```bash
npx supabase db push
npm run cleanup:pilot -- --all --reset-auction
```

The first command applies any pending migrations, including migration 008 for the explicit auction reset and migration 009 for hosted safe-update compatibility; applying these migrations does not delete student data or reset the auction. The second command lists the current registrations, captures their IDs and auction version, resets the confirmed dummy auction, and performs the authorised profile/photo cleanup. Use `--all` while the current entries are all dummy records. New submissions arriving after that snapshot are not included.

To inspect without deleting:

```bash
npm run cleanup:pilot
```

To delete only particular entries later:

```bash
npm run cleanup:pilot -- --ids UUID-ONE,UUID-TWO
```

Replace those placeholders with actual registration IDs printed by inspection. No browser or ordinary organiser session can invoke the cleanup functions; the terminal uses the existing server key from the ignored `.env.local`.

## How deletion works

`blitz_pilot_registrations()` returns the auction phase and a list of registration IDs, names, emails, roles and photo keys. It returns no credentials or message bodies. Without `--reset-auction`, the terminal refuses to clean up after the auction has started. The reset option is restricted to `--all` because resetting a whole auction requires reviewing its complete participant snapshot.

`blitz_delete_pilot_registrations(p_ids uuid[])` accepts a bounded list of exact UUIDs. `uuid[]` means an array of database identifiers. Checks reject an empty list, duplicates, nulls or more than 100 IDs. The function locks the same auction singleton used by intake and auction commands, then locks the selected rows. It refuses registrations with bid/assignment activity and active mail-worker leases. These guards keep cleanup from interfering with an auction or an email already being sent.

The two `delete ... where ...` statements remove matching outbox jobs and then registration rows in the same transaction. `get diagnostics ... row_count` records how many rows were removed. They do not truncate tables or delete unrelated recipients' messages. `revoke execute` excludes public/browser/Auth roles; only `service_role` receives execution permission.

The terminal then removes only the captured `UUID.jpg` objects through Supabase Storage's API and checks that those names no longer appear. Do not delete rows in `storage.objects` manually: Supabase requires the Storage API to remove the underlying files. See [Supabase object deletion](https://supabase.com/docs/guides/storage/management/delete-objects).

A private, Git-ignored manifest in `supabase/.temp/pilot-cleanup.json` stores only the project URL, captured IDs/photo names, stage and counts while the operation is unfinished. It contains no passwords, names, email addresses or image bytes. It is removed after successful photo verification. If the connection fails, complete the same scope with:

```bash
npm run cleanup:pilot -- --resume
```

An ambiguous database response never triggers photo deletion until a successful database cleanup response is received. Repeated deletion of already absent IDs is harmless. Resuming does not expand to newer registrations.

After success, refresh the admin roster. Previously delivered emails remain in recipients' mailboxes; deleting this application's outbox records cannot recall them. Without the explicit reset option, cleanup never resets auction activity. Neither mode removes unrelated orphan files from failed uploads.


## Why the first cleanup stopped

The earlier command exited before deleting anything because the auction was no longer idle. The default guard remains in place. The user subsequently confirmed that all bids, sales and assignments were dummy too, authorising the explicit reset mode above.

Migration 008 adds `blitz_reset_pilot_auction(p_ids uuid[], p_version integer)`. It locks the auction row and compares the captured version and complete participant-ID set with current state. Changed data causes a conflict instead of a reset. Active mail leases also stop the reset. Once validated, the SQL transaction removes assignment mail records and test auction activity, restores purses, clears queues/bids/leader/round, and sets phase `idle`. Team configuration and admin identity are kept. It increments the auction version and publishes a coherent empty snapshot; the version must not go back to zero because connected browsers reject older state.

Registration deletion and Storage cleanup then use the same exact-ID manifest as before. If an auction reset completes but a later cleanup step fails, the command reports the successful reset first; resume the pending profile/photo cleanup with `--resume`. If a reset request loses its response before profile cleanup begins, rerunning the explicit command inspects the current snapshot again. No photos are removed before successful database deletion.

## If the hosted reset said “DELETE requires a WHERE clause”

Migration 008's first version used unfiltered child-table deletion. Supabase's hosted `safeupdate` protection rejected that function call, rolling back the reset transaction. Migration 009 replaces the function without editing migration history. It filters bids and assignments by the captured pilot IDs and restores only purses whose values differ from ₹2,000. The existing auction/version/participant/mail-lease guards stay in place. Keep the hosted protection enabled.

Run `npx supabase db push`, then rerun `npm run cleanup:pilot -- --all --reset-auction`. Creating the replacement function itself does not delete data. See [Supabase safe-update configuration](https://supabase.com/docs/guides/database/custom-postgres-config).

## Verification

Local SQL tests cover role restrictions, exact-ID deletion, preservation of unrelated students/teams/admin membership, mail-lease refusal, auction-phase refusal and repeat cleanup. Mocked HTTP tests cover captured photo scope, manifest failures, ambiguous database responses, interrupted Storage cleanup, exact photo verification and safe resumption. Hosted deletion is confirmed only by a successful run against the actual project and its returned counts.
