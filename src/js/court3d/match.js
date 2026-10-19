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
  // 라인에 닿기만 해도 인: 코르크 반지름(LINE_TOUCH)만큼 경계를 넓혀 판정
  inBox(b, x, z) { const T = C3.COURT.LINE_TOUCH; return x >= b.xMin - T && x <= b.xMax + T && z >= b.zMin - T && z <= b.zMax + T; }
  inSingles(x, z) { const T = C3.COURT.LINE_TOUCH; return Math.abs(x) <= C3.COURT.HALF_W_S + T && Math.abs(z) <= C3.COURT.HALF_LEN + T; }
  // 코트 체인지 점수: 15점 이상 경기에서 한쪽이 절반(15→8, 21→11)에 먼저 닿을 때 (21점은 실제 3게임 규칙과 같음)
  midPoint() { return this.win >= 15 ? Math.ceil(this.win / 2) : 0; }

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
