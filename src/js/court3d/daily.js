// court3d/daily.js — 일일 챌린지: 훈련 3종(근력·순발력·판단력)을 날마다 하나씩 점수 경쟁으로
//   · 날짜는 한국 시간 기준(자정에 바뀜). 종목은 근력 → 순발력 → 판단력 순으로 하루씩 돌아감
//   · 그날은 누구에게나 같은 공이 같은 순서로 옴(날짜로 만든 난수) · 공 15개 · 여러 번 도전 가능, 최고 점수만 인정
//   · 점수: 성공 1번 = 100점 + 연속 보너스(연속 2번째부터 +25씩, 최대 +100)  → 만점 2,750점
//   · 공평하게: 훈련 레벨과 상관없이 공 세기는 고정(FEED_LV), 근력 레벨의 스매시 각 보너스도 꺼짐
//   · 내 최고 기록은 이 브라우저에 저장, 로그인하면 서버(daily_scores 표)에 올려 순위표에 표시
//   수치는 모두 [게임]용

const Daily3 = {
  KEY: 'badminton.daily.v1', TOTAL: 15, FEED_LV: 3, BASE: 100, BONUS: 25, BONUS_MAX: 100, KEEP: 14,
  KINDS: ['str', 'agi', 'jud'],
  days: {},   // { '2026-11-14': { kind, best, tries } }

  dayNum(t) { return Math.floor(((t || Date.now()) + 9 * 3600e3) / 86400e3); },          // 한국 시간 기준 날짜 번호
  day(t) { return new Date((t || Date.now()) + 9 * 3600e3).toISOString().slice(0, 10); },
  kind(t) { return this.KINDS[this.dayNum(t) % 3]; },
  maxScore() { let s = 0; for (let i = 0; i < this.TOTAL; i++) s += this.pts(i + 1); return s; },
  pts(streak) { return this.BASE + Math.min(this.BONUS_MAX, this.BONUS * Math.max(0, streak - 1)); },   // streak = 이번 성공까지 포함한 연속 수
  // 그날의 난수 (mulberry32): 도전을 시작할 때마다 새로 만들어 같은 순서를 되풀이
  rng(t) {
    let a = (this.dayNum(t) * 2654435761) >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  },

  load() { try { const v = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (v && typeof v === 'object') this.days = v; } catch (e) { /* 무시 */ } },
  save() {
    const ks = Object.keys(this.days).sort(); while (ks.length > this.KEEP) delete this.days[ks.shift()];
    try { localStorage.setItem(this.KEY, JSON.stringify(this.days)); } catch (e) { /* 무시 */ }
  },
  today() { return this.days[this.day()] || { kind: this.kind(), best: 0, tries: 0 }; },
  // 한 번의 도전 결과 기록 → { best, isNew }. day는 도전을 시작한 날 (자정을 넘겨도 그날 기록으로)
  record(day, kind, score) {
    const d = this.days[day] || (this.days[day] = { kind, best: 0, tries: 0 });
    d.tries++; const isNew = score > d.best; if (isNew) d.best = score;
    this.save();
    return { best: d.best, isNew };
  }
};
Daily3.load();
