// entities/athlete.js — 선수 공통(플레이어·AI): 위치, 점프, 스윙, 라켓 위치

class Athlete {
  // face: 라켓 방향 (+1 = 오른쪽을 봄(AI), -1 = 왼쪽을 봄(플레이어))
  constructor(game, homeX, face, color) {
    this.game = game; this.homeX = homeX; this.face = face; this.color = color;
    this.resetBody();
  }

  resetBody() { this.x = this.homeX; this.jy = 0; this.vy = 0; this.swingT = 0; }

  get crouched() { return false; }

  jump() { if (this.jy === 0) this.vy = -PHYS.JUMP; }
  swing() { this.swingT = MOVE.SWING_TIME; }
  tickSwing(dt) { if (this.swingT > 0) this.swingT -= dt; }

  // 점프 중력
  updatePhysics(dt) {
    if (this.jy > 0 || this.vy < 0) {
      this.vy += PHYS.GRAV * dt; this.jy -= this.vy * dt;
      if (this.jy <= 0) { this.jy = 0; this.vy = 0; }
    }
  }

  racket() {
    const sw = this.swingT > 0 ? 14 : 0;
    const ry = this.crouched ? COURT.GY - 36 : COURT.GY - 54 - this.jy;
    const rx = this.face > 0 ? this.x + 16 + sw : this.x - 16 - sw;
    return [rx, ry - sw * 0.6];
  }
}
