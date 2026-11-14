// court3d/racket.js — 채 시스템: 균형형 · 헤드 헤비 · 헤드 라이트, 코인으로 구매·강화
//   · "더 세게"가 아니라 "다르게": 강화할수록 장점과 단점이 함께 커짐. 강화 단계는 산 범위 안에서 낮춰 쓸 수 있음
//   · 효과는 AI 대전·커리어에만 적용. 친선게임·일일 챌린지·훈련은 모두 균형형(효과 없음)으로 공평하게
//   · 저장: 브라우저(badminton.gear.v1) · 로그인하면 wallets 표의 gear 칸과 합침(채마다 더 높은 강화 단계) — account.js
//   [실제 참고] 헤드가 무거운 채는 스매시에 힘이 실리지만 다루기 느리고, 헤드가 가벼운 채는 빠르게 다뤄 수비·네트 플레이에 유리하다는 일반적인 장비 특성
//   [게임] 그 외 수치·가격은 모두 게임용으로 정한 값

const Gear3 = {
  KEY: 'badminton.gear.v1', MAX: 3,
  UP_COST: [200, 350, 500],          // 강화 1·2·3단계 가격
  RACKETS: {
    bal:   { name: '균형형',      price: 0,   color: '#C9CCD6', max: 0, desc: '기본 채. 장단점 없이 고르게.' },
    heavy: { name: '헤드 헤비',   price: 300, color: '#FF7A45', max: 3, desc: '스매시에 힘이 실리지만 스윙이 무거움.' },
    light: { name: '헤드 라이트', price: 300, color: '#3DD9FF', max: 3, desc: '빠르게 다뤄 수비·타이밍이 편하지만 스매시가 약함.' }
  },
  own: { bal: 0 },   // 가진 채: id → 산 강화 단계
  use: {},           // id → 쓰는 강화 단계 (없으면 산 단계 그대로)
  eq: 'bal',         // 장착한 채
  listeners: [],

  // 효과 수치. smashAng: 스매시 발사각 추가(°, 음수 = 더 가파르고 빠름) · react: 내 스매시에 대한 AI 반응 지연(초)
  //           charge: 충전 시간 배율 · win: 떼고 나서 맞을 수 있는 시간(정타 여유) 배율
  stats(id, L) {
    if (id === 'heavy') return { smashAng: -(1 + 0.5 * L), react: 0.015 + 0.01 * L, charge: 1.10 + 0.05 * L, win: 0.94 - 0.03 * L };
    if (id === 'light') return { smashAng: 1 + 0.5 * L, react: 0, charge: 0.90 - 0.05 * L, win: 1.10 + 0.05 * L };
    return { smashAng: 0, react: 0, charge: 1, win: 1 };
  },
  pros(id, L) {
    const s = this.stats(id, L), pct = x => Math.round(Math.abs(x - 1) * 100) + '%';
    if (id === 'heavy') return { good: `스매시 각 ${s.smashAng.toFixed(1)}° (더 가파르고 빠르게) · 상대 반응 +${Math.round(s.react * 1000)}ms`, bad: `충전 시간 +${pct(s.charge)} · 정타 여유 −${pct(s.win)}` };
    if (id === 'light') return { good: `충전 시간 −${pct(s.charge)} · 정타 여유 +${pct(s.win)}`, bad: `스매시 각 +${s.smashAng.toFixed(1)}° (더 완만하고 느리게)` };
    return { good: '효과 없음 (친선게임·일일 챌린지와 같은 조건)', bad: '' };
  },

  load() {
    try {
      const v = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      if (v && typeof v === 'object') { this.merge(v.own); if (v.use && typeof v.use === 'object') for (const id in this.own) if (v.use[id] != null) this.use[id] = this.clampLv(id, v.use[id]); if (this.has(v.eq)) this.eq = v.eq; }
    } catch (e) { /* 무시 */ }
  },
  save(quiet) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ own: this.own, use: this.use, eq: this.eq })); } catch (e) { /* 무시 */ }
    if (!quiet) for (const fn of this.listeners) { try { fn(); } catch (e) { console.error(e); } }
  },
  on(fn) { this.listeners.push(fn); },
  // 다른 곳(서버·저장본)의 보유 목록과 합침: 채마다 더 높은 강화 단계
  merge(own) {
    if (!own || typeof own !== 'object') return;
    for (const id in this.RACKETS) if (own[id] != null) this.own[id] = Math.max(this.own[id] || 0, Math.max(0, Math.min(this.RACKETS[id].max, own[id] | 0)));
    this.own.bal = 0;
  },
  clampLv(id, L) { return Math.max(0, Math.min(this.own[id] || 0, L | 0)); },
  has(id) { return !!this.RACKETS[id] && this.own[id] != null; },
  lv(id) { return this.own[id] || 0; },                                      // 산 단계
  useLv(id) { return this.use[id] != null ? this.clampLv(id, this.use[id]) : this.lv(id); },   // 쓰는 단계
  upCost(id) { const L = this.lv(id); return this.has(id) && L < this.RACKETS[id].max ? this.UP_COST[L] : null; },
  label() { const L = this.useLv(this.eq); return this.RACKETS[this.eq].name + (L ? ' +' + L : ''); },
  cur() { return this.stats(this.eq, this.useLv(this.eq)); },   // 장착한 채의 효과

  buy(id) {
    const R = this.RACKETS[id];
    if (!R || this.has(id) || typeof Wallet === 'undefined' || !Wallet.spend('채 구매 · ' + R.name, R.price)) return false;
    this.own[id] = 0; this.eq = id; this.save(); return true;
  },
  upgrade(id) {
    const c = this.upCost(id);
    if (c == null || typeof Wallet === 'undefined' || !Wallet.spend('채 강화 · ' + this.RACKETS[id].name + ' +' + (this.lv(id) + 1), c)) return false;
    this.own[id]++; this.use[id] = this.own[id]; this.save(); return true;
  },
  equip(id) { if (!this.has(id)) return false; this.eq = id; this.save(); return true; },
  setUse(id, L) { if (!this.has(id)) return false; this.use[id] = this.clampLv(id, L); this.save(); return true; }
};
Gear3.load();
