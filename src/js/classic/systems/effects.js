// systems/effects.js — 화면 연출 상태: 배너 문구, 타격 링, 마지막 낙하 위치

class Effects {
  constructor() {
    this.banner = ''; this.bannerT = 0; this.bannerCol = COLORS.ok;
    this.hitFx = 0; this.hitPt = [0, 0];
    this.missPos = null;
  }

  show(text, color, dur) { this.banner = text; this.bannerCol = color; this.bannerT = dur; }
  hit(x, y) { this.hitFx = 0.5; this.hitPt = [x, y]; }
  reset() { this.hitFx = 0; this.bannerT = 0; }

  update(dt) {
    if (this.hitFx > 0) this.hitFx -= dt;
    if (this.bannerT > 0) this.bannerT -= dt;
  }
}
