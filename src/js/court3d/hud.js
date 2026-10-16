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
    const M = C3.CHARGE.MAX;
    this.el.zoneHi.style.left = (C3.CHARGE.FAULT / M * 100) + '%';
    this.el.zoneHi.style.width = ((M - C3.CHARGE.FAULT) / M * 100) + '%';
    this.el.zoneLo.style.width = (C3.CHARGE.SERVE_NET / M * 100) + '%';
    this.el.tick.style.left = (1 / M * 100) + '%';
  }

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
  showMessage(h) { this.el.msg.innerHTML = h; this.el.msg.hidden = false; this.el.startBtn.textContent = h === this.introMsg ? '시작' : '다시 시작'; }
  hideMessage() { this.el.msg.hidden = true; this.el.startBtn.textContent = '다시 시작'; }
  banner(text, color, dur) {
    const b = this.el.banner; b.textContent = text; b.style.color = color; this.bannerT = dur; b.style.opacity = 1;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');   // 튀어나오는 애니메이션 다시 시작
  }
  setMute(m) { const b = document.getElementById('c3muteBtn'); if (b) b.textContent = m ? '🔇 소리' : '🔊 소리'; }
  setSlow(k) { this.el.vig.style.opacity = Math.max(0, Math.min(1, k)) * 0.85; }

  setGauge(ch, name) {
    const g = this.el.gauge;
    if (!ch) { g.hidden = true; return; }
    g.hidden = false;
    const M = C3.CHARGE.MAX, c = ch.c;
    const bad = c > C3.CHARGE.FAULT || (ch.type === 'serve' && c < C3.CHARGE.SERVE_NET);
    this.el.fill.style.width = (c / M * 100) + '%';
    this.el.fill.style.background = bad ? 'var(--bad)' : c > 0.66 ? 'var(--me)' : c > 0.33 ? 'var(--warn)' : 'var(--ok)';
    this.el.zoneLo.hidden = ch.type !== 'serve';
    this.el.glbl.textContent = `${SHOT3_NAMES[ch.type]} · ${name} ${Math.round(c * 100)}%` + (c > C3.CHARGE.FAULT ? (ch.type === 'down' ? ' — 네트!' : ' — 아웃!') : '');
  }

  update(real, me, s) {
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
