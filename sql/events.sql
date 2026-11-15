-- 접속 통계 (Supabase 대시보드 → SQL Editor에 붙여 넣고 Run, 한 번만)
-- 게임이 보내는 것: 사건 이름, 이 브라우저의 무작위 id(anon_id), 로그인했으면 user_id, 간단한 값(props). 이름·이메일은 보내지 않음.
-- 넣기는 누구나(게스트 포함), 읽기는 아무도 못 함 → 결과는 이 SQL Editor(관리자)에서만 조회.
-- 이 표가 없으면 게임은 한 번 실패한 뒤로 통계를 보내지 않고, 게임 진행에는 영향 없음.
create table if not exists public.events (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  name     text not null check (char_length(name) between 1 and 32),
  anon_id  text not null check (char_length(anon_id) between 1 and 24),
  user_id  uuid references auth.users (id) on delete set null,
  props    jsonb not null default '{}'::jsonb
);
create index if not exists events_at on public.events (at);
create index if not exists events_name_at on public.events (name, at);

alter table public.events enable row level security;

drop policy if exists "events insert any" on public.events;
create policy "events insert any" on public.events for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());

-- 사건 이름: visit(하루 첫 접속) · start(게임 시작: type, mode, diff) · guide(튜토리얼: done true=완료 / false=건너뜀, step)
--            match_end(경기 끝: mode, diff, won, pts, opts, rally) · quick_match(매칭 성공: wait 초, diff 점수 차) · quick_ai(대기자 없어 AI로)

-- ── 조회 예시 (필요할 때 하나씩 실행) ──
-- 날짜별 방문자 수 (한국 시간)
--   select (at at time zone 'Asia/Seoul')::date as day, count(distinct anon_id) as visitors from public.events where name = 'visit' group by 1 order by 1 desc;
-- 튜토리얼에서 몇 명이 끝까지 갔는지
--   select props->>'done' as done, count(distinct anon_id) from public.events where name = 'guide' group by 1;
-- 모드별 시작 횟수 (최근 7일)
--   select props->>'mode' as mode, count(*) from public.events where name = 'start' and at > now() - interval '7 days' group by 1 order by 2 desc;
-- AI 난이도별 승률
--   select props->>'diff' as diff, count(*) as games, round(avg(((props->>'won')::boolean)::int) * 100) as win_pct from public.events where name = 'match_end' and props->>'mode' = 'ai' group by 1;
-- 빠른 대전: 매칭 성공 대 AI 전환, 평균 대기 시간
--   select name, count(*), round(avg((props->>'wait')::numeric), 1) as avg_wait from public.events where name in ('quick_match', 'quick_ai') group by 1;
