// view/renderer.js — Canvas 그리기 (게임 상태를 읽기만 하고 바꾸지 않음)

class Renderer {
  constructor(canvas, game) {
    this.cx = canvas.getContext('2d');
    this.game = game;
  }

  draw() {
    const cx = this.cx, g = this.game, p = g.player, s = g.shuttle, fx = g.fx;
    const { W, H, GY, NET, NETTOP, BL_L, BL_R, STANDY } = COURT;
    cx.clearRect(0, 0, W, H);

    // 코트·네트
    cx.strokeStyle = COLORS.court; cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(0, GY); cx.lineTo(W, GY); cx.stroke();
    cx.lineWidth = 2.5;
    cx.beginPath(); cx.moveTo(BL_L, GY); cx.lineTo(BL_L, GY - 12); cx.stroke();
    cx.beginPath(); cx.moveTo(BL_R, GY); cx.lineTo(BL_R, GY - 12); cx.stroke();
    cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(NET, GY); cx.lineTo(NET, NETTOP); cx.stroke();
    cx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { cx.beginPath(); cx.moveTo(NET - 13, NETTOP + i * 15); cx.lineTo(NET + 13, NETTOP + i * 15); cx.stroke(); }

    // 선수 (왼쪽 = AI 또는 P2/온라인 상대)
    const L = g.left;
    this.drawAthlete(L);
    this.drawAthlete(p);
    for (const a of [p, L]) if (a.dashT > 0) {
      cx.strokeStyle = COLORS.warn; cx.globalAlpha = 0.5; cx.lineWidth = 3;
      cx.beginPath(); cx.moveTo(a.x - a.dashDir * 30, GY - 40); cx.lineTo(a.x - a.dashDir * 12, GY - 40); cx.stroke();
      cx.globalAlpha = 1;
    }

    // 서브 게이지 (서브하는 사람 위) — 온라인 상대가 모으는 중이면 받은 게이지를 그대로 보여줌
    const srv = g.phase === 'pserve' ? g.serverPlayer() : g.phase === 'oserve' ? L : null;
    if (srv) {
      const gp = srv.gauge.p, sx = srv.x, right = srv.side !== 'L';
      cx.fillStyle = COLORS.text;
      cx.font = '13px sans-serif'; cx.textAlign = 'center';
      const key = g.mode === 'local2p' ? (right ? ';' : 'Space') : 'Space';
      const who = g.mode === 'local2p' ? (right ? 'P1' : 'P2') + ' 서브' : g.phase === 'oserve' ? '상대 서브' : '내 서브';
      cx.fillText(g.phase === 'oserve' ? who + ' 기다리는 중…' : who + ' — ' + key + '를 길게 누를수록 멀리', Math.max(150, Math.min(W - 150, sx)), GY - 118);
      cx.textAlign = 'left';
      // 게이지 막대 = 0 ~ P_MAX. 양 끝 빨간 구간: 왼쪽 = 네트(너무 짧음), 오른쪽 = 아웃(너무 김)
      const S = SERVE, bx = sx - 31, bw = 62, k = bw / S.P_MAX;
      cx.globalAlpha = 0.28; cx.fillStyle = COLORS.bad;
      cx.fillRect(bx, GY - 107, S.NET_FAULT_P * k, 7);
      cx.fillRect(bx + S.OUT_P * k, GY - 107, (S.P_MAX - S.OUT_P) * k, 7);
      cx.globalAlpha = 1;
      const danger = srv.gauge.on && (gp < S.NET_FAULT_P || gp > S.OUT_P);
      cx.fillStyle = danger ? COLORS.bad : gp > 0.66 ? COLORS.me : gp > 0.33 ? COLORS.warn : COLORS.ok;
      cx.fillRect(bx, GY - 107, gp * k, 7);
      cx.strokeStyle = COLORS.court; cx.lineWidth = 1;
      cx.strokeRect(sx - 32, GY - 108, 64, 9);
      cx.beginPath(); cx.moveTo(bx + k, GY - 110); cx.lineTo(bx + k, GY - 97); cx.stroke(); // 100% 눈금
      this.drawShuttle(sx + (right ? -20 : 20), STANDY + 8);
    }

    // 셔틀
    if (g.phase === 'flying') {
      if (s.netDrop) this.drawShuttle(s.netDrop.x, s.netDrop.y);
      else {
        const [x, y] = s.pos();
        if (s.dur < 0.7) { // 빠른 공 잔상
          cx.strokeStyle = COLORS.warn; cx.globalAlpha = 0.35; cx.lineWidth = 3;
          const [bx2, by2] = s.at(Math.max(0, s.t - 0.07));
          cx.beginPath(); cx.moveTo(bx2, by2); cx.lineTo(x, y); cx.stroke(); cx.globalAlpha = 1;
        }
        this.drawShuttle(x, y);
        if (s.t > 0.3 && !s.net) {
          if (s.outPred) { // 아웃 예정: 빨간 X
            cx.strokeStyle = COLORS.bad; cx.lineWidth = 2; cx.globalAlpha = 0.85;
            const mx = Math.max(10, Math.min(W - 10, s.x1));
            cx.beginPath(); cx.moveTo(mx - 5, GY - 9); cx.lineTo(mx + 5, GY + 1); cx.moveTo(mx + 5, GY - 9); cx.lineTo(mx - 5, GY + 1); cx.stroke();
            cx.globalAlpha = 1;
          } else { // 낙하 예정점
            cx.fillStyle = s.dir === 1 ? COLORS.ok : COLORS.opp; cx.globalAlpha = 0.6;
            cx.beginPath(); cx.arc(s.x1, GY - 4, 5, 0, Math.PI * 2); cx.fill(); cx.globalAlpha = 1;
          }
        }
      }
    } else if (fx.missPos && g.phase !== 'idle' && g.phase !== 'pserve' && g.phase !== 'oserve') {
      this.drawShuttle(fx.missPos[0], fx.missPos[1]);
    }

    // 이펙트
    if (fx.hitFx > 0) {
      cx.strokeStyle = COLORS.ok; cx.lineWidth = 2; cx.globalAlpha = fx.hitFx * 2;
      cx.beginPath(); cx.arc(fx.hitPt[0], fx.hitPt[1], (0.5 - fx.hitFx) * 70 + 12, 0, Math.PI * 2); cx.stroke();
      cx.globalAlpha = 1;
    }
    if (fx.bannerT > 0) {
      cx.font = '600 22px sans-serif'; cx.fillStyle = fx.bannerCol;
      cx.globalAlpha = Math.min(fx.bannerT * 1.5, 1); cx.textAlign = 'center';
      cx.fillText(fx.banner, W / 2, 46); cx.globalAlpha = 1; cx.textAlign = 'left';
    }
  }

  drawShuttle(x, y) {
    const cx = this.cx;
    cx.save(); cx.translate(x, y);
    cx.fillStyle = COLORS.shuttle;
    cx.beginPath(); cx.arc(0, 6, 6, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = COLORS.feather; cx.strokeStyle = COLORS.court;
    cx.beginPath(); cx.moveTo(-7, -12); cx.lineTo(7, -12); cx.lineTo(0, 4); cx.closePath();
    cx.fill(); cx.stroke();
    cx.restore();
  }

  // 막대 인간
  drawAthlete(a) {
    const cx = this.cx, x = a.x, cr = a.crouched, left = a.face > 0;
    const gy = COURT.GY - a.jy;
    const hh = cr ? 42 : 58, wl = cr ? 16 : 22;
    cx.strokeStyle = a.color; cx.fillStyle = a.color; cx.lineWidth = 3;
    cx.beginPath(); cx.arc(x, gy - hh, 9, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.moveTo(x, gy - (hh - 9)); cx.lineTo(x, gy - wl); cx.stroke();
    cx.beginPath(); cx.moveTo(x, gy - wl); cx.lineTo(x - 11, gy); cx.moveTo(x, gy - wl); cx.lineTo(x + 11, gy); cx.stroke();
    const sw = a.swingT > 0 ? 14 : 0;
    const ax = left ? x + 16 + sw : x - 16 - sw, ay = gy - (cr ? 34 : 52) - sw * 0.6;
    cx.beginPath(); cx.moveTo(x, gy - (cr ? 30 : 42)); cx.lineTo(ax, ay); cx.stroke();
    cx.lineWidth = 2;
    cx.beginPath(); cx.arc(ax + (left ? 5 : -5), ay - 4, 7, 0, Math.PI * 2); cx.stroke();
  }
}
