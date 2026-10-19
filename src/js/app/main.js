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

    $('lobbyTut').addEventListener('click', () => this.openTutorial(this.lobby.sel.type));
    $('menuBtn').addEventListener('click', () => this.toMenu());
    $('c3menuBtn').addEventListener('click', () => this.toMenu());
    $('c3tutBtn').addEventListener('click', () => this.openTutorial('court3d'));
    $('c3startBtn').addEventListener('click', () => this.court3d && this.court3d.start());
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
    this.tutorial.use(type === 'court3d' ? TUTORIAL_3D_PAGES : TUTORIAL_PAGES);
    this.tutorial.open();
  }

  ensure3D() {
    if (this.court3d) return true;
    try {
      this.court3d = new Game3D(document.getElementById('c3stage'), new Hud3D());
      this.court3dInput = new Input3D(this.court3d, document.getElementById('c3stage'));
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
    if (sel.type === 'classic') {
      const g = this.classic;
      g.setMode(sel.mode);
      g.match.diff = DIFFS[sel.diff];
      g.match.win = sel.win;
      g.match.diffId = sel.diff;   // 기록 저장용 난이도 id
      g.hud.setConfigLabel(sel.mode === 'room' ? '친구 1:1 · ' + sel.win + '점' : DIFF_NAMES[sel.diff] + ' · ' + sel.win + '점');
      this.show('classic');
      if (sel.mode === 'room') this.openClassicRoom(sel);
      else g.start();
    } else if (sel.type === 'court3d') {
      if (!this.ensure3D()) return;
      this.court3d.configure(sel);
      Sound3.unlock();
      this.show('court3d');
      if (sel.mode === 'room') this.openRoom(sel);
      else this.court3d.start();
    }
  }

  nickOf(sel) { return (sel.nick || (typeof Account !== 'undefined' && Account.nickname) || '게스트').slice(0, 12); }

  // 클래식 친구 1:1 방: 채널 연결 → 친구가 들어오면 방장 쪽에서 시작 신호
  openClassicRoom(sel) {
    const g = this.classic, r = sel.room;
    g.stop(); g.oppName = '상대'; g.setMode('room'); g.hud.setRoom(r.code);
    g.hud.showMessage(r.host ? '방을 만드는 중…' : `방 <b>${r.code}</b>에 들어가는 중…`);
    g.net.open(r.code, r.host, { win: sel.win, name: this.nickOf(sel) })
      .then(() => {
        if (g.net.connected || this.screen !== 'classic' || g.mode !== 'room') return;
        g.hud.showMessage(r.host
          ? `방 코드<br><span class="c3code">${r.code}</span><br>친구에게 이 코드를 알려주세요 — 들어오면 바로 시작합니다<br><small>친구도 대기화면에서 <b>클래식 랠리 → 친구 1:1 방</b>을 골라야 해요</small>`
          : `방 <b>${r.code}</b>에서 방장을 기다리는 중…<br><small>오래 걸리면 코드와 게임 종류(클래식)를 다시 확인해 주세요</small>`);
      })
      .catch(err => { if (this.screen === 'classic') g.netError(err.message || String(err)); });
  }

  // 친구 1:1 방: 채널 연결 → 친구가 들어오면 방장 쪽에서 시작 신호
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
    if (this.screen === 'classic') this.classic.stop();
    if (this.screen === 'court3d') { this.court3d.stop(); this.court3dInput.reset(); }
    this.lobby.refresh();   // 훈련 레벨 갱신
    this.show('lobby');
  }

  onKey(e) {
    if (e.code === 'Escape') {
      if (AccountUI.isOpen) AccountUI.close();
      else if (this.tutorial.isOpen) this.tutorial.close();
      else if (this.screen !== 'lobby') this.toMenu();
    } else if (e.code === 'Enter' && this.screen === 'lobby' && !this.tutorial.isOpen && !AccountUI.isOpen) {
      e.preventDefault();
      this.lobby.start();
    }
  }
}

const app = new App();   // 전역: 콘솔에서 app.classic, app.court3d, app.lobby 확인 가능
