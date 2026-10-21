-- Lesson 5: first-admin setup is a server-only operation, separate from login.
-- A confirmed Auth identity must exist before it can join the organiser list.
create function public.blitz_bootstrap_organiser(p_user_id uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Serialise concurrent bootstrap attempts: only one first account may win.
  perform pg_advisory_xact_lock(220005);
  if not exists (
    select 1 from auth.users
    where id = p_user_id and lower(email) = lower(p_email)
      and email_confirmed_at is not null
  ) then
    raise exception 'Create and confirm the matching Auth account first.' using errcode = '22023';
  end if;
  if exists (select 1 from blitz.organiser_users)
    and not exists (select 1 from blitz.organiser_users where user_id = p_user_id) then
    raise exception 'An organiser already exists. Additional access requires a manual membership grant.'
      using errcode = '42501';
  end if;
  insert into blitz.organiser_users(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  return jsonb_build_object('enabled', true, 'user_id', p_user_id);
end $$;
revoke execute on function public.blitz_bootstrap_organiser(uuid, text) from public, anon, authenticated;
grant execute on function public.blitz_bootstrap_organiser(uuid, text) to service_role;
