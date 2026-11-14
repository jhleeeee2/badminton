// court3d/ai.js — 3D AI: 셔틀 궤적(공기저항 포함)을 미리 계산해 칠 지점·서 있을 위치를 정하고 이동,
//                필요하면 점프·팔 뻗기, 닿으면 스윙. 서브도 담당

// 셔틀 궤적에서 "이 선수가 서서(또는 점프해서) 칠 수 있는 지점"과 서 있을 위치 찾기
function planIntercept(a, sim, spd, jumpOK) {
  const B = C3.BODY, r = a.right(), own = a.facing === -1 ? 1 : -1;   // 내 코트 쪽 z 부호
  const maxH = B.SHOULDER_H + B.REACH * 0.92 + (jumpOK ? 0.45 : 0);
  for (let i = 0; i < sim.path.length; i += 3) {
    const q = sim.path[i];
    if (q.z * own < 0.25 || q.y < 0.3 || q.y > maxH) continue;
    if (Math.abs(q.x) > C3.COURT.HALF_W_S + 0.8) continue;
    const stand = { x: q.x - r.x * 0.5 * a.h, z: q.z - a.facing * 0.3 };   // 셔틀이 포핸드 쪽 약간 앞에 오도록
    const need = Math.hypot(stand.x - a.pos.x, stand.z - a.pos.z) / spd + 0.12;
    if (need <= q.t) return { t: q.t, stand, y: q.y, jump: q.y > B.SHOULDER_H + B.REACH * 0.88 };
  }
  if (sim.land) return { t: sim.land.t, stand: { x: sim.land.x - r.x * 0.5 * a.h, z: sim.land.z }, y: 0, jump: false, hopeless: true };
  return null;
}

class AI3D {
  constructor(game, a) { this.game = game; this.a = a; this.plan = null; this.serveT = 0; }
  // 난이도 수치 + 성향(AI_STYLE)을 합친 값
  get d() {
    const g = this.game, sid = C3.AI_STYLE[g.styleId] ? g.styleId : 'base', key = g.diffId + '/' + sid;
    if (this._dk !== key) {
      const b = C3.AI[g.diffId], st = C3.AI_STYLE[sid];
      this._d = Object.assign({}, b, {
        smash: Math.min(0.95, b.smash * st.smashMul), over: b.over * st.overMul, misread: b.misread * st.misMul,
        jump: Math.min(0.95, b.jump + (b.jump > 0 ? st.jumpAdd : 0)),   // 점프를 아예 안 하는 난이도(쉬움)는 그대로
        tact: C3.AI_TACT[g.diffId] || 0, front: st.front, deepP: st.deepP, baseZ: st.baseZ
      });
      this._dk = key;
    }
    return this._d;
  }
  reset() { this.plan = null; }

  // 플레이어가 친 직후 호출 → 반응시간 뒤에 계획
  onIncoming(extraReact) { this.plan = null; this.planAt = this.d.react + (extraReact || 0); }

  makePlan() {
    const g = this.game, s = g.sh, d = this.d, m = g.match;
    const sim = Phys3.simulate(s.p, s.v, { path: true, coarse: 2 });
    // 아웃(서브는 서비스 코트 밖)될 공은 보냄 — 쉬울수록 가끔 잘못 읽고 받아침
    if (sim.land) {
      const L = sim.land, out = s.serve ? !m.inBox(m.box('opp', m.serveCourt()), L.x, L.z) : !m.inSingles(L.x, L.z);
      // 아웃 공: 대부분 보내지만, 가끔(라인 근처 애매한 공은 더 자주) 받아치는 실수 [게임]
      const C = C3.COURT, margin = Math.min(Math.abs(Math.abs(L.x) - C.HALF_W_S), Math.abs(Math.abs(L.z) - C.HALF_LEN));
      const chase = d.chaseOut + (margin < 0.35 ? 0.3 : 0);
      if (out && Math.random() > chase) { this.plan = { leave: true }; this.t0 = 0; return; }
    }
    const best = planIntercept(this.a, sim, d.spd, Math.random() < d.jump);
    if (best) {   // 위치 판단 오차 (쉬울수록 큼, 가끔 크게 잘못 읽음)
      const e = 0.08 * d.err, miss = Math.random() < d.misread * g.aiErrMul() ? 0.8 : 0;   // 랠리 템포만큼 오판↑
      best.stand.x += Phys3.randn() * e + (Math.random() < 0.5 ? -miss : miss);
      best.stand.z += Phys3.randn() * e;
    }
    this.plan = best; this.t0 = 0;
  }

  update(dt) {
    const g = this.game, s = g.sh, a = this.a, B = C3.BODY;
    a.speedMul = this.d.spd / B.SPEED;
    let target = null;

    if (g.trainer.active) {   // 훈련: AI는 피딩만 하고 공을 받지 않음
      if (g.phase === 'serve') { this.serveT -= dt; if (this.serveT <= 0) g.trainer.feed(); }
      const dx = 0 - a.pos.x, dz = -3.4 - a.pos.z;
      a.moveDir = g.phase === 'serve' || Math.hypot(dx, dz) < 0.08 ? { x: 0, z: 0 } : { x: dx, z: dz };
      return;
    }
    if (g.phase === 'serve' && g.match.server === 'opp') {
      this.serveT -= dt;
      if (this.serveT <= 0) this.serve();
    } else if (g.phase === 'rally' && s.live && s.lastHitter === 'me' && !s.netted) {
      if (!this.plan) { this.planAt -= dt; if (this.planAt <= 0) this.makePlan(); }
      if (this.plan && this.plan.leave) target = { x: 0, z: -this.d.baseZ };   // 나가는 공: 안 받음
      else if (this.plan) {
        this.t0 += dt;
        target = this.plan.stand;
        if (this.plan.jump && a.onGround() && this.plan.t - this.t0 < 0.3 + this.d.react * 0.2) { a.jump(); this.plan.jump = false; }
      }
      // 닿을 듯 말 듯하면 팔 뻗기
      const sh = a.shoulder(), dist = Math.hypot(s.p.x - sh.x, s.p.y - sh.y, s.p.z - sh.z);
      if (!(this.plan && this.plan.leave) && dist > a.reach() && dist < a.reach() + B.EXT_REACH && s.p.y < 1.4 && s.v.y < 0 && s.p.z < 0) a.extend(s.p, true);
      if (!(this.plan && this.plan.leave) && s.p.z < 0.02 && dist <= a.reach() * 0.95) g.aiHit();
    } else if (g.phase === 'rally') {
      target = { x: 0, z: -this.d.baseZ };          // 기본 위치로 복귀 (성향마다 앞뒤가 다름)
    }

    if (target) {
      const dx = target.x - a.pos.x, dz = target.z - a.pos.z, L = Math.hypot(dx, dz);
      a.moveDir = L > 0.08 ? { x: dx, z: dz } : { x: 0, z: 0 };
    } else a.moveDir = { x: 0, z: 0 };
  }

  // 샷 선택: 타점 높이·위치로 종류와 충전량, 조준은 플레이어 반대편 위주
  chooseShot(p) {
    const d = this.d, R = Math.random, rr = (a, b) => a + R() * (b - a), r = R();
    let type, c;
    if (p.y > 2.3) {
      if (r < d.smash) { type = 'down'; c = rr(0.7, 1.0); }
      else if (r < d.smash + (1 - d.smash) * 0.5) { type = 'down'; c = rr(0.05, 0.35); }
      else { type = 'lift'; c = rr(0.75, 1.0); }
    } else if (p.y > 1.3) {
      if (r < 0.4) { type = 'flat'; c = rr(0.5, 1.0); }
      else if (r < 0.7) { type = 'lift'; c = rr(0.7, 1.0); }
      else if (p.y > 1.6) { type = 'down'; c = rr(0.1, 0.35); }
      else { type = 'flat'; c = rr(0.2, 0.5); }
    } else {
      if (Math.abs(p.z) < 2.6 && r < 0.5) { type = 'lift'; c = rr(0, 0.25); }
      else if (r < 0.8 || Math.abs(p.z) > 2.6 || p.y < 1.0) { type = 'lift'; c = rr(0.6, 1.0); }
      else { type = 'flat'; c = rr(0.2, 0.45); }          // 낮은 공 푸시는 네트 앞에서만
    }
    // 위치 기반 전술 + 성향 [게임]: 내(플레이어) 위치를 보고 빈 곳으로
    //   · 플레이어가 뒤(네트에서 4.4m 이상)에 있으면 짧게: 높은 공은 드롭, 네트 근처 낮은 공은 헤어핀
    //   · 플레이어가 네트 앞(2.7m 이내)이면 길게: 높은 공은 그대로(스매시 기회), 그 외엔 클리어/드라이브로 머리 위를 넘김
    //   · 수비형: 스매시 대신 높고 깊은 클리어 / 네트형: 위치와 상관없이 짧은 공을 자주
    const pl = this.game.me.pos, plDeep = pl.z > 4.4, plNear = pl.z < 2.7, smashing = type === 'down' && c >= 0.45;
    if (smashing && R() < d.deepP) { type = 'lift'; c = rr(0.85, 1.0); }
    else if (R() < d.front + (plDeep && !smashing ? d.tact * 0.5 : 0)) {   // 스매시 기회는 전술 때문에 포기하지 않음 (네트형 성향만 예외)
      if (p.y > 1.6) { type = 'down'; c = rr(0.05, 0.3); }
      else if (Math.abs(p.z) < 3.5) { type = 'lift'; c = rr(0, 0.2); }
    } else if (plNear && !smashing && R() < d.tact) {
      if (p.y > 1.3 && p.y <= 2.3 && R() < 0.4) { type = 'flat'; c = rr(0.8, 1.0); }
      else { type = 'lift'; c = rr(0.85, 1.0); }
    }
    // 부드러운 플레이: 높게 띄워 코트 가운데 깊숙이 (쉬움일수록 자주)
    let soft = R() < d.soft;
    if (soft) { type = 'lift'; c = p.y < 0.6 ? rr(0.55, 0.75) : rr(0.6, 0.85); }
    if (R() < d.over * this.game.aiErrMul()) c = rr(1.17, 1.3);   // 랠리 템포만큼 과충전↑                     // 과충전 실수
    const me = this.game.me;
    const tx = soft ? rr(-0.9, 0.9) : R() < d.edge ? -Math.sign(me.pos.x || (R() - 0.5)) * rr(1.3, 2.3) : rr(-2.0, 2.0);
    // 조준: 실제로 떨어질 깊이(샷 종류·충전량) 기준으로 방향을 잡아야 노린 좌우 위치에 떨어짐 (예전엔 1.5+4c 어림값이라 깊은 샷이 옆으로 더 벌어졌음)
    const S = C3.SHOTS[type], tz = S.depth[0] + (S.depth[1] - S.depth[0]) * Math.min(1, c);
    const yaw = Math.max(-C3.AI_AIM_MAX, Math.min(C3.AI_AIM_MAX, Math.atan2(-(tx - p.x), tz - p.z)));
    return { type, c, yaw };
  }

  serve() {
    const g = this.game, R = Math.random, short = R() < 0.65;
    const c = short ? 0.14 + R() * 0.16 : 0.84 + R() * 0.12;
    const b = g.match.box('me', g.match.serveCourt());
    // 조준: 손에 든 셔틀 위치(heldPos)에서 대각선 서비스 코트 가운데 근처로, 실제로 떨어질 깊이 기준
    const p0 = g.heldPos(this.a), S = C3.SHOTS.serve;
    const tx = (b.xMin + b.xMax) / 2 + (R() - 0.5) * 0.9, tz = S.depth[0] + (S.depth[1] - S.depth[0]) * c;
    const yaw = Math.atan2(-(tx - p0.x), tz - p0.z);
    g.serveBy(this.a, R() < this.d.over * 0.5 ? 1.2 : c, yaw);
  }
}
