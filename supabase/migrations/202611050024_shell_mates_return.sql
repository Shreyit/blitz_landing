-- United Spartans (team 2) is withdrawn and Shell Mates (team 3) returns, keeping six teams.
-- The other team ids stay as they are, so the teams are now 1, 3, 4, 5, 6 and 7.
-- Refuse to run once the auction has started or if United Spartans has bids, players or the lead.
do $$
begin
  if (select phase from blitz.auction where id = 1) <> 'idle' then
    raise exception 'Teams can only be changed before the auction starts.';
  end if;
  if exists (select 1 from blitz.bids where team_id = 2)
    or exists (select 1 from blitz.assignments where team_id = 2)
    or exists (select 1 from blitz.auction where leader = 2) then
    raise exception 'United Spartans already has auction records.';
  end if;
end $$;
delete from blitz.teams where id = 2;
insert into blitz.teams(id, name, color, symbol) values (3, 'Shell Mates', '#6b4a2e', 'SM');

-- Republish so spectators see the new team list.
update blitz.auction set version = version + 1 where id = 1;
select blitz.publish_snapshot();
