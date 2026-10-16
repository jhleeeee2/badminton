// court3d/athlete.js — 3D 선수(플레이어·AI 공용)
//   게임 로직: 이동, 점프, 팔 뻗기, 충전, 스윙, 포핸드/백핸드/라운드 더 헤드 자동 판정
//   몸 모델: 관절 리그 — 팔(어깨-팔꿈치-손목), 다리(엉덩이-무릎-발목)를 2관절 IK로 계산
//   모델 공간: 앞 = -z, 오른쪽 = +x, 위 = +y (AI는 모델을 180° 돌림)
//
// 스윙 단계(연구·코칭 자료 참고, 수치는 게임용):
//   준비(옆으로 몸을 틀고 라켓을 뒤로) → 백스윙(머리 위 샷은 '라켓 드롭': 팔꿈치는 높게, 라켓 머리는 등 뒤로)
//   → 임팩트(팔이 거의 펴짐, 머리 위·약간 앞) → 팔로스루(몸 반대쪽으로 내려옴)
//   백핸드: 등을 반쯤 돌리고 팔꿈치는 갈비뼈 높이에서 리드, 임팩트 때 팔은 살짝 굽음

const RIG = Object.freeze({
  UPPER: 0.29, FORE: 0.26,          // 상완·전완 (사람 비율)
  RACKET: 0.66, SWEET: 0.5,         // 라켓 길이, 손목~스윗스팟
  THIGH: 0.45, SHIN: 0.45, HIP_Y: 0.86, ANKLE_Y: 0.06,
  SHOULDER: [0.19, 0.53, 0],        // 엉덩이 중심 기준 어깨 위치(몸통 좌표)
  HEAD_Y: 0.8
});

// 자세 키프레임 (몸통 좌표, 어깨 기준). w = 손목 위치, r = 라켓 방향, p = 팔꿈치가 향하는 쪽, tw = 몸통 회전, ln = 앞 숙임
// x는 오른손 기준(왼손이면 좌우 반전)
const POSES = {
  ready: { w: [0.12, -0.16, -0.32], r: [0.15, 0.75, -0.65], p: [0.6, -0.7, 0.2], tw: 0, ln: 0.12 },
  FH: {
    over: { prep: { w: [0.2, 0.1, 0.1], r: [0.05, 0.8, 0.6], p: [1, 0.25, 0.2], tw: -0.6, ln: 0.02 },
            back: { w: [0.1, 0.27, 0.06], r: [0.05, -0.85, 0.5], p: [0.4, 0.55, -0.7], tw: -0.55, ln: 0 },
            hit:  { w: [0.12, 0.5, -0.12], r: [0.02, 0.92, -0.38], p: [0.7, 0.2, -0.5], tw: 0.05, ln: 0.1 },
            fol:  { w: [-0.25, -0.42, -0.22], r: [-0.5, -0.6, -0.6], p: [0.5, -0.3, -0.8], tw: 0.45, ln: 0.3 } },
    side: { prep: { w: [0.36, -0.06, 0.16], r: [0.55, 0.45, 0.7], p: [0.3, -0.9, 0.3], tw: -0.45, ln: 0.1 },
            back: { w: [0.4, -0.02, 0.22], r: [0.6, 0.3, 0.75], p: [0.3, -0.9, 0.35], tw: -0.5, ln: 0.1 },
            hit:  { w: [0.3, -0.02, -0.33], r: [0.62, 0.22, -0.75], p: [0.5, -0.8, 0.1], tw: 0.05, ln: 0.14 },
            fol:  { w: [-0.2, -0.05, -0.36], r: [-0.75, 0.15, -0.6], p: [0.4, -0.8, 0], tw: 0.4, ln: 0.16 } },
    low:  { prep: { w: [0.4, -0.36, 0.16], r: [0.55, -0.45, 0.7], p: [0.3, -0.4, 0.85], tw: -0.4, ln: 0.25 },
            back: { w: [0.42, -0.34, 0.22], r: [0.55, -0.4, 0.75], p: [0.3, -0.4, 0.85], tw: -0.45, ln: 0.28 },
            hit:  { w: [0.24, -0.4, -0.3], r: [0.3, -0.4, -0.85], p: [0.4, -0.8, 0.2], tw: 0, ln: 0.32 },
            fol:  { w: [0.05, 0.12, -0.4], r: [0, 0.75, -0.65], p: [0.4, -0.8, 0], tw: 0.2, ln: 0.2 } }
  },
  BH: {
    over: { prep: { w: [-0.22, 0.02, -0.06], r: [-0.3, -0.7, 0.6], p: [-0.3, 0.8, -0.5], tw: 0.75, ln: 0.05 },
            back: { w: [-0.18, 0.12, 0.0], r: [-0.25, -0.8, 0.5], p: [-0.2, 0.9, -0.4], tw: 0.8, ln: 0.05 },
            hit:  { w: [-0.1, 0.5, -0.15], r: [-0.2, 0.9, -0.3], p: [-0.4, 0.5, -0.7], tw: 0.5, ln: 0.08 },
            fol:  { w: [0.05, 0.42, -0.28], r: [0.35, 0.8, -0.5], p: [-0.4, 0.6, -0.6], tw: 0.3, ln: 0.1 } },
    side: { prep: { w: [-0.3, -0.2, -0.06], r: [-0.5, 0.55, 0.65], p: [0.05, -0.8, -0.55], tw: 0.7, ln: 0.12 },
            back: { w: [-0.32, -0.18, 0.0], r: [-0.55, 0.45, 0.7], p: [0.05, -0.8, -0.5], tw: 0.75, ln: 0.12 },
            hit:  { w: [-0.24, -0.02, -0.36], r: [-0.6, 0.3, -0.7], p: [-0.1, -0.8, -0.5], tw: 0.35, ln: 0.14 },
            fol:  { w: [0.25, 0.02, -0.38], r: [0.7, 0.4, -0.55], p: [-0.2, -0.8, -0.4], tw: 0.05, ln: 0.14 } },
    low:  { prep: { w: [-0.3, -0.4, -0.05], r: [-0.4, -0.6, 0.65], p: [-0.2, -0.4, -0.9], tw: 0.55, ln: 0.25 },
            back: { w: [-0.32, -0.38, 0.0], r: [-0.4, -0.55, 0.7], p: [-0.2, -0.4, -0.9], tw: 0.6, ln: 0.28 },
            hit:  { w: [-0.2, -0.36, -0.3], r: [-0.3, -0.4, -0.85], p: [-0.3, -0.8, -0.3], tw: 0.25, ln: 0.32 },
            fol:  { w: [-0.05, 0.02, -0.42], r: [0.2, 0.75, -0.6], p: [-0.3, -0.8, -0.3], tw: 0.1, ln: 0.2 } }
  }
};
const SW_KEYS = [0, 0.24, 0.42, 1];   // 스윙 진행도: 준비 → 백스윙 → 임팩트 → 팔로스루

class Athlete3D {
  constructor(scene, opt) {
    this.side = opt.side;
    this.facing = opt.side === 'me' ? -1 : 1;
    this.color = opt.color;
    this.kit = opt.kit || { shirt: opt.color, accent: 0xFFFFFF, shorts: 0x2A2E38, hair: 0x222222, shoe: 0xF0F0F0 };
    this.mood = null;   // 득점/실점 반응 {kind:'win'|'lose', t}
    this.h = 1; this.hand = 'R';
    this.pos = { x: 0, z: 0 }; this.vel = { x: 0, z: 0 };
    this.y = 0; this.vy = 0;
    this.moveDir = { x: 0, z: 0 };
    this.speedMul = 1;
    this.bounds = { xMin: -4, xMax: 4, zMin: -8, zMax: 8 };
    this.extT = 0; this.recoverT = 0; this.coolT = 0; this.extDir = { x: 0, z: this.facing };
    this.charge = null; this.swingS = null; this.predict = null;
    this.stride = 0;
    this.build(scene);
    this.setHand(opt.hand || 'R');
  }

  setHand(h) { this.hand = h; this.h = h === 'R' ? 1 : -1; this.cur = null; }
  right() { return { x: -this.facing, z: 0 }; }
  onGround() { return this.y <= 0 && this.vy === 0; }
  reach() { return C3.BODY.REACH + (this.extT > 0 ? C3.BODY.EXT_REACH : 0); }

  // 라켓 든 팔 어깨의 세계 좌표 (판정용)
  shoulder() {
    const B = C3.BODY, r = this.right(), e = this.extPhase();
    return {
      x: this.pos.x + r.x * B.SHOULDER_X * this.h + this.extDir.x * 0.3 * e,
      y: B.SHOULDER_H + this.y - 0.25 * e,
      z: this.pos.z + r.z * B.SHOULDER_X * this.h + this.extDir.z * 0.3 * e
    };
  }
  extPhase() {
    if (this.extT > 0) return Math.sin(Math.min(1, (C3.BODY.EXT_TIME - this.extT) / 0.12) * Math.PI / 2);
    if (this.recoverT > 0) return this.recoverT / C3.BODY.EXT_RECOVER;   // 회복하며 천천히 일어남
    return 0;
  }

  classify(sp) {
    const sh = this.shoulder(), r = this.right();
    const lateral = ((sp.x - this.pos.x) * r.x + (sp.z - this.pos.z) * r.z) * this.h;
    const dy = sp.y - sh.y;
    const cat = dy > C3.OVERHEAD_DY ? 'over' : dy < C3.LOW_DY ? 'low' : 'side';
    let hand = 'FH';
    if (lateral < -0.12) hand = (cat === 'over' && lateral > -C3.RTH_RANGE && this.extT <= 0) ? 'RTH' : 'BH';
    return { cat, hand };
  }

  // ───── 동작 ─────
  jump() { if (this.onGround() && this.extT <= 0) this.vy = C3.BODY.JUMP_V; }
  // 스플릿 스텝: 상대가 치는 순간 가볍게 뛰어 다음 첫 발을 준비 (실제 배드민턴 풋워크) — 여기선 보이는 동작만
  splitStep() { if (this.onGround() && this.extT <= 0 && !this.charge && !this.swingS) this.vy = 1.25; }
  react(kind) { this.mood = { kind, t: 1.3 }; if (kind === 'win' && this.onGround()) this.vy = 2.3; }
  // 런지 가능 여부 (0 = 바로 가능, 0~1 = 재충전 진행도)
  extReady() { return this.extT <= 0 && this.recoverT <= 0 && this.coolT <= 0; }
  extCharge() {
    if (this.extReady()) return 1;
    if (this.extT > 0 || this.recoverT > 0) return 0;
    return 1 - this.coolT / C3.BODY.EXT_COOL;
  }
  // 방향: 이동키를 누르고 있으면 그 방향, 아니면 target(셔틀이 올 지점) 쪽, 둘 다 없으면 앞
  extend(target, targetFirst) {
    if (!this.extReady() || !this.onGround()) return false;
    let dx = this.moveDir.x, dz = this.moveDir.z;
    if ((targetFirst || Math.hypot(dx, dz) < 0.05) && target) { dx = target.x - this.pos.x; dz = target.z - this.pos.z; }
    if (Math.hypot(dx, dz) < 0.05) { dx = 0; dz = this.facing; }
    const L = Math.hypot(dx, dz);
    this.extDir = { x: dx / L, z: dz / L };
    this.extT = C3.BODY.EXT_TIME;
    return true;
  }
  startCharge(type) { if (!this.charge && !this.swingS) this.charge = { type, c: 0, dir: 1 }; }
  // 랠리 샷: 차오르다 최대에서 멈춤 / 서브: 0 ↔ 최대(빨간 구간 끝)를 왕복 → 떼는 타이밍으로 세기 결정
  updateCharge(realDt) {
    const ch = this.charge; if (!ch) return;
    const M = C3.CHARGE.MAX;
    if (ch.type === 'serve') {
      ch.c += ch.dir * realDt / C3.CHARGE.SERVE_CYCLE;
      if (ch.c >= M) { ch.c = M; ch.dir = -1; }
      if (ch.c <= 0) { ch.c = 0; ch.dir = 1; }
    } else ch.c = Math.min(M, ch.c + realDt / C3.CHARGE.TIME);
  }
  takeCharge() { const c = this.charge; this.charge = null; return c; }

  swing(type, c, sp, defaultCat) {
    const k = sp ? this.classify(sp) : { cat: defaultCat || 'side', hand: 'FH' };
    this.swingS = { t: 0, dur: C3.BODY.SWING_TIME, window: C3.BODY.HIT_WINDOW, type, c, cat: k.cat, hand: k.hand, hitPose: null, hit: false };
    return this.swingS;
  }
  canHitNow() { return this.swingS && !this.swingS.hit && this.swingS.t <= this.swingS.window; }
  onHit(sp) {
    const s = this.swingS; s.hit = true; s.t = s.dur * SW_KEYS[2];
    s.hitPose = this.contactPose(sp, s.hand === 'BH' ? 'BH' : 'FH', s.cat);
  }

  // ───── 이동 갱신 (고정 간격) ─────
  update(dt) {
    const B = C3.BODY;
    if (this.extT > 0) { this.extT -= dt; if (this.extT <= 0) { this.extT = 0; this.recoverT = B.EXT_RECOVER; } }
    else if (this.recoverT > 0) { this.recoverT = Math.max(0, this.recoverT - dt); if (this.recoverT <= 0) this.coolT = B.EXT_COOL; }
    else if (this.coolT > 0) this.coolT = Math.max(0, this.coolT - dt);
    if (this.extT > 0) {
      // 앞 60% 시간 동안 크게 내딛고(감속 곡선), 나머지는 버팀
      const p = (B.EXT_TIME - this.extT) / (B.EXT_TIME * 0.6);
      const v = p < 1 ? (B.EXT_LUNGE / (B.EXT_TIME * 0.6)) * 2 * (1 - p) : 0;
      this.vel.x = this.extDir.x * v; this.vel.z = this.extDir.z * v;
    } else {
      const maxV = B.SPEED * this.speedMul * (this.recoverT > 0 ? B.EXT_RECOVER_MUL : 1);
      const L = Math.hypot(this.moveDir.x, this.moveDir.z) || 1;
      const tx = this.moveDir.x / L * maxV, tz = this.moveDir.z / L * maxV;
      const acc = B.ACCEL * (this.onGround() ? 1 : 0.2) * dt;
      this.vel.x += Math.max(-acc, Math.min(acc, tx - this.vel.x));
      this.vel.z += Math.max(-acc, Math.min(acc, tz - this.vel.z));
    }
    this.pos.x = Math.max(this.bounds.xMin, Math.min(this.bounds.xMax, this.pos.x + this.vel.x * dt));
    this.pos.z = Math.max(this.bounds.zMin, Math.min(this.bounds.zMax, this.pos.z + this.vel.z * dt));
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= C3.PHYS.G * dt; this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    if (this.swingS) { this.swingS.t += dt; if (this.swingS.t >= this.swingS.dur) this.swingS = null; }
    this.stride += Math.hypot(this.vel.x, this.vel.z) * dt * 2.4;
    if (this.mood) { this.mood.t -= dt; if (this.mood.t <= 0) this.mood = null; }
  }

  // ───── 몸 모델 ─────
  build(scene) {
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    const K = this.kit;
    this.mSkin = mat(0xE6B48F); this.mShirt = mat(K.shirt); this.mShorts = mat(K.shorts); this.mAcc = mat(K.accent);
    this.mAcc.emissive = new THREE.Color(K.accent).multiplyScalar(0.25);
    const cap = (r, l, m) => { const g = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m); g.castShadow = true; return g; };
    this.root = new THREE.Group(); scene.add(this.root);
    this.model = new THREE.Group(); this.root.add(this.model);
    this.model.rotation.y = this.facing === -1 ? 0 : Math.PI;

    this.torso = new THREE.Group(); this.model.add(this.torso);
    const chest = cap(0.16, 0.34, this.mShirt); chest.position.y = 0.3; chest.scale.set(1.1, 1, 0.75); this.torso.add(chest);
    const pelvis = cap(0.14, 0.06, this.mShorts); pelvis.position.y = 0.02; pelvis.scale.set(1.15, 1, 0.8); this.torso.add(pelvis);
    const neck = cap(0.045, 0.06, this.mSkin); neck.position.y = 0.66; this.torso.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 14), this.mSkin); head.position.y = RIG.HEAD_Y; head.castShadow = true; this.torso.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.117, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(K.hair)); hair.position.y = RIG.HEAD_Y + 0.005; hair.rotation.x = 0.25; this.torso.add(hair);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.018, 6, 24), this.mAcc); band.position.y = RIG.HEAD_Y + 0.035; band.rotation.x = Math.PI / 2; this.torso.add(band);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.178, 0.07, 20), this.mAcc); stripe.position.y = 0.42; stripe.scale.set(1.1, 1, 0.76); this.torso.add(stripe);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 16), this.mAcc); collar.position.y = 0.6; collar.rotation.x = Math.PI / 2; this.torso.add(collar);

    // 관절 사이를 잇는 원기둥(캡슐)
    const seg = (r, l, m) => { const g = cap(r, l - 2 * r, m); this.model.add(g); return g; };
    const joint = (r, m) => { const g = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m); g.castShadow = true; this.model.add(g); return g; };
    this.arm = { upper: seg(0.048, RIG.UPPER + 0.05, this.mShirt), fore: seg(0.038, RIG.FORE + 0.04, this.mSkin), elbow: joint(0.042, this.mSkin), hand: joint(0.04, this.mSkin), wrist: joint(0.046, this.mAcc) };
    this.off = { upper: seg(0.048, RIG.UPPER + 0.05, this.mShirt), fore: seg(0.038, RIG.FORE + 0.04, this.mSkin), elbow: joint(0.042, this.mSkin), hand: joint(0.038, this.mSkin) };
    this.legs = [0, 1].map(() => ({ thigh: seg(0.075, RIG.THIGH + 0.06, this.mShorts), shin: seg(0.058, RIG.SHIN + 0.05, this.mSkin), knee: joint(0.06, this.mSkin),
      sock: joint(0.06, mat(0xFFFFFF)),
      shoe: (() => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.27), mat(K.shoe)); s.castShadow = true; this.model.add(s); return s; })() }));

    // 라켓 (손잡이 → 샤프트 → 헤드), 로컬 +y 방향
    const rk = new THREE.Group(); this.model.add(rk); this.racket = rk;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 8), mat(0x30343E)); grip.position.y = 0.06; rk.add(grip);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 6), mat(0xB8BCC6)); shaft.position.y = 0.29; rk.add(shaft);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.01, 6, 28), this.mAcc); ring.scale.set(0.82, 1.12, 1); ring.position.y = 0.53; rk.add(ring);
    const str = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    str.scale.set(0.82, 1.12, 1); str.position.y = 0.53; rk.add(str);

    this.V = (x, y, z) => new THREE.Vector3(x, y, z);
    this._up = this.V(0, 1, 0); this._z = this.V(0, 0, 1);
    this.tq = new THREE.Quaternion(); this.tqi = new THREE.Quaternion();
    this.cur = null; this.offCur = null;
  }

  // 자세 객체 만들기 (손 방향 반영)
  P(o) { const h = this.h; return { w: this.V(o.w[0] * h, o.w[1], o.w[2]), r: this.V(o.r[0] * h, o.r[1], o.r[2]).normalize(), p: this.V(o.p[0] * h, o.p[1], o.p[2]).normalize(), tw: o.tw * h, ln: o.ln }; }
  lerpPose(a, b, t) {
    return { w: a.w.clone().lerp(b.w, t), r: a.r.clone().lerp(b.r, t).normalize(), p: a.p.clone().lerp(b.p, t).normalize(), tw: a.tw + (b.tw - a.tw) * t, ln: a.ln + (b.ln - a.ln) * t };
  }
  poseOf(hand, cat, key) { return this.P(POSES[hand === 'BH' ? 'BH' : 'FH'][cat][key]); }

  // 셔틀에 스윗스팟이 닿는 자세 (몸통 좌표). 팔이 다 펴져도 모자라면 라켓 끝을 셔틀 쪽으로
  contactPose(spWorld, hand, cat) {
    const base = this.poseOf(hand, cat, 'hit');
    const q = this.root.worldToLocal(this.V(spWorld.x, spWorld.y, spWorld.z));       // 모델 공간
    q.sub(this.hipPos()).applyQuaternion(this.tqi).sub(this.shoulderLocal());          // 몸통·어깨 기준
    let r = q.clone().normalize().lerp(base.r, 0.35).normalize();
    let w = q.clone().sub(r.clone().multiplyScalar(RIG.SWEET));
    const maxL = RIG.UPPER + RIG.FORE - 0.01;
    if (w.length() > maxL) { w.setLength(maxL); r = q.clone().sub(w).normalize(); }
    if (w.length() < 0.18) w.setLength(0.18);
    return { w, r, p: base.p, tw: base.tw, ln: base.ln };
  }
  shoulderLocal(off) { return this.V(RIG.SHOULDER[0] * this.h * (off ? -1 : 1), RIG.SHOULDER[1], RIG.SHOULDER[2]); }
  hipPos() { return this.V(0, this._hipY || RIG.HIP_Y, 0); }

  // 2관절 IK: 시작 A, 목표 T, 길이 L1·L2, 팔꿈치/무릎이 향할 방향 pole → [중간 관절, 끝]
  ik(A, T, L1, L2, pole) {
    const d = T.clone().sub(A); let len = d.length();
    len = Math.max(Math.abs(L1 - L2) + 0.02, Math.min(L1 + L2 - 0.001, len));
    d.normalize();
    const cosA = (L1 * L1 + len * len - L2 * L2) / (2 * L1 * len), ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
    let bend = pole.clone().sub(d.clone().multiplyScalar(pole.dot(d)));
    if (bend.lengthSq() < 1e-6) bend = this.V(0, -1, 0).sub(d.clone().multiplyScalar(-d.y));
    bend.normalize();
    const mid = A.clone().add(d.clone().multiplyScalar(Math.cos(ang) * L1)).add(bend.multiplyScalar(Math.sin(ang) * L1));
    return [mid, A.clone().add(d.multiplyScalar(len))];
  }
  place(mesh, a, b) {   // 캡슐을 두 점 사이에
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(this._up, b.clone().sub(a).normalize());
  }

  // ───── 매 프레임 그리기 ─────
  animate(dt, shuttlePos, incoming) {
    const e = this.extPhase(), sw = this.swingS, k = Math.min(1, dt * 12);
    const lv = this.facing === -1 ? { x: this.vel.x, z: this.vel.z } : { x: -this.vel.x, z: -this.vel.z };   // 모델 공간 속도
    const sp = Math.hypot(lv.x, lv.z), run = Math.min(1, sp / 3.5);
    const crouch = 0.04 + 0.26 * e + (this.charge ? 0.04 : 0);
    this._hipY = RIG.HIP_Y - crouch + (this.onGround() ? Math.abs(Math.sin(this.stride)) * 0.035 * run : 0);
    this.root.position.set(this.pos.x, this.y, this.pos.z);
    this.root.updateMatrixWorld(true);

    let near = false;   // 포/백 예측은 셔틀이 가까이 왔을 때만 (멀 때 판정은 의미 없음)
    if (shuttlePos && incoming) { const s0 = this.shoulder(); near = Math.hypot(shuttlePos.x - s0.x, shuttlePos.y - s0.y, shuttlePos.z - s0.z) < 2.8; }
    this.predict = near ? this.classify(shuttlePos) : null;

    // ── 목표 자세 ──
    let target;
    if (sw) {
      const hand = sw.hand === 'BH' ? 'BH' : 'FH', cat = sw.cat, p = sw.t / sw.dur;
      const prep = this.poseOf(hand, cat, 'prep'), back = this.poseOf(hand, cat, 'back'), fol = this.poseOf(hand, cat, 'fol');
      let hit = sw.hitPose;
      if (!hit) {   // 아직 안 맞음: 셔틀이 가까우면 그쪽으로, 아니면 기본 임팩트 자세
        hit = this.poseOf(hand, cat, 'hit');
        if (shuttlePos && sw.t < sw.window) {
          const s = this.shoulder(), dd = Math.hypot(shuttlePos.x - s.x, shuttlePos.y - s.y, shuttlePos.z - s.z);
          if (dd < this.reach() * 1.25) hit = this.contactPose(shuttlePos, hand, cat);
        }
      }
      const ease = t => t * t * (3 - 2 * t);
      if (p < SW_KEYS[1]) target = this.lerpPose(prep, back, ease(p / SW_KEYS[1]));
      else if (p < SW_KEYS[2]) target = this.lerpPose(back, hit, ease((p - SW_KEYS[1]) / (SW_KEYS[2] - SW_KEYS[1])));
      else target = this.lerpPose(hit, fol, ease((p - SW_KEYS[2]) / (1 - SW_KEYS[2])));
      this.cur = target;                                       // 스윙은 곡선 그대로(빠른 동작)
    } else {
      if (this.charge) {
        const pr = this.predict || { cat: { down: 'over', lift: 'low', flat: 'side', serve: 'low' }[this.charge.type], hand: 'FH' };
        target = this.poseOf(pr.hand, pr.cat, 'prep');
      } else if (e > 0.05 && shuttlePos) {
        target = this.contactPose(shuttlePos, 'FH', 'side'); target.ln = 0.35;   // 팔 뻗기: 셔틀 쪽으로
      } else if (this.mood && this.mood.kind === 'win') {
        target = this.P({ w: [0.12, 0.52, -0.08], r: [0.1, 0.95, -0.2], p: [0.8, 0.2, 0.3], tw: 0.1, ln: -0.08 });   // 라켓 번쩍
      } else if (this.mood && this.mood.kind === 'lose') {
        target = this.P({ w: [0.1, -0.5, -0.1], r: [0.2, -0.9, -0.3], p: [0.5, -0.3, 0.6], tw: 0, ln: 0.45 });       // 고개 숙임
      } else target = this.P(POSES.ready);
      this.cur = this.cur ? this.lerpPose(this.cur, target, k) : target;      // 평소엔 부드럽게 따라감
    }
    const pose = this.cur;

    // ── 몸통 ──
    this.torso.position.copy(this.hipPos());
    this.torso.rotation.set(-(pose.ln + 0.2 * e), pose.tw, 0, 'YXZ');
    this.torso.updateMatrix();
    this.tq.setFromEuler(this.torso.rotation); this.tqi.copy(this.tq).invert();
    const toModel = v => v.clone().applyQuaternion(this.tq).add(this.hipPos());

    // ── 라켓 팔 ──
    const S = toModel(this.shoulderLocal());
    const W = toModel(this.shoulderLocal().add(pose.w));
    const pole = pose.p.clone().applyQuaternion(this.tq);
    const [E, Wc] = this.ik(S, W, RIG.UPPER, RIG.FORE, pole);
    this.place(this.arm.upper, S, E); this.place(this.arm.fore, E, Wc);
    this.arm.elbow.position.copy(E); this.arm.hand.position.copy(Wc);
    this.arm.wrist.position.copy(E.clone().lerp(Wc, 0.85));
    const R = pose.r.clone().applyQuaternion(this.tq).normalize();
    this.racket.position.copy(Wc);
    const q1 = new THREE.Quaternion().setFromUnitVectors(this._up, R);
    const face = this._z.clone().applyQuaternion(q1);                     // 라켓 면이 앞(-z)을 보도록 축 회전
    const want = this.V(0, 0, -1).sub(R.clone().multiplyScalar(-R.z));
    if (want.lengthSq() > 1e-4) {
      want.normalize();
      const ang = Math.atan2(face.clone().cross(want).dot(R), face.dot(want));
      this.racket.quaternion.setFromAxisAngle(R, ang).multiply(q1);
    } else this.racket.quaternion.copy(q1);

    // ── 반대 팔: 머리 위 샷 땐 셔틀 쪽으로 들어 균형, 평소엔 흔들기 ──
    const over = (sw && sw.cat === 'over' && sw.t / sw.dur < SW_KEYS[2]) || (this.charge && this.predict && this.predict.cat === 'over');
    const h = this.h;
    const fist = this.mood && this.mood.kind === 'win';
    const offT = fist ? { w: this.V(-0.05 * h, 0.5, -0.1), p: this.V(-1 * h, 0, 0.2) } : over ? { w: this.V(0.02 * h, 0.42, -0.3), p: this.V(-1 * h, -0.2, 0) }
      : { w: this.V(-0.06 * h, -0.42, 0.06 + Math.sin(this.stride) * 0.18 * run), p: this.V(-0.3 * h, 0, 0.9) };
    this.offCur = this.offCur ? { w: this.offCur.w.lerp(offT.w, k), p: this.offCur.p.lerp(offT.p, k) } : offT;
    const S2 = toModel(this.shoulderLocal(true)), W2 = toModel(this.shoulderLocal(true).add(this.offCur.w));
    const [E2, W2c] = this.ik(S2, W2, RIG.UPPER, RIG.FORE, this.offCur.p.clone().applyQuaternion(this.tq));
    this.place(this.off.upper, S2, E2); this.place(this.off.fore, E2, W2c);
    this.off.elbow.position.copy(E2); this.off.hand.position.copy(W2c);

    // ── 다리: 발 위치 정하고 무릎 IK ──
    const fwd = sp > 0.2 ? { x: lv.x / sp, z: lv.z / sp } : { x: 0, z: -1 };
    const loc = this.facing === -1 ? this.extDir : { x: -this.extDir.x, z: -this.extDir.z };
    for (let i = 0; i < 2; i++) {
      const isRacket = (i === 1) === (h > 0);                  // 라켓 쪽 다리
      const sx = (i === 0 ? -0.15 : 0.15);
      const hip = this.V(sx * 0.65, this._hipY, 0);
      const ph = this.stride + (i === 0 ? 0 : Math.PI);
      let foot = this.V(sx, RIG.ANKLE_Y, isRacket ? -0.08 : 0.1);
      foot.x += fwd.x * Math.sin(ph) * 0.3 * run; foot.z += fwd.z * Math.sin(ph) * 0.3 * run;
      foot.y += Math.max(0, Math.cos(ph)) * 0.13 * run;
      if (e > 0) {                                              // 런지: 라켓 쪽 발 크게 앞으로
        const m = isRacket ? 0.75 : -0.25;
        foot.x += loc.x * m * e; foot.z += loc.z * m * e;
      }
      if (over && !sw) foot.z += isRacket ? 0.22 : -0.1;          // 머리 위 준비: 라켓 쪽 발 뒤로
      if (!this.onGround()) foot = this.V(sx * 0.8, this._hipY - 0.78, isRacket ? 0.12 : -0.05);
      const [K, A] = this.ik(hip, foot, RIG.THIGH, RIG.SHIN, this.V(sx * 0.3, 0.1, -1));
      const L = this.legs[i];
      this.place(L.thigh, hip, K); this.place(L.shin, K, A); L.knee.position.copy(K);
      L.shoe.position.set(A.x, A.y - 0.02, A.z - 0.05); L.sock.position.copy(K.clone().lerp(A, 0.88));
    }
  }
}
