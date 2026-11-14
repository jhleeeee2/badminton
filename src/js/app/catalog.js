// app/catalog.js — 게임 종류·대전 모드 목록 (새 게임/모드를 추가하면 여기에 등록)
//   modes: 그 게임 종류에서 지금 플레이 가능한 모드 id 목록
//   badge: 카드에 붙는 표시 { text, tone: 'ok' | 'warn' | 'off' }

const GAME_TYPES = [
  {
    id: 'court3d', name: '3D 코트',
    desc: '실제 규격 코트와 단식 규칙. WASD로 움직이고 마우스로 방향을 잡아, 셔틀이 라켓에 닿는 순간 스윙.',
    modes: ['ai', 'career', 'daily', 'train', 'room'], badge: { text: '본편', tone: 'ok' }, art: 'persp', options: ['hand']
  },
  {
    id: 'classic', name: '레트로 모드',
    desc: '이 게임의 첫 버전. 옆에서 보는 2D 코트에서 키보드로 샷을 골라 칩니다.',
    modes: ['ai', 'room'], badge: { text: '2D 클래식', tone: 'off' }, art: 'side'
  }
];

const MODES = [
  { id: 'ai',      name: 'AI 대전',     desc: '난이도 5단계' },
  { id: 'career',  name: '커리어',      desc: '대회 4개 · 성향이 다른 상대 12명' },
  { id: 'daily',   name: '일일 챌린지', desc: '오늘의 종목 · 점수 순위' },
  { id: 'train',   name: '훈련',        desc: '선수 키우기 · 근력/순발력/판단력' },
  { id: 'room',    name: '친선게임', desc: '방 코드로 온라인 대전' },
  { id: 'rank',    name: '랭크전',      desc: '구글 로그인 · 레이팅' },
  { id: 'doubles', name: '복식',        desc: '2 대 2' }
];

const DIFF_NAMES = { easy: '쉬움', normal: '중간', hard: '어려움', hell: '지옥', imp: '임파서블' };
