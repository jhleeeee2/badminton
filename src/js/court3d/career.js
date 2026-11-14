// court3d/career.js — 커리어(토너먼트) 모드: 성향이 다른 AI를 차례로 이기며 대회 4개를 우승
//   진행 상황은 브라우저(localStorage)에 저장 · 저장이 막힌 환경이면 이번 실행 동안만 유지
//   대회·선수 이름·수치는 모두 [게임]용으로 지어낸 것 (실존 대회·선수와 무관)
//   diff + blend: 난이도 사이를 잇는 값. blend 0.5 = 그 난이도와 다음 난이도 수치의 중간 → 한 경기씩 조금씩 어려워짐
//   지면 그 경기만 다시 도전 (대회 처음으로 돌아가지 않음)

const CAREER_DIFF_ORDER = ['easy', 'normal', 'hard', 'hell', 'imp'];
const CAREER_ROUNDS = ['8강', '준결승', '결승'];

const Career3 = {
  KEY: 'badminton.career.v1',
  CUPS: [
    { id: 'town', name: '동네 대회', color: '#7CFF6B', win: 11, rounds: [
      { name: '한도윤', diff: 'easy',   blend: 0,    style: 'base',  kit: { shirt: 0x4CAF7A, accent: 0xFFFFFF, shorts: 0x263238 } },
      { name: '서지우', diff: 'easy',   blend: 0.5,  style: 'net',   kit: { shirt: 0x3DA5D9, accent: 0xFFE066, shorts: 0x1B2A41 } },
      { name: '문태오', diff: 'normal', blend: 0,    style: 'wall',  kit: { shirt: 0xE0E0E0, accent: 0x34C08B, shorts: 0x2E3440 } } ] },
    { id: 'city', name: '시 대회', color: '#3DD9FF', win: 11, rounds: [
      { name: '강라온', diff: 'normal', blend: 0.25, style: 'smash', kit: { shirt: 0xE5484D, accent: 0x111111, shorts: 0x1C1C1C } },
      { name: '윤세찬', diff: 'normal', blend: 0.5,  style: 'net',   kit: { shirt: 0x2EC4B6, accent: 0xFFFFFF, shorts: 0x14213D } },
      { name: '백이든', diff: 'normal', blend: 0.75, style: 'base',  kit: { shirt: 0x7B61FF, accent: 0x2EE6D6, shorts: 0x23234A } } ] },
    { id: 'nation', name: '전국 대회', color: '#FFD23F', win: 15, rounds: [
      { name: '차민혁', diff: 'hard',   blend: 0,    style: 'wall',  kit: { shirt: 0x1D4ED8, accent: 0xFFD23F, shorts: 0x0B1B3A } },
      { name: '남궁설', diff: 'hard',   blend: 0.35, style: 'smash', kit: { shirt: 0x111111, accent: 0xFF3B6B, shorts: 0x111111 } },
      { name: '도하준', diff: 'hard',   blend: 0.7,  style: 'net',   kit: { shirt: 0xF5F5F5, accent: 0xE5484D, shorts: 0x1D3557 } } ] },
    { id: 'world', name: '세계 대회', color: '#FF7A45', win: 15, rounds: [
      { name: '올레 린드',   diff: 'hell', blend: 0.3, style: 'wall',  kit: { shirt: 0xFFD23F, accent: 0x1D4ED8, shorts: 0x1D4ED8 } },
      { name: '아리사와 켄', diff: 'hell', blend: 0.7, style: 'net',   kit: { shirt: 0xC2185B, accent: 0xFFFFFF, shorts: 0x1A1A2E } },
      { name: '카이 로웬',   diff: 'imp',  blend: 0,   style: 'smash', win: 21, kit: { shirt: 0x0E0E12, accent: 0xFFB000, shorts: 0x0E0E12 } } ] }
  ],
  cleared: 0,          // 순서대로 이긴 경기 수 (0 ~ total)
  list: null,

  // 대회별 라운드를 한 줄로 펼친 목록
  stages() {
    if (this.list) return this.list;
    this.list = [];
    this.CUPS.forEach((cup, ci) => cup.rounds.forEach((r, ri) => this.list.push(Object.freeze({
      idx: this.list.length, cupIdx: ci, roundIdx: ri, cup: cup.name, cupColor: cup.color, round: CAREER_ROUNDS[ri], final: ri === cup.rounds.length - 1,
      name: r.name, diff: r.diff, blend: r.blend || 0, style: r.style, win: r.win || cup.win, kit: r.kit
    }))));
    return this.list;
  },
  get total() { return this.stages().length; },
  stage(i) { return this.stages()[Math.max(0, Math.min(this.total - 1, i | 0))]; },
  current() { return Math.min(this.cleared, this.total - 1); },   // 다음에 도전할 경기 (전부 깼으면 마지막 결승)
  unlocked(i) { return i <= this.cleared; },
  done() { return this.cleared >= this.total; },

  load() { try { const v = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (v) this.cleared = Math.max(0, Math.min(this.total, v.cleared | 0)); } catch (e) { /* 무시 */ } },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify({ cleared: this.cleared })); } catch (e) { /* 무시 */ } },
  // 경기 승리 처리 → 처음 깬 경기면 true (이미 깬 경기를 다시 이긴 건 진행에 영향 없음)
  clear(i) { if (i !== this.cleared || this.done()) return false; this.cleared++; this.save(); return true; },
  reset() { this.cleared = 0; this.save(); },

  // 난이도 수치: diff와 다음 난이도 사이를 blend만큼 섞음
  mix(table, s) {
    const a = table[s.diff], n = table[CAREER_DIFF_ORDER[CAREER_DIFF_ORDER.indexOf(s.diff) + 1]];
    if (!s.blend || n === undefined) return a;
    if (typeof a === 'number') return a + (n - a) * s.blend;
    const o = {}; for (const k in a) o[k] = a[k] + (n[k] - a[k]) * s.blend;
    return o;
  },
  aiOf(s) { return this.mix(C3.AI, s); },
  tactOf(s) { return this.mix(C3.AI_TACT, s) || 0; },

  diffLabel(s) { return DIFF_NAMES[s.diff] + (s.blend ? '+' : '') + ' ' + C3.AI_STYLE[s.style].name; },
  // 대기화면 선택 → Game3D.configure에 넘길 설정
  sel(i, hand) { const s = this.stage(i); return { type: 'court3d', mode: 'ai', diff: s.diff, style: s.style, win: s.win, hand: hand === 'L' ? 'L' : 'R', career: s }; }
};
Career3.load();
