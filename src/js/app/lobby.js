// app/lobby.js — 대기화면: 게임 종류·모드·난이도·목표 점수 선택 후 시작

const LOBBY_STORE_KEY = 'badminton.lobby';
const NICK_STORE_KEY = 'badminton.nick';   // 친선게임 닉네임 (두 게임 종류 공용, 이 브라우저에 기억)

const COURT_ART = {   // 게임 종류 카드의 작은 그림
  side: '<svg viewBox="0 0 120 44" aria-hidden="true"><line x1="4" y1="38" x2="116" y2="38" stroke="currentColor" stroke-width="2"/><line x1="60" y1="38" x2="60" y2="20" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="22" r="3" fill="var(--opp)"/><line x1="26" y1="25" x2="26" y2="38" stroke="var(--opp)" stroke-width="2"/><circle cx="94" cy="22" r="3" fill="var(--me)"/><line x1="94" y1="25" x2="94" y2="38" stroke="var(--me)" stroke-width="2"/><path d="M90 18 Q60 -4 34 20" fill="none" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="3 3"/></svg>',
  persp: '<svg viewBox="0 0 120 44" aria-hidden="true"><polygon points="34,6 86,6 112,40 8,40" fill="none" stroke="currentColor" stroke-width="2"/><line x1="21" y1="23" x2="99" y2="23" stroke="currentColor" stroke-width="2"/><line x1="60" y1="6" x2="60" y2="40" stroke="currentColor" stroke-width="1" opacity=".5"/><ellipse cx="74" cy="32" rx="5" ry="2" fill="currentColor" opacity=".35"/><circle cx="74" cy="17" r="3" fill="var(--warn)"/></svg>'
};

// 한글(두벌식) → 같은 자리의 영문 키. 예: 'ㅁ'→a, '무'→an, 'ㄱ'→r
const HG_KEY = { 'ㅂ':'q','ㅈ':'w','ㄷ':'e','ㄱ':'r','ㅅ':'t','ㅛ':'y','ㅕ':'u','ㅑ':'i','ㅐ':'o','ㅔ':'p','ㅁ':'a','ㄴ':'s','ㅇ':'d','ㄹ':'f','ㅎ':'g','ㅗ':'h','ㅓ':'j','ㅏ':'k','ㅣ':'l','ㅋ':'z','ㅌ':'x','ㅊ':'c','ㅍ':'v','ㅠ':'b','ㅜ':'n','ㅡ':'m',
  'ㅃ':'Q','ㅉ':'W','ㄸ':'E','ㄲ':'R','ㅆ':'T','ㅒ':'O','ㅖ':'P',
  'ㅘ':'hk','ㅙ':'ho','ㅚ':'hl','ㅝ':'nj','ㅞ':'np','ㅟ':'nl','ㅢ':'ml',
  'ㄳ':'rt','ㄵ':'sw','ㄶ':'sg','ㄺ':'fr','ㄻ':'fa','ㄼ':'fq','ㄽ':'ft','ㄾ':'fx','ㄿ':'fv','ㅀ':'fg','ㅄ':'qt' };
const HG_CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', HG_JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const HG_JONG = ['', 'ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function hangulToQwerty(s) {
  let out = '';
  for (const c of s) {
    const n = c.charCodeAt(0) - 0xAC00;
    if (n >= 0 && n < 11172) {   // 완성형 음절 → 초성·중성·종성
      const jo = HG_JONG[n % 28], ju = HG_JUNG[Math.floor(n / 28) % 21], ch = HG_CHO[Math.floor(n / 588)];
      out += HG_KEY[ch] + HG_KEY[ju] + (jo ? HG_KEY[jo] : '');
    } else out += HG_KEY[c] || c;
  }
  return out;
}

// 커리어 초기화 확인 (확인 창이 막힌 환경이면 그냥 진행)
function confirmReset() { try { return window.confirm('커리어 진행을 처음으로 되돌릴까요? (훈련 레벨은 그대로)'); } catch (e) { return true; } }

class Lobby {
  constructor(app) {
    const $ = id => document.getElementById(id);
    this.app = app;
    this.sel = { type: 'court3d', mode: 'ai', diff: 'normal', win: 11, hand: 'R', train: 'str', style: 'base' };
    this.load();
    this.typeList = $('typeList'); this.modeList = $('modeList');
    this.aiBox = $('aiSettings'); this.trainBox = $('trainSettings'); this.trainList = $('trainList'); this.startBtn = $('lobbyStart'); this.note = $('lobbyNote'); this.handBox = $('handSeg');
    this.skinSec = $('skinSettings'); this.skinBox = $('skinBox');
    this.gearBox = $('gearSettings'); this.gearList = $('gearList'); this.statSec = $('statSettings'); this.statBox = $('statBox');
    this.careerBox = $('careerSettings'); this.careerList = $('careerList'); this.careerNote = $('careerNote'); this.cstage = null;   // cstage: 직접 고른 커리어 경기 (null = 다음 도전 경기)
    $('careerReset').addEventListener('click', () => { if (!Career3.cleared || confirmReset()) { Career3.reset(); this.cstage = null; this.refresh(); } });
    this.dailyBox = $('dailySettings'); this.dailyCard = $('dailyCard'); this.dailyRank = $('dailyRank');
    this.roomBox = $('roomSettings'); this.roomCode = $('roomCode'); this.diffBox = $('diffSeg'); this.aiHead = $('aiHead');
    this.renderTypes();
    this.renderModes();
    this.bindSeg('#diffSeg', 'd', v => { this.sel.diff = v; });
    this.bindSeg('#winSeg', 'w', v => { this.sel.win = parseInt(v); });
    this.bindSeg('#handSeg', 'h', v => { this.sel.hand = v; });
    this.bindSeg('#styleSeg', 's', v => { this.sel.style = v; });
    this.startBtn.addEventListener('click', () => this.start());
    $('roomCreate').addEventListener('click', () => { this.clearRoomCode(); this.start(); });
    $('roomJoin').addEventListener('click', () => this.start());
    // 방 코드: 한글 입력 상태여도 영문으로 — 글자·숫자 키는 키 위치(e.code)로 직접 넣고(want에 기억),
    //   한글 입력기가 따로 넣은 글자(ㅁ, 무 …)는 받자마자 want로 되돌림 → 한 번 누르면 한 글자만 들어감
    //   (한글 상태에선 브라우저가 keydown의 preventDefault를 무시하고 입력기 글자도 넣어서 두 번 쳐지던 문제)
    //   붙여넣기·지우기는 그대로 받고, 붙여넣은 한글은 두벌식 자판 위치대로 영문 변환
    const rc = this.roomCode, norm = v => hangulToQwerty(v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    let want = '', wantPos = 0;
    const put = (v, pos) => { want = v; wantPos = Math.min(pos, v.length); rc.value = v; try { rc.setSelectionRange(wantPos, wantPos); } catch (e) { /* 무시 */ } };
    const restore = () => { if (rc.value !== want) put(want, wantPos); };
    this.clearRoomCode = () => put('', 0);
    rc.addEventListener('keydown', e => {
      const m = /^(?:Key([A-Z])|Digit([0-9])|Numpad([0-9]))$/.exec(e.code);
      if (!m || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      const ch = m[1] || m[2] || m[3];
      const s = Math.min(rc.selectionStart ?? want.length, want.length), t = Math.min(rc.selectionEnd ?? s, want.length);
      const v = want.slice(0, s) + ch + want.slice(t);
      if (v.length > 5) { restore(); return; }
      put(v, s + 1);
    });
    rc.addEventListener('input', e => {
      const ty = e.inputType || '';
      if (ty === 'insertFromPaste' || ty === 'insertFromDrop' || ty.startsWith('delete')) { const pos = rc.selectionStart || 0; const v = norm(rc.value); put(v, Math.min(pos, v.length)); }
      else restore();   // 입력기·기타 글자는 무시
    });
    rc.addEventListener('compositionupdate', () => setTimeout(restore, 0));
    rc.addEventListener('compositionend', () => { restore(); setTimeout(restore, 0); });
    rc.addEventListener('blur', restore);
    // 닉네임: 입력할 때마다 저장 → 메뉴로 돌아오거나 다음 판·새로고침 때도 그대로 채워져 있음
    this.nick = $('roomNick'); this.nickHint = $('roomNickHint');
    this.nick.value = this.loadNick();
    this.nick.addEventListener('input', () => { this.nick.classList.remove('need'); this.saveNick(); });
    this.nick.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); e.stopPropagation(); this.roomCode.focus(); } });
    if (typeof Account !== 'undefined' && Account.on) Account.on(() => { if (!this.nick.value.trim() && Account.nickname) { this.nick.value = Account.nickname; this.saveNick(); } });
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
    this.segs.push({ btns, attr, get: () => String({ d: this.sel.diff, w: this.sel.win, h: this.sel.hand, s: this.sel.style }[attr]) });
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
    const room = this.sel.mode === 'room', career = this.sel.mode === 'career';
    const daily = this.sel.mode === 'daily';
    this.aiBox.hidden = !(this.sel.mode === 'ai' || room || career || daily) || !this.canStart();
    this.diffBox.hidden = room || career || daily; this.aiHead.textContent = room ? '대전 설정' : career ? '커리어 설정' : daily ? '일일 챌린지 설정' : 'AI 대전 설정';
    document.getElementById('winSeg').hidden = career || daily;
    this.dailyBox.hidden = !daily || !this.canStart();
    if (!this.dailyBox.hidden) this.renderDaily();   // 커리어는 경기마다 목표 점수가 정해져 있음
    this.careerBox.hidden = !career || !this.canStart();
    this.gearBox.hidden = !(this.sel.type === 'court3d' && (this.sel.mode === 'ai' || career)) || !this.canStart() || typeof Gear3 === 'undefined';
    if (!this.gearBox.hidden) this.renderGear();
    this.statSec.hidden = this.gearBox.hidden || typeof Stats3 === 'undefined';
    if (!this.statSec.hidden) this.renderStats();
    if (!this.careerBox.hidden) this.renderCareer();
    this.roomBox.hidden = !room || !this.canStart();
    this.trainBox.hidden = this.sel.mode !== 'train' || !this.canStart();
    if (!this.trainBox.hidden) this.renderTrain();
    this.skinSec.hidden = this.sel.type !== 'court3d' || !this.canStart() || typeof Skin3 === 'undefined';
    if (!this.skinSec.hidden) this.renderSkins();
    this.handBox.hidden = !(this.type().options || []).includes('hand');
    const sb = document.getElementById('styleSeg');   // 상대 성향: 3D AI 대전에서만
    if (sb) { sb.hidden = !(this.sel.type === 'court3d' && this.sel.mode === 'ai'); const st = typeof C3 !== 'undefined' && C3.AI_STYLE[this.sel.style];
      if (!sb.hidden && st && this.sel.style !== 'base') this.aiHead.textContent = 'AI 대전 설정 — ' + st.name + ': ' + st.desc; }
    const gb = document.getElementById('lobbyGuide'); if (gb) gb.hidden = this.sel.type !== 'court3d';
    this.startBtn.disabled = !this.canStart();
    this.note.textContent = this.canStart() ? '' : `${this.type().name} — 이 모드는 아직 준비 중이에요.`;
    this.save();
  }

  // 일일 챌린지: 오늘의 종목·내 최고 점수 + 순위표(서버). 순위표는 30초에 한 번만 다시 받음
  renderDaily() {
    const day = Daily3.day(), k = Daily3.kind(), I = TRAIN_INFO[k], t = Daily3.today(), fmt = n => n.toLocaleString('en-US');
    this.dailyCard.style.setProperty('--tc', I.color);
    this.dailyCard.innerHTML = `<span class="dn">오늘의 종목 · ${I.name} <small>${I.drill} · ${day}</small></span>
      <span class="dd">${I.how}</span>
      <span class="dd">성공 1번 = ${Daily3.BASE}점 + 연속 보너스(2번째부터 +${Daily3.BONUS}씩, 최대 +${Daily3.BONUS_MAX}) · 만점 ${fmt(Daily3.maxScore())}점</span>
      <span class="db">${t.tries ? `내 최고 <b>${fmt(t.best)}점</b> · 도전 ${t.tries}번` : '아직 도전하지 않았어요'}</span>`;
    const R = this.dailyRank, logged = typeof Account !== 'undefined' && Account.loggedIn;
    const draw = r => {
      R.innerHTML = '<span class="dn">오늘의 순위 <small>상위 10명</small></span>';
      const add = (cls, txt) => { const e = document.createElement('span'); e.className = cls; e.textContent = txt; R.appendChild(e); return e; };
      if (!r) add('dd', '순위표를 불러오는 중…');
      else if (!r.ok) add('dd', r.missing ? '순위표는 아직 준비 중이에요. 내 최고 기록은 이 브라우저에 저장됩니다.' : '순위표를 불러오지 못했어요 (인터넷 연결 확인).');
      else if (!r.rows.length) add('dd', '아직 기록이 없어요 — 첫 번째로 올려 보세요!');
      else r.rows.forEach((x, i) => { const row = add('drow' + (x.mine ? ' mine' : ''), ''); for (const c of [i + 1 + '위', x.nickname, fmt(x.score) + '점']) { const sp = document.createElement('span'); sp.textContent = c; row.appendChild(sp); } });
      if (r && r.ok && !logged) add('dd', '로그인하면 내 점수도 순위표에 올라가요.');
    };
    const C = this.dailyCache;
    if (C && C.day === day && C.logged === logged && Date.now() - C.at < 30000) return draw(C.r);
    draw(null);
    if (typeof Account === 'undefined' || !Account.online) return draw({ ok: false });
    Account.dailyTop(day).then(r => { this.dailyCache = { day, logged, at: Date.now(), r }; if (this.sel.mode === 'daily' && !this.dailyBox.hidden) draw(r); });
  }

  // 커리어: 고른 경기 (없거나 잠겨 있으면 다음에 도전할 경기)
  careerStage() { return this.cstage != null && Career3.unlocked(this.cstage) ? this.cstage : Career3.current(); }
  // 커리어 대진표: 대회 카드 4개 × 경기 3개. 깬 경기 ✓ · 도전할 경기 ▶ · 잠긴 경기 🔒 (깬 경기는 눌러서 다시 할 수 있음)
  renderCareer() {
    this.careerList.innerHTML = '';
    const pick = this.careerStage();
    Career3.CUPS.forEach((cup, ci) => {
      const box = document.createElement('div'), st = Career3.stages().filter(s => s.cupIdx === ci);
      const won = st.every(s => s.idx < Career3.cleared), open = Career3.unlocked(st[0].idx);
      box.className = 'cupcard' + (won ? ' won' : '') + (open ? '' : ' lock'); box.style.setProperty('--tc', cup.color);
      box.innerHTML = `<span class="cupn">${won ? '🏆 ' : ''}${cup.name}</span>`;
      for (const s of st) {
        const b = document.createElement('button'), done = s.idx < Career3.cleared, ok = Career3.unlocked(s.idx);
        b.className = 'crow' + (done ? ' done' : '') + (s.idx === pick ? ' sel' : ''); b.disabled = !ok;
        b.innerHTML = `<span class="cmark">${done ? '✓' : ok ? '▶' : '🔒'}</span><span class="crd">${s.round}</span><span class="cnm">${ok ? s.name : '???'}</span><span class="cdf">${ok ? Career3.diffLabel(s) + ' · ' + s.win + '점' : ''}</span>`;
        b.addEventListener('click', () => { this.cstage = s.idx; this.refresh(); });
        box.appendChild(b);
      }
      this.careerList.appendChild(box);
    });
    const s = Career3.stage(pick), sty = C3.AI_STYLE[s.style];
    this.careerNote.textContent = (Career3.done() ? '모든 대회 우승! · ' : '') + `${s.cup} ${s.round} — ${s.name} (${sty.name}: ${sty.desc})`;
    document.getElementById('careerReset').hidden = !Career3.cleared;
  }

  // 내 채: 채 3종 카드 — 구매 / 장착 / 강화(장단점이 함께 커짐) / 쓰는 강화 단계 고르기
  renderGear() {
    const G = Gear3, box = this.gearList, coins = Wallet.coins, ask = t => { try { return window.confirm(t); } catch (e) { return true; } };
    box.innerHTML = '';
    for (const id of Object.keys(G.RACKETS)) {
      const R = G.RACKETS[id], has = G.has(id), eq = G.eq === id, L = G.lv(id), U = G.useLv(id), P = G.pros(id, has ? U : 0), card = document.createElement('div');
      card.className = 'gcard' + (eq ? ' sel' : '') + (has ? '' : ' lock'); card.style.setProperty('--tc', R.color);
      const pips = R.max ? `<span class="pips">${Array.from({ length: R.max }, (_, i) => `<i class="${i < U ? 'on' : i < L ? 'own' : ''}"></i>`).join('')}</span>` : '';
      card.innerHTML = `<span class="trn">${R.name}${has && U ? ' +' + U : ''} <small>${eq ? '장착 중' : has ? '보유' : '🪙 ' + Wallet.fmt(R.price)}</small></span>${pips}
        <span class="trd">${R.desc}</span>
        <span class="tre"><b class="good">＋</b> ${P.good}${P.bad ? `<br><b class="bad">－</b> ${P.bad}` : ''}</span><span class="gbtns"></span>`;
      const btns = card.querySelector('.gbtns');
      const add = (txt, fn, off, cls) => { const b = document.createElement('button'); b.textContent = txt; b.disabled = !!off; if (cls) b.className = cls; b.addEventListener('click', () => { fn(); this.refresh(); }); btns.appendChild(b); };
      if (!has) add(coins >= R.price ? '구매 🪙 ' + Wallet.fmt(R.price) : `코인 부족 (${Wallet.fmt(R.price - coins)} 더 필요)`, () => { if (ask(`${R.name} 채를 ${R.price}코인에 살까요?`)) G.buy(id); }, coins < R.price, 'primary');
      else {
        if (!eq) add('장착', () => G.equip(id), false, 'primary');
        const c = G.upCost(id);
        if (c != null) { const N = G.pros(id, L + 1); add(coins >= c ? `강화 +${L + 1} 🪙 ${Wallet.fmt(c)}` : `강화 +${L + 1} — 코인 부족 (${Wallet.fmt(c - coins)} 더 필요)`, () => { if (ask(`${R.name} +${L + 1} 강화 (${c}코인)\n\n장점: ${N.good}\n단점: ${N.bad}\n\n강화 단계는 나중에 낮춰 쓸 수 있어요.`)) G.upgrade(id); }, coins < c); }
        if (L > 0) { add('−', () => G.setUse(id, U - 1), U <= 0, 'gstep'); add('＋', () => G.setUse(id, U + 1), U >= L, 'gstep'); }
      }
      box.appendChild(card);
    }
  }

  // 내 선수: 레벨·경험치 + 스탯 3종에 포인트 나누기 (−/＋, 다시 나누기 무료)
  renderStats() {
    const T = Stats3, I = T.info(), box = this.statBox, free = T.free(), X = T.XP;
    box.innerHTML = `<div class="sthead"><span class="stlv">Lv.${I.lv}<small> / ${T.MAX_LV}</small></span>
      <span class="stbar"><i style="width:${I.need ? Math.round(100 * I.cur / I.need) : 100}%"></i></span>
      <span class="stxp">${I.need ? `다음 레벨까지 ${I.need - I.cur} 경험치` : '최고 레벨'}</span>
      <span class="stfree${free ? ' on' : ''}">남은 포인트 <b>${free}</b></span></div>
      <div class="strows"></div>
      <div class="stnote">경험치: 승리 ${X.win} · 패배 최대 ${X.loss}(점수 비례) · 훈련 레벨업 ${X.levelUp} · 일일 챌린지 첫 도전 ${X.daily} · 친선게임 ${X.room} — 스탯마다 최대 ${T.STAT_MAX}, 포인트는 모두 ${T.MAX_LV}개라 전부 채울 수는 없어요</div>`;
    const rows = box.querySelector('.strows');
    for (const id of Object.keys(T.STATS)) {
      const S = T.STATS[id], n = T.alloc[id], row = document.createElement('div');
      row.className = 'strow'; row.style.setProperty('--tc', S.color);
      row.innerHTML = `<span class="stn">${S.name} <small>${S.sub}</small></span><span class="pips">${Array.from({ length: T.STAT_MAX }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span><span class="ste">${n ? S.text(n) : '효과 없음'}</span>`;
      for (const [txt, d, off] of [['−', -1, n <= 0], ['＋', 1, n >= T.STAT_MAX || free < 1]]) {
        const b = document.createElement('button'); b.textContent = txt; b.className = 'gstep'; b.disabled = off; b.setAttribute('aria-label', S.name + (d > 0 ? ' 올리기' : ' 내리기'));
        b.addEventListener('click', () => { T.step(id, d); this.refresh(); }); row.appendChild(b);
      }
      rows.appendChild(row);
    }
  }

  // 꾸미기: 유니폼·채 색·코트 — 가진 건 눌러서 고르고, 없는 건 눌러서 구매
  renderSkins() {
    const K = Skin3, box = this.skinBox, coins = Wallet.coins; box.innerHTML = '';
    for (const cat of Object.keys(K.CATS)) {
      const row = document.createElement('div'); row.className = 'skrow';
      row.innerHTML = `<span class="sklbl">${K.CATS[cat]}</span>`;
      for (const it of K.ITEMS[cat]) {
        const has = K.has(cat, it.id), on = K.eq[cat] === it.id, [c1, c2] = K.swatch(cat, it), b = document.createElement('button');
        b.className = 'skbtn' + (on ? ' sel' : '') + (has ? '' : ' lock'); b.disabled = !has && coins < it.price;
        b.title = has ? it.name : `${it.name} — ${it.price}코인` + (coins < it.price ? ` (${it.price - coins} 더 필요)` : '');
        b.innerHTML = `<i style="background:linear-gradient(135deg, ${K.css(c1)} 0 62%, ${K.css(c2)} 62%)"></i><span class="skn">${it.name}</span><span class="skp">${on ? '사용 중' : has ? '보유' : '🪙 ' + it.price}</span>`;
        b.addEventListener('click', () => {
          if (has) K.equip(cat, it.id);
          else { let ok = true; try { ok = window.confirm(`${K.CATS[cat]} 「${it.name}」을(를) ${it.price}코인에 살까요?`); } catch (e) { /* 확인 창이 막힌 환경 */ } if (ok) K.buy(cat, it.id); }
          this.refresh();
        });
        row.appendChild(b);
      }
      box.appendChild(row);
    }
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

  start() {
    if (!this.canStart()) return;
    const sel = { ...this.sel };
    if (sel.mode === 'room') {   // 코드가 있으면 입장, 없으면 방 만들기
      const nick = this.nick.value.trim().replace(/\s+/g, ' ');
      if (!nick) { this.note.textContent = '입장 전에 닉네임을 적어 주세요.'; this.nick.classList.add('need'); this.nick.focus(); return; }
      this.nick.value = nick; this.saveNick(); sel.nick = nick;
      const code = hangulToQwerty(this.roomCode.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      if (code && code.length !== 5) { this.note.textContent = '방 코드는 5자리예요.'; return; }
      sel.room = code ? { code, host: false } : { code: Net3D.makeCode(), host: true };
    }
    this.app.launch(sel);
  }

  // 마지막 선택 기억 (저장이 막힌 환경이면 그냥 기본값)
  load() {
    try {
      const v = JSON.parse(localStorage.getItem(LOBBY_STORE_KEY) || 'null');
      if (v && DIFFS[v.diff] && [11, 15, 21].includes(v.win) && GAME_TYPES.some(t => t.id === v.type)) Object.assign(this.sel, v, { hand: v.hand === 'L' ? 'L' : 'R', train: ['str', 'agi', 'jud'].includes(v.train) ? v.train : 'str', style: ['base', 'wall', 'net', 'smash'].includes(v.style) ? v.style : 'base' });
      // 3D가 본편이 되기 전에 저장된 선택은 한 번만 3D로 옮긴다(그 뒤로는 고른 대로 기억)
      if (v && v.v !== 2) this.sel.type = 'court3d';
      this.sel.v = 2;
    } catch (e) { /* 무시 */ }
    this.sel.v = 2;
  }
  save() { try { localStorage.setItem(LOBBY_STORE_KEY, JSON.stringify(this.sel)); } catch (e) { /* 무시 */ } }
  loadNick() {
    let v = '';
    try { v = localStorage.getItem(NICK_STORE_KEY) || ''; } catch (e) { /* 무시 */ }
    if (!v && typeof Account !== 'undefined' && Account.nickname) v = Account.nickname;   // 처음이면 로그인 닉네임
    return v.slice(0, 12);
  }
  saveNick() { try { localStorage.setItem(NICK_STORE_KEY, this.nick.value.trim()); } catch (e) { /* 무시 */ } }
}
