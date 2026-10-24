-- WhatsApp number for players and volunteers. Private: it lives only in
-- blitz.registrations, reaches organisers through blitz_admin_data and the CSV,
-- and is never added to the public snapshot, photos or emails.
-- Registrations made before this column existed keep a null number.
alter table blitz.registrations add column whatsapp text
  check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$');

create or replace function public.blitz_register(p_id uuid, p_data jsonb, p_hash text, p_token text, p_public_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare chosen text[]; r blitz.registrations; phase text;
begin
  select a.phase into strict phase from blitz.auction a where id = 1 for update;
  if phase <> 'idle' then raise exception 'Registration has closed because the auction has started.'; end if;
  if p_data->'consent' is distinct from 'true'::jsonb then raise exception 'Consent is required.'; end if;
  if coalesce(p_data->>'whatsapp', '') !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Enter a valid WhatsApp number.';
  end if;
  if jsonb_typeof(p_data->'sports') is distinct from 'array' then raise exception 'Choose valid sports.'; end if;
  select coalesce(array_agg(value), '{}') into chosen from jsonb_array_elements_text(p_data->'sports');
  if exists(select 1 from unnest(chosen) x where not exists(select 1 from blitz.sports s where s.name = x))
    or cardinality(chosen) <> (select count(distinct x) from unnest(chosen) x) then
    raise exception 'Choose valid, distinct sports.';
  end if;
  insert into blitz.registrations(id, name, email, whatsapp, role, programme, year, age, gender, region,
    played_before, sports, volunteer_department, volunteer_rationale, photo_key, verified)
  values (p_id, btrim(p_data->>'name'), lower(btrim(p_data->>'email')), p_data->>'whatsapp', p_data->>'role',
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
