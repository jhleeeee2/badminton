// court3d/skins.js — 스킨: 유니폼 · 채 색 · 코트 색. 코인으로 사고, 가진 것 중에서 골라 씀
//   · 겉모습만 바뀜 (능력치와 무관) → 모든 모드에 적용. 친선게임에서는 내 유니폼·채 색이 상대 화면에도 보임(코트 색은 각자 화면만)
//   · 저장: 브라우저(badminton.skins.v1) · 로그인하면 wallets 표 gear 칸의 _skins에 가진 목록을 함께 저장(양쪽 합집합) — account.js
//   이름·색·가격은 모두 [게임]용으로 지어낸 것

const Skin3 = {
  KEY: 'badminton.skins.v1',
  CATS: { kit: '유니폼', racket: '채 색', court: '코트' },
  ITEMS: {
    kit: [
      { id: 'base',   name: '기본',        price: 0,   shirt: 0xFF6B3D, accent: 0xFFD23F, shorts: 0x1D3557 },
      { id: 'navy',   name: '네이비 스톰', price: 150, shirt: 0x1D4ED8, accent: 0xFFFFFF, shorts: 0x0B1B3A },
      { id: 'mint',   name: '민트 러시',   price: 150, shirt: 0x2EC4B6, accent: 0xFFE066, shorts: 0x14213D },
      { id: 'cherry', name: '체리 블라썸', price: 150, shirt: 0xFF8FB1, accent: 0xFFFFFF, shorts: 0x5A1A3A },
      { id: 'ice',    name: '화이트 아이스', price: 150, shirt: 0xF5F7FA, accent: 0x3DD9FF, shorts: 0x2E3440 },
      { id: 'gold',   name: '블랙 골드',   price: 300, shirt: 0x111114, accent: 0xFFB000, shorts: 0x111114 }
    ],
    racket: [
      { id: 'base', name: '기본 (유니폼 포인트 색)', price: 0, frame: null },
      { id: 'lime', name: '네온 라임', price: 100, frame: 0xB6FF3B, grip: 0x1E2A12 },
      { id: 'pink', name: '핫 핑크',   price: 100, frame: 0xFF4FA3, grip: 0x2A1220 },
      { id: 'blue', name: '아이스 블루', price: 100, frame: 0x6FD6FF, grip: 0x12222A },
      { id: 'gold', name: '골드',      price: 200, frame: 0xFFC233, grip: 0x111111 }
    ],
    court: [
      { id: 'base',   name: '그린 (기본)',   price: 0,   court: null },
      { id: 'blue',   name: '블루 코트',     price: 250, court: 0x2563A8, mat: 0x173F70, surround: 0x1A2040 },
      { id: 'purple', name: '퍼플 나이트',   price: 250, court: 0x6A4BC4, mat: 0x40297F, surround: 0x1B1436 },
      { id: 'clay',   name: '클레이 오렌지', price: 250, court: 0xC46A3A, mat: 0x7F3F20, surround: 0x2A1A14 },
      { id: 'gray',   name: '그레이 프로',   price: 250, court: 0x5D6673, mat: 0x353B45, surround: 0x15181D }
    ]
  },
  own: { kit: ['base'], racket: ['base'], court: ['base'] },
  eq: { kit: 'base', racket: 'base', court: 'base' },
  listeners: [],

  item(cat, id) { return (this.ITEMS[cat] || []).find(x => x.id === id) || null; },
  has(cat, id) { return !!this.own[cat] && this.own[cat].includes(id); },
  cur(cat) { return this.item(cat, this.eq[cat]) || this.ITEMS[cat][0]; },
  css(n) { return '#' + (n >>> 0).toString(16).padStart(6, '0'); },
  // 대기화면 견본 색 (큰 색, 작은 색)
  swatch(cat, it) {
    if (cat === 'kit') return [it.shirt, it.accent];
    if (cat === 'racket') return it.frame == null ? [this.cur('kit').accent, 0x30343E] : [it.frame, it.grip];
    return it.court == null ? [0x23875A, 0x175A3E] : [it.court, it.mat];
  },
  // 다른 곳(서버·저장본)의 보유 목록과 합침
  merge(own) {
    if (!own || typeof own !== 'object') return;
    for (const cat in this.ITEMS) if (Array.isArray(own[cat])) for (const id of own[cat]) if (this.item(cat, id) && !this.has(cat, id)) this.own[cat].push(id);
  },
  reset() { this.own = { kit: ['base'], racket: ['base'], court: ['base'] }; this.eq = { kit: 'base', racket: 'base', court: 'base' }; },
  load() {
    try {
      const v = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      if (v && typeof v === 'object') { this.merge(v.own); if (v.eq) for (const cat in this.ITEMS) if (this.has(cat, v.eq[cat])) this.eq[cat] = v.eq[cat]; }
    } catch (e) { /* 무시 */ }
  },
  save(quiet) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ own: this.own, eq: this.eq })); } catch (e) { /* 무시 */ }
    if (!quiet) for (const fn of this.listeners) { try { fn(); } catch (e) { console.error(e); } }
  },
  on(fn) { this.listeners.push(fn); },
  buy(cat, id) {
    const it = this.item(cat, id);
    if (!it || this.has(cat, id) || typeof Wallet === 'undefined' || !Wallet.spend('스킨 · ' + this.CATS[cat] + ' ' + it.name, it.price)) return false;
    this.own[cat].push(id); this.eq[cat] = id; this.save(); return true;
  },
  equip(cat, id) { if (!this.has(cat, id)) return false; this.eq[cat] = id; this.save(true); return true; },   // 고르기만 한 건 서버에 올릴 필요 없음

  // 경기에 적용할 값
  kit() { const k = this.cur('kit'); return { shirt: k.shirt, accent: k.accent, shorts: k.shorts, shoe: k.accent }; },
  racket() { const r = this.cur('racket'); return r.frame == null ? null : { frame: r.frame, grip: r.grip }; },
  court() { const c = this.cur('court'); return c.court == null ? null : { court: c.court, mat: c.mat, surround: c.surround }; },
  // 친선게임: 상대에게 보낼 내 겉모습 / 받은 값 검사 (색 숫자만 통과)
  wire() { return { k: this.kit(), r: this.racket() }; },
  clean(w) {
    const n = x => Number.isInteger(x) && x >= 0 && x <= 0xFFFFFF, out = { k: null, r: null };
    if (w && w.k && n(w.k.shirt) && n(w.k.accent) && n(w.k.shorts)) out.k = { shirt: w.k.shirt, accent: w.k.accent, shorts: w.k.shorts, shoe: w.k.accent };
    if (w && w.r && n(w.r.frame) && n(w.r.grip)) out.r = { frame: w.r.frame, grip: w.r.grip };
    return out;
  }
};
Skin3.load();
