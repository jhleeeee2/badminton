// court3d/shots.js — 샷 계획: (샷 종류, 충전량, 조준 방향, 타점, 포/백핸드 …) → 발사 속도
//   1) 충전량 → 상대 코트 깊이·발사각  2) 마우스 방향 + 오차 → 목표 지점
//   3) 공기저항 포함 궤적으로 "그 지점에 떨어지는 속력"을 역산   4) 과충전 = 아웃/네트

const Shots3 = {
  plan(o) {
    // o: { side:'me'|'opp', type:'lift'|'down'|'flat'|'serve', c, yaw, p0:{x,y,z}, bh, rth, ext, jumping, errMul }
    const S = C3.SHOTS[o.type], dz = o.side === 'me' ? -1 : 1;
    const cc = Math.max(0, Math.min(1, o.c));
    let depth = S.depth[0] + (S.depth[1] - S.depth[0]) * cc;
    let angle = S.angle[0] + (S.angle[1] - S.angle[0]) * cc;
    // 조준점 깊이(마우스): 충전량 대신 '어디로'를 정함. 샷마다 갈 수 있는 범위로 제한 [게임]
    if (o.aimDepth != null) depth = Math.max(S.aimMin || 0.9, Math.min(S.aimMax || S.depth[1], o.aimDepth));
    let errMul = o.errMul || 1;
    if (o.strAng && o.type === 'down' && cc >= 0.45) angle += o.strAng;   // 근력 훈련 효과: 스매시가 더 가파르고 빠르게
    if (o.bh) { depth = S.depth[0] + (depth - S.depth[0]) * C3.BACKHAND.DEPTH; errMul *= C3.BACKHAND.ERR; }
    if (o.ext) {
      // 네트 앞 런지 + 올리기/직선 = 실제 네트 플레이처럼 정확한 헤어핀·리프트·푸시 [실제 기술 참고, 수치는 게임]
      if (Math.abs(o.p0.z) < C3.EXTEND.NET_Z && (o.type === 'lift' || o.type === 'flat')) errMul *= C3.EXTEND.NET_ERR;
      else { depth *= C3.EXTEND.DEPTH; errMul *= C3.EXTEND.ERR; }
    }
    if (o.c > 1) errMul *= 1 + (o.c - 1) * 3;           // 꽉 채운 뒤 버틸수록 흔들림

    let fault = null;
    if (o.c > C3.CHARGE.FAULT) {                        // 과충전
      if (o.type === 'down') { angle = -32; fault = 'net'; }
      else { depth = C3.COURT.HALF_LEN + 0.6 + (o.c - C3.CHARGE.FAULT) * 3; fault = 'long'; }
    } else if (o.type === 'serve' && o.c < C3.CHARGE.SERVE_NET) {   // 서브를 너무 짧게
      depth = 0.8; angle = 4; fault = 'net';
    }

    const yaw = o.yaw + Phys3.randn() * C3.ERR.YAW * errMul;
    depth = Math.max(0.5, depth + Phys3.randn() * C3.ERR.DEPTH * errMul);

    // 목표 지점: 진행 방향으로 가다가 상대 코트 깊이 depth가 되는 곳
    const fx = (o.side === 'me' ? 1 : -1) * Math.sin(yaw), fz = dz * Math.cos(yaw);
    const tz = dz * depth, k = (tz - o.p0.z) / fz;
    const tx = o.p0.x + fx * k;
    const range = Math.hypot(tx - o.p0.x, tz - o.p0.z);
    const hx = (tx - o.p0.x) / range, hz = (tz - o.p0.z) / range;

    // 네트 보정: 네트에 걸릴 궤적이면 각도를 조금씩 올려 봄 (샷마다 한도 netFix°, 찍기는 높은 타점에서만)
    const lowSmash = S.fixMinH && o.p0.y < S.fixMinH && cc >= 0.45;              // 낮은 타점 스매시는 보정 없음 → 네트
    const fixMax = (fault || lowSmash) ? 0 : S.netFix;
    let s, sim, add = 0;
    for (;;) {
      s = Phys3.solveSpeed(o.p0, hx, hz, angle + add, range);
      sim = Phys3.simulate(o.p0, Phys3.launchVel(hx, hz, angle + add, s));
      if (!sim.net || add + 2 > fixMax) break;
      add += 2;
    }
    return {
      v0: Phys3.launchVel(hx, hz, angle + add, s), speed: s, kmh: Math.round(s * 3.6),
      sim, target: { x: tx, z: tz }, fault, name: this.name(o, cc)
    };
  },

  name(o, c) {
    if (o.type === 'serve') return c < 0.5 ? '숏 서브' : '롱 서브';
    if (o.type === 'lift') return c < 0.35 ? (Math.abs(o.p0.z) < 2.6 ? '헤어핀' : '리프트') : '클리어';
    if (o.type === 'down') return c < 0.45 ? '드롭' : (o.jumping ? '점프 스매시' : '스매시');
    return c < 0.45 ? '푸시' : '드라이브';
  }
};
