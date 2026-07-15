// crabby-volley · état & données — terrains, animaux, classe Blob, combos/supers
"use strict";

// ---------- Terrains et animaux ----------
const TERRAINS = [
  { key: "plage", name: "Plage" },
  { key: "neige", name: "Banquise" },
  { key: "nuit",  name: "Nuit étoilée" }
];
let terrain = 0;

const ANIMALS = [
  // stats affichées sur 5 (Vitesse/Détente/Puissance/Contrôle) + multiplicateurs moteur.
  // speed : vitesse au sol · jump : force de saut · power : force de frappe
  // control : 1 = parfait, <1 = déviation aléatoire à la frappe
  // beak : possède un bec (risque de crevaison) · slip : inertie/dérapage au sol
  // stick : langue collante (grosse déviation) · molt : se déplume au fil des coups
  {
    key: "oiseau", name: "Piou-Piou",
    stats: { vitesse: 4, detente: 4, puissance: 2, controle: 3 },
    speed: 1.12, jump: 1.12, power: 0.82, control: 0.9,
    beak: true, molt: true,
    trait: "Bec fragile : peut crever la balle. Se déplume au fil des coups.",
    superName: "Piqué éclair", superDesc: "Bond fulgurant : la frappe suivante est un smash aérien."
  },
  {
    key: "grenouille", name: "Madame Slurp",
    stats: { vitesse: 2, detente: 5, puissance: 3, controle: 1 },
    speed: 0.9, jump: 1.32, power: 1.0, control: 0.62,
    stick: true,
    trait: "Détente énorme, mais langue collante : la balle repart de travers.",
    superName: "Langue-grappin", superDesc: "La langue va chercher une balle trop loin et la renvoie."
  },
  {
    key: "manchot", name: "Général Frigo",
    stats: { vitesse: 2, detente: 2, puissance: 5, controle: 4 },
    speed: 0.82, jump: 0.82, power: 1.28, control: 0.97,
    beak: true,
    trait: "Frappe très puissante et précise. Lent. Bec (crevaison rare).",
    superName: "Canon des glaces", superDesc: "La frappe suivante devient un boulet de canon plongeant."
  },
  {
    key: "lapin", name: "Turbo-Jeannot",
    stats: { vitesse: 5, detente: 3, puissance: 2, controle: 3 },
    speed: 1.3, jump: 1.0, power: 0.85, control: 0.9,
    slip: true,
    trait: "Ultra-rapide, mais dérape à l'arrêt : placement difficile.",
    superName: "Turbo-bond", superDesc: "Vitesse décuplée et sauts illimités pendant un instant."
  }
];
function animOf(b) { return ANIMALS[b.animal]; }

// ---------- État du jeu ----------
// state: "menu" | "selectAnimal" | "selectTerrain" | "serve" | "play" | "point" | "gameover"
//        | états du mode en ligne : "onlineMenu" | "joinEntry" | "hostWait"
//          | "connecting" | "netWait" | "netError"
let state = "menu";
let vsAI = true;
let pointTimer = 0;
let serveCountdown = 0;   // décompte avant service (ticks)
let pointMsg = "";
let paused = false;
let shake = 0;                 // intensité du tremblement d'écran
let muted = false;
let noFx = false;             // coupe sons/particules (re-simulations réseau)
const scorePop = [0, 0];       // animation du score qui grossit
const particles = [];          // plumes et sable
// --- éléments purement visuels (hors simulation, non synchronisés) ---
let crowdHype = 0;             // ferveur du public (pic sur point/smash), décroît
let prevCrowdHype = 0;         // détection du front montant → ola sonore
const emotes = [null, null];   // bulle d'émotion au-dessus de chaque joueur

let pendingMode = null;        // mode choisi au menu, en attente des sélections
let selPlayer = 0;             // quel joueur choisit son animal

const AI_LEVELS = [
  // rush : propension à foncer au filet pour provoquer un Smash Battle
  // attack : décalage derrière la balle pour viser franchement le camp adverse
  // react : anticipation (0=lent, 1=parfait) · dbl : utilise le double saut
  { name: "Facile",    speedMul: 0.82, err: 40, jumpDist: 100, rush: 0.25, attack: 8,  react: 0.55, dbl: false },
  { name: "Normale",   speedMul: 1.0,  err: 15, jumpDist: 118, rush: 0.5,  attack: 15, react: 0.8,  dbl: true },
  { name: "Difficile", speedMul: 1.22, err: 3,  jumpDist: 138, rush: 0.9,  attack: 24, react: 1.0,  dbl: true }
];
let aiLevel = 1;
let aiErr = 0, aiErrTimer = 0;  // erreur de placement volontaire de l'IA
let aiRush = false;             // envie du moment : provoquer un duel au filet

const scores = [0, 0]; // [gauche, droite]
let servingSide = 0;   // 0 = gauche, 1 = droite
let tick = 0;          // compteur de ticks de simulation (jamais l'horloge murale !)

// ---------- Smash Battle ----------
// Quand les deux joueurs sautent au filet en même temps avec la balle proche,
// le temps se fige : duel de martelage (touche SAUT). Le plus rapide déclenche
// un smash destructeur. Entièrement simulé dans stepGame à partir des entrées :
// déterministe, donc synchronisé tel quel en ligne.
const battle = {
  active: false, t: 0, count: [0, 0],
  prevJump: [false, false], cooldown: 0
};

// ---------- Combos & techniques signature ----------
// Chaque camp charge un SUPER en gagnant SUPER_NEED points d'affilée. Une fois
// prêt, la touche SUPER déclenche la technique de l'animal en jeu :
//   Piou-Piou  → "Piqué éclair" : bond fulgurant, la frappe suivante est un smash aérien
//   Madame Slurp → "Langue-grappin" : la langue va chercher la balle trop loin et la renvoie
//   Général Frigo → "Canon des glaces" : la frappe suivante est un boulet de canon glacé
//   Turbo-Jeannot → "Turbo-bond" : vitesse décuplée + sauts illimités pendant ~1,6 s
const SUPER_NEED = 3;
const streak = [0, 0];        // points d'affilée par camp
const superCharge = [0, 0];   // 0 = vide, 1 = super prête
const SUPER_DUR = { oiseau: 40, grenouille: 24, manchot: 60, lapin: 100 };
let superFlash = "";          // libellé "SUPER !" affiché brièvement
let superFlashT = 0;

class Blob {
  constructor(side, color, darkColor) {
    this.side = side;               // 0 gauche, 1 droite
    this.color = color;
    this.darkColor = darkColor;
    this.homeX = side === 0 ? W * 0.25 : W * 0.75;
    this.speedMul = 1;
    this.animal = 0;
    this.reset();
  }
  reset() {
    this.x = this.homeX;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.dispVx = 0;      // vitesse lissée (inertie/dérapage du lapin)
    this.onGround = true;
    this.squash = 0; // animation d'écrasement
    this.walkPhase = 0;
    this.scramble = 0;    // lapin qui patine (jambes agitées)
    this.tongueOut = false; // grenouille : langue sortie après un coup collant
    this.molt = 0;        // plumes perdues par l'oiseau : 0 → MOLT_MAX
    this.hasBall = false; // balle crevée plantée sur le bec
    this.jumpsUsed = 0;   // 0 au sol, 1 après le saut, 2 après le double saut
    this.prevJump = false; // détection du front montant (double saut)
    this.superT = 0;       // ticks restants de la technique active
    this.superKind = "";   // animal dont la technique est en cours
    this.superSmash = false; // prochaine frappe = smash (oiseau/manchot)
    this.prevSuper = false;  // front montant de la touche SUPER
    this.tongueT = 0;        // animation de la langue-grappin
    this.tongueTX = 0; this.tongueTY = 0; // cible atteinte par la langue
  }
  // deux cercles de collision : corps + tête (alignés sur le dessin)
  get bodyCircle() { return { x: this.x, y: this.y - 30, r: 28 }; }
  get headCircle() { return { x: this.x, y: this.y - 64, r: 22 }; }

  update(input) {
    const a = animOf(this);
    // si une balle crevée est plantée sur le bec, l'animal est tétanisé
    // (il ne peut plus bouger ni sauter jusqu'à l'attribution du point)
    if (this.hasBall) { this.vx = 0; if (!this.onGround) this.vy += GRAV_BLOB; this.y += this.vy; if (this.y >= GROUND_Y) { this.y = GROUND_Y; this.vy = 0; this.onGround = true; } return; }

    const grip = groundGrip(); // 1 par temps sec, <1 sur sol détrempé
    const turbo = a.key === "lapin" && this.superT > 0; // Turbo-bond
    this.vx = 0;
    const sp = BLOB_SPEED * this.speedMul * a.speed * grip * (turbo ? 1.7 : 1);
    if (input.left)  this.vx = -sp;
    if (input.right) this.vx =  sp;

    // dérapage du lapin : la vitesse affichée rattrape la consigne avec inertie
    if (a.slip) {
      this.dispVx += (this.vx - this.dispVx) * 0.16;
      if (Math.abs(this.dispVx) < 0.05) this.dispVx = 0;
    } else {
      this.dispVx = this.vx;
    }
    const moveVx = a.slip ? this.dispVx : this.vx;

    if (this.onGround && moveVx !== 0) {
      // le lapin patine : quand il pousse mais que la vitesse réelle est en
      // retard sur la consigne, il pédale frénétiquement (jambes excitées)
      const scrambling = a.slip && input.left !== input.right &&
                         Math.abs(this.dispVx) < Math.abs(this.vx) * 0.85;
      this.scramble = scrambling ? 1 : 0;
      this.walkPhase += scrambling ? 0.9 : 0.3;
      if (Math.random() < (scrambling ? 0.35 : 0.1)) spawnSand(this.x - Math.sign(this.vx) * 12, GROUND_Y, 1);
    } else {
      this.scramble = 0;
    }
    const jumpPressed = input.jump && !this.prevJump; // front montant
    this.prevJump = !!input.jump;
    if (input.jump && this.onGround) {
      this.vy = BLOB_JUMP * a.jump * (0.85 + grip * 0.15); // saut un peu plus mou si détrempé
      this.onGround = false;
      this.jumpsUsed = 1;
      beep(220, 0.05, "sine", 0.06);
    } else if (jumpPressed && !this.onGround && (turbo || this.jumpsUsed < 2)) {
      // double saut (ou sauts illimités pendant le Turbo-bond du lapin)
      this.vy = BLOB_JUMP * a.jump * (turbo ? 0.8 : DOUBLE_JUMP_MUL);
      if (!turbo) this.jumpsUsed = 2;
      spawnAirPuff(this.x, this.y - 6);
      beep(turbo ? 500 : 330, 0.07, "sine", 0.09, 0, turbo ? 760 : 520);
    }
    if (!this.onGround) this.vy += GRAV_BLOB;

    this.x += moveVx;
    this.y += this.vy;

    // limites : chaque joueur reste de son côté du filet
    const half = 34;
    const minX = this.side === 0 ? half : NET_X + NET_W / 2 + half - 6;
    const maxX = this.side === 0 ? NET_X - NET_W / 2 - half + 6 : W - half;
    if (this.x <= minX || this.x >= maxX) this.dispVx = 0; // stoppe le dérapage au mur
    this.x = Math.max(minX, Math.min(maxX, this.x));

    if (this.y >= GROUND_Y) {
      if (!this.onGround) {
        this.squash = 6;
        spawnSand(this.x, GROUND_Y, 6);
      }
      this.y = GROUND_Y;
      this.vy = 0;
      this.onGround = true;
      this.jumpsUsed = 0; // le double saut se recharge au sol
    }
    if (this.squash > 0) this.squash -= 0.5;
  }

  draw() { drawAnimal(this); }
}

const blobL = new Blob(0, "#e84545", "#b32e2e");
const blobR = new Blob(1, "#4caf50", "#357a38");
// coéquipiers du mode 2v2 (deuxième joueur de chaque camp)
const blob2L = new Blob(0, "#ff8a3d", "#d1651e"); // équipe gauche, orange
const blob2R = new Blob(1, "#3d8bff", "#245fd1"); // équipe droite, bleu

// ---------- Mode de jeu (1v1 / 2v2) ----------
// activeBlobs = la liste des joueurs réellement en piste. En 1v1 c'est
// [blobL, blobR] → tout le code existant (online/solo) reste identique.
// En 2v2 on ajoute les deux coéquipiers ; ils partagent leur demi-terrain et
// se TRAVERSENT (aucune collision entre coéquipiers, demandé par le joueur).
let mode = "1v1";                 // "1v1" | "2v2"
let activeBlobs = [blobL, blobR];

// ---------- Mode Bombe (variante 1v1) ----------
// La balle devient une bombe : elle explose au bout de BOMB_TIME ticks OU si
// elle touche le sol. Dans les deux cas, le camp où se trouve la bombe perd le
// point. bombTimer est décompté en TICKS (déterministe → compatible en ligne).
let bombMode = false;             // règle « patate chaude » activée ?
let bombTimer = 0;                // ticks restants avant explosion
let bombFlash = 0;                // éclair d'explosion plein écran (visuel, 1→0)
function setMode(m) {
  mode = m;
  if (m === "2v2") {
    activeBlobs = [blobL, blob2L, blobR, blob2R]; // 0,1 = équipe gauche ; 2,3 = droite
    blobL.homeX  = W * 0.14; blob2L.homeX = W * 0.37; // avant / arrière à gauche
    blobR.homeX  = W * 0.86; blob2R.homeX = W * 0.63; // avant / arrière à droite
  } else {
    activeBlobs = [blobL, blobR];
    blobL.homeX = W * 0.25; blobR.homeX = W * 0.75;
  }
}

