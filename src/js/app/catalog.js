// app/catalog.js — 게임 종류·대전 모드 목록 (새 게임/모드를 추가하면 여기에 등록)
//   modes: 그 게임 종류에서 지금 플레이 가능한 모드 id 목록
//   badge: 카드에 붙는 표시 { text, tone: 'ok' | 'warn' | 'off' }

const GAME_TYPES = [
  {
    id: 'classic', name: '클래식 랠리',
    desc: '옆에서 보는 2D 코트. 키보드로 샷을 골라 치는 원래 게임.',
    modes: ['ai', 'local2p', 'room'], badge: { text: '플레이 가능', tone: 'ok' }, art: 'side'
  },
  {
    id: 'court3d', name: '3D 코트',
    desc: '실제 규격 코트·단식 규칙 · WASD 이동 · 마우스 방향 · Q 올리기 / E 찍기 / 클릭 직선 · 슬로우 타이밍.',
    modes: ['ai', 'train', 'local2p', 'room'], badge: { text: '시험판', tone: 'warn' }, art: 'persp', options: ['hand']
  }
];

const MODES = [
  { id: 'ai',      name: 'AI 대전',     desc: '난이도 5단계' },
  { id: 'train',   name: '훈련',        desc: '선수 키우기 · 근력/순발력/판단력' },
  { id: 'local2p', name: '로컬 2인',    desc: '한 키보드로 둘이' },
  { id: 'room',    name: '친구 1:1 방', desc: '방 코드로 온라인 대전' },
  { id: 'rank',    name: '랭크전',      desc: '구글 로그인 · 레이팅' },
  { id: 'doubles', name: '복식',        desc: '2 대 2' }
];

const DIFF_NAMES = { easy: '쉬움', normal: '중간', hard: '어려움', hell: '지옥', imp: '임파서블' };
