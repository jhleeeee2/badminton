// court3d/config.js — 3D 코트 설정. 단위: 미터(m), 초(s)
// [규격] = BWF 경기 규칙 수치 · [근사] = 실측 연구의 대략값 · [게임] = 게임용으로 정한 값
// 좌표: x = 좌우(플레이어 기준 오른쪽 +), y = 높이, z = 앞뒤(네트 z=0, 플레이어 코트 z>0, AI 코트 z<0)

const C3 = Object.freeze({
  COURT: Object.freeze({                 // [규격]
    HALF_LEN: 6.70,          // 네트 ~ 베이스라인 (전체 13.40)
    HALF_W_S: 2.59,          // 단식 사이드라인 (폭 5.18)
    HALF_W_D: 3.05,          // 복식 사이드라인 (폭 6.10), 네트 기둥 위치
    SHORT_SVC: 1.98,         // 숏 서비스 라인 (네트에서)
    LONG_SVC_D: 5.94,        // 복식 롱 서비스 라인 (베이스라인 0.76m 안쪽)
    NET_H_CENTER: 1.524,     // 네트 높이 (중앙)
    NET_H_POST: 1.55,        // 네트 높이 (기둥)
    LINE_W: 0.04             // 라인 폭 40mm (라인은 안쪽으로 판정)
  }),
  SERVE_MAX_H: 1.15,         // [규격] 서브 타점은 1.15m 아래

  PHYS: Object.freeze({
    G: 9.81,
    VT: 6.5,                 // [근사→게임] 실측 종단속도 약 6.7~6.9 m/s, 게임에선 6.5로 살짝 낮춰 '쭉 솟았다가 뚝 떨어지는' 모양을 조금 더 강조
    STEP: 1 / 240            // 고정 시간 간격(결정론적 계산, 온라인 동기화 대비)
  }),
  GAME_SPEED: 0.72,           // [게임] 전체 시간 배율 (실제 속도는 사람이 반응하기엔 너무 빠름) — 0.78 → 0.72

  // 슬로우: 셔틀이 "라켓 든 팔의 어깨"에서 RADIUS 안으로 들어오면 게임 전체가 느려짐
  // (모든 선수에게 같은 규칙 → 온라인에서도 양쪽 화면에 동시에 같은 시점으로 적용 가능)
  SLOW: Object.freeze({ RADIUS: 1.25, TRAIN_RADIUS: 0.8, SCALE: 0.25, IN_RATE: 18, OUT_RATE: 8, ON_AI: true }),   // 라켓 팔 바로 옆(리치 1.2m + 0.2m)에서만   // [게임]
  // 랠리 템포: 랠리(타구 수)가 START를 넘으면 한 타마다 게임 속도 +SPEED_STEP (최대 SPEED_MAX),
  //           슬로우 범위는 −SLOW_STEP 비율씩 줄어듦 (최소 SLOW_MIN배). 훈련에는 적용 안 함   // [게임]
  RALLY_TEMPO: Object.freeze({ START: 3, SPEED_STEP: 0.03, SPEED_MAX: 1.4, SLOW_STEP: 0.04, SLOW_MIN: 0.55 }),

  // 충전: 현실 시간 기준 (슬로우 중에도 같은 속도로 차오름)
  CHARGE: Object.freeze({ TIME: 0.65, MAX: 1.35, FAULT: 1.15, SERVE_NET: 0.1, SERVE_CYCLE: 0.85 }),   // SERVE_CYCLE: 서브 게이지 0→최대 한 번 가는 시간             // [게임]

  BODY: Object.freeze({                  // [게임] (사람 체격·라켓 길이는 실제와 비슷하게)
    SHOULDER_H: 1.38, SHOULDER_X: 0.19,  // 어깨 높이·옆 거리 (몸 모델과 맞춤)
    RACKET: 0.66,                        // 라켓 최대 길이 규정 680mm [규격]
    REACH: 1.28,                         // 어깨~라켓 판정 (몸 모델 팔 길이는 그대로, 판정만 1.2 → 1.28로 넉넉히)
    // Shift 런지: 셔틀 쪽(또는 이동키 방향)으로 한 발 크게 내딛으며 팔을 뻗음
    EXT_REACH: 0.45, EXT_TIME: 0.34,     // 리치 증가·지속
    EXT_LUNGE: 1.15,                     // 내딛는 거리 (앞 60% 시간에 이동)
    EXT_RECOVER: 0.2, EXT_RECOVER_MUL: 0.6,     // 뻗은 뒤 회복 시간·이동속도 배율
    EXT_COOL: 0.45,                      // 회복 끝난 뒤 다시 쓸 수 있을 때까지
    SPEED: 4.6, ACCEL: 28,               // 이동 최고속도·가속
    JUMP_V: 3.1,                         // 점프 초기속도 (약 0.5m)
    SWING_TIME: 0.34, HIT_WINDOW: 0.32   // 스윙 길이, 떼고 나서 맞을 수 있는 시간(게임 시간)
  }),

  // 샷: 충전량 c(0~1)에 따라 깊이(네트에서 상대 코트 안쪽 거리)와 발사각이 정해짐  [게임]
  SHOTS: Object.freeze({
    lift:  { key: 'Q',  depth: [1.2, 6.2], angle: [45, 34], netFix: 20, aimMin: 0.9, aimMax: 7.2 },   // 올리기: 헤어핀/리프트 → 클리어
    down:  { key: 'E',  depth: [1.4, 4.8], angle: [12, -9], netFix: 10, fixMinH: 1.9, aimMin: 1.0, aimMax: 6.0 },  // 찍기: 드롭 → 스매시 (스매시는 타점 1.9m 이상일 때만 각도 보정)
    flat:  { key: '클릭', depth: [2.2, 6.0], angle: [12, 3], netFix: 6, aimMin: 1.2, aimMax: 7.2 },    // 직선: 푸시 → 드라이브
    serve: { key: 'Q',  depth: [2.15, 6.3], angle: [14, 40], netFix: 20 }   // 서브: 숏 → 롱
  }),
  AIM_MAX: 0.55,                         // (서브) 마우스 좌우 끝 = ±31°
  AIM_YAW_MAX: 0.9,                      // 랠리 조준 최대 각 (±52°) — 커서 아래 바닥 점 방향 [게임]
  ERR: Object.freeze({ YAW: 0.025, DEPTH: 0.18 }),         // 기본 오차 (표준편차)
  BACKHAND: Object.freeze({ DEPTH: 0.8, ERR: 1.8 }),       // 백핸드: 덜 멀리, 오차 큼
  EXTEND: Object.freeze({ DEPTH: 0.92, ERR: 1.15, NET_ERR: 0.55, NET_Z: 2.6 }),   // 런지 중 친 공 / 네트 앞(NET_Z 안) 런지 올리기·직선은 오히려 정확
  OVERHEAD_DY: 0.3, LOW_DY: -0.55,                         // 어깨 기준 머리 위 / 아래 판정
  RTH_RANGE: 0.55,                                         // 라운드 더 헤드 허용 범위

  // [게임] spd 이동, react 반응, err 샷 오차배율, over 과충전 실수, smash 스매시 선택, edge 코너 노리기, jump 점프
  //        misread 위치를 크게 잘못 읽을 확률, chaseOut 아웃될 공을 받아칠 확률, soft 부드러운 플레이(가운데로 높게 띄움) 비율
  // 쉬움은 '엉뚱한 실수가 잦은 AI'가 아니라 '느리고 순한 AI' — 실수는 적고, 대신 공이 순하고 예측 가능
  AI: Object.freeze({
    //        chaseOut: 아웃될 공도 받아치는 확률 (라인 0.35m 안쪽 애매한 공은 +0.3)
    easy:   { spd: 2.15, react: 0.58, err: 1.65, over: 0.03,  smash: 0.05, edge: 0.0,  jump: 0.0,  misread: 0.04,  chaseOut: 0.3,  soft: 0.75 },
    normal: { spd: 2.75, react: 0.43, err: 1.65, over: 0.05,  smash: 0.27, edge: 0.2,  jump: 0.05, misread: 0.05,  chaseOut: 0.25, soft: 0.3 },
    hard:   { spd: 4.0,  react: 0.23, err: 1.2,  over: 0.045, smash: 0.65, edge: 0.65, jump: 0.4,  misread: 0.035, chaseOut: 0.2,  soft: 0 },
    hell:   { spd: 4.5,  react: 0.16, err: 0.95, over: 0.025, smash: 0.75, edge: 0.8,  jump: 0.6,  misread: 0.02,  chaseOut: 0.15, soft: 0 },
    imp:    { spd: 5.0,  react: 0.11, err: 0.72, over: 0.012, smash: 0.83, edge: 0.9,  jump: 0.75, misread: 0.008, chaseOut: 0.1,  soft: 0 }
  }),
  // 보조 표시: path = 궤적 미리보기, land = 낙하 지점, stand = 칠 수 있는 위치
  // 보조 표시 (난이도가 오를수록 줄어듦) [게임]
  //   land: 낙하 지점 표시 / landAt: 비행의 몇 % 지점부터 보여줄지 / landA: 진하기 / landS: 크기 / inout: 인=초록·아웃=빨강 구분
  ASSIST: Object.freeze({
    easy:   { path: true,  stand: true,  land: true,  landAt: 0,    landA: 0.8,  landS: 1.25, inout: true },
    normal: { path: false, stand: true,  land: true,  landAt: 0.2,  landA: 0.65, landS: 1.0,  inout: true },
    hard:   { path: false, stand: false, land: true,  landAt: 0.1,  landA: 0.65, landS: 1.0,  inout: true },   // 낙하 지점은 보이고, 칠 위치(주황 원)·궤적은 안 보임
    hell:   { path: false, stand: false, land: true,  landAt: 0.78, landA: 0.3,  landS: 0.6,  inout: false },
    imp:    { path: false, stand: false, land: false, landAt: 1,    landA: 0,    landS: 0,    inout: false }
  }),

  KITS: Object.freeze({   // 유니폼 [게임]
    me:  { shirt: 0xFF6B3D, accent: 0xFFD23F, shorts: 0x1D3557, hair: 0x2B1D14, shoe: 0xFFD23F },
    opp: { shirt: 0x7B61FF, accent: 0x2EE6D6, shorts: 0x23234A, hair: 0x111111, shoe: 0x2EE6D6 }
  }),
  COLORS: Object.freeze({ me: 0xFF6B3D, opp: 0x8F7BFF, court: 0x2A7053, floor: 0x1B1E25, line: 0xF2F2F2, net: 0x111318, tape: 0xF5F5F5 }),
  KEYS: Object.freeze({ up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', lift: 'KeyQ', smash: 'KeyE', jump: 'Space', ext: ['ShiftLeft', 'ShiftRight'] })
});

const SHOT3_NAMES = { lift: '올리기', down: '찍기', flat: '직선', serve: '서브' };
