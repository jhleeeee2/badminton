// entities/player.js — 플레이어(오른쪽): 이동, 대쉬, 앉기, 서브 게이지, 타격·파워·삑사리

class Player extends Athlete {
  constructor(game) {
    super(game, HOME.player, -1, COLORS.me);
    this.ctrl = { L: false, R: false, C: false };   // 입력 상태 (Input이 씀)
    this.dashT = 0; this.dashDir = 0; this.dashUsed = false;
    this.gauge = { on: false, p: 0 };                // 서브 게이지 (0~1)
  }

  resetForMatch() {
    this.resetBody();
    this.dashT = 0; this.dashUsed = false;
    this.gauge.on = false; this.gauge.p = 0;
  }

  get crouched() { return this.ctrl.C && this.jy === 0; }

  move(dt) {
    const ms = MOVE.SPEED * (this.crouched ? MOVE.CROUCH_SPEED : 1);
    if (this.ctrl.L) this.x -= ms * dt;
    if (this.ctrl.R) this.x += ms * dt;
    if (this.dashT > 0) { this.x += this.dashDir * MOVE.DASHV * dt; this.dashT -= dt; }
    this.x = Math.max(COURT.NET + 24, Math.min(COURT.W - 20, this.x));
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

  // 전진(←)하며 치면 +, 후진(→)하며 치면 −
  power(sy) {
    const run = this.ctrl.L ? POWER.FORWARD : (this.ctrl.R ? POWER.BACKWARD : 0);
    const db = this.dashT > 0 ? (this.dashDir === -1 ? POWER.DASH_FWD : POWER.DASH_BACK) : 0;
    return Math.max(POWER.MIN, 1 + Math.max(0, COURT.BASE - sy) / POWER.HEIGHT_DIV + run + db);
  }

  hit(type) {
    const g = this.game, s = g.shuttle;
    this.swing();
    if (s.dir !== 1) return;
    const cr = this.crouched;
    const [sx, sy] = s.pos(), [rx, ry] = this.racket();
    const reach = MOVE.REACH + (cr ? MOVE.CROUCH_REACH : 0);
    if (Math.hypot(sx - rx, sy - ry) >= reach) return;

    g.onContact(sx, sy);
    s.isServe = false;

    let power;
    if (cr) {
      power = POWER.CROUCH;            // 앉기: 삑사리 없음, 약한 수비 샷
    } else {
      power = this.power(sy);
      const h = Math.max(0, COURT.BASE - sy);
      const m = MISHIT_TBL[type];
      const pf = Math.min(m[2], m[0] + Math.max(0, 60 - h) / 60 * m[1]);
      if (Math.random() < pf) {
        g.hud.setShot(SHOT_NAMES[type] + ' 삑사리');
        g.fx.show('삑사리...', COLORS.warn, 0.9);
        g.shots.mishit(false, sx, sy);
        return;
      }
    }
    g.hud.setShot(SHOT_NAMES[type] + (cr ? ' (수비)' : ' x' + power.toFixed(1)));
    g.shots.launch(type, false, sx, sy, power, cr);
    if (type === 'smash' && power > 1.7) g.fx.show('점프 스매시! x' + power.toFixed(1), COLORS.me, 0.9);
  }
}
