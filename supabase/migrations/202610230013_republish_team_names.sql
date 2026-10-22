-- Migrations 010–012 renamed teams 4–6 but did not rebuild the public
-- projection, so spectators kept seeing the old names. Bump the version so
-- connected browsers accept the new state, then republish the snapshot.
update blitz.auction set version = version + 1 where id = 1;
select blitz.publish_snapshot();
