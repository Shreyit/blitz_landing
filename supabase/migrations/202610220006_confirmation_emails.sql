-- Lesson 6: form submission completes registration; confirmation mail is a receipt.
-- Keep the legacy `verified` flag for existing auction RPC compatibility. It now
-- means accepted registration, NOT proof of mailbox ownership.
alter table blitz.registrations alter column verified set default true;
alter table blitz.registrations alter column verification_hash drop not null;
alter table blitz.registrations alter column verification_expires drop not null;
alter table blitz.registrations alter column verification_expires drop default;
update blitz.registrations set verified=true, verification_hash=null, verification_expires=null;

alter table blitz.email_outbox add column template text not null default 'legacy'
  check(template in ('legacy','registration','assignment'));
alter table blitz.email_outbox add column data jsonb not null default '{}'::jsonb;

create function blitz.registration_mail_data(r blitz.registrations, website text)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('registration_id',r.id,'name',r.name,'email',r.email,
    'role',r.role,'programme',r.programme,'year',r.year,'age',r.age,'gender',r.gender,
    'region',r.region,'played_before',r.played_before,'sports',to_jsonb(r.sports),
    'department',r.volunteer_department,'rationale',r.volunteer_rationale,'website_url',website);
$$;
create function blitz.registration_mail_text(r blitz.registrations)
returns text language sql stable set search_path='' as $$
  select 'Hi ' || r.name || E',\n\nYour Bachelor’s BLITZ ' || r.role || E' registration is complete.\n'
    || r.programme || ' · Year ' || r.year::text || E'\n'
    || case when r.role='player' then 'Your sports: ' || array_to_string(r.sports, ', ')
      else 'Your department: ' || r.volunteer_department || E'\nYour contribution: ' || r.volunteer_rationale end
    || case when r.role='player' then E'\n\nWe will email your team and final price after you are assigned in the auction.'
      else E'\n\nThank you for joining the volunteer crew.' end
    || E'\n\nThe BLITZ organising team';
$$;

create or replace function public.blitz_register(p_id uuid, p_data jsonb, p_hash text, p_token text, p_public_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare chosen text[]; r blitz.registrations; phase text;
begin
  select a.phase into strict phase from blitz.auction a where id = 1 for update;
  if phase <> 'idle' then raise exception 'Registration has closed because the auction has started.'; end if;
  if p_data->'consent' is distinct from 'true'::jsonb then raise exception 'Consent is required.'; end if;
  if jsonb_typeof(p_data->'sports') is distinct from 'array' then raise exception 'Choose valid sports.'; end if;
  select coalesce(array_agg(value), '{}') into chosen from jsonb_array_elements_text(p_data->'sports');
  if exists(select 1 from unnest(chosen) x where not exists(select 1 from blitz.sports s where s.name = x))
    or cardinality(chosen) <> (select count(distinct x) from unnest(chosen) x) then
    raise exception 'Choose valid, distinct sports.';
  end if;
  insert into blitz.registrations(id, name, email, role, programme, year, age, gender, region,
    played_before, sports, volunteer_department, volunteer_rationale, photo_key, verified)
  values (p_id, btrim(p_data->>'name'), lower(btrim(p_data->>'email')), p_data->>'role',
    p_data->>'programme', (p_data->>'year')::integer, (p_data->>'age')::integer,
    p_data->>'gender', p_data->>'region', (p_data->>'played_before')::boolean,
    chosen, nullif(btrim(p_data->>'volunteer_department'), ''),
    nullif(btrim(p_data->>'volunteer_rationale'), ''), p_id::text || '.jpg', true)
  returning * into r;
  insert into blitz.email_outbox(key, recipient, subject, body, template, data) values (
    'registration:' || r.id::text, r.email, 'BLITZ: your registration is complete',
    blitz.registration_mail_text(r), 'registration', blitz.registration_mail_data(r, p_public_url));
  return jsonb_build_object('id', r.id, 'status', 'complete',
    'message', 'Your registration is complete. A confirmation email with your details has been queued.');
end $$;

-- Old links remain harmless; no token can change registration state anymore.
create or replace function public.blitz_verify(p_hash text) returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object('message','Registration is complete. Email verification is no longer required.');
$$;

create or replace function blitz.assign_player(p_player uuid, p_team integer, p_price integer, p_source text)
returns void language plpgsql security definer set search_path = '' as $$
declare r blitz.registrations; team_name text; team_color text; website text;
begin
  select * into r from blitz.registrations where id = p_player and role = 'player' and verified;
  if not found then raise exception 'This player is not eligible for assignment.'; end if;
  select name, color into strict team_name, team_color from blitz.teams where id = p_team;
  insert into blitz.assignments(player_id, team_id, price, source) values (p_player, p_team, p_price, p_source);
  select data->>'website_url' into website from blitz.email_outbox where key='registration:' || p_player::text;
  insert into blitz.email_outbox(key, recipient, subject, body, template, data) values (
    'assignment:' || p_player::text, r.email,
    case when p_source='random' then 'BLITZ: welcome to ' else 'BLITZ: sold to ' end || team_name,
    'Hi ' || r.name || E',\n\n' ||
    case when p_source='random' then 'You have been allocated to ' || team_name || ' at no cost.'
      else 'You have been sold to ' || team_name || ' for ₹' || p_price::text || '.' end ||
    E'\n\nYour sports: ' || array_to_string(r.sports, ', ') || E'\n\nThe BLITZ organising team',
    'assignment', blitz.registration_mail_data(r, website) ||
      jsonb_build_object('team',team_name,'team_color',team_color,'price',p_price,'source',p_source));
end $$;

create or replace function public.blitz_mail_claim() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job blitz.email_outbox;
begin
  update blitz.email_outbox set status = 'failed', lease_until = null, lease_token = null
    where status = 'sending' and lease_until < now() and attempts >= 8;
  select * into job from blitz.email_outbox
    where attempts < 8 and ((status = 'pending' and next_attempt <= now())
      or (status = 'sending' and lease_until < now()))
    -- A sale announcement should not wait behind a batch of registration receipts.
    order by case when template='assignment' then 0 else 1 end, id for update skip locked limit 1;
  if not found then return null; end if;
  update blitz.email_outbox set status = 'sending', attempts = attempts + 1,
    lease_until = now() + interval '3 minutes', lease_token = gen_random_uuid()
    where id = job.id returning * into job;
  return jsonb_build_object('id', job.id, 'key', job.key, 'recipient', job.recipient,
    'subject', job.subject, 'body', job.body, 'template', job.template, 'data', job.data, 'lease_token', job.lease_token);
end $$;

-- Upgrade queued receipts, but do not resend mail already accepted by a provider.
update blitz.email_outbox j set template='registration',
  data=blitz.registration_mail_data(r, null), subject='BLITZ: your registration is complete',
  body=blitz.registration_mail_text(r)
from blitz.registrations r where j.key='registration:' || r.id::text
  and j.status in ('pending','failed');
update blitz.email_outbox j set template='assignment',
  data=blitz.registration_mail_data(r, null) || jsonb_build_object(
    'team',t.name,'team_color',t.color,'price',a.price,'source',a.source)
from blitz.assignments a join blitz.registrations r on r.id=a.player_id
  join blitz.teams t on t.id=a.team_id
where j.key='assignment:' || a.player_id::text and j.status in ('pending','failed');

-- Queue an HTTP wake-up, never a synchronous SMTP call. pg_net sends only after
-- commit. Missing extensions/secrets or a wake-up failure leave the outbox intact
-- for the scheduled recovery worker, and cannot abort a registration or sale.
create function blitz.notify_mail() returns trigger
language plpgsql security definer set search_path='' as $$
declare project_url text; worker_secret text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then return new; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name=$1'
    into project_url using 'blitz_project_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name=$1'
    into worker_secret using 'blitz_mail_worker_secret';
  if project_url is null or worker_secret is null or length(worker_secret)<32 then return new; end if;
  execute 'select net.http_post(url:=$1, headers:=$2, body:=$3, timeout_milliseconds:=10000)'
    using rtrim(project_url,'/') || '/functions/v1/deliver-mail',
      jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || worker_secret), '{}'::jsonb;
  return new;
exception when others then
  return new;
end $$;
create trigger email_outbox_wakeup after insert on blitz.email_outbox
  for each row execute function blitz.notify_mail();

revoke execute on function blitz.registration_mail_data(blitz.registrations,text),
  blitz.registration_mail_text(blitz.registrations), blitz.notify_mail() from public,anon,authenticated;
-- CREATE OR REPLACE preserves the existing service-only/organiser RPC grants.
