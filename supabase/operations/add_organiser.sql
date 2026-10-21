-- Run manually in your DEVELOPMENT project's SQL editor after creating a
-- confirmed Auth user through Authentication > Users > Add user.
-- Replace the example address first. No browser API can grant this membership.
insert into blitz.organiser_users(user_id)
select id from auth.users where lower(email) = lower('replace-me@tiss.edu')
on conflict (user_id) do nothing;

-- Check the result. Zero rows means the Auth user/address was not found.
select u.id, u.email from auth.users u
join blitz.organiser_users o on o.user_id = u.id;
