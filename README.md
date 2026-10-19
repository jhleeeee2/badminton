# 배드민턴 랠리

## 폴더 구조
```
src/                         개발용 원본 (여기만 수정)
  index.html                 더블클릭으로 바로 실행 (대기화면부터 시작)
  css/style.css
  js/
    app/                     공용: 대기화면·화면 전환
      catalog.js             게임 종류(GAME_TYPES)·대전 모드(MODES) 목록 — 새 게임/모드는 여기에 등록
      lobby.js               Lobby — 게임 종류·모드·난이도·목표 점수 선택, 마지막 선택 기억, 친구 1:1 닉네임(기억)
      main.js                App — 대기화면 ↔ 게임 전환, Enter 시작 / Esc 메뉴 (전역 app)
      account.js             Account/AccountUI — Supabase 로그인·회원가입, 경기 기록(로컬+서버), 훈련 레벨 동기화
    classic/                 게임 종류 1: 클래식 랠리 (옆에서 보는 2D)
      config.js              모든 상수·밸런스 수치 (COURT, PHYS, MOVE, POWER, SERVE, DIFFS, KEYMAP …)
      core/shuttle.js        Shuttle      — 셔틀 궤적(투사체), 네트·아웃 예측
      systems/match.js       Match        — 점수, 랠리, 서브권, 듀스·승패
      systems/effects.js     Effects      — 배너, 타격 링, 낙하 표시
      systems/shots.js       ShotSystem   — 샷별 낙하점·비행시간, 삑사리 공, AI 반응
      entities/athlete.js    Athlete      — 선수 공통(점프, 스윙, 라켓 위치)
      entities/player.js     Player       — 사람 선수(오른쪽 'R' / 왼쪽 'L'): 이동·대쉬·앉기·서브 게이지·타격·파워·삑사리
      entities/ai.js         AIOpponent   — 궤적 예측 이동/점프, 샷 선택
      view/hud.js            Hud          — HTML 점수판
      view/renderer.js       Renderer     — Canvas 그리기
      online.js              NetC         — 친구 1:1 방 (Supabase Realtime 채널 bmc-<코드>), 받는 쪽 판정
      game.js                Game         — 모드(ai/local2p/room)·phase 전환, 메인 루프, 서브·득점, start/stop
      ui/input.js            Input        — 키보드·터치 → Game 명령 (inputOn일 때만, 로컬 2인은 KEYMAP_2P)
      ui/tutorial.js         Tutorial     — 튜토리얼 팝업 + TUTORIAL_PAGES
    court3d/                 게임 종류 2: 3D 코트 (시험판, Three.js)
      config.js              C3 — 코트 규격[규격]·물리[근사]·슬로우/충전/샷/AI 수치[게임]
      physics.js             Phys3 — 셔틀 공기저항 물리(종단속도 6.8m/s), 네트 판정, 발사 속력 역산
      shots.js               Shots3 — 충전량·방향·포/백핸드 → 목표 지점 → 발사 속도, 과충전 실패
      match.js               Match3D — 단식 규칙: 짝/홀 서비스 코트, 대각선 서브, 21점·30점 상한
      athlete.js             Athlete3D — 관절 리그(IK)·스윙 단계 애니메이션·포/백/라운드 더 헤드·스플릿 스텝·세리머니
      view.js                CourtView3D — 경기장(코트·네트·LED판·관중·조명)·카메라(흔들림/줌)·셔틀·이펙트·보조 표시
      ai.js                  AI3D — 궤적 예측 → 위치·점프·팔 뻗기, 샷 선택, 서브
      hud.js / input.js      Hud3D / Input3D — 점수·게이지·포백 표시·슬로우 효과 / WASD·마우스·Q·E·클릭
      sound.js               Sound3 — Web Audio 합성 효과음(타격·네트·착지·환호), M 음소거
      game.js                Game3D — 고정 간격 시뮬레이션, 슬로우, 타격·득점 흐름
      online.js              Net3D — 친구 1:1 방 (Supabase Realtime 방송 채널·방 코드), 상대 선수 보간, 지연 보정, 나감/재입장 이어하기
      emote.js               Emote3D — 감정표현 원판(T 꾹 → 마우스로 고르고 떼기), 말풍선(상대 왼쪽 위 · 나 오른쪽 아래)
      tutorial.js            TUTORIAL_3D_PAGES
  vendor/supabase.min.js     supabase-js 2.118.0 UMD (MIT, 오프라인 실행용으로 포함)
  vendor/three.min.js        Three.js r149 (MIT, 오프라인 실행용으로 포함 → dist 약 730KB)
dist/badminton_rally.html    배포용 단일 파일 (빌드 결과물, 직접 수정 금지)
tools/build.py               src → dist 묶기:  python tools/build.py
archive/                     예전 버전 보관 (v1 원본, v2 단순 분리, v3 객체화·로비 이전)
```

## 조작 (3D 코트)
WASD 이동 · 마우스 좌우 방향 · Q 올리기 / E 찍기 / 좌클릭 직선 (꾹 = 충전, 떼면 스윙) · Space 점프 · Shift 팔 뻗기
T 꾹 = 감정표현 원판 · G 셔틀 그림자 · L 낙하 표시 · M 소리
서브: Q 꾹 (짧게 숏 서브, 길게 롱 서브) · 셔틀이 라켓 팔 어깨 근처로 오면 슬로우

## 조작 (3D 코트 · 로컬 2인)
P1(앞쪽): 위와 같음 · P2(안쪽): 방향키 이동(화면 기준) · I 올리기 · O 찍기 · P 직선 · K 점프 · J 런지
P2 조준: ←/→를 누른 채 치면 그쪽 사이드라인, 안 누르면 P1이 없는 쪽 · 서브는 I 꾹 · 오른쪽 위에 P2 게이지

## 조작 (클래식)
←→ 이동 · ↑ 점프 · ↓ 앉기 · A 대쉬(Shift도 됨) · Q 클리어 · W 드라이브 · E 드롭 · R 헤어핀 · Space 스매시
(왼손: 새끼 Q · 약지 W · 중지 E · 검지 R · 엄지 Space · 새끼 한 칸 아래 A)
서브: Space 길게(길수록 멀리, 너무 짧으면 네트·너무 길면 아웃) · Esc 메뉴

## 조작 (클래식 · 로컬 2인)
P2(왼쪽 코트, 키보드 왼쪽 사람): Q W E R 샷 · Space 스매시/서브 · A 대쉬 · F/H 이동 · T 점프 · G 앉기
P1(오른쪽 코트, 키보드 오른쪽 사람): 방향키 · U I O P 샷 · ; 스매시/서브 · J 대쉬
시작: Space(또는 ;)·시작 버튼

## 새 게임 종류 추가 방법
1. js/<게임id>/ 폴더에 게임 코드 작성, index.html에 화면(div)과 script 추가
2. app/catalog.js의 GAME_TYPES에 등록 (modes에 지원 모드)
3. app/main.js의 screens와 launch()에 연결

## 주의
- ES 모듈(`type="module"`)은 더블클릭(file://) 실행에서 막히므로 일반 `<script src>` 사용.
- index.html의 script 순서 중요 (Athlete가 Player/AIOpponent보다 먼저).

## 계정 (Supabase)
- 로그인 없이도 플레이 가능(게스트). 기록은 항상 이 브라우저(localStorage)에 먼저 저장.
- 로그인하면 AI 대전 결과가 matches 테이블에 올라감. 실패한 기록은 대기열에 두었다가 다시 올림.
- 훈련 레벨은 로그인 시 progress 테이블과 합침(종목별 높은 값).
- 테이블: profiles(닉네임) · matches(경기 기록) · progress(훈련 레벨), 모두 RLS로 본인 것만 쓰기.
- account.js의 키는 publishable(공개용). secret/service_role 키는 절대 넣지 말 것.

## 친구 1:1 방 (클래식, 온라인)
- 대기화면 → 클래식 랠리 → 친구 1:1 방. 닉네임을 적고 방 만들기/입장 (3D 방과 채널이 달라서 둘 다 클래식을 골라야 함).
- 채널 `bmc-<코드>`: 각자 내 선수 상태를 초당 20번 보냄 · 칠 때는 셔틀 출발점·도착점·비행시간만 보냄(클래식 궤적은 이 세 값으로 결정)
  · 받는 쪽 컴퓨터가 낙하/네트를 판정해 'pt'로 점수를 알림 · 내 화면에선 항상 내가 오른쪽(상대 x는 W − x로 뒤집음).
- 첫 서브·목표 점수는 방장 기준. 상대가 나가면 경기 중단, 같은 코드로 다시 들어오면 새 경기(세트 스코어는 유지). 기록은 이 브라우저에만.

## 닉네임 (친구 1:1 공용)
- 대기화면 친구 1:1 방 설정의 닉네임 칸. 비어 있으면 입장 불가. 입력할 때마다 localStorage `badminton.nick`에 저장되어
  메뉴로 돌아오거나, 다른 판·새로고침 후에도 그대로 채워져 있음. 처음엔 로그인 닉네임으로 채움.

## 친구 1:1 방 (3D 코트, 온라인)
- 대기화면 → 3D 코트 → 친구 1:1 방 → 한 명이 '방 만들기'(5자리 코드), 친구는 코드 입력 후 '입장'. 인터넷 필요, 로그인 불필요.
- 별도 서버 없이 Supabase Realtime 채널 `bm3d-<코드>`의 broadcast·presence만 사용 (DB 테이블 안 씀).
- 동기화: 각자 자기 선수 위치를 초당 15번 보냄 · 칠 때는 발사 위치·속도만 보냄(셔틀 물리는 결정론적이라 양쪽 궤적 동일)
  · 판정(타격/낙하/득점)은 셔틀을 받는 쪽 컴퓨터가 결정해 알림 · 좌표는 받는 쪽에서 180° 회전(x→−x, z→−z).
- 첫 서브·목표 점수는 방장 기준. 온라인 경기는 서버(matches)에는 저장하지 않고 이 브라우저 기록에만 남김(내 기록 → 친구 1:1 대전).
- 상대가 나가면 'pause'(서브 불가), 남은 쪽이 방장이 됨. 같은 브라우저(localStorage badminton.cid)가 같은 코드로 다시 들어오면
  남은 쪽이 점수·서브·세트·엔드를 'resume'으로 보내 이어서 진행(중단된 랠리는 무효).
- 같은 상대와 계속하면 세트 스코어 유지(점수판 아래). 15점 이상 경기는 절반 점수에서 코트 체인지, 경기마다 엔드 교대.
- Supabase 대시보드에서 Realtime을 '비공개 채널만 허용'으로 바꾸면 방이 연결되지 않음.
