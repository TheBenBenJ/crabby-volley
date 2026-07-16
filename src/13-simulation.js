// crabby-volley · simulation — Smash Battle, stepGame, techniques SUPER
"use strict";

// ---------- Smash Battle : logique ----------
function canStartBattle() {
  return !bombMode && // pas de duel au filet en mode bombe (la mèche tourne !)
         state === "play" && !ball.frozen && !ball.popped && battle.cooldown === 0 &&
         !blobL.onGround && !blobR.onGround &&
         Math.abs(blobL.x - NET_X) < BATTLE_NET_DIST &&
         Math.abs(blobR.x - NET_X) < BATTLE_NET_DIST &&
         Math.abs(ball.x - NET_X) < BATTLE_BALL_DIST &&
         ball.y > -40 && ball.y < NET_TOP + 60;
}

function startBattle(inL, inR) {
  battle.active = true;
  battle.t = BATTLE_TICKS;
  battle.count = [0, 0];
  battle.prevJump = [!!inL.jump, !!inR.jump];
  shake = 6;
  beep(880, 0.12, "square", 0.18);
  beep(440, 0.3, "sawtooth", 0.12);
}

function stepBattle(inL, inR) {
  // seuls les fronts montants comptent : il faut MARTELER, pas rester appuyé
  const ins = [inL, inR];
  for (const s of [0, 1]) {
    if (ins[s].jump && !battle.prevJump[s]) {
      battle.count[s]++;
      beep(600 + battle.count[s] * 18, 0.03, "square", 0.07);
    }
    battle.prevJump[s] = !!ins[s].jump;
  }
  if (--battle.t > 0) return;

  // résolution du duel
  battle.active = false;
  battle.cooldown = BATTLE_COOLDOWN;
  let winner;
  if (battle.count[0] > battle.count[1]) winner = 0;
  else if (battle.count[1] > battle.count[0]) winner = 1;
  else winner = rng() < 0.5 ? 0 : 1; // égalité parfaite : tirage seedé
  const dir = winner === 0 ? 1 : -1;

  // smash destructeur : la balle plonge en flammes dans le camp adverse
  ball.x = NET_X + dir * (BALL_R + NET_W);
  ball.y = NET_TOP - 30;
  ball.vx = dir * SMASH_VX;
  ball.vy = SMASH_VY;
  ball.smash = 60;
  ball.spin = dir * 0.3;
  ball.lastTouchSide = winner;
  ball.lastTouchTick = tick;
  ball.touches[winner] = 1;
  ball.touches[1 - winner] = 0;

  // le perdant est projeté loin du filet
  const loser = winner === 0 ? blobR : blobL;
  loser.x += dir * 45;
  loser.vy = -5;
  loser.onGround = false;

  shake = 14;
  beep(180, 0.4, "sawtooth", 0.25);
}

// ---------- Simulation ----------
// stepGame(inL, inR) est le cœur déterministe du jeu : mêmes entrées + même
// graine = même partie. C'est l'unité de synchronisation du futur mode en ligne.
// ---------- Techniques signature (SUPER) ----------
function superReadyFor(blob) {
  return state === "play" && superCharge[blob.side] === 1 && blob.superT <= 0 && !blob.hasBall;
}

function maybeActivateSuper(blob, input) {
  const pressed = input.super && !blob.prevSuper;
  blob.prevSuper = !!input.super;
  if (!pressed || !superReadyFor(blob)) return;
  const a = animOf(blob);
  superCharge[blob.side] = 0;
  blob.superKind = a.key;
  blob.superT = SUPER_DUR[a.key] || 50;
  superFlash = a.name + " !"; superFlashT = 48;
  shake = Math.max(shake, 7);
  crowdHype = Math.max(crowdHype, 45);
  spawnSuperBurst(blob);
  superSound(a.key);
  if (a.key === "oiseau") {
    blob.vy = BLOB_JUMP * a.jump * 1.3; // Piqué éclair : bond fulgurant
    blob.onGround = false; blob.jumpsUsed = 1;
    blob.superSmash = true;
  } else if (a.key === "manchot" || a.key === "chibre") {
    blob.superSmash = true;             // Canon des glaces / Coup de boutoir : prochaine frappe
  } else if (a.key === "grenouille") {
    frogTongueGrab(blob);               // Langue-grappin : rattrape l'irrattrapable
  } else if (a.key === "chneck" && blob.onGround) {
    blob.vy = BLOB_JUMP * a.jump * 0.9; // Retombée de chat : bond félin d'entrée
    blob.onGround = false; blob.jumpsUsed = 1;
  }
  // lapin/chatte : l'effet agit pendant superT (voir Blob.update : turbo / cat)
}

function frogTongueGrab(blob) {
  const dir = blob.side === 0 ? 1 : -1;
  const onSide = blob.side === 0 ? ball.x < NET_X - BALL_R : ball.x > NET_X + BALL_R;
  const inRange = !ball.frozen && !ball.popped && onSide &&
                  Math.hypot(ball.x - blob.x, ball.y - (blob.y - 55)) < 640;
  if (inRange) {
    blob.tongueTX = ball.x; blob.tongueTY = ball.y; blob.tongueT = blob.superT;
    // la langue happe la balle et la renvoie en cloche par-dessus le filet
    ball.x = blob.x + dir * 42; ball.y = blob.y - 66;
    ball.vx = dir * 8.6; ball.vy = -9; ball.smash = 0;
    ball.lastTouchSide = blob.side; ball.lastTouchTick = tick;
    ball.touches[blob.side] = 1; ball.touches[1 - blob.side] = 0;
    ball.frozen = false;
    beep(200, 0.18, "sawtooth", 0.18, 0, 540);
  } else {
    // rien à portée : la langue claque dans le vide (petit fouet)
    blob.tongueTX = blob.x + dir * 130; blob.tongueTY = blob.y - 70; blob.tongueT = 14;
  }
}

function tickSuper(blob) {
  if (blob.tongueT > 0) blob.tongueT--;
  if (blob.superT > 0 && --blob.superT <= 0) { blob.superKind = ""; blob.superSmash = false; }
}

function superSound(key) {
  beep(520, 0.08, "square", 0.14, 0, 800);
  beep(800, 0.1, "square", 0.13, 0.08, 1150);
  if (key === "manchot") beep(150, 0.28, "sawtooth", 0.18, 0.05, 90);
  if (key === "oiseau")  beep(1500, 0.12, "square", 0.1, 0.14, 2100);
  if (key === "lapin")   beep(300, 0.22, "sine", 0.14, 0.05, 950);
  if (key === "grenouille") beep(240, 0.16, "sawtooth", 0.15, 0.1, 130);
  if (key === "chibre")  beep(110, 0.26, "sine", 0.16, 0.05, 700);
  if (key === "chneck")  { beep(700, 0.14, "sine", 0.12, 0.04, 1050); beep(520, 0.16, "triangle", 0.1, 0.12, 380); }
}

// ---------- Mode Bombe : logique ----------
// L'explosion (mèche à zéro OU balle au sol) : le camp où se trouve la bombe
// perd le point → l'adversaire marque. Même formule que la chute classique :
// ball.x < NET_X ? 1 : 0  = le camp qui GAGNE le point.
function bombBlast(x, y) {
  spawnBoom(x, y);
  spawnBoom(x, y - 8);   // gerbe plus dense qu'un simple smash
  shake = Math.max(shake, 18);
  bombFlash = 1;         // éclair plein écran (visuel, se résorbe au rendu)
  beep(70, 0.5, "sawtooth", 0.3, 0, 30);
  beep(130, 0.4, "square", 0.22, 0.02, 40);
}

// décompte de la mèche + explosion en fin de compte. Appelé en fin de stepGame,
// donc uniquement quand la balle est réellement en jeu et déterministe.
function tickBomb() {
  if (state !== "play" || ball.frozen || ball.popped) return;
  if (bombTimer > 0) {
    bombTimer--;
    // bips d'alerte : une fois par seconde, puis plus serrés dans les 3 dernières
    if (bombTimer > 180) { if (bombTimer % 60 === 0) beep(660, 0.05, "square", 0.09); }
    else if (bombTimer % 20 === 0) beep(880, 0.05, "square", 0.12, 0, 1200);
  }
  if (bombTimer <= 0) {
    bombBlast(ball.x, ball.y);
    awardPoint(ball.x < NET_X ? 1 : 0, "💥 BOUM !");
  }
}

// stepGame(inL, inR)        → 1v1 / online (chemin d'origine)
// stepGame(null, null, ins) → 2v2 : `ins` alignées sur activeBlobs
function stepGame(inL, inR, ins) {
  tick++;
  stepWeather();
  if (superFlashT > 0) superFlashT--;
  if (battle.cooldown > 0) battle.cooldown--;
  if (battle.active && !ins) {
    stepBattle(inL, inR);
    return; // le monde est figé pendant le duel (1v1 uniquement)
  }
  if (state === "serve" && serveCountdown > 0) {
    // pendant le décompte : on peut se déplacer mais pas sauter ni servir
    if (ins) {
      activeBlobs.forEach((b, i) => b.update({ left: ins[i].left, right: ins[i].right, jump: false }));
    } else {
      blobL.update({ left: inL.left, right: inL.right, jump: false });
      blobR.update({ left: inR.left, right: inR.right, jump: false });
    }
    serveCountdown--;
    ball.y += Math.sin(tick / 18) * 0.3;
  } else if (ins) {
    // 2v2 : pas de Smash Battle (duel à 2), on met à jour les 4 joueurs
    activeBlobs.forEach((b, i) => maybeActivateSuper(b, ins[i]));
    activeBlobs.forEach((b, i) => b.update(ins[i]));
    updateBall();
    activeBlobs.forEach(b => tickSuper(b));
  } else {
    // déclenchement des techniques signature avant le mouvement
    maybeActivateSuper(blobL, inL);
    maybeActivateSuper(blobR, inR);
    blobL.update(inL);
    blobR.update(inR);
    // déclenchement du duel : les deux en l'air au filet, balle proche
    if (canStartBattle()) startBattle(inL, inR);
    else updateBall();
    tickSuper(blobL);
    tickSuper(blobR);
  }
  if (bombMode) tickBomb();
  if (state === "serve" && !ball.frozen) state = "play";
}

function localInputs(side) {
  const pad = padGameInput(side); // manette 1 → Rouge, manette 2 → Vert
  const raw = side === 0 ? {
    left:  !!keys["KeyA"] || pad.left,
    right: !!keys["KeyD"] || pad.right,
    jump:  !!(keys["KeyW"] || keys["Space"]) || pad.jump,
    super: !!keys["KeyS"] || pad.super            // Rouge : S = SUPER
  } : {
    left:  !!keys["ArrowLeft"] || pad.left,
    right: !!keys["ArrowRight"] || pad.right,
    jump:  !!keys["ArrowUp"] || pad.jump,
    super: !!keys["ArrowDown"] || pad.super        // Vert : ↓ = SUPER
  };
  return xInput(side, activeBlobs[side], raw);
}

function update() {
  if (online) { netUpdate(); return; }
  if (paused) return;

  if (state === "point") {
    pointTimer--;
    const elapsed = POINT_MAX_WAIT - pointTimer;
    if ((elapsed >= POINT_MIN_WAIT && pointAdvanceRequested()) || pointTimer <= 0) startRally();
    return;
  }
  if (state !== "play" && state !== "serve") return;

  if (mode === "2v2") {
    // toi = blobL (activeBlobs[0]) ; les trois autres sont pilotés par l'IA
    const ins = activeBlobs.map((b, i) => i === 0 ? localInputs(0) : aiInput2v2(b));
    stepGame(null, null, ins);
    return;
  }
  const inL = localInputs(0);
  const inR = vsAI ? aiInput() : localInputs(1);
  stepGame(inL, inR);
}

