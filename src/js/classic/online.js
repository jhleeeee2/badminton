// classic/online.js — 클래식 랠리 친구 1:1 (Supabase Realtime 방송 채널 + 방 코드, 별도 서버 없음)
//   동기화 방식 [게임 설계] — 3D 코트(Net3D)와 같은 원칙
//   · 각자 화면에서는 내가 오른쪽 선수. 상대가 보낸 x는 좌우를 뒤집어(x → W − x) 왼쪽 선수로 그림
//   · 내 선수 상태(x·점프 높이·앉기·스윙·대쉬·서브 게이지)를 초당 SNAP_HZ번 보냄 → 상대 화면에서 보간
//   · 칠 때는 셔틀의 출발점·도착점·비행시간만 보냄 → 클래식 궤적은 이 세 값으로 정해지므로 양쪽이 같은 공
//   · 판정 권한은 "받는 쪽": 공이 날아가는 쪽 컴퓨터가 낙하·네트를 판정하고 점수를 알려줌
//   · 채널 이름은 'bmc-<코드>' (3D 코트 방과 섞이지 않음)

const NETC = Object.freeze({ SNAP_HZ: 20, PING_EVERY: 2 });

class NetC {
  constructor(game) {
    this.game = game;
    this.id = Math.random().toString(36).slice(2, 10);
    this.ch = null; this.peer = null; this.snap = null; this.prevSnap = null;
    this.lat = 0.06; this.sendT = 0; this.pingT = 0;
  }
  get active() { return !!this.ch; }
  get connected() { return !!this.peer; }
  cid() {
    if (typeof NET3_CID !== 'undefined') return NET3_CID;   // 3D 코트와 같은 브라우저 id
    return this.id;
  }

  async open(code, host, info) {
    this.close();
    const sb = typeof Account !== 'undefined' ? Account.sb : null;
    if (!sb) throw new Error('온라인 서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.');
    Object.assign(this, { code, host, info, peer: null, snap: null, prevSnap: null, joinedAt: Date.now() });
    const ch = sb.channel('bmc-' + code, { config: { broadcast: { self: false }, presence: { key: this.id } } });
    this.ch = ch;
    ch.on('broadcast', { event: 'm' }, ({ payload }) => { try { this.recv(payload); } catch (e) { console.error(e); } });
    ch.on('presence', { event: 'sync' }, () => this.onPresence());
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('연결 시간 초과')), 10000);
      ch.subscribe(async st => {
        if (st === 'SUBSCRIBED') { clearTimeout(to); try { await ch.track({ host, at: this.joinedAt }); } catch (e) { /* 무시 */ } res(); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); rej(new Error('방 채널 연결 실패 (' + st + ')')); }
      });
    });
    if (this.ch !== ch) return;   // 그사이 메뉴로 나감
    this.sayHello(false);
    this.helloTimer = setInterval(() => { if (this.ch && !this.peer) this.sayHello(false); }, 1500);
  }
  close() {
    const ch = this.ch; this.ch = null; this.peer = null; this.snap = null; this.prevSnap = null;
    if (this.helloTimer) { clearInterval(this.helloTimer); this.helloTimer = null; }
    if (ch) { try { ch.unsubscribe(); Account.sb.removeChannel(ch); } catch (e) { /* 무시 */ } }
  }
  send(m) { if (this.ch) { m.from = this.id; this.ch.send({ type: 'broadcast', event: 'm', payload: m }).catch(() => {}); } }
  sayHello(reply) { this.send({ t: 'hello', host: this.host, name: this.info.name, win: this.info.win, cid: this.cid(), reply }); }

  onPresence() {
    if (!this.ch) return;
    const st = this.ch.presenceState(), keys = Object.keys(st);
    if (keys.length > 2) {   // 셋째로 들어온 사람만 나감
      const at = k => (st[k][0] && st[k][0].at) || 0;
      const first2 = keys.sort((a, b) => at(a) - at(b)).slice(0, 2);
      if (!first2.includes(this.id)) { this.close(); this.game.netError('방이 꽉 찼어요 (1:1 방).'); return; }
    }
    if (this.peer && keys.includes(this.peer.id)) this.peer.seen = true;   // 접속 목록에 한 번 보인 뒤 사라져야 '나감'
    else if (this.peer && this.peer.seen) {
      const gone = this.peer; this.peer = null; this.snap = null;
      this.host = true; this.info.win = this.game.match.win;   // 남은 사람이 방장 → 누가 같은 코드로 들어와도 연결됨
      this.game.netPeerLeft(gone);
    }
  }

  recv(m) {
    const g = this.game;
    switch (m.t) {
      case 'hello': {
        if (this.peer) return;
        if (m.host === this.host) { g.netError(this.host ? '같은 코드의 방이 이미 있어요. 다시 만들어 주세요.' : '상대도 입장하는 쪽이에요. 한 명은 방 만들기를 눌러야 해요.'); this.close(); return; }
        this.peer = { id: m.from, cid: String(m.cid || m.from).slice(0, 16), name: String(m.name || '친구').slice(0, 16) };
        try { if (this.ch.presenceState()[m.from]) this.peer.seen = true; } catch (e) { /* 무시 */ }   // 접속 목록에 이미 있으면 바로 '본 적 있음' (나감 감지가 빠지지 않게)
        if (!m.reply) this.sayHello(true);
        g.netPeerJoined(this.peer, this.host ? this.info.win : ([11, 15, 21].includes(m.win) ? m.win : 11));
        return;
      }
      case 'st': this.prevSnap = this.snap; this.snap = { x: +m.x, jy: +m.jy || 0, c: !!m.c, sw: !!m.sw, d: m.d | 0, gp: m.gp == null ? -1 : +m.gp, at: performance.now() }; return;
      case 'hit': g.netShot(m); return;
      case 'pt': g.netPoint(m); return;
      case 'restart': g.netRestart(m); return;
      case 'ping': this.send({ t: 'pong', ts: m.ts }); return;
      case 'pong': { const one = Math.min(0.5, (performance.now() - m.ts) / 2000); this.lat += (one - this.lat) * 0.3; return; }
    }
  }

  // 매 화면 프레임: 내 상태 보내기 · 주기적 ping
  tick(real) {
    if (!this.ch || !this.peer) return;
    const p = this.game.player;
    this.sendT -= real;
    if (this.sendT <= 0) {
      this.sendT = 1 / NETC.SNAP_HZ;
      this.send({ t: 'st', x: Math.round(p.x * 10) / 10, jy: Math.round(p.jy * 10) / 10, c: p.crouched ? 1 : 0, sw: p.swingT > 0 ? 1 : 0,
        d: p.dashT > 0 ? p.dashDir : 0, gp: p.gauge.on ? Math.round(p.gauge.p * 100) / 100 : null });
    }
    this.pingT -= real;
    if (this.pingT <= 0) { this.pingT = NETC.PING_EVERY; this.send({ t: 'ping', ts: performance.now() }); }
  }

  // 왼쪽 선수(상대)를 받은 상태 쪽으로 — 받은 뒤 흐른 시간만큼 이동 속도로 앞질러 예측
  apply(dt) {
    const L = this.game.p2, s = this.snap, W = COURT.W;
    if (!s) return;
    const ps = this.prevSnap, age = Math.min(0.2, (performance.now() - s.at) / 1000);
    let vx = 0;
    if (ps && s.at > ps.at) vx = Math.max(-700, Math.min(700, (s.x - ps.x) / ((s.at - ps.at) / 1000)));
    const tx = W - (s.x + vx * age), k = Math.min(1, dt * 16);
    L.x += (tx - L.x) * k;
    L.x = Math.max(18, Math.min(COURT.NET - 20, L.x));
    L.jy = s.jy; L.vy = 0; L.ctrl.C = s.c;
    if (s.sw && !this.swWas && L.swingT <= 0) L.swing();
    this.swWas = s.sw;
    L.dashT = s.d ? 0.05 : 0; L.dashDir = -s.d;
    L.gauge.on = s.gp >= 0; L.gauge.p = Math.max(0, s.gp);
  }
}
