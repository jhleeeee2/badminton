// systems/match.js — 점수·랠리·서브권·승패 판정 (실제 배드민턴 랠리포인트 + 듀스)

class Match {
  constructor() {
    this.win = 11;               // 목표 점수
    this.diff = DIFFS.normal;    // 난이도 설정
    this.diffId = 'normal';      // 난이도 id (기록 저장용)
    this.resetScore();
  }

  resetScore() {
    this.rally = 0; this.pts = 0; this.opts = 0; this.server = 'opp';
  }

  // 랠리가 길어질수록 아주 조금 빨라짐 (최대 ×1.2)
  speedMul() { return Math.min(1.2, 1 + this.rally * 0.012); }

  // 득점한 쪽이 서브
  award(mine) {
    if (mine) { this.pts++; this.server = 'player'; }
    else { this.opts++; this.server = 'opp'; }
    this.rally = 0;
  }

  // 2점 차 듀스, 목표+10점 캡
  winner() {
    const cap = this.win + 10;
    if ((this.pts >= this.win && this.pts - this.opts >= 2) || this.pts >= cap) return 'player';
    if ((this.opts >= this.win && this.opts - this.pts >= 2) || this.opts >= cap) return 'opp';
    return null;
  }

  isDeuce() {
    return this.pts >= this.win - 1 && this.opts >= this.win - 1 && this.pts === this.opts;
  }
}
