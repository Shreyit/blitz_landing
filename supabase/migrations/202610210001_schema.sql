-- Lesson 1: private tables hold the authoritative data; the public table is a
-- projection containing ONLY the information spectators may see.
create schema blitz;
revoke all on schema blitz from public, anon, authenticated;

create table blitz.organiser_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table blitz.sports (name text primary key);
insert into blitz.sports values
  ('Football'), ('Cricket'), ('Badminton'), ('Table tennis'),
  ('Weightlifting'), ('Chess'), ('Tug of war'), ('Dodgeball');
create table blitz.regions (name text primary key);
insert into blitz.regions values
  ('Andaman and Nicobar Islands'), ('Andhra Pradesh'), ('Arunachal Pradesh'), ('Assam'),
  ('Bihar'), ('Chandigarh'), ('Chhattisgarh'), ('Dadra and Nagar Haveli and Daman and Diu'),
  ('Delhi'), ('Goa'), ('Gujarat'), ('Haryana'), ('Himachal Pradesh'), ('Jammu and Kashmir'),
  ('Jharkhand'), ('Karnataka'), ('Kerala'), ('Ladakh'), ('Lakshadweep'), ('Madhya Pradesh'),
  ('Maharashtra'), ('Manipur'), ('Meghalaya'), ('Mizoram'), ('Nagaland'), ('Odisha'),
  ('Puducherry'), ('Punjab'), ('Rajasthan'), ('Sikkim'), ('Tamil Nadu'), ('Telangana'),
  ('Tripura'), ('Uttar Pradesh'), ('Uttarakhand'), ('West Bengal');

create table blitz.registrations (
  id uuid primary key,
  name text not null check (length(btrim(name)) between 2 and 100 and name !~ '[[:cntrl:]]'),
  email text not null check (email = lower(email) and length(email) <= 200
    and email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@(stud\.tiss\.ac\.in|tiss\.edu)$'),
  role text not null check (role in ('player', 'volunteer')),
  programme text not null check (programme in ('BSASS', 'BSW')),
  year integer not null check (year between 1 and 4),
  age integer not null check (age between 1 and 120),
  gender text not null check (gender in ('male', 'female', 'others')),
  region text not null references blitz.regions(name),
  played_before boolean not null,
  sports text[] not null default '{}',
  volunteer_department text,
  volunteer_rationale text,
  photo_key text not null check (photo_key = id::text || '.jpg'),
  verified boolean not null default false,
  verification_hash text not null unique check (verification_hash ~ '^[0-9a-f]{64}$'),
  verification_expires timestamptz not null default now() + interval '48 hours',
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (email, role),
  check (
    (role = 'player' and cardinality(sports) between 1 and 8
      and volunteer_department is null and volunteer_rationale is null)
    or (role = 'volunteer' and cardinality(sports) = 0
      and volunteer_department in ('Digital & Marketing', 'Operations', 'Medical', 'Sustainability')
      and volunteer_department is not null and volunteer_rationale is not null
      and length(btrim(volunteer_rationale)) between 1 and 2000)
  )
);

create table blitz.teams (
  id integer primary key check (id between 1 and 8),
  name text not null check (length(btrim(name)) between 2 and 60 and name !~ '[[:cntrl:]]'),
  name_key text generated always as (lower(name)) stored,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  symbol text not null,
  purse integer not null default 2000 check (purse between 0 and 2000),
  constraint teams_name_unique unique (name_key) deferrable initially immediate
);
insert into blitz.teams(id, name, color, symbol) values
  (1, 'Court Kings', '#4c7051', 'CK'), (2, 'The Strikers', '#bd6039', 'ST'),
  (3, 'Blue Wolves', '#466da3', 'BW'), (4, 'Wild Aces', '#9671a5', 'WA'),
  (5, 'Red Hawks', '#b04f51', 'RH'), (6, 'Trailblazers', '#9b7929', 'TB'),
  (7, 'The Mavericks', '#3c8a88', 'MV'), (8, 'Thunder Club', '#6e638c', 'TC');

create table blitz.auction (
  id integer primary key default 1 check (id = 1),
  phase text not null default 'idle' check (phase in ('idle', 'active', 'allocation', 'complete')),
  round integer not null default 0 check (round between 0 and 3),
  queue uuid[] not null default '{}',
  unsold uuid[] not null default '{}',
  cursor integer not null default 1 check (cursor >= 1),
  bid integer not null default 0 check (bid >= 0),
  leader integer references blitz.teams(id),
  version integer not null default 0 check (version >= 0),
  total integer not null default 0 check (total >= 0),
  check ((bid = 0 and leader is null) or (bid > 0 and leader is not null))
);
insert into blitz.auction default values;

create table blitz.bids (
  id bigint generated always as identity primary key,
  player_id uuid not null references blitz.registrations(id),
  team_id integer not null references blitz.teams(id),
  amount integer not null check (amount > 0),
  round integer not null check (round between 0 and 3),
  cancelled boolean not null default false,
  command_id uuid not null unique,
  created_at timestamptz not null default now()
);
create table blitz.assignments (
  id bigint generated always as identity primary key,
  player_id uuid not null unique references blitz.registrations(id),
  team_id integer not null references blitz.teams(id),
  price integer not null check (price >= 0),
  source text not null check (source in ('auction', 'random')),
  created_at timestamptz not null default now()
);
create index assignments_team on blitz.assignments(team_id);
create table blitz.audit_events (
  id bigint generated always as identity primary key,
  command_id uuid not null unique,
  action text not null,
  actor uuid not null references auth.users(id),
  request jsonb not null,
  details jsonb not null,
  created_at timestamptz not null default now()
);
create table blitz.email_outbox (
  id bigint generated always as identity primary key,
  key text not null unique,
  recipient text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  created_at timestamptz not null default now()
);
create index mail_pending on blitz.email_outbox(status, next_attempt);
create table blitz.rate_limits (
  key text primary key,
  count integer not null,
  expires_at timestamptz not null
);

-- Defence in depth: no browser role receives access to the private schema.
-- RLS remains enabled even if table grants are accidentally broadened later.
do $$
declare t record;
begin
  for t in select tablename from pg_catalog.pg_tables where schemaname = 'blitz' loop
    execute format('alter table blitz.%I enable row level security', t.tablename);
  end loop;
end $$;

create table public.auction_public_state (
  id integer primary key check (id = 1),
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.auction_public_state enable row level security;
revoke all on public.auction_public_state from anon, authenticated;
grant select on public.auction_public_state to anon, authenticated;
create policy spectator_read on public.auction_public_state for select to anon, authenticated using (true);
