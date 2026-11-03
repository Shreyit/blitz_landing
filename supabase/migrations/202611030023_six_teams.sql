-- Shell Mates (team 3) and The Symbiotes (team 8) are withdrawn, leaving six teams.
-- The remaining team ids stay as they are (1, 2, 4, 5, 6, 7), so nothing else moves.
-- Refuse to run once the auction has started or if either team has bids, players or the lead.
do $$
begin
  if (select phase from blitz.auction where id = 1) <> 'idle' then
    raise exception 'Teams can only be removed before the auction starts.';
  end if;
  if exists (select 1 from blitz.bids where team_id in (3, 8))
    or exists (select 1 from blitz.assignments where team_id in (3, 8))
    or exists (select 1 from blitz.auction where leader in (3, 8)) then
    raise exception 'Shell Mates or The Symbiotes already have auction records.';
  end if;
end $$;
delete from blitz.teams where id in (3, 8);

-- The team setup command and the final random allocation now use however many teams exist,
-- instead of a fixed eight. Everything else is unchanged from migration 002.
create or replace function public.blitz_auction_command(
  p_action text, p_version integer, p_command_id uuid,
  p_team_id integer default null, p_teams jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a blitz.auction; t blitz.teams; previous blitz.audit_events;
  req jsonb; details jsonb; player uuid; amount integer; players uuid[];
  team_order integer[]; i integer; draw jsonb := '[]'; entry jsonb; team_count integer;
begin
  if not blitz.is_organiser() then
    raise exception using errcode = '42501', message = 'Organiser access is required.';
  end if;
  if p_action is null or p_version is null or p_version < 0 or p_command_id is null
    or p_action not in ('start', 'bid', 'sell', 'unsold', 'cancel', 'allocate', 'teams') then
    raise exception using errcode = '22023', message = 'Provide a valid auction command.';
  end if;
  -- One locked singleton serializes commands across every API instance.
  select * into strict a from blitz.auction where id = 1 for update;
  req := jsonb_build_object('action', p_action, 'team_id', p_team_id, 'teams', p_teams);
  select * into previous from blitz.audit_events where command_id = p_command_id;
  if found then
    if previous.request <> req or previous.actor <> auth.uid() then
      raise exception using errcode = '40001', message = 'This command ID was already used for another action.';
    end if;
    return (select snapshot from public.auction_public_state where id = 1);
  end if;
  if a.version <> p_version then
    raise exception using errcode = '40001', message = 'The auction changed. Refresh and review the latest state.';
  end if;
  details := jsonb_build_object('round', a.round, 'team_id', p_team_id);

  if p_action = 'teams' then
    if a.phase <> 'idle' then raise exception 'Team names are fixed once the auction starts.'; end if;
    select count(*) into team_count from blitz.teams;
    if p_teams is null or jsonb_typeof(p_teams) <> 'array' then raise exception 'Provide a distinct name for each team.'; end if;
    if jsonb_array_length(p_teams) <> team_count or
      (select count(distinct tm.id) from jsonb_array_elements(p_teams) e
        join blitz.teams tm on tm.id = (e->>'id')::integer) <> team_count or
      (select count(distinct lower(btrim(e->>'name'))) from jsonb_array_elements(p_teams) e
        where length(btrim(e->>'name')) between 2 and 60 and e->>'name' !~ '[[:cntrl:]]') <> team_count then
      raise exception 'Provide a distinct name for each team.';
    end if;
    -- Validate uniqueness at commit so two teams can exchange names safely.
    set constraints blitz.teams_name_unique deferred;
    for entry in select value from jsonb_array_elements(p_teams) loop
      update blitz.teams set name = btrim(entry->>'name'),
        symbol = upper(left(btrim(entry->>'name'), 1) || left(split_part(btrim(entry->>'name'), ' ', 2), 1))
        where id = (entry->>'id')::integer;
    end loop;
    details := jsonb_build_object('teams', p_teams);
  elsif p_action = 'start' then
    if a.phase <> 'idle' then raise exception 'The auction has already started.'; end if;
    select array_agg(id order by gen_random_uuid()) into players from blitz.registrations where role = 'player' and verified;
    if coalesce(cardinality(players), 0) = 0 then raise exception 'There are no verified players.'; end if;
    update blitz.auction set queue = players, total = cardinality(players), phase = 'active' where id = 1;
    details := details || jsonb_build_object('queue', players);
  elsif p_action = 'allocate' then
    if a.phase <> 'allocation' then raise exception 'Allocation is available only after the final rapid round.'; end if;
    select array_agg(x order by gen_random_uuid()) into players from unnest(a.queue) x;
    select count(*) into team_count from blitz.teams;
    for i in 1..cardinality(players) loop
      if (i - 1) % team_count = 0 then select array_agg(id order by gen_random_uuid()) into team_order from blitz.teams; end if;
      perform blitz.assign_player(players[i], team_order[(i - 1) % team_count + 1], 0, 'random');
      draw := draw || jsonb_build_array(jsonb_build_object('player_id', players[i], 'team_id', team_order[(i - 1) % team_count + 1]));
    end loop;
    update blitz.auction set phase = 'complete', queue = '{}', cursor = 1 where id = 1;
    details := details || jsonb_build_object('draw', draw);
  else
    if a.phase <> 'active' or a.cursor > cardinality(a.queue) then raise exception 'There is no active player lot.'; end if;
    player := a.queue[a.cursor]; details := details || jsonb_build_object('player_id', player);
    if p_action = 'bid' then
      select * into t from blitz.teams where id = p_team_id for update;
      if not found then raise exception 'Choose one of the teams.'; end if;
      if t.id = a.leader then raise exception 'This team is already leading.'; end if;
      amount := blitz.next_bid(a.round, a.bid);
      if t.purse < amount then raise exception 'This team cannot afford the next bid.'; end if;
      update blitz.auction set bid = amount, leader = t.id where id = 1;
      insert into blitz.bids(player_id, team_id, amount, round, command_id) values (player, t.id, amount, a.round, p_command_id);
      details := details || jsonb_build_object('amount', amount);
    elsif p_action = 'sell' then
      if a.leader is null or a.bid = 0 then raise exception 'A valid bid is required before selling.'; end if;
      select * into strict t from blitz.teams where id = a.leader for update;
      if t.purse < a.bid then raise exception 'The leading team cannot afford this sale.'; end if;
      perform blitz.assign_player(player, t.id, a.bid, 'auction');
      update blitz.teams set purse = purse - a.bid where id = t.id;
      details := details || jsonb_build_object('winner', t.id, 'price', a.bid);
      perform blitz.advance_lot();
    elsif p_action = 'unsold' then
      if a.bid <> 0 then raise exception 'Cancel the current bids before marking this player unsold.'; end if;
      update blitz.auction set unsold = array_append(unsold, player) where id = 1;
      perform blitz.advance_lot();
    elsif p_action = 'cancel' then
      if a.bid = 0 then raise exception 'There are no bids to cancel.'; end if;
      update blitz.bids set cancelled = true where player_id = player and round = a.round and not cancelled;
      details := details || jsonb_build_object('cancelled_amount', a.bid, 'cancelled_leader', a.leader);
      update blitz.auction set bid = 0, leader = null where id = 1;
    end if;
  end if;
  update blitz.auction set version = version + 1 where id = 1;
  insert into blitz.audit_events(command_id, action, actor, request, details)
    values (p_command_id, p_action, auth.uid(), req, details);
  return blitz.publish_snapshot();
end $$;

update blitz.auction set version = version + 1 where id = 1;
select blitz.publish_snapshot();
