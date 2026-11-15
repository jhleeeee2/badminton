// court3d/train.js — 훈련 모드: AI가 공을 '먹여 주고'(피딩), 연속 성공 수로 레벨업
//   str 근력: 높은 공 → 내 스매시가 상대 코트 표적 안에 떨어지면 성공
//   agi 순발력: AI 스매시 → 상대 코트 안으로 받아 넘기면 성공
//   jud 판단력: 라인 근처 공 → 아웃은 흘려보내고, 인은 받아 넘기면 성공
//   피딩 수치·표적 크기·필요 연속 수는 모두 [게임]용

class Trainer3D {
  constructor(game) { this.g = game; this.kind = null; this.streak = 0; this.best = 0; }
  get active() { return !!this.kind; }
  // daily = true면 일일 챌린지: 공 Daily3.TOTAL개를 날짜 난수로 먹여 주고 점수를 셈 (레벨업 없음)
  start(kind, daily) {
    this.kind = kind; this.streak = 0; this.best = 0; this.target = null;
    this.daily = !!daily; this.finished = false; this.score = 0; this.count = 0; this.hits = 0;
    this.rng = this.daily ? Daily3.rng() : null; this.day = this.daily ? Daily3.day() : null;
  }
  stop() { this.kind = null; this.daily = false; this.finished = false; this.rng = null; this.g.view.setTarget(null); }

  // 서브 차례 대신 공 먹여 주기
  feed() {
    const g = this.g, a = g.opp, R = this.rng || Math.random, rr = (x, y) => x + R() * (y - x), L = this.daily ? Daily3.FEED_LV : Progress3.lv[this.kind];   // 일일 챌린지: 날짜 난수 + 고정 세기
    let tx, tz, ang, y0, name;
    this.myShot = null; this.feedOut = false;
    if (this.kind === 'str') {          // 높은 리프트: 스매시하기 좋은 공
      tx = rr(-1.6, 1.6); tz = rr(3.4, 5.0); ang = rr(52, 58); y0 = 1.0; name = '피딩 · 리프트';
      const zw = Math.max(1.0, 1.9 - 0.15 * L);   // 레벨이 오를수록 표적이 작아짐
      const spots = [[-1.45, -3.1], [1.45, -3.1], [-1.45, -4.1], [1.45, -4.1], [0, -3.6]];
      const s = spots[Math.floor(R() * spots.length)];
      this.target = { x: s[0], z: s[1], w: zw, h: zw };
      g.view.setTarget(this.target);
    } else if (this.kind === 'agi') {   // 스매시: 레벨이 오를수록 빠르고 깊게
      // 실제 스매시 수비 연습처럼 내 몸 좌우(0.3~1.4m, 레벨이 오를수록 멀리)로 꽂음
      const me = g.me, side = R() < 0.5 ? -1 : 1;
      tx = Math.max(-2.3, Math.min(2.3, me.pos.x + side * rr(0.3, 1.0 + 0.1 * L)));
      tz = Math.max(2.4, Math.min(5.8, me.pos.z + rr(-0.9, 0.5)));
      ang = -rr(6, 9 + L); y0 = 2.75; name = '피딩 · 스매시';
    } else {                            // 판단력: 라인 근처 인/아웃
      const m = Math.max(0.06, 0.5 - 0.07 * L);   // 레벨이 오를수록 라인에 더 가깝게
      this.feedOut = R() < 0.45;
      const side = R() < 0.5;   // true = 사이드라인, false = 베이스라인
      const S = C3.COURT.HALF_W_S, Lb = C3.COURT.HALF_LEN, sg = R() < 0.5 ? -1 : 1;
      if (side) { tx = sg * (this.feedOut ? S + rr(m * 0.4, m + 0.25) : S - rr(m * 0.4, m + 0.25)); tz = rr(3.2, 6.0); }
      else { tx = rr(-2.0, 2.0); tz = this.feedOut ? Lb + rr(m * 0.4, m + 0.3) : Lb - rr(m * 0.4, m + 0.35); }
      ang = rr(36, 50); y0 = 1.1; name = '피딩';
    }
    const p0 = { x: a.pos.x, y: y0, z: a.pos.z + 0.4 };
    const dx = tx - p0.x, dz = tz - p0.z, range = Math.hypot(dx, dz), hx = dx / range, hz = dz / range;
    const sp = Phys3.solveSpeed(p0, hx, hz, ang, range), v0 = Phys3.launchVel(hx, hz, ang, sp);
    const plan = { v0, speed: sp, kmh: Math.round(sp * 3.6), sim: Phys3.simulate(p0, v0), name };
    a.swing(this.kind === 'agi' ? 'down' : 'lift', 0.8, p0, this.kind === 'agi' ? 'over' : 'low'); a.onHit(p0);
    g.launch(a, p0, plan, false);
    g.phase = 'rally';
    g.me.bounds = g.halfBounds('me');
    g.hud.setHint('');
  }

  onPlayerHit(name) {
    if (!this.myShot) this.myShot = name;
    if (this.kind === 'jud' && this.feedOut && this.myShot === name) this.g.hud.banner('아웃 공을 건드렸어요', '#FF6B6B', 0.8);
  }

  // 셔틀이 바닥에 닿았을 때 판정 → { ok, msg }
  judge(s) {
    const m = this.g.match, p = s.p, mine = s.lastHitter === 'me';
    const inOpp = !s.netted && p.z < 0 && m.inSingles(p.x, p.z);
    if (this.kind === 'str') {
      if (!mine) return { ok: false, msg: '못 쳤어요' };
      if (!/스매시/.test(this.myShot || '')) return { ok: false, msg: '스매시가 아니에요 (E를 길게)' };
      const t = this.target, hit = inOpp && Math.abs(p.x - t.x) <= t.w / 2 && Math.abs(p.z - t.z) <= t.h / 2;
      return hit ? { ok: true, msg: '표적 명중!' } : { ok: false, msg: s.netted ? '네트' : inOpp ? '표적 밖' : '아웃' };
    }
    if (this.kind === 'agi') {
      if (!mine) return { ok: false, msg: '못 받았어요' };
      return inOpp ? { ok: true, msg: '받아냈다!' } : { ok: false, msg: s.netted ? '네트' : '아웃' };
    }
    // jud
    if (this.feedOut) return mine ? { ok: false, msg: '아웃 공이었어요' } : { ok: true, msg: '아웃 판단 정확!' };
    if (!mine) return { ok: false, msg: '인 공이었어요' };
    return inOpp ? { ok: true, msg: '인 판단 + 리턴 성공!' } : { ok: false, msg: s.netted ? '네트' : '리턴 아웃' };
  }

  result(r) {
    const g = this.g;
    if (this.daily) return this.dailyResult(r);
    if (r.ok) {
      this.streak++; this.best = Math.max(this.best, this.streak);
      Sound3.chime(true);
      const need = Progress3.need(this.kind);
      if (this.streak >= need && Progress3.lv[this.kind] < Progress3.MAX) {
        Progress3.up(this.kind); this.streak = 0;
        const coin = typeof Wallet !== 'undefined' ? Wallet.levelUp(TRAIN_INFO[this.kind].name).sum : 0;
        if (typeof Stats3 !== 'undefined') Stats3.gain('levelUp');
        g.hud.banner(`${TRAIN_INFO[this.kind].name} Lv.${Progress3.lv[this.kind]} 달성!` + (coin ? ` 🪙 +${coin}` : ''), '#FFD23F', 2.0);
        g.view.cheer(1); Sound3.cheer(1);
      } else g.hud.banner(r.msg + ` (${this.streak}/${need})`, '#5BFFB0', 1.0);
    } else {
      if (this.streak > 0) g.hud.banner(r.msg + ' · 연속 끊김', '#FF6B6B', 1.1);
      else g.hud.banner(r.msg, '#FF9B9B', 0.9);
      this.streak = 0; Sound3.chime(false);
    }
    this.hud();
  }

  // 일일 챌린지 채점: 성공 = 100점 + 연속 보너스, 공을 다 쓰면 끝
  dailyResult(r) {
    const g = this.g; this.count++;
    if (r.ok) {
      this.streak++; this.best = Math.max(this.best, this.streak); this.hits++;
      const p = Daily3.pts(this.streak); this.score += p;
      Sound3.chime(true); g.hud.banner(`${r.msg} +${p}` + (this.streak > 1 ? ` (연속 ${this.streak})` : ''), '#5BFFB0', 1.0);
    } else {
      g.hud.banner(r.msg + (this.streak > 1 ? ' · 연속 끊김' : ''), '#FF6B6B', 1.0);
      this.streak = 0; Sound3.chime(false);
    }
    if (this.count >= Daily3.TOTAL) this.finished = true;
    this.hud();
  }
  // 일일 챌린지 끝: 결과 저장(이 브라우저) + 로그인 상태면 서버에 올리고 순위 표시
  finish() {
    const g = this.g, I = TRAIN_INFO[this.kind], rec = Daily3.record(this.day, this.kind, this.score);
    g.phase = 'over'; g.me.charge = null; g.view.setTarget(null); g.hud.setHint('');
    if (rec.isNew) { g.view.cheer(1); Sound3.cheer(1); }
    const fmt = n => n.toLocaleString('en-US');
    const base = `일일 챌린지 끝 — ${I.name}<br><b>${fmt(this.score)}점</b> (성공 ${this.hits}/${Daily3.TOTAL} · 최고 연속 ${this.best})<br>`
      + (rec.isNew ? '오늘 내 최고 기록!' : `오늘 내 최고 ${fmt(rec.best)}점`)
      + (typeof Wallet !== 'undefined' ? Wallet.daily(rec.best).html : '') + (typeof Stats3 !== 'undefined' ? Stats3.gain('daily').html : '');
    const tail = '<br>Enter 또는 다시 시작 = 다시 도전 · Esc = 메뉴';
    g.hud.showMessage(base + tail);
    const run = this.runId = (this.runId || 0) + 1;
    if (typeof Account !== 'undefined' && Account.loggedIn) Account.pushDaily(this.day, this.kind, rec.best).then(r => {
      if (!r || !r.ok || this.runId !== run || g.phase !== 'over' || !this.daily) return;
      g.hud.showMessage(base + `<br>오늘 순위 <b>${r.rank}위</b> / ${r.total}명` + tail);
    });
  }

  hud() {
    if (this.daily) return this.g.hud.setDaily({ name: TRAIN_INFO[this.kind].name, color: TRAIN_INFO[this.kind].color, score: this.score, left: Daily3.TOTAL - this.count });
    const k = this.kind, L = Progress3.lv[k];
    this.g.hud.setTrain({ name: TRAIN_INFO[k].name, lv: L, max: Progress3.MAX, streak: this.streak, need: Progress3.need(k), color: TRAIN_INFO[k].color });
  }
  hint() {
    return { str: '근력 훈련 — 높은 공을 E(길게)로 스매시해 노란 표적에 꽂기', agi: '순발력 훈련 — 상대 스매시를 받아 넘기기', jud: '판단력 훈련 — 아웃은 보내고, 인은 받아 넘기기' }[this.kind];
  }
}
