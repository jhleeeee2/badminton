// court3d/game.js — 3D 게임 본체: 고정 간격 시뮬레이션, 슬로우, 타격 판정, 서브·득점 흐름
// phase: 'idle' → 'serve'(서버가 셔틀을 들고 대기) → 'rally' → 'point'(잠시 멈춤) → 'serve' … → 'over'
//        'pause' = 친구 대전 중 상대가 나감 (점수 그대로 멈춤, 같은 사람이 다시 들어오면 이어서)

const HAND_NAMES = { FH: '포핸드', BH: '백핸드', RTH: '라운드 더 헤드' };
const CAT_NAMES = { over: '머리 위', side: '옆', low: '아래' };

class Game3D {
  constructor(container, hud) {
    this.hud = hud;
    this.view = new CourtView3D(container);
    this.match = new Match3D();
    this.diffId = 'normal';
    this.me = new Athlete3D(this.view.scene, { side: 'me', color: C3.COLORS.me, kit: C3.KITS.me, hand: 'R' });
    this.opp = new Athlete3D(this.view.scene, { side: 'opp', color: C3.COLORS.opp, kit: C3.KITS.opp, hand: 'R' });
    this.ai = new AI3D(this, this.opp);
    this.trainer = new Trainer3D(this); this.mode = 'ai'; this.net = new Net3D();
    // 낙하 지점 표시 켜기/끄기 (L) — 브라우저에 기억
    this.showLand = true;
    try { this.showLand = localStorage.getItem('badminton.c3.showLand') !== '0'; } catch (e) { /* 무시 */ }
    this.hud.setLand(this.showLand);
    // 셔틀 그림자·수직선 켜기/끄기 (G) — 끄면 인/아웃 판단이 어려워짐
    this.showShadow = true;
    try { this.showShadow = localStorage.getItem('badminton.c3.shadow') !== '0'; } catch (e) { /* 무시 */ }
    this.view.setShadowOn(this.showShadow); this.hud.setShadow(this.showShadow);
    // 엔드(코트 끝): myEnd = 내가 서 있는 엔드(0=A, 1=B). 화면 안쪽에는 반대 엔드 배경이 보임
    this.myEnd = 0; this.midSwapped = false; this.swapNext = false;
    // 친구 방: 같은 상대와 계속 하면 세트 스코어 유지
    this.roomRec = { cid: null, name: '', sets: { me: 0, opp: 0 } };
    this.awayPeer = null;
    this.emote = new Emote3D(this, container);
    this.sh = { p: { x: 0, y: 1, z: 2 }, v: { x: 0, y: 0, z: 0 }, live: false, held: null, lastHitter: null, serve: false, netted: false, pred: null };
    this.phase = 'idle'; this.timeScale = 1; this.acc = 0; this.yaw = 0; this.serveU = 0; this.aimNdc = null; this.aimPt = { x: 0, z: -4.5 };
    this.running = false; this.inputOn = false; this.lastTs = 0; this.pointT = 0; this.hitStop = 0;
    this.loop = this.loop.bind(this);
    this.placeForServe();
    this.frame(0);
  }

  configure({ diff, win, hand, mode, train }) {
    this.diffId = diff; this.match.win = win; this.me.setHand(hand || 'R');
    this.mode = ['train', 'room', 'local2p'].includes(mode) ? mode : 'ai';
    if (this.mode === 'train') { this.trainer.start(train || 'str'); this.diffId = 'normal'; }
    else this.trainer.stop();
    if (this.mode !== 'room') { this.hud.setRoom(null); this.net.close(); this.opp.setHand('R'); this.setOppName(this.mode === 'local2p' ? 'P2' : '상대'); this.hud.setSets(null); this.loadViewPrefs(); }
    else this.diffId = 'normal';
    if (this.mode === 'local2p') { this.diffId = 'normal'; this.opp.speedMul = 1; }
    this.setMeName(this.mode === 'local2p' ? 'P1' : '나');
    this.hud.setDuo(this.mode === 'local2p');
    const hn = hand === 'L' ? '왼손' : '오른손';
    this.hud.setConfig(this.mode === 'train' ? TRAIN_INFO[this.trainer.kind].name + ' 훈련 · ' + hn
      : this.mode === 'room' ? '친구 1:1 · ' + win + '점 · ' + hn
      : this.mode === 'local2p' ? '로컬 2인 · ' + win + '점 · P1 ' + hn
      : DIFF_NAMES[diff] + ' · ' + win + '점 · ' + hn);
  }

  get online() { return this.mode === 'room' && this.net.connected; }
  get duo() { return this.mode === 'local2p'; }   // 로컬 2인: opp = P2 (사람)

  start(fromNet) {
    if (this.mode === 'room') {
      if (!this.net.connected) return;   // 친구가 들어와야 시작
      if (!fromNet) this.net.send({ t: 'restart', win: this.match.win });
    }
    this.match.reset(); this.awayPeer = null;
    if (this.mode === 'room' && !this.net.host) this.match.server = 'opp';   // 첫 서브는 방장
    // 엔드: 이전 경기가 끝까지 갔으면 서로 엔드를 바꿈 (실제 규칙: 게임마다 엔드 교대). 친구 방 첫 경기는 방장 A·친구 B
    if (this.swapNext) this.myEnd ^= 1;
    else if (this.mode !== 'room') this.myEnd = 0;
    this.swapNext = false; this.midSwapped = false; this.view.setEnd(this.myEnd ^ 1);
    if (this.mode === 'room') this.hud.setSets(this.roomRec.sets);
    this.hud.hideMessage(); this.hud.setScore(0, 0, this.match.server, null); this.hud.setShot('-'); this.hud.setRally(0);
    if (this.trainer.active) { this.trainer.streak = 0; this.trainer.hud(); } else this.hud.setTrain(null);
    if (this.mode === 'room' && this.net.peer) this.setOppName(this.net.peer.name);
    if (this.duo) { this.setOppName('P2'); this.setMeName('P1'); }
    this.setupPoint();
    this.lastTs = 0;
    if (!this.running) { this.running = true; requestAnimationFrame(this.loop); }
  }
  stop() {
    this.net.close(); this.awayPeer = null; this.emote.close(); this.swapNext = false;
    this.phase = 'idle'; this.me.charge = null; this.opp.charge = null; this.timeScale = 1; this.hud.setGauge(null, '', this.hud.g2);
    this.hud.showMessage(this.hud.introMsg); this.hud.setGauge(null);
  }

  // ───── 서브 준비: 서비스 코트에 선수 배치, 서버가 셔틀을 듦 ─────
  setupPoint() {
    const m = this.match;
    if (this.trainer.active) m.server = 'opp';
    const court = m.serveCourt(), server = m.server, recv = m.other(server);
    this.phase = 'serve';
    for (const a of [this.me, this.opp]) {
      const b = m.box(a.side, court), cx = (b.xMin + b.xMax) / 2;
      const isServer = a.side === server;
      a.pos.x = cx * (isServer ? 0.35 : 0.45) + (cx > 0 ? 0.25 : -0.25);
      a.pos.z = a.side === 'me' ? (isServer ? 3.0 : 3.5) : (isServer ? -3.0 : -3.5);
      a.vel = { x: 0, z: 0 }; a.y = 0; a.vy = 0; a.extT = 0; a.recoverT = 0; a.coolT = 0; a.charge = null; a.swingS = null;
      a.bounds = { xMin: b.xMin + 0.15, xMax: b.xMax - 0.15, zMin: b.zMin + 0.15, zMax: b.zMax - 0.1 };
    }
    Object.assign(this.sh, { live: false, held: server === 'me' ? this.me : this.opp, lastHitter: null, serve: false, netted: false, pred: null, waitNet: false });
    this.view.clearTrail(); this.landPend = null; this.view.setLanding(null); this.view.setPath(null);
    this.ai.reset(); this.ai.serveT = this.trainer.active ? 0.9 : 1.1;
    if (this.trainer.active) {
      this.me.bounds = this.halfBounds('me'); this.view.setTarget(null);
      this.hud.setHint(this.trainer.hint()); return;
    }
    this.hud.setScore(m.pts, m.opts, server, m.matchPoint());
    const cn = court === 'right' ? '오른쪽' : '왼쪽';
    if (this.duo) this.hud.setHint(server === 'me' ? `P1 서브 (${cn} 코트) — Q 꾹, 원하는 세기에서 떼기 · 마우스로 방향` : `P2 서브 (${cn} 코트) — I 꾹, 원하는 세기에서 떼기 · ←→로 방향`);
    else this.hud.setHint(server === 'me' ? `내 서브 (${cn} 코트) — Q를 꾹: 게이지가 왕복, 원하는 세기에서 떼기 · 마우스로 방향` : '상대 서브');
  }
  placeForServe() { this.setupPoint(); this.phase = 'idle'; }

  heldPos(a) {    // 서브 전 셔틀 위치: 라켓 반대 손에 들고 허리 아래
    const r = a.right();
    return { x: a.pos.x + r.x * 0.28 * a.h, y: 0.95, z: a.pos.z + a.facing * 0.42 };
  }

  // ───── 타격 ─────
  serveBy(a, c, yaw) {
    if (this.phase !== 'serve' || this.sh.held !== a) return;
    const p0 = this.heldPos(a);
    a.swing('serve', c, p0, 'low'); a.onHit(p0);
    const plan = Shots3.plan({ side: a.side, type: 'serve', c, yaw, p0, errMul: a.side === 'opp' ? this.ai.d.err : 1 });
    this.launch(a, p0, plan, true);
    this.phase = 'rally';
    // 서브가 맞는 순간부터 자유롭게 이동
    for (const x of [this.me, this.opp]) x.bounds = this.halfBounds(x.side);
    this.hud.setHint('');
  }
  halfBounds(side) { return side === 'me' ? { xMin: -3.4, xMax: 3.4, zMin: 0.35, zMax: 7.6 } : { xMin: -3.4, xMax: 3.4, zMin: -7.6, zMax: -0.35 }; }

  hit(a, sw) {
    const s = this.sh, p0 = { ...s.p }, k = a.classify(p0);
    let yaw = sw.yaw, aimDepth = null;
    if (a.side === 'me') yaw = this.yawTo(p0);   // 내 샷: 타점에서 커서 아래 바닥 점 '방향' (거리는 충전량)
    else if (this.duo) yaw = this.p2YawTo(p0);   // P2: 방향키(←→) 또는 자동으로 상대 반대쪽
    const plan = Shots3.plan({
      side: a.side, type: sw.type, c: sw.c, yaw, p0, aimDepth,
      bh: k.hand === 'BH', rth: k.hand === 'RTH', ext: a.extT > 0, jumping: !a.onGround(),
      errMul: a.side === 'opp' && !this.duo ? this.ai.d.err * this.aiErrMul() * (this.ai.vsSmash ? Progress3.smashErr() : 1) : 1,
      strAng: a.side === 'me' && !this.duo ? Progress3.smashAngle() : 0   // 로컬 2인은 훈련 효과 없이 공평하게
    });
    a.onHit(p0);
    this.launch(a, p0, plan, false, k);
  }

  aiHit() {
    const a = this.opp, s = this.sh;
    if (s.lastHitter === 'opp' || a.swingS) return;
    const sh = this.ai.chooseShot(s.p);
    const sw = a.swing(sh.type, sh.c, s.p); sw.yaw = sh.yaw;
    this.hit(a, sw);
  }

  launch(a, p0, plan, isServe, k) {
    const s = this.sh;
    Object.assign(s, { p: { ...p0 }, v: { ...plan.v0 }, live: true, held: null, lastHitter: a.side, serve: isServe, netted: false, pred: plan.sim, waitNet: false });
    this.match.rally++; this.hud.setRally(this.match.rally);
    if (this.online && a === this.me) {   // 온라인: 발사 정보만 보내면 상대도 같은 궤적을 계산
      const r = v => Math.round(v * 10000) / 10000, m = p0, w = plan.v0;   // 내 좌표 그대로 보내고, 받는 쪽에서 180° 돌림
      this.net.send({ t: 'hit', p: { x: r(m.x), y: r(m.y), z: r(m.z) }, v: { x: r(w.x), y: r(w.y), z: r(w.z) }, name: plan.name, kmh: plan.kmh, serve: !!isServe, hand: k ? k.hand : null, r: this.match.rally });
    }
    // 역동성: 불꽃·충격파·화면 흔들림·줌·소리, 상대는 스플릿 스텝 [게임 연출]
    const pw = Math.min(1, plan.kmh / 260), col = a.side === 'me' ? C3.COLORS.me : C3.COLORS.opp;
    const smash = /스매시/.test(plan.name);
    this.view.burst(p0, col, pw); this.view.shock(p0, col, 0.6 + pw * 1.4);
    this.view.shake(0.02 + pw * pw * 0.32);
    if (smash) {   // 스매시 타격감: 잠깐 멈춤(히트스톱) + 큰 충격파·흔들림·줌 + 화면 번쩍 + 무거운 소리 [게임 연출]
      const k = Math.max(0, Math.min(1, (plan.kmh - 80) / 180));
      this.hitStop = 0.045 + 0.06 * k;
      this.view.shock(p0, 0xFFFFFF, 1.6 + k * 1.6); this.view.burst(p0, 0xFFE08A, 0.6 + 0.4 * k);
      this.view.shake(0.12 + 0.3 * k); this.view.punch(-(5 + 7 * k)); this.view.smashTrail(1.4);
      this.hud.flash(a.side === 'me' ? '#FFB13B' : '#B9A8FF', 0.35 + 0.35 * k);
      Sound3.smash(k);
    }
    Sound3.hit(plan.kmh);
    (a.side === 'me' ? this.opp : this.me).splitStep();
    const who = this.duo ? (a.side === 'me' ? 'P1 ' : 'P2 ') : (a.side === 'me' ? '' : '상대 ');
    const r = this.match.rally;
    if (r >= 8 && r % 4 === 0) { { const sp = this.tempo().spd; this.hud.banner('랠리 ' + r + '!' + (sp > 1.001 ? ' 속도 x' + sp.toFixed(2) : ''), '#FFD23F', 0.9); } this.view.cheer(0.35); Sound3.cheer(0.2); }
    const handTxt = k ? HAND_NAMES[k.hand] + ' ' : '';
    this.hud.setShot(who + handTxt + plan.name + ' · ' + plan.kmh + 'km/h');
    if ((a.side === 'me' || this.duo) && plan.kmh > 200 && /스매시/.test(plan.name)) this.hud.banner(who + plan.name + '! ' + plan.kmh + 'km/h', a.side === 'me' ? '#FF7A45' : '#B9A8FF', 0.9);
    if (a.side === 'me' && !this.duo) {
      const sm = /스매시/.test(plan.name);
      this.ai.vsSmash = sm; this.ai.onIncoming(sm ? Progress3.smashReact() : 0);
      if (this.trainer.active) this.trainer.onPlayerHit(plan.name);
    }
    this.view.clearTrail();
    // 보조 표시 (난이도별): 상대가 친 공의 궤적·낙하 지점·내가 설 위치
    const A = this.trainer.kind === 'jud' ? C3.ASSIST.imp : C3.ASSIST[this.diffId], land = plan.sim.land, toMe = a.side === 'opp' || this.duo;   // 로컬 2인: 받는 사람 누구에게나 표시
    const recv = this.match.other(a.side);
    // 낙하 지점: 난이도별로 늦게·흐리게·작게 표시 (쉬움=바로, 지옥=떨어지기 직전, 임파서블=없음)
    this.view.setLanding(null); this.landPend = null; this.flyT = 0;
    if (land && toMe && A.land && this.showLand) {
      const inn = isServe ? this.match.inBox(this.match.box(recv, this.match.serveCourt()), land.x, land.z) : this.match.inSingles(land.x, land.z);
      this.landPend = { p: land, at: land.t * A.landAt, col: A.inout ? (inn ? 0x34C08B : 0xE25B5A) : 0xFFFFFF, a: A.landA, s: A.landS };
    }
    // 판단력 레벨: 가끔 낙하 지점 힌트(하늘색)를 일찍 보여줌 (경기에서만)
    if (land && toMe && !this.duo && this.showLand && !this.trainer.active && A.landAt > 0.35 && Math.random() < Progress3.hintChance())
      this.landPend = { p: land, at: land.t * 0.35, col: 0x5BC8FF, a: 0.6, s: 1 };
    // (칠 위치 주황 원은 삭제 — 낙하 지점 원만 표시)
    const full = (toMe && A.path) ? Phys3.simulate(p0, plan.v0, { path: true, coarse: 2 }) : null;
    this.view.setPath(full ? full.path : null);
  }

  // 랠리 템포: 랠리가 길어질수록 게임 속도↑, 슬로우 범위↓ (훈련 제외)
  tempo() {
    const T = C3.RALLY_TEMPO, n = (this.trainer.active || this.phase !== 'rally') ? 0 : Math.max(0, this.match.rally - T.START);
    return { spd: Math.min(T.SPEED_MAX, 1 + T.SPEED_STEP * n), slow: Math.max(T.SLOW_MIN, 1 - T.SLOW_STEP * n) };
  }

  // AI 실수 배율: 속도 증가분의 2배 비율로 오차·과충전·오판 확률 증가 (속도 x1.4 → 실수 x1.8)
  aiErrMul() { return 1 + C3.RALLY_TEMPO.AI_ERR_K * (this.tempo().spd - 1); }

  // ───── 보조 표시 (낙하 지점 L · 셔틀 그림자 G) ─────
  //   친구 방에서는 '방 설정': 누가 바꾸든 두 사람 화면에 똑같이 적용 (공정하게)
  //   내 브라우저에 기억하는 건 내가 직접 바꾼 값만 → 방을 나가면 내 설정으로 돌아옴
  applyLand(on) {
    this.showLand = on;
    if (!on) { this.landPend = null; this.view.setLanding(null); }
    this.hud.setLand(on);
  }
  applyShadow(on) { this.showShadow = on; this.view.setShadowOn(on); this.hud.setShadow(on); }
  loadViewPrefs() {
    let land = true, sh = true;
    try { land = localStorage.getItem('badminton.c3.showLand') !== '0'; sh = localStorage.getItem('badminton.c3.shadow') !== '0'; } catch (e) { /* 무시 */ }
    this.applyLand(land); this.applyShadow(sh);
  }
  sendViewOpts() { if (this.mode === 'room' && this.net.connected) this.net.send({ t: 'opt', land: this.showLand, shadow: this.showShadow }); }
  netOpt(m) {
    const land = !!m.land, sh = !!m.shadow, txt = [];
    if (land !== this.showLand) txt.push('낙하 표시 ' + (land ? '켬' : '끔'));
    if (sh !== this.showShadow) txt.push('그림자 ' + (sh ? '켬' : '끔'));
    this.applyLand(land); this.applyShadow(sh);
    if (txt.length && !m.sync) this.hud.banner('상대가 ' + txt.join(' · ') + ' (둘 다 적용)', '#9FD8FF', 1.2);
  }

  toggleShadow() {
    this.applyShadow(!this.showShadow);
    try { localStorage.setItem('badminton.c3.shadow', this.showShadow ? '1' : '0'); } catch (e) { /* 무시 */ }
    this.sendViewOpts();
    this.hud.banner((this.showShadow ? '셔틀 그림자 켬' : '셔틀 그림자 끔 — 인/아웃은 눈으로!') + (this.online ? ' (둘 다 적용)' : ''), '#9FD8FF', 0.9);
  }

  toggleLand() {
    this.applyLand(!this.showLand);
    try { localStorage.setItem('badminton.c3.showLand', this.showLand ? '1' : '0'); } catch (e) { /* 무시 */ }
    this.sendViewOpts();
    this.hud.banner((this.showLand ? '낙하 지점 표시 켬' : '낙하 지점 표시 끔') + (this.online ? ' (둘 다 적용)' : ''), '#9FD8FF', 0.8);
  }

  // ───── 온라인 (Net3D가 호출) ─────
  setOppName(n) {
    const b = document.querySelector('#c3board .opp .nm'), c = document.querySelector('.card.team.opp .lbl');
    if (b) b.textContent = n; if (c) c.textContent = n;
  }
  setMeName(n) {
    const b = document.querySelector('#c3board .me .nm'), c = document.querySelector('.card.team.me .lbl');
    if (b) b.textContent = n; if (c) c.textContent = n;
  }
  netPeerJoined(peer, win) {
    this.opp.setHand(peer.hand);
    const away = this.awayPeer;
    if (away && peer.cid && peer.cid === away.cid) {   // 나갔던 그 사람이 다시 들어옴 → 이어서
      this.awayPeer = null; this.setOppName(peer.name); this.roomRec.name = peer.name;
      const m = this.match, R = this.roomRec;
      this.net.send({ t: 'resume', live: !!away.live, pts: m.opts, opts: m.pts, server: flip3(m.server), win: m.win,
        sets: { me: R.sets.opp, opp: R.sets.me }, end: this.myEnd ^ 1, mid: this.midSwapped, swapNext: this.swapNext });
      this.net.send({ t: 'opt', land: this.showLand, shadow: this.showShadow, sync: true });
      this.hud.banner('상대방이 다시 참여했습니다', '#5BFFB0', 1.8);
      this.resumeAfterRejoin(away.live);
      return;
    }
    // 새 상대 (또는 처음): 다른 사람이면 세트 스코어 새로
    if (this.roomRec.cid !== peer.cid) this.roomRec = { cid: peer.cid, name: peer.name, sets: { me: 0, opp: 0 } };
    this.roomRec.name = peer.name; this.awayPeer = null;
    this.match.win = win; this.configure({ diff: 'normal', win, hand: this.me.hand, mode: 'room' });
    this.setOppName(peer.name); this.hud.setSets(this.roomRec.sets);
    this.myEnd = this.net.host ? 0 : 1; this.swapNext = false; this.view.setEnd(this.myEnd ^ 1);
    this.hud.banner(peer.name + ' 입장!', '#5BFFB0', 1.2);
    if (this.net.host) { this.net.send({ t: 'opt', land: this.showLand, shadow: this.showShadow, sync: true }); setTimeout(() => { if (this.net.peer === peer) this.start(); }, 600); }   // 방장 설정으로 맞추고 시작 신호
    else this.hud.showMessage(escHtml(peer.name) + '의 방에 들어왔어요<br>곧 시작합니다…');
  }
  // 다시 들어온 쪽: 남아 있던 쪽이 보낸 점수·서브·세트·엔드로 맞추고 이어서
  netResume(m) {
    const M = this.match;
    this.configure({ diff: 'normal', win: [11, 15, 21].includes(m.win) ? m.win : M.win, hand: this.me.hand, mode: 'room' });
    M.pts = m.pts | 0; M.opts = m.opts | 0; M.server = m.server === 'opp' ? 'opp' : 'me'; M.rally = 0;
    this.roomRec.sets = { me: (m.sets && m.sets.me) | 0, opp: (m.sets && m.sets.opp) | 0 };
    this.myEnd = m.end ? 1 : 0; this.midSwapped = !!m.mid; this.swapNext = !!m.swapNext; this.view.setEnd(this.myEnd ^ 1);
    this.hud.setSets(this.roomRec.sets);
    if (this.net.peer) this.setOppName(this.net.peer.name);
    this.hud.banner('경기에 다시 참여했습니다', '#5BFFB0', 1.8);
    this.resumeAfterRejoin(m.live);
  }
  resumeAfterRejoin(live) {
    const m = this.match;
    if (live) {   // 중단된 랠리는 무효 → 같은 점수로 다시 서브
      this.hud.hideMessage(); this.hud.setRally(0); this.hud.setShot('-');
      this.setupPoint();
      this.lastTs = 0;
      if (!this.running) { this.running = true; requestAnimationFrame(this.loop); }
    } else {
      this.phase = 'over';
      this.hud.setScore(m.pts, m.opts, m.server, null);
      this.hud.showMessage(`세트 스코어 ${this.roomRec.sets.me} : ${this.roomRec.sets.opp}<br>Enter 또는 다시 시작 = 다음 경기 (둘 중 누가 눌러도 함께 시작) · Esc = 메뉴`);
    }
  }
  netPeerLeft(peer) {
    const live = ['serve', 'rally', 'point', 'pause'].includes(this.phase) && !this.match.winner();
    this.awayPeer = { cid: peer && peer.cid, name: peer && peer.name, live };
    const s = this.sh;
    s.live = false; s.held = null; s.waitNet = false;
    this.landPend = null; this.view.setLanding(null); this.view.setPath(null);
    this.me.charge = null; this.me.swingS = null; this.hud.setGauge(null); this.hud.setHint(''); this.timeScale = 1;
    this.phase = live ? 'pause' : (this.phase === 'over' ? 'over' : 'idle');
    if (live && !this.running) { this.running = true; this.lastTs = 0; requestAnimationFrame(this.loop); }
    this.hud.banner('상대방이 나갔습니다', '#FF6B6B', 2);
    this.hud.showMessage('상대방이 나갔습니다' + (live ? ` — 점수 ${this.match.pts} : ${this.match.opts}에서 멈춤` : '')
      + `<br>같은 방 코드(<b>${this.net.code}</b>)로 다시 들어오면 ${live ? '이어서 경기합니다' : '세트 스코어가 이어집니다'}<br><small>Esc = 메뉴</small>`);
  }
  netEmote(m) { this.emote.show('opp', String(m.id || '')); }
  netError(msg) {
    this.phase = 'idle'; this.hud.showMessage(msg + '<br>Esc = 메뉴');
  }
  netRestart(m) {
    if (this.phase === 'pause') return;
    if ([11, 15, 21].includes(m.win)) this.match.win = m.win;
    this.start(true);
  }
  netSwing(m) {
    const a = this.opp;
    a.charge = null;
    a.swing(m.ty, m.c, m.sp ? mir3(m.sp) : null, m.cat);
  }
  netLaunch(m) {
    if (this.phase === 'idle' || this.phase === 'over') return;
    const p0 = mir3(m.p), v0 = mir3(m.v), a = this.opp;
    if (m.serve) {
      if (this.phase !== 'serve') this.setupPoint();   // 아직 득점 연출 중이었으면 바로 서브 상태로
      this.phase = 'rally';
      for (const x of [this.me, this.opp]) x.bounds = this.halfBounds(x.side);
      this.hud.setHint('');
      a.swing('serve', 0.5, p0, 'low');
    } else if (this.phase !== 'rally') return;
    if (!a.swingS) a.swing('flat', 0.5, p0, 'side');
    a.onHit(p0);
    this.match.rally = Math.max(0, (m.r | 0) - 1);   // launch()에서 +1
    this.launch(a, p0, { v0, sim: Phys3.simulate(p0, v0), kmh: m.kmh | 0, name: String(m.name || '') }, !!m.serve, m.hand ? { hand: m.hand } : null);
    // 지연 보정: 상대가 친 뒤 흐른 시간만큼 셔틀을 앞으로 감음
    const ff = Math.min(NET3.MAX_FF, this.net.lat) * C3.GAME_SPEED * this.tempo().spd, STEP = C3.PHYS.STEP, s = this.sh;
    for (let t = 0; t < ff && s.live && !s.netted; t += STEP) {
      const prev = { ...s.p };
      Phys3.step(s.p, s.v, STEP); this.flyT += STEP;
      const nh = Phys3.netHit(prev, s.p);
      if (nh) { s.netted = true; s.p.x = nh.x; s.p.y = nh.y; s.p.z = -0.06; s.v = { x: 0, y: -0.5, z: 0 }; this.view.setLanding(null); this.view.netWobble(); Sound3.net(); }
      if (s.p.y <= 0.02) { s.p.y = 0.02; break; }
    }
  }
  netPoint(m) {
    if (this.phase === 'idle' || this.phase === 'over') return;
    const s = this.sh;
    if (s.live) {   // 내 화면의 셔틀 정리 (낙하 표시)
      s.live = false; this.landPend = null; this.view.setLanding(null); this.view.setPath(null);
      this.view.ripple({ x: s.p.x, y: 0, z: s.p.z }, 0xFFFFFF, 1.0);
    }
    this.point(flip3(m.w), String(m.r || ''), { pts: m.pts | 0, opts: m.opts | 0 });
  }

  // ───── 판정 ─────
  landed() {
    const s = this.sh, m = this.match, hitter = s.lastHitter, other = m.other(hitter);
    const landSide = s.p.z > 0 ? 'me' : 'opp';
    s.live = false; this.landPend = null; this.view.setLanding(null); this.view.setPath(null);
    const inside = m.inSingles(s.p.x, s.p.z);
    this.view.ripple(s.p, inside ? 0xFFFFFF : 0xFF4D4D, 1.2); this.view.burst({ x: s.p.x, y: 0.03, z: s.p.z }, inside ? 0xFFFFFF : 0xFF4D4D, 0.15); Sound3.land();
    if (this.trainer.active) {   // 훈련 판정 → 잠깐 멈춘 뒤 다음 피딩
      this.trainer.result(this.trainer.judge(s));
      this.phase = 'point'; this.pointT = 0.9; this.me.charge = null; this.view.setTarget(null);
      return;
    }
    if (landSide === hitter) return this.point(other, s.netted ? '네트!' : '범실');
    if (s.serve) {
      const ok = m.inBox(m.box(landSide, m.serveCourt()), s.p.x, s.p.z);
      return ok ? this.point(hitter, '서브 에이스!') : this.point(other, '서브 폴트 (서비스 코트 밖)');
    }
    if (m.inSingles(s.p.x, s.p.z)) this.point(hitter, '득점');
    else this.point(other, '아웃');
  }

  point(winner, reason, sync) {
    const m = this.match;
    m.award(winner);
    if (sync) { m.pts = sync.pts; m.opts = sync.opts; }   // 온라인: 판정한 쪽 점수로 맞춤
    else if (this.online) this.net.send({ t: 'pt', w: winner, r: reason, pts: m.opts, opts: m.pts });   // w는 내 기준(받는 쪽이 뒤집음), 점수는 상대 기준으로 바꿔 보냄
    const meWon = winner === 'me';
    this.me.react(meWon ? 'win' : 'lose'); this.opp.react(meWon ? 'lose' : 'win');
    this.view.umpireSignal(winner);   // 심판이 득점한 쪽으로 팔을 듦
    this.view.cheer(meWon ? 1 : 0.55); Sound3.cheer(meWon ? 1 : 0.5); Sound3.chime(meWon);
    this.hud.setScore(m.pts, m.opts, m.server, m.winner() ? null : m.matchPoint()); this.hud.setRally(0);
    const mine = winner === 'me';
    const wn = mine ? 'P1' : 'P2';
    const txt = this.duo ? (reason === '득점' ? wn + ' 득점!' : wn + ' 득점 · ' + reason)
      : reason === '득점' ? (mine ? '득점!' : '실점') : (mine ? '득점! ' : '실점 · ') + reason;
    this.hud.banner(txt, this.duo ? (mine ? '#FFB13B' : '#B9A8FF') : mine ? '#5BFFB0' : '#FF6B6B', 1.3);
    this.phase = 'point'; this.pointT = 1.4; this.me.charge = null;
    const w = m.winner();
    if (w) {
      this.phase = 'over'; this.swapNext = true;   // 다음 경기는 엔드 교대
      let setTxt = '';
      if (this.mode === 'room') {
        const R = this.roomRec; R.sets[w]++; this.hud.setSets(R.sets);
        setTxt = `<br>세트 스코어 <b>${R.sets.me} : ${R.sets.opp}</b> (vs ${escHtml(R.name || '친구')})`;
        if (typeof Account !== 'undefined') Account.recordMatch({ game_type: 'court3d', difficulty: 'room', target_score: m.win, player_score: m.pts, ai_score: m.opts, won: w === 'me', opponent: R.name || '친구', sets: R.sets.me + ':' + R.sets.opp }, { localOnly: true });
      } else if (!this.trainer.active && !this.duo && typeof Account !== 'undefined') Account.recordMatch({ game_type: 'court3d', difficulty: this.diffId, target_score: m.win, player_score: m.pts, ai_score: m.opts, won: w === 'me' });
      const head = this.duo ? `${w === 'me' ? 'P1' : 'P2'} 승리! P1 ${m.pts} : ${m.opts} P2` : `${w === 'me' ? '승리!' : '패배...'} ${m.pts} : ${m.opts}`;
      this.hud.showMessage(`${head}${setTxt}<br>Enter 또는 다시 시작 = 재대결${this.mode === 'room' ? ' (둘 중 누가 눌러도 함께 시작)' : ''} · Esc = 메뉴`);
    } else if (!this.trainer.active && !this.midSwapped && m.midPoint() && Math.max(m.pts, m.opts) >= m.midPoint()) {
      // 코트 체인지: 15점 이상 경기에서 한쪽이 절반 점수에 닿으면 엔드 교대 (양쪽 화면이 같은 점수로 각자 계산)
      this.midSwapped = true; this.myEnd ^= 1;
      this.pointT = 2.6;
      const at = m.pts + ' : ' + m.opts;
      setTimeout(() => {
        if (this.phase === 'idle') return;
        this.view.setEnd(this.myEnd ^ 1); this.view.cheer(0.5);
        this.hud.banner('코트 체인지! ' + at, '#FFD23F', 1.6); this.hud.flash('#FFFFFF', 0.6);
      }, 1100);
    } else {
      const mp = m.matchPoint();
      if (mp) { this.hud.banner(this.duo ? (mp === 'me' ? 'P1' : 'P2') + ' 매치 포인트!' : mp === 'me' ? '매치 포인트!' : '상대 매치 포인트', mp === 'me' ? '#FFD23F' : '#C9B8FF', 1.6); Sound3.chime(mp === 'me'); }
      else if (m.isDeuce()) this.hud.banner('듀스! ' + m.pts + ' : ' + m.opts, '#F2A93B', 1.4);
    }
  }

  // ───── 루프 ─────
  loop(ts) {
    if (this.phase === 'idle') { this.running = false; return; }
    if (!this.lastTs) this.lastTs = ts;
    const real = Math.min(0.05, (ts - this.lastTs) / 1000); this.lastTs = ts;
    this.frame(real);
    requestAnimationFrame(this.loop);
  }

  frame(real) {
    const s = this.sh, STEP = C3.PHYS.STEP;
    // 슬로우: 셔틀이 칠 차례인 선수의 라켓 팔 어깨 근처면
    let slow = false;
    const tp = this.tempo();
    if (s.live && !s.netted && this.phase === 'rally') {
      for (const a of [this.me, this.opp]) {
        if (a.side === s.lastHitter || (a.side === 'opp' && (!C3.SLOW.ON_AI || this.trainer.active))) continue;   // 훈련: AI 쪽 슬로우 없음
        // 순발력 레벨만큼 내 슬로우 범위 증가 · 훈련 중엔 슬로우를 덜 걸리게(작은 범위, 레벨 보너스 없음)
        const S = C3.SLOW, nz = Math.abs(s.p.z), netK = nz <= S.NET_NEAR ? S.NET_MUL : nz >= S.NET_FAR ? 1 : S.NET_MUL + (1 - S.NET_MUL) * (nz - S.NET_NEAR) / (S.NET_FAR - S.NET_NEAR);   // 네트 앞일수록 좁게
        const sh = a.shoulder(), R = (this.trainer.active ? S.TRAIN_RADIUS : (S.RADIUS + (a.side === 'me' && !this.duo ? Progress3.slowBonus() : 0)) * tp.slow) * netK;   // 랠리가 길수록 슬로우 범위 축소
        if (Math.hypot(s.p.x - sh.x, s.p.y - sh.y, s.p.z - sh.z) < R) slow = true;
      }
    }
    const target = slow ? C3.SLOW.SCALE : 1, rate = slow ? C3.SLOW.IN_RATE : C3.SLOW.OUT_RATE;
    this.timeScale += (target - this.timeScale) * Math.min(1, real * rate);
    this.hud.setSlow((1 - this.timeScale) / (1 - C3.SLOW.SCALE));

    this.me.updateCharge(real);
    if (this.duo) this.opp.updateCharge(real);
    if (this.mode === 'room') this.net.tick(real);
    let sim = real * this.timeScale * C3.GAME_SPEED * tp.spd;   // 랠리 템포 배율
    this.simRate = this.timeScale * C3.GAME_SPEED * tp.spd;
    if (this.hitStop > 0) { this.hitStop -= real; sim = 0; }   // 히트스톱 중엔 시간 정지
    if (this.phase === 'serve' || this.phase === 'rally') {
      this.acc += sim;
      while (this.acc >= STEP) { this.step(STEP); this.acc -= STEP; }
    } else if (this.phase === 'point') {
      this.pointT -= real;
      for (const a of [this.me, this.opp]) { a.moveDir = { x: 0, z: 0 }; a.update(sim); }
      if (this.mode === 'room') this.net.applyRemote(sim, this.simRate || C3.GAME_SPEED);
      if (this.pointT <= 0) this.setupPoint();
    }
    else if (this.phase === 'pause') {   // 상대가 나간 동안: 내 선수만 걸어 다닐 수 있음 (서브·타격 불가)
      this.opp.moveDir = { x: 0, z: 0 };
      for (const a of [this.me, this.opp]) a.update(real * C3.GAME_SPEED);
    }
    if (this.sh.live && this.phase === 'point') this.sh.live = false;
    this.emote.update(real);

    // 화면
    if (s.held) s.p = this.heldPos(s.held);
    this.me.animate(sim || 0.016, s.p, s.live && s.lastHitter !== 'me');
    this.opp.animate(sim || 0.016, s.p, s.live && s.lastHitter !== 'opp');
    this.view.setShuttle(s.p, s.live ? s.v : { x: 0, y: 0, z: 0 }, this.phase !== 'pause');
    // 조준: 커서 아래 바닥 점을 구해 그쪽 방향으로 (3D에서도 조준선이 커서를 지나가게)
    if (this.aimNdc) { const q = this.view.floorPoint(this.aimNdc.x, this.aimNdc.y); if (q) this.aimPt = q; }
    const mySrv = this.phase === 'serve' && this.match.server === 'me';
    this.view.setAim(this.me.pos.x, this.me.pos.z, mySrv ? this.aimYaw() : this.yawTo(this.me.pos), mySrv || this.phase === 'rally', null);
    this.view.setMarkers(this.me, this.opp, this.me.extT > 0 ? this.me.extPhase() : 0, this.me.extReady());
    this.view.updateFx(real || 0.016);
    this.view.followCamera(this.me.pos.x, real || 0.016, this.me.pos.z, s.live ? s.p : null);
    this.hud.update(real, this.me, s, this.duo ? this.opp : null);
    this.view.render();
  }

  step(dt) {
    const s = this.sh;
    this.me.update(dt); this.opp.update(dt);
    if (this.mode === 'room') this.net.applyRemote(dt, this.simRate || C3.GAME_SPEED); else if (!this.duo) this.ai.update(dt);
    if (!s.live || s.waitNet) return;
    const prev = { ...s.p };
    this.flyT += dt;
    const lp = this.landPend;
    if (lp && this.flyT >= lp.at) { this.view.setLanding(lp.p, lp.col, lp.a, lp.s); this.landPend = null; }
    if (s.netted) { s.v.x = 0; s.v.z = 0; }
    Phys3.step(s.p, s.v, dt);
    if (!s.netted) {
      const nh = Phys3.netHit(prev, s.p);
      if (nh) {   // 네트에 걸림 → 친 쪽 코트로 떨어짐
        s.netted = true; s.p.x = nh.x; s.p.y = nh.y; s.p.z = s.lastHitter === 'me' ? 0.06 : -0.06; s.v = { x: 0, y: -0.5, z: 0 };
        this.landPend = null; this.view.setLanding(null); this.view.setPath(null);
        this.view.netWobble(); Sound3.net();
        return;
      }
    }
    if (s.p.y <= 0) {
      s.p.y = 0;
      if (this.online && s.lastHitter === 'me') { s.waitNet = true; s.v = { x: 0, y: 0, z: 0 }; return; }   // 판정은 받는 쪽(상대)이 보냄
      this.landed(); return;
    }
    // 플레이어 타격 판정 (스윙 창 안에서 셔틀이 리치 안 + 내 코트 쪽)
    const a = this.me;
    if (!s.netted && s.lastHitter !== 'me' && a.canHitNow() && s.p.z > -0.02) {
      const sh = a.shoulder();
      if (Math.hypot(s.p.x - sh.x, s.p.y - sh.y, s.p.z - sh.z) <= a.reach()) this.hit(a, a.swingS);
    }
    // 로컬 2인: P2도 같은 방식 (스윙 창 안 + 리치 안 + P2 코트 쪽)
    const b = this.opp;
    if (this.duo && s.live && !s.netted && s.lastHitter !== 'opp' && b.canHitNow() && s.p.z < 0.02) {
      const sh = b.shoulder();
      if (Math.hypot(s.p.x - sh.x, s.p.y - sh.y, s.p.z - sh.z) <= b.reach()) this.hit(b, b.swingS);
    }
    // 강하게 충전한 샷을 정타 타이밍 밖에서 뗐을 때 알려줌
    const sw = a.swingS;
    if (sw && !sw.hit && !sw.told && sw.t > sw.window && sw.window < C3.BODY.HIT_WINDOW - 0.01 && s.lastHitter !== 'me' && !s.netted) {
      sw.told = true;
      const sh = a.shoulder();
      if (Math.hypot(s.p.x - sh.x, s.p.y - sh.y, s.p.z - sh.z) < a.reach() * 2.2) this.hud.banner('헛스윙! 풀차징은 정확한 타이밍에만', '#FFB13B', 0.9);
    }
  }

  // ───── 플레이어 명령 (Input3D가 호출) ─────  a = 누른 사람의 선수 (기본 me, 로컬 2인이면 opp = P2도)
  press(type, a = this.me) {
    if (a === this.opp && !this.duo) return;
    if (this.phase === 'serve' && this.match.server === a.side && type === 'lift') a.startCharge('serve');
    else if (this.phase === 'rally') a.startCharge(type);
  }
  release(type, a = this.me) {
    const ch = a.charge;
    if (!ch || (ch.type !== type && !(ch.type === 'serve' && type === 'lift'))) return;
    a.takeCharge();
    if (ch.type === 'serve') { this.serveBy(a, ch.c, a === this.me ? this.aimYaw() : this.p2ServeYaw()); return; }
    const s = this.sh;
    const sp = s.live ? s.p : null;
    Sound3.whoosh();
    const swp = sp && Math.hypot(sp.x - a.pos.x, sp.z - a.pos.z) < 3 ? sp : null, cat = { down: 'over', lift: 'low', flat: 'side' }[type];
    a.swing(type, ch.c, swp, cat);
    if (this.online && a === this.me) this.net.send({ t: 'sw', ty: type, c: Math.round(ch.c * 100) / 100, sp: swp ? { x: swp.x, y: swp.y, z: swp.z } : null, cat });
  }
  // P2 조준 [게임 설계]: 마우스가 없으니 ←/→를 누르고 있으면 그쪽 사이드라인 가까이, 안 누르면 P1이 없는 쪽으로
  //   (화면 기준 ← = 세계 −x. 각도는 Shots3 규칙대로 '치는 사람 기준 오른쪽 = +')
  p2YawTo(o) {
    const u = this.p2Aim || 0, me = this.me.pos;
    const tx = u ? u * 2.3 : Math.max(-1.8, Math.min(1.8, -me.x * 0.9 + (Math.abs(me.x) < 0.3 ? (Math.random() < 0.5 ? -1.2 : 1.2) : 0)));
    const tz = 4.6, M = C3.AIM_YAW_MAX;
    return Math.max(-M, Math.min(M, Math.atan2(-(tx - o.x), tz - o.z)));
  }
  p2ServeYaw() {
    const b = this.match.box('me', this.match.serveCourt()), p = this.heldPos(this.opp);
    const y0 = Math.atan2(-((b.xMin + b.xMax) / 2 - p.x), (b.zMin + b.zMax) / 2 - p.z);
    return y0 - (this.p2Aim || 0) * C3.AIM_MAX * 0.5;
  }
  // 조준 각도: 랠리 땐 마우스 그대로, 내 서브 땐 대각선 서비스 코트 중앙을 기준으로 마우스가 ±조정 [게임 보조]
  aimYaw() {
    if (!(this.phase === 'serve' && this.match.server === 'me')) return this.yaw;
    const b = this.match.box('opp', this.match.serveCourt()), p = this.heldPos(this.me);
    const y0 = Math.atan2((b.xMin + b.xMax) / 2 - p.x, -(((b.zMin + b.zMax) / 2) - p.z));
    return y0 + this.serveU * C3.AIM_MAX * 0.5;
  }
  // 점 o에서 조준점(커서 아래 바닥)까지의 방향 각. 내 쪽(뒤·옆)을 가리키면 옆 끝으로 제한
  yawTo(o) {
    const t = this.aimPt, M = C3.AIM_YAW_MAX;
    const dx = t.x - o.x, dz = -(t.z - o.z);
    if (dz < 0.3) return Math.sign(dx || 1) * M;
    return Math.max(-M, Math.min(M, Math.atan2(dx, dz)));
  }
  jump(a = this.me) { if ((a === this.me || this.duo) && (this.phase === 'rally' || this.phase === 'serve')) a.jump(); }
  sendEmote(id) {
    if (!this.emote.show('me', id)) return;
    if (this.mode === 'room' && this.net.connected) this.net.send({ t: 'emo', id });
  }
  // Shift 런지: 이동키 방향 우선, 없으면 셔틀이 내 라켓 팔에 가장 가깝게 지나갈 지점 쪽으로
  extend(me = this.me) {
    if (this.phase !== 'rally' || (me === this.opp && !this.duo)) return;
    const s = this.sh, own = me.side === 'me' ? 1 : -1;
    let target = null;
    if (s.live && s.lastHitter !== me.side && !s.netted) {
      const sim = Phys3.simulate(s.p, s.v, { path: true, coarse: 2 }), sh = me.shoulder();
      let best = 1e9;
      for (const q of sim.path) {
        if (q.z * own < 0.2 || q.y < 0.15 || q.y > 2.9) continue;
        const d = Math.hypot(q.x - sh.x, (q.y - sh.y) * 0.5, q.z - sh.z);
        if (d < best) { best = d; target = q; }
      }
    }
    if (me.extend(target)) { Sound3.whoosh(); this.view.dust(me.pos, me.extDir); }
  }
}

function escHtml(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
