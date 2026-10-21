-- Pilot cleanup is terminal/server-only. Browser and ordinary Auth sessions
-- cannot list cleanup manifests or delete participant records through these RPCs.
create function public.blitz_pilot_registrations() returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'phase',(select phase from blitz.auction where id=1),
    'registrations',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'name',name,'email',email,'role',role,'photo_key',photo_key)
      order by created_at) from blitz.registrations),'[]'::jsonb));
$$;

create function public.blitz_delete_pilot_registrations(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare phase text; photos jsonb; removed integer; mail_removed integer;
begin
  if p_ids is null or cardinality(p_ids)=0 or cardinality(p_ids)>100
    or exists(select 1 from unnest(p_ids) id where id is null)
    or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id) then
    raise exception 'Choose between 1 and 100 distinct pilot registration IDs.' using errcode='22023';
  end if;
  -- Registration and auction commands use the same lock. New submissions that
  -- arrive later are not part of p_ids and must survive this cleanup.
  select a.phase into strict phase from blitz.auction a where id=1 for update;
  if phase<>'idle' then
    raise exception 'Cleanup is available only before the auction starts.' using errcode='P0001';
  end if;
  perform 1 from blitz.registrations where id=any(p_ids) for update;
  if exists(select 1 from blitz.assignments where player_id=any(p_ids))
    or exists(select 1 from blitz.bids where player_id=any(p_ids)) then
    raise exception 'These registrations have auction activity and need a separate pilot reset.' using errcode='P0001';
  end if;
  -- Lock jobs against concurrent SKIP LOCKED claims before checking live leases.
  perform 1 from blitz.email_outbox j where j.key in (
    select prefix || id::text from unnest(p_ids) id
      cross join (values ('registration:'),('assignment:')) kinds(prefix)
  ) for update;
  if exists(select 1 from blitz.email_outbox j where j.key in (
    select prefix || id::text from unnest(p_ids) id
      cross join (values ('registration:'),('assignment:')) kinds(prefix)
  ) and status='sending' and lease_until>now()) then
    raise exception 'A selected email is being sent. Wait for its worker lease to finish and retry.' using errcode='P0001';
  end if;
  select coalesce(jsonb_agg(photo_key),'[]'::jsonb) into photos
    from blitz.registrations where id=any(p_ids);
  delete from blitz.email_outbox j where j.key in (
    select prefix || id::text from unnest(p_ids) id
      cross join (values ('registration:'),('assignment:')) kinds(prefix)
  );
  get diagnostics mail_removed=row_count;
  delete from blitz.registrations where id=any(p_ids);
  get diagnostics removed=row_count;
  return jsonb_build_object('deleted_registrations',removed,'deleted_mail_jobs',mail_removed,'photo_keys',photos);
end $$;

revoke execute on function public.blitz_pilot_registrations(),
  public.blitz_delete_pilot_registrations(uuid[]) from public,anon,authenticated;
grant execute on function public.blitz_pilot_registrations(),
  public.blitz_delete_pilot_registrations(uuid[]) to service_role;
