// ui/input.js — 키보드·터치 버튼·설정 버튼을 Game 명령으로 연결

class Input {
  constructor(game) {
    this.game = game;
    this.bindKeyboard();
    this.bindTouch();
  }

  bindKeyboard() {
    const g = this.game, ctrl = g.player.ctrl;
    const action = {};   // 키 코드 → 동작 이름
    for (const [a, codes] of Object.entries(KEYMAP)) codes.forEach(c => { action[c] = a; });
    const SHOTS = ['clear', 'drive', 'drop', 'hairpin'];

    document.addEventListener('keydown', e => {
      if (!g.inputOn) return;                               // 대기화면 등 다른 화면일 땐 무시
      const a = action[e.code];
      if (!a) return;
      e.preventDefault();                                   // 스크롤 등 브라우저 기본 동작 차단
      if (e.repeat && a !== 'left' && a !== 'right') return; // 꾹 누름 반복 입력 무시
      if (a === 'left') ctrl.L = true;
      else if (a === 'right') ctrl.R = true;
      else if (a === 'jump') g.jump();
      else if (a === 'crouch') ctrl.C = true;
      else if (a === 'dash') g.dash();
      else if (a === 'smash') this.mainKey(true);
      else if (SHOTS.includes(a)) g.playerShot(a);
    });

    document.addEventListener('keyup', e => {
      const a = action[e.code];
      if (a === 'left') ctrl.L = false;
      else if (a === 'right') ctrl.R = false;
      else if (a === 'crouch') ctrl.C = false;
      else if (a === 'smash') this.mainKey(false);
    });
  }

  // Space(스매시 버튼): 내 서브 땐 누르는 동안 게이지 → 떼면 서브,
  // 랠리 중엔 스매시, 대기·게임오버엔 시작
  mainKey(down) {
    const g = this.game;
    if (g.phase === 'pserve') { g.chargeServe(down); return; }
    if (!down) return;
    if (g.phase === 'flying') g.playerShot('smash');
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
    tap('bJ', () => g.jump());
    tap('bD', () => g.dash());
    const bSrv = $('bSrv');
    bSrv.addEventListener('pointerdown', e => { e.preventDefault(); g.chargeServe(true); });
    bSrv.addEventListener('pointerup', () => g.chargeServe(false));
    bSrv.addEventListener('pointercancel', () => g.chargeServe(false));
    tap('sC', () => g.playerShot('clear'));
    tap('sV', () => g.playerShot('drive'));
    tap('sH', () => g.playerShot('hairpin'));
    tap('sP', () => g.playerShot('drop'));
    hold('sS', () => this.mainKey(true), () => this.mainKey(false));
    $('startBtn').addEventListener('click', () => g.start());
  }
}
