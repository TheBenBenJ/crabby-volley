// crabby-volley · intelligence artificielle (3 niveaux, chasse au duel)
"use strict";

// ---------- IA ----------
function predictLandingX() {
  // simulation simple de la trajectoire jusqu'à la hauteur de frappe
  let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy;
  const hitY = GROUND_Y - 75;
  for (let i = 0; i < 300; i++) {
    vy += GRAV_BALL;
    x += vx; y += vy;
    if (x - BALL_R < 0) { x = BALL_R; vx = Math.abs(vx) * 0.9; }
    if (x + BALL_R > W) { x = W - BALL_R; vx = -Math.abs(vx) * 0.9; }
    if (y >= hitY && vy > 0) return x;
  }
  return x;
}

function aiInput() {
  const lvl = AI_LEVELS[aiLevel];
  const input = { left: false, right: false, jump: false };
  // Smash Battle : l'IA martèle à une cadence liée à sa difficulté
  // (~3,3 / 5 / 7,5 appuis par seconde — un humain motivé tape 6-10/s)
  if (battle.active) {
    const period = [8, 5, 3][aiLevel]; // difficile = martèlement quasi increvable
    input.jump = Math.floor(tick / period) % 2 === 0;
    return input;
  }
  const me = blobR;
  const input2 = { left: false, right: false, jump: false, super: false };
  Object.assign(input, input2);

  // l'IA commet une erreur de placement, renouvelée régulièrement
  // (rng seedé : l'IA reste déterministe pour le futur mode en ligne)
  if (--aiErrTimer <= 0) {
    aiErr = (rng() - 0.5) * 2 * lvl.err;
    aiRush = rng() < lvl.rush; // envie de duel, re-tirée régulièrement (seedé)
    aiErrTimer = 40;
  }

  // déclenche sa technique SUPER quand elle est prête, au bon moment
  if (superCharge[1] === 1 && me.superT <= 0 && !ball.frozen && state === "play") {
    const key = animOf(me).key;
    const onMySide = ball.x > NET_X;
    const nearHit = Math.abs(ball.x - me.x) < 72 && ball.y > me.y - 210 && ball.vy > -1;
    if (key === "grenouille") {
      if (onMySide && ball.vy > 0 && (ball.y > me.y - 70 || Math.abs(ball.x - me.x) > 110)) input.super = true;
    } else if (key === "oiseau" || key === "manchot" || key === "chibre") {
      if (onMySide && nearHit) input.super = true;
    } else if (onMySide && ball.vx > 0) { // lapin : turbo dès que la balle arrive
      input.super = true;
    }
  }

  // --- chasse au Smash Battle ---
  // balle qui plane près du filet + adversaire dans la zone : l'IA fonce
  // au filet et saute pour croiser l'adversaire en l'air → duel !
  const ballHighNearNet = !ball.frozen && state === "play" &&
        Math.abs(ball.x - NET_X) < BATTLE_BALL_DIST + 40 &&
        ball.y > -40 && ball.y < NET_TOP + 70;
  const oppTowardNet = Math.abs(blobL.x - NET_X) < BATTLE_NET_DIST + 60;
  if (aiRush && battle.cooldown === 0 && ballHighNearNet && oppTowardNet) {
    const rushX = NET_X + NET_W / 2 + 42;
    const dxr = rushX - me.x;
    if (dxr < -6) input.left = true;
    else if (dxr > 6) input.right = true;
    if (me.onGround && Math.abs(dxr) < 30 &&
        (!blobL.onGround || Math.abs(blobL.x - NET_X) < BATTLE_NET_DIST)) {
      input.jump = true;
    }
    return input;
  }

  const ballComing = ball.x > NET_X - 80 || (ball.vx > 1.0 && !ball.frozen);
  let targetX;

  if (ball.frozen && servingSide === 1) {
    // aller sous la balle pour servir
    targetX = ball.x + 8;
  } else if (ballComing) {
    const land = predictLandingX();
    // ATTAQUE : se poster derrière la balle (côté filet) pour la renvoyer
    // fort vers le camp adverse. Plus le niveau est élevé, plus on se poste
    // franchement derrière → frappe plate et offensive plutôt que cloche molle.
    targetX = land > NET_X ? land + lvl.attack + aiErr : me.homeX;
  } else {
    targetX = me.homeX;
  }
  // rester dans son camp, sans coller au filet ni au mur
  targetX = Math.max(NET_X + 42, Math.min(W - 40, targetX));

  const dx = targetX - me.x;
  const dead = 6 - lvl.react * 3; // les bons niveaux se recalent plus finement
  if (dx < -dead) input.left = true;
  else if (dx > dead) input.right = true;

  // SAUT offensif : balle de son côté, à portée horizontale, en approche/descente
  const overMySide = ball.x > NET_X + BALL_R;
  const closeX = Math.abs(ball.x - me.x) < 42 + lvl.attack;
  const descending = ball.vy > -2;
  const strikeZone = ball.y < me.y - 34 && ball.y > me.y - 205;
  if (!ball.frozen && overMySide && closeX && descending && strikeZone) {
    if (me.onGround) {
      input.jump = true;
    } else if (lvl.dbl && me.jumpsUsed === 1 && me.vy > -1.5 && ball.y < me.y - 130) {
      // double saut pour rattraper une balle un peu trop haute (sans abuser)
      input.jump = true;
    }
  }
  // service : sauter pour toucher la balle gelée
  if (ball.frozen && servingSide === 1 && Math.abs(ball.x - me.x) < 20 && me.onGround) {
    input.jump = true;
  }
  return input;
}

// IA 2v2 : version « côté-agnostique » de aiInput, avec répartition d'équipe.
// Chaque IA connaît son camp (me.side) et son coéquipier ; celui qui est le
// plus proche du point de chute prend la balle, l'autre couvre sa zone (home).
// Pas de Smash Battle en 2v2 → logique de duel retirée ici.
function aiInput2v2(me) {
  const lvl = AI_LEVELS[aiLevel];
  const input = { left: false, right: false, jump: false, super: false };
  const side = me.side;
  const back = side === 0 ? -1 : 1;               // « derrière la balle » côté son mur
  const half = 34;
  const minX = side === 0 ? half : NET_X + NET_W / 2 + half - 6;
  const maxX = side === 0 ? NET_X - NET_W / 2 - half + 6 : W - half;
  const mid = (minX + maxX) / 2;
  const onMySide = side === 0 ? ball.x < NET_X : ball.x > NET_X;
  const mate = activeBlobs.find(b => b !== me && b.side === side);

  // erreur de placement renouvelée régulièrement (seedée → déterministe)
  if (me._aiT === undefined) { me._aiT = 0; me._aiErr = 0; }
  if (--me._aiT <= 0) { me._aiErr = (rng() - 0.5) * 2 * lvl.err; me._aiT = 40; }

  // qui prend la balle : le plus proche du point de chute ; à égalité, l'avant
  // (dont le camp est le plus proche du filet) couvre les balles proches du filet.
  const land = predictLandingX();
  let chaser = me;
  if (mate && (onMySide || ball.frozen)) {
    const dMe = Math.abs(land - me.x), dMate = Math.abs(land - mate.x);
    if (dMate < dMe - 4) chaser = mate;
    else if (Math.abs(dMate - dMe) <= 4) {
      const meFront = side === 0 ? me.homeX > mate.homeX : me.homeX < mate.homeX;
      const landFront = side === 0 ? land > mid : land < mid;
      chaser = (meFront === landFront) ? me : mate;
    }
  }
  const iChase = chaser === me;

  let targetX;
  if (ball.frozen && servingSide === side) {
    targetX = iChase ? ball.x + back * 6 : me.homeX;      // l'avant va servir
  } else if (onMySide && iChase) {
    targetX = land + back * lvl.attack + me._aiErr;       // se poster derrière la balle
  } else {
    targetX = me.homeX;                                    // couvrir sa zone
  }
  targetX = Math.max(minX + 6, Math.min(maxX - 6, targetX));

  const dx = targetX - me.x;
  const dead = 6 - lvl.react * 3;
  if (dx < -dead) input.left = true;
  else if (dx > dead) input.right = true;

  // SAUT offensif (miroir de l'IA 1v1, mais dépendant du camp)
  const overMySide = side === 0 ? ball.x < NET_X - BALL_R : ball.x > NET_X + BALL_R;
  const closeX = Math.abs(ball.x - me.x) < 42 + lvl.attack;
  const descending = ball.vy > -2;
  const strikeZone = ball.y < me.y - 34 && ball.y > me.y - 205;
  if (iChase && !ball.frozen && overMySide && closeX && descending && strikeZone) {
    if (me.onGround) input.jump = true;
    else if (lvl.dbl && me.jumpsUsed === 1 && me.vy > -1.5 && ball.y < me.y - 130) input.jump = true;
  }
  if (iChase && ball.frozen && servingSide === side && Math.abs(ball.x - me.x) < 20 && me.onGround) {
    input.jump = true;
  }

  // technique SUPER : charge partagée par l'équipe (superCharge[side])
  if (iChase && superCharge[side] === 1 && me.superT <= 0 && !ball.frozen && state === "play") {
    const key = animOf(me).key;
    const nearHit = Math.abs(ball.x - me.x) < 72 && ball.y > me.y - 210 && ball.vy > -1;
    if (key === "grenouille") {
      if (onMySide && ball.vy > 0 && (ball.y > me.y - 70 || Math.abs(ball.x - me.x) > 110)) input.super = true;
    } else if (key === "oiseau" || key === "manchot" || key === "chibre") {
      if (onMySide && nearHit) input.super = true;
    } else if (onMySide && (side === 0 ? ball.vx < 0 : ball.vx > 0)) {
      input.super = true; // lapin : turbo dès que la balle arrive vers soi
    }
  }
  return input;
}

