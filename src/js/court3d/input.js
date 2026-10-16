// court3d/input.js — 3D 조작: WASD 이동 · 마우스 좌우 = 치는 방향 · Q/E/좌클릭 꾹 = 충전, 떼면 스윙
//                    Space 점프 · Shift 팔 뻗기 · Enter 재시작(경기 끝났을 때)

class Input3D {
  constructor(game, canvasBox) {
    this.g = game; this.keys = {};
    const K = C3.KEYS;
    const moveKeys = [K.up, K.down, K.left, K.right];

    document.addEventListener('keydown', e => {
      if (!game.inputOn) return;
      Sound3.unlock();
      const c = e.code;
      if (c === 'KeyM' && !e.repeat) { game.hud.setMute(Sound3.toggleMute()); return; }
      if (c === 'KeyL' && !e.repeat) { game.toggleLand(); return; }
      if ([...moveKeys, K.lift, K.smash, K.jump, ...K.ext].includes(c)) e.preventDefault();
      if (e.repeat) return;
      if (moveKeys.includes(c)) { this.keys[c] = true; this.applyMove(); }
      else if (c === K.lift) game.press('lift');
      else if (c === K.smash) game.press('down');
      else if (c === K.jump) game.jump();
      else if (K.ext.includes(c)) game.extend();
      else if (c === 'Enter' && game.phase === 'over') game.start();
    });
    document.addEventListener('keyup', e => {
      const c = e.code;
      if (moveKeys.includes(c)) { this.keys[c] = false; this.applyMove(); }
      else if (c === K.lift) game.release('lift');
      else if (c === K.smash) game.release('down');
    });
    window.addEventListener('blur', () => { this.keys = {}; this.applyMove(); game.release('lift'); game.release('down'); game.release('flat'); });

    // 마우스: 화면 가로 위치 → 조준 각도
    document.addEventListener('mousemove', e => {
      if (!game.inputOn) return;
      const r = canvasBox.getBoundingClientRect();
      const u = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      game.serveU = u;                                                             // 서브: 좌우만
      game.aimNdc = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) };   // 랠리: 커서 아래 바닥 점 쪽 '방향'
    });
    canvasBox.addEventListener('mousedown', e => { Sound3.unlock(); if (game.inputOn && e.button === 0) { e.preventDefault(); game.press('flat'); } });
    document.addEventListener('mouseup', e => { if (e.button === 0) game.release('flat'); });
    canvasBox.addEventListener('contextmenu', e => e.preventDefault());
  }

  applyMove() {
    const K = C3.KEYS, k = this.keys;
    this.g.me.moveDir = { x: (k[K.right] ? 1 : 0) - (k[K.left] ? 1 : 0), z: (k[K.down] ? 1 : 0) - (k[K.up] ? 1 : 0) };
  }
  reset() { this.keys = {}; this.applyMove(); }
}
