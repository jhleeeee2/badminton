// systems/shots.js — 샷 발사: 샷별 낙하점·비행시간, 삑사리, AI 반응(굳음·헤어핀) 결정

class ShotSystem {
  constructor(game) { this.game = game; }

  // toRight: 공이 플레이어 쪽으로 감(= AI가 침)
  launch(type, toRight, sx, sy, power, safe) {
    const g = this.game, s = g.shuttle, ai = g.ai, d = g.match.diff;
    const { W, NET, BL_L, BL_R } = COURT;
    s.launch(sx, sy, toRight, type === 'clear' ? 'clear' : 'norm');
    ai.newFlight();
    const sm = g.match.speedMul();
    const R = Math.random();

    if (type === 'clear') {
      s.x1 = toRight ? BL_R - 95 + R * 78 : BL_L + 18 + R * 78;
      s.dur = 1.75 / (Math.pow(power, 0.3) * sm);
    } else if (type === 'drive') {
      const scat = (Math.random() - 0.5) * (14 + 70 * Math.max(0, power - 1.3));
      s.x1 = (toRight ? NET + 110 + R * (W - 200 - NET - 90) : 95 + R * (NET - 200)) + scat;
      s.dur = Math.max(0.42, 0.62 / (Math.pow(power, 0.9) * sm));
    } else if (type === 'hairpin') {
      s.x1 = toRight ? NET + 42 + R * 58 : NET - 100 + R * 58;
      s.dur = 0.95 / (Math.pow(power, 0.15) * sm);
    } else if (type === 'drop') {
      s.x1 = toRight ? NET + 58 + R * 95 : NET - 153 + R * 95;
      s.dur = Math.max(0.55, 0.8 / (Math.pow(power, 0.45) * sm));
    } else { // smash
      const scat = (Math.random() - 0.5) * (16 + 90 * Math.max(0, power - 1.3));
      s.x1 = (toRight ? NET + 95 + R * (W - 160 - NET - 95) : 55 + R * (NET - 150)) + scat;
      if (toRight && d.sharp && Math.random() < 0.7) {
        s.x1 = Math.random() < 0.5 ? BL_R - 18 - Math.random() * 32 : NET + 58 + Math.random() * 48;
      }
      s.dur = Math.max(0.34, 0.95 / (Math.pow(power, 1.6) * sm));
    }

    // 안전샷: 코트 안으로 + 네트 넘게
    if (safe || type === 'clear' || type === 'hairpin') {
      s.x1 = Math.max(toRight ? NET + 40 : BL_L + 16, Math.min(toRight ? BL_R - 12 : NET - 40, s.x1));
      s.ensureClear();
    }
    s.finalize();

    ai.ignore = (!toRight) && (s.outPred || !!s.net);
    ai.frozen = false;
    if (!toRight && !ai.ignore) {
      // 반사신경 한계: 파워가 임계값을 넘으면 확률적으로 굳음
      const pf = Math.min(d.rC, Math.max(0, (power - d.rT) * d.rK));
      if (Math.random() < pf) { ai.frozen = true; ai.plan = { x: ai.x, jumpAt: null }; }
      if (!ai.frozen && type === 'hairpin' && Math.random() < d.hp) ai.ignore = true;
    }
    if (!ai.frozen) { if (toRight) ai.goHome(); else ai.plan = ai.makePlan(power); }
  }

  // 삑사리 공: 방향·거리가 엉망
  mishit(toRight, sx, sy) {
    const g = this.game, s = g.shuttle, ai = g.ai, NET = COURT.NET;
    s.launch(sx, sy, toRight, 'norm');
    ai.newFlight(); ai.frozen = false;
    s.x1 = toRight ? NET + 120 - Math.random() * 180 : NET - 120 + Math.random() * 180;
    s.dur = 0.85 + Math.random() * 0.35;
    s.finalize();
    const ownSide = toRight ? s.x1 < NET : s.x1 > NET;
    ai.ignore = (!toRight) && (s.outPred || !!s.net || ownSide);
    if (!toRight && !ai.ignore) ai.plan = ai.makePlan(0.9);
    else if (toRight) ai.goHome();
  }
}
