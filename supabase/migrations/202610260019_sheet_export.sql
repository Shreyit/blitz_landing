-- Read-only export for the organisers' Google Sheet. Service-only: the website
-- calls it with the server key after checking a separate SHEETS_EXPORT_TOKEN.
-- Returns full registration details plus any team assignment; never the photo
-- key or legacy verification fields.
create function public.blitz_sheet_export() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'generated_at', now(),
    'auction_phase', (select phase from blitz.auction where id = 1),
    'rows', coalesce((select jsonb_agg(
      (to_jsonb(r) - 'verification_hash' - 'verification_expires' - 'photo_key' - 'verified')
      || jsonb_build_object('team', t.name, 'price', x.price, 'assignment', x.source)
      order by r.created_at)
      from blitz.registrations r
      left join blitz.assignments x on x.player_id = r.id
      left join blitz.teams t on t.id = x.team_id), '[]'::jsonb));
$$;
revoke execute on function public.blitz_sheet_export() from public, anon, authenticated;
grant execute on function public.blitz_sheet_export() to service_role;
