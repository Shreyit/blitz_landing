-- Team 7 becomes Shadow Strikers; team 4 is styled SlytherWins. Republish so spectators see both.
update blitz.teams set name = 'SlytherWins' where id = 4;
update blitz.teams set name = 'Shadow Strikers', color = '#2b2b30', symbol = 'SS' where id = 7;
update blitz.auction set version = version + 1 where id = 1;
select blitz.publish_snapshot();
