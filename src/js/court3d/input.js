// court3d/input.js — 3D 조작: WASD 이동 · 마우스 좌우 = 치는 방향 · Q/E/좌클릭 꾹 = 충전, 떼면 스윙
//                    Space 점프 · Shift 팔 뻗기 · Enter 재시작(경기 끝났을 때)
//                    T 꾹 = 감정표현 원판(마우스로 고르고 떼면 보냄) · G 셔틀 그림자 · L 낙하 표시 · M 소리

class Input3D {
  constructor(game, canvasBox) {
    this.g = game; this.keys = {};
    const K = C3.KEYS;
    const moveKeys = [K.up, K.down, K.left, K.right];

    const K2 = C3.KEYS2, move2 = [K2.up, K2.down, K2.left, K2.right], keys2 = [...move2, K2.lift, K2.smash, K2.flat, K2.jump, ...K2.ext];
    this.keys2 = {};
    document.addEventListener('keydown', e => {
      if (!game.inputOn) return;
      Sound3.unlock();
      const c = e.code;
      // 로컬 2인 P2
      if (game.duo && keys2.includes(c)) {
        e.preventDefault();
        if (e.repeat) return;
        const b = game.opp;
        if (move2.includes(c)) { this.keys2[c] = true; this.applyMove2(); }
        else if (c === K2.lift) game.press('lift', b);
        else if (c === K2.smash) game.press('down', b);
        else if (c === K2.flat) game.press('flat', b);
        else if (c === K2.jump) game.jump(b);
        else if (K2.ext.includes(c)) game.extend(b);
        return;
      }
      if (c === 'KeyM' && !e.repeat) { game.hud.setMute(Sound3.toggleMute()); return; }
      if (c === 'KeyL' && !e.repeat) { game.toggleLand(); return; }
      if (c === 'KeyG' && !e.repeat) { game.toggleShadow(); return; }
      if (c === 'KeyT') { e.preventDefault(); if (!e.repeat && !game.emote.isOpen) game.emote.open(this.mx, this.my); return; }
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
      if (keys2.includes(c)) {
        const b = game.opp;
        if (move2.includes(c)) { this.keys2[c] = false; this.applyMove2(); }
        else if (c === K2.lift) game.release('lift', b);
        else if (c === K2.smash) game.release('down', b);
        else if (c === K2.flat) game.release('flat', b);
        if (game.duo) return;
      }
      if (moveKeys.includes(c)) { this.keys[c] = false; this.applyMove(); }
      else if (c === K.lift) game.release('lift');
      else if (c === K.smash) game.release('down');
      else if (c === 'KeyT') game.emote.release();
    });
    window.addEventListener('blur', () => {
      game.emote.close(); this.keys = {}; this.applyMove(); game.release('lift'); game.release('down'); game.release('flat');
      this.keys2 = {}; if (game.duo) { this.applyMove2(); game.release('lift', game.opp); game.release('down', game.opp); game.release('flat', game.opp); }
    });

    // 마우스: 화면 가로 위치 → 조준 각도
    document.addEventListener('mousemove', e => {
      this.mx = e.clientX; this.my = e.clientY;
      if (!game.inputOn) return;
      if (game.emote.isOpen) { game.emote.move(e.clientX, e.clientY); return; }   // 원판이 열려 있는 동안엔 조준 고정
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
  // P2 이동: 화면 기준(카메라는 P1 뒤) — ↑ = 화면 안쪽(−z), ← = 화면 왼쪽(−x). ←/→는 조준 방향도 겸함
  applyMove2() {
    const K = C3.KEYS2, k = this.keys2, x = (k[K.right] ? 1 : 0) - (k[K.left] ? 1 : 0);
    this.g.opp.moveDir = { x, z: (k[K.down] ? 1 : 0) - (k[K.up] ? 1 : 0) };
    this.g.p2Aim = x;
  }
  reset() { this.keys = {}; this.applyMove(); this.keys2 = {}; if (this.g.duo) this.applyMove2(); else this.g.p2Aim = 0; }
}
