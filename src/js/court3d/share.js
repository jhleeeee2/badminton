// court3d/share.js — 하이라이트 공유: 경기 결과 카드(1200×630 그림) 만들기 → 공유 창 또는 PNG 저장
//   · 배경은 그 순간의 3D 코트 화면(없으면 색 배경) · 점수·상대·가장 긴 랠리·내 최고 스매시 속도
//   · 휴대폰처럼 공유 창이 있는 기기는 그 창으로, 없으면 파일로 내려받음 (인터넷·서버 필요 없음)
//   배치·문구는 [게임]용

const Share3 = {
  W: 1200, H: 630, URL: 'badminton-src.vercel.app',

  // d = { won, pts, opts, me, opp, mode, maxRally, topKmh }, view = CourtView3D (없어도 됨)
  card(d, view) {
    const W = this.W, H = this.H, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), F = (w, px) => `${w} ${px}px "Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif`;
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2A2466'); g.addColorStop(1, '#0B0D1C'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    try {   // 3D 화면을 방금 그린 직후에만 복사할 수 있음 → 한 번 그리고 바로 가져옴
      if (view && view.renderer) {
        view.render(); const el = view.renderer.domElement, k = Math.max(W / el.width, H / el.height);
        c.drawImage(el, (W - el.width * k) / 2, (H - el.height * k) / 2, el.width * k, el.height * k);
        const sh = c.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(8,9,24,.78)'); sh.addColorStop(0.55, 'rgba(8,9,24,.55)'); sh.addColorStop(1, 'rgba(8,9,24,.9)'); c.fillStyle = sh; c.fillRect(0, 0, W, H);
      }
    } catch (e) { /* 화면 복사가 막힌 환경 → 색 배경 그대로 */ }
    const col = d.won ? '#5BFFB0' : '#FF8A8A';
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = '#FFFFFF'; c.font = F(700, 34); c.fillText('배드민턴 랠리', 60, 78);
    c.fillStyle = '#FFB13B'; c.beginPath(); c.arc(60 + c.measureText('배드민턴 랠리').width + 22, 66, 10, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.font = F(500, 24); c.textAlign = 'right'; c.fillText(d.mode || '', W - 60, 76);
    c.textAlign = 'center';
    c.fillStyle = col; c.font = F(800, 64); c.fillText(d.won ? '승리!' : '패배', W / 2, 178);
    c.fillStyle = '#FFFFFF'; c.font = F(800, 170); c.fillText(d.pts + ' : ' + d.opts, W / 2, 350);
    c.font = F(600, 30); c.fillStyle = 'rgba(255,255,255,.92)';
    c.textAlign = 'center'; c.fillText(this.fit(c, d.me || '나', 420) + '   vs   ' + this.fit(c, d.opp || '상대', 420), W / 2, 414);
    // 기록 칸
    const stats = [['가장 긴 랠리', (d.maxRally | 0) + '타'], ['내 최고 스매시', d.topKmh ? d.topKmh + ' km/h' : '—']].concat(d.extra || []);
    const bw = 300, gap = 24, x0 = (W - (bw * stats.length + gap * (stats.length - 1))) / 2;
    stats.forEach(([k, v], i) => {
      const x = x0 + i * (bw + gap), y = 448;
      c.fillStyle = 'rgba(255,255,255,.1)'; this.rr(c, x, y, bw, 104, 18); c.fill();
      c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.65)'; c.font = F(500, 22); c.fillText(k, x + bw / 2, y + 38);
      c.fillStyle = '#FFD23F'; c.font = F(800, 38); c.fillText(v, x + bw / 2, y + 84);
    });
    const dt = new Date(), ds = dt.getFullYear() + '.' + (dt.getMonth() + 1) + '.' + dt.getDate();
    c.font = F(500, 22); c.fillStyle = 'rgba(255,255,255,.6)'; c.textAlign = 'left'; c.fillText(ds, 60, H - 36);
    c.textAlign = 'right'; c.fillText(this.URL, W - 60, H - 36);
    return cv;
  },
  rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); },
  fit(c, t, max) { t = String(t); while (t.length > 1 && c.measureText(t).width > max) t = t.slice(0, -2) + '…'; return t; },

  // 공유 창(있으면) 또는 PNG 저장 → 'shared' | 'saved' | 'fail'
  async send(cv, text) {
    const blob = await new Promise(res => { try { cv.toBlob(res, 'image/png'); } catch (e) { res(null); } });
    if (!blob) return 'fail';
    const name = 'badminton-rally-' + new Date().toISOString().slice(0, 10) + '.png';
    try {
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '배드민턴 랠리', text }); return 'shared'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'shared'; }   // 공유 창을 그냥 닫음
    try {
      const a = document.createElement('a'), url = URL.createObjectURL(blob);
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      return 'saved';
    } catch (e) { return 'fail'; }
  }
};
