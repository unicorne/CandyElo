-- CandyElo initial schema
-- Tables: candies, votes
-- Function: cast_vote (transactional ELO update)

create extension if not exists "pgcrypto";

create table if not exists public.candies (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  brand             text,
  image_url         text,
  kcal_100g         numeric,
  sugar_100g        numeric,
  fat_100g          numeric,
  ingredients_short text,
  elo               numeric not null default 1500,
  matches           int     not null default 0,
  wins              int     not null default 0,
  created_at        timestamptz not null default now()
);

create table if not exists public.votes (
  id            uuid primary key default gen_random_uuid(),
  winner_id     uuid not null references public.candies(id) on delete cascade,
  loser_id      uuid not null references public.candies(id) on delete cascade,
  voter_session text,
  voter_ip_hash text,
  pair_token    text,
  created_at    timestamptz not null default now(),
  constraint different_candies check (winner_id <> loser_id)
);

create index if not exists votes_created_at_idx on public.votes (created_at desc);
create index if not exists votes_winner_id_idx  on public.votes (winner_id);
create index if not exists votes_loser_id_idx   on public.votes (loser_id);
create index if not exists candies_elo_idx      on public.candies (elo desc);

-- RLS: read public, no direct writes; writes go through SECURITY DEFINER function.
alter table public.candies enable row level security;
alter table public.votes   enable row level security;

drop policy if exists "candies are public read" on public.candies;
create policy "candies are public read" on public.candies
  for select using (true);

drop policy if exists "votes are public read" on public.votes;
create policy "votes are public read" on public.votes
  for select using (true);

-- Transactional ELO update + vote insert.
create or replace function public.cast_vote(
  p_winner_id     uuid,
  p_loser_id      uuid,
  p_voter_session text,
  p_voter_ip_hash text,
  p_pair_token    text,
  p_k             numeric default 32
) returns table (
  winner_id        uuid,
  loser_id         uuid,
  winner_elo_new   numeric,
  loser_elo_new    numeric,
  winner_elo_delta numeric
) language plpgsql security definer as $$
declare
  w_elo numeric;
  l_elo numeric;
  e_w   numeric;
  e_l   numeric;
  delta numeric;
begin
  if p_winner_id = p_loser_id then
    raise exception 'winner and loser must differ';
  end if;

  -- lock both rows in deterministic order to avoid deadlocks
  if p_winner_id < p_loser_id then
    select elo into w_elo from public.candies where id = p_winner_id for update;
    select elo into l_elo from public.candies where id = p_loser_id  for update;
  else
    select elo into l_elo from public.candies where id = p_loser_id  for update;
    select elo into w_elo from public.candies where id = p_winner_id for update;
  end if;

  if w_elo is null or l_elo is null then
    raise exception 'candy not found';
  end if;

  e_w   := 1.0 / (1.0 + power(10.0, (l_elo - w_elo) / 400.0));
  e_l   := 1.0 - e_w;
  delta := p_k * (1.0 - e_w);

  update public.candies
    set elo = w_elo + delta,
        matches = matches + 1,
        wins = wins + 1
    where id = p_winner_id;

  update public.candies
    set elo = l_elo - (p_k * (0.0 - e_l)) * -1, -- = l_elo - p_k*e_l
        matches = matches + 1
    where id = p_loser_id;

  insert into public.votes (winner_id, loser_id, voter_session, voter_ip_hash, pair_token)
  values (p_winner_id, p_loser_id, p_voter_session, p_voter_ip_hash, p_pair_token);

  return query
    select p_winner_id,
           p_loser_id,
           w_elo + delta,
           l_elo - p_k * e_l,
           delta;
end;
$$;

revoke all on function public.cast_vote(uuid, uuid, text, text, text, numeric) from public;
grant execute on function public.cast_vote(uuid, uuid, text, text, text, numeric) to anon, authenticated, service_role;

-- Realtime publication for the leaderboard.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'candies'
  ) then
    execute 'alter publication supabase_realtime add table public.candies';
  end if;
end $$;
