-- 랭크전: 서버가 관리하는 점수 (Supabase 대시보드 → SQL Editor에 붙여 넣고 Run, 한 번만 · 다시 실행해도 됨)
-- 원칙
--   · 랭크 점수(ranks)는 게임(브라우저)이 직접 고칠 수 없음. 아래 함수만 고침.
--   · 한 경기는 두 사람이 모두 서버에 "이 상대와 한다"고 알려야 열림(rank_open).
--   · 끝나면 두 사람이 각자 결과를 보고(rank_report). 둘의 보고가 일치할 때만 점수 반영.
--     서로 다르면 '분쟁'(점수 변화 없음, 두 사람의 분쟁 횟수 +1).
--   · 한쪽만 보고한 경우: 상대가 20초 넘게 신호(rank_beat)를 보내지 않았을 때만 그 보고를 인정.
--   · 수치는 모두 [게임]용으로 정한 값.

create table if not exists public.ranks (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null default '선수',
  rating     integer not null default 1000,
  games      integer not null default 0,
  wins       integer not null default 0,
  streak     integer not null default 0,      -- 연승(+) / 연패(−)
  peak       integer not null default 1000,
  disputes   integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists ranks_rating on public.ranks (rating desc);
alter table public.ranks enable row level security;
drop policy if exists "ranks read all" on public.ranks;
create policy "ranks read all" on public.ranks for select using (true);
-- 쓰기 정책 없음 → 함수만 고칠 수 있음

create table if not exists public.rank_matches (
  id         uuid primary key default gen_random_uuid(),
  a          uuid not null references auth.users (id) on delete cascade,   -- 두 사람 중 id가 작은 쪽
  b          uuid not null references auth.users (id) on delete cascade,
  room       text not null,
  status     text not null default 'pending',  -- pending → live → done / void / disputed
  rated      boolean not null default true,    -- false = 같은 상대와 하루 한도를 넘어 점수 미반영
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at   timestamptz,
  a_seen     timestamptz, b_seen timestamptz,
  a_claim    jsonb, b_claim jsonb,             -- { my, opp, kind: done|left|resign, flags }
  a_claim_at timestamptz, b_claim_at timestamptz,
  winner     uuid,
  a_score    integer, b_score integer,
  a_before   integer, a_after integer, b_before integer, b_after integer,
  how        text                               -- agree / forfeit / resign / solo / mismatch / flags / short / both_left / expired
);
create index if not exists rank_matches_a on public.rank_matches (a, created_at desc);
create index if not exists rank_matches_b on public.rank_matches (b, created_at desc);
alter table public.rank_matches enable row level security;
drop policy if exists "rank_matches read own" on public.rank_matches;
create policy "rank_matches read own" on public.rank_matches for select to authenticated using (auth.uid() = a or auth.uid() = b);

-- 내 줄이 없으면 만들고 닉네임을 맞춤
create or replace function public.rank__ensure(p_uid uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare n text;
begin
  select nickname into n from public.profiles where id = p_uid;
  n := left(coalesce(nullif(trim(n), ''), '선수'), 16);
  insert into public.ranks (user_id, nickname) values (p_uid, n)
  on conflict (user_id) do update set nickname = excluded.nickname where public.ranks.nickname is distinct from excluded.nickname;
end $$;

-- 11점 경기의 끝난 점수로 맞는지 (2점 차 듀스, 20점 상한)
create or replace function public.rank__valid(w integer, l integer) returns boolean
language sql immutable as $$
  select w is not null and l is not null and l >= 0 and w > l and (
    (w between 11 and 19 and w - l >= 2 and (w = 11 or w - l = 2)) or (w = 20 and l in (18, 19)))
$$;

-- 한 경기 마무리: p_winner가 null이면 점수 변화 없이 p_status로 닫음
create or replace function public.rank__close(p_id uuid, p_status text, p_how text, p_winner uuid, p_as integer, p_bs integer) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.rank_matches; ra public.ranks; rb public.ranks; ea numeric; ka integer; kb integer; na integer; nb integer; sa numeric;
begin
  select * into m from public.rank_matches where id = p_id for update;
  if m.status <> 'live' then return; end if;
  if p_status = 'disputed' then
    update public.ranks set disputes = disputes + 1, updated_at = now() where user_id in (m.a, m.b);
  end if;
  if p_winner is null or not m.rated then
    update public.rank_matches set status = p_status, how = p_how || case when p_winner is not null and not m.rated then '_unrated' else '' end,
      winner = p_winner, a_score = p_as, b_score = p_bs, ended_at = now() where id = p_id;
    return;
  end if;
  perform public.rank__ensure(m.a); perform public.rank__ensure(m.b);
  select * into ra from public.ranks where user_id = m.a for update;
  select * into rb from public.ranks where user_id = m.b for update;
  ea := 1 / (1 + power(10, (rb.rating - ra.rating) / 400.0));      -- a가 이길 기대 확률 (엘로)
  sa := case when p_winner = m.a then 1 else 0 end;
  ka := case when ra.games < 10 then 40 else 32 end;                -- 처음 10경기는 변동 폭이 큼
  kb := case when rb.games < 10 then 40 else 32 end;
  na := greatest(100, round(ra.rating + ka * (sa - ea))::integer);
  nb := greatest(100, round(rb.rating + kb * ((1 - sa) - (1 - ea)))::integer);
  update public.ranks set rating = na, games = games + 1, wins = wins + sa::integer, peak = greatest(peak, na),
    streak = case when sa = 1 then greatest(streak, 0) + 1 else least(streak, 0) - 1 end, updated_at = now() where user_id = m.a;
  update public.ranks set rating = nb, games = games + 1, wins = wins + (1 - sa)::integer, peak = greatest(peak, nb),
    streak = case when sa = 0 then greatest(streak, 0) + 1 else least(streak, 0) - 1 end, updated_at = now() where user_id = m.b;
  update public.rank_matches set status = p_status, how = p_how, winner = p_winner, a_score = p_as, b_score = p_bs,
    a_before = ra.rating, a_after = na, b_before = rb.rating, b_after = nb, ended_at = now() where id = p_id;
end $$;

-- 경기 상태를 "부른 사람 기준"으로 돌려줌
create or replace function public.rank__view(p_id uuid, p_uid uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.rank_matches; r public.ranks; me_a boolean;
begin
  select * into m from public.rank_matches where id = p_id;
  select * into r from public.ranks where user_id = p_uid;
  me_a := m.a = p_uid;
  return jsonb_build_object('id', m.id, 'status', m.status, 'how', m.how, 'rated', m.rated,
    'won', case when m.winner is null then null else m.winner = p_uid end,
    'before', case when me_a then m.a_before else m.b_before end,
    'after', case when me_a then m.a_after else m.b_after end,
    'rating', r.rating, 'games', r.games, 'wins', r.wins, 'streak', r.streak, 'peak', r.peak);
end $$;

-- 내 랭크 정보 (+ 내 순위)
create or replace function public.rank_me() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); r public.ranks; pos integer;
begin
  if u is null then raise exception 'login_required' using errcode = '42501'; end if;
  perform public.rank__ensure(u);
  select * into r from public.ranks where user_id = u;
  select count(*) + 1 into pos from public.ranks where games >= 5 and rating > r.rating;
  return jsonb_build_object('rating', r.rating, 'games', r.games, 'wins', r.wins, 'streak', r.streak, 'peak', r.peak, 'disputes', r.disputes,
    'pos', case when r.games >= 5 then pos else null end);
end $$;

-- 경기 열기: 두 사람이 서로를 상대로 지목해야 'live'가 됨. id가 작은 쪽이 만들고 큰 쪽이 들어감
create or replace function public.rank_open(p_opp uuid, p_room text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); m public.rank_matches; today integer;
begin
  if u is null then raise exception 'login_required' using errcode = '42501'; end if;
  if p_opp is null or p_opp = u or not exists (select 1 from auth.users where id = p_opp) then raise exception 'bad_opponent'; end if;
  if p_room is null or p_room !~ '^[A-Z0-9]{5}$' then raise exception 'bad_room'; end if;
  perform public.rank__ensure(u);
  -- 묵은 경기 정리: 60초 넘게 안 열린 것 · 30분 넘게 안 끝난 것
  update public.rank_matches set status = 'void', how = 'expired', ended_at = now()
    where (a = u or b = u) and ((status = 'pending' and created_at < now() - interval '60 seconds') or (status = 'live' and started_at < now() - interval '30 minutes'));
  if u < p_opp then
    select * into m from public.rank_matches where a = u and b = p_opp and room = p_room and status in ('pending', 'live') order by created_at desc limit 1;
    if not found then
      select count(*) into today from public.rank_matches
        where a = u and b = p_opp and status = 'done' and rated and (ended_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date;
      insert into public.rank_matches (a, b, room, rated, a_seen) values (u, p_opp, p_room, today < 3, now()) returning * into m;
    end if;
  else
    select * into m from public.rank_matches where a = p_opp and b = u and room = p_room and status in ('pending', 'live') order by created_at desc limit 1 for update;
    if not found then return jsonb_build_object('status', 'none'); end if;
    if m.status = 'pending' then
      update public.rank_matches set status = 'live', started_at = now(), a_seen = now(), b_seen = now() where id = m.id returning * into m;
    end if;
  end if;
  return jsonb_build_object('id', m.id, 'status', m.status, 'rated', m.rated);
end $$;

-- 경기 중 신호 (10초마다): "나 아직 있음". 이미 끝난 경기면 결과를 돌려줌
create or replace function public.rank_beat(p_match uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); m public.rank_matches;
begin
  select * into m from public.rank_matches where id = p_match;
  if not found or u is null or (m.a <> u and m.b <> u) then raise exception 'not_your_match' using errcode = '42501'; end if;
  if m.status in ('pending', 'live') then
    if m.a = u then update public.rank_matches set a_seen = now() where id = p_match;
    else update public.rank_matches set b_seen = now() where id = p_match; end if;
  end if;
  return public.rank__view(p_match, u);
end $$;

-- 결과 보고. 같은 값으로 다시 부르면 현재 상태를 돌려줌 (상대 보고를 기다리는 동안 반복 호출)
--   p_kind: done = 끝까지 함 · left = 상대가 나감 · resign = 내가 나감(기권)
create or replace function public.rank_report(p_match uuid, p_my integer, p_opp integer, p_kind text, p_flags integer default 0) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); m public.rank_matches; me_a boolean; mine jsonb; theirs jsonb; mine_at timestamptz; their_seen timestamptz;
  my integer; op integer; tm integer; too integer; dur numeric; w uuid;
begin
  select * into m from public.rank_matches where id = p_match for update;
  if not found or u is null or (m.a <> u and m.b <> u) then raise exception 'not_your_match' using errcode = '42501'; end if;
  if m.status <> 'live' then return public.rank__view(p_match, u); end if;
  if p_kind not in ('done', 'left', 'resign') then raise exception 'bad_kind'; end if;
  me_a := m.a = u;
  my := greatest(0, least(30, coalesce(p_my, 0))); op := greatest(0, least(30, coalesce(p_opp, 0)));
  -- 첫 보고만 남김 (나중에 바꿔 말할 수 없음)
  if me_a and m.a_claim is null then
    update public.rank_matches set a_claim = jsonb_build_object('my', my, 'opp', op, 'kind', p_kind, 'flags', greatest(0, coalesce(p_flags, 0))), a_claim_at = now(), a_seen = now() where id = p_match returning * into m;
  elsif not me_a and m.b_claim is null then
    update public.rank_matches set b_claim = jsonb_build_object('my', my, 'opp', op, 'kind', p_kind, 'flags', greatest(0, coalesce(p_flags, 0))), b_claim_at = now(), b_seen = now() where id = p_match returning * into m;
  end if;
  mine := case when me_a then m.a_claim else m.b_claim end;  theirs := case when me_a then m.b_claim else m.a_claim end;
  mine_at := case when me_a then m.a_claim_at else m.b_claim_at end;  their_seen := case when me_a then m.b_seen else m.a_seen end;
  my := (mine->>'my')::integer; op := (mine->>'opp')::integer;
  dur := extract(epoch from (now() - m.started_at));

  if mine->>'kind' = 'resign' then                                   -- 기권: 바로 패배
    perform public.rank__close(p_match, 'done', 'resign', case when me_a then m.b else m.a end, case when me_a then my else op end, case when me_a then op else my end);
  elsif theirs is not null then
    tm := (theirs->>'my')::integer; too := (theirs->>'opp')::integer;
    if theirs->>'kind' = 'resign' then
      perform public.rank__close(p_match, 'done', 'resign', u, case when me_a then too else tm end, case when me_a then tm else too end);
    elsif mine->>'kind' = 'left' and theirs->>'kind' = 'left' then   -- 둘 다 "상대가 나갔다" (연결이 끊긴 경우) → 무효
      perform public.rank__close(p_match, 'void', 'both_left', null, null, null);
    elsif mine->>'kind' = 'done' and theirs->>'kind' = 'done' and my = too and op = tm and public.rank__valid(greatest(my, op), least(my, op)) then
      if coalesce((mine->>'flags')::integer, 0) >= 2 or coalesce((theirs->>'flags')::integer, 0) >= 2 then   -- 점수는 같지만 판정 이상 신고가 2번 이상
        perform public.rank__close(p_match, 'disputed', 'flags', null, case when me_a then my else op end, case when me_a then op else my end);
      elsif dur < 40 then
        perform public.rank__close(p_match, 'void', 'short', null, null, null);
      else
        w := case when my > op then u when me_a then m.b else m.a end;
        perform public.rank__close(p_match, 'done', 'agree', w, case when me_a then my else op end, case when me_a then op else my end);
      end if;
    else
      perform public.rank__close(p_match, 'disputed', 'mismatch', null, null, null);
    end if;
  elsif mine_at < now() - interval '12 seconds' and (their_seen is null or their_seen < now() - interval '20 seconds') then
    -- 상대가 보고도 신호도 없음 → 내 보고만으로 마무리
    if mine->>'kind' = 'left' then
      if dur < 30 then perform public.rank__close(p_match, 'void', 'short', null, null, null);
      else perform public.rank__close(p_match, 'done', 'forfeit', u, case when me_a then my else op end, case when me_a then op else my end); end if;
    elsif public.rank__valid(greatest(my, op), least(my, op)) and dur >= 40 then
      w := case when my > op then u when me_a then m.b else m.a end;
      perform public.rank__close(p_match, 'done', 'solo', w, case when me_a then my else op end, case when me_a then op else my end);
    else
      perform public.rank__close(p_match, 'void', 'short', null, null, null);
    end if;
  end if;
  return public.rank__view(p_match, u);
end $$;

-- 속 함수는 게임에서 직접 못 부르게
revoke all on function public.rank__ensure(uuid) from public, anon, authenticated;
revoke all on function public.rank__close(uuid, text, text, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.rank__view(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rank_me() from public, anon;
revoke all on function public.rank_open(uuid, text) from public, anon;
revoke all on function public.rank_beat(uuid) from public, anon;
revoke all on function public.rank_report(uuid, integer, integer, text, integer) from public, anon;
grant execute on function public.rank_me() to authenticated;
grant execute on function public.rank_open(uuid, text) to authenticated;
grant execute on function public.rank_beat(uuid) to authenticated;
grant execute on function public.rank_report(uuid, integer, integer, text, integer) to authenticated;

-- 조회 예시: 분쟁이 잦은 계정 / 최근 경기
--   select nickname, rating, games, disputes from public.ranks where disputes > 0 order by disputes desc;
--   select status, how, a_score, b_score, a_before, a_after, b_before, b_after, a_claim, b_claim, ended_at from public.rank_matches order by created_at desc limit 30;
