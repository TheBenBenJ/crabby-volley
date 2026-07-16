// crabby-volley · instantanés (sérialisation d'état pour le réseau)
"use strict";

// ---------- Instantanés (préparation du mode en ligne) ----------
// L'hôte enverra périodiquement getSnapshot() ; l'invité l'applique via
// applySnapshot() pour se resynchroniser. Voir MULTIJOUEUR.md.

// Propriétaire de la balle (1v1) : camp où elle se trouve, avec hystérésis
// autour du filet + cas spéciaux (service figé, Smash Battle → hôte).
function resolveBallOwner(prev) {
  if (battle.active) return 0;
  if (ball.frozen && !ball.popped) return servingSide;
  if (ball.x < NET_X - BALL_OWN_MARGIN) return 0;
  if (ball.x > NET_X + BALL_OWN_MARGIN) return 1;
  return prev === 0 || prev === 1 ? prev : (ball.x < NET_X ? 0 : 1);
}

function packBallState() {
  return {
    x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, a: ball.angle,
    f: ball.frozen ? 1 : 0, p: ball.popped ? 1 : 0, sm: ball.smash | 0,
    lts: ball.lastTouchSide, ltt: ball.lastTouchTick,
    t0: ball.touches[0], t1: ball.touches[1],
    own: ballOwner, rs: rngSeed,
    sc: serveCountdown, // le propriétaire de la balle pilote AUSSI le décompte
    // point différé : renvoyé dans CHAQUE paquet jusqu'à validation hôte
    // (canal non fiable → un paquet peut se perdre). Le n° de séquence rend
    // la consommation idempotente côté hôte (fini le multi-score).
    pt: pendingNetPoint ? [pendingNetPoint.side, pendingNetPoint.reason, pendingNetPoint.seq | 0] : null
  };
}

function applyBallState(b) {
  if (!b) return;
  ball.x = b.x; ball.y = b.y; ball.vx = b.vx; ball.vy = b.vy;
  ball.angle = b.a !== undefined ? b.a : ball.angle;
  ball.frozen = !!b.f; ball.popped = !!b.p;
  ball.smash = b.sm || 0;
  ball.lastTouchSide = b.lts;
  ball.lastTouchTick = b.ltt !== undefined ? b.ltt : -999;
  ball.touches = [b.t0 | 0, b.t1 | 0];
  if (b.own === 0 || b.own === 1) ballOwner = b.own;
  if (b.rs !== undefined) rngSeed = b.rs;
  // décompte de service répliqué depuis le propriétaire (l'hôte ne décrémente
  // pas le sien quand la balle est chez l'invité — voir stepGame/skipBall)
  if (b.sc !== undefined && state === "serve") serveCountdown = b.sc;
}

function getSnapshot() {
  return {
    state, servingSide, pointTimer, pointMsg, tick, serveCountdown,
    scores: [scores[0], scores[1]],
    rngSeed, weather, weatherTimer, bombMode, bombTimer, ballOwner,
    streak: [streak[0], streak[1]], superCharge: [superCharge[0], superCharge[1]],
    battle: { active: battle.active, t: battle.t,
              count: [battle.count[0], battle.count[1]],
              prevJump: [battle.prevJump[0], battle.prevJump[1]],
              cooldown: battle.cooldown },
    ball: {
      x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, angle: ball.angle,
      frozen: ball.frozen, popped: ball.popped, smash: ball.smash,
      lastTouchSide: ball.lastTouchSide, lastTouchTick: ball.lastTouchTick,
      touches: [ball.touches[0], ball.touches[1]]
    },
    blobs: activeBlobs.map(b => ({
      x: b.x, y: b.y, vx: b.vx, vy: b.vy, onGround: b.onGround,
      walkPhase: b.walkPhase, squash: b.squash,
      animal: b.animal, molt: b.molt, fatigue: b.fatigue, anger: b.anger, crazy: b.crazy, hasBall: b.hasBall, tongueOut: b.tongueOut, scramble: b.scramble,
      superT: b.superT, superKind: b.superKind, superSmash: b.superSmash,
      tongueT: b.tongueT, tongueTX: b.tongueTX, tongueTY: b.tongueTY
    }))
  };
}

function applySnapshot(s) {
  state = s.state; servingSide = s.servingSide;
  pointTimer = s.pointTimer; pointMsg = s.pointMsg; tick = s.tick; serveCountdown = s.serveCountdown || 0;
  scores[0] = s.scores[0]; scores[1] = s.scores[1];
  rngSeed = s.rngSeed;
  if (s.ballOwner === 0 || s.ballOwner === 1) ballOwner = s.ballOwner;
  if (s.streak) { streak[0] = s.streak[0]; streak[1] = s.streak[1]; }
  if (s.superCharge) { superCharge[0] = s.superCharge[0]; superCharge[1] = s.superCharge[1]; }
  if (s.weather !== undefined) { weather = s.weather; weatherTimer = s.weatherTimer; }
  if (s.bombMode !== undefined) { bombMode = s.bombMode; bombTimer = s.bombTimer || 0; }
  ball.x = s.ball.x; ball.y = s.ball.y;
  ball.vx = s.ball.vx; ball.vy = s.ball.vy;
  ball.angle = s.ball.angle;
  ball.frozen = s.ball.frozen; ball.popped = !!s.ball.popped;
  ball.smash = s.ball.smash || 0;
  ball.lastTouchSide = s.ball.lastTouchSide;
  ball.lastTouchTick = s.ball.lastTouchTick !== undefined ? s.ball.lastTouchTick : -999;
  ball.touches = [s.ball.touches[0], s.ball.touches[1]];
  if (s.battle) {
    battle.active = s.battle.active; battle.t = s.battle.t;
    battle.count = [s.battle.count[0], s.battle.count[1]];
    battle.prevJump = [!!s.battle.prevJump[0], !!s.battle.prevJump[1]];
    battle.cooldown = s.battle.cooldown;
  }
  activeBlobs.forEach((b, i) => {
    if (!s.blobs[i]) return;
    b.x = s.blobs[i].x; b.y = s.blobs[i].y;
    b.vx = s.blobs[i].vx; b.vy = s.blobs[i].vy;
    b.onGround = s.blobs[i].onGround;
    b.walkPhase = s.blobs[i].walkPhase; b.squash = s.blobs[i].squash;
    if (s.blobs[i].animal !== undefined) b.animal = s.blobs[i].animal;
    b.molt = s.blobs[i].molt || 0; b.fatigue = s.blobs[i].fatigue || 0; b.anger = s.blobs[i].anger || 0; b.crazy = s.blobs[i].crazy || 0; b.hasBall = !!s.blobs[i].hasBall; b.tongueOut = !!s.blobs[i].tongueOut; b.scramble = s.blobs[i].scramble || 0;
    b.superT = s.blobs[i].superT || 0; b.superKind = s.blobs[i].superKind || ""; b.superSmash = !!s.blobs[i].superSmash;
    b.tongueT = s.blobs[i].tongueT || 0; b.tongueTX = s.blobs[i].tongueTX || 0; b.tongueTY = s.blobs[i].tongueTY || 0;
  });
}

