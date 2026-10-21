-- Lesson 3: public intake goes through a trusted Next.js route. These functions
-- are service-only: a browser cannot mark itself verified or enqueue arbitrary mail.
create function public.blitz_register(p_id uuid, p_data jsonb, p_hash text, p_token text, p_public_url text)
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
    played_before, sports, volunteer_department, volunteer_rationale, photo_key, verification_hash)
  values (p_id, btrim(p_data->>'name'), lower(btrim(p_data->>'email')), p_data->>'role',
    p_data->>'programme', (p_data->>'year')::integer, (p_data->>'age')::integer,
    p_data->>'gender', p_data->>'region', (p_data->>'played_before')::boolean,
    chosen, nullif(btrim(p_data->>'volunteer_department'), ''),
    nullif(btrim(p_data->>'volunteer_rationale'), ''), p_id::text || '.jpg', p_hash)
  returning * into r;
  insert into blitz.email_outbox(key, recipient, subject, body) values (
    'registration:' || r.id::text, r.email, 'BLITZ: your registration is in',
    'Hi ' || r.name || E',\n\nYour ' || r.role || E' registration is saved.\n\nVerify your email:\n' ||
    rtrim(p_public_url, '/') || '/verify?token=' || p_token ||
    E'\n\nThis link expires in 48 hours.\nThe BLITZ organising team');
  return jsonb_build_object('id', r.id, 'message', 'Registration saved. Check your institutional inbox to verify your email.');
end $$;

create function public.blitz_verify(p_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r blitz.registrations; phase text;
begin
  select a.phase into strict phase from blitz.auction a where id = 1 for update;
  select * into r from blitz.registrations where verification_hash = p_hash for update;
  if not found then raise exception 'This verification link is invalid.'; end if;
  if r.verified then return jsonb_build_object('message', 'Your email is already verified.'); end if;
  if r.verification_expires < now() then raise exception 'This verification link has expired. Contact the organisers.'; end if;
  if r.role = 'player' and phase <> 'idle' then raise exception 'The player queue is already frozen. Contact the organisers.'; end if;
  update blitz.registrations set verified = true where id = r.id;
  return jsonb_build_object('message', 'Your email is verified. Your BLITZ registration is complete.');
end $$;

create function public.blitz_photo(p_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  return (select photo_key from blitz.registrations where id = p_id
    and ((role = 'player' and verified) or blitz.is_organiser()));
end $$;

create function public.blitz_admin_data(p_kind text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not blitz.is_organiser() then
    raise exception using errcode = '42501', message = 'Organiser access is required.';
  end if;
  if p_kind = 'registrations' then
    return coalesce((select jsonb_agg((to_jsonb(r) - 'verification_hash' - 'verification_expires' - 'photo_key')
      || jsonb_build_object('photo', '/api/photos/' || r.id::text) order by r.created_at)
      from blitz.registrations r), '[]'::jsonb);
  elsif p_kind = 'emails' then
    return coalesce((select jsonb_agg(to_jsonb(j) order by j.id desc) from
      (select id, recipient, subject, status, attempts from blitz.email_outbox order by id desc limit 200) j), '[]'::jsonb);
  elsif p_kind = 'audit' then
    return coalesce((select jsonb_agg(to_jsonb(j) order by j.id desc) from
      (select id, action, actor, details, created_at as timestamp from blitz.audit_events order by id desc limit 200) j), '[]'::jsonb);
  end if;
  raise exception 'Unknown organiser view.';
end $$;

create function public.blitz_rate_limit(p_key text, p_limit integer, p_seconds integer) returns void
language plpgsql security definer set search_path = '' as $$
declare hits integer;
begin
  insert into blitz.rate_limits(key, count, expires_at)
    values (p_key, 1, now() + make_interval(secs => p_seconds))
  on conflict (key) do update set
    count = case when blitz.rate_limits.expires_at <= now() then 1 else blitz.rate_limits.count + 1 end,
    expires_at = case when blitz.rate_limits.expires_at <= now() then excluded.expires_at else blitz.rate_limits.expires_at end
  where blitz.rate_limits.expires_at <= now() or blitz.rate_limits.count < p_limit
  returning count into hits;
  if hits is null then raise exception using errcode = 'P0429', message = 'Too many requests. Please try again later.'; end if;
  -- Bound expired IP-hash storage without keeping participant IP addresses.
  delete from blitz.rate_limits where expires_at < now() - interval '1 day';
end $$;

-- A lease token prevents an expired worker from acknowledging a newer worker's
-- attempt. Delivery is at-least-once; the provider also receives an idempotency key.
create function public.blitz_mail_claim() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare job blitz.email_outbox;
begin
  update blitz.email_outbox set status = 'failed', lease_until = null, lease_token = null
    where status = 'sending' and lease_until < now() and attempts >= 8;
  select * into job from blitz.email_outbox
    where attempts < 8 and ((status = 'pending' and next_attempt <= now())
      or (status = 'sending' and lease_until < now()))
    order by id for update skip locked limit 1;
  if not found then return null; end if;
  update blitz.email_outbox set status = 'sending', attempts = attempts + 1,
    lease_until = now() + interval '3 minutes', lease_token = gen_random_uuid()
    where id = job.id returning * into job;
  return jsonb_build_object('id', job.id, 'key', job.key, 'recipient', job.recipient,
    'subject', job.subject, 'body', job.body, 'lease_token', job.lease_token);
end $$;

create function public.blitz_mail_finish(p_id bigint, p_lease_token uuid, p_success boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  update blitz.email_outbox set
    status = case when p_success then 'sent' when attempts >= 8 then 'failed' else 'pending' end,
    next_attempt = now() + make_interval(secs => least(3600, 30 * power(2, attempts)::integer)),
    lease_until = null, lease_token = null
    where id = p_id and status = 'sending' and lease_token = p_lease_token;
  get diagnostics changed = row_count;
  return changed = 1;
end $$;

revoke execute on function public.blitz_register(uuid, jsonb, text, text, text) from public, anon, authenticated;
revoke execute on function public.blitz_verify(text) from public, anon, authenticated;
revoke execute on function public.blitz_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.blitz_mail_claim() from public, anon, authenticated;
revoke execute on function public.blitz_mail_finish(bigint, uuid, boolean) from public, anon, authenticated;
grant execute on function public.blitz_register(uuid, jsonb, text, text, text),
  public.blitz_verify(text), public.blitz_rate_limit(text, integer, integer),
  public.blitz_mail_claim(), public.blitz_mail_finish(bigint, uuid, boolean) to service_role;
revoke execute on function public.blitz_admin_data(text) from public, anon;
grant execute on function public.blitz_admin_data(text) to authenticated;
revoke execute on function public.blitz_photo(uuid) from public;
grant execute on function public.blitz_photo(uuid) to anon, authenticated;
