// crabby-volley · cœur — constantes, canvas Hi-DPI, RNG déterministe
"use strict";

// ---------- Constantes ----------
const W = 900, H = 500;
const GROUND_Y = H - 40;
const NET_X = W / 2;
const NET_W = 10;
const NET_TOP = GROUND_Y - 190;

const GRAV_BALL = 0.22;
const GRAV_BLOB = 0.65;
const BLOB_SPEED = 5.2;
const BLOB_JUMP = -13.5;
const DOUBLE_JUMP_MUL = 0.65; // 2e saut nettement plus faible (pas trop haut !)
const BALL_R = 14;
const HIT_SPEED = 10.5;
const MAX_BALL_SPEED = 15;
const WIN_SCORE = 15;
const MAX_TOUCHES = 3;
const STEP = 1000 / 60; // tick fixe 60 Hz (indispensable pour le futur mode en ligne)
const TOUCH_COOLDOWN = 12;   // ticks mini entre deux touches comptées (anti double-comptage)

// --- Écran "Point pour ..." ---
// On reste dessus jusqu'à ce qu'un joueur appuie (saut/confirmation) — mieux
// qu'un délai fixe qu'on peut rater. POINT_MIN_WAIT : affichage minimum avant
// de considérer une pression (évite de sauter le message instantanément si
// une touche de saut était encore enfoncée juste après avoir marqué le point).
// POINT_MAX_WAIT : filet de sécurité si personne n'appuie (IA seule en solo,
// AFK…) — la partie ne reste jamais bloquée indéfiniment.
const POINT_MIN_WAIT = 20;  // ~0,33 s
const POINT_MAX_WAIT = 240; // ~4 s

// --- Smash Battle (duel au filet) ---
const BATTLE_TICKS = 78;     // durée du duel (~1,3 s)
const BATTLE_COOLDOWN = 240; // délai mini entre deux duels (4 s)
const BATTLE_NET_DIST = 95;  // distance max des joueurs au filet pour déclencher
const BATTLE_BALL_DIST = 90; // distance max de la balle au filet
const SMASH_VX = 14, SMASH_VY = 12; // vitesse du smash destructeur

// --- Mode Bombe ---
const BOMB_TIME = 600;      // 10 s à 60 Hz : durée de la mèche avant explosion

// --- Ownership balle (1v1 en ligne) ---
// Zone morte autour du filet : on ne change pas de propriétaire tant que la
// balle rebondit sur le poteau (évite le flip-flop owner 0↔1).
const BALL_OWN_MARGIN = 14;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------- Haute résolution (Hi-DPI + adaptation à la fenêtre) ----------
// Le jeu raisonne toujours en 900×500 unités "logiques" ; le canvas est rendu
// à la taille d'affichage × devicePixelRatio → tracé net sur écran Retina/4K,
// et le jeu remplit la fenêtre en gardant son ratio.
let viewScale = 1;
function resizeCanvas() {
  if (typeof window.innerWidth !== "number") return; // environnement de test
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
  const cssW = Math.max(320, Math.floor(W * fit)), cssH = Math.floor(cssW * H / W);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  viewScale = canvas.width / W;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ---------- RNG seedé (mulberry32) ----------
// La logique de JEU utilise rng() : avec la même graine, deux machines
// calculent exactement la même partie (base du mode en ligne).
// Les effets purement visuels/sonores gardent Math.random().
let rngSeed = 1;
function setSeed(s) { rngSeed = s | 0; }
function rng() {
  rngSeed = (rngSeed + 0x6D2B79F5) | 0;
  let t = rngSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

