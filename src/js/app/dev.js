// app/dev.js — 개발자 화면 (이스터에그): 대기화면 제목을 11번 연달아 누르면 비밀번호 창 → 개발자 화면
//   · 비밀번호는 화면을 여는 장치일 뿐(코드가 공개되므로 보호 수단이 아님). 그래서 값 대신 해시만 둠
//   · 서버 정보(가입자·접속 통계)는 Supabase 함수 dev_report가 돌려줌 — admins 표에 등록된 계정으로
//     로그인했을 때만 응답 (sql/dev.sql). 등록 안 된 계정·게스트는 「이 브라우저」 정보만 보임
//   · [게임] 11번·1.2초 간격·해시 방식은 모두 임의로 정한 것
const Dev = {
  TAPS: 11, GAP: 1200, HASH: 3385229869, KEY: 'badminton.dev',
  n: 0, last: 0, isOpen: false, tab: 'sum', data: null, err: '',

  init() {
    const h = document.querySelector('#lobby > h1');
    if (h) h.addEventListener('click', e => { if (!e.target.closest('button')) this.tap(); });
    // 창이 열려 있는 동안 키 입력이 게임(Enter 시작 · Esc 메뉴)으로 넘어가지 않게 먼저 받음
    document.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      e.stopPropagation();
      if (e.code === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'Enter' && this.pw && document.activeElement === this.pw) { e.preventDefault(); this.check(); }
    }, true);
  },
  get unlocked() { try { return sessionStorage.getItem(this.KEY) === '1'; } catch (e) { return !!this.mem; } },
  hash(s) { let h = 5381; for (const c of 'bm-dev:' + s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h; },

  tap() {
    const t = Date.now();
    this.n = t - this.last > this.GAP ? 1 : this.n + 1; this.last = t;
    if (this.n < this.TAPS) return;
    this.n = 0;
    if (this.unlocked) this.openPanel(); else this.ask();
  },

  el(tag, cls, text) { const d = document.createElement(tag); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; },
  shell(title, wide) {
    if (!this.modal) {
      this.modal = this.el('div'); this.modal.id = 'dev';
      this.modal.addEventListener('click', e => { if (e.target === this.modal) this.close(); });
      document.body.appendChild(this.modal);
    }
    this.modal.innerHTML = ''; this.pw = null;
    const box = this.el('div', 'devbox' + (wide ? ' wide' : ''));
    const head = this.el('div', 'devhead'); head.appendChild(this.el('h2', '', title));
    const x = this.el('button', '', '닫기'); x.type = 'button'; x.addEventListener('click', () => this.close()); head.appendChild(x);
    box.appendChild(head); this.modal.appendChild(box);
    this.modal.classList.add('on'); this.isOpen = true;
    return box;
  },
  close() { this.isOpen = false; if (this.modal) this.modal.classList.remove('on'); },

  // ───── 비밀번호 창 ─────
  ask() {
    const box = this.shell('🔒 개발자 확인');
    this.fails = 0;
    this.pw = this.el('input'); this.pw.type = 'password'; this.pw.inputMode = 'numeric'; this.pw.maxLength = 16; this.pw.autocomplete = 'off'; this.pw.placeholder = '비밀번호';
    box.appendChild(this.pw);
    this.say = this.el('div', 'devmsg'); box.appendChild(this.say);
    const ok = this.el('button', 'primary', '확인'); ok.type = 'button'; ok.addEventListener('click', () => this.check()); box.appendChild(ok);
    setTimeout(() => this.pw && this.pw.focus(), 0);
  },
  check() {
    if (this.hash(this.pw.value) === this.HASH) {
      this.mem = true; try { sessionStorage.setItem(this.KEY, '1'); } catch (e) { /* 무시 */ }
      this.openPanel(); return;
    }
    this.pw.value = '';
    if (++this.fails >= 5) { this.close(); return; }
    this.say.textContent = `비밀번호가 맞지 않아요 (${this.fails}/5)`;
  },

  // ───── 개발자 화면 ─────
  TABS: [['sum', '요약'], ['ev', '접속 통계'], ['users', '유저'], ['local', '이 브라우저']],
  openPanel() { this.render(); this.load(); },
  async load() {
    const A = typeof Account !== 'undefined' ? Account : null;
    this.data = null;
    if (!A || !A.sb) this.err = '서버에 연결할 수 없어요 (오프라인 실행이거나 Supabase를 불러오지 못함).';
    else if (!A.loggedIn) this.err = '서버 정보는 개발자 계정으로 로그인해야 보여요. 지금은 게스트라서 「이 브라우저」 정보만 볼 수 있어요.';
    else {
      this.err = '불러오는 중…'; this.render();
      try {
        const r = await A.sb.rpc('dev_report');
        if (r.error) {
          const m = r.error.message || '', c = r.error.code || '';
          this.err = /not_admin/.test(m) || c === '42501' ? '이 계정은 개발자 계정으로 등록돼 있지 않아요 (sql/dev.sql의 admins 등록 줄 확인).'
            : c === 'PGRST202' || /dev_report/.test(m) ? '서버에 개발자 함수가 아직 없어요 — Supabase SQL Editor에서 sql/dev.sql을 한 번 실행해 주세요.'
            : '불러오지 못했어요: ' + m;
        } else { this.data = r.data || {}; this.err = ''; }
      } catch (e) { this.err = '불러오지 못했어요: ' + ((e && e.message) || e); }
    }
    if (this.isOpen) this.render();
  },

  render() {
    const box = this.shell('🛠 개발자 화면', true);
    const tabs = this.el('div', 'devtabs');
    for (const [id, name] of this.TABS) {
      const b = this.el('button', id === this.tab ? 'active' : '', name); b.type = 'button';
      b.addEventListener('click', () => { this.tab = id; this.render(); }); tabs.appendChild(b);
    }
    const re = this.el('button', '', '↻ 새로고침'); re.type = 'button'; re.addEventListener('click', () => this.load()); tabs.appendChild(re);
    const lock = this.el('button', '', '🔒 잠그기'); lock.type = 'button';
    lock.addEventListener('click', () => { this.mem = false; try { sessionStorage.removeItem(this.KEY); } catch (e) { /* 무시 */ } this.close(); }); tabs.appendChild(lock);
    box.appendChild(tabs);
    const body = this.el('div', 'devbody'); box.appendChild(body);
    if (this.tab === 'local') { this.viewLocal(body); return; }
    if (!this.data) { body.appendChild(this.el('div', 'devnote', this.err || '불러오는 중…')); return; }
    ({ sum: this.viewSum, ev: this.viewEv, users: this.viewUsers })[this.tab].call(this, body, this.data);
  },

  // 표: heads = 머리글, rows = 값 배열의 배열 (값은 모두 글자로 넣음 — 닉네임 같은 사용자 입력이 HTML로 해석되지 않게)
  table(body, title, heads, rows, empty) {
    if (title) body.appendChild(this.el('h3', '', title));
    if (!rows || !rows.length) { body.appendChild(this.el('div', 'devnote', empty || '자료 없음')); return; }
    const wrap = this.el('div', 'devscroll'), t = this.el('table'), hr = this.el('tr');
    for (const h of heads) hr.appendChild(this.el('th', '', h));
    t.appendChild(hr);
    for (const r of rows) { const tr = this.el('tr'); for (const c of r) tr.appendChild(this.el('td', '', c == null ? '-' : String(c))); t.appendChild(tr); }
    wrap.appendChild(t); body.appendChild(wrap);
  },
  cards(body, items) {
    const g = this.el('div', 'devcards');
    for (const [k, v] of items) { const c = this.el('div', 'devcard'); c.appendChild(this.el('b', '', v == null ? '-' : String(v))); c.appendChild(this.el('span', '', k)); g.appendChild(c); }
    body.appendChild(g);
  },
  day(s) { if (!s) return '-'; const d = new Date(s); return isNaN(d) ? String(s) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; },
  pct(w, g) { return g ? Math.round(100 * w / g) + '%' : '-'; },
  sumOf(a, k) { return (a || []).reduce((s, x) => s + (Number(x[k]) || 0), 0); },
  lvOf(xp) {   // 경험치 → 선수 레벨 (Stats3와 같은 식)
    if (typeof Stats3 === 'undefined') return '-';
    let lv = 0, x = Number(xp) || 0; while (lv < Stats3.MAX_LV && x >= Stats3.need(lv)) { x -= Stats3.need(lv); lv++; } return lv;
  },
  missing(name) { return name + ' 표가 서버에 없어요 (sql 폴더의 해당 파일을 실행하면 켜져요).'; },

  viewSum(body, d) {
    const today = d.ev_days && d.ev_days[0], week = (d.ev_days || []).slice(0, 7);
    this.cards(body, [
      ['가입자', d.user_count], ['통계에 잡힌 브라우저 수', d.ev_people], ['가장 최근 날짜 방문자', today ? today.visitors : null],
      ['최근 7일 방문(일별 합)', d.ev_days ? this.sumOf(week, 'visitors') : null], ['서버에 올라온 AI 대전', d.matches ? this.sumOf(d.matches, 'games') : null],
      ['유통 중인 코인', d.wallets ? this.sumOf(d.wallets, 'coins') : null], ['지금까지 벌린 코인', d.wallets ? this.sumOf(d.wallets, 'total') : null],
      ['매칭 점수 보유자', d.ratings ? d.ratings.length : null]
    ]);
    body.appendChild(this.el('div', 'devnote', '기준 시각 ' + this.day(d.at) + ' · 날짜는 한국 시간 · 게스트의 코인·기록은 서버에 없어서 포함되지 않음'));
    this.table(body, '난이도별 AI 대전 (서버 기록 · 로그인한 사람만)', ['게임', '난이도', '경기', '승', '승률'],
      (d.match_diff || []).map(x => [x.game_type, (typeof DIFF_NAMES !== 'undefined' && DIFF_NAMES[x.difficulty]) || x.difficulty, x.games, x.wins, this.pct(x.wins, x.games)]), d.matches === null ? this.missing('matches') : null);
    this.table(body, '일일 챌린지 (최근)', ['날짜', '종목', '참가', '최고 점수'], (d.daily || []).map(x => [x.day, x.kind, x.players, x.best]), d.daily === null ? this.missing('daily_scores') : null);
  },
  viewEv(body, d) {
    if (d.ev_days === null) { body.appendChild(this.el('div', 'devnote', this.missing('events'))); return; }
    this.table(body, '날짜별 (최근 30일 · 한국 시간)', ['날짜', '방문자', '활동한 브라우저', '게임 시작', '경기 끝'], (d.ev_days || []).map(x => [x.day, x.visitors, x.active, x.starts, x.ends]));
    this.table(body, '모드별 시작 횟수 (최근 7일)', ['게임', '모드', '횟수'], (d.ev_modes || []).map(x => [x.type, x.mode, x.n]));
    this.table(body, 'AI 난이도별 승률 (게스트 포함)', ['난이도', '경기', '승', '승률'], (d.ev_ai || []).map(x => [x.diff, x.games, x.wins, this.pct(x.wins, x.games)]));
    this.table(body, '튜토리얼', ['결과', '사람 수'], (d.ev_guide || []).map(x => [x.done === 'true' ? '끝까지 함' : x.done === 'false' ? '건너뜀' : x.done, x.n]));
    this.table(body, '빠른 대전', ['결과', '횟수', '평균 대기(초)'], (d.ev_quick || []).map(x => [x.name === 'quick_match' ? '사람과 매칭' : 'AI로 전환', x.n, x.avg_wait]));
    body.appendChild(this.el('div', 'devnote', '쌓인 사건 ' + (d.ev_total == null ? '-' : d.ev_total) + '개'));
  },
  viewUsers(body, d) {
    if (d.users === null) { body.appendChild(this.el('div', 'devnote', '가입자 목록을 읽지 못했어요.')); return; }
    const by = (a, k) => { const m = {}; for (const x of a || []) m[x[k]] = x; return m; };
    const M = by(d.matches, 'user_id'), W = by(d.wallets, 'user_id'), P = by(d.progress, 'user_id'), R = by(d.ratings, 'user_id');
    const rows = (d.users || []).map(u => {
      const m = M[u.id], w = W[u.id], p = P[u.id], r = R[u.id], g = (w && w.gear) || {}, st = g._stats;
      const rackets = Object.keys(g).filter(k => k[0] !== '_' && k !== 'bal').map(k => k + '+' + g[k]).join(' ');
      return [u.nickname, u.email, this.day(u.created_at), this.day(u.last_sign_in_at), m ? m.games : 0, m ? this.pct(m.wins, m.games) : '-',
        w ? w.coins : '-', w ? w.total : '-', st ? this.lvOf(st.xp) : '-', p ? `${p.str}/${p.agi}/${p.jud}` : '-', r ? `${r.rating} (${r.wins}/${r.games})` : '-',
        rackets || '-', g._skins ? Object.keys(g._skins).length : '-'];
    });
    this.table(body, `가입자 ${d.user_count}명` + (d.user_count > rows.length ? ` (최근 ${rows.length}명만 표시)` : ''),
      ['닉네임', '이메일', '가입', '마지막 로그인', 'AI 대전', '승률', '코인', '번 코인', '선수 Lv', '훈련(근/순/판)', '매칭 점수(승/경기)', '채', '스킨 수'], rows);
    body.appendChild(this.el('div', 'devnote', '이메일 등 개인정보가 보이는 화면이에요 — 화면 공유·캡처에 주의. 게스트(로그인 안 한 사람)는 목록에 없음.'));
  },
  viewLocal(body) {
    const A = typeof Account !== 'undefined' ? Account : {}, rows = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), v = localStorage.getItem(k) || ''; if (/^badminton\./.test(k)) rows.push([k, v.length, v.length > 70 ? v.slice(0, 70) + '…' : v]); } } catch (e) { /* 저장 막힘 */ }
    rows.sort((a, b) => a[0] < b[0] ? -1 : 1);
    const yn = v => v ? '예' : '아니오';
    this.table(body, '상태', ['항목', '값'], [
      ['로그인', A.loggedIn ? (A.nickname || '') + ' · ' + (A.user.email || '') : '게스트'], ['계정 id', A.user ? A.user.id : '-'],
      ['브라우저 id (통계·재접속용)', typeof NET3_CID !== 'undefined' ? NET3_CID : '-'],
      ['통계 전송 꺼짐', yn(A.trackOff)], ['코인 서버 저장 꺼짐', yn(A.walletOff)], ['매칭 점수 업로드 꺼짐', yn(A.rateOff)], ['업로드 대기 경기', A.pendingCount ? A.pendingCount() : '-'],
      ['언어', typeof I18N !== 'undefined' ? I18N.lang : '-'], ['번역 안 된 문구', typeof I18N !== 'undefined' && I18N.missing ? I18N.missing().length : '-'],
      ['터치 모드', yn(typeof TouchUI !== 'undefined' && TouchUI.on)], ['화면', `${innerWidth}×${innerHeight} @${devicePixelRatio}x`], ['주소', location.protocol + '//' + location.host], ['브라우저', navigator.userAgent]
    ]);
    this.table(body, '이 브라우저에 저장된 값 (badminton.*)', ['키', '글자 수', '내용 앞부분'], rows, '저장된 값 없음');
    if (typeof I18N !== 'undefined' && I18N.missing && I18N.missing().length) this.table(body, '번역 안 된 문구', ['문구'], I18N.missing().map(x => [x]));
  }
};
Dev.init();
