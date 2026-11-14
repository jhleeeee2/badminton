// court3d/guide.js — 체험형 튜토리얼: 글 대신 직접 해 보는 4단계 (이동 → 올리기 → 찍기 → 서브)
//   Trainer3D와 같은 자리(game.trainer)에 끼워져서 피딩·판정 흐름을 그대로 씀. AI는 공을 먹여 주기만 함
//   단계 구성·피딩 수치·성공 기준·슬로우 범위는 모두 [게임]용 (실제 규칙과 무관)

const GUIDE_STORE_KEY = 'badminton.c3.guided';
const GUIDE_STEPS = [
  { id: 'move',  title: '이동',   key: 'W A S D로 노란 칸까지 걸어가 보세요', touch: '왼쪽 패드로 노란 칸까지 걸어가 보세요' },
  { id: 'lift',  title: '올리기', key: 'Q를 누르고 있다가, 셔틀이 몸 가까이 와서 화면이 느려지면 떼세요', touch: '올리기를 누르고 있다가, 셔틀이 몸 가까이 와서 화면이 느려지면 떼세요' },
  { id: 'down',  title: '찍기',   key: '높이 뜬 공이 옵니다. E를 누르고 있다가 셔틀이 머리 위로 오면 떼세요', touch: '높이 뜬 공이 옵니다. 찍기를 누르고 있다가 셔틀이 머리 위로 오면 떼세요' },
  { id: 'serve', title: '서브',   key: 'Q를 꾹 누르면 게이지가 왕복합니다. 가운데쯤에서 떼세요 (마우스 = 방향)', touch: '올리기를 꾹 누르면 게이지가 왕복합니다. 가운데쯤에서 떼세요' }
];

class Guide3D {
  constructor(game) {
    this.g = game; this.kind = null; this.step = 0; this.fails = 0; this.finished = false; this.slowR = 1.6;
    this.skipBtn = document.getElementById('c3skip');
    if (this.skipBtn) {
      this.skipBtn.addEventListener('mousedown', e => e.stopPropagation());
      this.skipBtn.addEventListener('click', e => { e.currentTarget.blur(); this.skip(); });
    }
  }
  static seen() { try { return localStorage.getItem(GUIDE_STORE_KEY) === '1'; } catch (e) { return true; } }   // 저장이 막힌 환경이면 매번 뜨지 않게
  static markSeen() { try { localStorage.setItem(GUIDE_STORE_KEY, '1'); } catch (e) { /* 무시 */ } }

  get active() { return !!this.kind; }
  get cur() { return GUIDE_STEPS[this.step]; }
  get serverSide() { return this.cur && this.cur.id === 'serve' ? 'me' : 'opp'; }
  start() { this.kind = 'guide'; this.step = 0; this.fails = 0; this.finished = false; this.target = null; this.moveDone = false; if (this.skipBtn) this.skipBtn.hidden = false; }
  stop() { this.kind = null; this.finished = false; this.target = null; this.g.view.setTarget(null); if (this.skipBtn) this.skipBtn.hidden = true; }

  hint() {
    const s = this.cur, touch = typeof TouchUI !== 'undefined' && TouchUI.on;
    return `${this.step + 1}/${GUIDE_STEPS.length} ${s.title} — ${touch ? s.touch : s.key}`;
  }
  hud() { this.g.hud.setGuide(Math.min(this.step + 1, GUIDE_STEPS.length), GUIDE_STEPS.length, this.finished ? '완료' : this.cur.title); }

  // 매 프레임: 충전 상한 + 이동 단계의 목표 칸 표시·도착 확인
  tick() {
    const g = this.g, ch = g.me.charge;
    // 처음엔 오래 누르고 있기 쉬우므로 충전을 75%에서 멈춤 → 과충전(네트·아웃)과 좁은 정타 타이밍이 안 나옴 [게임]
    if (this.active && ch && ch.type !== 'serve' && ch.c > 0.75) ch.c = 0.75;
    if (!this.active || this.finished || this.cur.id !== 'move' || g.phase !== 'serve' || this.moveDone) return;
    if (!this.target) {
      const me = g.me.pos, sx = me.x > 0 ? -1 : 1;
      this.target = { x: Math.max(-1.9, Math.min(1.9, me.x + sx * 1.7)), z: Math.max(2.2, Math.min(5.6, me.z + 1.5)), w: 1.1, h: 1.1 };
      g.view.setTarget(this.target);
    }
    const t = this.target;
    if (Math.abs(g.me.pos.x - t.x) < t.w / 2 && Math.abs(g.me.pos.z - t.z) < t.h / 2) {
      this.moveDone = true; this.target = null; g.view.setTarget(null);
      this.result({ ok: true, msg: '좋아요!' });
      g.phase = 'point'; g.pointT = 0.9;
    }
  }

  // 서브 차례 대신 치기 쉬운 공을 던져 줌 (이동·서브 단계에서는 던지지 않음)
  feed() {
    const g = this.g, a = g.opp, id = this.cur.id;
    if (id !== 'lift' && id !== 'down') { g.ai.serveT = 1; return; }
    const me = g.me, R = Math.random, rr = (x, y) => x + R() * (y - x);
    this.hitType = null;
    const tx = Math.max(-2.2, Math.min(2.2, me.pos.x + me.right().x * 0.5 * me.h));   // 포핸드 쪽 살짝 옆으로
    const tz = Math.max(2.6, Math.min(5.6, me.pos.z + (id === 'down' ? 0.1 : 0.3)));
    const ang = id === 'down' ? rr(56, 60) : rr(40, 44), y0 = 1.0;
    const p0 = { x: a.pos.x, y: y0, z: a.pos.z + 0.4 };
    const dx = tx - p0.x, dz = tz - p0.z, range = Math.hypot(dx, dz), hx = dx / range, hz = dz / range;
    const sp = Phys3.solveSpeed(p0, hx, hz, ang, range), v0 = Phys3.launchVel(hx, hz, ang, sp);
    const plan = { v0, speed: sp, kmh: Math.round(sp * 3.6), sim: Phys3.simulate(p0, v0), name: '피딩' };
    a.swing('lift', 0.8, p0, 'low'); a.onHit(p0);
    g.launch(a, p0, plan, false);
    g.phase = 'rally';
    g.me.bounds = g.halfBounds('me');
  }

  onPlayerHit() { if (!this.hitType) this.hitType = this.g.lastType; }

  // 셔틀이 바닥에 닿았을 때 판정 → { ok, msg }
  judge(s) {
    const m = this.g.match, p = s.p, mine = s.lastHitter === 'me', id = this.cur.id;
    const touch = typeof TouchUI !== 'undefined' && TouchUI.on;
    if (id === 'serve') {
      if (!mine || !s.serve) return { ok: false, msg: '한 번 더' };
      if (s.netted || p.z > 0) return { ok: false, msg: '네트 — 조금 더 세게' };
      return m.inBox(m.box('opp', m.serveCourt()), p.x, p.z) ? { ok: true, msg: '서브 성공!' } : { ok: false, msg: '서비스 코트 밖 — 게이지 가운데쯤에서' };
    }
    if (!mine) return { ok: false, msg: '놓쳤어요 — 누르고 있다가, 닿을 때 떼기' };
    if (this.hitType !== id) return { ok: false, msg: id === 'lift' ? `이번엔 ${touch ? '올리기' : 'Q(올리기)'}로!` : `이번엔 ${touch ? '찍기' : 'E(찍기)'}로!` };
    if (s.netted || p.z > 0) return { ok: false, msg: id === 'down' ? '네트 — 충전을 조금만' : '네트 — 한 번 더' };
    return { ok: true, msg: m.inSingles(p.x, p.z) ? '좋아요!' : '맞혔어요! (길어서 아웃 — 충전은 짧게)' };
  }

  result(r) {
    const g = this.g;
    if (r.ok) { Sound3.chime(true); g.hud.banner(r.msg, '#5BFFB0', 1.0); this.advance(); }
    else {
      Sound3.chime(false); this.fails++;
      if (this.fails >= 4) { g.hud.banner('괜찮아요 — 다음 단계로 넘어갈게요', '#FFD23F', 1.2); this.advance(); }   // 막히지 않게
      else g.hud.banner(r.msg, '#FF9B9B', 1.2);
    }
    this.hud();
  }
  advance() {
    this.step++; this.fails = 0; this.moveDone = false;
    if (this.step >= GUIDE_STEPS.length) { this.step = GUIDE_STEPS.length - 1; this.finished = true; Guide3D.markSeen(); }
  }
  // 마지막 단계가 끝난 뒤 (game.setupPoint가 호출)
  finish() {
    const g = this.g;
    g.phase = 'over'; g.me.charge = null; g.view.setTarget(null); g.hud.setHint('');
    if (this.skipBtn) this.skipBtn.hidden = true;
    g.view.cheer(1); Sound3.cheer(1);
    if (typeof TouchUI !== 'undefined' && TouchUI.on) {   // 터치: Enter가 없으니 잠시 뒤 자동으로 경기 시작
      g.hud.showMessage('튜토리얼 완료!<br>곧 경기를 시작합니다…');
      setTimeout(() => { if (this.finished && g.mode === 'guide' && g.phase === 'over' && g.onGuideDone) g.onGuideDone(); }, 2200);
      return;
    }
    g.hud.showMessage('튜토리얼 완료!<br>Space 점프 · Shift 런지 · 좌클릭 직선 샷도 있어요 (자세한 건 튜토리얼 버튼)<br><b>Enter</b> 또는 <b>시작</b> = 경기 시작 · Esc = 메뉴');
    g.hud.el.startBtn.textContent = '시작';
  }
  skip() {
    Guide3D.markSeen(); this.finished = true;
    if (this.g.onGuideDone) this.g.onGuideDone();
  }
}
