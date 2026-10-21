-- Lesson 4: the storage bucket is private. The Next.js photo endpoint checks
-- eligibility through blitz_photo before reading bytes using server credentials.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('blitz-photos', 'blitz-photos', false, 5242880, array['image/jpeg']);

-- A public channel carries INVALIDATION NOTIFICATIONS, never private records.
-- Public-channel messages are not trusted as auction state: viewers fetch the
-- authoritative read-only projection on receipt. No browser gets table writes.
create function blitz.notify_auction() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('version', (new.snapshot->>'version')::integer),
    'auction_changed', 'blitz:auction', false);
  return new;
end $$;
revoke execute on function blitz.notify_auction() from public, anon, authenticated;
create trigger auction_broadcast after update on public.auction_public_state
  for each row execute function blitz.notify_auction();
