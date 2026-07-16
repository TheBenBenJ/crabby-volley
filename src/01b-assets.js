// crabby-volley · sprites (images PNG) — chargement asynchrone, fallback canvas
"use strict";

// Catalogue des images du jeu. Tant qu'une image n'est pas `complete` avec
// naturalWidth > 0, les draw* gardent le rendu vectoriel d'origine.
const SPRITES = {
  scoobyIdle: null,
  scoobyRun: null,
  scoobyPounce: null,
  mysteryVan: null,
};

function loadSprite(path) {
  const img = new Image();
  img.src = path;
  return img;
}

function spriteReady(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

function initSprites() {
  const base = "assets/scooby/";
  SPRITES.scoobyIdle = loadSprite(base + "idle.png");
  SPRITES.scoobyRun = loadSprite(base + "run.png");
  SPRITES.scoobyPounce = loadSprite(base + "pounce.png");
  SPRITES.mysteryVan = loadSprite(base + "van.png");
}

initSprites();

/** Phase d'anim Scooby : walkPhase en jeu, sinon temps (menus / idle). */
function scoobyAnimT(b) {
  if (b && (b.walkPhase || b.walkPhase === 0) && (Math.abs(b.vx || 0) > 0.15 || b.scramble)) {
    return b.walkPhase;
  }
  return performance.now() / 1000 * 6.5;
}

/**
 * Choisit le sprite : galop 2 « frames » (run ↔ pounce), idle face au menu,
 * pounce en l'air / super / atterrissage.
 */
function scoobySpriteFor(b) {
  const turbo = b.superT > 0 && b.superKind === "scooby";
  const moving = Math.abs(b.vx || b.dispVx || 0) > 0.35 || !!b.scramble;
  const t = scoobyAnimT(b);

  if (!b.onGround || turbo) return SPRITES.scoobyPounce;

  // Atterrissage écrasé : pose pounce un instant
  if ((b.squash || 0) > 2.2) return SPRITES.scoobyPounce;

  // Menu sélection : face caméra qui respire
  if (typeof state === "string" && state.indexOf("select") === 0 && !moving) {
    return SPRITES.scoobyIdle;
  }

  if (moving) {
    // Galop cartoon : alterne course / bond sur la phase de marche
    const gallop = Math.sin(t * 1.15);
    return gallop > 0.15 ? SPRITES.scoobyRun : SPRITES.scoobyPounce;
  }

  // Idle en jeu : profil, avec micro-swap nerveux
  if (Math.sin(t * 0.55) > 0.92) return SPRITES.scoobyPounce;
  return SPRITES.scoobyRun;
}

/**
 * Dessine un sprite ancré aux pieds avec squash/stretch, lean, bob.
 * Les sources regardent vers la droite ; dir=-1 miroite.
 */
function drawAnchoredSprite(img, bx, by, dir, drawH, opts) {
  if (!spriteReady(img)) return false;
  opts = opts || {};
  const aspect = img.naturalWidth / img.naturalHeight;
  let drawW = drawH * aspect;
  const bobY = opts.bobY || 0;
  const lean = opts.lean || 0;       // radians
  const squashX = opts.squashX != null ? opts.squashX : 1;
  const squashY = opts.squashY != null ? opts.squashY : 1;
  const alpha = opts.alpha != null ? opts.alpha : 1;
  const ox = opts.ox || 0;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(bx + ox, by + bobY);
  ctx.rotate(lean * (dir < 0 ? -1 : 1));
  ctx.scale((dir < 0 ? -1 : 1) * squashX, squashY);
  ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
  return true;
}

/**
 * Masterclass d'animation Scooby (sprites).
 * Retourne true si dessiné ; false → fallback canvas.
 */
function drawScoobySpriteMaster(b) {
  const spr = scoobySpriteFor(b);
  if (!spriteReady(spr)) return false;

  const s = Math.max(0, b.squash || 0);
  const bx = b.x, by = b.y;
  const dir = b.side === 0 ? 1 : -1;
  const fatigueT = (b.fatigue || 0) / FATIGUE_MAX;
  const turbo = b.superT > 0 && b.superKind === "scooby";
  const moveVx = (b.dispVx != null && Math.abs(b.dispVx) > 0.01) ? b.dispVx : (b.vx || 0);
  const speed = Math.abs(moveVx);
  const moving = speed > 0.35 || !!b.scramble;
  const t = scoobyAnimT(b);
  const now = performance.now() / 1000;
  const airborne = !b.onGround;

  // --- Paramètres d'anim (exagérés à dessein) ---
  let bobY = 0;
  let lean = 0;
  let squashX = 1;
  let squashY = 1;
  let baseH = 80 - fatigueT * 8;

  if (airborne || turbo) {
    // Stretch vertical selon vy + tilt dynamique
    const stretch = 1 + Math.max(-0.12, Math.min(0.28, -(b.vy || 0) * 0.018));
    squashY = stretch;
    squashX = 1 / Math.sqrt(stretch);
    lean = Math.max(-0.55, Math.min(0.55, moveVx * 0.04 + (b.vy || 0) * -0.012));
    // Flottement / panique en l'air
    bobY = Math.sin(now * 22) * (turbo ? 2.8 : 1.2);
    lean += Math.sin(now * 16) * (turbo ? 0.12 : 0.04);
    baseH = 84;
  } else if (moving) {
    // Galop : double fréquence, gros bob, squash contact sol
    const gait = Math.sin(t * 1.15);
    const contact = Math.max(0, -gait); // phase « pattes au sol »
    bobY = gait * 5.5 - contact * 2;
    squashY = 1 - contact * 0.18 + Math.max(0, gait) * 0.12;
    squashX = 1 / squashY;
    // Lean dans le sens de la course + anticipe le freinage (slip)
    lean = moveVx * 0.055;
    if (b.scramble && Math.sign(b.vx || 0) !== Math.sign(moveVx) && (b.vx || 0) !== 0) {
      lean -= Math.sign(moveVx) * 0.25; // dérapage : corps en arrière
    }
    lean += Math.sin(t * 2.3) * 0.06;
    // Tremblement de panique proportionnel à la fatigue
    bobY += Math.sin(now * 28) * fatigueT * 1.8;
    lean += Math.sin(now * 31) * fatigueT * 0.05;
  } else {
    // Idle nerveux : respiration + weight-shift + frissons
    const breath = Math.sin(now * 3.2);
    squashY = 1 + breath * 0.045;
    squashX = 1 / squashY;
    bobY = breath * 1.6 + Math.sin(now * 11) * 0.6;
    lean = Math.sin(now * 2.1) * 0.08 + Math.sin(now * 9) * 0.025;
    // Ruh-roh : petit sursaut irrégulier
    const scare = Math.max(0, Math.sin(now * 1.7) - 0.85) * 8;
    bobY -= scare * 2.5;
    squashY += scare * 0.04;
    if (fatigueT > 0.2) {
      bobY += 3 * fatigueT;
      squashY *= 1 - fatigueT * 0.08;
      lean += Math.sin(now * 5) * fatigueT * 0.08;
    }
  }

  // Squash d'atterrissage (moteur) par-dessus
  if (s > 0) {
    squashY *= 1 - Math.min(0.35, s * 0.045);
    squashX *= 1 + Math.min(0.4, s * 0.055);
    bobY += s * 0.35;
  }

  ctx.save();
  drawShadow(b);

  // Traînées de vitesse (course / turbo)
  if ((moving && speed > 2) || turbo) {
    ctx.save();
    ctx.strokeStyle = turbo ? "rgba(255,220,80,0.45)" : "rgba(255,255,255,0.28)";
    ctx.lineWidth = turbo ? 2.2 : 1.4;
    ctx.lineCap = "round";
    const n = turbo ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const ly = by - 18 - i * 10 - Math.sin(now * 20 + i) * 3;
      const len = (turbo ? 28 : 14) + i * 4 + speed * 2;
      ctx.globalAlpha = 0.35 - i * 0.05;
      ctx.beginPath();
      ctx.moveTo(bx - dir * (20 + i * 6), ly);
      ctx.lineTo(bx - dir * (20 + i * 6 + len), ly + Math.sin(t + i) * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawAnchoredSprite(spr, bx, by, dir, baseH, {
    bobY, lean, squashX, squashY
  });

  // Médaille qui rebondit (motion secondaire)
  {
    const tagSwing = Math.sin(t * (moving ? 2.4 : 1.4) + now) * (moving ? 5 : 3);
    const tagY = by - baseH * squashY * 0.55 + bobY + Math.abs(tagSwing) * 0.3;
    const tagX = bx + dir * (6 + lean * 20);
    ctx.save();
    ctx.translate(tagX, tagY);
    ctx.rotate(dir * (0.2 + tagSwing * 0.04));
    ctx.fillStyle = "#f6c945";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(5, 5); ctx.lineTo(0, 10); ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Sueur / panique
  if (fatigueT > 0.06 || turbo) {
    const panic = Math.max(fatigueT, turbo ? 0.55 : 0);
    const nDrops = Math.min(10, Math.ceil(panic * 10));
    const headY = by - baseH * squashY * 0.72 + bobY;
    ctx.strokeStyle = "rgba(60,120,180,0.55)";
    ctx.lineWidth = 0.8;
    for (let d = 0; d < nDrops; d++) {
      const dropSize = 3.5 + panic * 3.5;
      const dx = bx + dir * (16 + (d % 3) * 4) * (d % 2 === 0 ? 1 : -0.7) + Math.sin(now * 8 + d) * 2;
      const dy = headY - 6 + Math.floor(d / 2) * 8 + Math.sin(now * 10 + d * 1.7) * 2.5;
      ctx.fillStyle = "rgba(140,205,255," + (0.65 + panic * 0.3).toFixed(2) + ")";
      ctx.beginPath();
      ctx.moveTo(dx, dy - dropSize);
      ctx.quadraticCurveTo(dx + dropSize * 0.7, dy + dropSize * 0.2, dx, dy + dropSize);
      ctx.quadraticCurveTo(dx - dropSize * 0.7, dy + dropSize * 0.2, dx, dy - dropSize);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Particules de poussière / snack turbo
  if (turbo) {
    ctx.fillStyle = "#ffcc44";
    for (let i = 0; i < 6; i++) {
      const a = now * 10 + i * 1.1;
      const rr = 36 + (i % 3) * 8;
      ctx.globalAlpha = 0.5 + Math.sin(a) * 0.3;
      ctx.beginPath();
      ctx.arc(bx + Math.cos(a) * rr * 0.4 - dir * 10,
              by - 40 + Math.sin(a * 1.3) * 16, 2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  return true;
}

/** Fantômes turbo Scooby : vraies silhouettes sprite en traînée. */
function drawScoobyTurboGhosts(b) {
  const spr = SPRITES.scoobyPounce;
  if (!spriteReady(spr)) return false;
  const dir = b.side === 0 ? 1 : -1;
  const moveVx = b.dispVx != null ? b.dispVx : (b.vx || 0);
  for (let i = 1; i <= 4; i++) {
    const gx = b.x - moveVx * i * 2.4;
    const gy = b.y + Math.sin(performance.now() / 80 + i) * 2;
    drawAnchoredSprite(spr, gx, gy, dir, 76 - i * 3, {
      alpha: 0.22 * (5 - i) / 5,
      squashX: 1.05,
      squashY: 0.92,
      lean: moveVx * 0.03,
      bobY: -i * 1.5
    });
  }
  return true;
}
