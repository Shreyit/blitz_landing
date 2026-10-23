-- Teams 2 and 3 become United Spartans and Shell Mates. Republish so spectators see the new names.
update blitz.teams set name = 'United Spartans', color = '#a8742c', symbol = 'US' where id = 2;
update blitz.teams set name = 'Shell Mates', color = '#6b4a2e', symbol = 'SM' where id = 3;
update blitz.auction set version = version + 1 where id = 1;
select blitz.publish_snapshot();
