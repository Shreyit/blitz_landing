-- Team 1 becomes The Monarchs, completing all eight. Republish so spectators see the new name.
update blitz.teams set name = 'The Monarchs', color = '#3f6e5a', symbol = 'MO' where id = 1;
update blitz.auction set version = version + 1 where id = 1;
select blitz.publish_snapshot();
