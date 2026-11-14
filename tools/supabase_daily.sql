-- 일일 챌린지 순위표 (Supabase 대시보드 → SQL Editor에 붙여 넣고 Run, 한 번만)
-- 한 사람이 하루에 한 줄(그날 최고 점수). 읽기는 누구나(순위표), 쓰기는 본인 줄만.
create table if not exists public.daily_scores (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  kind       text not null check (kind in ('str', 'agi', 'jud')),
  score      integer not null check (score >= 0 and score <= 2750),
  nickname   text not null check (char_length(nickname) between 1 and 16),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists daily_scores_day_score on public.daily_scores (day, score desc);

alter table public.daily_scores enable row level security;

drop policy if exists "daily read all" on public.daily_scores;
create policy "daily read all" on public.daily_scores for select using (true);

drop policy if exists "daily insert own" on public.daily_scores;
create policy "daily insert own" on public.daily_scores for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "daily update own" on public.daily_scores;
create policy "daily update own" on public.daily_scores for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
