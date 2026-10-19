// view/hud.js — 화면 위 HTML 표시(점수 카드, 최근 샷, 대쉬, 안내 메시지)

class Hud {
  constructor() {
    const $ = id => document.getElementById(id);
    this.rallyEl = $('score'); this.ptsEl = $('pts'); this.optsEl = $('opts');
    this.shotEl = $('spd'); this.dashEl = $('dashI'); this.msgEl = $('msg');
    this.startBtn = $('startBtn');
    this.cfgEl = $('cfgI');
    this.initialMsg = this.msgEl.innerHTML;   // 조작 안내 (메뉴 복귀 시 다시 표시)
  }

  resetMessage() { this.showMessage(this.initialMsg); }
  setIntro(html) { this.initialMsg = html; }   // 모드별 조작 안내
  // 점수 카드 이름 (왼쪽 = 상대·P2, 오른쪽 = 나·P1)
  setNames(left, right) {
    this.optsEl.previousElementSibling.textContent = left;
    this.ptsEl.previousElementSibling.textContent = right;
  }
  setRoom(code) {   // 친구 방 코드 (null이면 숨김)
    const el = document.getElementById('clRoom'); if (!el) return;
    el.hidden = !code; if (code) document.getElementById('clRoomCode').textContent = code;
  }
  setDashVisible(on) { this.dashEl.parentElement.style.display = on ? '' : 'none'; }
  setConfigLabel(text) { this.cfgEl.textContent = text; }

  setRally(n) { this.rallyEl.textContent = n; }
  setScore(pts, opts) { this.ptsEl.textContent = pts; this.optsEl.textContent = opts; }
  setShot(text) { this.shotEl.textContent = text; }
  setDash(available) {
    this.dashEl.textContent = available ? '●' : '○';
    this.dashEl.style.color = available ? COLORS.ok : COLORS.dim;
  }
  showMessage(html) { this.msgEl.innerHTML = html; this.msgEl.style.display = 'block'; }
  hideMessage() { this.msgEl.style.display = 'none'; }
  setStartLabel(text) { this.startBtn.textContent = text; }
}
