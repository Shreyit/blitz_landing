-- Re-send the registration receipt to the two players moved to @stud.tiss.edu
-- in migration 021. A new outbox row (new key) fires the insert trigger that
-- wakes the mail worker; the unique key makes this send at most once.
insert into blitz.email_outbox(key, recipient, subject, body, template, data)
select 'registration-resend:' || r.id::text, r.email, 'BLITZ: your registration is complete',
  blitz.registration_mail_text(r), 'registration',
  blitz.registration_mail_data(r, coalesce(
    (select o.data->>'website_url' from blitz.email_outbox o where o.key = 'registration:' || r.id::text),
    'https://blitz-landing-theta.vercel.app'))
from blitz.registrations r
where r.email in ('m2023bsw003@stud.tiss.edu', 'm2023bsass004@stud.tiss.edu')
on conflict (key) do nothing;
