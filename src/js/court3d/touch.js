// court3d/touch.js — 3D 코트 모바일 버튼 조작 (PC의 WASD·마우스·Q/E/클릭 대신)
//   왼쪽: 이동 패드(8방향, 화면 기준 ▲ = 네트 쪽 = W)
//   오른쪽: 방향 ◀ ● ▶ (마우스 조준 대신) · 올리기(Q, 꾹 → 떼기 · 서브도 이것) · 찍기(E) · 직선(좌클릭)
//           · 점프(Space) · 런지(Shift) · 😀 꾹 → 손가락을 밀어 고르고 떼기 = 감정표현(T)
//   [게임 설계] 방향 3칸: 상대 코트의 왼쪽/가운데/오른쪽 바닥 점(x = ∓AIM_X, z = AIM_Z)을 겨냥.
//   마우스는 '커서 쪽 방향'이라 연속값이지만, 엄지로 정밀 조준은 어려워서 3칸으로 단순화

const TOUCH3 = Object.freeze({ AIM_X: 2.0, AIM_Z: -4.6, SERVE_U: 0.8 });

class Touch3D {
  constructor(game, input, stage) {
    this.g = game; this.input = input; this.stage = stage;
    const $ = id => document.getElementById(id), T = TouchUI;
    this.u = 0;

    // 이동 패드
    this.pad = T.dpad($('c3pad'), d => { game.me.moveDir = { x: d.x, z: d.y }; });

    // 샷: 누르는 동안 충전, 떼면 스윙 (PC와 같은 game.press / release)
    const shot = (id, type) => T.hold($(id),
      () => { Sound3.unlock(); if (game.inputOn) game.press(type); },
      () => game.release(type));
    shot('t3lift', 'lift'); shot('t3down', 'down'); shot('t3flat', 'flat');
    T.tap($('t3jump'), () => { if (game.inputOn) game.jump(); });
    T.tap($('t3ext'), () => { if (game.inputOn) game.extend(); });

    // 방향 3칸
    this.aimBtns = [...$('c3aim').querySelectorAll('button')];
    this.aimBtns.forEach(b => T.tap(b, () => this.setAim(+b.dataset.u)));

    // 감정표현: 😀를 누른 채 손가락을 밀어서 고르고, 떼면 보냄 (가운데에서 떼면 취소)
    const eb = $('t3emo');
    T.hold(eb, e => {
      if (!game.inputOn) return;
      game.emote.open(null, null);                   // 코트 가운데에 원판
      const w = game.emote.wheel, sr = stage.getBoundingClientRect();
      this.ws = Math.min(1, (sr.height - 16) / 340, (sr.width - 16) / 340);   // 작은 화면이면 원판 축소
      w.style.transform = this.ws < 1 ? `scale(${this.ws})` : '';
      this.emo0 = { x: e.clientX, y: e.clientY };    // 누른 곳 = 원판 중심 (거기서 민 방향으로 고름)
    }, () => game.emote.release());
    eb.addEventListener('pointermove', e => {
      if (!game.emote.isOpen || !this.emo0) return;
      const k = 1 / (this.ws || 1), em = game.emote;
      em.move(em.cx + (e.clientX - this.emo0.x) * k * 1.6, em.cy + (e.clientY - this.emo0.y) * k * 1.6);   // 엄지는 조금만 밀어도 되게 ×1.6
    });

    // 코트(캔버스)를 직접 만진 터치는 무시 — 브라우저가 흉내 내는 마우스 클릭(= 직선 샷·조준 이동)이 생기지 않게
    stage.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') e.preventDefault(); });

    // 안내문을 터치용으로
    T.onEnable(() => this.texts());
  }

  setAim(u) {
    this.u = u;
    this.aimBtns.forEach(b => b.classList.toggle('active', +b.dataset.u === u));
    const g = this.g;
    g.aimNdc = null;                                  // 마우스 조준 끄기 (마우스를 다시 움직이면 마우스가 우선)
    g.aimPt = { x: u * TOUCH3.AIM_X, z: TOUCH3.AIM_Z };
    g.serveU = u * TOUCH3.SERVE_U;
  }

  texts() {
    const h = this.g.hud, m = h.el.msg;
    const t = '왼쪽 패드 = 이동 · ◀ ● ▶ = 치는 방향<br>올리기 · 찍기 · 직선 — 꾹 눌러 충전, 떼면 스윙<br>점프 · 런지(셔틀 쪽으로 크게 한 발) · 😀 꾹 → 밀어서 감정표현<br>가로 화면 추천';
    if (h.introMsg === m.innerHTML) { m.innerHTML = t; h.introMsg = t; }
  }

  reset() { this.pad.reset(); ['lift', 'down', 'flat'].forEach(t => this.g.release(t)); this.g.emote.close(); }
}
