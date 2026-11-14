// court3d/sound.js — 효과음 (Web Audio로 직접 합성, 파일 없음 → 오프라인 단일 HTML 유지)
//   타격음(세기에 따라), 헛스윙 바람소리, 네트, 착지, 관중 환호, 득점 차임   [게임]
//   배경음(BGM)도 파일 없이 합성: 112BPM 8마디 반복(Am–F–C–G), 킥·하이햇·베이스·패드·짧은 멜로디 + 관중 웅성거림   [게임]
//   브라우저 정책상 첫 키/클릭 뒤에 소리가 켜짐 · M 키로 전체 음소거 · B 키로 배경음만 켜기/끄기 (둘 다 브라우저에 기억)

const Sound3 = {
  ctx: null, master: null, muted: false, _noise: null,
  music: null, musicOn: true, playing: false, _timer: null, _step: 0, _next: 0, _amb: null,
  MUSIC_VOL: 0.5, BPM: 112,
  loadPrefs() { try { this.muted = localStorage.getItem('badminton.c3.mute') === '1'; this.musicOn = localStorage.getItem('badminton.c3.music') !== '0'; } catch (e) { /* 무시 */ } },
  savePrefs() { try { localStorage.setItem('badminton.c3.mute', this.muted ? '1' : '0'); localStorage.setItem('badminton.c3.music', this.musicOn ? '1' : '0'); } catch (e) { /* 무시 */ } },


  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.55; this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = b;
    this.music = this.ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.master);   // 배경음 전용 볼륨
    if (this.playing) this._musicStart();   // 소리가 풀리기 전에 경기가 시작된 경우
  },
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.55; this.savePrefs(); return this.muted; },
  toggleMusic() { this.musicOn = !this.musicOn; this.savePrefs(); if (this.playing) { if (this.musicOn) this._musicStart(); else this._musicStop(); } return this.musicOn; },

  // ───── 배경음 ─────
  // 경기·훈련 화면에 들어가면 play(true), 메뉴로 나가면 play(false)
  play(on) {
    this.playing = !!on;
    if (on) this._musicStart(); else this._musicStop();
  },
  _musicStart() {
    if (!this.ctx || !this.musicOn || this._timer) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t); this.music.gain.setValueAtTime(Math.max(0.0001, this.music.gain.value), t); this.music.gain.exponentialRampToValueAtTime(this.MUSIC_VOL, t + 0.8);
    this._step = 0; this._next = t + 0.1;
    this._timer = setInterval(() => this._schedule(), 90);
    // 관중 웅성거림: 낮게 깔리는 잡음
    const s = this.ctx.createBufferSource(); s.buffer = this._noise; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.35;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    s.connect(f); f.connect(g); g.connect(this.music); s.start();
    this._amb = s;
  },
  _musicStop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t); this.music.gain.setValueAtTime(Math.max(0.0001, this.music.gain.value), t); this.music.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    if (this._amb) { try { this._amb.stop(t + 0.5); } catch (e) { /* 무시 */ } this._amb = null; }
  },
  // 앞으로 0.3초 안에 울릴 음을 미리 예약 (16분음표 단위, 한 마디 = 16칸, 8마디 반복)
  _schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const dur = 60 / this.BPM / 4;
    if (this._next < this.ctx.currentTime - 0.5) this._next = this.ctx.currentTime + 0.05;   // 탭이 멈췄다 돌아온 경우 밀린 음을 몰아 치지 않음
    while (this._next < this.ctx.currentTime + 0.3) { this._note(this._step, this._next, dur); this._step = (this._step + 1) % 128; this._next += dur; }
  },
  _mEnv(node, t0, a, peak, dec) {
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
    node.connect(g); g.connect(this.music);
  },
  _mTone(t0, f, type, peak, a, dec) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    this._mEnv(o, t0, a, peak, dec); o.start(t0); o.stop(t0 + a + dec + 0.05); return o;
  },
  _note(step, t, dur) {
    // 코드 진행 [게임]: Am – F – C – G (각 2마디). bass = 근음, ch = 화음 3음
    const CH = [
      { bass: 110.0, ch: [220.0, 261.63, 329.63] }, { bass: 87.31, ch: [174.61, 220.0, 261.63] },
      { bass: 130.81, ch: [164.81, 196.0, 261.63] }, { bass: 98.0, ch: [146.83, 196.0, 246.94] }
    ];
    const bar = Math.floor(step / 16), s = step % 16, c = CH[Math.floor(bar / 2) % 4];
    if (s === 0 || s === 8 || (s === 10 && bar % 2 === 1)) {   // 킥
      const o = this._mTone(t, 120, 'sine', s === 10 ? 0.25 : 0.45, 0.003, 0.14); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    }
    if (s % 4 === 2) {   // 하이햇
      const n = this.ctx.createBufferSource(); n.buffer = this._noise;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      n.connect(f); this._mEnv(f, t, 0.002, 0.06, 0.04); n.start(t, Math.random()); n.stop(t + 0.08);
    }
    if ([0, 3, 6, 8, 11, 14].includes(s)) this._mTone(t, c.bass, 'triangle', 0.22, 0.005, dur * 1.6);   // 베이스
    if (s === 0) for (const f of c.ch) {   // 패드: 한 마디 길이 화음 (낮은 통과 필터로 부드럽게)
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      o.connect(lp); this._mEnv(lp, t, 0.12, 0.035, dur * 15); o.start(t); o.stop(t + dur * 16 + 0.1);
    }
    const ARP = { 0: 0, 4: 1, 7: 2, 10: 1, 12: 2, 14: 0 };   // 짧은 멜로디: 화음 음을 한 옥타브 위에서
    if (s in ARP && bar % 4 !== 3) this._mTone(t, c.ch[ARP[s]] * 2, 'triangle', 0.07, 0.004, dur * 1.8);
  },

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
  chime(good) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, n = good ? [660, 880, 1320] : [440, 330];
    n.forEach((f, i) => this._tone(t + i * 0.09, f, f * 0.99, 'sine', 0.22, 0.25));
  }
};
Sound3.loadPrefs();
