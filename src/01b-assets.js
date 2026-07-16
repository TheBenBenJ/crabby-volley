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

/** Choisit le sprite Scooby selon l'état du blob (sol / course / saut). */
function scoobySpriteFor(b) {
  if (!b.onGround || (b.superT > 0 && b.superKind === "scooby")) {
    return SPRITES.scoobyPounce;
  }
  if (Math.abs(b.vx || 0) > 0.4) return SPRITES.scoobyRun;
  // Aperçu sélection : face caméra ; en jeu : profil (run)
  if (typeof state === "string" && state.indexOf("select") === 0) {
    return SPRITES.scoobyIdle;
  }
  return SPRITES.scoobyRun;
}

/**
 * Dessine un sprite ancré aux pieds (by = sol du blob), centré en bx.
 * Les sources regardent vers la droite ; dir=-1 miroite.
 */
function drawAnchoredSprite(img, bx, by, dir, drawH, bobY) {
  if (!spriteReady(img)) return false;
  const aspect = img.naturalWidth / img.naturalHeight;
  const drawW = drawH * aspect;
  const y = by + (bobY || 0);
  ctx.save();
  ctx.translate(bx, y);
  ctx.scale(dir < 0 ? -1 : 1, 1);
  ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
  return true;
}
