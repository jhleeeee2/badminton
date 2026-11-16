-- 개발자 화면용 (Supabase 대시보드 → SQL Editor에 붙여 넣고 Run, 한 번만)
-- 게임 제목을 11번 누르면 나오는 개발자 화면이 이 함수(dev_report)를 부름.
-- 게임 안의 비밀번호는 화면을 여는 장치일 뿐이고, 실제 보호는 여기서 함:
--   admins 표에 들어 있는 계정으로 로그인했을 때만 함수가 값을 돌려줌. 그 밖의 계정·게스트는 거절.
-- admins 표는 게임에서 읽거나 쓸 수 없음(정책 없음) — 이 SQL Editor에서만 관리.

create table if not exists public.admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- ★ 개발자 계정 등록: 아래 이메일을 게임에 가입한 내 이메일로 바꾼 뒤 이 줄의 주석(--)을 지우고 실행
-- insert into public.admins (user_id) select id from auth.users where email = '여기에@내.이메일' on conflict do nothing;

create or replace function public.dev_report() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o jsonb := '{}'::jsonb;
  v jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  -- 가입자 (최근 가입 순, 500명까지)
  begin
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
      select u.id, u.email, u.created_at, u.last_sign_in_at, p.nickname
      from auth.users u left join public.profiles p on p.id = u.id
      order by u.created_at desc limit 500) x;
    o := o || jsonb_build_object('users', v, 'user_count', (select count(*) from auth.users));
  exception when undefined_table or undefined_column then o := o || jsonb_build_object('users', null); end;

  -- 경기 기록 (계정별 합계 · 난이도별 합계)
  begin
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
      select user_id, count(*) as games, count(*) filter (where won) as wins, max(played_at) as last
      from public.matches group by user_id) x;
    o := o || jsonb_build_object('matches', v);
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
      select game_type, difficulty, count(*) as games, count(*) filter (where won) as wins
      from public.matches group by 1, 2 order by 3 desc) x;
    o := o || jsonb_build_object('match_diff', v);
  exception when undefined_table or undefined_column then o := o || jsonb_build_object('matches', null); end;

  begin
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
      select user_id, coins, total, gear, updated_at from public.wallets) x;
    o := o || jsonb_build_object('wallets', v);
  exception when undefined_table or undefined_column then o := o || jsonb_build_object('wallets', null); end;

  begin
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (select user_id, str, agi, jud from public.progress) x;
    o := o || jsonb_build_object('progress', v);
  exception when undefined_table or undefined_column then o := o || jsonb_build_object('progress', null); end;

  begin
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (select user_id, rating, games, wins from public.ratings) x;
    o := o || jsonb_build_object('ratings', v);
  exception when undefined_table or undefined_column then o := o || jsonb_build_object('ratings', null); end;

  begin
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
      select day, kind, count(*) as players, max(score) as best from public.daily_scores group by 1, 2 order by 1 desc limit 14) x;
    o := o || jsonb_build_object('daily', v);
  exception when undefined_table or undefined_column then o := o || jsonb_build_object('daily', null); end;

  -- 접속 통계 (events 표 · 날짜는 한국 시간)
  begin
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
      select (at at time zone 'Asia/Seoul')::date as day,
             count(distinct anon_id) filter (where name = 'visit') as visitors,
             count(distinct anon_id) as active,
             count(*) filter (where name = 'start') as starts,
             count(*) filter (where name = 'match_end') as ends
      from public.events where at > now() - interval '30 days' group by 1 order by 1 desc) x;
    o := o || jsonb_build_object('ev_days', v);
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
      select coalesce(props->>'type', '-') as type, coalesce(props->>'mode', '-') as mode, count(*) as n
      from public.events where name = 'start' and at > now() - interval '7 days' group by 1, 2 order by 3 desc) x;
    o := o || jsonb_build_object('ev_modes', v);
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
      select coalesce(props->>'diff', '-') as diff, count(*) as games,
             count(*) filter (where props->>'won' = 'true') as wins
      from public.events where name = 'match_end' and props->>'mode' = 'ai' group by 1 order by 2 desc) x;
    o := o || jsonb_build_object('ev_ai', v);
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
      select coalesce(props->>'done', '-') as done, count(distinct anon_id) as n
      from public.events where name = 'guide' group by 1) x;
    o := o || jsonb_build_object('ev_guide', v);
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
      select name, count(*) as n, round(avg(nullif(props->>'wait', '')::numeric), 1) as avg_wait
      from public.events where name in ('quick_match', 'quick_ai') group by 1) x;
    o := o || jsonb_build_object('ev_quick', v);
    o := o || jsonb_build_object('ev_total', (select count(*) from public.events),
                                 'ev_people', (select count(distinct anon_id) from public.events));
  exception when undefined_table or undefined_column then o := o || jsonb_build_object('ev_days', null); end;

  return o || jsonb_build_object('at', now());
end $$;

revoke all on function public.dev_report() from public, anon;
grant execute on function public.dev_report() to authenticated;
