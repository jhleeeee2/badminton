// game.js — 게임 전체를 묶는 객체: 상태(phase) 전환, 메인 루프, 서브, 득점 처리
//
// 모드: 'ai'(AI 대전) · 'local2p'(한 키보드 2인: 오른쪽 P1 · 왼쪽 P2) · 'room'(친구 1:1 온라인: 내 화면에선 내가 항상 오른쪽)
// phase: 'idle'(시작 전) → 'serve'(서브 대기) → 'flying'(랠리) ↔ 'pserve'(사람 서브 게이지)
//        ↔ 'oserve'(온라인: 상대가 서브 게이지를 모으는 중) → 'gameover'
// 선수: player = 오른쪽(사람), left = 왼쪽 (AI 대전이면 ai, 아니면 p2)

const INTRO_MSG = {
  ai: '목표 점수 선점 + 2점 차로 승리 (듀스 적용)<br>Q 클리어 · W 드라이브 · E 드롭 · R 헤어핀 · Space 스매시<br>←→ 이동 · ↑ 점프 · ↓ 앉기(수비) · A 대쉬 · 서브는 Space를 길게',
  local2p: '<b>로컬 2인</b> — 한 키보드로 둘이 (목표 점수 선점 + 2점 차)<br>'
    + '<span style="color:var(--opp)">P2 왼쪽</span>: F H 이동 · T 점프 · G 앉기 · Q W E R 샷 · Space 스매시/서브 · A 대쉬<br>'
    + '<span style="color:var(--me)">P1 오른쪽</span>: ←→ 이동 · ↑ 점프 · ↓ 앉기 · U I O P 샷 · ; 스매시/서브 · J 대쉬<br>Space 또는 시작 = 시작',
  room: '친구 1:1 — 친구가 들어오면 바로 시작합니다'
};

class Game {
  constructor(canvas, hud) {
    this.hud = hud;
    this.match = new Match();
    this.shuttle = new Shuttle();
    this.fx = new Effects();
    this.player = new Player(this, 'R');
    this.p2 = new Player(this, 'L');
    this.ai = new AIOpponent(this);
    this.shots = new ShotSystem(this);
    this.net = new NetC(this);
    this.renderer = new Renderer(canvas, this);

    this.mode = 'ai';
    this.oppName = '상대';
    this.roomRec = { cid: null, name: '', sets: { me: 0, opp: 0 } };   // 친구 방: 같은 상대와 계속하면 세트 스코어 유지
    this.phase = 'idle';
    this.serveWait = 0;
    this.lastTs = 0;
    this.running = false;
    this.inputOn = true;   // App이 화면 전환 시 켜고 끔
    this.loop = this.loop.bind(this);
  }

  get left() { return this.mode === 'ai' ? this.ai : this.p2; }
  get active() { return this.phase === 'flying' || this.phase === 'serve' || this.phase === 'pserve' || this.phase === 'oserve'; }
  get canAct() { return this.phase === 'flying' || this.phase === 'pserve' || this.phase === 'oserve'; }
  serverPlayer() { return this.match.server === 'player' ? this.player : this.left; }
  // 이 화면이 판정하는가: 온라인에서는 공을 받는 쪽(공이 날아가는 쪽) 컴퓨터만 판정해서 알려줌
  judgeHere() { return this.mode !== 'room' || this.shuttle.dir === 1; }

  // 모드 설정 (App.launch / 친구 방에서 호출)
  setMode(mode) {
    this.mode = mode === 'local2p' || mode === 'room' ? mode : 'ai';
    this.p2.remote = this.mode === 'room';
    this.player.label = this.mode === 'local2p' ? 'P1' : '';
    this.p2.label = this.mode === 'local2p' ? 'P2' : '상대';
    if (this.mode !== 'room') { this.net.close(); this.oppName = '상대'; this.hud.setRoom(null); }
    this.hud.setNames(this.mode === 'local2p' ? 'P2' : this.oppName, this.mode === 'local2p' ? 'P1' : '나');
    this.hud.setIntro(INTRO_MSG[this.mode]);
    this.hud.setDashVisible(true);
  }

  // ───── 경기 흐름 ─────
  start(fromNet) {
    if (this.mode === 'room') {
      if (!this.net.connected) return;   // 친구가 들어와야 시작
      if (!fromNet) this.net.send({ t: 'restart', win: this.match.win });
    }
    this.match.resetScore();
    if (this.mode === 'room') this.match.server = this.net.host ? 'player' : 'opp';   // 첫 서브는 방장
    this.phase = 'serve'; this.serveWait = 0.6;
    this.hud.hideMessage(); this.hud.setStartLabel('다시 시작');
    this.hud.setRally(0); this.hud.setScore(0, 0); this.hud.setShot('-');
    this.player.resetForMatch(); this.p2.resetForMatch(); this.ai.resetBody();
    this.fx.reset(); this.lastTs = 0;
    this.shuttle.netDrop = null; this.shuttle.isServe = false; this.shuttle.hold = false;
    if (!this.running) { this.running = true; requestAnimationFrame(this.loop); }
  }

  // 메뉴로 나갈 때: 경기 중단, 처음 화면 상태로
  stop() {
    this.net.close();
    this.phase = 'idle';            // 다음 프레임에 루프가 스스로 멈춤
    this.player.releaseAll(); this.p2.releaseAll();
    this.player.resetForMatch(); this.p2.resetForMatch(); this.ai.resetBody(); this.fx.reset();
    this.hud.resetMessage(); this.hud.setStartLabel('시작');
    this.renderer.draw();
  }

  serve() {
    if (this.match.server === 'opp') {
      if (this.mode === 'ai') {
        this.phase = 'flying'; this.shuttle.isServe = true;
        this.shots.launch(Math.random() < 0.6 ? 'clear' : 'drop', true, this.ai.x, COURT.BASE, 1.02 + Math.random() * 0.18, true);
      } else if (this.mode === 'local2p') {
        this.phase = 'pserve'; this.p2.gauge.on = false; this.p2.gauge.p = 0;
      } else this.phase = 'oserve';   // 온라인: 상대 컴퓨터에서 서브가 날아올 때까지
    } else {
      this.phase = 'pserve'; this.player.gauge.on = false; this.player.gauge.p = 0;
    }
    this.player.dashUsed = false; this.p2.dashUsed = false; this.ai.frozen = false; this.hud.setDash(true);
  }

  // 사람 서브: 짧게 누름 → 네트 앞 낮은 숏서브, 길게 누름 → 깊고 높은 롱서브
  //   오른쪽 선수 기준으로 계산하고, 왼쪽 선수(P2)면 좌우를 뒤집음 (x → W − x)
  doServe(pl, p) {
    const s = this.shuttle, ai = this.ai, S = SERVE, right = pl.side === 'R';
    const mx = x => right ? x : COURT.W - x;
    this.phase = 'flying'; s.isServe = true; s.hold = false;
    s.launch(pl.x - 16 * (right ? 1 : -1), COURT.STANDY + 8, !right, 'norm');
    ai.newFlight();
    const tooShort = p < S.NET_FAULT_P, tooLong = p > S.OUT_P;
    const q = Math.min(p, 1);   // 정상 구간 기준 세기
    const shortX = COURT.NET - S.SHORT_X, longX = COURT.BL_L + S.LONG_X;
    s.x1 = mx(shortX + q * (longX - shortX) + (Math.random() - 0.5) * S.JITTER);
    s.dur = S.DUR_SHORT + q * (S.DUR_LONG - S.DUR_SHORT);
    if (tooLong) s.x1 = mx(COURT.BL_L - S.OUT_OVER - (p - S.OUT_P) * S.OUT_SLOPE);  // 베이스라인 밖
    if (tooShort) s.dur = S.DUR_FAULT;   // 힘없이 낮게 → 네트를 못 넘음
    else s.ensureClear();
    s.finalize();
    if (tooShort && !s.net) {            // 선수 위치와 관계없이 반드시 네트에 걸리게
      const tN = s.netT();
      if (tN !== null) s.net = { t: tN, y: Math.max(COURT.NETTOP, Math.min(s.at(tN)[1], COURT.NETTOP + 26)) };
    }
    if (this.mode === 'ai') {
      ai.ignore = s.outPred || !!s.net;
      ai.plan = ai.makePlan(S.AI_POWER_SHORT + q * (S.AI_POWER_LONG - S.AI_POWER_SHORT));
    }
    const pct = Math.round(p * 100) + '%';
    const lbl = tooShort ? '서브 너무 짧음 ' + pct : tooLong ? '서브 너무 김 ' + pct : (p < 0.5 ? '숏서브 ' : '롱서브 ') + pct;
    this.hud.setShot((pl.label && this.mode === 'local2p' ? pl.label + ' ' : '') + lbl);
    this.sentShot(pl, lbl, false, 0, true);
  }

  // 내가 친 공을 온라인 상대에게 알림 (궤적은 출발점·도착점·비행시간으로 정해지므로 그것만 보냄)
  sentShot(pl, label, mishit, smashPow, serve) {
    if (this.mode !== 'room' || pl !== this.player || !this.net.connected) return;
    const s = this.shuttle, r = v => Math.round(v * 100) / 100;
    this.net.send({ t: 'hit', x0: r(s.x0), y0: r(s.y0), x1: r(s.x1), y1: r(s.y1), d: Math.round(s.dur * 10000) / 10000, k: s.kind,
      n: s.net ? { t: s.net.t, y: r(s.net.y) } : null, o: s.outPred ? 1 : 0, sv: serve ? 1 : 0, r: this.match.rally,
      l: String(label).slice(0, 30), mh: mishit ? 1 : 0, sp: smashPow ? r(smashPow) : 0 });
  }

  onContact(sx, sy) {
    this.match.rally++;
    this.hud.setRally(this.match.rally);
    this.fx.hit(sx, sy);
  }

  // 득점 문구: code = 'in'(코트 안) · 'out'(아웃) · 'net'(네트) · 'fault'(삑사리 공이 자기 코트) — 진 쪽이 낸 실수 기준
  reasonText(rightWon, code) {
    if (this.mode === 'local2p') {
      const w = rightWon ? 'P1' : 'P2', l = rightWon ? 'P2' : 'P1';
      return { in: w + ' 득점!', out: l + ' 아웃 → ' + w + ' 득점', net: l + ' 네트 → ' + w + ' 득점', fault: l + ' 범실 → ' + w + ' 득점' }[code] || w + ' 득점!';
    }
    if (rightWon) return { in: this.mode === 'ai' && this.ai.frozen ? '너무 빨라서 반응 못 함!' : '득점!', out: '아웃! 잘 봤어요', net: '네트! 득점', fault: '상대 범실!' }[code] || '득점!';
    return { in: '실점...', out: '아웃...', net: '네트...', fault: '범실...' }[code] || '실점...';
  }

  // rightWon: 오른쪽(나·P1)이 득점. sync: 온라인에서 판정한 쪽이 보낸 점수 {pts, opts}
  scorePoint(rightWon, code, landX, sync) {
    const m = this.match;
    m.award(rightWon);
    if (sync) { m.pts = sync.pts; m.opts = sync.opts; }
    else if (this.mode === 'room') this.net.send({ t: 'pt', w: rightWon ? 'R' : 'L', c: code, x: Math.round(landX), pts: m.pts, opts: m.opts });   // R = 보내는 사람 자신
    this.hud.setScore(m.pts, m.opts);
    const col = this.mode === 'local2p' ? (rightWon ? COLORS.me : COLORS.opp) : (rightWon ? COLORS.ok : COLORS.bad);
    this.fx.show(this.reasonText(rightWon, code), col, 1.2);
    this.fx.missPos = [Math.max(10, Math.min(COURT.W - 10, landX)), COURT.GY - 8];
    this.shuttle.hold = false;
    this.hud.setRally(0);
    const w = m.winner();
    if (w) {
      this.phase = 'gameover';
      const again = 'Space 또는 다시 시작 = 재대결' + (this.mode === 'room' ? ' (둘 중 누가 눌러도 함께 시작)' : '') + ' · Esc = 메뉴';
      if (this.mode === 'local2p') {
        this.hud.showMessage((w === 'player' ? '<span style="color:var(--me)">P1</span>' : '<span style="color:var(--opp)">P2</span>') + ' 승리! P1 ' + m.pts + ' : ' + m.opts + ' P2<br>' + again);
      } else if (this.mode === 'room') {
        const R = this.roomRec; R.sets[w === 'player' ? 'me' : 'opp']++;
        if (typeof Account !== 'undefined') Account.recordMatch({ game_type: 'classic', difficulty: 'room', target_score: m.win, player_score: m.pts, ai_score: m.opts, won: w === 'player', opponent: this.oppName, sets: R.sets.me + ':' + R.sets.opp }, { localOnly: true });
        this.hud.showMessage((w === 'player' ? '승리! ' : '패배... ') + m.pts + ' : ' + m.opts + '<br>세트 스코어 <b>' + R.sets.me + ' : ' + R.sets.opp + '</b> (vs ' + escHtmlC(this.oppName) + ')<br>' + again);
      } else {
        if (typeof Account !== 'undefined') Account.recordMatch({ game_type: 'classic', difficulty: m.diffId, target_score: m.win, player_score: m.pts, ai_score: m.opts, won: w === 'player' });
        this.hud.showMessage((w === 'player' ? '승리! ' : '패배... ') + m.pts + ' : ' + m.opts + '<br>' + again);
      }
    } else {
      if (m.isDeuce()) this.fx.show('듀스! ' + m.pts + ' : ' + m.opts, COLORS.warn, 1.4);
      this.phase = 'serve'; this.serveWait = 1.0;
    }
  }

  landingScore() {
    const s = this.shuttle, inB = s.landsInside(), NET = COURT.NET;
    if (s.dir === -1) {  // 오른쪽이 친 공이 왼쪽으로
      if (s.x1 > NET) { this.scorePoint(false, 'fault', s.x1); return; }
      if (inB) this.scorePoint(true, 'in', s.x1);
      else this.scorePoint(false, 'out', s.x1);
    } else {             // 왼쪽이 친 공이 오른쪽으로
      if (s.x1 < NET) { this.scorePoint(true, 'fault', s.x1); return; }
      if (inB) this.scorePoint(false, 'in', s.x1);
      else this.scorePoint(true, 'out', s.x1);
    }
  }

  // ───── 사람 명령 (Input이 호출, pl = 누른 사람의 선수) ─────
  playerShot(pl, type) {
    if (this.phase !== 'flying' || this.shuttle.netDrop || pl.remote) return;
    pl.hit(type);
  }
  jump(pl) { if (this.canAct && !pl.remote) pl.jump(); }
  dash(pl) { if (this.canAct && !pl.remote && pl.dash() && pl === this.player) this.hud.setDash(false); }
  chargeServe(pl, down) {
    if (this.phase !== 'pserve' || this.serverPlayer() !== pl) return;
    const gg = pl.gauge;
    if (down) { if (!gg.on) { gg.on = true; gg.p = 0; } }
    else if (gg.on) { gg.on = false; this.doServe(pl, gg.p); }
  }

  // ───── 친구 1:1 (NetC가 호출) ─────
  netPeerJoined(peer, win) {
    if (this.roomRec.cid !== peer.cid) this.roomRec = { cid: peer.cid, name: peer.name, sets: { me: 0, opp: 0 } };
    this.oppName = peer.name; this.roomRec.name = peer.name;
    this.match.win = win;
    this.hud.setNames(peer.name, '나');
    this.hud.setConfigLabel('친구 1:1 · ' + win + '점');
    this.fx.show(peer.name + ' 입장!', COLORS.ok, 1.2);
    if (this.net.host) setTimeout(() => { if (this.net.peer === peer && this.phase === 'idle') this.start(); }, 600);   // 방장이 시작 신호
    else this.hud.showMessage(escHtmlC(peer.name) + '의 방에 들어왔어요<br>곧 시작합니다…');
  }
  netPeerLeft(peer) {
    const sc = this.active ? ` — ${this.match.pts} : ${this.match.opts}에서 중단` : '';
    this.phase = 'idle'; this.shuttle.hold = false;
    this.p2.releaseAll(); this.net.snap = null;
    this.hud.showMessage(`${escHtmlC((peer && peer.name) || '상대방')}님이 나갔습니다${sc}<br>같은 방 코드(<b>${this.net.code}</b>)로 다시 들어오면 새 경기를 시작합니다<br><small>Esc = 메뉴</small>`);
    this.renderer.draw();
  }
  netError(msg) { this.phase = 'idle'; this.hud.showMessage(msg + '<br>Esc = 메뉴'); this.renderer.draw(); }
  netRestart(m) {
    if ([11, 15, 21].includes(m.win)) this.match.win = m.win;
    this.start(true);
  }
  // 상대가 친 공: 받은 출발점·도착점을 좌우로 뒤집어(x → W − x) 내 쪽으로 오는 공으로
  netShot(m) {
    if (!this.active) return;
    const s = this.shuttle, W = COURT.W;
    if (m.sv) { this.phase = 'flying'; this.player.dashUsed = false; this.hud.setDash(true); }
    else if (this.phase !== 'flying') return;
    s.launch(W - m.x0, m.y0, true, m.k === 'clear' ? 'clear' : 'norm');
    s.x1 = W - m.x1; s.y1 = m.y1; s.dur = Math.max(0.2, +m.d || 1); s.isServe = !!m.sv; s.hold = false;
    s.net = m.n ? { t: +m.n.t, y: +m.n.y } : null; s.outPred = !!m.o;
    this.match.rally = m.r | 0; this.hud.setRally(this.match.rally);
    this.fx.hit(W - m.x0, m.y0); this.p2.swing(); this.ai.newFlight();
    this.hud.setShot('상대 ' + String(m.l || ''));
    if (m.mh) this.fx.show('상대 삑사리!', COLORS.opp, 0.9);
    else if (m.sp) this.fx.show('상대 스매시! x' + (+m.sp).toFixed(1), COLORS.opp, 0.8);
    s.t = Math.min(0.85, this.net.lat / s.dur);   // 지연 보정: 상대가 친 뒤 흐른 시간만큼 앞으로
  }
  netPoint(m) {
    if (!this.active) return;
    const s = this.shuttle; s.hold = false; s.netDrop = null;
    this.scorePoint(m.w === 'L', String(m.c || 'in'), COURT.W - (+m.x || COURT.NET), { pts: m.opts | 0, opts: m.pts | 0 });
  }

  // ───── 메인 루프 ─────
  loop(ts) {
    if (!this.active) { this.running = false; this.renderer.draw(); return; }
    if (!this.lastTs) this.lastTs = ts;
    const real = Math.min((ts - this.lastTs) / 1000, 0.05); this.lastTs = ts;
    if (this.mode === 'room') this.net.tick(real);
    this.update(real);
    this.renderer.draw();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    const p = this.player, L = this.left, ai = this.ai, s = this.shuttle;
    p.move(dt);
    if (this.mode === 'local2p') L.move(dt);
    else if (this.mode === 'room') this.net.apply(dt);
    p.tickSwing(dt); L.tickSwing(dt); this.fx.update(dt);

    if (this.phase === 'pserve') { this.serverPlayer().updateGauge(dt); return; }
    if (this.phase === 'oserve') return;

    if (this.mode === 'ai') ai.move(dt);

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
        if (!this.judgeHere()) return;   // 온라인: 받는 쪽 판정을 기다림
        if (s.dir === -1) this.scorePoint(false, 'net', s.netDrop.x);
        else this.scorePoint(true, 'net', s.netDrop.x);
      }
      return;
    }

    if (this.mode === 'ai') ai.track(dt);
    if (s.hold) return;
    s.t += dt / s.dur;
    if (s.net && s.t >= s.net.t) {
      s.netDrop = { x: COURT.NET + (s.dir === 1 ? -8 : 8), y: s.net.y };
      s.net = null;
      return;
    }
    if (s.t >= 1) {
      if (!this.judgeHere()) { s.t = 1; s.hold = true; return; }   // 온라인: 내가 친 공은 상대 화면이 판정
      this.landingScore();
    }
  }
}

function escHtmlC(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
