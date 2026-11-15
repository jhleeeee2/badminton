// app/main.js — 진입점: 화면(대기화면 ↔ 게임들) 전환과 공용 단축키
//   Enter = 대기화면에서 시작 · Esc = 튜토리얼 닫기 / 게임에서 메뉴로

class App {
  constructor() {
    const $ = id => document.getElementById(id);
    this.screens = { lobby: $('lobby'), classic: $('classic'), court3d: $('court3d') };

    // 게임 1: 클래식
    this.classic = new Game($('court'), new Hud());
    this.classicInput = new Input(this.classic);
    this.tutorial = new Tutorial(TUTORIAL_PAGES);
    // 게임 2: 3D 코트 (WebGL은 처음 고를 때 생성)
    this.court3d = null;

    this.lobby = new Lobby(this);
    AccountUI.init(() => { if (this.screen === 'lobby') this.lobby.refresh(); });   // 계정 줄·로그인 창

    $('lobbyGuide').addEventListener('click', () => this.startGuide({ ...this.lobby.sel, type: 'court3d', mode: 'ai' }));
    $('lobbyTut').addEventListener('click', () => this.openTutorial(this.lobby.sel.type));
    $('menuBtn').addEventListener('click', () => this.toMenu());
    $('c3menuBtn').addEventListener('click', () => this.toMenu());
    $('c3tutBtn').addEventListener('click', () => this.openTutorial('court3d'));
    $('c3startBtn').addEventListener('click', () => this.court3d && this.court3d.start());
    $('c3staBtn').addEventListener('click', e => { this.court3d && this.court3d.toggleSta(); e.currentTarget.blur(); });
    $('c3landBtn').addEventListener('click', e => { this.court3d && this.court3d.toggleLand(); e.currentTarget.blur(); });
    $('c3shadowBtn').addEventListener('click', e => { this.court3d && this.court3d.toggleShadow(); e.currentTarget.blur(); });
    $('clRoom').addEventListener('click', () => { const c = $('clRoomCode').textContent; try { navigator.clipboard.writeText(c); this.classic.fx.show('방 코드 복사됨: ' + c, COLORS.ok, 0.9); this.classic.renderer.draw(); } catch (e) { /* 무시 */ } });
    $('c3room').addEventListener('click', () => { const c = $('c3roomCode').textContent; try { navigator.clipboard.writeText(c); this.court3d.hud.banner('방 코드 복사됨: ' + c, '#5BFFB0', 0.9); } catch (e) { /* 무시 */ } });
    $('c3muteBtn').addEventListener('click', () => { Sound3.unlock(); this.court3d && this.court3d.hud.setMute(Sound3.toggleMute()); });
    $('tutBtn').addEventListener('click', () => this.openTutorial('classic'), true);
    document.addEventListener('keydown', e => this.onKey(e));

    this.show('lobby');
    this.classic.renderer.draw();
  }

  openTutorial(type) {
    this.tutorial.use(type === 'court3d' ? (typeof I18N !== 'undefined' && I18N.lang === 'en' ? TUTORIAL_3D_PAGES_EN : TUTORIAL_3D_PAGES) : TUTORIAL_PAGES);
    this.tutorial.open();
  }

  ensure3D() {
    if (this.court3d) return true;
    try {
      this.court3d = new Game3D(document.getElementById('c3stage'), new Hud3D());
      this.court3dInput = new Input3D(this.court3d, document.getElementById('c3stage'));
      this.court3dTouch = new Touch3D(this.court3d, this.court3dInput, document.getElementById('c3stage'));   // 모바일 버튼
      return true;
    } catch (err) {
      console.error(err);
      this.lobby.note.textContent = '3D를 시작할 수 없어요 (WebGL 미지원 브라우저일 수 있음).';
      return false;
    }
  }

  show(name) {
    for (const [k, el] of Object.entries(this.screens)) el.hidden = k !== name;
    this.screen = name;
    this.classic.inputOn = name === 'classic';
    if (this.court3d) { this.court3d.inputOn = name === 'court3d'; if (name === 'court3d') this.court3d.view.resize(); }
  }

  launch(sel) {
    const T = GAME_TYPES.find(t => t.id === sel.type);
    if (!T || !T.modes.includes(sel.mode)) return;
    if (typeof Account !== 'undefined') Account.track('start', { type: sel.type, mode: sel.mode, diff: sel.mode === 'ai' ? sel.diff : null });
    if (sel.type === 'classic') {
      const g = this.classic;
      g.setMode(sel.mode);
      g.match.diff = DIFFS[sel.diff];
      g.match.win = sel.win;
      g.match.diffId = sel.diff;   // 기록 저장용 난이도 id
      g.hud.setConfigLabel(sel.mode === 'room' ? '친선게임 · ' + sel.win + '점' : DIFF_NAMES[sel.diff] + ' · ' + sel.win + '점');
      this.show('classic');
      if (sel.mode === 'room') this.openClassicRoom(sel);
      else g.start();
    } else if (sel.type === 'court3d') {
      if (!this.ensure3D()) return;
      if (sel.mode === 'career') sel = Career3.sel(this.lobby.careerStage(), sel.hand);   // 고른(또는 다음) 경기를 AI 대전 설정으로 바꿈
      if (sel.mode === 'daily') sel = { ...sel, mode: 'train', train: Daily3.kind(), daily: true };   // 오늘의 종목을 훈련과 같은 방식으로
      if (sel.mode === 'quick') return this.openQuick(sel);
      if (sel.mode === 'ai' && !Guide3D.seen()) return this.startGuide(sel);   // 3D가 처음이면 체험 튜토리얼부터 (한 번만)
      this.court3d.configure(sel);
      Sound3.unlock();
      this.show('court3d');
      if (sel.mode === 'room') this.openRoom(sel);
      else this.court3d.start();
    }
  }

  // 빠른 대전: 대기열에서 비슷한 매칭 점수의 상대를 찾음 → 찾으면 친선게임과 같은 방식으로 연결. 아무도 없으면 AI와
  openQuick(sel) {
    const g = this.court3d, name = this.nickOf({ nick: this.lobby.nick ? this.lobby.nick.value.trim() : '' }), me = { r: Rate3.get(), lv: Stats3.level(), name };
    g.configure({ ...sel, mode: 'room', quick: true, win: QUICK3.WIN });
    Sound3.unlock(); this.show('court3d');
    g.placeForServe(); g.frame(0); g.hud.setHint(''); g.hud.setRoom(null);
    const wait = s => g.hud.showMessage(`상대를 찾는 중… <b>${Math.floor(s ? s.waited : 0)}초</b><br>내 매칭 점수 <b>${me.r}</b> · 찾는 범위 ±${s ? s.range : QUICK3.RANGE0}점 · 대기 중인 사람 ${s ? s.others : 0}명<br><small>${QUICK3.AI_AFTER}초 동안 아무도 없으면 AI와 대전합니다 · Esc = 취소</small>`);
    const live = () => this.screen === 'court3d' && g.mode === 'room' && g.quick;
    wait(null);
    g.qm.start(me, {
      onStatus: s => { if (live() && g.qm.state !== 'matched' && !g.net.active) wait(s); },
      onMatch: r => {
        if (!live()) return;
        g.quick = { r: r.opp.r, lv: r.opp.lv, name: r.opp.name };
        Account.track('quick_match', { wait: Math.round((Date.now() - g.qm.at) / 1000), diff: Math.round(Math.abs(r.opp.r - me.r)) });
        g.hud.showMessage(`상대를 찾았어요!<br><b>${escHtml(r.opp.name)}</b> · 매칭 점수 ${Math.round(r.opp.r)} · 선수 Lv.${r.opp.lv}<br><small>연결하는 중…</small>`);
        g.net.open(g, r.code, r.host, { hand: sel.hand, win: QUICK3.WIN, name }).catch(err => { if (this.screen === 'court3d') g.netError(err.message || String(err)); });
      },
      onNoOne: () => {
        if (!live()) return;
        const diff = Rate3.aiDiff();
        Account.track('quick_ai', { diff });
        g.configure({ type: 'court3d', mode: 'ai', diff, style: 'base', win: QUICK3.WIN, hand: sel.hand }); g.start();
        g.hud.banner(`대기 중인 사람이 없어 AI(${DIFF_NAMES[diff]})와 대전합니다`, '#9FD8FF', 2.6);
      }
    }).catch(err => { if (this.screen === 'court3d') g.netError(err.message || String(err)); });
  }

  // 체험형 튜토리얼 → 끝나거나 건너뛰면 원래 고른 설정으로 AI 대전 시작
  startGuide(sel) {
    if (!this.ensure3D()) return;
    const g = this.court3d;
    g.onGuideDone = () => { g.onGuideDone = null; g.configure(sel); g.start(); };
    g.configure({ ...sel, mode: 'guide' });
    Sound3.unlock();
    this.show('court3d');
    g.start();
  }

  nickOf(sel) { return (sel.nick || (typeof Account !== 'undefined' && Account.nickname) || '게스트').slice(0, 12); }

  // 클래식 친선게임: 채널 연결 → 친구가 들어오면 방장 쪽에서 시작 신호
  openClassicRoom(sel) {
    const g = this.classic, r = sel.room;
    g.stop(); g.oppName = '상대'; g.setMode('room'); g.hud.setRoom(r.code);
    g.hud.showMessage(r.host ? '방을 만드는 중…' : `방 <b>${r.code}</b>에 들어가는 중…`);
    g.net.open(r.code, r.host, { win: sel.win, name: this.nickOf(sel) })
      .then(() => {
        if (g.net.connected || this.screen !== 'classic' || g.mode !== 'room') return;
        g.hud.showMessage(r.host
          ? `방 코드<br><span class="c3code">${r.code}</span><br>친구에게 이 코드를 알려주세요 — 들어오면 바로 시작합니다<br><small>친구도 대기화면에서 <b>레트로 모드 → 친선게임</b>을 골라야 해요</small>`
          : `방 <b>${r.code}</b>에서 방장을 기다리는 중…<br><small>오래 걸리면 코드와 게임 종류(레트로 모드)를 다시 확인해 주세요</small>`);
      })
      .catch(err => { if (this.screen === 'classic') g.netError(err.message || String(err)); });
  }

  // 친선게임: 채널 연결 → 친구가 들어오면 방장 쪽에서 시작 신호
  openRoom(sel) {
    const g = this.court3d, r = sel.room;
    g.placeForServe(); g.frame(0); g.hud.setHint(''); g.hud.setRoom(r.code);
    g.hud.showMessage(r.host
      ? `방을 만드는 중…`
      : `방 <b>${r.code}</b>에 들어가는 중…`);
    const name = this.nickOf(sel);
    g.net.open(g, r.code, r.host, { hand: sel.hand, win: sel.win, name })
      .then(() => {
        if (g.net.connected || this.screen !== 'court3d') return;
        g.hud.showMessage(r.host
          ? `방 코드<br><span class="c3code">${r.code}</span><br>친구에게 이 코드를 알려주세요 — 들어오면 바로 시작합니다`
          : `방 <b>${r.code}</b>에서 방장을 기다리는 중…<br><small>오래 걸리면 코드를 다시 확인해 주세요</small>`);
      })
      .catch(err => { if (this.screen === 'court3d') g.netError(err.message || String(err)); });
  }

  toMenu() {
    if (this.screen === 'classic') { this.classic.stop(); this.classicInput.pad.reset(); }
    if (this.screen === 'court3d') { this.court3d.stop(); this.court3dInput.reset(); this.court3dTouch.reset(); }
    this.lobby.cstage = null; this.lobby.dailyCache = null;   // 커리어: 다음에 도전할 경기로 되돌림 · 일일 챌린지 순위표는 새로 받음
    this.lobby.refresh();   // 훈련 레벨·커리어 진행 갱신
    this.show('lobby');
  }

  onKey(e) {
    if (e.code === 'Escape') {
      if (AccountUI.isOpen) AccountUI.close();
      else if (this.tutorial.isOpen) this.tutorial.close();
      else if (this.screen !== 'lobby') this.toMenu();
    } else if (e.code === 'Enter' && this.screen === 'lobby' && this.lobby.tab !== 'shop' && !this.tutorial.isOpen && !AccountUI.isOpen) {   // 상점 탭에서는 Enter로 시작하지 않음
      e.preventDefault();
      this.lobby.start();
    }
  }
}

// 홈 화면 설치·오프라인(PWA): 웹 주소(https)로 열었을 때만. 파일을 더블클릭해 연 경우엔 등록하지 않음
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { /* 무시 */ });

TouchUI.init();   // 터치 기기면 모바일 버튼 레이아웃
const app = new App();   // 전역: 콘솔에서 app.classic, app.court3d, app.lobby 확인 가능
