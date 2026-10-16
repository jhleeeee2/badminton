// config.js — 모든 상수·밸런스 수치. 숫자 조정은 대부분 이 파일에서 합니다.

// 코트 기하 (Canvas 648×300, 오른쪽 = 플레이어, 왼쪽 = AI)
const COURT = Object.freeze((() => {
  const W = 648, H = 300, GY = 250;
  return {
    W, H, GY,              // GY: 바닥선 y
    NET: W / 2,            // 네트 x
    NETTOP: GY - 62,       // 네트 윗단 y (사람 어깨 정도)
    BASE: GY - 26,         // 셔틀 낙하 기준 y
    STANDY: GY - 54,       // 서서 치는 타점 y
    BL_L: 15, BL_R: W - 15 // 베이스라인
  };
})());

// 물리
const PHYS = Object.freeze({
  GACC: 520,   // 셔틀 중력
  GRAV: 1150,  // 선수 점프 중력
  JUMP: 430    // 점프 초기속도
});

// 선수 움직임
const MOVE = Object.freeze({
  SPEED: 310,          // 플레이어 이동속도
  CROUCH_SPEED: 0.45,  // 앉았을 때 이동 배율
  DASHV: 580,          // 대쉬 속도
  DASH_TIME: 0.16,
  REACH: 58,           // 히트박스
  CROUCH_REACH: 26,    // 앉기 시 추가 리치
  SWING_TIME: 0.18
});

// 파워 = 1 + 타점높이/HEIGHT_DIV + 전진/후진 + 대쉬, 최소 MIN
const POWER = Object.freeze({
  HEIGHT_DIV: 85,
  FORWARD: 0.45,
  BACKWARD: -0.25,     // 플레이어 후진 타격
  AI_BACKWARD: -0.2,   // AI 후진 타격 (기존 코드 값 그대로)
  DASH_FWD: 0.25,
  DASH_BACK: -0.1,
  MIN: 0.7,
  CROUCH: 0.95         // 앉아서 받으면 고정
});

// 플레이어 서브: 게이지 p — 길게 누를수록 멀리
//   p < NET_FAULT_P          → 너무 약함: 네트에 걸림 (실점)
//   NET_FAULT_P ~ 1          → 정상: 0쪽 = 네트 앞 낮은 숏서브, 1 = 베이스라인 근처 높은 롱서브
//   1 ~ OUT_P                → 가득 찬 뒤 여유 구간 (롱서브 유지)
//   p > OUT_P                → 너무 김: 베이스라인 밖 아웃 (실점)
const SERVE = Object.freeze({
  CHARGE_TIME: 0.9,    // 게이지 0→1 시간(초). 계속 누르면 P_MAX까지 더 올라감
  P_MAX: 1.4,
  NET_FAULT_P: 0.12,   // 이보다 짧으면 네트 (약 0.11초 미만 누름)
  OUT_P: 1.2,          // 이보다 길면 아웃 (약 1.08초 초과 누름)
  DUR_FAULT: 0.45,     // 네트 실패 시 비행시간(낮고 짧게)
  OUT_OVER: 6,         // 아웃 시 베이스라인 밖으로 나가는 기본 거리(px)
  OUT_SLOPE: 60,       // 더 오래 누를수록 더 멀리 아웃
  SHORT_X: 70,         // p=0 낙하점: 네트에서 왼쪽으로 70px
  LONG_X: 28,          // p=1 낙하점: 왼쪽 베이스라인에서 안쪽으로 28px
  JITTER: 24,          // 낙하점 랜덤 오차 폭
  DUR_SHORT: 0.75,     // p=0 비행시간
  DUR_LONG: 1.6,       // p=1 비행시간 (높게 뜸)
  AI_POWER_SHORT: 1.4, // AI가 받기 어려운 정도(파워 환산): 숏서브가 더 까다로움
  AI_POWER_LONG: 1.0
});

const HOME =Object.freeze({ player: 520, ai: 140 });

const COLORS = Object.freeze({
  court: '#9C9FA8', me: '#FF7A45', opp: '#8D85F0', ok: '#34C08B', warn: '#F2A93B',
  bad: '#E25B5A', shuttle: '#F2A93B', feather: '#ECEDEF', text: '#A6A9B3', dim: '#73767F'
});

const SHOT_NAMES = Object.freeze({ clear: '클리어', drive: '드라이브', hairpin: '헤어핀', drop: '드롭', smash: '스매시' });

// 플레이어 삑사리 [기본, 저타점 가중, 최대]
const MISHIT_TBL = Object.freeze({
  smash: [0.03, 0.08, 0.11], drive: [0.02, 0.04, 0.06], hairpin: [0.015, 0.025, 0.04],
  drop: [0.012, 0.018, 0.03], clear: [0.006, 0.009, 0.015]
});

// AI 삑사리 = 난이도 mh × 샷별 가중치
const AI_MISHIT_W = Object.freeze({ smash: 1, drive: 0.6, hairpin: 0.4, drop: 0.3, clear: 0.15 });

/* 난이도
   spd 이동속도 · react/reactR 반응시간(기본+랜덤) · err/errP 위치 오차(기본+파워비례)
   mis 오판(오차×3) · jfail 점프 실패 · safe 안전샷 확률 · smash 높은 공 스매시 선택
   rT/rK/rC 반사신경 한계(파워 임계·기울기·상한) · mh 삑사리 · hp 헤어핀 못 받음
   sharp 예리한 각 스매시(70%) */
const DIFFS = Object.freeze({
  easy:   { spd: 148, react: 0.5,   reactR: 0.25,  err: 55, errP: 150, mis: 0.4,   jfail: 0.6,   safe: 0.45, smash: 0.15, rT: 1.2,  rK: 0.6,  rC: 0.5,   mh: 0.14, hp: 0.45, sharp: false },
  normal: { spd: 205, react: 0.28,  reactR: 0.16,  err: 28, errP: 95,  mis: 0.22,  jfail: 0.32,  safe: 0.68, smash: 0.4,  rT: 1.5,  rK: 0.45, rC: 0.3,   mh: 0.08, hp: 0.3,  sharp: false },
  hard:   { spd: 252, react: 0.15,  reactR: 0.1,   err: 13, errP: 55,  mis: 0.07,  jfail: 0.1,   safe: 0.86, smash: 0.6,  rT: 1.8,  rK: 0.3,  rC: 0.1,   mh: 0.04, hp: 0.16, sharp: false },
  hell:   { spd: 295, react: 0.08,  reactR: 0.06,  err: 7,  errP: 32,  mis: 0.03,  jfail: 0.04,  safe: 0.94, smash: 0.72, rT: 2.05, rK: 0.25, rC: 0.06,  mh: 0.02, hp: 0.09, sharp: false },
  imp:    { spd: 335, react: 0.045, reactR: 0.035, err: 4,  errP: 18,  mis: 0.012, jfail: 0.015, safe: 0.97, smash: 0.82, rT: 2.25, rK: 0.18, rC: 0.035, mh: 0.01, hp: 0.05, sharp: true }
});

// 키 배치 (KeyboardEvent.code = 물리 키 위치라 한/영 상태와 무관). 동작마다 여러 키 가능.
// 오른손: 방향키 / 왼손: A S D F 홈 포지션 + 엄지 Space + 새끼 Shift
// 샷 배열은 낙하 지점 순서: 왼쪽(A)=가장 깊게 … 오른쪽(F)=네트 바로 앞
const KEYMAP = Object.freeze({
  left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], crouch: ['ArrowDown'],
  clear: ['KeyA'], drive: ['KeyS'], drop: ['KeyD'], hairpin: ['KeyF'],
  smash: ['Space'],                    // 랠리 중 스매시 · 내 서브 때 길게 눌러 게이지 · 대기/게임오버 때 시작
  dash: ['ShiftLeft', 'ShiftRight']    // 이동키와 함께
});
