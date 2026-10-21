-- Read-only diagnostics for the SQL Editor. No verification links or hashes.
-- The Table Editor defaults to public; these tables are in the private blitz schema.
select id, name, email, role, programme, year, age, gender, region,
  played_before, sports, volunteer_department, volunteer_rationale, verified,
  created_at, consent_at
from blitz.registrations
order by created_at desc
limit 50;

-- "pending" means queued; "sent" means accepted by the provider, not inbox delivery.
select id, recipient, subject, status, attempts, next_attempt, created_at
from blitz.email_outbox
order by created_at desc
limit 50;

-- Private photos live in Storage > blitz-photos, not in the public schema.
select r.id, r.name, exists (
  select 1 from storage.objects o
  where o.bucket_id='blitz-photos' and o.name=r.photo_key
) as photo_stored
from blitz.registrations r
order by r.created_at desc
limit 50;
