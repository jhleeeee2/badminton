// ui/tutorial.js — 튜토리얼 팝업 (페이지 내용은 TUTORIAL_PAGES만 고치면 됨)

const TUTORIAL_PAGES = [
  { t: '1. 목표와 기본 조작', b: '목표 점수(11/15/21)를 먼저 따되 <b>2점 차</b>가 나야 이깁니다(듀스).<br><b>←→</b> 이동 · <b>↑</b> 점프 · <b>↓</b> 앉기(수비 자세) · <b>Shift</b> 대쉬(랠리당 1회, 이동키와 함께)<br>왼손은 <b>A S D F</b>에 올려 두고 엄지로 <b>Space</b>를 누르세요.' },
  { t: '2. 다섯 가지 샷', b: '샷 키는 왼쪽일수록 깊게, 오른쪽일수록 네트 가까이 떨어집니다.<br><b>A 클리어</b> — 높고 깊게 띄워 시간 벌기. 빠르게 솟았다가 천천히 떨어집니다.<br><b>S 드라이브</b> — 네트를 스치는 빠른 직선.<br><b>D 드롭</b> — 높은 타점에서 전위에 뚝.<br><b>F 헤어핀</b> — 네트 바로 앞에 살짝. 상대가 뒤에 있을 때 치명적.<br><b>Space 스매시</b> — 최고 속도로 내리꽂기.' },
  { t: '3. 파워 시스템', b: '파워 = <b>타점 높이</b> + <b>전진하며 타격</b>(+0.45) + <b>대쉬 중 타격</b>(+0.25).<br>뒤로 물러나며 치면 오히려 약해집니다(−0.25).<br>파워가 충분히 세면 상대가 제자리에 있어도 반응하지 못합니다. 단, 낮은 타점의 스매시·드라이브는 네트에 박히고, 강한 샷일수록 아웃 위험이 커요.' },
  { t: '4. 서브', b: '내 서브 차례엔 위치를 잡고 <b>Space를 누르고 있으면</b> 게이지가 차오릅니다(약 0.9초에 가득).<br>짧게 누르고 떼면 네트 앞에 떨어지는 <b>낮은 숏서브</b>(상대가 받기 까다로움), 꽉 채워 떼면 뒤쪽 깊숙이 가는 <b>높은 롱서브</b>.<br>단, 게이지 양 끝의 <b>빨간 구간</b>은 실패! 툭 치듯 너무 짧으면 <b>네트</b>에 걸리고, 가득 찬 뒤에도 계속 누르고 있으면 <b>아웃</b>됩니다.' },
  { t: '5. 수비 — 앉기', b: '<b>↓를 누르고 있으면 앉은 자세</b>가 됩니다. 리치가 크게 늘고 삑사리가 안 나서 빠른 스매시도 안정적으로 받아냅니다.<br>대신 이동이 느려지고 리턴은 무조건 약한 수비 샷이 돼요 — 받아낸 다음 자세를 풀고 반격하세요.' },
  { t: '6. 판정과 실수', b: '<b>네트</b> — 궤적이 네트를 못 넘으면 친 쪽 실점.<br><b>아웃</b> — 낙하점이 빨간 X면 아웃되는 공. 건드리지 말고 흘려보내면 득점!<br><b>삑사리</b> — 모든 샷에 소확률 존재(스매시>드라이브>헤어핀>드롭>클리어). 타점이 낮을수록 잘 납니다.<br><b>범실</b> — 삑사리 공이 자기 코트에 떨어지면 실점.' }
];

class Tutorial {
  constructor(pages) {
    const $ = id => document.getElementById(id);
    this.pages = pages; this.idx = 0;
    this.el = $('tut'); this.title = $('tutTitle'); this.body = $('tutBody'); this.pg = $('tutPg');
    this.prev = $('tutPrev'); this.next = $('tutNext');
    $('tutBtn').addEventListener('click', () => this.open());
    $('tutClose').addEventListener('click', () => this.close());
    this.prev.addEventListener('click', () => { if (this.idx > 0) { this.idx--; this.render(); } });
    this.next.addEventListener('click', () => { if (this.idx < this.pages.length - 1) { this.idx++; this.render(); } });
  }

  use(pages) { this.pages = pages; this.idx = 0; }   // 게임 종류별 페이지 교체
  get isOpen() { return this.el.classList.contains('on'); }
  open() { this.idx = 0; this.render(); this.el.classList.add('on'); }
  close() { this.el.classList.remove('on'); }

  render() {
    const p = this.pages[this.idx], n = this.pages.length;
    this.title.textContent = p.t;
    this.body.innerHTML = p.b;
    this.pg.textContent = (this.idx + 1) + ' / ' + n;
    this.prev.style.visibility = this.idx === 0 ? 'hidden' : 'visible';
    this.next.style.visibility = this.idx === n - 1 ? 'hidden' : 'visible';
  }
}
