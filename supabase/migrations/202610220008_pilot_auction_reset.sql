-- An explicit server-only reset for the user's confirmed dummy auction.
-- Creating this function does not reset any hosted state by itself.
create or replace function public.blitz_pilot_registrations() returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'phase',(select phase from blitz.auction where id=1),
    'version',(select version from blitz.auction where id=1),
    'registrations',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'name',name,'email',email,'role',role,'photo_key',photo_key)
      order by created_at) from blitz.registrations),'[]'::jsonb));
$$;

create function public.blitz_reset_pilot_auction(p_ids uuid[], p_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a blitz.auction; bids_removed integer; assignments_removed integer; mail_removed integer;
begin
  if p_ids is null or cardinality(p_ids)>100
    or exists(select 1 from unnest(p_ids) id where id is null)
    or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id)
    or p_version is null or p_version<0 then
    raise exception 'Provide the complete pilot ID snapshot and auction version.' using errcode='22023';
  end if;
  select * into strict a from blitz.auction where id=1 for update;
  if a.version<>p_version then
    raise exception 'The auction changed. Inspect the pilot again before resetting.' using errcode='40001';
  end if;
  -- A full auction reset must not proceed from an incomplete participant list.
  if exists(select 1 from blitz.registrations where not(id=any(p_ids)))
    or exists(select 1 from unnest(p_ids) x where not exists(select 1 from blitz.registrations r where r.id=x)) then
    raise exception 'Registrations changed. Inspect the complete pilot again before resetting.' using errcode='40001';
  end if;
  perform 1 from blitz.email_outbox where key in (
    select prefix || id::text from unnest(p_ids) id
      cross join (values ('registration:'),('assignment:')) kinds(prefix)
  ) for update;
  if exists(select 1 from blitz.email_outbox where key in (
    select prefix || id::text from unnest(p_ids) id
      cross join (values ('registration:'),('assignment:')) kinds(prefix)
  ) and status='sending' and lease_until>now()) then
    raise exception 'A pilot email is being sent. Wait for its worker lease to finish and retry.' using errcode='P0001';
  end if;
  -- Discard queued/sent announcement records before reopening the dummy auction.
  delete from blitz.email_outbox where key in (select 'assignment:' || id::text from unnest(p_ids) id);
  get diagnostics mail_removed=row_count;
  delete from blitz.bids;
  get diagnostics bids_removed=row_count;
  delete from blitz.assignments;
  get diagnostics assignments_removed=row_count;
  delete from blitz.audit_events where action in ('start','bid','sell','unsold','cancel','allocate');
  update blitz.teams set purse=2000;
  update blitz.auction set phase='idle',round=0,queue='{}',unsold='{}',cursor=1,
    bid=0,leader=null,total=0,version=a.version+1 where id=1;
  -- Preserve the increasing version so connected browsers reject stale responses.
  perform blitz.publish_snapshot();
  return jsonb_build_object('phase','idle','version',a.version+1,
    'deleted_bids',bids_removed,'deleted_assignments',assignments_removed,'deleted_mail_jobs',mail_removed);
end $$;
revoke execute on function public.blitz_reset_pilot_auction(uuid[],integer) from public,anon,authenticated;
grant execute on function public.blitz_reset_pilot_auction(uuid[],integer) to service_role;
-- CREATE OR REPLACE retains the existing service-only list RPC grants.
