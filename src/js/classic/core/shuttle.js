// core/shuttle.js — 셔틀콕: 출발점·도착점·비행시간으로 궤적을 역산하는 투사체 운동

class Shuttle {
  constructor() {
    this.x0 = 70; this.y0 = COURT.BASE;   // 출발점
    this.x1 = 560; this.y1 = COURT.BASE;  // 낙하점
    this.dur = 1.3;        // 비행시간(초)
    this.t = 0;            // 진행도 0~1
    this.dir = 1;          // +1: 플레이어 쪽(→), -1: AI 쪽(←)
    this.kind = 'norm';    // 'clear'면 시간 워프
    this.net = null;       // 네트에 걸릴 예정이면 {t, y}
    this.outPred = false;  // 아웃 예정
    this.netDrop = null;   // 네트에 걸려 떨어지는 중 {x, y}
    this.isServe = false;  // 서브 직후 공인지
  }

  // 새 비행 시작 (공통 초기화)
  launch(sx, sy, toRight, kind) {
    this.dir = toRight ? 1 : -1; this.t = 0; this.netDrop = null;
    this.x0 = sx; this.y0 = sy; this.y1 = COURT.BASE;
    this.kind = kind;
  }

  g2() { return 0.5 * PHYS.GACC * this.dur * this.dur; }

  at(tt) {
    const pe = this.kind === 'clear' ? 1 - Math.pow(1 - tt, 1.65) : tt;
    const G2 = this.g2();
    return [this.x0 + (this.x1 - this.x0) * tt, this.y0 + (this.y1 - this.y0 - G2) * pe + G2 * pe * pe];
  }

  pos() { return this.at(this.t); }

  // 네트 x를 지나는 진행도
  netT() {
    const tN = (COURT.NET - this.x0) / (this.x1 - this.x0);
    return (tN > 0.02 && tN < 0.98) ? tN : null;
  }

  netCheck() {
    const tN = this.netT();
    if (tN === null) return null;
    const [, y] = this.at(tN);
    return y > COURT.NETTOP - 4 ? { t: tN, y: Math.min(y, COURT.NETTOP + 26) } : null;
  }

  // 네트를 넘을 때까지 비행시간을 늘림(더 높은 포물선)
  ensureClear() {
    let n = 0;
    while (this.netCheck() !== null && n < 14) { this.dur *= 1.12; n++; }
  }

  landsInside() { return this.x1 >= COURT.BL_L && this.x1 <= COURT.BL_R; }

  // 네트·아웃 예측 확정
  finalize() {
    this.net = this.netCheck();
    this.outPred = !this.net && (this.x1 < COURT.BL_L || this.x1 > COURT.BL_R);
  }
}
