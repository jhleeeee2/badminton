// court3d/view.js — Three.js 장면
//   경기장: 코트(BWF 규격 라인)·네트·파란 바닥·LED 광고판·관중석·컬러 조명
//   셔틀: 발광·바닥 그림자·수직선·속도별 색 잔상
//   이펙트: 타격 불꽃·충격파·착지 파문·네트 흔들림·관중 환호·카메라 흔들림/줌
//   보조: 조준선·궤적 미리보기·낙하 지점·서 있을 위치

const ARENA = Object.freeze({   // [게임] 색 구성
  BG_TOP: '#1B1640', BG_BOTTOM: '#060A18', FOG: 0x0E1230,
  SURROUND: 0x1A2C66, COURT: 0x23875A, MAT: 0x175A3E, LINE: 0xFFFFFF,
  CROWD_S: 0.42, CROWD_L: 0.46, STAND: 0x1A1E44, LED_DIM: 0xB8B8B8,
  LED: ['#FF4FD8', '#3DD9FF', '#FFD23F', '#7CFF6B', '#FF7A45', '#9B7BFF'],
  RIM_A: 0xFF4FD8, RIM_B: 0x3DD9FF
});
// 코트 양쪽 끝(엔드) 배경 [게임]: 내 맞은편(화면 안쪽) 관중석·배경이 엔드마다 살짝 다름.
//   친구 대전에선 두 사람이 서로 다른 엔드를 보게 되고, 코트 체인지 때 서로 바뀜
const ENDS = Object.freeze([
  { name: 'A', BG_TOP: '#1B1640', BG_BOTTOM: '#060A18', STAND: 0x1A1E44, LED: 0xB8B8B8, RIM_A: 0xFF4FD8, RIM_B: 0x3DD9FF, FLAG: '#FF4FD8' },
  { name: 'B', BG_TOP: '#10303A', BG_BOTTOM: '#04120F', STAND: 0x1E5A55, LED: 0x8FE3C6, RIM_A: 0xFFB13B, RIM_B: 0x5BFFB0, FLAG: '#5BFFB0' }
]);

class CourtView3D {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = this.gradientTex(ARENA.BG_TOP, ARENA.BG_BOTTOM);
    this.scene.fog = new THREE.Fog(ARENA.FOG, 24, 46);
    this.baseFov = 44;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, 16 / 9, 0.1, 120);
    // 왼쪽 뒤 높은 곳에서 오른쪽 앞을 비스듬히 [게임]. 화각은 매 프레임 '꼭 보여야 할 점'에 맞춰 자동 조절(fitFov)
    this.camBase = new THREE.Vector3(-2.0, 5.1, 13.4);   // 너무 위에서 내려다보지 않게, 살짝만 높임 (4.6 → 5.1m)
    this.camLook = new THREE.Vector3(0.3, 0.2, -0.2);
    const H = C3.COURT.HALF_LEN, Wd = C3.COURT.HALF_W_D;
    this.mustSee = [   // 내 코트 맨 뒤(선수가 설 수 있는 곳까지) + 상대 베이스라인
      new THREE.Vector3(-Wd - 0.2, 0, H + 1.05), new THREE.Vector3(Wd + 0.2, 0, H + 1.05),
      new THREE.Vector3(-Wd, 0, -H - 0.3), new THREE.Vector3(Wd, 0, -H - 0.3),
      new THREE.Vector3(0, 2.4, -H - 0.6)   // 상대가 맨 뒤에서 점프해도 머리까지
    ];
    this.fitFov = this.baseFov; this.tilt = 0; this._v = new THREE.Vector3(); this._sp = new THREE.Vector3();
    this.camera.position.copy(this.camBase); this.camera.lookAt(this.camLook);
    this.lookCur = this.camLook.clone();
    this.shakeA = 0; this.fovKick = 0; this.time = 0; this.cheerT = 0; this.cheerA = 0; this.netT = 0; this.ledBoost = 0;

    this.shadowOn = true; this.ump = null;
    this.buildLights(); this.buildArena(); this.buildCourt(); this.buildNet(); this.buildUmpire(); this.buildShuttle(); this.buildHelpers(); this.buildFx();
    this.setEnd(1);
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  gradientTex(top, bottom) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); return t;
  }
  radialTex(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // 화면을 창 크기에 맞게 (가로는 컨테이너, 세로는 남은 창 높이까지)
  resize() {
    const w = this.container.clientWidth || 960;
    const top = this.container.getBoundingClientRect().top;
    const avail = window.innerHeight - Math.max(0, top) - 14;
    const h = Math.round(Math.max(360, Math.min(w * 0.62, avail > 300 ? avail : w * 0.6)));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xCFDCFF, 0x3A2A5A, 0.7));
    const d = new THREE.DirectionalLight(0xFFFFFF, 0.9);
    d.position.set(3, 13, 6); d.castShadow = true;
    d.shadow.mapSize.set(1024, 1024);
    Object.assign(d.shadow.camera, { left: -6, right: 6, top: 9, bottom: -9, near: 1, far: 32 });
    this.scene.add(d);
    // 컬러 측면 조명 (보라·하늘)
    const a = new THREE.PointLight(ARENA.RIM_A, 0.8, 26); a.position.set(-9, 5, -4); this.scene.add(a);
    const b = new THREE.PointLight(ARENA.RIM_B, 0.6, 26); b.position.set(9, 5, -4); this.scene.add(b);
    this.rimA = a; this.rimB = b;
  }

  buildArena() {
    const S = this.scene;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: ARENA.SURROUND, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.003; floor.receiveShadow = true; S.add(floor);

    // LED 광고판 (색 띠가 흐름)
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 64;
    const x = cv.getContext('2d');
    const words = ['RALLY', '스매시!', 'NICE', '랠리', 'SMASH', '배드민턴', 'GO!', 'WIN'];
    for (let i = 0; i < 8; i++) {
      x.fillStyle = ARENA.LED[i % ARENA.LED.length]; x.fillRect(i * 128, 0, 128, 64);
      x.fillStyle = 'rgba(255,255,255,0.95)'; x.textAlign = 'center'; x.textBaseline = 'middle';
      let fs = 30; do { x.font = `bold ${fs}px sans-serif`; fs -= 2; } while (x.measureText(words[i]).width > 112 && fs > 14);
      x.fillText(words[i], i * 128 + 64, 34);
    }
    this.ledTex = new THREE.CanvasTexture(cv); this.ledTex.wrapS = THREE.RepeatWrapping;
    const ledMat = new THREE.MeshBasicMaterial({ map: this.ledTex, color: ARENA.LED_DIM });
    const board = (w, x0, z0, ry) => {
      const t = this.ledTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(w / 8, 1);
      const face = new THREE.MeshBasicMaterial({ map: t, color: ARENA.LED_DIM });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, 0.12), [ledMat, ledMat, ledMat, ledMat, face, face]);
      m.position.set(x0, 0.4, z0); m.rotation.y = ry; S.add(m); this.boards.push(t);
      return face;
    };
    this.boards = [];
    this.farLed = board(13, 0, -9.3, 0); board(18, -5.8, 0, Math.PI / 2); board(18, 5.8, 0, -Math.PI / 2);
    // 맞은편 벽의 엔드 깃발 (엔드마다 색·글자가 다름)
    const fc = document.createElement('canvas'); fc.width = 512; fc.height = 128; this.flagCv = fc;
    this.flagTex = new THREE.CanvasTexture(fc);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: this.flagTex, transparent: true, depthWrite: false }));
    flag.position.set(0, 1.25, -9.36); S.add(flag);   // 맞은편 LED판 바로 위

    // 관중석: 계단식 좌석 + 여러 색 관중 (InstancedMesh)
    const stand = new THREE.MeshStandardMaterial({ color: ARENA.STAND, roughness: 0.9 });
    this.farStand = new THREE.MeshStandardMaterial({ color: ARENA.STAND, roughness: 0.9 });   // 맞은편 관중석 (엔드마다 색이 다름)
    const tiers = [];
    for (let r = 0; r < 5; r++) {
      const y = 0.6 + r * 0.5;
      tiers.push({ x0: -10, x1: 10, z: -10.8 - r * 0.8, y, ax: 'x' });
      tiers.push({ x0: -9, x1: 3, z: -8.2 - r * 0.8, y, ax: 'zL' });
      tiers.push({ x0: -9, x1: 3, z: 8.2 + r * 0.8, y, ax: 'zR' });
      const st = new THREE.Mesh(new THREE.BoxGeometry(21, 0.5, 0.8), this.farStand); st.position.set(0, y - 0.28, -10.8 - r * 0.8); S.add(st);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 12.4), stand); s2.position.set(-8.2 - r * 0.8, y - 0.28, -3); S.add(s2);
      const s3 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 12.4), stand); s3.position.set(8.2 + r * 0.8, y - 0.28, -3); S.add(s3);
    }
    const seats = [];
    for (const t of tiers) for (let u = t.x0; u <= t.x1; u += 0.62) {
      if (Math.random() < 0.12) continue;   // 빈자리
      if (t.ax === 'x') seats.push([u + (Math.random() - 0.5) * 0.15, t.y, t.z]);
      else seats.push([t.ax === 'zL' ? t.z : t.z, t.y, u + (Math.random() - 0.5) * 0.15]);
    }
    const geo = new THREE.CapsuleGeometry(0.13, 0.26, 3, 6);
    const crowd = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), seats.length);
    const col = new THREE.Color(), m4 = new THREE.Matrix4();
    seats.forEach((s, i) => {
      m4.makeTranslation(s[0], s[1] + 0.26, s[2]); crowd.setMatrixAt(i, m4);
      col.setHSL(Math.random(), ARENA.CROWD_S, ARENA.CROWD_L * (0.8 + Math.random() * 0.3)); crowd.setColorAt(i, col);
    });
    S.add(crowd); this.crowd = crowd; this.seats = seats; this.seatPhase = seats.map(() => Math.random() * 6.28);
  }

  buildCourt() {
    const C = C3.COURT, S = this.scene;
    // 바깥 매트(어두운 초록) + 라인 안쪽 코트(밝은 초록) — 경계가 한눈에 보이게
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(C.HALF_W_D * 2 + 2.0, C.HALF_LEN * 2 + 3.4), new THREE.MeshStandardMaterial({ color: ARENA.MAT, roughness: 0.8 }));
    mat.rotation.x = -Math.PI / 2; mat.position.y = -0.001; mat.receiveShadow = true; S.add(mat);
    const court = new THREE.Mesh(new THREE.PlaneGeometry(C.HALF_W_D * 2, C.HALF_LEN * 2), new THREE.MeshStandardMaterial({ color: ARENA.COURT, roughness: 0.72 }));
    court.rotation.x = -Math.PI / 2; court.receiveShadow = true; S.add(court);
    // 단식 코트(인 구역)를 살짝 밝게
    const singles = new THREE.Mesh(new THREE.PlaneGeometry(C.HALF_W_S * 2, C.HALF_LEN * 2), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.045, depthWrite: false }));
    singles.rotation.x = -Math.PI / 2; singles.position.y = 0.001; S.add(singles);
    const lm = new THREE.MeshBasicMaterial({ color: ARENA.LINE });
    const line = (x0, z0, x1, z1) => {   // 라인 폭 40mm, 라인 바깥 가장자리가 경계
      const w = C.LINE_W, len = Math.hypot(x1 - x0, z1 - z0) + w;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x0 === x1 ? w : len, x0 === x1 ? len : w), lm);
      m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.003, (z0 + z1) / 2); S.add(m);
    };
    const L = C.HALF_LEN, D = C.HALF_W_D, Sg = C.HALF_W_S, w2 = C.LINE_W / 2;
    for (const s of [-1, 1]) {
      line(-D, s * (L - w2), D, s * (L - w2));
      line(-D, s * (C.LONG_SVC_D + w2), D, s * (C.LONG_SVC_D + w2));
      line(-D, s * (C.SHORT_SVC + w2), D, s * (C.SHORT_SVC + w2));
      line(0, s * C.SHORT_SVC, 0, s * L);
      line(s * (D - w2), -L, s * (D - w2), L);
      line(s * (Sg - w2), -L, s * (Sg - w2), L);
    }
  }

  buildNet() {
    const C = C3.COURT, g = new THREE.Group(); this.netGroup = g;
    const postM = new THREE.MeshStandardMaterial({ color: 0xFFD23F, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, C.NET_H_POST, 10), postM);
      p.position.set(s * C.HALF_W_D, C.NET_H_POST / 2, 0); p.castShadow = true; this.scene.add(p);
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'); x.strokeStyle = 'rgba(235,238,245,0.6)'; x.lineWidth = 3;
    for (let i = 0; i <= 64; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.moveTo(0, i); x.lineTo(64, i); x.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(160, 19);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(C.HALF_W_D * 2, 0.76), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    net.position.set(0, C.NET_H_CENTER - 0.38, 0); g.add(net);
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(C.HALF_W_D * 2, 0.76), new THREE.MeshBasicMaterial({ color: 0x10123A, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    shade.position.copy(net.position); g.add(shade);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(C.HALF_W_D * 2, 0.075, 0.02), new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
    tape.position.set(0, C.NET_H_CENTER - 0.0375, 0); g.add(tape);
    this.scene.add(g);
    const floorLine = new THREE.Mesh(new THREE.PlaneGeometry(C.HALF_W_D * 2, 0.05), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.35 }));
    floorLine.rotation.x = -Math.PI / 2; floorLine.position.y = 0.004; this.scene.add(floorLine);
  }

  buildShuttle() {
    // 실제 셔틀은 약 7cm — 중계 시점에선 안 보여서 화면용으로 2.8배 키움 [게임]
    const g = new THREE.Group(), K = 2.8;
    const cork = new THREE.Mesh(new THREE.SphereGeometry(0.013 * K, 12, 10), new THREE.MeshStandardMaterial({ color: 0xFFB13B, emissive: 0x552200 }));
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.033 * K, 0.06 * K, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xFFFFFF, emissive: 0x333333, side: THREE.DoubleSide, roughness: 0.6 }));
    skirt.rotation.x = Math.PI / 2; skirt.position.z = -0.03 * K;   // lookAt은 +z를 진행 방향으로 → 코르크가 앞
    g.add(cork, skirt); this.scene.add(g); this.shuttle = g;
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.radialTex([[0, 'rgba(255,245,210,0.95)'], [0.35, 'rgba(255,215,120,0.4)'], [1, 'rgba(255,215,120,0)']]), depthWrite: false, transparent: true }));
    this.glow.scale.set(0.45, 0.45, 1); this.scene.add(this.glow);
    this.drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -1, 0)]), new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.4 }));
    this.drop.frustumCulled = false; this.scene.add(this.drop);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.radialTex([[0, 'rgba(0,0,0,0.85)'], [0.5, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.006; this.scene.add(this.shadow);
    // 잔상: 속도에 따라 노랑 → 주황 → 빨강
    this.trailN = 22; this.trailPts = [];
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.trailN * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.trailN * 3), 3));
    this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
    this.trail.frustumCulled = false; this.scene.add(this.trail);
  }

  buildHelpers() {
    const ag = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -9)]);
    this.aim = new THREE.Line(ag, new THREE.LineDashedMaterial({ color: 0xFFFFFF, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.6 }));
    this.aim.computeLineDistances(); this.aim.position.y = 0.01; this.scene.add(this.aim);
    // 마우스 조준점 (상대 코트 위 십자 원)
    const ag2 = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0xFF7A45, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.9, depthWrite: false }));
    const crossG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.42, 0, 0), new THREE.Vector3(-0.18, 0, 0), new THREE.Vector3(0.18, 0, 0), new THREE.Vector3(0.42, 0, 0), new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(0, 0.18, 0), new THREE.Vector3(0, -0.18, 0), new THREE.Vector3(0, -0.42, 0)]);
    const cross = new THREE.LineSegments(crossG, new THREE.LineBasicMaterial({ color: 0xFF7A45 }));
    ag2.add(ring, dot, cross); ag2.rotation.x = -Math.PI / 2; ag2.scale.set(1.9, 1.9, 1); ag2.position.y = 0.013; ag2.visible = false; this.scene.add(ag2); this.aimMark = ag2;   // 먼 코트에서도 보이게 크게
    this._ray = new THREE.Raycaster(); this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); this._hit = new THREE.Vector3(); this._ndc = new THREE.Vector2();
    this.landRing = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 28), new THREE.MeshBasicMaterial({ color: 0x34C08B, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    this.landRing.rotation.x = -Math.PI / 2; this.landRing.position.y = 0.008; this.landRing.visible = false; this.scene.add(this.landRing);
    this.pathN = 90;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pathN * 3), 3));
    this.path = new THREE.Line(pg, new THREE.LineDashedMaterial({ color: 0xFFE3A3, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.6 }));
    this.path.frustumCulled = false; this.path.visible = false; this.scene.add(this.path);
    // 선수 발밑 표시 (내 선수 = 주황, 상대 = 보라)
    const mk = col => { const m = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 36), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.007; this.scene.add(m); return m; };
    this.meRing = mk(C3.COLORS.me); this.oppRing = mk(C3.COLORS.opp);
    // 근력 훈련 표적 (노란 사각형)
    const tg = new THREE.Group();
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xFFD23F, transparent: true, opacity: 0.22, depthWrite: false }));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), new THREE.LineBasicMaterial({ color: 0xFFD23F }));
    tg.add(fill, edge); tg.rotation.x = -Math.PI / 2; tg.position.y = 0.011; tg.visible = false; this.scene.add(tg); this.target = tg; this.targetFill = fill;
    // 런지 리치 표시: 런지 중 늘어난 팔 범위
    this.reachRing = mk(0xFFE08A); this.reachRing.material.opacity = 0; this.reachRing.scale.set(2.2, 2.2, 1);
  }

  // ───── 심판: 네트 옆 높은 의자 [게임 연출 — 실제 주심 자리(네트 연장선 코트 옆)를 참고] ─────
  buildUmpire() {
    const g = new THREE.Group(), C = C3.COURT;
    const metal = new THREE.MeshStandardMaterial({ color: 0xC9CED8, roughness: 0.35, metalness: 0.6 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x2C3150, roughness: 0.7 });
    const SEAT = 1.55;
    for (const [dx, dz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {   // 다리
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, SEAT, 8), metal); l.position.set(dx, SEAT / 2, dz); l.castShadow = true; g.add(l);
    }
    for (const y of [0.45, 1.0]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.05), metal); r.position.set(0.28, y, 0); r.rotation.y = Math.PI / 2; g.add(r); }   // 발판
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.7), wood); seat.position.y = SEAT; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.62), wood); back.position.set(0.33, SEAT + 0.3, 0); g.add(back);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.7), wood); desk.position.set(-0.36, SEAT - 0.05, 0); g.add(desk);
    // 사람 (코트 쪽 = -x 를 봄)
    const shirt = new THREE.MeshStandardMaterial({ color: 0x1F2B4A, roughness: 0.7 }), skin = new THREE.MeshStandardMaterial({ color: 0xE8B894, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), shirt); body.position.set(0.08, SEAT + 0.42, 0); body.castShadow = true; g.add(body);
    const head = new THREE.Group(); head.position.set(0.06, SEAT + 0.92, 0); g.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), skin));
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2A2A2A })); hair.position.y = 0.01; head.add(hair);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.32), new THREE.MeshStandardMaterial({ color: 0x23232E })); legs.position.set(-0.1, SEAT + 0.1, 0); g.add(legs);
    // 팔: 어깨에서 회전 (+z쪽 = 내 코트 방향 팔, -z쪽 = 상대 코트 방향 팔)
    const arm = side => {
      const a = new THREE.Group(); a.position.set(0.08, SEAT + 0.6, side * 0.22);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.42, 3, 8), shirt); m.position.y = -0.26; a.add(m);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin); hand.position.y = -0.52; a.add(hand);
      g.add(a); return a;
    };
    this.ump = { g, head, armMe: arm(1), armOpp: arm(-1), side: null, t: 0 };
    g.position.set(C.HALF_W_D + 1.25, 0, 0);
    this.scene.add(g);
  }
  // 득점한 쪽 코트를 향해 팔을 번쩍 들고 고개를 돌림
  umpireSignal(winner) { if (this.ump) { this.ump.side = winner; this.ump.t = 1.5; } }
  updateUmpire(dt) {
    const u = this.ump; if (!u) return;
    u.t = Math.max(0, u.t - dt);
    const up = u.t > 0 ? Math.min(1, (1.5 - u.t) / 0.15, u.t / 0.3) : 0;
    const tgtMe = u.side === 'me' ? up : 0, tgtOpp = u.side === 'opp' ? up : 0;
    // 팔을 옆·위로: x축 회전(앞뒤 = z 방향)으로 들어 올림
    u.armMe.rotation.x = -tgtMe * 2.5 + Math.sin(this.time * 1.3) * 0.02;
    u.armOpp.rotation.x = tgtOpp * 2.5 - Math.sin(this.time * 1.3) * 0.02;
    const look = u.t > 0 ? (u.side === 'me' ? 0.6 : -0.6) * Math.min(1, u.t / 0.3) : Math.sin(this.time * 0.6) * 0.15;
    u.head.rotation.y += (Math.PI / 2 - look - u.head.rotation.y) * Math.min(1, dt * 8);
  }

  // 화면 안쪽(맞은편) 엔드 배경: 0 = A, 1 = B
  setEnd(far) {
    const E = ENDS[far] || ENDS[1];
    this.farEnd = far;
    this.scene.background = this.gradientTex(E.BG_TOP, E.BG_BOTTOM);
    this.farStand.color.setHex(E.STAND); this.farLed.color.setHex(E.LED);
    this.rimA.color.setHex(E.RIM_A); this.rimB.color.setHex(E.RIM_B);
    const x = this.flagCv.getContext('2d'); x.clearRect(0, 0, 512, 128);
    x.fillStyle = 'rgba(10,12,30,0.7)'; x.fillRect(0, 14, 512, 100);
    x.fillStyle = E.FLAG; x.fillRect(0, 14, 512, 8); x.fillRect(0, 106, 512, 8);
    x.font = 'bold 58px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = E.FLAG;
    x.fillText('END ' + E.name, 256, 66);
    this.flagTex.needsUpdate = true;
  }

  // ───── 이펙트 ─────
  buildFx() {
    // 불꽃 파티클 풀
    this.pN = 420; this.pLife = new Float32Array(this.pN); this.pVel = new Float32Array(this.pN * 3); this.pNext = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pN * 3).fill(-99), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.pN * 3), 3));
    this.sparks = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, map: this.radialTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]) }));
    this.sparks.frustumCulled = false; this.scene.add(this.sparks);
    // 충격파 링(공중) · 파문(바닥)
    const ringTex = this.radialTex([[0, 'rgba(255,255,255,0)'], [0.62, 'rgba(255,255,255,0)'], [0.78, 'rgba(255,255,255,1)'], [0.92, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]);
    this.shocks = [...Array(6)].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.visible = false; this.scene.add(s); return { s, t: 0, d: 0.3, max: 1 }; });
    this.ripples = [...Array(4)].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.visible = false; this.scene.add(m); return { m, t: 0, d: 0.6, max: 1 }; });
  }

  burst(p, color, power) {   // power 0~1
    const c = new THREE.Color(color), w = new THREE.Color(0xFFFFFF);
    const n = Math.round(14 + power * 46);
    const pos = this.sparks.geometry.attributes.position.array, col = this.sparks.geometry.attributes.color.array;
    for (let k = 0; k < n; k++) {
      const i = this.pNext; this.pNext = (this.pNext + 1) % this.pN;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      const sp = 1.2 + Math.random() * (2 + power * 5), th = Math.random() * 6.28, ph = Math.acos(2 * Math.random() - 1);
      this.pVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp; this.pVel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp * 0.8 + 0.5; this.pVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      this.pLife[i] = 0.35 + Math.random() * 0.35;
      const cc = Math.random() < 0.35 ? w : c; col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
  }
  shock(p, color, size) {
    const o = this.shocks.find(x => !x.s.visible) || this.shocks[0];
    o.s.visible = true; o.s.position.set(p.x, p.y, p.z); o.s.material.color.setHex(color); o.t = 0; o.d = 0.28; o.max = size;
  }
  ripple(p, color, size) {
    const o = this.ripples.find(x => !x.m.visible) || this.ripples[0];
    o.m.visible = true; o.m.position.set(p.x, 0.012, p.z); o.m.material.color.setHex(color); o.t = 0; o.d = 0.55; o.max = size;
  }
  shake(a) { this.shakeA = Math.max(this.shakeA, a); }
  dust(pos, dir) {   // 런지 발 구름 효과
    this.ripple({ x: pos.x + dir.x * 0.5, z: pos.z + dir.z * 0.5 }, 0xD8DEEA, 0.7);
    this.burst({ x: pos.x + dir.x * 0.4, y: 0.05, z: pos.z + dir.z * 0.4 }, 0xE8ECF5, 0);
  }
  setMarkers(me, opp, extK, ready) {
    this.meRing.position.set(me.pos.x, 0.007, me.pos.z); this.oppRing.position.set(opp.pos.x, 0.007, opp.pos.z);
    this.meRing.material.opacity = ready ? 0.6 : 0.3;
    this.reachRing.position.set(me.pos.x, 0.008, me.pos.z); this.reachRing.material.opacity = 0.45 * extK;
  }
  punch(dFov) { this.fovKick = dFov; }
  netWobble() { this.netT = 0.6; }
  cheer(a) { this.cheerT = 1.6; this.cheerA = a; this.ledBoost = 1.2; }

  updateFx(dt) {
    this.time += dt;
    // 파티클
    const pos = this.sparks.geometry.attributes.position.array;
    for (let i = 0; i < this.pN; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) { pos[i * 3 + 1] = -99; continue; }
      this.pVel[i * 3 + 1] -= 6 * dt;
      pos[i * 3] += this.pVel[i * 3] * dt; pos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt; pos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.01) { pos[i * 3 + 1] = 0.01; this.pVel[i * 3 + 1] *= -0.3; }
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    for (const o of this.shocks) if (o.s.visible) {
      o.t += dt; const k = o.t / o.d;
      if (k >= 1) { o.s.visible = false; continue; }
      const sc = 0.15 + o.max * k; o.s.scale.set(sc, sc, 1); o.s.material.opacity = 1 - k;
    }
    for (const o of this.ripples) if (o.m.visible) {
      o.t += dt; const k = o.t / o.d;
      if (k >= 1) { o.m.visible = false; continue; }
      const sc = 0.1 + o.max * k; o.m.scale.set(sc, sc, 1); o.m.material.opacity = 0.9 * (1 - k);
    }
    if (this.target.visible) this.targetFill.material.opacity = 0.16 + 0.1 * Math.sin(this.time * 6);
    this.updateUmpire(dt);
    // 네트 흔들림
    if (this.netT > 0) { this.netT -= dt; this.netGroup.position.z = Math.sin(this.netT * 40) * 0.05 * Math.max(0, this.netT / 0.6); }
    // LED 흐름 (득점 직후 빨라짐)
    this.ledBoost = Math.max(0, this.ledBoost - dt);
    for (const t of this.boards) t.offset.x -= dt * (0.04 + this.ledBoost * 0.5);
    // 관중: 평소엔 살짝, 환호 땐 뛰기
    this.cheerT = Math.max(0, this.cheerT - dt);
    const amp = 0.025 + (this.cheerT > 0 ? this.cheerA * 0.22 * Math.min(1, this.cheerT) : 0), sp = this.cheerT > 0 ? 14 : 2.2;
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i], y = s[1] + 0.26 + Math.max(0, Math.sin(this.time * sp + this.seatPhase[i])) * amp;
      m4.makeTranslation(s[0], y, s[2]); this.crowd.setMatrixAt(i, m4);
    }
    this.crowd.instanceMatrix.needsUpdate = true;
  }

  // ───── 매 프레임 ─────
  setShuttle(p, v, visible) {
    const s = this.shuttle; s.visible = visible;
    s.position.set(p.x, p.y, p.z);
    const sp = Math.hypot(v.x, v.y, v.z);
    if (sp > 0.3) s.lookAt(p.x + v.x, p.y + v.y, p.z + v.z);
    const h = Math.max(0, p.y), sc = 0.22 + h * 0.05;
    this.glow.visible = visible; this.glow.position.set(p.x, p.y, p.z);
    const gs = 0.45 + Math.min(0.5, sp / 60); this.glow.scale.set(gs, gs, 1);
    // 그림자·수직선은 끌 수 있음 (G) — 끄면 인/아웃을 눈으로 판단해야 함
    this.drop.visible = visible && this.shadowOn && h > 0.05; this.drop.position.set(p.x, p.y, p.z); this.drop.scale.set(1, h, 1);
    this.shadow.visible = visible && this.shadowOn;
    this.shadow.position.set(p.x, 0.006, p.z); this.shadow.scale.set(sc, sc, 1);
    this.shadow.material.opacity = Math.max(0.45, 1 - h * 0.07);
    // 잔상
    this.trailPts.unshift([p.x, p.y, p.z]); this.trailPts.length = Math.min(this.trailPts.length, this.trailN);
    const arr = this.trail.geometry.attributes.position.array, col = this.trail.geometry.attributes.color.array;
    const heat = Math.min(1, sp / 40), c = new THREE.Color().setHSL(0.14 - 0.14 * heat, 1, 0.6);
    for (let i = 0; i < this.trailN; i++) {
      const q = this.trailPts[Math.min(i, this.trailPts.length - 1)]; arr.set(q, i * 3);
      const f = 1 - i / this.trailN; col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f;
    }
    this.trail.geometry.attributes.position.needsUpdate = true; this.trail.geometry.attributes.color.needsUpdate = true;
    this.trail.visible = visible && sp > 9;
    // 스매시 직후: 셔틀 빛을 크게, 꼬리를 하얗게
    this.smashT = Math.max(0, (this.smashT || 0) - 0.016);
    if (this.smashT > 0 && sp > 9) { const g2 = 0.45 + 0.9 * Math.min(1, this.smashT); this.glow.scale.set(g2, g2, 1); this.trail.material.opacity = 1; }
    else this.trail.material.opacity = 0.85;
  }
  clearTrail() { this.trailPts = []; }
  setShadowOn(on) { this.shadowOn = on; }
  smashTrail(t) { this.smashT = t; }
  setTarget(t) { this.target.visible = !!t; if (t) { this.target.position.set(t.x, 0.011, t.z); this.target.scale.set(t.w, t.h, 1); } }

  // 조준선: pt가 있으면 선수 → 조준점까지, 없으면(서브) 방향만
  setAim(x, z, yaw, visible, pt) {
    this.aim.visible = visible; this.aim.position.set(x, 0.01, z);
    this.aimMark.visible = visible && !!pt;
    if (pt) {
      const dx = pt.x - x, dz = pt.z - z, L = Math.hypot(dx, dz);
      this.aim.rotation.y = -Math.atan2(dx, -dz); this.aim.scale.set(1, 1, L / 9);
      this.aimMark.position.set(pt.x, 0.013, pt.z);
    } else { this.aim.rotation.y = -yaw; this.aim.scale.set(1, 1, 1); }
  }
  // 화면 좌표(-1~1) → 바닥(y=0) 위의 점
  floorPoint(nx, ny) {
    this._ndc.set(nx, ny); this._ray.setFromCamera(this._ndc, this.camera);
    return this._ray.ray.intersectPlane(this._plane, this._hit) ? { x: this._hit.x, z: this._hit.z } : null;
  }
  setPath(pts) {
    this.path.visible = !!pts;
    if (!pts) return;
    const arr = this.path.geometry.attributes.position.array, n = this.pathN, step = Math.max(1, Math.floor(pts.length / n));
    for (let i = 0; i < n; i++) { const q = pts[Math.min(pts.length - 1, i * step)]; arr[i * 3] = q.x; arr[i * 3 + 1] = Math.max(0.01, q.y); arr[i * 3 + 2] = q.z; }
    this.path.geometry.attributes.position.needsUpdate = true; this.path.computeLineDistances();
  }
  setLanding(p, color, alpha = 0.7, size = 1) {
    this.landRing.visible = !!p;
    if (p) { this.landRing.position.set(p.x, 0.008, p.z); this.landRing.material.color.setHex(color); this.landRing.material.opacity = alpha; this.landRing.scale.set(size, size, 1); }
  }

  // 카메라: 플레이어를 따라가고, 셔틀 쪽으로 살짝 시선 이동 + 흔들림·줌 펀치
  followCamera(px, dt, pz, sp) {
    const k = Math.min(1, dt * 3), tx = this.camBase.x + px * 0.25, tz = this.camBase.z + ((pz || 3) - 3) * 0.2;
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.position.y += (this.camBase.y - this.camera.position.y) * k;
    const lx = this.camLook.x + px * 0.15 + (sp ? sp.x * 0.12 : 0), lz = this.camLook.z + (sp ? sp.z * 0.06 : 0), ly = this.camLook.y + (sp ? Math.min(3, sp.y) * 0.04 : 0);
    this.lookCur.x += (lx - this.lookCur.x) * Math.min(1, dt * 4); this.lookCur.y += (ly - this.lookCur.y) * Math.min(1, dt * 4); this.lookCur.z += (lz - this.lookCur.z) * Math.min(1, dt * 4);
    this.shakeA *= Math.exp(-dt * 9);
    const sx = (Math.random() - 0.5) * this.shakeA, sy = (Math.random() - 0.5) * this.shakeA;
    this.camera.position.x += sx; this.camera.position.y += sy;
    this.fovKick *= Math.exp(-dt * 7);
    this.camera.lookAt(this.lookCur);
    this.camera.updateMatrixWorld();
    // 자동 구도: '꼭 보여야 할 점'(내 코트 맨 뒤·상대 베이스라인·높이 뜬 셔틀)의 위아래 범위를
    // 화면 세로 가운데로 맞추고(카메라를 위아래로 살짝 기울임), 그 범위가 꼭 들어가는 최소 화각을 씀
    let lo = 1e9, hi = -1e9, needX = 0;
    const pts = sp && sp.y < 9 ? [...this.mustSee, this._sp.set(sp.x, Math.min(sp.y + 0.3, 7), sp.z)] : this.mustSee;
    for (const q of pts) {
      const v = this._v.copy(q).applyMatrix4(this.camera.matrixWorldInverse), d = Math.max(0.1, -v.z);
      const ay = Math.atan(v.y / d); lo = Math.min(lo, ay); hi = Math.max(hi, ay);
      needX = Math.max(needX, Math.abs(v.x) / d);
    }
    const tiltT = (hi + lo) / 2, halfY = (hi - lo) / 2;
    const halfX = Math.atan(needX / this.camera.aspect);
    const fovNeed = Math.max(30, Math.min(70, 2 * Math.max(halfY, halfX) * 1.08 * 180 / Math.PI));
    const kk = this.fitInit ? Math.min(1, dt * 2.5) : 1; this.fitInit = true;
    this.fitFov += (fovNeed - this.fitFov) * kk; this.tilt += (tiltT - this.tilt) * kk;
    this.camera.rotateX(this.tilt); this.camera.updateMatrixWorld();
    this.camera.fov = this.fitFov + this.fovKick; this.camera.updateProjectionMatrix();
  }
  render() { this.renderer.render(this.scene, this.camera); }
  dispose() { window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }
}
