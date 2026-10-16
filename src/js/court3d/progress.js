// court3d/progress.js — 선수 키우기: 훈련 레벨 저장과 인게임 효과
//   레벨은 브라우저(localStorage)에 저장 · 저장이 막힌 환경이면 이번 실행 동안만 유지
//   모든 수치는 [게임]용으로 정한 값

const TRAIN_INFO = {
  str: { name: '근력', drill: '스매시 노가다', color: '#FF7A45',
    how: '높게 올라오는 공을 <b>E 스매시</b>로 상대 코트의 <b>노란 표적</b> 안에 연속으로 꽂으세요.',
    effect: L => `스매시 각 −${(1.5 * L).toFixed(1)}° (더 날카롭고 빠르게) · 상대 반응 +${(25 * L)}ms · 상대 리턴 오차 +${8 * L}%` },
  agi: { name: '순발력', drill: '스매시 받기', color: '#3DD9FF',
    how: '상대가 계속 <b>스매시</b>를 꽂습니다. 연속으로 <b>상대 코트 안으로</b> 받아 넘기세요.',
    effect: L => `내 슬로우 범위 +${(0.25 * L).toFixed(2)}m (기본 ${C3.SLOW.RADIUS}m → ${(C3.SLOW.RADIUS + 0.25 * L).toFixed(2)}m)` },
  jud: { name: '판단력', drill: '인/아웃 판단', color: '#7CFF6B',
    how: '라인 근처로 오는 공을 판단하세요. <b>아웃 공은 건드리지 말고</b>, <b>인 공은 받아 넘기기</b>. 낙하 지점 표시는 없습니다.',
    effect: L => `경기 중 ${12 * L}% 확률로 낙하 지점 힌트(하늘색)가 일찍 보임` }
};

const Progress3 = {
  KEY: 'badminton.progress.v1', MAX: 5,
  lv: { str: 0, agi: 0, jud: 0 },
  load() {
    try { const v = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (v) for (const k of ['str', 'agi', 'jud']) this.lv[k] = Math.max(0, Math.min(this.MAX, v[k] | 0)); } catch (e) { /* 무시 */ }
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.lv)); } catch (e) { /* 무시 */ } },
  // 다음 레벨까지 필요한 연속 성공 수
  need(kind) { const L = this.lv[kind]; return kind === 'jud' ? 6 + 2 * L : 4 + 2 * L; },
  up(kind) { if (this.lv[kind] >= this.MAX) return false; this.lv[kind]++; this.save(); return true; },
  reset() { this.lv = { str: 0, agi: 0, jud: 0 }; this.save(); },

  // ── 인게임 효과 ──
  smashAngle() { return -1.5 * this.lv.str; },           // 스매시 발사각 추가(아래로)
  smashReact() { return 0.025 * this.lv.str; },          // 내 스매시에 대한 AI 반응 지연
  smashErr() { return 1 + 0.08 * this.lv.str; },         // 내 스매시를 받은 AI 리턴 오차 배율
  slowBonus() { return 0.25 * this.lv.agi; },            // 내 슬로우 범위 추가
  hintChance() { return 0.12 * this.lv.jud; }            // 낙하 지점 힌트 확률
};
Progress3.load();
