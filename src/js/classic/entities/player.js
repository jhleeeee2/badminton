// entities/player.js — 사람이 조작하는 선수: 이동, 대쉬, 앉기, 서브 게이지, 타격·파워·삑사리
//   side 'R' = 오른쪽 코트(1인·P1·온라인의 나), 'L' = 왼쪽 코트(로컬 2인의 P2, 온라인의 상대)
//   remote = true면 키보드가 아니라 네트워크로 받은 상태대로 움직임(NetC가 x·점프·앉기를 넣어 줌)

class Player extends Athlete {
  constructor(game, side) {
    side = side === 'L' ? 'L' : 'R';
    super(game, side === 'R' ? HOME.player : HOME.ai, side === 'R' ? -1 : +1, side === 'R' ? COLORS.me : COLORS.opp);
    this.side = side;
    this.fwd = side === 'R' ? -1 : 1;                // 네트 쪽 방향(x 부호)
    this.ctrl = { L: false, R: false, C: false };   // 입력 상태 (Input이 씀)
    this.dashT = 0; this.dashDir = 0; this.dashUsed = false;
    this.gauge = { on: false, p: 0 };                // 서브 게이지 (0~1)
    this.remote = false;
    this.label = '';                                 // 최근 샷 표시 앞에 붙는 이름 ('' = 나)
  }

  resetForMatch() {
    this.resetBody();
    this.dashT = 0; this.dashUsed = false;
    this.gauge.on = false; this.gauge.p = 0;
  }
  releaseAll() { const c = this.ctrl; c.L = c.R = c.C = false; this.gauge.on = false; }

  get crouched() { return this.ctrl.C && this.jy === 0; }

  // 공이 이 선수 쪽으로 오는 중인지 (Shuttle.dir: +1 = 오른쪽으로)
  incoming(s) { return s.dir === (this.side === 'R' ? 1 : -1); }

  move(dt) {
    if (this.remote) return;   // 온라인 상대: NetC.apply가 위치를 넣어 줌
    const ms = MOVE.SPEED * (this.crouched ? MOVE.CROUCH_SPEED : 1);
    if (this.ctrl.L) this.x -= ms * dt;
    if (this.ctrl.R) this.x += ms * dt;
    if (this.dashT > 0) { this.x += this.dashDir * MOVE.DASHV * dt; this.dashT -= dt; }
    if (this.side === 'R') this.x = Math.max(COURT.NET + 24, Math.min(COURT.W - 20, this.x));
    else this.x = Math.max(20, Math.min(COURT.NET - 24, this.x));
    this.updatePhysics(dt);
  }

  // 랠리당 1회, 이동키와 함께
  dash() {
    if (this.dashUsed || (!this.ctrl.L && !this.ctrl.R)) return false;
    this.dashUsed = true; this.dashT = MOVE.DASH_TIME; this.dashDir = this.ctrl.L ? -1 : 1;
    return true;
  }

  // 누르는 동안 게이지가 차오름 (CHARGE_TIME초에 1, 계속 누르면 P_MAX까지 → 아웃 구간)
  updateGauge(dt) {
    const g = this.gauge;
    if (!g.on) return;
    g.p = Math.min(SERVE.P_MAX, g.p + dt / SERVE.CHARGE_TIME);
  }

  // 전진(네트 쪽)하며 치면 +, 후진하며 치면 −
  power(sy) {
    const toNet = this.fwd < 0 ? this.ctrl.L : this.ctrl.R, away = this.fwd < 0 ? this.ctrl.R : this.ctrl.L;
    const run = toNet ? POWER.FORWARD : (away ? POWER.BACKWARD : 0);
    const db = this.dashT > 0 ? (this.dashDir === this.fwd ? POWER.DASH_FWD : POWER.DASH_BACK) : 0;
    return Math.max(POWER.MIN, 1 + Math.max(0, COURT.BASE - sy) / POWER.HEIGHT_DIV + run + db);
  }

  hit(type) {
    const g = this.game, s = g.shuttle;
    this.swing();
    if (!this.incoming(s)) return;
    const cr = this.crouched;
    const [sx, sy] = s.pos(), [rx, ry] = this.racket();
    const reach = MOVE.REACH + (cr ? MOVE.CROUCH_REACH : 0);
    if (Math.hypot(sx - rx, sy - ry) >= reach) return;

    g.onContact(sx, sy);
    s.isServe = false;
    const toRight = this.side === 'L', pre = this.label ? this.label + ' ' : '';

    let power;
    if (cr) {
      power = POWER.CROUCH;            // 앉기: 삑사리 없음, 약한 수비 샷
    } else {
      power = this.power(sy);
      const h = Math.max(0, COURT.BASE - sy);
      const m = MISHIT_TBL[type];
      const pf = Math.min(m[2], m[0] + Math.max(0, 60 - h) / 60 * m[1]);
      if (Math.random() < pf) {
        const lbl = SHOT_NAMES[type] + ' 삑사리';
        g.hud.setShot(pre + lbl);
        g.fx.show(pre + '삑사리...', COLORS.warn, 0.9);
        g.shots.mishit(toRight, sx, sy);
        g.sentShot(this, lbl, true);
        return;
      }
    }
    const lbl = SHOT_NAMES[type] + (cr ? ' (수비)' : ' x' + power.toFixed(1));
    g.hud.setShot(pre + lbl);
    g.shots.launch(type, toRight, sx, sy, power, cr);
    if (type === 'smash' && power > 1.7) g.fx.show(pre + '점프 스매시! x' + power.toFixed(1), this.color, 0.9);
    g.sentShot(this, lbl, false, type === 'smash' && power > 1.7 ? power : 0);
  }
}
