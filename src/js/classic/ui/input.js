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

  // 화면 버튼 (PC: 코트 아래 버튼 줄 / 모바일: 왼쪽 이동 패드 + 오른쪽 샷 버튼, TouchUI가 레이아웃 전환)
  bindTouch() {
    const g = this.game, ctrl = g.player.ctrl, $ = id => document.getElementById(id), T = TouchUI;
    T.hold($('bL'), () => ctrl.L = true, () => ctrl.L = false);
    T.hold($('bR'), () => ctrl.R = true, () => ctrl.R = false);
    T.hold($('bC'), () => ctrl.C = true, () => ctrl.C = false);
    T.tap($('bJ'), () => g.jump(g.player));
    T.tap($('bD'), () => g.dash(g.player));
    T.tap($('tDash'), () => g.dash(g.player));
    T.hold($('bSrv'), () => g.chargeServe(g.player, true), () => g.chargeServe(g.player, false));
    T.tap($('sC'), () => g.playerShot(g.player, 'clear'));
    T.tap($('sV'), () => g.playerShot(g.player, 'drive'));
    T.tap($('sH'), () => g.playerShot(g.player, 'hairpin'));
    T.tap($('sP'), () => g.playerShot(g.player, 'drop'));
    T.hold($('sS'), () => this.mainKey(g.player, true), () => this.mainKey(g.player, false));   // 스매시 · 서브 게이지 · 시작
    // 이동 패드 [게임 설계]: 좌우 = 이동, 아래 = 앉기(누르는 동안), 위로 미는 순간 = 점프 (대각선 위 = 이동하며 점프)
    let lastY = 0;
    this.pad = T.dpad($('clPad'), d => {
      ctrl.L = d.x < 0; ctrl.R = d.x > 0; ctrl.C = d.y > 0;
      if (d.y < 0 && lastY >= 0) g.jump(g.player);
      lastY = d.y;
    });
    window.addEventListener('blur', () => this.pad.reset());
    $('startBtn').addEventListener('click', () => g.start());
    // 모바일 안내문 (처음 만졌을 때 터치가 켜진 경우에도 바로 바뀌게)
    T.onEnable(() => {
      if (g.mode !== 'ai') return;
      const idle = g.hud.msgEl.innerHTML === g.hud.initialMsg;
      g.hud.setIntro(INTRO_MSG.touch);
      if (idle) g.hud.resetMessage();
    });
  }
}
