// app/account.js — 계정(Supabase): 로그인·회원가입, 경기 기록 저장, 훈련 레벨 동기화
//   · 로그인 없이도 게임은 그대로(게스트). 경기 기록은 항상 이 브라우저(localStorage)에 먼저 남김
//   · 로그인 상태면 서버(matches 테이블)에도 올림. 인터넷 끊김 등으로 실패하면 대기열에 두었다가
//     다음 로그인/다음 경기 때 다시 올림
//   · 훈련 레벨(Progress3)은 로그인하면 서버(progress 테이블)와 합침 — 종목별로 더 높은 레벨을 채택
//   · publishable 키는 공개용이라 코드에 들어가도 됨(데이터 보호는 RLS가 담당).
//     secret / service_role 키는 절대 넣지 말 것

const SUPABASE_URL = 'https://ywpbsixafaqmnjqnodkz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vervME1AwGv0J3uo6mxW4A_dS9rur0Q';

const GAME_TYPE_NAMES = { classic: '레트로', court3d: '3D 코트' };

const Account = {
  HIST_KEY: 'badminton.history.v1', PEND_KEY: 'badminton.pending.v1', HIST_MAX: 50,
  sb: null, user: null, nickname: null, ready: false, listeners: [],

  get online() { return !!this.sb; },
  get loggedIn() { return !!this.user; },

  init() {
    try {
      if (window.supabase && window.supabase.createClient) this.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) { console.warn('Supabase 초기화 실패', e); }
    if (!this.sb) { this.ready = true; this.emit(); return; }
    // 콜백 안에서 바로 Supabase를 다시 부르면 멈출 수 있어(공식 문서 권고) 다음 틱으로 넘김
    this.sb.auth.onAuthStateChange((ev, session) => setTimeout(() => this.onSession(session), 0));
  },

  on(fn) { this.listeners.push(fn); },
  emit() { for (const fn of this.listeners) { try { fn(); } catch (e) { console.error(e); } } },

  async onSession(session) {
    const u = session ? session.user : null;
    const changed = (u && u.id) !== (this.user && this.user.id);
    this.user = u; this.ready = true;
    if (!u) { this.nickname = null; this.emit(); return; }
    if (!changed) return;
    this.nickname = (u.user_metadata && u.user_metadata.nickname) || null;
    this.emit();
    await this.ensureProfile();
    await this.syncProgress();
    await this.syncWallet(true);
    await this.flush();
    this.emit();
  },

  // ───── 로그인 · 회원가입 ─────
  async signUp(email, password, nickname) {
    nickname = (nickname || '').trim();
    if (nickname.length < 2 || nickname.length > 16) throw new Error('닉네임은 2~16자로 정해주세요.');
    const dup = await this.sb.from('profiles').select('id').eq('nickname', nickname).maybeSingle();
    if (dup.error) throw dup.error;
    if (dup.data) throw new Error('이미 쓰고 있는 닉네임이에요.');
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: { nickname } } });
    if (error) throw error;
    return { needConfirm: !data.session };   // 메일 인증이 켜져 있으면 세션 없이 돌아옴
  },
  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signOut() { if (this.sb) await this.sb.auth.signOut(); },

  // 첫 로그인 때 profiles 행 만들기 (닉네임은 회원가입 때 metadata에 넣어둔 값)
  async ensureProfile() {
    const id = this.user.id;
    const r = await this.sb.from('profiles').select('nickname').eq('id', id).maybeSingle();
    if (r.error) { console.warn(r.error); return; }
    if (r.data) { this.nickname = r.data.nickname || this.nickname; return; }
    const ins = await this.sb.from('profiles').insert({ id, nickname: this.nickname });
    if (ins.error) {
      console.warn(ins.error);
      if (ins.error.code === '23505') {   // 그 사이 다른 사람이 같은 닉네임을 가져감 → 닉네임 없이 생성
        await this.sb.from('profiles').insert({ id, nickname: null });
        this.nickname = null;
      }
    }
  },

  // ───── 경기 기록 ─────
  readList(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { return []; } },
  writeList(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 저장 막힘 → 무시 */ } },

  // r = { game_type, difficulty, target_score, player_score, ai_score, won }
  // 친선게임(difficulty 'room', opponent·sets 추가)은 opt.localOnly — 서버 matches 표에는 그 칸이 없어서 이 브라우저에만 저장
  recordMatch(r, opt) {
    const row = { ...r, played_at: new Date().toISOString() };
    const hist = this.readList(this.HIST_KEY);
    hist.unshift(row);
    this.writeList(this.HIST_KEY, hist.slice(0, this.HIST_MAX));
    if (!this.loggedIn || (opt && opt.localOnly)) return;
    const pend = this.readList(this.PEND_KEY);
    pend.push({ ...row, user_id: this.user.id });
    this.writeList(this.PEND_KEY, pend);
    this.flush();
  },

  // 대기열에 쌓인 내 기록을 서버로 (다른 계정 것은 건드리지 않음)
  async flush() {
    if (!this.loggedIn || this.flushing) return;
    const id = this.user.id, pend = this.readList(this.PEND_KEY);
    const mine = pend.filter(x => x.user_id === id);
    if (!mine.length) return;
    this.flushing = true;
    try {
      const { error } = await this.sb.from('matches').insert(mine);
      if (error) { console.warn('기록 업로드 실패 — 다음에 다시 시도', error); return; }
      const sent = new Set(mine.map(x => x.played_at));
      this.writeList(this.PEND_KEY, this.readList(this.PEND_KEY).filter(x => !(x.user_id === id && sent.has(x.played_at))));
    } catch (e) { console.warn(e); } finally { this.flushing = false; }
  },
  pendingCount() { return this.loggedIn ? this.readList(this.PEND_KEY).filter(x => x.user_id === this.user.id).length : 0; },

  // 기록 보기용: 로그인 상태면 서버, 아니면 이 브라우저
  async stats() {
    if (this.loggedIn) {
      const base = () => this.sb.from('matches').select('id', { count: 'exact', head: true });
      const [rec, w, l] = await Promise.all([
        this.sb.from('matches').select('game_type,difficulty,target_score,player_score,ai_score,won,played_at').order('played_at', { ascending: false }).limit(10),
        base().eq('won', true), base().eq('won', false)
      ]);
      const err = rec.error || w.error || l.error;
      if (!err) return { source: 'server', wins: w.count || 0, losses: l.count || 0, recent: rec.data || [] };
      console.warn(err);
    }
    const hist = this.readList(this.HIST_KEY).filter(x => x.difficulty !== 'room');
    return { source: 'local', wins: hist.filter(x => x.won).length, losses: hist.filter(x => !x.won).length, recent: hist.slice(0, 10) };
  },
  // 친선게임 기록 (이 브라우저)
  roomStats() {
    const h = this.readList(this.HIST_KEY).filter(x => x.difficulty === 'room');
    return { wins: h.filter(x => x.won).length, losses: h.filter(x => !x.won).length, recent: h.slice(0, 10) };
  },

  // ───── 일일 챌린지 (daily_scores 표: user_id+day 한 줄, 그날 최고 점수) ─────
  //   표가 아직 없으면(설치 전) { ok:false, missing:true } — 게임은 그대로 되고 순위표만 '준비 중'
  dailyMissing(e) { return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /daily_scores/.test(e.message || '')); },
  async dailyTop(day) {
    try {
      // 인터넷이 느리거나 막혀 있으면 6초 뒤 포기 (대기화면이 '불러오는 중'에 머물지 않게)
      const r = await Promise.race([
        this.sb.from('daily_scores').select('user_id,nickname,score').eq('day', day).order('score', { ascending: false }).order('updated_at', { ascending: true }).limit(10),
        new Promise(res => setTimeout(() => res({ error: { message: 'timeout' } }), 6000))
      ]);
      if (r.error) return { ok: false, missing: this.dailyMissing(r.error) };
      const me = this.user && this.user.id;
      return { ok: true, rows: (r.data || []).map(x => ({ nickname: x.nickname, score: x.score, mine: x.user_id === me })) };
    } catch (e) { return { ok: false }; }
  },
  // 내 그날 최고 점수를 올리고(서버 기록보다 높을 때만) 순위를 돌려줌 → { ok, rank, total }
  async pushDaily(day, kind, score) {
    if (!this.loggedIn) return { ok: false };
    try {
      const id = this.user.id, T = () => this.sb.from('daily_scores');
      const cur = await T().select('score').eq('user_id', id).eq('day', day).maybeSingle();
      if (cur.error) return { ok: false, missing: this.dailyMissing(cur.error) };
      let best = cur.data ? cur.data.score : -1;
      if (score > best) {
        const up = await T().upsert({ user_id: id, day, kind, score, nickname: (this.nickname || '선수').slice(0, 16), updated_at: new Date().toISOString() });
        if (up.error) { console.warn('일일 챌린지 업로드 실패', up.error); return { ok: false }; }
        best = score;
      }
      const [hi, all] = await Promise.all([
        T().select('user_id', { count: 'exact', head: true }).eq('day', day).gt('score', best),
        T().select('user_id', { count: 'exact', head: true }).eq('day', day)
      ]);
      if (hi.error || all.error) return { ok: false };
      return { ok: true, rank: (hi.count || 0) + 1, total: all.count || 1 };
    } catch (e) { console.warn(e); return { ok: false }; }
  },

  // ───── 재화(코인) 동기화 (wallets 표: user_id 한 줄) ─────
  //   서버 값 + 아직 안 올린 변화량(delta) → 서버에 저장. 표가 아직 없으면 이 브라우저에만 (walletOff)
  //   다른 계정이 쓰던 브라우저면 남아 있던 변화량은 버리고 서버 값만 받음
  async syncWallet(force) {
    if (!this.loggedIn || typeof Wallet === 'undefined' || this.walletOff) return;
    const W = Wallet, id = this.user.id;
    if (this.walletBusy) { this.walletAgain = true; return; }
    if (!force && W.uid === id && !W.delta && !W.deltaT) return;
    this.walletBusy = true;
    try {
      const G = typeof Gear3 !== 'undefined' ? Gear3 : null;
      const r = await this.sb.from('wallets').select('coins,total,gear').eq('user_id', id).maybeSingle();
      if (r.error) { if (r.error.code === '42P01' || r.error.code === 'PGRST205' || /wallets/.test(r.error.message || '')) this.walletOff = true; console.warn('코인 동기화 실패', r.error); return; }
      if (W.uid && W.uid !== id) { W.delta = 0; W.deltaT = 0; W.log = []; }
      const d = W.delta, dT = W.deltaT, sc = r.data ? r.data.coins | 0 : 0, st = r.data ? r.data.total | 0 : 0;
      const coins = Math.max(0, sc + d), total = Math.max(0, st + dT);
      // 채: 다른 계정이 쓰던 브라우저면 서버 것만, 아니면 채마다 더 높은 강화 단계로 합침
      const sg = r.data && r.data.gear && typeof r.data.gear === 'object' ? r.data.gear : {};
      const other = !!(W.uid && W.uid !== id), ST = typeof Stats3 !== 'undefined' ? Stats3 : null;
      if (G) { if (other) { G.own = { bal: 0 }; G.use = {}; G.eq = 'bal'; } G.merge(sg); G.save(true); }
      if (ST) { ST.take(sg._stats, !other); ST.save(true); }   // 선수 스탯: gear 칸의 _stats에 함께 저장
      const SK = typeof Skin3 !== 'undefined' ? Skin3 : null;
      if (SK) { if (other) SK.reset(); SK.merge(sg._skins); SK.save(true); }   // 스킨: 가진 목록을 합침
      const RT = typeof Rate3 !== 'undefined' ? Rate3 : null;
      if (RT) { RT.take(sg._rate, other); RT.save(true); }   // 매칭 점수: 경기 수가 많은 쪽
      const gear = G ? { ...G.own, ...(ST ? { _stats: ST.dump() } : {}), ...(SK ? { _skins: SK.own } : {}), ...(RT && RT.r != null ? { _rate: RT.dump() } : {}) } : sg, gearNew = JSON.stringify(gear) !== JSON.stringify(sg);
      if (!r.data || d || dT || gearNew) {
        const up = await this.sb.from('wallets').upsert({ user_id: id, coins, total, gear, updated_at: new Date().toISOString() });
        if (up.error) { console.warn('코인 업로드 실패 — 다음에 다시 시도', up.error); return; }
      }
      // 올리는 사이에 더 번 코인은 남겨 둠
      W.delta -= d; W.deltaT -= dT; W.coins = Math.max(0, coins + W.delta); W.total = total + W.deltaT; W.uid = id;
      W.save(); W.emit();
    } catch (e) { console.warn(e); } finally {
      this.walletBusy = false;
      if (this.walletAgain) { this.walletAgain = false; this.syncWallet(); }
    }
  },

  // ───── 빠른 대전 순위표 (ratings 표: user_id 한 줄, sql/ratings.sql) ─────
  //   표가 없으면 { ok:false, missing:true } — 매칭은 그대로 되고 순위표만 '준비 중'
  async rateTop() {
    try {
      const r = await Promise.race([
        this.sb.from('ratings').select('user_id,nickname,rating,games,wins').gte('games', 1).order('rating', { ascending: false }).order('updated_at', { ascending: true }).limit(10),
        new Promise(res => setTimeout(() => res({ error: { message: 'timeout' } }), 6000))
      ]);
      if (r.error) return { ok: false, missing: r.error.code === '42P01' || r.error.code === 'PGRST205' || /ratings/.test(r.error.message || '') };
      const me = this.user && this.user.id;
      return { ok: true, rows: (r.data || []).map(x => ({ nickname: x.nickname, rating: x.rating, games: x.games, wins: x.wins, mine: x.user_id === me })) };
    } catch (e) { return { ok: false }; }
  },
  async pushRate() {
    if (!this.loggedIn || typeof Rate3 === 'undefined' || Rate3.r == null || this.rateOff) return;
    try {
      const { error } = await this.sb.from('ratings').upsert({ user_id: this.user.id, nickname: (this.nickname || '선수').slice(0, 16), rating: Rate3.r, games: Rate3.n, wins: Rate3.w, updated_at: new Date().toISOString() });
      if (error) { this.rateOff = true; console.warn('매칭 점수 업로드 실패', error); }
    } catch (e) { console.warn(e); }
  },

  // ───── 접속 통계 (events 표, sql/events.sql) — 이름·이메일 없이 이 브라우저의 무작위 id만 보냄 ─────
  //   표가 없거나 막혀 있으면 한 번 실패한 뒤로는 보내지 않음. 게임 진행에는 영향 없음
  track(name, props) {
    if (!this.sb || this.trackOff) return;
    try {
      const anon = typeof NET3_CID !== 'undefined' ? NET3_CID : 'x';
      Promise.resolve(this.sb.from('events').insert({ name: String(name).slice(0, 32), anon_id: anon, user_id: this.user ? this.user.id : null, props: props || {} }))
        .then(r => { if (r && r.error) this.trackOff = true; }, () => { this.trackOff = true; });
    } catch (e) { this.trackOff = true; }
  },
  // 하루에 한 번 '방문' 기록 (한국 시간 기준)
  trackVisit() {
    try {
      const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), K = 'badminton.visit';
      if (localStorage.getItem(K) === d) return;
      localStorage.setItem(K, d);
      this.track('visit', { touch: typeof TouchUI !== 'undefined' && !!TouchUI.on, pwa: !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches), ref: (document.referrer || '').slice(0, 80) });
    } catch (e) { /* 무시 */ }
  },

  // ───── 훈련 레벨 동기화 ─────
  async syncProgress() {
    if (typeof Progress3 === 'undefined') return;
    const r = await this.sb.from('progress').select('str,agi,jud').eq('user_id', this.user.id).maybeSingle();
    if (r.error) { console.warn(r.error); return; }
    if (r.data) for (const k of ['str', 'agi', 'jud']) Progress3.lv[k] = Math.max(Progress3.lv[k], Math.min(Progress3.MAX, r.data[k] | 0));
    saveProgressLocal();
    await this.pushProgress();
  },
  async pushProgress() {
    if (!this.loggedIn || typeof Progress3 === 'undefined') return;
    const { str, agi, jud } = Progress3.lv;
    const { error } = await this.sb.from('progress').upsert({ user_id: this.user.id, str, agi, jud, updated_at: new Date().toISOString() });
    if (error) console.warn('훈련 레벨 업로드 실패', error);
  }
};

// 훈련 레벨이 바뀔 때마다(레벨업·초기화) 서버에도 반영
const saveProgressLocal = typeof Progress3 !== 'undefined' ? Progress3.save.bind(Progress3) : () => {};
if (typeof Progress3 !== 'undefined') Progress3.save = function () { saveProgressLocal(); Account.pushProgress(); };

// Supabase 오류 → 한국어 안내
function accountErrorText(e) {
  const m = (e && e.message) || String(e);
  const table = [
    [/Invalid login credentials/i, '이메일 또는 비밀번호가 맞지 않아요.'],
    [/already registered|already been registered/i, '이미 가입된 이메일이에요. 로그인해 주세요.'],
    [/Password should be at least/i, '비밀번호는 6자 이상이어야 해요.'],
    [/Email not confirmed/i, '메일 인증이 아직 안 됐어요. 받은편지함의 인증 링크를 눌러주세요.'],
    [/valid email|invalid format/i, '이메일 형식을 확인해 주세요.'],
    [/rate limit/i, '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'],
    [/Failed to fetch|NetworkError|Load failed/i, '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.']
  ];
  for (const [re, txt] of table) if (re.test(m)) return txt;
  return m;
}

// ───── 화면: 대기화면 계정 줄 + 로그인/기록 창 ─────
const AccountUI = {
  isOpen: false, tab: 'login',

  // onChange: 계정 상태가 바뀔 때 App이 할 일 (대기화면 훈련 레벨 갱신 등)
  init(onChange) {
    const $ = id => document.getElementById(id);
    this.onChange = onChange || (() => {});
    this.bar = $('acctBar'); this.modal = $('acct'); this.title = $('acctTitle');
    this.form = $('acctForm'); this.email = $('acctEmail'); this.pw = $('acctPw'); this.nick = $('acctNick');
    this.nickRow = $('acctNickRow'); this.submit = $('acctSubmit'); this.msg = $('acctMsg');
    this.tabs = $('acctTabs'); this.recBox = $('acctRec');
    $('acctClose').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', e => { if (e.target === this.modal) this.close(); });
    this.tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => this.setTab(b.dataset.t)));
    this.form.addEventListener('submit', e => { e.preventDefault(); this.onSubmit(); });
    Account.on(() => this.render());
    this.render();
  },

  render() {
    const A = Account, bar = this.bar;
    bar.innerHTML = '';
    const info = document.createElement('span'); info.className = 'ainfo';
    const add = (label, fn, cls) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.addEventListener('click', fn); bar.appendChild(b); };
    const coin = () => { if (typeof Wallet !== 'undefined') add('🪙 ' + Wallet.fmt(Wallet.coins), () => this.openWallet(), 'coinchip'); };
    if (!A.online) {
      info.textContent = '계정 기능을 불러오지 못했어요 — 게스트로 플레이 (기록은 이 브라우저에만 저장)';
      bar.appendChild(info);
      coin(); add('내 기록', () => this.openRecords());
    } else if (!A.ready) {
      info.textContent = '계정 확인 중…'; bar.appendChild(info);
    } else if (!A.loggedIn) {
      info.innerHTML = '<span class="dot guest"></span>게스트 — 기록은 이 브라우저에만 저장돼요';
      bar.appendChild(info);
      coin(); add('내 기록', () => this.openRecords());
      add('로그인 / 회원가입', () => this.openLogin(), 'primary');
    } else {
      const nm = document.createElement('b'); nm.textContent = A.nickname || (A.user.email || '').split('@')[0];
      info.innerHTML = '<span class="dot on"></span>';
      info.appendChild(nm);
      const p = A.pendingCount();
      info.appendChild(document.createTextNode(p ? ` · 업로드 대기 ${p}경기` : ' · 기록이 계정에 저장돼요'));
      bar.appendChild(info);
      coin(); add('내 기록', () => this.openRecords());
      add('로그아웃', () => A.signOut());
    }
    // 훈련 레벨이 서버 값과 합쳐졌을 수 있으니 대기화면 갱신
    this.onChange();
    if (this.isOpen && this.mode === 'login' && A.loggedIn) this.close();
  },

  show(mode) {
    this.mode = mode; this.isOpen = true; this.modal.classList.add('on');
    this.form.hidden = mode !== 'login'; this.tabs.hidden = mode !== 'login'; this.recBox.hidden = mode !== 'records';
    this.msg.textContent = ''; this.msg.className = 'amsg';
  },
  close() { this.isOpen = false; this.modal.classList.remove('on'); },

  openLogin() { this.show('login'); this.setTab(this.tab); setTimeout(() => this.email.focus(), 0); },
  setTab(t) {
    this.tab = t;
    this.tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.t === t));
    this.title.textContent = t === 'signup' ? '회원가입' : '로그인';
    this.nickRow.hidden = t !== 'signup'; this.nick.required = t === 'signup';
    this.pw.autocomplete = t === 'signup' ? 'new-password' : 'current-password';
    this.submit.textContent = t === 'signup' ? '가입하기' : '로그인';
    this.msg.textContent = '';
  },
  say(text, tone) { this.msg.textContent = text; this.msg.className = 'amsg ' + (tone || ''); },

  async onSubmit() {
    const email = this.email.value.trim(), pw = this.pw.value;
    this.submit.disabled = true; this.say('처리 중…');
    try {
      if (this.tab === 'signup') {
        const r = await Account.signUp(email, pw, this.nick.value);
        if (r.needConfirm) this.say('가입 완료! 메일로 온 인증 링크를 누른 뒤 로그인해 주세요.', 'ok');
        else this.say('가입 완료! 로그인됐어요.', 'ok');
      } else {
        await Account.signIn(email, pw);
        this.pw.value = '';
      }
    } catch (e) { this.say(accountErrorText(e), 'bad'); } finally { this.submit.disabled = false; }
  },

  // 코인 창: 잔액 · 얻는 방법 · 최근 내역
  openWallet() {
    this.show('records'); this.title.textContent = '코인';
    const W = Wallet, R = W.R, F = W.f(), box = this.recBox, el = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; box.appendChild(d); return d; };
    box.innerHTML = '';
    el('rsum', `<span>🪙 <b>${W.fmt(W.coins)}</b> 코인</span><span>지금까지 번 코인 <b>${W.fmt(W.total)}</b></span>`);
    el('rsrc', Account.loggedIn ? (Account.walletOff ? '서버 저장 준비 중 — 지금은 이 브라우저에만 저장돼요' : '계정에 저장돼요') : '이 브라우저에 저장 — 로그인하면 계정으로 옮겨져요');
    const w = R.WIN, rows = [
      ['AI 대전 승리', `쉬움 ${w.easy} · 중간 ${w.normal} · 어려움 ${w.hard} · 지옥 ${w.hell} · 임파서블 ${w.imp}`],
      ['목표 점수', `15점 ×${R.TARGET[15]} · 21점 ×${R.TARGET[21]}`],
      ['패배', `승리 보상의 ${R.LOSS * 100}% × (내 점수 ÷ 목표 점수)`],
      ['오늘의 첫 승', `+${R.FIRST_WIN}` + (F.win ? ' (오늘 받음)' : '')],
      ['긴 랠리', R.RALLY.slice().reverse().map(x => `${x[0]}타 +${x[1]}`).join(' · ') + ' (경기당 한 번)'],
      ['커리어', `처음 깨는 경기 ×${R.CAREER_FIRST} · 대회 첫 우승 +${R.CUP.join(' / ')}`],
      ['일일 챌린지', `첫 도전 +${R.DAILY_TRY} · 최고 점수 ${R.DAILY_PER}점당 1` + (F.dailyTry ? ` (오늘 ${R.DAILY_TRY + F.dailyPaid} 받음)` : '')],
      ['훈련 레벨업', `+${R.LEVEL_UP}`],
      ['친선게임', `승 ${R.ROOM_WIN} · 패 ${R.ROOM_LOSS} (오늘 ${F.room}/${R.ROOM_CAP}경기)`]
    ];
    const how = el('rlist coinhow', '');
    for (const [k, v] of rows) { const row = document.createElement('div'); row.className = 'rrow'; for (const c of [k, v]) { const sp = document.createElement('span'); sp.textContent = c; row.appendChild(sp); } how.appendChild(row); }
    el('rsrc', '끝까지 한 경기만 받을 수 있어요 · 쓰는 곳: 대기화면 상점 탭의 「내 채」와 「꾸미기」').style.marginTop = '8px';
    if (!W.log.length) return;
    el('rsrc', '<b style="color:var(--text)">최근 내역</b>').style.marginTop = '12px';
    const list = el('rlist coinlog', '');
    for (const x of W.log) {
      const row = document.createElement('div'); row.className = 'rrow ' + (x.sum >= 0 ? 'w' : 'l'); const d = new Date(x.t);
      for (const c of [(d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), x.title, (x.sum >= 0 ? '+' : '') + W.fmt(x.sum)]) { const sp = document.createElement('span'); sp.textContent = c; row.appendChild(sp); }
      list.appendChild(row);
    }
  },

  async openRecords() {
    this.show('records'); this.title.textContent = '내 기록';
    const box = this.recBox; box.textContent = '불러오는 중…';
    let s;
    try { s = await Account.stats(); } catch (e) { box.textContent = accountErrorText(e); return; }
    box.innerHTML = '';
    const total = s.wins + s.losses;
    const head = document.createElement('div'); head.className = 'rsum';
    head.innerHTML = `<span><b>${total}</b>전</span><span style="color:var(--ok)"><b>${s.wins}</b>승</span><span style="color:var(--bad)"><b>${s.losses}</b>패</span><span>승률 <b>${total ? Math.round(100 * s.wins / total) : 0}</b>%</span>`;
    box.appendChild(head);
    const src = document.createElement('div'); src.className = 'rsrc';
    src.textContent = s.source === 'server' ? '계정에 저장된 기록 (AI 대전만 · 최근 10경기)' : '이 브라우저에 저장된 AI 대전 기록 (최근 10경기 표시)';
    box.appendChild(src);
    const roomBlock = () => {   // 친선게임 기록
      const rs = Account.roomStats(); if (!rs.recent.length) return;
      const h = document.createElement('div'); h.className = 'rsrc'; h.style.marginTop = '14px';
      h.innerHTML = `<b style="color:var(--text)">친선게임</b> · ${rs.wins}승 ${rs.losses}패 (이 브라우저 · 최근 10경기)`;
      box.appendChild(h);
      const l = document.createElement('div'); l.className = 'rlist';
      for (const r of rs.recent) {
        const row = document.createElement('div'); row.className = 'rrow ' + (r.won ? 'w' : 'l');
        const d = new Date(r.played_at);
        for (const c of [(d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
          'vs ' + (r.opponent || '친구') + ' · ' + r.target_score + '점' + (r.sets ? ' · 세트 ' + r.sets : ''),
          r.player_score + ' : ' + r.ai_score, r.won ? '승' : '패']) { const sp = document.createElement('span'); sp.textContent = c; row.appendChild(sp); }
        l.appendChild(row);
      }
      box.appendChild(l);
    };
    if (!s.recent.length) { const e = document.createElement('div'); e.className = 'rsrc'; e.textContent = '아직 AI 대전 기록이 없어요. AI 대전을 끝까지 해보세요!'; box.appendChild(e); roomBlock(); return; }
    const list = document.createElement('div'); list.className = 'rlist';
    for (const r of s.recent) {
      const row = document.createElement('div'); row.className = 'rrow ' + (r.won ? 'w' : 'l');
      const d = new Date(r.played_at);
      const cells = [
        (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
        (GAME_TYPE_NAMES[r.game_type] || r.game_type) + ' · ' + (DIFF_NAMES[r.difficulty] || r.difficulty) + ' · ' + r.target_score + '점',
        r.player_score + ' : ' + r.ai_score,
        r.won ? '승' : '패'
      ];
      for (const c of cells) { const sp = document.createElement('span'); sp.textContent = c; row.appendChild(sp); }
      list.appendChild(row);
    }
    box.appendChild(list);
    roomBlock();
  }
};

// 코인이 바뀔 때마다 대기화면 표시 갱신 + (로그인 상태면) 서버에 반영
if (typeof Wallet !== 'undefined') Wallet.on(() => { if (AccountUI.bar) AccountUI.render(); Account.syncWallet(); });
if (typeof Gear3 !== 'undefined') Gear3.on(() => Account.syncWallet(true));
if (typeof Rate3 !== 'undefined') Rate3.onChange = () => { Account.syncWallet(true); Account.pushRate(); };
if (typeof Skin3 !== 'undefined') Skin3.on(() => Account.syncWallet(true));
if (typeof Stats3 !== 'undefined') Stats3.on(() => Account.syncWallet(true));   // 경험치·스탯 분배도   // 채를 사거나 강화하면 서버에도 반영

Account.init();
Account.trackVisit();
