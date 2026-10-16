// app/lobby.js — 대기화면: 게임 종류·모드·난이도·목표 점수 선택 후 시작

const LOBBY_STORE_KEY = 'badminton.lobby';

const COURT_ART = {   // 게임 종류 카드의 작은 그림
  side: '<svg viewBox="0 0 120 44" aria-hidden="true"><line x1="4" y1="38" x2="116" y2="38" stroke="currentColor" stroke-width="2"/><line x1="60" y1="38" x2="60" y2="20" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="22" r="3" fill="var(--opp)"/><line x1="26" y1="25" x2="26" y2="38" stroke="var(--opp)" stroke-width="2"/><circle cx="94" cy="22" r="3" fill="var(--me)"/><line x1="94" y1="25" x2="94" y2="38" stroke="var(--me)" stroke-width="2"/><path d="M90 18 Q60 -4 34 20" fill="none" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="3 3"/></svg>',
  persp: '<svg viewBox="0 0 120 44" aria-hidden="true"><polygon points="34,6 86,6 112,40 8,40" fill="none" stroke="currentColor" stroke-width="2"/><line x1="21" y1="23" x2="99" y2="23" stroke="currentColor" stroke-width="2"/><line x1="60" y1="6" x2="60" y2="40" stroke="currentColor" stroke-width="1" opacity=".5"/><ellipse cx="74" cy="32" rx="5" ry="2" fill="currentColor" opacity=".35"/><circle cx="74" cy="17" r="3" fill="var(--warn)"/></svg>'
};

class Lobby {
  constructor(app) {
    const $ = id => document.getElementById(id);
    this.app = app;
    this.sel = { type: 'classic', mode: 'ai', diff: 'normal', win: 11, hand: 'R', train: 'str' };
    this.load();
    this.typeList = $('typeList'); this.modeList = $('modeList');
    this.aiBox = $('aiSettings'); this.trainBox = $('trainSettings'); this.trainList = $('trainList'); this.startBtn = $('lobbyStart'); this.note = $('lobbyNote'); this.handBox = $('handSeg');
    this.renderTypes();
    this.renderModes();
    this.bindSeg('#diffSeg', 'd', v => { this.sel.diff = v; });
    this.bindSeg('#winSeg', 'w', v => { this.sel.win = parseInt(v); });
    this.bindSeg('#handSeg', 'h', v => { this.sel.hand = v; });
    this.startBtn.addEventListener('click', () => this.start());
    this.refresh();
  }

  type() { return GAME_TYPES.find(t => t.id === this.sel.type); }
  modeReady(modeId) { return this.type().modes.includes(modeId); }
  canStart() { return this.modeReady(this.sel.mode); }

  renderTypes() {
    this.typeList.innerHTML = '';
    for (const t of GAME_TYPES) {
      const b = document.createElement('button');
      b.className = 'tcard'; b.dataset.type = t.id;
      b.innerHTML = `<span class="tart">${COURT_ART[t.art]}</span>
        <span class="tname">${t.name}<span class="badge ${t.badge.tone}">${t.badge.text}</span></span>
        <span class="tdesc">${t.desc}</span>`;
      b.addEventListener('click', () => { this.sel.type = t.id; this.refresh(); });
      this.typeList.appendChild(b);
    }
  }

  renderModes() {
    this.modeList.innerHTML = '';
    for (const m of MODES) {
      const b = document.createElement('button');
      b.className = 'mcard'; b.dataset.mode = m.id;
      b.innerHTML = `<span class="mname">${m.name}</span><span class="mdesc">${m.desc}</span>`;
      b.addEventListener('click', () => { this.sel.mode = m.id; this.refresh(); });
      this.modeList.appendChild(b);
    }
  }

  bindSeg(sel, attr, apply) {
    this.segs = this.segs || [];
    const btns = [...document.querySelectorAll(sel + ' button')];
    btns.forEach(b => b.addEventListener('click', () => { apply(b.dataset[attr]); this.refresh(); }));
    this.segs.push({ btns, attr, get: () => String({ d: this.sel.diff, w: this.sel.win, h: this.sel.hand }[attr]) });
  }

  // 선택 상태를 화면에 반영
  refresh() {
    if (!this.modeReady(this.sel.mode) && this.type().modes.length) this.sel.mode = this.type().modes[0];
    for (const b of this.typeList.children) b.classList.toggle('sel', b.dataset.type === this.sel.type);
    for (const b of this.modeList.children) {
      const ready = this.modeReady(b.dataset.mode);
      b.disabled = !ready;
      b.classList.toggle('sel', ready && b.dataset.mode === this.sel.mode);
      const d = b.querySelector('.mdesc'), m = MODES.find(x => x.id === b.dataset.mode);
      d.textContent = ready ? m.desc : '준비 중';
    }
    for (const s of this.segs || []) s.btns.forEach(b => b.classList.toggle('active', b.dataset[s.attr] === s.get()));
    this.aiBox.hidden = this.sel.mode !== 'ai' || !this.canStart();
    this.trainBox.hidden = this.sel.mode !== 'train' || !this.canStart();
    if (!this.trainBox.hidden) this.renderTrain();
    this.handBox.hidden = !(this.type().options || []).includes('hand');
    this.startBtn.disabled = !this.canStart();
    this.note.textContent = this.canStart() ? '' : `${this.type().name} — 이 모드는 아직 준비 중이에요.`;
    this.save();
  }

  // 훈련 카드: 종목·현재 레벨·다음 레벨까지·효과
  renderTrain() {
    this.trainList.innerHTML = '';
    for (const k of ['str', 'agi', 'jud']) {
      const I = TRAIN_INFO[k], L = Progress3.lv[k], b = document.createElement('button');
      b.className = 'trcard' + (this.sel.train === k ? ' sel' : ''); b.style.setProperty('--tc', I.color);
      const pips = Array.from({ length: Progress3.MAX }, (_, i) => `<i class="${i < L ? 'on' : ''}"></i>`).join('');
      b.innerHTML = `<span class="trn">${I.name} <small>${I.drill}</small></span>
        <span class="trlv">Lv.${L}<span class="pips">${pips}</span></span>
        <span class="trd">${I.how}</span>
        <span class="tre">${L >= Progress3.MAX ? '최대 레벨' : '다음 레벨: 연속 ' + Progress3.need(k) + '번 성공'}<br>현재 효과: ${L ? I.effect(L) : '없음'}</span>`;
      b.addEventListener('click', () => { this.sel.train = k; this.refresh(); });
      this.trainList.appendChild(b);
    }
  }

  start() { if (this.canStart()) this.app.launch({ ...this.sel }); }

  // 마지막 선택 기억 (저장이 막힌 환경이면 그냥 기본값)
  load() {
    try {
      const v = JSON.parse(localStorage.getItem(LOBBY_STORE_KEY) || 'null');
      if (v && DIFFS[v.diff] && [11, 15, 21].includes(v.win) && GAME_TYPES.some(t => t.id === v.type)) Object.assign(this.sel, v, { hand: v.hand === 'L' ? 'L' : 'R', train: ['str', 'agi', 'jud'].includes(v.train) ? v.train : 'str' });
    } catch (e) { /* 무시 */ }
  }
  save() { try { localStorage.setItem(LOBBY_STORE_KEY, JSON.stringify(this.sel)); } catch (e) { /* 무시 */ } }
}
