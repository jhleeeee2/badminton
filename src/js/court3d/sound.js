// court3d/sound.js — 효과음 (Web Audio로 직접 합성, 파일 없음 → 오프라인 단일 HTML 유지)
//   타격음(세기에 따라), 헛스윙 바람소리, 네트, 착지, 관중 환호, 득점 차임   [게임]
//   배경음악은 없음. 대신 인상적인 순간(스매시 득점·긴 랠리·극적인 수비)에만 관중 박수갈채 applause()   [게임]
//   브라우저 정책상 첫 키/클릭 뒤에 소리가 켜짐 · M 키로 음소거 (브라우저에 기억)

const Sound3 = {
  ctx: null, master: null, muted: false, _noise: null,
  loadPrefs() { try { this.muted = localStorage.getItem('badminton.c3.mute') === '1'; } catch (e) { /* 무시 */ } },
  savePrefs() { try { localStorage.setItem('badminton.c3.mute', this.muted ? '1' : '0'); } catch (e) { /* 무시 */ } },


  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.55; this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = b;
  },
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.55; this.savePrefs(); return this.muted; },

  _env(node, t0, a, peak, dec) {
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
    node.connect(g); g.connect(this.master); return g;
  },
  _noiseBurst(t0, freq, q, peak, dec, dur) {
    const s = this.ctx.createBufferSource(); s.buffer = this._noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    s.connect(f); this._env(f, t0, 0.003, peak, dec); s.start(t0, Math.random()); s.stop(t0 + (dur || dec + 0.05));
    return f;
  },
  _tone(t0, f0, f1, type, peak, dec) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dec);
    this._env(o, t0, 0.004, peak, dec); o.start(t0); o.stop(t0 + dec + 0.05);
  },

  // 셔틀 타격: 짧은 '탁' + 세게 칠수록 낮은 '퍽'. soft = 네트 앞 살짝 놓는 공('톡'), high = 높이 띄우는 공('팡')
  hit(kmh, kind) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, k = Math.min(1, kmh / 260);
    if (kind === 'soft') { this._noiseBurst(t, 3400, 2.2, 0.22, 0.03); this._tone(t, 1250, 700, 'sine', 0.12, 0.05); return; }
    if (kind === 'high') this._tone(t, 520, 300, 'triangle', 0.22, 0.11);   // 줄이 울리는 느낌
    this._noiseBurst(t, 2600 + 1600 * k, 1.4, 0.5 + 0.4 * k, 0.05 + 0.04 * k);
    this._tone(t, 900 - 300 * k, 180, 'triangle', 0.25 + 0.35 * k, 0.06 + 0.06 * k);
    if (k > 0.55) this._tone(t, 140, 55, 'sine', 0.5 * k, 0.18);   // 스매시 저음
  },
  smash(k) {   // 스매시 추가음: 깊은 '쾅' + 공기 찢는 소리
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this._tone(t, 110, 38, 'sine', 0.55 + 0.35 * k, 0.32);
    this._noiseBurst(t, 4200, 0.9, 0.35 + 0.25 * k, 0.12);
    this._noiseBurst(t + 0.02, 1500, 0.7, 0.18 + 0.15 * k, 0.3, 0.35);
  },
  blip(mine) {   // 감정표현 알림 '뿅'
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, f = mine ? 660 : 880;
    this._tone(t, f, f * 1.5, 'sine', 0.18, 0.09); this._tone(t + 0.07, f * 1.5, f * 2, 'sine', 0.14, 0.08);
  },
  squeak() {   // 신발이 바닥에 끌리는 '끽' (런지)
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime; this._tone(t, 1900 + Math.random() * 500, 1300, 'sawtooth', 0.045, 0.07); this._noiseBurst(t, 3000, 6, 0.08, 0.06);
  },
  whoosh() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime; this._noiseBurst(t, 900, 0.8, 0.12, 0.16, 0.2); },
  net() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime; this._noiseBurst(t, 500, 2, 0.4, 0.22); this._tone(t, 220, 90, 'sine', 0.2, 0.2); },
  land() { if (!this.ctx || this.muted) return; const t = this.ctx.currentTime; this._noiseBurst(t, 700, 1.2, 0.25, 0.08); },
  cheer(a) {   // 관중 환호: 넓은 대역 잡음이 커졌다 잦아듦
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, s = this.ctx.createBufferSource(); s.buffer = this._noise; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.6;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 + 0.25 * a, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 1.9);
  },
  // 박수갈채: 짧은 '짝' 수십~수백 개를 흩뿌림. a(0~1)가 클수록 크고 길고 촘촘함, 0.6 이상이면 환호도 함께
  applause(a) {
    if (!this.ctx || this.muted) return;
    a = Math.max(0.15, Math.min(1, a));
    const t = this.ctx.currentTime, dur = 1.4 + 1.8 * a, n = Math.round(dur * (22 + 48 * a));
    for (let i = 0; i < n; i++) {
      const u = Math.random(), env = Math.min(1, u / 0.12) * Math.pow(1 - u, 1.3);   // 빠르게 커졌다가 서서히 잦아듦
      if (env < 0.03) continue;
      this._noiseBurst(t + u * dur, 1100 + Math.random() * 1700, 1.6, (0.5 + 0.6 * a) * env, 0.012 + Math.random() * 0.012);
    }
    if (a >= 0.6) this.cheer(a);
  },
  chime(good) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, n = good ? [660, 880, 1320] : [440, 330];
    n.forEach((f, i) => this._tone(t + i * 0.09, f, f * 0.99, 'sine', 0.22, 0.25));
  }
};
Sound3.loadPrefs();
