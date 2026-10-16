// game.js — 게임 전체를 묶는 객체: 상태(phase) 전환, 메인 루프, 서브, 득점 처리
//
// phase: 'idle'(시작 전) → 'serve'(서브 대기) → 'flying'(랠리) ↔ 'pserve'(내 서브 게이지)
//        → 'gameover'

class Game {
  constructor(canvas, hud) {
    this.hud = hud;
    this.match = new Match();
    this.shuttle = new Shuttle();
    this.fx = new Effects();
    this.player = new Player(this);
    this.ai = new AIOpponent(this);
    this.shots = new ShotSystem(this);
    this.renderer = new Renderer(canvas, this);

    this.phase = 'idle';
    this.serveWait = 0;
    this.lastTs = 0;
    this.running = false;
    this.inputOn = true;   // App이 화면 전환 시 켜고 끔
    this.loop = this.loop.bind(this);
  }

  get active() { return this.phase === 'flying' || this.phase === 'serve' || this.phase === 'pserve'; }
  get canAct() { return this.phase === 'flying' || this.phase === 'pserve'; }

  // ───── 경기 흐름 ─────
  start() {
    this.match.resetScore();
    this.phase = 'serve'; this.serveWait = 0.6;
    this.hud.hideMessage(); this.hud.setStartLabel('다시 시작');
    this.hud.setRally(0); this.hud.setScore(0, 0); this.hud.setShot('-');
    this.player.resetForMatch(); this.ai.resetBody();
    this.fx.reset(); this.lastTs = 0;
    this.shuttle.netDrop = null; this.shuttle.isServe = false;
    if (!this.running) { this.running = true; requestAnimationFrame(this.loop); }
  }

  // 메뉴로 나갈 때: 경기 중단, 처음 화면 상태로
  stop() {
    this.phase = 'idle';            // 다음 프레임에 루프가 스스로 멈춤
    const c = this.player.ctrl; c.L = c.R = c.C = false;
    this.player.resetForMatch(); this.ai.resetBody(); this.fx.reset();
    this.hud.resetMessage(); this.hud.setStartLabel('시작');
    this.renderer.draw();
  }

  serve() {
    if (this.match.server === 'opp') {
      this.phase = 'flying'; this.shuttle.isServe = true;
      this.shots.launch(Math.random() < 0.6 ? 'clear' : 'drop', true, this.ai.x, COURT.BASE, 1.02 + Math.random() * 0.18, true);
    } else {
      this.phase = 'pserve'; this.player.gauge.on = false; this.player.gauge.p = 0;
    }
    this.player.dashUsed = false; this.ai.frozen = false; this.hud.setDash(true);
  }

  // 플레이어 서브: 짧게 누름 → 네트 앞 낮은 숏서브, 길게 누름 → 깊고 높은 롱서브
  doServe(p) {
    const s = this.shuttle, ai = this.ai, S = SERVE;
    this.phase = 'flying'; s.isServe = true;
    s.launch(this.player.x - 16, COURT.STANDY + 8, false, 'norm');
    ai.newFlight();
    const tooShort = p < S.NET_FAULT_P, tooLong = p > S.OUT_P;
    const q = Math.min(p, 1);   // 정상 구간 기준 세기
    const shortX = COURT.NET - S.SHORT_X, longX = COURT.BL_L + S.LONG_X;
    s.x1 = shortX + q * (longX - shortX) + (Math.random() - 0.5) * S.JITTER;
    s.dur = S.DUR_SHORT + q * (S.DUR_LONG - S.DUR_SHORT);
    if (tooLong) s.x1 = COURT.BL_L - S.OUT_OVER - (p - S.OUT_P) * S.OUT_SLOPE;  // 베이스라인 밖
    if (tooShort) s.dur = S.DUR_FAULT;   // 힘없이 낮게 → 네트를 못 넘음
    else s.ensureClear();
    s.finalize();
    if (tooShort && !s.net) {            // 선수 위치와 관계없이 반드시 네트에 걸리게
      const tN = s.netT();
      if (tN !== null) s.net = { t: tN, y: Math.max(COURT.NETTOP, Math.min(s.at(tN)[1], COURT.NETTOP + 26)) };
    }
    ai.ignore = s.outPred || !!s.net;
    ai.plan = ai.makePlan(S.AI_POWER_SHORT + q * (S.AI_POWER_LONG - S.AI_POWER_SHORT));
    const pct = Math.round(p * 100) + '%';
    this.hud.setShot(tooShort ? '서브 너무 짧음 ' + pct : tooLong ? '서브 너무 김 ' + pct : (p < 0.5 ? '숏서브 ' : '롱서브 ') + pct);
  }

  onContact(sx, sy) {
    this.match.rally++;
    this.hud.setRally(this.match.rally);
    this.fx.hit(sx, sy);
  }

  scorePoint(mine, reason, landX) {
    const m = this.match;
    m.award(mine);
    this.hud.setScore(m.pts, m.opts);
    this.fx.show(reason, mine ? COLORS.ok : COLORS.bad, 1.2);
    this.fx.missPos = [Math.max(10, Math.min(COURT.W - 10, landX)), COURT.GY - 8];
    this.hud.setRally(0);
    const w = m.winner();
    if (w) {
      this.phase = 'gameover';
      if (typeof Account !== 'undefined') Account.recordMatch({ game_type: 'classic', difficulty: m.diffId, target_score: m.win, player_score: m.pts, ai_score: m.opts, won: w === 'player' });
      this.hud.showMessage((w === 'player' ? '승리! ' : '패배... ') + m.pts + ' : ' + m.opts + '<br>Space 또는 다시 시작 = 재대결 · Esc = 메뉴');
    } else {
      if (m.isDeuce()) this.fx.show('듀스! ' + m.pts + ' : ' + m.opts, COLORS.warn, 1.4);
      this.phase = 'serve'; this.serveWait = 1.0;
    }
  }

  landingScore() {
    const s = this.shuttle, inB = s.landsInside(), NET = COURT.NET;
    if (s.dir === -1) {  // 내가 친 공이 AI 쪽에 떨어짐
      if (s.x1 > NET) { this.scorePoint(false, '범실...', s.x1); return; }
      if (inB) this.scorePoint(true, this.ai.frozen ? '너무 빨라서 반응 못 함!' : '득점!', s.x1);
      else this.scorePoint(false, '아웃...', s.x1);
    } else {             // AI가 친 공이 내 쪽에 떨어짐
      if (s.x1 < NET) { this.scorePoint(true, '상대 범실!', s.x1); return; }
      if (inB) this.scorePoint(false, '실점...', s.x1);
      else this.scorePoint(true, '아웃! 잘 봤어요', s.x1);
    }
  }

  // ───── 플레이어 명령 (Input이 호출) ─────
  playerShot(type) {
    if (this.phase !== 'flying' || this.shuttle.netDrop) return;
    this.player.hit(type);
  }
  jump() { if (this.canAct) this.player.jump(); }
  dash() { if (this.canAct && this.player.dash()) this.hud.setDash(false); }
  chargeServe(down) {
    if (this.phase !== 'pserve') return;
    const gg = this.player.gauge;
    if (down) { if (!gg.on) { gg.on = true; gg.p = 0; } }
    else if (gg.on) { gg.on = false; this.doServe(gg.p); }
  }

  // ───── 메인 루프 ─────
  loop(ts) {
    if (!this.active) { this.running = false; return; }
    if (!this.lastTs) this.lastTs = ts;
    const dt = Math.min((ts - this.lastTs) / 1000, 0.05); this.lastTs = ts;
    this.update(dt);
    this.renderer.draw();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    const p = this.player, ai = this.ai, s = this.shuttle;
    p.move(dt);
    p.tickSwing(dt); ai.tickSwing(dt); this.fx.update(dt);

    if (this.phase === 'pserve') { p.updateGauge(dt); return; }

    ai.move(dt);

    if (this.phase === 'serve') {
      this.serveWait -= dt;
      if (this.serveWait <= 0) this.serve();
      return;
    }

    // 네트에 걸려 떨어지는 중
    if (s.netDrop) {
      s.netDrop.y += 380 * dt;
      if (s.netDrop.y >= COURT.GY - 8) {
        s.netDrop.y = COURT.GY - 8;
        if (s.dir === -1) this.scorePoint(false, '네트...', s.netDrop.x);
        else this.scorePoint(true, '네트! 득점', s.netDrop.x);
      }
      return;
    }

    ai.track(dt);
    s.t += dt / s.dur;
    if (s.net && s.t >= s.net.t) {
      s.netDrop = { x: COURT.NET + (s.dir === 1 ? -8 : 8), y: s.net.y };
      s.net = null;
      return;
    }
    if (s.t >= 1) this.landingScore();
  }
}
