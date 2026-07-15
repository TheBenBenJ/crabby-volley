// crabby-volley · intelligence artificielle (3 niveaux, chasse au duel)
"use strict";

// ---------- IA ----------
function predictLandingX() {
  // simulation de la trajectoire jusqu'à la hauteur de frappe, en tenant compte
  // des murs ET du rebond sur le sommet du filet (l'IA ne se fait plus surprendre
  // par une balle qui accroche la bande).
  let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy;
  const hitY = GROUND_Y - 75;
  const minN = BALL_R + NET_W / 2 + 3;
  for (let i = 0; i < 400; i++) {
    vy += GRAV_BALL;
    x += vx; y += vy;
    if (x - BALL_R < 0) { x = BALL_R; vx = Math.abs(vx) * 0.9; }
    if (x + BALL_R > W) { x = W - BALL_R; vx = -Math.abs(vx) * 0.9; }
    // rebond sur le sommet du filet (cercle), miroir de updateBall
    const dxn = x - NET_X, dyn = y - NET_TOP, dn = Math.hypot(dxn, dyn);
    if (dn < minN && dn > 0) {
      const nx = dxn / dn, ny = dyn / dn;
      x = NET_X + nx * minN; y = NET_TOP + ny * minN;
      const dot = vx * nx + vy * ny;
      vx = (vx - 2 * dot * nx) * 0.75; vy = (vy - 2 * dot * ny) * 0.75;
    }
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
    const period = [8, 5, 3, 2][aiLevel]; // impitoyable = martèlement quasi increvable
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

  // anticipation : dès que la balle repart vers son camp (ou l'a franchi), l'IA
  // se met en route vers le point de chute prévu — elle n'attend pas la balle.
  const ballComing = ball.x > NET_X - 120 || (ball.vx > 0.3 && !ball.frozen && ball.x > NET_X - 220);
  let targetX;

  if (ball.frozen && servingSide === 1) {
    // aller sous la balle pour servir
    targetX = ball.x + 8;
  } else if (ballComing) {
    const land = predictLandingX();
    if (land <= NET_X) {
      targetX = me.homeX;
    } else if (land < NET_X + 90) {
      // BALLE COURTE (retombe près du filet) : priorité à la fiabilité, on se
      // met quasi dessous pour la remonter — surtout PAS l'offset de placement,
      // qui écarterait l'IA du filet et la ferait rater la balle.
      targetX = land + 8;
    } else if (lvl.aim) {
      // PLACEMENT INTENTIONNEL : viser LOIN de l'adversaire.
      // L'IA est à droite ; se poster à droite de la balle (offset>0) la renvoie
      // vers la gauche. CRUCIAL : l'offset doit rester DANS le rayon de frappe
      // (≈ BALL_R + rayon corps ≈ 40 px) sinon l'IA se poste à côté de la balle
      // et la rate complètement. On module donc l'angle dans une plage sûre :
      // adverse au filet → offset un peu plus grand (drive plus profond) ;
      // adverse au fond → offset plus petit (renvoi plus court, plus vertical).
      const oppNearNet = blobL.x > NET_X - 150;
      const place = oppNearNet ? 26 : 15;
      targetX = land + place + aiErr;
    } else {
      // niveaux bas : simple renvoi offensif, décalage fixe (borné au rayon utile)
      targetX = land + Math.min(lvl.attack, 22) + aiErr;
    }
  } else {
    targetX = me.homeX;
  }
  // rester dans son camp ; on autorise à s'approcher au plus près du filet
  // (≈ limite physique du joueur) pour aller chercher les amortis courts
  targetX = Math.max(NET_X + 36, Math.min(W - 40, targetX));

  const dx = targetX - me.x;
  // zone morte proportionnelle à la vitesse : un pas de déplacement rapide
  // dépasse une petite zone morte → l'IA oscillerait autour de sa cible. On
  // la cale sur ~un pas pour qu'elle se pose net (positionnement précis).
  const step = BLOB_SPEED * lvl.speedMul * animOf(me).speed;
  const dead = Math.max(6 - lvl.react * 3, step * 0.9);
  if (dx < -dead) input.left = true;
  else if (dx > dead) input.right = true;

  // SAUT : on ne saute QUE pour les balles trop hautes pour un contact debout,
  // et bien centrées horizontalement (fenêtre serrée = contact sûr, fini les
  // whiffs). Les balles basses se jouent debout : le contact tête/corps est
  // automatique dès que la balle descend dans le joueur → beaucoup plus fiable.
  const overMySide = ball.x > NET_X + BALL_R;
  const reachX = Math.abs(ball.x - me.x) < 30;
  const descending = ball.vy > -1;
  const highBall = ball.y < me.y - 92 && ball.y > me.y - 210; // au-dessus de la tête
  if (!ball.frozen && overMySide && reachX && descending && highBall) {
    if (me.onGround) {
      input.jump = true;
    } else if (lvl.dbl && me.jumpsUsed === 1 && me.vy > -1.5 && ball.y < me.y - 150) {
      input.jump = true; // double saut pour une balle encore plus haute
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
  const step2v2 = BLOB_SPEED * lvl.speedMul * animOf(me).speed;
  const dead = Math.max(6 - lvl.react * 3, step2v2 * 0.9);
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

