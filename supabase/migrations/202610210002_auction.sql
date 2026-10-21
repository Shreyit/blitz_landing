-- Lesson 2: functions are the only write interface. Every RPC runs in a single
-- database transaction. A failed check rolls back ALL changes in that command.
create function blitz.is_organiser() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from blitz.organiser_users where user_id = auth.uid());
$$;

create function public.blitz_admin_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not blitz.is_organiser() then
    raise exception using errcode = '42501', message = 'Organiser access is required.';
  end if;
  return jsonb_build_object('authenticated', true, 'id', auth.uid());
end $$;

create function blitz.next_bid(p_round integer, p_current integer) returns integer
language sql immutable set search_path = '' as $$
  select case when p_round = 0 then
    case when p_current = 0 then 20 when p_current < 100 then p_current + 5
      when p_current < 200 then p_current + 10 else p_current + 25 end
    when p_round = 1 then case when p_current = 0 then 10 else p_current + 5 end
    when p_round = 2 then case when p_current = 0 then 2 else p_current + 2 end
    else case when p_current = 0 then 1 else p_current + 1 end end;
$$;

create function blitz.player_view(p blitz.registrations) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'programme', p.programme,
    'year', p.year, 'sports', p.sports, 'photo', '/api/photos/' || p.id::text);
$$;

-- Build the projection ONCE per mutation, not once per spectator. A single JSON
-- value contains purse, lot, roster and history from the same auction version.
create function blitz.publish_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a blitz.auction; state jsonb;
begin
  select * into strict a from blitz.auction where id = 1;
  select jsonb_build_object(
    'phase', a.phase, 'round', a.round, 'version', a.version,
    'current', (select blitz.player_view(r) from blitz.registrations r
      where r.id = a.queue[a.cursor] and a.phase = 'active' and r.verified and r.role = 'player'),
    'bid', a.bid, 'leader', a.leader, 'next_bid', blitz.next_bid(a.round, a.bid),
    'remaining', greatest(0, cardinality(a.queue) - a.cursor + 1),
    'sold', (select count(*) from blitz.assignments), 'total', a.total,
    'teams', (select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name,
      'color', t.color, 'symbol', t.symbol, 'purse', t.purse,
      'players', coalesce((select jsonb_agg(blitz.player_view(r) ||
        jsonb_build_object('price', x.price, 'source', x.source) order by x.id desc)
        from blitz.assignments x join blitz.registrations r on r.id = x.player_id
        where x.team_id = t.id and r.verified and r.role = 'player'), '[]'::jsonb)) order by t.id)
      from blitz.teams t),
    'history', coalesce((select jsonb_agg(h.item order by h.id desc) from
      (select x.id, jsonb_build_object('name', r.name, 'team', t.name,
        'price', x.price, 'source', x.source) item from blitz.assignments x
        join blitz.registrations r on r.id = x.player_id join blitz.teams t on t.id = x.team_id
        order by x.id desc limit 20) h), '[]'::jsonb)
  ) into state;
  insert into public.auction_public_state(id, snapshot) values (1, state)
    on conflict (id) do update set snapshot = excluded.snapshot, updated_at = clock_timestamp();
  return state;
end $$;

create function blitz.assign_player(p_player uuid, p_team integer, p_price integer, p_source text)
returns void language plpgsql security definer set search_path = '' as $$
declare r blitz.registrations; team_name text;
begin
  select * into r from blitz.registrations where id = p_player and role = 'player' and verified;
  if not found then raise exception 'This player is not eligible for assignment.'; end if;
  select name into strict team_name from blitz.teams where id = p_team;
  insert into blitz.assignments(player_id, team_id, price, source) values (p_player, p_team, p_price, p_source);
  insert into blitz.email_outbox(key, recipient, subject, body) values (
    'assignment:' || p_player::text, r.email, 'BLITZ: welcome to ' || team_name,
    'Hi ' || r.name || E',\n\nYou joined ' || team_name ||
    case when p_source = 'random' then ' by random allocation (₹0).' else ' for ₹' || p_price::text || '.' end ||
    E'\n\nYour sports: ' || array_to_string(r.sports, ', ') || E'\n\nThe BLITZ organising team');
end $$;

create function blitz.advance_lot() returns void
language plpgsql security definer set search_path = '' as $$
declare a blitz.auction;
begin
  select * into strict a from blitz.auction where id = 1;
  a.cursor := a.cursor + 1; a.bid := 0; a.leader := null;
  if a.cursor > cardinality(a.queue) then
    if cardinality(a.unsold) = 0 then
      a.phase := 'complete'; a.queue := '{}'; a.cursor := 1;
    else
      a.queue := a.unsold; a.unsold := '{}'; a.cursor := 1;
      if a.round < 3 then a.round := a.round + 1; else a.phase := 'allocation'; end if;
    end if;
  end if;
  update blitz.auction set cursor = a.cursor, bid = 0, leader = null, phase = a.phase,
    queue = a.queue, unsold = a.unsold, round = a.round where id = 1;
end $$;

create function public.blitz_auction_command(
  p_action text, p_version integer, p_command_id uuid,
  p_team_id integer default null, p_teams jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a blitz.auction; t blitz.teams; previous blitz.audit_events;
  req jsonb; details jsonb; player uuid; amount integer; players uuid[];
  team_order integer[]; i integer; draw jsonb := '[]'; entry jsonb;
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
    if p_teams is null or jsonb_typeof(p_teams) <> 'array' then raise exception 'Provide eight distinct team names.'; end if;
    if jsonb_array_length(p_teams) <> 8 or
      (select count(distinct (e->>'id')::integer) from jsonb_array_elements(p_teams) e where (e->>'id')::integer between 1 and 8) <> 8 or
      (select count(distinct lower(btrim(e->>'name'))) from jsonb_array_elements(p_teams) e
        where length(btrim(e->>'name')) between 2 and 60 and e->>'name' !~ '[[:cntrl:]]') <> 8 then
      raise exception 'Provide eight distinct team names, one for each team.';
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
    for i in 1..cardinality(players) loop
      if (i - 1) % 8 = 0 then select array_agg(id order by gen_random_uuid()) into team_order from blitz.teams; end if;
      perform blitz.assign_player(players[i], team_order[(i - 1) % 8 + 1], 0, 'random');
      draw := draw || jsonb_build_array(jsonb_build_object('player_id', players[i], 'team_id', team_order[(i - 1) % 8 + 1]));
    end loop;
    update blitz.auction set phase = 'complete', queue = '{}', cursor = 1 where id = 1;
    details := details || jsonb_build_object('draw', draw);
  else
    if a.phase <> 'active' or a.cursor > cardinality(a.queue) then raise exception 'There is no active player lot.'; end if;
    player := a.queue[a.cursor]; details := details || jsonb_build_object('player_id', player);
    if p_action = 'bid' then
      select * into t from blitz.teams where id = p_team_id for update;
      if not found then raise exception 'Choose one of the eight teams.'; end if;
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

-- SECURITY DEFINER functions use a pinned, empty search_path and explicit grants.
-- No helper is callable through the browser; signing up does not make an admin.
revoke execute on all functions in schema blitz from public, anon, authenticated;
revoke execute on function public.blitz_admin_me() from public, anon;
revoke execute on function public.blitz_auction_command(text, integer, uuid, integer, jsonb) from public, anon;
grant execute on function public.blitz_admin_me() to authenticated;
grant execute on function public.blitz_auction_command(text, integer, uuid, integer, jsonb) to authenticated;
select blitz.publish_snapshot();
