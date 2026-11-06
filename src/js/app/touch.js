// app/touch.js — 모바일(터치) 버튼 조작 공용 도구
//   터치 기기면 <body class="touch"> → CSS가 코트 양옆에 버튼 패드를 보여줌 (PC 화면은 그대로)
//   · TouchUI.hold(el, on, off) : 누르고 있는 동안 (손가락이 버튼 밖으로 미끄러져도 뗄 때까지 유지)
//   · TouchUI.tap(el, fn)       : 누르는 순간 한 번
//   · TouchUI.dpad(el, fn)      : 원형 방향 패드. 손가락 위치 → fn({x, y}) (각 −1·0·1, 8방향, 가운데는 정지)
//   [게임 설계] 판정이 '누른 순간'이라 버튼은 pointerdown에서 바로 실행 (click은 떼야 실행돼서 늦음)

const TouchUI = {
  on: false,
  hooks: [],

  init() {
    let coarse = false;
    try { coarse = matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) { /* 무시 */ }
    if (coarse || new URLSearchParams(location.search).has('touch')) this.enable();
    // 터치 노트북처럼 처음엔 마우스로 판정된 기기: 화면을 처음 만지는 순간 켬
    window.addEventListener('touchstart', () => this.enable(), { passive: true, once: true });
  },
  enable() {
    if (this.on) return;
    this.on = true;
    document.body.classList.add('touch');
    this.hooks.forEach(f => f());
    window.dispatchEvent(new Event('resize'));   // 3D 화면 크기 다시 계산
  },
  onEnable(f) { this.hooks.push(f); if (this.on) f(); },

  // 버튼 공통: 길게 누를 때 뜨는 메뉴·글자 선택·스크롤 막기
  prep(el) {
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.style.touchAction = 'none';
    return el;
  },
  tap(el, fn) {
    this.prep(el).addEventListener('pointerdown', e => { e.preventDefault(); fn(e); });
  },
  hold(el, on, off) {
    this.prep(el);
    let id = null;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId;
      try { el.setPointerCapture(id); } catch (err) { /* 무시 */ }
      el.classList.add('held'); on(e);
    });
    const end = e => {
      if (e.pointerId !== id) return;
      id = null; el.classList.remove('held'); off(e);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  },
  dpad(el, fn) {
    this.prep(el);
    let id = null, cur = { x: 0, y: 0 };
    const knob = el.querySelector('.knob');
    const set = d => {
      if (d.x === cur.x && d.y === cur.y) return;
      cur = d; fn(d);
      el.querySelectorAll('[data-dir]').forEach(s => {
        const [sx, sy] = s.dataset.dir.split(',').map(Number);
        s.classList.toggle('on', (sx && sx === d.x) || (sy && sy === d.y));
      });
    };
    const read = e => {
      const r = el.getBoundingClientRect(), R = r.width / 2;
      const dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy);
      if (knob) { const k = Math.min(1, d / R) * R * 0.55, a = Math.atan2(dy, dx); knob.style.transform = `translate(${Math.cos(a) * k}px,${Math.sin(a) * k}px)`; }
      if (d < R * 0.22) { set({ x: 0, y: 0 }); return; }   // 가운데 = 정지
      // 8방향: 45° 칸으로 나눔
      const oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
      const T = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][(oct + 8) % 8];
      set({ x: T[0], y: T[1] });
    };
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId;
      try { el.setPointerCapture(id); } catch (err) { /* 무시 */ }
      el.classList.add('held'); read(e);
    });
    el.addEventListener('pointermove', e => { if (e.pointerId === id) read(e); });
    const end = e => {
      if (e.pointerId !== id) return;
      id = null; el.classList.remove('held');
      if (knob) knob.style.transform = '';
      set({ x: 0, y: 0 });
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    return { reset: () => { id = null; el.classList.remove('held'); if (knob) knob.style.transform = ''; set({ x: 0, y: 0 }); } };
  }
};
