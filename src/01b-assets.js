// crabby-volley · sprites (images PNG) — chargement asynchrone, fallback canvas
"use strict";

const SPRITES = {
  scoobyIdle: null,      // face (menu)
  scoobyIdleSide: null,  // profil au repos
  scoobyRun: null,       // pose marche héro (fallback)
  scoobyPounce: null,    // saut / turbo
  scoobyWalk: [],        // cycle de marche 8 frames
  samyIdle: null,
  samyIdleSide: null,
  samyRun: null,
  samyPounce: null,
  samyPanic: null,
  samyWalk: [],
  mysteryVan: null,
  manoirBg: null,        // fond plat Le Manoir Hanté
  manoirBgSharp: null,   // version accentuée (unsharp mask) — anti-flou upscale
};

function loadSprite(path) {
  const img = new Image();
  img.src = path;
  return img;
}

function spriteReady(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

// ---------- Accentuation (unsharp mask) ----------
// Un PNG de fond ~1000 px affiché à ~2000 px (rétina) est mou : aucun rendu ne
// « recrée » du détail absent. On atténue toutefois la mollesse perçue par un
// masque flou : sharp = orig + amount·(orig − flou). Fait UNE fois au chargement
// sur un canvas hors-écran, dont on se sert ensuite comme source de drawImage.

// box blur séparable (référence de flou pour l'unsharp) — O(n), rayon r
function boxBlurRGB(data, w, h, r) {
  const tmp = new Float32Array(data.length);
  const out = new Float32Array(data.length);
  const win = r * 2 + 1;
  const clamp = (v, hi) => (v < 0 ? 0 : v > hi ? hi : v);
  for (let y = 0; y < h; y++) {
    for (let k = 0; k < 3; k++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += data[(y * w + clamp(x, w - 1)) * 4 + k];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + k] = sum / win;
        sum += data[(y * w + clamp(x + r + 1, w - 1)) * 4 + k]
             - data[(y * w + clamp(x - r, w - 1)) * 4 + k];
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let k = 0; k < 3; k++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[(clamp(y, h - 1) * w + x) * 4 + k];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + k] = sum / win;
        sum += tmp[(clamp(y + r + 1, h - 1) * w + x) * 4 + k]
             - tmp[(clamp(y - r, h - 1) * w + x) * 4 + k];
      }
    }
  }
  return out;
}

function sharpenToCanvas(img, amount, radius) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d");
  c.drawImage(img, 0, 0);
  let src;
  try { src = c.getImageData(0, 0, w, h); } catch (e) { return cv; } // repli : image brute
  const a = src.data;
  const blur = boxBlurRGB(a, w, h, radius);
  for (let i = 0; i < a.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const v = a[i + k] + amount * (a[i + k] - blur[i + k]);
      a[i + k] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  c.putImageData(src, 0, 0);
  return cv;
}

// prépare (async) la version accentuée d'un fond ; sans effet en test headless
// (Image stubée : ni addEventListener ni pixels) ou si le canvas est absent.
function prepareSharpBg(img, dstKey, amount, radius) {
  if (!img || typeof document === "undefined" || !document.createElement) return;
  const build = () => {
    if (spriteReady(img)) SPRITES[dstKey] = sharpenToCanvas(img, amount, radius);
  };
  if (img.complete && img.naturalWidth > 0) build();
  else if (typeof img.addEventListener === "function") img.addEventListener("load", build, { once: true });
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
  SPRITES.manoirBg = loadSprite("assets/manoir/bg.png");
  prepareSharpBg(SPRITES.manoirBg, "manoirBgSharp", 0.7, 2); // accentuation légère anti-flou
  SPRITES.scoobyWalk = [];
  for (let i = 0; i < 8; i++) {
    SPRITES.scoobyWalk.push(loadSprite(base + "walk" + i + ".png"));
  }
  const samy = "assets/samy/";
  SPRITES.samyIdle = loadSprite(samy + "idle.png");
  SPRITES.samyIdleSide = loadSprite(samy + "idle_side.png");
  SPRITES.samyRun = loadSprite(samy + "run.png");
  SPRITES.samyPounce = loadSprite(samy + "pounce.png");
  SPRITES.samyPanic = loadSprite(samy + "panic.png");
  SPRITES.samyWalk = [];
  for (let i = 0; i < 8; i++) {
    SPRITES.samyWalk.push(loadSprite(samy + "walk" + i + ".png"));
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
  // Downscale → lissage OK ; évite le flou "bouillie" sur gros upscales
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
  // L'idle profil est plus « droit / rempli » que les poses de marche (plus
  // allongées) : à même hauteur de canvas il paraît plus gros. On compense.
  const walkSpr = isScoobyWalkSprite(spr);
  let baseH = 82;
  if (walkSpr) baseH = 84;
  else if (spr === SPRITES.scoobyIdleSide || spr === SPRITES.scoobyRun) baseH = 70;
  else if (spr === SPRITES.scoobyPounce) baseH = 78;
  else if (spr === SPRITES.scoobyIdle) baseH = 72; // menu face
  baseH -= fatigueT * 5;

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

function samyWalkReady() {
  const w = SPRITES.samyWalk;
  return w.length > 0 && w.every(spriteReady);
}

function samyWalkFrame(b) {
  const frames = SPRITES.samyWalk;
  if (!samyWalkReady()) {
    return spriteReady(SPRITES.samyRun) ? SPRITES.samyRun : null;
  }
  // Cycle lisible et calme, même cadence que Scooby (0.18) : transitions douces
  // contact → passage (jambes jointes) → contact. Trop rapide (0.32) = saccadé.
  const idx = Math.floor(Math.abs(b.walkPhase || 0) * 0.18) % frames.length;
  return frames[idx];
}

function samySpriteFor(b) {
  const turbo = b.superT > 0 && b.superKind === "samy";
  const moveVx = (b.dispVx != null && Math.abs(b.dispVx) > 0.01) ? b.dispVx : (b.vx || 0);
  const moving = Math.abs(moveVx) > 0.35 || !!b.scramble;

  if (turbo && spriteReady(SPRITES.samyPanic)) return SPRITES.samyPanic;
  if (!b.onGround) {
    return spriteReady(SPRITES.samyPounce) ? SPRITES.samyPounce : samyWalkFrame(b);
  }
  if (typeof state === "string" && state.indexOf("select") === 0 && !moving) {
    return spriteReady(SPRITES.samyIdle) ? SPRITES.samyIdle : SPRITES.samyIdleSide;
  }
  // Toujours le cycle de marche au sol (ne pas figer sur "run")
  if (moving) return samyWalkFrame(b);
  if (spriteReady(SPRITES.samyIdleSide)) return SPRITES.samyIdleSide;
  return samyWalkFrame(b) || SPRITES.samyRun;
}

function isSamyWalkSprite(img) {
  const w = SPRITES.samyWalk;
  for (let i = 0; i < w.length; i++) if (w[i] === img) return true;
  return false;
}

function drawSamySpriteMaster(b) {
  const spr = samySpriteFor(b);
  if (!spriteReady(spr)) return false;

  const s = Math.max(0, b.squash || 0);
  const bx = b.x, by = b.y;
  const dir = b.side === 0 ? 1 : -1;
  const fatigueT = (b.fatigue || 0) / FATIGUE_MAX;
  const turbo = b.superT > 0 && b.superKind === "samy";
  const moveVx = (b.dispVx != null && Math.abs(b.dispVx) > 0.01) ? b.dispVx : (b.vx || 0);
  const moving = Math.abs(moveVx) > 0.35 || !!b.scramble;
  const now = performance.now() / 1000;

  let bobY = 0, lean = 0, squashX = 1, squashY = 1;
  const walkSpr = isSamyWalkSprite(spr);
  // Sammy plus grand que Scooby (~84) : échalas lisible, sprites assez nets pour zoomer
  let baseH = 112;
  if (walkSpr) baseH = 116;
  else if (spr === SPRITES.samyIdleSide) baseH = 112;
  else if (spr === SPRITES.samyRun) baseH = 114;
  else if (spr === SPRITES.samyPounce || spr === SPRITES.samyPanic) baseH = 118;
  else if (spr === SPRITES.samyIdle) baseH = 110;
  // Fatigue : légèrement plus tassé, sans couper la tête
  if (fatigueT > 0.55 && !moving && b.onGround && !turbo) {
    baseH -= 4;
  }

  if (!b.onGround || turbo) {
    const stretch = 1 + Math.max(-0.04, Math.min(0.08, -(b.vy || 0) * 0.008));
    squashY = stretch;
    squashX = 1 / Math.sqrt(stretch);
    // lean discret : trop fort + sprite haut → tête hors cadre / coupée visuellement
    lean = Math.max(-0.12, Math.min(0.12, moveVx * 0.015));
    if (turbo) bobY = Math.sin(now * 20) * 1.2;
  } else if (moving) {
    const phase = Math.abs(b.walkPhase || 0) * 0.18; // synchro avec samyWalkFrame
    bobY = Math.sin(phase * Math.PI) * 1.6;
    lean = Math.max(-0.08, Math.min(0.08, moveVx * 0.01));
  } else {
    bobY = Math.sin(now * 2.6) * 0.8;
    squashY = 1 + Math.sin(now * 2.6) * 0.01;
    squashX = 1 / squashY;
  }
  if (s > 0) {
    squashY *= 1 - Math.min(0.14, s * 0.025);
    squashX *= 1 + Math.min(0.16, s * 0.03);
  }

  ctx.save();
  drawShadow(b);
  drawAnchoredSprite(spr, bx, by, dir, baseH, { bobY, lean, squashX, squashY });
  if (fatigueT > 0.1) {
    const nDrops = Math.min(6, Math.ceil(fatigueT * 7));
    const headY = by - baseH * 0.72 + bobY;
    for (let d = 0; d < nDrops; d++) {
      const dropSize = 3.2 + fatigueT * 2.2;
      const dx = bx + dir * (10 + (d % 3) * 3) * (d % 2 === 0 ? 1 : -0.8);
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

function drawSamyTurboGhosts(b) {
  const spr = spriteReady(SPRITES.samyPanic) ? SPRITES.samyPanic
    : (spriteReady(SPRITES.samyRun) ? SPRITES.samyRun
      : (samyWalkReady() ? SPRITES.samyWalk[0] : null));
  if (!spriteReady(spr)) return false;
  const dir = b.side === 0 ? 1 : -1;
  const moveVx = b.dispVx != null ? b.dispVx : (b.vx || 0);
  for (let i = 1; i <= 3; i++) {
    drawAnchoredSprite(spr, b.x - moveVx * i * 2.4, b.y, dir, 112 - i * 2, {
      alpha: 0.18 * (4 - i) / 3,
      lean: moveVx * 0.025
    });
  }
  return true;
}
