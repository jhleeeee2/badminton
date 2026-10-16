// court3d/physics.js — 셔틀콕 3D 물리: 중력 + 속도 제곱에 비례하는 공기저항
//   a = g - (g / VT²)·|v|·v   (VT = 종단속도) → 빠르게 쳐도 금방 느려지고, 떨어질 땐 거의 수직
//   고정 STEP으로 적분 (같은 입력 → 같은 궤적)

const Phys3 = {
  netHeight(x) {   // 네트는 중앙이 살짝 처짐 (1.524 → 기둥 1.55)
    const c = C3.COURT, k = Math.min(1, Math.abs(x) / c.HALF_W_D);
    return c.NET_H_CENTER + (c.NET_H_POST - c.NET_H_CENTER) * k;
  },

  // p, v: {x,y,z} (제자리 갱신). 한 STEP 진행
  step(p, v, dt) {
    const g = C3.PHYS.G, k = g / (C3.PHYS.VT * C3.PHYS.VT);
    const sp = Math.hypot(v.x, v.y, v.z);
    v.x += (-k * sp * v.x) * dt;
    v.y += (-g - k * sp * v.y) * dt;
    v.z += (-k * sp * v.z) * dt;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
  },

  // 한 STEP 이동(p0→p1) 중 네트 면(z=0)을 지났는지 검사 → 걸렸으면 {x,y}
  netHit(p0, p1) {
    if ((p0.z > 0) === (p1.z > 0) || p0.z === p1.z) return null;
    const t = p0.z / (p0.z - p1.z);
    const x = p0.x + (p1.x - p0.x) * t, y = p0.y + (p1.y - p0.y) * t;
    if (Math.abs(x) > C3.COURT.HALF_W_D + 0.05) return null;      // 기둥 바깥으로 지나감
    return y < this.netHeight(x) + 0.03 ? { x, y } : null;
  },

  // 바닥에 닿거나 네트에 걸릴 때까지 시뮬레이션
  simulate(p0, v0, opt = {}) {
    const dt = C3.PHYS.STEP * (opt.coarse || 1), maxT = opt.maxT || 6;
    const p = { ...p0 }, v = { ...v0 }, path = [];
    let t = 0, apex = p.y;
    while (t < maxT) {
      const prev = { ...p };
      this.step(p, v, dt); t += dt;
      apex = Math.max(apex, p.y);
      if (opt.path) path.push({ t, x: p.x, y: p.y, z: p.z });
      const nh = this.netHit(prev, p);
      if (nh) return { net: { t, ...nh }, land: null, apex, path };
      if (p.y <= 0) {
        const f = prev.y / (prev.y - p.y);
        return { net: null, land: { t: t - dt + dt * f, x: prev.x + (p.x - prev.x) * f, z: prev.z + (p.z - prev.z) * f }, apex, path };
      }
    }
    return { net: null, land: { t, x: p.x, z: p.z }, apex, path };
  },

  // 발사 방향(수평 단위벡터 hx,hz)·각도에서 수평거리 range에 떨어지는 속력 찾기 (이분법)
  // 공기저항 때문에 거리에 한계가 있음 → 못 미치면 최대 속력 반환(짧게 떨어짐)
  solveSpeed(p0, hx, hz, angleDeg, range) {
    const a = angleDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const rangeAt = s => this._noNetRange(p0, hx, hz, ca, sa, s);
    let lo = 0.5, hi = 95;
    if (rangeAt(hi) < range) return hi;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (rangeAt(mid) < range) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  },

  // 네트 무시하고 바닥까지 거리 (속력 탐색용)
  _noNetRange(p0, hx, hz, ca, sa, s) {
    const p = { ...p0 }, v = { x: hx * ca * s, y: sa * s, z: hz * ca * s }, dt = C3.PHYS.STEP;
    for (let t = 0; t < 6; t += dt) {
      const prev = { ...p }; this.step(p, v, dt);
      if (p.y <= 0) { const f = prev.y / (prev.y - p.y); return Math.hypot(prev.x + (p.x - prev.x) * f - p0.x, prev.z + (p.z - prev.z) * f - p0.z); }
    }
    return Math.hypot(p.x - p0.x, p.z - p0.z);
  },

  launchVel(hx, hz, angleDeg, s) {
    const a = angleDeg * Math.PI / 180;
    return { x: hx * Math.cos(a) * s, y: Math.sin(a) * s, z: hz * Math.cos(a) * s };
  },

  // 표준정규분포 난수
  randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
};
