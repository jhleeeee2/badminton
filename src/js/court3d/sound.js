// court3d/sound.js — 효과음 (Web Audio로 직접 합성, 파일 없음 → 오프라인 단일 HTML 유지)
//   타격음(세기에 따라), 헛스윙 바람소리, 네트, 착지, 관중 환호, 득점 차임   [게임]
//   브라우저 정책상 첫 키/클릭 뒤에 소리가 켜짐 · M 키로 음소거

const Sound3 = {
  ctx: null, master: null, muted: false, _noise: null,

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
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.55; return this.muted; },

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

  hit(kmh) {   // 셔틀 타격: 짧은 '탁' + 세게 칠수록 낮은 '퍽'
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, k = Math.min(1, kmh / 260);
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
  chime(good) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, n = good ? [660, 880, 1320] : [440, 330];
    n.forEach((f, i) => this._tone(t + i * 0.09, f, f * 0.99, 'sine', 0.22, 0.25));
  }
};
