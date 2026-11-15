// court3d/stats.js — 선수 스탯: 경기·훈련으로 선수 레벨을 올리고, 레벨만큼 받은 포인트를 스탯에 나눠 줌
//   · 총합 상한: 최고 레벨 15 = 포인트 15개, 스탯 4종 × 최대 6 = 24칸 → 전부 최대로는 못 채움 (어디에 줄지 고르는 재미)
//   · 다시 나누기는 언제든 무료 (대기화면 「내 선수」의 −/＋)
//   · 효과는 AI 대전·커리어에만 적용. 친선게임·일일 챌린지·훈련은 모두 기본 능력치로 공평하게
//   · 저장: 브라우저(badminton.stats.v1) · 로그인하면 wallets 표 gear 칸의 _stats에 함께 저장 (경험치는 더 높은 쪽) — account.js
//   수치는 모두 [게임]용으로 정한 값 (리치는 판정 거리만 늘고 몸 모델의 팔 길이는 그대로)

const Stats3 = {
  KEY: 'badminton.stats.v1', MAX_LV: 15, STAT_MAX: 6,
  XP: { win: 40, loss: 20, room: 20, daily: 30, levelUp: 50 },   // 패배는 × (내 점수 ÷ 목표 점수) · 일일 챌린지는 그날 첫 도전만 · 친선게임은 코인을 받는 경기(하루 5번)만
  STATS: {
    reach: { name: '리치',   sub: '팔 길이',      color: '#FFD23F', per: 0.025, text: n => `타격 판정 거리 +${(0.025 * n * 100).toFixed(1)}cm` },
    speed: { name: '스피드', sub: '다리·순발력',  color: '#3DD9FF', per: 0.02,  text: n => `이동 속도 +${2 * n}%` },
    jump:  { name: '점프',   sub: '도약',         color: '#7CFF6B', per: 0.04,  text: n => `점프 초기속도 +${4 * n}% (높이 약 +${Math.round(((1 + 0.04 * n) ** 2 - 1) * 100)}%)` },
    sta:   { name: '체력',   sub: '지구력',       color: '#FF7A45', per: 5,     text: n => `최대 체력 +${5 * n} (기본 100)` }
  },
  xp: 0, alloc: { reach: 0, speed: 0, jump: 0, sta: 0 }, day: '', listeners: [],

  need(L) { return 100 + 50 * L; },   // 레벨 L → L+1에 필요한 경험치 (1레벨 100, 그 뒤로 50씩 증가 · 15레벨까지 합계 6,750)
  // { lv, cur, need }: 현재 레벨, 이번 레벨에서 쌓은 경험치, 다음 레벨까지 필요한 양 (최고 레벨이면 need 0)
  info() {
    let lv = 0, x = this.xp;
    while (lv < this.MAX_LV && x >= this.need(lv)) { x -= this.need(lv); lv++; }
    return { lv, cur: lv >= this.MAX_LV ? 0 : x, need: lv >= this.MAX_LV ? 0 : this.need(lv) };
  },
  level() { return this.info().lv; },
  used() { let s = 0; for (const k in this.STATS) s += this.alloc[k] || 0; return s; },
  free() { return Math.max(0, this.level() - this.used()); },
  // 저장본·서버 값 정리: 범위를 벗어나거나 포인트보다 많이 쓴 경우 뒤에서부터 덜어냄
  fix() {
    this.xp = Math.max(0, Math.round(Number(this.xp) || 0));
    for (const k in this.STATS) this.alloc[k] = Math.max(0, Math.min(this.STAT_MAX, this.alloc[k] | 0));
    const ks = Object.keys(this.STATS).reverse();
    for (let i = 0; this.used() > this.level() && i < 100; i++) { const k = ks.find(x => this.alloc[x] > 0); if (!k) break; this.alloc[k]--; }
  },
  dump() { return { xp: this.xp, alloc: { ...this.alloc } }; },
  // 다른 곳(서버) 값 받기: 경험치는 더 높은 쪽. keepAlloc = 내 분배를 그대로 둘지 (같은 계정이면 유지, 아니면 서버 것)
  take(v, keepAlloc) {
    if (!v || typeof v !== 'object') { if (!keepAlloc) { this.xp = 0; this.alloc = { reach: 0, speed: 0, jump: 0, sta: 0 }; } this.fix(); return; }
    this.xp = keepAlloc ? Math.max(this.xp, Number(v.xp) || 0) : Number(v.xp) || 0;
    if (!keepAlloc || !this.used()) this.alloc = { reach: 0, speed: 0, jump: 0, sta: 0, ...(v.alloc && typeof v.alloc === 'object' ? v.alloc : {}) };
    this.fix();
  },

  load() {
    try { const v = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (v && typeof v === 'object') { this.xp = v.xp; if (v.alloc && typeof v.alloc === 'object') Object.assign(this.alloc, v.alloc); this.day = typeof v.day === 'string' ? v.day : ''; } } catch (e) { /* 무시 */ }
    this.fix();
  },
  save(quiet) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ xp: this.xp, alloc: this.alloc, day: this.day })); } catch (e) { /* 무시 */ }
    if (!quiet) for (const fn of this.listeners) { try { fn(); } catch (e) { console.error(e); } }
  },
  on(fn) { this.listeners.push(fn); },

  // 경험치 얻기 → { xp, up, html } (html = 결과 창에 붙일 한 줄). k: 패배 때 (내 점수 ÷ 목표 점수)
  gain(kind, k) {
    let n = this.XP[kind] || 0;
    if (kind === 'loss') n = Math.round(n * Math.max(0, Math.min(1, k || 0)));
    if (kind === 'daily') { const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); if (this.day === d) n = 0; else this.day = d; }
    const before = this.level();
    if (before >= this.MAX_LV || !n) { this.save(true); return { xp: 0, up: false, html: '' }; }
    this.xp += n; this.save();
    const I = this.info(), up = I.lv > before;
    return { xp: n, up, html: `<br><span class="xpline">선수 경험치 +${n} · Lv.${I.lv}${I.need ? ` (${I.cur}/${I.need})` : ' (최고 레벨)'}${up ? ' — <b>레벨 업! 스탯 포인트 +' + (I.lv - before) + '</b> (대기화면 「내 선수」)' : ''}</span>` };
  },
  // 스탯에 포인트 주기/빼기 (d = +1 / −1)
  step(id, d) {
    if (!this.STATS[id]) return false;
    const n = (this.alloc[id] || 0) + d;
    if (n < 0 || n > this.STAT_MAX || (d > 0 && this.free() < d)) return false;
    this.alloc[id] = n; this.save(); return true;
  },
  // 경기에 적용할 효과: reach = 판정 거리 추가(m) · speed·jump = 추가 비율
  effects() { const S = this.STATS, a = this.alloc; return { reach: S.reach.per * a.reach, speed: S.speed.per * a.speed, jump: S.jump.per * a.jump, sta: S.sta.per * a.sta }; },
  label() { const a = this.alloc; return this.used() ? `선수 Lv.${this.level()} (리치 ${a.reach} · 스피드 ${a.speed} · 점프 ${a.jump} · 체력 ${a.sta})` : ''; }
};
Stats3.load();
