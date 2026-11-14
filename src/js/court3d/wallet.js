// court3d/wallet.js — 재화(코인): 플레이로만 얻음 (경기 완료 · 일일 챌린지 · 랠리 기록 · 훈련 레벨업)
//   · 잔액은 브라우저(localStorage)에 저장 · 로그인하면 서버(wallets 표, sql/wallets.sql)와 합침 (account.js)
//   · delta / deltaT = 서버에 아직 반영되지 않은 변화량(잔액 / 누적 획득). 게스트로 번 코인은 처음 로그인할 때 계정에 더해짐
//   · 끝까지 한 경기만 지급 (중간에 나가면 없음). 조작 방지(서버 검증)는 랭크전을 열 때 함께 해결
//   · 레트로 모드(클래식)는 지급 없음 — 새 기능은 3D 본편에만
//   수치는 모두 [게임]용으로 정한 값

const Wallet = {
  KEY: 'badminton.wallet.v1', LOG_MAX: 20,
  coins: 0, total: 0, delta: 0, deltaT: 0, uid: null, day: '', flags: null, log: [], listeners: [],

  R: {
    WIN: { easy: 20, normal: 35, hard: 55, hell: 80, imp: 110 },   // AI 대전 승리 (11점 경기 기준)
    TARGET: { 11: 1, 15: 1.3, 21: 1.7 },                           // 목표 점수 배율
    LOSS: 0.4,                         // 패배: 승리 보상 × 0.4 × (내 점수 / 목표 점수) — 0점으로 지면 0
    RALLY: [[30, 30], [20, 15], [10, 5]],   // 그 경기의 가장 긴 랠리가 [타수] 이상이면 +[코인]
    FIRST_WIN: 50,                     // 오늘의 첫 승 (AI 대전·커리어, 한국 시간 기준 하루 1번)
    CAREER_FIRST: 2, CAREER_REPLAY: 0.5,    // 커리어: 처음 깨는 경기 ×2 · 이미 깬 경기 다시 하기 ×0.5
    CUP: [100, 150, 250, 400],         // 대회 첫 우승 보너스 (동네·시·전국·세계)
    ROOM_WIN: 15, ROOM_LOSS: 10, ROOM_CAP: 5,   // 친선게임: 승 15 / 패 10, 하루 5경기까지
    DAILY_TRY: 20, DAILY_PER: 25,      // 일일 챌린지: 그날 첫 도전 +20 · 그날 최고 점수 25점당 1코인 (만점 2,750점 = 110)
    LEVEL_UP: 30                       // 훈련 레벨업 1번
  },

  load() {
    try {
      const v = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      if (v && typeof v === 'object') {
        const n = x => Math.round(Number(x) || 0);
        this.coins = Math.max(0, n(v.coins)); this.total = Math.max(0, n(v.total)); this.delta = n(v.delta); this.deltaT = Math.max(0, n(v.deltaT));
        this.uid = typeof v.uid === 'string' ? v.uid : null; this.day = typeof v.day === 'string' ? v.day : '';
        this.flags = v.flags && typeof v.flags === 'object' ? v.flags : null;
        this.log = Array.isArray(v.log) ? v.log.slice(0, this.LOG_MAX) : [];
      }
    } catch (e) { /* 무시 */ }
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify({ coins: this.coins, total: this.total, delta: this.delta, deltaT: this.deltaT, uid: this.uid, day: this.day, flags: this.flags, log: this.log })); } catch (e) { /* 무시 */ }
  },
  on(fn) { this.listeners.push(fn); },
  emit() { for (const fn of this.listeners) { try { fn(); } catch (e) { console.error(e); } } },
  fmt(n) { return Math.round(n).toLocaleString('en-US'); },

  today() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); },   // 한국 시간 날짜 (Daily3.day와 같은 기준)
  // 하루 단위 기록(오늘의 첫 승 · 친선게임 횟수 · 일일 챌린지 지급분): 날짜가 바뀌면 새로
  f() {
    const d = this.today();
    if (this.day !== d || !this.flags) { this.day = d; this.flags = { win: false, room: 0, dailyTry: false, dailyPaid: 0 }; }
    return this.flags;
  },

  // items = [[이름, 코인], …] → 0보다 큰 것만 더함. { sum, items, html } (html = 결과 창에 붙일 한 줄, 없으면 '')
  add(title, items) {
    items = items.map(([k, n]) => [k, Math.round(n)]).filter(x => x[1] > 0);
    const sum = items.reduce((s, x) => s + x[1], 0);
    if (!sum) { this.save(); return { sum: 0, items, html: '' }; }
    this.coins += sum; this.total += sum; this.delta += sum; this.deltaT += sum;
    this.log.unshift({ t: Date.now(), title, sum }); this.log.length = Math.min(this.log.length, this.LOG_MAX);
    this.save(); this.emit();
    return { sum, items, html: `<br><span class="coinline">🪙 <b>+${this.fmt(sum)} 코인</b>${items.length > 1 ? ' (' + items.map(x => x[0] + ' ' + x[1]).join(' · ') + ')' : ' (' + items[0][0] + ')'} · 보유 ${this.fmt(this.coins)}</span>` };
  },
  // 쓰기 (10번 채 시스템부터 사용): 모자라면 false
  spend(title, n) {
    n = Math.round(n);
    if (!(n > 0) || this.coins < n) return false;
    this.coins -= n; this.delta -= n;
    this.log.unshift({ t: Date.now(), title, sum: -n }); this.log.length = Math.min(this.log.length, this.LOG_MAX);
    this.save(); this.emit();
    return true;
  },

  // ── 지급 규칙 ──
  winBase(diff, blend, target) {   // 커리어의 '난이도 사이 섞기'(blend)도 보상에 그대로 반영
    const order = ['easy', 'normal', 'hard', 'hell', 'imp'], a = this.R.WIN[diff] || this.R.WIN.normal, n = this.R.WIN[order[order.indexOf(diff) + 1]];
    return (blend && n ? a + (n - a) * blend : a) * (this.R.TARGET[target] || target / 11);
  },
  rallyBonus(maxRally) { for (const [hits, c] of this.R.RALLY) if (maxRally >= hits) return c; return 0; },
  // AI 대전·커리어 한 경기. o = { diff, blend, target, won, pts, maxRally, career: null | { name, first, replay, final, cupIdx } }
  match(o) {
    const R = this.R, F = this.f(), c = o.career, items = [];
    let base = this.winBase(o.diff, o.blend || 0, o.target);
    if (c) base *= c.first ? R.CAREER_FIRST : c.replay ? R.CAREER_REPLAY : 1;
    if (o.won) {
      items.push([c && c.first ? '첫 승리' : '승리', base]);
      if (c && c.first && c.final) items.push(['대회 우승', R.CUP[c.cupIdx] || 0]);
      if (!F.win) { F.win = true; items.push(['오늘의 첫 승', R.FIRST_WIN]); }
    } else items.push(['참가', base * R.LOSS * Math.min(1, o.pts / o.target)]);
    const rb = this.rallyBonus(o.maxRally | 0); if (rb) items.push(['랠리 ' + (o.maxRally | 0) + '타', rb]);
    return this.add(c ? '커리어 · ' + c.name : 'AI 대전 ' + (o.won ? '승' : '패'), items);
  },
  // 친선게임 한 경기 (하루 ROOM_CAP경기까지)
  room(won) {
    const R = this.R, F = this.f();
    if (F.room >= R.ROOM_CAP) { this.save(); return { sum: 0, items: [], html: `<br><span class="coinline">🪙 친선게임 코인은 하루 ${R.ROOM_CAP}경기까지 (오늘은 다 받았어요)</span>` }; }
    F.room++;
    return this.add('친선게임 ' + (won ? '승' : '패'), [[(won ? '승리' : '참가') + ` · 오늘 ${F.room}/${R.ROOM_CAP}`, won ? R.ROOM_WIN : R.ROOM_LOSS]]);
  },
  // 일일 챌린지 한 번 끝: 그날 최고 점수가 오른 만큼만 지급 (여러 번 해도 합계는 최고 점수 기준)
  daily(best) {
    const R = this.R, F = this.f(), items = [];
    if (!F.dailyTry) { F.dailyTry = true; items.push(['오늘 첫 도전', R.DAILY_TRY]); }
    const due = Math.floor(best / R.DAILY_PER);
    if (due > F.dailyPaid) { items.push(['점수', due - F.dailyPaid]); F.dailyPaid = due; }
    return this.add('일일 챌린지', items);
  },
  levelUp(name) { return this.add('훈련 레벨업 · ' + name, [['레벨업', this.R.LEVEL_UP]]); }
};
Wallet.load();
