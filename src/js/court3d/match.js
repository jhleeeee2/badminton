// court3d/match.js — 단식 규칙: 점수, 서브권, 서비스 코트, 판정
// [규격] 랠리포인트 · 득점한 쪽이 서브 · 서버 점수 짝수 = 오른쪽 / 홀수 = 왼쪽 서비스 코트 · 대각선으로 서브
//        단식 서비스 코트 = 숏 서비스 라인 ~ 베이스라인, 센터라인 ~ 단식 사이드라인 · 라인에 떨어지면 인
//        21점, 20:20부터 2점 차, 29:29면 30점 먼저 (= 목표 + 9 상한)

class Match3D {
  constructor() { this.win = 21; this.reset(); }
  reset() { this.pts = 0; this.opts = 0; this.server = 'me'; this.rally = 0; }
  score(side) { return side === 'me' ? this.pts : this.opts; }
  other(side) { return side === 'me' ? 'opp' : 'me'; }
  award(side) {
    if (side === 'me') this.pts++; else this.opts++;
    this.server = side; this.rally = 0;
  }
  serveCourt() { return this.score(this.server) % 2 === 0 ? 'right' : 'left'; }

  // owner의 단식 서비스 코트 범위 (right/left는 그 선수 기준)
  box(owner, court) {
    const C = C3.COURT, s = owner === 'me' ? 1 : -1;
    const z0 = s * C.SHORT_SVC, z1 = s * C.HALF_LEN;
    const rightIsPlusX = owner === 'me';
    const plus = (court === 'right') === rightIsPlusX;
    return { xMin: plus ? 0 : -C.HALF_W_S, xMax: plus ? C.HALF_W_S : 0, zMin: Math.min(z0, z1), zMax: Math.max(z0, z1) };
  }
  inBox(b, x, z) { return x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax; }
  inSingles(x, z) { return Math.abs(x) <= C3.COURT.HALF_W_S && Math.abs(z) <= C3.COURT.HALF_LEN; }

  winner() {
    const cap = this.win + 9;
    if ((this.pts >= this.win && this.pts - this.opts >= 2) || this.pts >= cap) return 'me';
    if ((this.opts >= this.win && this.opts - this.pts >= 2) || this.opts >= cap) return 'opp';
    return null;
  }
  // 매치 포인트: 한 점만 더 내면 이기는 쪽 ('me' | 'opp' | null)
  matchPoint() {
    const cap = this.win + 9;
    for (const [side, a, b] of [['me', this.pts, this.opts], ['opp', this.opts, this.pts]]) {
      if (a + 1 >= cap || (a + 1 >= this.win && a + 1 - b >= 2)) return side;
    }
    return null;
  }
  isDeuce() { return this.pts >= this.win - 1 && this.pts === this.opts; }
}
