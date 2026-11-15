-- 빠른 대전 매칭 점수 순위표 (Supabase 대시보드 → SQL Editor에 붙여 넣고 Run, 한 번만)
-- 한 사람에 한 줄. 읽기는 누구나(순위표), 쓰기는 본인 줄만. 이 표가 없어도 매칭은 되고 순위표만 '준비 중'으로 나옴.
-- 지금은 브라우저가 계산한 점수를 그대로 저장함 — 조작 방지(서버 판정)는 랭크전을 열 때 넣을 예정.
create table if not exists public.ratings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 16),
  rating     integer not null check (rating between 100 and 4000),
  games      integer not null default 0 check (games >= 0),
  wins       integer not null default 0 check (wins >= 0 and wins <= games),
  updated_at timestamptz not null default now()
);
create index if not exists ratings_rating on public.ratings (rating desc);

alter table public.ratings enable row level security;

drop policy if exists "ratings read all" on public.ratings;
create policy "ratings read all" on public.ratings for select using (true);

drop policy if exists "ratings insert own" on public.ratings;
create policy "ratings insert own" on public.ratings for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "ratings update own" on public.ratings;
create policy "ratings update own" on public.ratings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
