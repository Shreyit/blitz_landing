-- Forward fix for already-applied migration 008. Supabase's safe-update
-- protection rejects DELETE/UPDATE statements without a WHERE clause.
-- Scope child-record deletion to the captured pilot IDs and purse changes to
-- balances that actually need restoring. Keep all existing reset guards.
create or replace function public.blitz_reset_pilot_auction(p_ids uuid[], p_version integer) returns jsonb
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
  delete from blitz.bids where player_id=any(p_ids);
  get diagnostics bids_removed=row_count;
  delete from blitz.assignments where player_id=any(p_ids);
  get diagnostics assignments_removed=row_count;
  delete from blitz.audit_events where action in ('start','bid','sell','unsold','cancel','allocate');
  update blitz.teams set purse=2000 where purse<>2000;
  update blitz.auction set phase='idle',round=0,queue='{}',unsold='{}',cursor=1,
    bid=0,leader=null,total=0,version=a.version+1 where id=1;
  -- Preserve the increasing version so connected browsers reject stale responses.
  perform blitz.publish_snapshot();
  return jsonb_build_object('phase','idle','version',a.version+1,
    'deleted_bids',bids_removed,'deleted_assignments',assignments_removed,'deleted_mail_jobs',mail_removed);
end $$;
-- CREATE OR REPLACE retains the existing service-only EXECUTE grant.
