// crabby-volley · sprites (images PNG) — chargement asynchrone, fallback canvas
"use strict";

const SPRITES = {
  scoobyIdle: null,      // face (menu)
  scoobyIdleSide: null,  // profil au repos
  scoobyRun: null,       // pose marche héro (fallback)
  scoobyPounce: null,    // saut / turbo
  scoobyWalk: [],        // cycle de marche 8 frames
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

function scoobyWalkReady() {
  const w = SPRITES.scoobyWalk;
  return w.length > 0 && w.every(spriteReady);
}

function initSprites() {
  const base = "assets/scooby/";
  SPRITES.scoobyIdle = loadSprite(base + "idle.png");
  SPRITES.scoobyIdleSide = loadSprite(base + "idle_side.png");
  SPRITES.scoobyRun = loadSprite(base + "run.png");
  SPRITES.scoobyPounce = loadSprite(base + "pounce.png");
  SPRITES.mysteryVan = loadSprite(base + "van.png");
  SPRITES.scoobyWalk = [];
  for (let i = 0; i < 8; i++) {
    SPRITES.scoobyWalk.push(loadSprite(base + "walk" + i + ".png"));
  }
}

initSprites();

/** Frame de marche selon walkPhase (cycle propre, pas de morphing). */
function scoobyWalkFrame(b) {
  const frames = SPRITES.scoobyWalk;
  if (!scoobyWalkReady()) {
    return spriteReady(SPRITES.scoobyRun) ? SPRITES.scoobyRun : null;
  }
  // ~10–12 fps : walkPhase += ~1.0/tick → une frame toutes les ~5 ticks
  const idx = Math.floor(Math.abs(b.walkPhase || 0) * 0.18) % frames.length;
  return frames[idx];
}

function scoobySpriteFor(b) {
  const turbo = b.superT > 0 && b.superKind === "scooby";
  const moveVx = (b.dispVx != null && Math.abs(b.dispVx) > 0.01) ? b.dispVx : (b.vx || 0);
  const moving = Math.abs(moveVx) > 0.35 || !!b.scramble;

  if (!b.onGround || turbo) {
    return spriteReady(SPRITES.scoobyPounce) ? SPRITES.scoobyPounce : scoobyWalkFrame(b);
  }

  // Menu sélection : face
  if (typeof state === "string" && state.indexOf("select") === 0 && !moving) {
    return spriteReady(SPRITES.scoobyIdle) ? SPRITES.scoobyIdle : SPRITES.scoobyIdleSide;
  }

  if (moving) return scoobyWalkFrame(b);

  // Idle jeu : profil stable
  if (spriteReady(SPRITES.scoobyIdleSide)) return SPRITES.scoobyIdleSide;
  return scoobyWalkFrame(b) || SPRITES.scoobyRun;
}

/** True si l'image fait partie du cycle de marche. */
function isScoobyWalkSprite(img) {
  const w = SPRITES.scoobyWalk;
  for (let i = 0; i < w.length; i++) if (w[i] === img) return true;
  return false;
}

/**
 * Dessine un sprite ancré aux pieds. Sources face à droite ; dir=-1 miroite.
 * opts: bobY, lean (rad), squashX/Y, alpha
 */
function drawAnchoredSprite(img, bx, by, dir, drawH, opts) {
  if (!spriteReady(img)) return false;
  opts = opts || {};
  const aspect = img.naturalWidth / img.naturalHeight;
  const drawW = drawH * aspect;
  const bobY = opts.bobY || 0;
  const lean = opts.lean || 0;
  const squashX = opts.squashX != null ? opts.squashX : 1;
  const squashY = opts.squashY != null ? opts.squashY : 1;
  const alpha = opts.alpha != null ? opts.alpha : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  // évite le halo flou au rescale (surtout sur les outlines)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(bx, by + bobY);
  if (lean) ctx.rotate(lean * (dir < 0 ? -1 : 1));
  ctx.scale((dir < 0 ? -1 : 1) * squashX, squashY);
  ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
  return true;
}

/**
 * Rendu Scooby propre : le cycle de marche fait le travail.
 * Anim légère seulement (bob / squash atterrissage), sans morphing agressif.
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
  const moving = Math.abs(moveVx) > 0.35 || !!b.scramble;
  const now = performance.now() / 1000;

  let bobY = 0;
  let lean = 0;
  let squashX = 1;
  let squashY = 1;
  // Même hauteur de base pour idle / marche / saut (PNG normalisés).
  // Les frames walk sont un peu plus « accroupies » : +8 % pour matcher l'idle.
  const walkSpr = isScoobyWalkSprite(spr);
  const baseH = (walkSpr ? 84 : 78) - fatigueT * 5;

  if (!b.onGround || turbo) {
    // léger stretch air / turbo (discret)
    const stretch = 1 + Math.max(-0.06, Math.min(0.12, -(b.vy || 0) * 0.01));
    squashY = stretch;
    squashX = 1 / Math.sqrt(stretch);
    lean = Math.max(-0.25, Math.min(0.25, moveVx * 0.03));
    if (turbo) bobY = Math.sin(now * 18) * 1.5;
  } else if (moving) {
    // Micro-bob synchro avec la frame (lisibilité, pas de déformation)
    const phase = Math.abs(b.walkPhase || 0) * 0.18;
    bobY = Math.sin(phase * Math.PI) * 1.2;
    lean = moveVx * 0.015;
  } else {
    // Respiration idle très douce
    bobY = Math.sin(now * 2.8) * 0.9;
    squashY = 1 + Math.sin(now * 2.8) * 0.015;
    squashX = 1 / squashY;
  }

  // Squash atterrissage moteur uniquement
  if (s > 0) {
    squashY *= 1 - Math.min(0.22, s * 0.035);
    squashX *= 1 + Math.min(0.25, s * 0.04);
  }

  ctx.save();
  drawShadow(b);
  drawAnchoredSprite(spr, bx, by, dir, baseH, { bobY, lean, squashX, squashY });

  // Sueur fatigue (discret)
  if (fatigueT > 0.1) {
    const nDrops = Math.min(6, Math.ceil(fatigueT * 7));
    const headY = by - baseH * 0.7 + bobY;
    for (let d = 0; d < nDrops; d++) {
      const dropSize = 3.5 + fatigueT * 2.5;
      const dx = bx + dir * (14 + (d % 3) * 3) * (d % 2 === 0 ? 1 : -0.8);
      const dy = headY + Math.floor(d / 2) * 7 + Math.sin(now * 9 + d) * 1.5;
      ctx.fillStyle = "rgba(140,205,255," + (0.6 + fatigueT * 0.25).toFixed(2) + ")";
      ctx.beginPath();
      ctx.moveTo(dx, dy - dropSize);
      ctx.quadraticCurveTo(dx + dropSize * 0.6, dy, dx, dy + dropSize);
      ctx.quadraticCurveTo(dx - dropSize * 0.6, dy, dx, dy - dropSize);
      ctx.fill();
    }
  }
  ctx.restore();
  return true;
}

/** Fantômes turbo : silhouettes du cycle / pounce. */
function drawScoobyTurboGhosts(b) {
  const spr = spriteReady(SPRITES.scoobyPounce) ? SPRITES.scoobyPounce
    : (scoobyWalkReady() ? SPRITES.scoobyWalk[0] : null);
  if (!spriteReady(spr)) return false;
  const dir = b.side === 0 ? 1 : -1;
  const moveVx = b.dispVx != null ? b.dispVx : (b.vx || 0);
  for (let i = 1; i <= 3; i++) {
    drawAnchoredSprite(spr, b.x - moveVx * i * 2.2, b.y, dir, 74 - i * 2, {
      alpha: 0.18 * (4 - i) / 3,
      lean: moveVx * 0.02
    });
  }
  return true;
}
