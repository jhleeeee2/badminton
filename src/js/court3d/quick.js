// court3d/quick.js — 빠른 대전: 매칭 점수가 비슷한 사람을 자동으로 찾아 1:1 방을 만들어 줌 (Supabase Realtime, 별도 서버 없음)
//   Rate3 — 매칭 점수 [게임]
//     · 처음엔 1000 + 20 × 선수 레벨로 시작, 그 뒤로는 빠른 대전 승패로만 변함 (엘로 방식, K = 32: 강한 상대를 이기면 많이, 약한 상대를 이기면 조금 오름)
//     · 빠른 대전은 채·선수 스탯 효과가 없는 같은 조건이라, '비슷한 스탯' = 실력을 나타내는 이 점수로 맞춤. 점수가 같으면 선수 레벨이 가까운 쪽
//     · 저장: 브라우저(badminton.rating.v1) · 로그인하면 wallets 표 gear 칸의 _rate (경기 수가 많은 쪽)
//     · 점수는 각자 브라우저가 계산 — 조작 방지(서버 판정)는 랭크전에서. 중간에 나가도 지금은 점수 변화 없음
//   Quick3 — 대기열
//     · 대기 채널 bm3d-queue의 presence에 { 점수, 레벨, 이름, 대기 시작 시각 }을 올림
//     · 허용 차이: 처음 ±100, 3초마다 +50씩 넓어짐 (둘 중 오래 기다린 쪽 기준) → 사람이 적어도 결국 잡힘
//     · 허용 범위 안에서 점수 차가 가장 작은 사람이 '내 최선'. 두 사람 중 id가 작은 쪽이 초대(inv) → 받은 쪽이 대기 중이면 수락(ok) → 둘 다 대기열을 나가 같은 방 코드로 입장
//     · 초대가 4초 안에 수락되지 않거나 거절(no)되면 그 사람은 잠시 건너뛰고 다시 찾음
//     · AI_AFTER초 동안 아무도 없으면 onNoOne (AI와 대전으로 넘어감)

const Rate3 = {
  KEY: 'badminton.rating.v1', K: 32, BASE: 1000, PER_LV: 20,
  r: null, n: 0, w: 0,
  load() { try { const v = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (v && typeof v === 'object') this.take(v, true); } catch (e) { /* 무시 */ } },
  save(quiet) {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.dump())); } catch (e) { /* 무시 */ }
    if (!quiet && this.onChange) { try { this.onChange(); } catch (e) { console.error(e); } }
  },
  dump() { return { r: this.r, n: this.n, w: this.w }; },
  // 다른 곳(서버) 값: 경기 수가 더 많으면(또는 force) 그쪽을 씀
  take(v, force) {
    if (!v || typeof v !== 'object' || !(Number(v.r) > 0)) { if (force) { this.r = null; this.n = 0; this.w = 0; } return; }
    const n = Math.max(0, v.n | 0);
    if (force || n > this.n) { this.r = Math.max(100, Math.min(4000, Math.round(Number(v.r)))); this.n = n; this.w = Math.max(0, Math.min(n, v.w | 0)); }
  },
  seed() { return this.BASE + this.PER_LV * (typeof Stats3 !== 'undefined' ? Stats3.level() : 0); },
  get() { return this.r == null ? this.seed() : this.r; },
  expect(mine, opp) { return 1 / (1 + Math.pow(10, (opp - mine) / 400)); },   // 내가 이길 것으로 보는 확률
  // 한 경기 반영 → { before, after, diff }
  update(oppR, won) {
    const before = this.get(), o = Number(oppR) > 0 ? Number(oppR) : before;
    const after = Math.max(100, Math.round(before + this.K * ((won ? 1 : 0) - this.expect(before, o))));
    this.r = after; this.n++; if (won) this.w++; this.save();
    return { before, after, diff: after - before };
  },
  aiDiff() { const r = this.get(); return r < 950 ? 'easy' : r < 1100 ? 'normal' : r < 1250 ? 'hard' : 'hell'; }   // 대기자가 없을 때 붙일 AI 난이도
};
Rate3.load();

const QUICK3 = Object.freeze({ CH: 'bm3d-queue', RANGE0: 100, RANGE_STEP: 50, RANGE_EVERY: 3, INVITE_WAIT: 4, SKIP: 6, AI_AFTER: 25, TICK: 500, WIN: 11 });

class Quick3 {
  constructor() { this.id = Math.random().toString(36).slice(2, 10); this.ch = null; this.state = 'idle'; }
  get active() { return !!this.ch; }
  range(at, now) { return QUICK3.RANGE0 + QUICK3.RANGE_STEP * Math.floor(Math.max(0, now - at) / 1000 / QUICK3.RANGE_EVERY); }

  // me = { r, lv, name } · cb = { onStatus({ waited, range, others }), onMatch({ code, host, opp:{ r, lv, name } }), onNoOne(), onError(msg) }
  async start(me, cb) {
    this.stop();
    const sb = typeof Account !== 'undefined' ? Account.sb : null;
    if (!sb) throw new Error('온라인 서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.');
    Object.assign(this, { me: { r: Math.round(me.r), lv: me.lv | 0, name: String(me.name || '게스트').slice(0, 12) }, cb, at: Date.now(), state: 'wait', target: null, skip: {} });
    const ch = sb.channel(QUICK3.CH, { config: { broadcast: { self: false }, presence: { key: this.id } } });
    this.ch = ch;
    ch.on('broadcast', { event: 'q' }, ({ payload }) => { try { this.recv(payload); } catch (e) { console.error(e); } });
    ch.on('presence', { event: 'sync' }, () => {});
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('연결 시간 초과')), 10000);
      ch.subscribe(async st => {
        if (st === 'SUBSCRIBED') { clearTimeout(to); try { await ch.track({ r: this.me.r, lv: this.me.lv, name: this.me.name, at: this.at }); } catch (e) { /* 무시 */ } res(); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); rej(new Error('대기열 연결 실패 (' + st + ')')); }
      });
    });
    if (this.ch !== ch) return;   // 그사이 취소함
    this.timer = setInterval(() => { try { this.tick(); } catch (e) { console.error(e); } }, QUICK3.TICK);
    this.tick();
  }
  stop() {
    const ch = this.ch; this.ch = null; this.state = 'idle';
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (ch) { try { ch.unsubscribe(); Account.sb.removeChannel(ch); } catch (e) { /* 무시 */ } }
  }
  send(m) { if (this.ch) { m.from = this.id; this.ch.send({ type: 'broadcast', event: 'q', payload: m }).catch(() => {}); } }

  // 지금 대기 중인 다른 사람들 [{ id, r, lv, name, at }]
  others() {
    const st = this.ch ? this.ch.presenceState() : {}, out = [];
    for (const k in st) {
      const p = st[k] && st[k][0];
      if (k === this.id || !p || !(Number(p.r) > 0)) continue;
      out.push({ id: k, r: Number(p.r), lv: p.lv | 0, name: String(p.name || '게스트').slice(0, 12), at: Number(p.at) || Date.now() });
    }
    return out;
  }
  // 내 최선의 상대: 허용 범위 안에서 점수 차가 가장 작은 사람 (같으면 레벨 차 → id 순)
  best(list, now) {
    const mine = this.range(this.at, now);
    let b = null, bk = null;
    for (const p of list) {
      if ((this.skip[p.id] || 0) > now) continue;
      const d = Math.abs(p.r - this.me.r);
      if (d > Math.max(mine, this.range(p.at, now))) continue;
      const k = [d, Math.abs(p.lv - this.me.lv), p.id];
      if (!b || k[0] < bk[0] || (k[0] === bk[0] && (k[1] < bk[1] || (k[1] === bk[1] && k[2] < bk[2])))) { b = p; bk = k; }
    }
    return b;
  }
  tick() {
    if (!this.ch) return;
    const now = Date.now(), list = this.others(), waited = (now - this.at) / 1000;
    if (this.state === 'inviting' && now > this.inviteUntil) { this.skip[this.target.id] = now + QUICK3.SKIP * 1000; this.state = 'wait'; this.target = null; }
    if (this.state === 'wait') {
      const b = this.best(list, now);
      if (b && this.id < b.id) {   // id가 작은 쪽이 초대
        this.state = 'inviting'; this.target = b; this.code = Net3D.makeCode(); this.inviteUntil = now + QUICK3.INVITE_WAIT * 1000;
        this.send({ t: 'inv', to: b.id, code: this.code, r: this.me.r, lv: this.me.lv, name: this.me.name });
      } else if (!list.length && waited >= QUICK3.AI_AFTER) { const cb = this.cb; this.stop(); cb.onNoOne && cb.onNoOne(); return; }
    }
    if (this.cb.onStatus) this.cb.onStatus({ waited, range: this.range(this.at, now), others: list.length });
  }
  recv(m) {
    if (!this.ch || !m || m.to !== this.id) return;
    if (m.t === 'inv') {
      if (this.state !== 'wait' || !/^[A-Z0-9]{5}$/.test(String(m.code))) return this.send({ t: 'no', to: m.from });
      this.send({ t: 'ok', to: m.from });
      this.matched({ code: m.code, host: false, opp: { r: Number(m.r) > 0 ? Number(m.r) : this.me.r, lv: m.lv | 0, name: String(m.name || '게스트').slice(0, 12) } });
    } else if (m.t === 'ok' && this.state === 'inviting' && this.target && m.from === this.target.id) {
      this.matched({ code: this.code, host: true, opp: { r: this.target.r, lv: this.target.lv, name: this.target.name } });
    } else if (m.t === 'no' && this.state === 'inviting' && this.target && m.from === this.target.id) {
      this.skip[m.from] = Date.now() + 3000; this.state = 'wait'; this.target = null;
    }
  }
  matched(r) { const cb = this.cb; setTimeout(() => this.stop(), 300); this.state = 'matched'; if (this.timer) { clearInterval(this.timer); this.timer = null; } cb.onMatch && cb.onMatch(r); }   // 'ok'가 나간 뒤 채널을 닫음
}
