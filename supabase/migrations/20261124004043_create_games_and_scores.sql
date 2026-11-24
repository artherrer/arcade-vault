-- Juegos conectados al leaderboard. El catálogo visual sigue en lib/games.ts.
create table public.games (
  id         text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  created_at timestamptz not null default now()
);

insert into public.games (id) values ('rocas');

alter table public.games enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);
-- Sin insert/update/delete desde la API: los juegos se conectan por migración.

create table public.scores (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  game_id     text not null references public.games (id) on delete restrict,
  score       integer not null check (score > 0 and score <= 10000000),
  level       integer check (level is null or level >= 1),
  duration_ms integer not null check (duration_ms >= 1000),
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
create index scores_user_id_idx on public.scores (user_id);

alter table public.scores enable row level security;

-- Las puntuaciones son públicas (rankings).
create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);

-- Cada usuario solo inserta filas propias. Sin update ni delete.
create policy "scores_insert_own" on public.scores
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Mejor puntuación de cada jugador por juego (en empate, la más antigua).
create view public.leaderboard
with (security_invoker = true) as
select distinct on (s.game_id, s.user_id)
  s.game_id, s.user_id, p.username, s.score, s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.game_id, s.user_id, s.score desc, s.created_at asc;
