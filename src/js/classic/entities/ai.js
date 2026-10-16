// entities/ai.js — 상대 AI(왼쪽): 궤적 예측 → 이동·점프 계획, 샷 선택, 반사신경 한계

class AIOpponent extends Athlete {
  constructor(game) {
    super(game, HOME.ai, +1, COLORS.opp);
    this.plan = { x: HOME.ai, jumpAt: null };  // 목표 위치, 점프 시각
    this.hasHit = false;   // 이번 비행에 이미 쳤는지
    this.frozen = false;   // 너무 빨라서 굳음
    this.ignore = false;   // 이번 공은 안 받음(아웃·네트·헤어핀 실패 등)
    this.ft = 0;           // 비행 경과 시간
  }

  get diff() { return this.game.match.diff; }
  speed() { return this.diff.spd + this.game.match.rally * 2.5; }
  goHome() { this.plan = { x: HOME.ai, jumpAt: null }; }
  newFlight() { this.ft = 0; this.hasHit = false; }

  // 궤적을 미리 계산해 서서 받을 지점 → 안 되면 점프 타이밍 역산
  makePlan(power) {
    const s = this.game.shuttle, d = this.diff, NET = COURT.NET, STANDY = COURT.STANDY;
    if (s.outPred || s.net) return { x: 130, jumpAt: null };
    const react = d.react + Math.random() * d.reactR;
    let err = (Math.random() - 0.5) * (d.err + d.errP * Math.max(0, power - 1.2));
    if (Math.random() < d.mis) err *= 3;
    const fallback = { x: Math.max(18, Math.min(NET - 30, s.x1 - 16 + err)), jumpAt: null };
    for (let tt = 0.3; tt <= 0.97; tt += 0.01) {
      const [x, y] = s.at(tt);
      if (x > NET - 16) continue;
      const bx = x - 16;
      if (bx < 18 || bx > NET - 26) continue;
      if (Math.abs(bx - this.x) > this.speed() * Math.max(0, tt * s.dur - react)) continue;
      if (Math.abs(y - STANDY) < 34) return { x: bx + err, jumpAt: null };
    }
    if (Math.random() < d.jfail) return fallback;
    for (let tt = 0.32; tt <= 0.95; tt += 0.01) {
      const [x, y] = s.at(tt);
      if (x > NET - 16) continue;
      const bx = x - 16;
      if (bx < 18 || bx > NET - 26) continue;
      const lift = STANDY - y;
      if (lift < 22 || lift > 76) continue;
      const disc = PHYS.JUMP * PHYS.JUMP - 2 * PHYS.GRAV * lift;
      if (disc < 0) continue;
      const tau = (PHYS.JUMP - Math.sqrt(disc)) / PHYS.GRAV;
      const jAt = tt * s.dur - tau;
      if (jAt < 0.08) continue;
      if (Math.abs(bx - this.x) > this.speed() * Math.max(0, jAt - react)) continue;
      return { x: bx + err * 0.6, jumpAt: jAt };
    }
    return fallback;
  }

  move(dt) {
    const dx = this.plan.x - this.x;
    if (Math.abs(dx) > 3) this.x += Math.sign(dx) * Math.min(this.speed() * dt, Math.abs(dx));
    this.x = Math.max(18, Math.min(COURT.NET - 26, this.x));
    this.updatePhysics(dt);
  }

  // 공이 AI 쪽으로 오는 동안: 점프 실행, 타격 시도
  track(dt) {
    const s = this.game.shuttle;
    if (s.dir !== -1 || this.ignore || this.frozen) return;
    this.ft += dt;
    if (this.plan.jumpAt !== null && this.ft >= this.plan.jumpAt && this.jy === 0) {
      this.vy = -PHYS.JUMP; this.plan = { x: this.plan.x, jumpAt: null };
    }
    if (!this.hasHit && s.t > 0.28) {
      const [sx] = s.pos();
      if (sx < COURT.NET - 8 && this.tryContact()) this.hasHit = true;
    }
  }

  tryContact() {
    const g = this.game, s = g.shuttle;
    const [sx, sy] = s.pos(), [rx, ry] = this.racket();
    if (Math.hypot(sx - rx, sy - ry) >= MOVE.REACH) return false;
    this.swing();
    g.onContact(sx, sy);
    const dxm = this.plan.x - this.x;
    const mv = dxm > 8 ? POWER.FORWARD : (dxm < -8 ? POWER.AI_BACKWARD : 0);
    const power = Math.max(POWER.MIN, 1 + Math.max(0, COURT.BASE - sy) / POWER.HEIGHT_DIV + mv);
    const sr = s.isServe; s.isServe = false;
    const type = this.shoot(sx, sy, power, sr);
    if (type === 'smash' && power > 1.6) g.fx.show('상대 스매시!', COLORS.opp, 0.8);
    return true;
  }

  // 샷 선택 후 발사. 서브 리턴은 수비적으로(클리어/드롭, 파워 ≤1.2)
  shoot(sx, sy, power, serveReturn) {
    const g = this.game, d = this.diff, NET = COURT.NET;
    const high = sy < COURT.STANDY - 20, nearNet = Math.abs(sx - NET) < 130, r = Math.random();
    let type;
    if (serveReturn) type = r < 0.7 ? 'clear' : 'drop';
    else if (high) type = r < d.smash ? 'smash' : 'drop';
    else if (nearNet && r < 0.45) type = 'hairpin';
    else type = r < 0.5 ? 'clear' : (r < 0.78 ? 'drive' : 'drop');
    // 네트 캠핑 방지
    if (!serveReturn && !high && g.player.x < NET + 125 && Math.random() < 0.6) type = 'clear';
    if (Math.random() < d.mh * AI_MISHIT_W[type]) {
      g.fx.show('상대 삑사리!', COLORS.opp, 0.9);
      g.shots.mishit(true, sx, sy);
      return type;
    }
    const pw = serveReturn ? Math.min(power, 1.2) : power;
    g.shots.launch(type, true, sx, sy, pw, serveReturn ? true : Math.random() < d.safe);
    return type;
  }
}
