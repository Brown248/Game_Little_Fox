-- Little Fox Game — Supabase schema
-- Run this in the Supabase SQL editor once per project.
-- Safe to re-run: tables use "if not exists" and the views are replaced.
-- NOTE: if you set this project up before, re-run the whole file — the player
-- identity changed (no class column) and both views changed with it.

create extension if not exists "pgcrypto";

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Identity is the name alone, compared case- and whitespace-insensitively:
-- "  Mint " is the same explorer as "mint". This has to be a unique INDEX, not
-- a unique table constraint — Postgres constraints only accept bare column
-- names, so `unique (lower(trim(name)))` inside the table is a syntax error.
create unique index if not exists players_name_key
  on players (lower(trim(name)));

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  unit_id text not null,
  score int not null,
  max_score int not null,
  correct_count int not null,
  total_questions int not null,
  time_seconds int not null,
  game_type_breakdown jsonb,
  completed_at timestamptz not null default now()
);

create index if not exists idx_attempts_unit on attempts (unit_id);
create index if not exists idx_attempts_player on attempts (player_id);

-- Ranking per unit: best attempt per player, highest score then fastest time
create or replace view v_unit_ranking as
select distinct on (player_id, unit_id)
  a.player_id, p.name, a.unit_id,
  a.score, a.max_score, a.time_seconds, a.completed_at
from attempts a
join players p on p.id = a.player_id
order by player_id, unit_id, score desc, time_seconds asc;

-- Overall ranking across all units: accuracy-weighted, not raw score sum.
-- name is joined in here on purpose: PostgREST cannot resolve an embedded
-- players(...) relationship through an aggregate view that is itself built on a
-- view, so the leaderboard would have no names to show.
--
-- Whole units ONLY. A unit can also be played one part at a time, and those
-- attempts are stored under "unit-NN-part-N" so each part gets its own board.
-- Counting both here would score the same questions twice for anyone who
-- played a part and then the whole unit. The `unit-NN` shape is what separates
-- them — see partScoreId() in lib/format.ts, and keep the two in step.
drop view if exists v_overall_ranking;
create view v_overall_ranking as
select
  r.player_id,
  p.name,
  sum(r.score)::float / nullif(sum(r.max_score), 0) as overall_accuracy,
  count(distinct r.unit_id) as units_completed
from v_unit_ranking r
join players p on p.id = r.player_id
where r.unit_id ~ '^unit-[0-9]{2}$'
group by r.player_id, p.name;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Students play with the anon key, which reaches Postgres as the `anon` role.
-- They must be able to sign themselves up and record an attempt, and nothing
-- else: an attempt is a permanent record, so anon gets no update and no delete.
-- The admin pages use the service-role key, which bypasses RLS entirely, so
-- renaming and merging students still works.
-- ---------------------------------------------------------------------------

alter table players enable row level security;
alter table attempts enable row level security;

drop policy if exists players_read on players;
drop policy if exists players_create on players;
drop policy if exists attempts_read on attempts;
drop policy if exists attempts_create on attempts;

-- Names appear on a public leaderboard by design, so reads are open.
create policy players_read on players
  for select to anon, authenticated using (true);

create policy players_create on players
  for insert to anon, authenticated with check (
    length(trim(name)) between 1 and 60
  );

create policy attempts_read on attempts
  for select to anon, authenticated using (true);

-- Sanity bounds only — this is a classroom, not a public contest, and a
-- student cannot be authenticated to check anything stronger.
create policy attempts_create on attempts
  for insert to anon, authenticated with check (
    score >= 0
    and max_score >= 0
    and score <= max_score
    and correct_count >= 0
    and total_questions >= 0
    and correct_count <= total_questions
    and time_seconds >= 0
  );

-- A policy only narrows a grant, it cannot create one. Supabase hands anon
-- broad table grants by default (see tests/db/init/00-roles.sql, which mirrors
-- that setup), so these lines are normally a no-op — but stating them means
-- this file also works on a project whose defaults differ, instead of failing
-- with "permission denied for table players" in front of a class.
grant usage on schema public to anon, authenticated;
grant select, insert on players, attempts to anon, authenticated;

-- No update/delete policy exists for anon, so both are denied. Revoking the
-- grants as well means the failure is a permission error, not a silent no-op.
revoke update, delete on players from anon, authenticated;
revoke update, delete on attempts from anon, authenticated;

-- Views are read by anon for the leaderboards.
grant select on v_unit_ranking, v_overall_ranking to anon, authenticated;
