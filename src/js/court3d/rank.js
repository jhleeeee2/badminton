// court3d/rank.js — 랭크전: 서버(Supabase 함수)가 점수를 관리하는 1:1 대전 (sql/ranked.sql)
//   흐름
//   · 로그인 필수. 대기열은 빠른 대전과 같은 방식(Quick3)이되 채널이 따로(RANK3.CH)이고 계정 id를 함께 알림
//   · 상대를 찾으면 두 사람 모두 rank_open(상대 id, 방 코드) → 서버에 경기가 열림
//   · 경기 중 10초마다 rank_beat ("나 아직 있음"). 끝나면 rank_report로 각자 결과 보고
//     → 두 보고가 같을 때만 서버가 랭크 점수를 계산. 다르면 분쟁(변화 없음)
//   · 나가면(Esc) 기권 = 패배. 상대가 나가면 남은 쪽이 'left'로 보고 → 상대 신호가 20초 넘게 없으면 몰수승
//   판정 검증 (Rank3.checkShot / checkPoint)
//   · 셔틀 물리는 양쪽이 똑같이 계산하므로, 상대가 보낸 타구·판정을 내 계산과 비교해 어긋나면 flags를 올림
//   · flags는 결과 보고에 함께 실림. 2번 이상이면 서버가 그 경기를 분쟁으로 처리
//   · 한계: 서버가 랠리를 직접 계산하지는 않음. 상대 선수 위치 자체를 속이는 것까지는 못 잡음
//   티어 경계·배치 경기 수·검사 허용 폭은 모두 [게임]용으로 정한 값

const RANK3 = Object.freeze({
  CH: 'bm3d-rankq', WIN: 11, PLACE: 5, BEAT: 10, POLL: 3, POLL_MAX: 14,
  TIERS: [[1500, '마스터', '#FF6B9A'], [1350, '다이아', '#7FD6FF'], [1200, '플래티넘', '#6CE0C4'], [1050, '골드', '#FFD23F'], [900, '실버', '#C9CED8'], [0, '브론즈', '#C98A5A']],
  V_MAX: 160,          // 발사 속력 상한 m/s (이보다 빠르면 이상)
  HIT_DIST: 2.6,       // 상대 타점이 내가 계산한 셔틀 경로에서 떨어질 수 있는 최대 거리 m
  IN_MARGIN: 0.15      // "확실히 인"으로 보는 안쪽 여유 m
});

const Rank3 = {
  cache: null,
  sb() { return typeof Account !== 'undefined' ? Account.sb : null; },
  tier(r) { for (const t of RANK3.TIERS) if (r >= t[0]) return { name: t[1], color: t[2], min: t[0] }; return { name: '브론즈', color: '#C98A5A', min: 0 }; },
  // 표시용: 배치 경기 중이면 티어 대신 '배치 n/5'
  label(d) { return !d ? '-' : d.games < RANK3.PLACE ? `배치 ${d.games}/${RANK3.PLACE}` : this.tier(d.rating).name; },
  missing(e) { return !!e && (e.code === 'PGRST202' || e.code === '42883' || e.code === '42P01' || /rank_|ranks/.test(e.message || '')) && !/login_required|not_your_match|bad_/.test(e.message || ''); },
  async call(fn, args) {
    const sb = this.sb(); if (!sb) return { error: { message: 'offline' } };
    try {
      return await Promise.race([sb.rpc(fn, args || {}), new Promise(res => setTimeout(() => res({ error: { message: 'timeout' } }), 8000))]);
    } catch (e) { return { error: { message: (e && e.message) || String(e) } }; }
  },

  // 내 랭크 정보 → { ok, rating, games, wins, streak, peak, pos } 또는 { ok:false, missing, msg }
  async me() {
    const r = await this.call('rank_me');
    if (r.error) return (this.cache = { ok: false, missing: this.missing(r.error), msg: this.missing(r.error) ? '랭크전은 아직 준비 중이에요 (서버 설정 전).' : '랭크 정보를 불러오지 못했어요 (인터넷 연결 확인).' });
    this.cache = { ok: true, ...r.data }; return this.cache;
  },
  async top() {
    const sb = this.sb(); if (!sb) return { ok: false };
    try {
      const r = await Promise.race([
        sb.from('ranks').select('user_id,nickname,rating,games,wins').gte('games', RANK3.PLACE).order('rating', { ascending: false }).order('updated_at', { ascending: true }).limit(20),
        new Promise(res => setTimeout(() => res({ error: { message: 'timeout' } }), 6000))]);
      if (r.error) return { ok: false, missing: this.missing(r.error) };
      const me = Account.user && Account.user.id;
      return { ok: true, rows: (r.data || []).map(x => ({ nickname: x.nickname, rating: x.rating, games: x.games, wins: x.wins, mine: x.user_id === me })) };
    } catch (e) { return { ok: false }; }
  },

  // 경기 열기: id가 큰 쪽은 상대가 먼저 만들 때까지 잠깐 다시 시도 → { id, rated } 또는 null
  async open(oppUid, code) {
    for (let i = 0; i < 8; i++) {
      const r = await this.call('rank_open', { p_opp: oppUid, p_room: code });
      if (r.error) { console.warn('rank_open', r.error); return null; }
      if (r.data && r.data.id) return r.data;
      await new Promise(res => setTimeout(res, 700));
    }
    return null;
  },
  beat(id) { return this.call('rank_beat', { p_match: id }); },
  resign(id, my, opp) { this.call('rank_report', { p_match: id, p_my: my | 0, p_opp: opp | 0, p_kind: 'resign', p_flags: 0 }); this.cache = null; },
  // 결과 보고 → 서버가 마무리할 때까지 몇 초마다 다시 물어봄. cb(상태)는 바뀔 때마다 불림
  async report(id, my, opp, kind, flags, cb) {
    const args = { p_match: id, p_my: my | 0, p_opp: opp | 0, p_kind: kind, p_flags: flags | 0 };
    for (let i = 0; i <= RANK3.POLL_MAX; i++) {
      const r = await this.call('rank_report', args);
      if (r.error) { if (i >= 2) { cb({ status: 'error' }); return; } }
      else if (r.data && r.data.status !== 'live') { this.cache = null; cb(r.data); return; }
      else if (i === 0) cb({ status: 'live' });
      await new Promise(res => setTimeout(res, RANK3.POLL * 1000));
    }
    cb({ status: 'timeout' });
  },
  // 결과 창에 붙일 한 줄
  line(s) {
    const sp = t => `<span class="xpline">${t}</span>`;
    if (!s || s.status === 'live') return sp('상대의 결과 보고를 기다리는 중…');
    if (s.status === 'error') return sp('서버에 결과를 보내지 못했어요 — 랭크 점수는 반영되지 않았을 수 있어요');
    if (s.status === 'timeout' || s.status === 'pending') return sp('서버 확인이 끝나지 않았어요 — 대기화면의 랭크전에서 점수를 확인해 주세요');
    if (s.status === 'disputed') return sp(s.how === 'flags' ? '판정이 서로 맞지 않아 랭크 점수에 반영되지 않았어요' : '두 사람의 결과 보고가 달라 랭크 점수에 반영되지 않았어요');
    if (s.status === 'void') return sp(s.how === 'short' ? '경기가 너무 짧아 랭크 점수에 반영되지 않았어요' : '무효 경기 — 랭크 점수 변화 없음');
    if (s.rated === false || s.before == null) return sp('같은 상대와 오늘 3경기를 넘어 랭크 점수에는 반영되지 않았어요');
    const d = s.after - s.before, how = s.how === 'resign' ? (s.won ? ' · 상대 기권' : ' · 기권') : s.how === 'forfeit' ? ' · 몰수승' : '';
    const g = { rating: s.after, games: s.games };
    return sp(`랭크 점수 ${s.before} → <b>${s.after}</b> (${d >= 0 ? '+' : ''}${d}) · ${this.label(g)}${how}`);
  },

  // ───── 판정 검증 (경기 중, game.js가 부름) ─────
  // 내가 친 공: 경로와 예상 낙하를 기억해 둠
  mine(R, p0, v0, serve, box) {
    const sim = Phys3.simulate(p0, v0, { path: true });
    R.shot = { path: sim.path, land: sim.land, net: !!sim.net, serve: !!serve, box: box || null };
  },
  flag(R, why) { R.flags = (R.flags || 0) + 1; (R.why = R.why || []).push(why); console.warn('[랭크전] 판정 이상:', why); },
  // 상대가 친 공(내 좌표로 바꾼 p0, v0): 속력·위치가 말이 되는지
  checkShot(R, p0, v0, serve) {
    const sp = Math.hypot(v0.x, v0.y, v0.z), C = C3.COURT;
    if (!(sp <= RANK3.V_MAX)) return this.flag(R, 'speed ' + Math.round(sp));
    if (!(p0.z < 0.5) || !(Math.abs(p0.x) < C.HALF_W_S + 3) || !(p0.y > -0.1 && p0.y < 4.2) || !(p0.z > -(C.HALF_LEN + 4))) return this.flag(R, 'pos');
    const s = R.shot; R.shot = null;
    if (serve || !s || !s.path || !s.path.length) return;
    let best = Infinity;   // 내 타구 경로와 상대 타점 사이 최소 거리
    for (const q of s.path) { const d = Math.hypot(q.x - p0.x, q.y - p0.y, q.z - p0.z); if (d < best) best = d; }
    if (best > RANK3.HIT_DIST) this.flag(R, 'far ' + best.toFixed(1));
  },
  // 상대가 알려 온 판정: 내 타구가 확실히 들어갔는데 상대 득점이라고 하면 이상
  checkPoint(R, winner, match) {
    const s = R.shot; R.shot = null;
    if (!s || winner !== 'opp' || s.net || !s.land) return;
    const C = C3.COURT, M = RANK3.IN_MARGIN, x = s.land.x, z = s.land.z;
    let inside = z < -M && Math.abs(x) <= C.HALF_W_S - M && Math.abs(z) <= C.HALF_LEN - M;
    if (inside && s.serve && s.box) inside = x >= s.box.xMin + M && x <= s.box.xMax - M && z >= s.box.zMin + M && z <= s.box.zMax - M;
    if (inside) this.flag(R, 'call');
  }
};
