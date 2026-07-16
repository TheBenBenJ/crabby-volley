// crabby-volley · balle & physique (collisions, filet, murs)
"use strict";

// ---------- Balle ----------
const ball = {
  x: W * 0.25, y: 200, vx: 0, vy: 0, spin: 0, angle: 0,
  frozen: true,
  popped: false,       // balle crevée (plantée sur un bec)
  smash: 0,            // ticks restants de l'effet "smash destructeur"
  lastTouchSide: -1,
  lastTouchTick: -999, // tick du dernier contact (anti double-comptage)
  touches: [0, 0], // touches consécutives par équipe
  trail: [],
  reset(side) {
    this.x = side === 0 ? W * 0.25 : W * 0.75;
    this.y = GROUND_Y - 150;
    this.vx = 0; this.vy = 0;
    this.angle = 0; this.spin = 0;
    this.frozen = true;
    this.popped = false;
    this.smash = 0;
    this.lastTouchSide = -1;
    this.lastTouchTick = -999;
    this.touches = [0, 0];
    this.trail = [];
  }
};

// ---------- Physique balle ----------
function clampBallSpeed() {
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > MAX_BALL_SPEED) {
    ball.vx = ball.vx / sp * MAX_BALL_SPEED;
    ball.vy = ball.vy / sp * MAX_BALL_SPEED;
  }
}

function collideCircle(c, blob, isHead) {
  const dx = ball.x - c.x, dy = ball.y - c.y;
  const dist = Math.hypot(dx, dy);
  const minDist = BALL_R + c.r;
  if (dist >= minDist || dist === 0) return false;

  const a = animOf(blob);
  const nx = dx / dist, ny = dy / dist;
  // repousser la balle hors du cercle
  ball.x = c.x + nx * minDist;
  ball.y = c.y + ny * minDist;
  // vitesse de frappe : direction normale * puissance de l'animal + mouvement du joueur
  const hs = HIT_SPEED * a.power;
  ball.vx = nx * hs + blob.vx * 0.55;
  ball.vy = ny * hs + blob.vy * 0.35 - 2.5;

  // défaut de contrôle de base : légère déviation aléatoire (seedée).
  const baseSpread = (1 - a.control) * 0.6;
  if (baseSpread > 0.001) {
    const ang = Math.atan2(ball.vy, ball.vx) + (rng() - 0.5) * baseSpread;
    const mag = Math.hypot(ball.vx, ball.vy);
    ball.vx = Math.cos(ang) * mag;
    ball.vy = Math.sin(ang) * mag;
  }

  // langue collante de la grenouille : comme le bec, pas à tous les coups
  // (10%, seedé) — volontairement rare pour rester lisible : un joueur qui
  // perd un point à cause d'un aléa doit pouvoir sentir que c'est l'exception,
  // pas la norme. Effet tiré au sort : grosse déviation OU balle amortie.
  // La langue sort et reste visible jusqu'au prochain coup / nouveau point.
  blob.tongueOut = false;
  if (a.stick && rng() < 0.1) {
    blob.tongueOut = true;
    if (rng() < 0.5) {
      // déviation marquée
      const ang = Math.atan2(ball.vy, ball.vx) + (rng() - 0.5) * 1.25;
      const mag = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.cos(ang) * mag;
      ball.vy = Math.sin(ang) * mag;
    } else {
      // balle amortie / molle : la langue absorbe une partie de la frappe
      // (amorti adouci : la balle reste jouable, le malus gêne sans punir)
      ball.vx *= 0.68; ball.vy *= 0.68;
      ball.vy -= 2; // petit sursaut pour garder un arc jouable
    }
    beep(300, 0.12, "sine", 0.12);
  }

  clampBallSpeed();
  return true;
}

function beakTip(blob) {
  // pointe du bec : devant la tête, du côté où l'animal regarde
  const dir = blob.side === 0 ? 1 : -1;
  return { x: blob.x + dir * 30, y: blob.y - 62, r: 7 };
}

function ballBlobCollision(blob) {
  const a = animOf(blob);
  // --- crevaison au bec (oiseau + manchot) ---
  // si la balle rapide touche la pointe du bec, elle éclate et reste plantée.
  // la balle peut crever à tout moment, même sur son propre service :
  // le "BALLON CREVÉ SUR MON SERVICE" fait rire, on le garde. :)
  if (a.beak && !ball.frozen && !ball.popped) {
    const tip = beakTip(blob);
    const dd = Math.hypot(ball.x - tip.x, ball.y - tip.y);
    const fast = Math.hypot(ball.vx, ball.vy) > 8.5;
    // rareté seedée : même sur contact franc, ~10% de chance de crever
    // (même taux pour l'oiseau et le manchot — délibérément rare pour que la
    // crevaison se lise comme un coup du sort, pas comme un risque courant)
    if (dd < BALL_R + tip.r && fast && rng() < 0.1) {
      ball.popped = true;
      ball.frozen = true;
      ball.vx = 0; ball.vy = 0;
      blob.hasBall = true;
      shake = 9;
      beep(120, 0.3, "sawtooth", 0.2);
      pointMsg = "Balle crevée !";
      // le point sera accordé à l'adversaire à la résolution (updateBall)
      return;
    }
  }

  const hit = collideCircle(blob.headCircle, blob, true) ||
              collideCircle(blob.bodyCircle, blob, false);
  if (hit) {
    ball.spin = ball.vx * 0.02;
    if (ball.frozen) ball.frozen = false;
    ball.smash = 0; // une défense réussie éteint l'effet smash
    // comptage des touches : un contact qui se prolonge sur plusieurs ticks
    // (balle "portée" sur la tête en courant) ne compte qu'UNE touche —
    // c'était le bug du compteur qui sautait de 0 à 3 d'un coup.
    const newContact = ball.lastTouchSide !== blob.side ||
                       tick - ball.lastTouchTick > TOUCH_COOLDOWN;
    if (newContact) {
      if (ball.lastTouchSide !== blob.side) {
        ball.touches[blob.side] = 1;
      } else {
        ball.touches[blob.side]++;
      }
    }
    ball.lastTouchSide = blob.side;
    ball.lastTouchTick = tick;
    // technique offensive : Piqué éclair (oiseau) / Canon des glaces (manchot)
    if (blob.superSmash && blob.superT > 0) {
      const dir = blob.side === 0 ? 1 : -1;
      const pw = a.key === "manchot" ? 1.18 : a.key === "chibre" ? 1.28 : 1.0;
      ball.vx = dir * SMASH_VX * pw;
      // manchot : boulet plongeant · chibre : boulet rasant (quasi horizontal) · oiseau : piqué
      ball.vy = a.key === "manchot" ? 5.5 : a.key === "chibre" ? -0.5 : 2.5;
      ball.smash = 60; ball.spin = dir * 0.3;
      clampBallSpeed();
      blob.superSmash = false; blob.superT = 0; blob.superKind = "";
      shake = 13;
      spawnBoom(ball.x, ball.y);
      beep(140, 0.3, "sawtooth", 0.22);
    }
    noiseBurst(0.05, 0.15, 1300);  // "pock" d'impact
    animalHitSound(a);             // cri de l'animal
    // l'oiseau se déplume progressivement au fil des touches (8 coups pour
    // être totalement nu) ET se retrouve instantanément à nu s'il perd le
    // point avant d'y arriver (voir awardPoint dans 07-scoring.js) — les deux
    // logiques coexistent, remises à zéro au repos.
    if (a.molt) {
      if (blob.molt < MOLT_MAX) blob.molt++;
      spawnFeathers(ball.x, ball.y - BALL_R, blob.color, 6);
    }
    // le lapin se fatigue au fil des touches (purement visuel : oreilles qui
    // tombent, gouttes de sueur) — remis à zéro au repos, comme le plumage.
    if (a.tired && blob.fatigue < FATIGUE_MAX) blob.fatigue++;
    // le manchot devient de plus en plus furieux au fil des touches — même
    // logique (progressif + instantané au max en cas de point perdu).
    if (a.angry && blob.anger < ANGER_MAX) blob.anger++;
    // la grenouille sombre progressivement dans la folie au fil des touches —
    // même logique (progressif + instantané au max en cas de point perdu).
    if (a.crazy && blob.crazy < CRAZY_MAX) blob.crazy++;
    if (Math.hypot(ball.vx, ball.vy) > 12) shake = Math.min(shake + 4, 9);
    if (ball.touches[blob.side] > MAX_TOUCHES) {
      awardPoint(1 - blob.side, `Plus de ${MAX_TOUCHES} touches !`);
    }
  }
}

function updateBall() {
  // balle crevée : elle reste plantée sur le bec de celui qui l'a crevée,
  // puis le point est accordé à l'adversaire après un court instant.
  if (ball.popped) {
    const holder = activeBlobs.find(b => b.hasBall) || null;
    if (holder) {
      const tip = beakTip(holder);
      ball.x = tip.x; ball.y = tip.y;
      if (state === "play" || state === "serve") {
        awardPoint(1 - holder.side, "Balle crevée !");
      }
    }
    return;
  }
  if (ball.frozen) {
    // la balle attend le service : léger flottement, mais on teste
    // quand même le contact avec les joueurs pour déclencher le service
    // (basé sur tick, pas sur l'horloge : la simulation doit rester déterministe)
    ball.y += Math.sin(tick / 18) * 0.3;
    for (const b of activeBlobs) ballBlobCollision(b);
    return;
  }
  if (ball.smash > 0) ball.smash--;
  ball.vy += GRAV_BALL * ballLift(); // sol détrempé : la balle retombe plus vite
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.angle += ball.vx * 0.03 + ball.spin;

  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 8) ball.trail.shift();

  // murs latéraux — pas de plafond : la balle peut sortir par le haut
  if (ball.x - BALL_R < 0)   { ball.x = BALL_R;     ball.vx = Math.abs(ball.vx) * 0.9;  beep(300, 0.04); }
  if (ball.x + BALL_R > W)   { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.9; beep(300, 0.04); }

  // filet : côtés — détection CONTINUE (anti-tunnel). Une balle rapide
  // (jusqu'à 15 px/tick pour un poteau de 10 px) pouvait franchir le filet en
  // un seul tick sans jamais chevaucher sa position finale. On teste donc le
  // FRANCHISSEMENT du poteau entre l'ancienne et la nouvelle position.
  // Au-dessus du filet (y + R ≤ NET_TOP) : passage libre, pas de collision.
  const nl = NET_X - NET_W / 2, nr = NET_X + NET_W / 2;
  const aboveNet = ball.y + BALL_R <= NET_TOP;
  if (!aboveNet && ball.y + BALL_R > NET_TOP + BALL_R) {
    const prevX = ball.x - ball.vx;            // position avant ce déplacement
    const leftC = nl - BALL_R, rightC = nr + BALL_R; // contacts gauche/droite
    if (ball.vx > 0 && prevX <= leftC && ball.x > leftC) {
      ball.x = leftC; ball.vx = -Math.abs(ball.vx) * 0.8; beep(200, 0.05);
    } else if (ball.vx < 0 && prevX >= rightC && ball.x < rightC) {
      ball.x = rightC; ball.vx = Math.abs(ball.vx) * 0.8; beep(200, 0.05);
    } else if (ball.x > leftC && ball.x < rightC) {
      // chevauchement résiduel : repousse hors du poteau + vitesse mini pour
      // éviter le coin « balle collée au filet » (vx≈0 qui oscille).
      if (ball.x < NET_X) { ball.x = leftC; ball.vx = -Math.max(2.2, Math.abs(ball.vx) * 0.8); }
      else { ball.x = rightC; ball.vx = Math.max(2.2, Math.abs(ball.vx) * 0.8); }
      beep(200, 0.05);
    }
  }
  // filet : sommet (cercle) — uniquement si on n'est pas clairement au-dessus
  if (!aboveNet) {
    const dxn = ball.x - NET_X, dyn = ball.y - NET_TOP;
    const dn = Math.hypot(dxn, dyn);
    const minN = BALL_R + NET_W / 2 + 3;
    if (dn < minN && dn > 0) {
      const nx = dxn / dn, ny = dyn / dn;
      ball.x = NET_X + nx * minN;
      ball.y = NET_TOP + ny * minN;
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx = (ball.vx - 2 * dot * nx) * 0.75;
      ball.vy = (ball.vy - 2 * dot * ny) * 0.75;
      // si le rebond laisse une vitesse quasi nulle contre le poteau, on pousse
      if (Math.abs(ball.vx) < 1.2) ball.vx = (ball.x < NET_X ? -1 : 1) * 2.2;
      beep(200, 0.05);
    }
  }

  // remise à zéro des touches quand la balle change de camp
  const sideNow = ball.x < NET_X ? 0 : 1;
  if (ball.lastTouchSide !== -1 && sideNow !== ball.lastTouchSide) {
    ball.touches[sideNow] = 0;
  }

  // sol → point (avec explosion si c'était un smash destructeur, ou la bombe)
  if (ball.y + BALL_R >= GROUND_Y) {
    if (bombMode) {
      bombBlast(ball.x, GROUND_Y);
      awardPoint(ball.x < NET_X ? 1 : 0, "💥 BOUM !");
    } else {
      if (ball.smash > 0) { spawnBoom(ball.x, GROUND_Y); shake = 12; }
      awardPoint(ball.x < NET_X ? 1 : 0, ball.smash > 0 ? "SMASH !" : "");
    }
  }

  for (const b of activeBlobs) ballBlobCollision(b);
}

