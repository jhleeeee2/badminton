// court3d/hud.js — 3D 화면 HTML 표시: 점수·서브권, 최근 샷, 충전 게이지(빨간 실패 구간), 포/백 예측, 배너, 슬로우 효과

class Hud3D {
  constructor() {
    const $ = id => document.getElementById(id);
    this.el = {
      pts: $('c3pts'), opts: $('c3opts'), rally: $('c3rally'), shot: $('c3shot'), cfg: $('c3cfg'),
      srvMe: $('c3srvMe'), srvOpp: $('c3srvOpp'), msg: $('c3msg'), banner: $('c3banner'), hint: $('c3hint'),
      gauge: $('c3gauge'), fill: $('c3fill'), glbl: $('c3glbl'), hand: $('c3hand'), vig: $('c3vig'),
      zoneLo: $('c3zoneLo'), zoneHi: $('c3zoneHi'), tick: $('c3tick'), startBtn: $('c3startBtn'), ext: $('c3ext'), extFill: $('c3extFill'), bMe: $('c3bMe'), bOpp: $('c3bOpp'), board: $('c3board'), bTag: $('c3bTag'), flash: $('c3flash')
    };
    this.introMsg = this.el.msg.innerHTML;
    this.bannerT = 0;
    // 로컬 2인 P2 게이지 (오른쪽 위) — 게이지 요소 묶음을 따로 둬서 setGauge를 같이 씀
    this.g2 = { gauge: $('c3gauge2'), fill: $('c3fill2'), glbl: $('c3glbl2'), zoneLo: $('c3zoneLo2'), zoneHi: $('c3zoneHi2'), tick: $('c3tick2') };
    this.p2Box = $('c3p2');
    const M = C3.CHARGE.MAX;
    for (const e of [this.el, this.g2]) {
      if (!e.zoneHi) continue;
      e.zoneHi.style.left = (C3.CHARGE.FAULT / M * 100) + '%';
      e.zoneHi.style.width = ((M - C3.CHARGE.FAULT) / M * 100) + '%';
      e.zoneLo.style.width = (C3.CHARGE.SERVE_NET / M * 100) + '%';
      e.tick.style.left = (1 / M * 100) + '%';
    }
  }
  setDuo(on) { if (this.p2Box) this.p2Box.hidden = !on; if (!on) this.setGauge(null, '', this.g2); }

  setScore(p, o, server, mp) {
    this.el.pts.textContent = p; this.el.opts.textContent = o;
    this.el.srvMe.hidden = server !== 'me'; this.el.srvOpp.hidden = server !== 'opp';
    // 코트 위 큰 점수판
    const bump = (el, v) => { if (el.textContent !== String(v)) { el.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } };
    bump(this.el.bMe, p); bump(this.el.bOpp, o);
    this.el.board.classList.toggle('srvMe', server === 'me'); this.el.board.classList.toggle('srvOpp', server === 'opp');
    this.el.board.classList.toggle('mpMe', mp === 'me'); this.el.board.classList.toggle('mpOpp', mp === 'opp');
    this.el.bTag.textContent = mp ? (mp === 'me' ? '매치 포인트' : '상대 매치 포인트') : '';
    this.el.pts.parentElement.classList.toggle('mp', mp === 'me'); this.el.opts.parentElement.classList.toggle('mp', mp === 'opp');
  }
  // 훈련 진행 표시 (null이면 경기 점수판)
  setTrain(t) {
    const b = this.el.board; b.classList.toggle('train', !!t);
    if (!t) { b.querySelector('.opp .nm').textContent = '상대'; b.querySelector('.me .nm').textContent = '나'; this.el.bTag.style.background = ''; this.el.bTag.style.color = ''; return; }
    b.classList.remove('mpMe', 'mpOpp', 'srvMe', 'srvOpp');
    b.querySelector('.opp .nm').textContent = '연속'; b.querySelector('.me .nm').textContent = '목표';
    this.el.bOpp.textContent = t.streak; this.el.bMe.textContent = t.lv >= t.max ? '—' : t.need;
    this.el.bTag.textContent = `${t.name} Lv.${t.lv}` + (t.lv >= t.max ? ' (최대)' : '');
    this.el.bTag.style.background = t.color; this.el.bTag.style.color = '#14122a';
  }
  flash(color, a) {   // 스매시 순간 화면 번쩍
    const f = this.el.flash; f.style.background = `radial-gradient(ellipse at center, ${color}55 0%, ${color}00 70%)`;
    f.style.transition = 'none'; f.style.opacity = a; void f.offsetWidth; f.style.transition = 'opacity .35s ease-out'; f.style.opacity = 0;
  }
  setRally(n) {
    const r = this.el.rally; r.textContent = n;
    r.parentElement.classList.toggle('hot', n >= 8);
    r.classList.remove('bump'); void r.offsetWidth; if (n > 0) r.classList.add('bump');
  }
  setShot(t) { this.el.shot.textContent = t; }
  setConfig(t) { this.el.cfg.textContent = t; }
  setHint(t) { this.el.hint.textContent = t; }
  showMessage(h) { this.el.msg.innerHTML = '<div>' + h + '</div>';   // div로 감싸야 <br> 줄바꿈이 가로로 안 펼쳐짐
    this.el.msg.hidden = false; this.el.startBtn.textContent = h === this.introMsg ? '시작' : '다시 시작'; }
  hideMessage() { this.el.msg.hidden = true; this.el.startBtn.textContent = '다시 시작'; }
  banner(text, color, dur) {
    const b = this.el.banner; b.textContent = text; b.style.color = color; this.bannerT = dur; b.style.opacity = 1;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');   // 튀어나오는 애니메이션 다시 시작
  }
  setLand(on) { const b = document.getElementById('c3landBtn'); if (b) { b.textContent = on ? '📍 낙하 표시 켬' : '📍 낙하 표시 끔'; b.classList.toggle('off', !on); } }
  setRoom(code) {   // 게임 중 상단에 방 코드 (null이면 숨김)
    const el = document.getElementById('c3room'); if (!el) return;
    el.hidden = !code; if (code) document.getElementById('c3roomCode').textContent = code;
  }
  setShadow(on) { const b = document.getElementById('c3shadowBtn'); if (b) { b.textContent = on ? '🌑 그림자 켬' : '🌑 그림자 끔'; b.classList.toggle('off', !on); } }
  // 친구 방 세트 스코어 (null이면 숨김)
  setSets(st) {
    const el = document.getElementById('c3bSets'); if (!el) return;
    el.hidden = !st; if (st) el.innerHTML = `<b>${st.opp}</b><span>세트</span><b>${st.me}</b>`;   // 위 점수판과 같은 순서 (왼쪽 상대 · 오른쪽 나)
  }
  setMute(m) { const b = document.getElementById('c3muteBtn'); if (b) b.textContent = m ? '🔇 소리' : '🔊 소리'; }
  setSlow(k) { this.el.vig.style.opacity = Math.max(0, Math.min(1, k)) * 0.85; }

  setGauge(ch, name, E) {
    E = E || this.el;
    const g = E.gauge; if (!g) return;
    if (!ch) { g.hidden = true; return; }
    g.hidden = false;
    const M = C3.CHARGE.MAX, c = ch.c;
    const bad = c > C3.CHARGE.FAULT || (ch.type === 'serve' && c < C3.CHARGE.SERVE_NET);
    E.fill.style.width = (c / M * 100) + '%';
    E.fill.style.background = bad ? 'var(--bad)' : c > 0.66 ? 'var(--me)' : c > 0.33 ? 'var(--warn)' : 'var(--ok)';
    E.zoneLo.hidden = ch.type !== 'serve';
    E.glbl.textContent = (E === this.g2 ? 'P2 ' : '') + `${SHOT3_NAMES[ch.type]} · ${name} ${Math.round(c * 100)}%` + (c > C3.CHARGE.FAULT ? (ch.type === 'down' ? ' — 네트!' : ' — 아웃!') : '');
  }

  update(real, me, s, p2) {
    if (p2) {   // 로컬 2인: P2 게이지
      const c2 = p2.charge;
      if (c2) this.setGauge(c2, Shots3.name({ type: c2.type, p0: s.live ? s.p : { x: p2.pos.x, y: 1, z: p2.pos.z }, jumping: !p2.onGround() }, Math.min(1, c2.c)), this.g2);
      else this.setGauge(null, '', this.g2);
    }
    if (this.bannerT > 0) { this.bannerT -= real; this.el.banner.style.opacity = Math.min(1, this.bannerT * 2); }
    const ch = me.charge;
    if (ch) {
      const p0 = s.live ? s.p : { x: me.pos.x, y: 1, z: me.pos.z };
      const name = Shots3.name({ type: ch.type, p0, jumping: !me.onGround() }, Math.min(1, ch.c));
      this.setGauge(ch, name);
    } else this.setGauge(null);
    // Shift 런지 상태: 준비됨 / 사용 중 / 재충전
    const ek = me.extCharge(), using = me.extT > 0;
    this.el.extFill.style.width = (ek * 100) + '%';
    this.el.ext.className = 'c3ext' + (ek >= 1 ? ' ready' : '') + (using ? ' using' : '');
    const pr = me.predict;
    this.el.hand.textContent = pr ? `${HAND_NAMES[pr.hand]} · ${CAT_NAMES[pr.cat]}` : '';
    this.el.hand.className = 'c3hand' + (pr ? ' ' + pr.hand : '');
  }
}
