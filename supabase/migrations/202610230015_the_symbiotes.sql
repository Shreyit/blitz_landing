-- Team 8 becomes The Symbiotes. Republish so spectators see the new name.
update blitz.teams set name = 'The Symbiotes', color = '#4a4f5c', symbol = 'SY' where id = 8;
update blitz.auction set version = version + 1 where id = 1;
select blitz.publish_snapshot();
