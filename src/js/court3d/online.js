// court3d/online.js — 친구 1:1 온라인 대전 (Supabase Realtime 방송 채널 + 방 코드, 별도 서버 없음)
//   동기화 방식 [게임 설계]
//   · 각자 화면에서는 "내가 나(me, 화면 앞쪽)" — 상대에게 보낼 때 좌표를 180° 돌려서(x→−x, z→−z) 보냄
//   · 내 선수 위치·속도는 초당 SNAP_HZ번 보냄 → 상대 화면에서 보간해 그림
//   · 칠 때는 발사 위치·속도(p0, v0)만 보냄 → 셔틀 물리는 결정론적이라 양쪽이 같은 궤적을 계산
//   · 판정 권한은 "받는 쪽": 셔틀을 받아야 하는 사람의 컴퓨터가 타격/낙하/득점을 결정하고 알려줌
//     (친 쪽 화면에서는 셔틀이 바닥에 닿아도 상대 판정이 올 때까지 기다림)
//   · 네트 지연은 ping으로 재서, 받은 셔틀을 그만큼 앞으로 감아(최대 MAX_FF초) 맞춤
//   · 상대가 나가면 경기를 멈추고(남은 쪽이 방장이 됨), 같은 브라우저(cid)가 같은 코드로 다시 들어오면
//     남은 쪽이 점수·서브·세트 스코어·엔드를 보내 이어서 진행 ('resume')
//   · 감정표현은 'emo' {id}

const NET3 = Object.freeze({ SNAP_HZ: 15, MAX_FF: 0.25, PING_EVERY: 2, JOIN_WAIT: 5 });
const mir3 = p => ({ x: -p.x, y: p.y, z: -p.z });
const flip3 = s => s === 'me' ? 'opp' : s === 'opp' ? 'me' : s;
// 이 브라우저의 고정 id (다시 들어온 사람이 '같은 사람'인지 확인용 — 세트 스코어·이어하기)
const NET3_CID = (() => {
  let c = null;
  try { c = localStorage.getItem('badminton.cid'); } catch (e) { /* 무시 */ }
  if (!c) { c = Math.random().toString(36).slice(2, 12); try { localStorage.setItem('badminton.cid', c); } catch (e) { /* 무시 */ } }
  return c;
})();

class Net3D {
  constructor() {
    this.id = Math.random().toString(36).slice(2, 10);
    this.ch = null; this.game = null; this.peer = null; this.snap = null;
    this.lat = 0.06; this.sendT = 0; this.pingT = 0; this.waitT = 0;
  }
  get active() { return !!this.ch; }
  get connected() { return !!this.peer; }
  static makeCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
    for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }

  async open(game, code, host, info) {
    this.close();
    const sb = typeof Account !== 'undefined' ? Account.sb : null;
    if (!sb) throw new Error('온라인 서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.');
    Object.assign(this, { game, code, host, info, peer: null, snap: null, joinedAt: Date.now(), waitT: 0 });
    const ch = sb.channel('bm3d-' + code, { config: { broadcast: { self: false }, presence: { key: this.id } } });
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
    this.helloTimer = setInterval(() => { if (this.ch && !this.peer) this.sayHello(false); }, 1500);   // 먼저 들어온 쪽이 놓쳤을 수 있으니 반복
  }
  close() {
    const ch = this.ch; this.ch = null; this.peer = null; this.snap = null; this.pendResume = null;
    if (this.helloTimer) { clearInterval(this.helloTimer); this.helloTimer = null; }
    if (ch) { try { ch.unsubscribe(); Account.sb.removeChannel(ch); } catch (e) { /* 무시 */ } }
  }
  send(m) { if (this.ch) { m.from = this.id; this.ch.send({ type: 'broadcast', event: 'm', payload: m }).catch(() => {}); } }
  sayHello(reply) { this.send({ t: 'hello', host: this.host, hand: this.info.hand, name: this.info.name, win: this.info.win, cid: NET3_CID, reply }); }

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
        if (m.host === this.host) { this.game.netError(this.host ? '같은 코드의 방이 이미 있어요. 다시 만들어 주세요.' : '상대도 입장하는 쪽이에요. 한 명은 방 만들기를 눌러야 해요.'); this.close(); return; }
        this.peer = { id: m.from, cid: String(m.cid || m.from).slice(0, 16), hand: m.hand === 'L' ? 'L' : 'R', name: String(m.name || '친구').slice(0, 16) };
        try { if (this.ch.presenceState()[m.from]) this.peer.seen = true; } catch (e) { /* 무시 */ }   // 접속 목록에 이미 있으면 바로 '본 적 있음' (나감 감지가 빠지지 않게)
        if (!m.reply) this.sayHello(true);
        g.netPeerJoined(this.peer, this.host ? this.info.win : m.win);
        if (this.pendResume) { const r = this.pendResume; this.pendResume = null; g.netResume(r); }
        return;
      }
      case 'resume': if (this.peer) g.netResume(m); else this.pendResume = m; return;
      case 'emo': g.netEmote(m); return;
      case 'opt': g.netOpt(m); return;   // 낙하 표시·그림자: 방 전체 설정
      case 'st': this.snap = { x: -m.x, z: -m.z, y: m.y, vx: -m.vx, vz: -m.vz, e: m.e, dx: -m.dx, dz: -m.dz, ch: m.ch, at: performance.now() }; return;
      case 'sw': g.netSwing(m); return;
      case 'hit': g.netLaunch(m); return;
      case 'pt': g.netPoint(m); return;
      case 'restart': g.netRestart(m); return;
      case 'ping': this.send({ t: 'pong', ts: m.ts }); return;
      case 'pong': { const one = Math.min(0.5, (performance.now() - m.ts) / 2000); this.lat += (one - this.lat) * 0.3; return; }
    }
  }

  // 매 화면 프레임: 내 상태 보내기 · 주기적 ping
  tick(real) {
    if (!this.ch) return;
    const me = this.game.me;
    this.sendT -= real;
    if (this.peer && this.sendT <= 0) {
      this.sendT = 1 / NET3.SNAP_HZ;
      const r = v => Math.round(v * 1000) / 1000;
      this.send({ t: 'st', x: r(me.pos.x), z: r(me.pos.z), y: r(me.y), vx: r(me.vel.x), vz: r(me.vel.z), e: r(me.extT),
        dx: r((me.extDir && me.extDir.x) || 0), dz: r((me.extDir && me.extDir.z) || 0), ch: me.charge ? me.charge.type : null });
    }
    this.pingT -= real;
    if (this.peer && this.pingT <= 0) { this.pingT = NET3.PING_EVERY; this.send({ t: 'ping', ts: performance.now() }); }
  }

  // 고정 간격 시뮬레이션: 상대 선수(opp)를 받은 상태 쪽으로 (AI 대신)
  applyRemote(dt, simRate) {
    const a = this.game.opp, s = this.snap;
    a.moveDir = { x: 0, z: 0 };
    if (!s) return;
    const age = Math.min(0.25, (performance.now() - s.at) / 1000) * simRate;   // 받은 뒤 흐른 게임 시간만큼 앞으로 예측
    const tx = s.x + s.vx * age, tz = s.z + s.vz * age, k = Math.min(1, dt * 18);
    a.pos.x += (tx - a.pos.x) * k; a.pos.z += (tz - a.pos.z) * k;
    a.vel.x = s.vx; a.vel.z = s.vz;
    a.y = s.y; a.vy = 0;
    a.extT = s.e; if (s.e > 0) a.extDir = { x: s.dx, z: s.dz };
    a.charge = s.ch ? (a.charge && a.charge.type === s.ch ? a.charge : { type: s.ch, c: 0.5, dir: 1 }) : null;
  }
}
