// court3d/emote.js — 감정표현: T를 누르고 있는 동안 원판(안쪽 = 표정, 바깥쪽 = 말)이 뜨고,
//   마우스를 움직인 방향의 칸이 골라짐 → T를 떼면 보냄 (가운데에서 떼면 취소)
//   표시 위치: 상대 = 화면 왼쪽 위(점수판 아래), 나 = 화면 오른쪽 아래 — 선수 위에 띄우면 코트를 가려서

const EMOTES = Object.freeze([
  { id: 'up', e: '👍', n: '따봉' },
  { id: 'down', e: '👎', n: '역따봉' },
  { id: 'smile', e: '😄', n: '웃음' },
  { id: 'cry', e: '😭', n: '울음' },
  { id: 'cool', e: '😎', n: '자신만만' },
  { id: 'angry', e: '😤', n: '짜증' },
  { id: 'puke', e: '🤮', n: '우웩' }
]);
const PHRASES = Object.freeze(['눈을 뜨세요', '화이팅~', 'ㅋㅋㅋㅋ', '안돼!', 'ㅠㅠㅠ', '?', '하하하', '나이스~']);
const EMO3 = Object.freeze({ R_IN: 60, R_OUT: 132, CANCEL: 24, SPLIT: 96, SIZE: 170, SHOW: 2.6, COOL: 1.0 });

class Emote3D {
  constructor(game, container) {
    this.g = game; this.box = container; this.open_ = false; this.sel = null; this.cool = 0;
    this.items = [
      ...EMOTES.map((x, i) => ({ id: x.id, kind: 'e', label: x.e, name: x.n, ring: 0, ang: -Math.PI / 2 + i * 2 * Math.PI / EMOTES.length })),
      ...PHRASES.map((t, i) => ({ id: 'p' + i, kind: 'p', label: t, ring: 1, ang: -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / PHRASES.length }))
    ];
    // 원판
    const w = document.createElement('div'); w.className = 'c3wheel'; w.hidden = true;
    w.innerHTML = '<div class="ring out"></div><div class="ring in"></div><div class="needle"></div><div class="hub">T</div>';
    for (const it of this.items) {
      const d = document.createElement('div'); d.className = 'wi ' + (it.kind === 'e' ? 'emo' : 'txt');
      const r = it.ring ? EMO3.R_OUT : EMO3.R_IN;
      d.style.left = (EMO3.SIZE + Math.cos(it.ang) * r) + 'px'; d.style.top = (EMO3.SIZE + Math.sin(it.ang) * r) + 'px';
      d.textContent = it.label; if (it.name) d.title = it.name;
      w.appendChild(d); it.el = d;
    }
    container.appendChild(w); this.wheel = w; this.needle = w.querySelector('.needle'); this.hub = w.querySelector('.hub');
    // 말풍선 (상대: 왼쪽 위 / 나: 오른쪽 아래)
    this.bub = {};
    for (const side of ['opp', 'me']) {
      const b = document.createElement('div'); b.className = 'c3emo ' + side; b.hidden = true;
      container.appendChild(b); this.bub[side] = { el: b, t: 0 };
    }
  }

  get isOpen() { return this.open_; }

  // cx, cy: 화면 좌표(마우스 위치). 원판이 화면 밖으로 나가지 않게 중심을 안쪽으로
  open(cx, cy) {
    const r = this.box.getBoundingClientRect(), S = EMO3.SIZE;
    if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    const x = Math.max(S, Math.min(r.width - S, cx - r.left)), y = Math.max(S - 20, Math.min(r.height - S + 20, cy - r.top));
    this.cx = r.left + x; this.cy = r.top + y;
    this.wheel.style.left = (x - S) + 'px'; this.wheel.style.top = (y - S) + 'px';
    this.wheel.hidden = false; this.open_ = true; this.sel = null;
    this.mark(null); this.needle.style.opacity = 0;
    // 커서가 원판 중심에서 시작하도록, 처음 위치는 실제 마우스 위치 기준 오프셋으로 계산
    this.move(cx, cy);
  }
  move(mx, my) {
    if (!this.open_) return;
    const dx = mx - this.cx, dy = my - this.cy, d = Math.hypot(dx, dy);
    if (d < EMO3.CANCEL) { this.sel = null; this.mark(null); this.needle.style.opacity = 0; return; }
    const ang = Math.atan2(dy, dx), ring = d < EMO3.SPLIT ? 0 : 1;
    let best = null, bd = 1e9;
    for (const it of this.items) {
      if (it.ring !== ring) continue;
      let da = Math.abs(ang - it.ang) % (2 * Math.PI); if (da > Math.PI) da = 2 * Math.PI - da;
      if (da < bd) { bd = da; best = it; }
    }
    this.sel = best; this.mark(best);
    this.needle.style.opacity = 1;
    this.needle.style.width = Math.min(d, ring ? EMO3.R_OUT : EMO3.R_IN) + 'px';
    this.needle.style.transform = `rotate(${ang}rad)`;
  }
  mark(it) { for (const x of this.items) x.el.classList.toggle('on', x === it); this.hub.textContent = it ? '' : '취소'; }
  // T를 뗌 → 고른 것 보내기
  release() {
    if (!this.open_) return;
    const it = this.sel; this.close();
    if (it) this.g.sendEmote(it.id);
  }
  close() { this.open_ = false; this.wheel.hidden = true; this.sel = null; }

  // 표시. side = 'me' | 'opp'. 내 것은 COOL초에 한 번만 (도배 방지) — 보냈으면 true
  show(side, id) {
    const it = this.items.find(x => x.id === id); if (!it) return false;
    if (side === 'me') { if (this.cool > 0) return false; this.cool = EMO3.COOL; }
    const b = this.bub[side];
    b.el.className = 'c3emo ' + side + (it.kind === 'e' ? ' big' : '');
    b.el.textContent = it.label; b.el.hidden = false; b.t = EMO3.SHOW;
    b.el.classList.remove('pop'); void b.el.offsetWidth; b.el.classList.add('pop');
    if (typeof Sound3 !== 'undefined' && Sound3.blip) Sound3.blip(side === 'me');
    return true;
  }
  update(real) {
    this.cool = Math.max(0, this.cool - real);
    for (const k in this.bub) {
      const b = this.bub[k]; if (b.t <= 0) continue;
      b.t -= real; b.el.style.opacity = Math.min(1, b.t * 2.5);
      if (b.t <= 0) b.el.hidden = true;
    }
  }
}
