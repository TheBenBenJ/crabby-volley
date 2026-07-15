// crabby-volley · instantanés (sérialisation d'état pour le réseau)
"use strict";

// ---------- Instantanés (préparation du mode en ligne) ----------
// L'hôte enverra périodiquement getSnapshot() ; l'invité l'applique via
// applySnapshot() pour se resynchroniser. Voir MULTIJOUEUR.md.
function getSnapshot() {
  return {
    state, servingSide, pointTimer, pointMsg, tick, serveCountdown,
    scores: [scores[0], scores[1]],
    rngSeed, weather, weatherTimer,
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
      animal: b.animal, molt: b.molt, fatigue: b.fatigue, anger: b.anger, hasBall: b.hasBall, tongueOut: b.tongueOut, scramble: b.scramble,
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
  if (s.streak) { streak[0] = s.streak[0]; streak[1] = s.streak[1]; }
  if (s.superCharge) { superCharge[0] = s.superCharge[0]; superCharge[1] = s.superCharge[1]; }
  if (s.weather !== undefined) { weather = s.weather; weatherTimer = s.weatherTimer; }
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
    b.molt = s.blobs[i].molt || 0; b.fatigue = s.blobs[i].fatigue || 0; b.anger = s.blobs[i].anger || 0; b.hasBall = !!s.blobs[i].hasBall; b.tongueOut = !!s.blobs[i].tongueOut; b.scramble = s.blobs[i].scramble || 0;
    b.superT = s.blobs[i].superT || 0; b.superKind = s.blobs[i].superKind || ""; b.superSmash = !!s.blobs[i].superSmash;
    b.tongueT = s.blobs[i].tongueT || 0; b.tongueTX = s.blobs[i].tongueTX || 0; b.tongueTY = s.blobs[i].tongueTY || 0;
  });
}

