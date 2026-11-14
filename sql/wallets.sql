-- 재화(코인) 저장용 표 (Supabase 대시보드 → SQL Editor에 붙여 넣고 Run, 한 번만)
-- 한 사람에 한 줄. 읽기·쓰기 모두 본인 줄만. 이 표가 없어도 게임은 되고, 코인은 브라우저에만 저장됨.
-- 지금은 브라우저가 계산한 값을 그대로 저장함 — 조작 방지(서버 검증)는 랭크전을 열 때 함께 넣을 예정.
create table if not exists public.wallets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  coins      integer not null default 0 check (coins >= 0),
  total      integer not null default 0 check (total >= 0),
  updated_at timestamptz not null default now()
);

alter table public.wallets enable row level security;

drop policy if exists "wallet read own" on public.wallets;
create policy "wallet read own" on public.wallets for select to authenticated using (auth.uid() = user_id);

drop policy if exists "wallet insert own" on public.wallets;
create policy "wallet insert own" on public.wallets for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "wallet update own" on public.wallets;
create policy "wallet update own" on public.wallets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
