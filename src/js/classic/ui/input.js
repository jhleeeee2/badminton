// ui/input.js — 키보드·터치 버튼·설정 버튼을 Game 명령으로 연결
//   1인(AI 대전·친구 1:1): KEYMAP → 오른쪽 선수
//   로컬 2인: KEYMAP_2P.L → 왼쪽 P2, KEYMAP_2P.R → 오른쪽 P1

class Input {
  constructor(game) {
    this.game = game;
    const table = (...pairs) => {   // 키 코드 → { who: 'R'|'L', a: 동작 이름 }
      const t = {};
      for (const [map, who] of pairs) for (const [a, codes] of Object.entries(map)) codes.forEach(c => { t[c] = { who, a }; });
      return t;
    };
    this.single = table([KEYMAP, 'R']);
    this.duo = table([KEYMAP_2P.L, 'L'], [KEYMAP_2P.R, 'R']);
    this.bindKeyboard();
    this.bindTouch();
  }

  table() { return this.game.mode === 'local2p' ? this.duo : this.single; }
  who(w) { return w === 'L' ? this.game.p2 : this.game.player; }

  bindKeyboard() {
    const g = this.game;
    const SHOTS = ['clear', 'drive', 'drop', 'hairpin'];

    document.addEventListener('keydown', e => {
      if (!g.inputOn) return;                               // 대기화면 등 다른 화면일 땐 무시
      const k = this.table()[e.code];
      if (!k) return;
      e.preventDefault();                                   // 스크롤 등 브라우저 기본 동작 차단
      const a = k.a, pl = this.who(k.who), ctrl = pl.ctrl;
      if (e.repeat && a !== 'left' && a !== 'right') return; // 꾹 누름 반복 입력 무시
      if (a === 'left') ctrl.L = true;
      else if (a === 'right') ctrl.R = true;
      else if (a === 'jump') g.jump(pl);
      else if (a === 'crouch') ctrl.C = true;
      else if (a === 'dash') g.dash(pl);
      else if (a === 'smash') this.mainKey(pl, true);
      else if (SHOTS.includes(a)) g.playerShot(pl, a);
    });

    document.addEventListener('keyup', e => {
      const k = this.table()[e.code];
      if (!k) return;
      const a = k.a, pl = this.who(k.who), ctrl = pl.ctrl;
      if (a === 'left') ctrl.L = false;
      else if (a === 'right') ctrl.R = false;
      else if (a === 'crouch') ctrl.C = false;
      else if (a === 'smash') this.mainKey(pl, false);
    });
    window.addEventListener('blur', () => { g.player.releaseAll(); g.p2.releaseAll(); });
  }

  // Space(스매시 버튼, 2인 P1은 ;): 내 서브 땐 누르는 동안 게이지 → 떼면 서브,
  // 랠리 중엔 스매시, 대기·게임오버엔 시작
  mainKey(pl, down) {
    const g = this.game;
    if (g.phase === 'pserve') { g.chargeServe(pl, down); return; }
    if (!down) return;
    if (g.phase === 'flying') g.playerShot(pl, 'smash');
    else if (g.phase === 'gameover' || g.phase === 'idle') g.start();
  }

  bindTouch() {
    const g = this.game, ctrl = g.player.ctrl, $ = id => document.getElementById(id);
    const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
    const hold = (id, on, off) => {
      const b = $(id);
      b.addEventListener('pointerdown', e => { e.preventDefault(); on(); });
      b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    };
    hold('bL', () => ctrl.L = true, () => ctrl.L = false);
    hold('bR', () => ctrl.R = true, () => ctrl.R = false);
    hold('bC', () => ctrl.C = true, () => ctrl.C = false);
    tap('bJ', () => g.jump(g.player));
    tap('bD', () => g.dash(g.player));
    const bSrv = $('bSrv');
    bSrv.addEventListener('pointerdown', e => { e.preventDefault(); g.chargeServe(g.player, true); });
    bSrv.addEventListener('pointerup', () => g.chargeServe(g.player, false));
    bSrv.addEventListener('pointercancel', () => g.chargeServe(g.player, false));
    tap('sC', () => g.playerShot(g.player, 'clear'));
    tap('sV', () => g.playerShot(g.player, 'drive'));
    tap('sH', () => g.playerShot(g.player, 'hairpin'));
    tap('sP', () => g.playerShot(g.player, 'drop'));
    hold('sS', () => this.mainKey(g.player, true), () => this.mainKey(g.player, false));
    $('startBtn').addEventListener('click', () => g.start());
  }
}
