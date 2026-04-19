create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  handicap_index numeric(4,1),
  default_tee text default 'yellow',
  created_at timestamptz not null default now()
);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  club_name text not null,
  holes_count int not null default 18,
  total_par int not null,
  created_at timestamptz not null default now()
);

create table if not exists course_holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  hole_number int not null,
  par int not null,
  hcp_index int not null,
  length_yellow int,
  length_red int,
  description text,
  unique(course_id, hole_number)
);

create table if not exists course_tees (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  tee_key text not null,
  label text not null,
  course_rating numeric(4,1),
  slope_rating int,
  tee_par int not null,
  unique(course_id, tee_key)
);

alter table profiles add column if not exists handicap_index numeric(4,1);
alter table profiles add column if not exists default_tee text default 'yellow';



create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete restrict,
  title text not null,
  scoring_mode text not null check (scoring_mode in ('strokeplay', 'stableford')),
  status text not null default 'active' check (status in ('active', 'completed')),
  current_hole int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists round_members (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('owner', 'player')),
  created_at timestamptz not null default now(),
  unique(round_id, user_id)
);

create table if not exists round_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  invited_email text,
  display_name text not null,
  handicap_index numeric(4,1),
  exact_handicap numeric(4,1),
  tee_key text,
  playing_handicap int,
  sort_order int not null default 1,
  active_from_hole int,
  active_to_hole int
);

create table if not exists hole_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  round_player_id uuid not null references round_players(id) on delete cascade,
  hole_number int,
  strokes int,
  unique(round_player_id, hole_number)
);

alter table if exists round_players add column if not exists active_from_hole int;
alter table if exists round_players add column if not exists active_to_hole int;
update round_players rp
set
  active_from_hole = coalesce(rp.active_from_hole, r.start_hole, 1),
  active_to_hole = coalesce(rp.active_to_hole, r.end_hole, 18)
from rounds r
where r.id = rp.round_id;

alter table if exists round_players alter column active_from_hole set not null;
alter table if exists round_players alter column active_to_hole set not null;
alter table if exists round_players
  drop constraint if exists round_players_active_hole_range;
alter table if exists round_players add constraint round_players_active_hole_range
  check (active_from_hole >= 1 and active_to_hole >= active_from_hole);

create or replace function public.user_can_access_round(target_round_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from rounds r
    where r.id = target_round_id
      and (
        r.owner_id = auth.uid()
        or exists (
          select 1
          from round_members rm
          where rm.round_id = r.id and rm.user_id = auth.uid()
        )
      )
  );
$$;

alter table profiles enable row level security;
alter table rounds enable row level security;
alter table round_members enable row level security;
alter table round_players enable row level security;
alter table hole_scores enable row level security;
alter table courses enable row level security;
alter table course_holes enable row level security;
alter table course_tees enable row level security;

create policy "profiles_select_authenticated" on profiles for select to authenticated using (true);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "courses_public_read" on courses for select using (true);
create policy "course_holes_public_read" on course_holes for select using (true);
create policy "course_tees_public_read" on course_tees for select using (true);

create policy "rounds_read_shared" on rounds
for select
using (public.user_can_access_round(id));

create policy "rounds_insert_owner" on rounds
for insert
with check (auth.uid() = owner_id);

create policy "rounds_update_shared" on rounds
for update
using (public.user_can_access_round(id))
with check (public.user_can_access_round(id));

create policy "round_members_read_shared" on round_members
for select
using (public.user_can_access_round(round_id));

create policy "round_members_insert_owner" on round_members
for insert
with check (
  exists (
    select 1 from rounds r where r.id = round_id and r.owner_id = auth.uid()
  )
);

create policy "round_players_shared_all" on round_players
for all
using (public.user_can_access_round(round_id))
with check (public.user_can_access_round(round_id));

create policy "hole_scores_shared_all" on hole_scores
for all
using (public.user_can_access_round(round_id))
with check (public.user_can_access_round(round_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, display_name, handicap_index, default_tee)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'handicap_index', '')::numeric,
    coalesce(new.raw_user_meta_data ->> 'default_tee', 'yellow')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        handicap_index = coalesce(public.profiles.handicap_index, excluded.handicap_index),
        default_tee = coalesce(public.profiles.default_tee, excluded.default_tee);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

