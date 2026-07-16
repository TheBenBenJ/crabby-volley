// crabby-volley · état & données — terrains, animaux, classe Blob, combos/supers
"use strict";

// ---------- Terrains et animaux ----------
// chaque terrain appartient à un animal (voir ANIMALS plus bas) : son public
// des tribunes est composé de cet animal, et le nom du terrain lui rend hommage.
const TERRAINS = [
  { key: "plage",   name: "La Zone de Piou-Piou",     animal: 0 },
  { key: "neige",   name: "Le QG du Général Frigo",   animal: 2 },
  { key: "nuit",    name: "La Mare à Slurp",          animal: 1 },
  { key: "prairie", name: "Le Ter-Ter de Jeannot",    animal: 3 },
  { key: "manoir",  name: "Le Manoir Hanté",          animal: 6 }, // Scooby
  { key: "enfer",   name: "La Fournaise à Chibre",    animal: 4, hidden: true },
  { key: "styx",    name: "Le Marigot de Schneck",    animal: 5, hidden: true }
];
let terrain = 0;

const ANIMALS = [
  // stats affichées sur 5 (Vitesse/Détente/Puissance/Contrôle) + multiplicateurs moteur.
  // speed : vitesse au sol · jump : force de saut · power : force de frappe
  // control : 1 = parfait, <1 = déviation aléatoire à la frappe
  // beak : possède un bec (risque de crevaison) · slip : inertie/dérapage au sol
  // stick : langue collante (grosse déviation)
  // molt : se déplume au fil des touches (8 coups), à nu d'un coup si le point est perdu
  // tired : se fatigue au fil des touches (oreilles qui tombent, sueur) — purement visuel
  // angry : de plus en plus furieux au fil des touches, au max d'un coup si le point est perdu
  // crazy : de plus en plus folle au fil des touches, au max d'un coup si le point est perdu
  {
    key: "oiseau", name: "Piou-Piou",
    color: "#f4c531", darkColor: "#d69e18",   // canari jaune
    stats: { vitesse: 4, detente: 4, puissance: 2, controle: 3 },
    speed: 1.12, jump: 1.12, power: 0.82, control: 0.9,
    beak: true, molt: true,
    trait: "Bec fragile : peut crever la balle. Se déplume à la perte du point.",
    superName: "Piqué éclair", superDesc: "Bond fulgurant : la frappe suivante est un smash aérien."
  },
  {
    key: "grenouille", name: "Madame Slurp",
    color: "#6fbf4b", darkColor: "#4e9331",   // grenouille verte
    stats: { vitesse: 2, detente: 5, puissance: 3, controle: 1 },
    speed: 0.9, jump: 1.32, power: 1.0, control: 0.62,
    stick: true, crazy: true,
    trait: "Détente énorme, langue collante, et devient dingue au fil des coups.",
    superName: "Langue-grappin", superDesc: "La langue va chercher une balle trop loin et la renvoie."
  },
  {
    key: "manchot", name: "Général Frigo",
    color: "#5a6b78", darkColor: "#2b3742",   // manchot ardoise (plastron blanc)
    stats: { vitesse: 2, detente: 2, puissance: 5, controle: 4 },
    speed: 0.82, jump: 0.82, power: 1.28, control: 0.97,
    beak: true, angry: true,
    trait: "Frappe très puissante et précise. Lent. Bec (crevaison rare).",
    superName: "Canon des glaces", superDesc: "La frappe suivante devient un boulet de canon plongeant."
  },
  {
    key: "lapin", name: "Turbo-Jeannot",
    color: "#c4c9d1", darkColor: "#9aa1ab",   // lapin gris
    stats: { vitesse: 5, detente: 3, puissance: 2, controle: 3 },
    speed: 1.3, jump: 1.0, power: 0.85, control: 0.9,
    slip: true, tired: true,
    trait: "Ultra-rapide, mais dérape à l'arrêt : placement difficile.",
    superName: "Turbo-bond", superDesc: "Vitesse décuplée et sauts illimités pendant un instant."
  },
  {
    key: "chibre", name: "Monsieur Chibre", hidden: true,
    color: "#e7b28d", darkColor: "#cd8f68",   // teinte chair
    stats: { vitesse: 3, detente: 5, puissance: 5, controle: 1 },
    speed: 0.95, jump: 1.3, power: 1.2, control: 0.58,
    trait: "Ressort sur pattes : saute haut et cogne fort, mais part dans tous les sens.",
    superName: "Coup de boutoir", superDesc: "Se raidit : la frappe suivante part comme un boulet rasant."
  },
  {
    key: "chneck", name: "Madame Schneck", hidden: true,
    color: "#e7a48c", darkColor: "#b76a62",   // teinte chair rosée
    stats: { vitesse: 4, detente: 3, puissance: 2, controle: 5 },
    speed: 1.12, jump: 1.05, power: 0.85, control: 0.98,
    trait: "Chatte agile et précise : contrôle parfait, mais frappe tout en finesse.",
    superName: "Retombée de chat", superDesc: "Défie la gravité : sauts illimités et vol plané un court instant."
  },
  {
    key: "scooby", name: "Scooby",
    color: "#c4a35a", darkColor: "#8b6914",   // brun scooby
    stats: { vitesse: 4, detente: 4, puissance: 2, controle: 2 },
    speed: 1.18, jump: 1.15, power: 0.88, control: 0.72,
    slip: true, tired: true,
    trait: "Lâche et goofy : dérape à l'arrêt, mais panique très vite.",
    superName: "Scooby Snack", superDesc: "Peur bleue : vitesse décuplée et sauts illimités un instant."
  },
  {
    key: "samy", name: "Sammy",
    color: "#6b8f3c", darkColor: "#4a6a28",   // vert t-shirt Sammy
    stats: { vitesse: 5, detente: 3, puissance: 2, controle: 2 },
    speed: 1.25, jump: 1.05, power: 0.85, control: 0.7,
    slip: true, tired: true,
    trait: "Grand échalas nerveux : rapide, glisse, et panique encore plus vite.",
    superName: "Zoinks !", superDesc: "Peur bleue : vitesse décuplée et sauts illimités un instant."
  }
];
function animOf(b) { return ANIMALS[b.animal]; }

// ---------- Mode Belzébuth ----------
// Activé/désactivé en tapant "666" au clavier sur l'écran d'accueil ou de
// sélection des personnages (voir la détection dans handleMenuKeys,
// 12-menus.js). Bascule EXCLUSIVE : en mode normal, seuls les animaux/
// terrains "normaux" sont proposés ; en mode Belzébuth, seuls les
// "hidden" (trash/infernaux) le sont — jamais les deux à la fois.
let darkMode = false;
let darkSeq = "";
// états où "666" ne doit PAS être intercepté : saisie de code de partie et
// pleine partie (chiffres sans usage ici) ; MAIS AUSSI la sélection perso/
// terrain — là, les chiffres ont déjà un sens (choisir un slot), et basculer
// le mode EN PLEIN CHOIX invaliderait silencieusement la sélection en cours
// (setDarkMode() la remplace alors par un choix aléatoire, sans le dire).
const MENU_LIKE_EXCLUDED = new Set(["joinEntry", "play", "serve", "point", "gameover", "selectAnimal", "selectTerrain"]);
function visibleAnimalIdx() {
  const idx = [];
  for (let i = 0; i < ANIMALS.length; i++) if (!!ANIMALS[i].hidden === darkMode) idx.push(i);
  return idx;
}
function visibleTerrainIdx() {
  const idx = [];
  for (let i = 0; i < TERRAINS.length; i++) if (!!TERRAINS[i].hidden === darkMode) idx.push(i);
  return idx;
}
function randomAnimalIdx() {
  // choix de menu, hors simulation : Math.random() (pas le rng seedé du jeu)
  const idx = visibleAnimalIdx();
  return idx[Math.floor(Math.random() * idx.length)];
}
// bascule le mode Belzébuth ET rattrape aussitôt tout ce qui serait
// incohérent avec le nouveau mode : le fond animé des menus (terrain +
// personnages affichés derrière l'écran courant) doit montrer un vrai
// visuel du mode qu'on vient d'activer, pas rester sur l'ancien.
function setDarkMode(on) {
  darkMode = on;
  if (visibleTerrainIdx().indexOf(terrain) === -1) terrain = visibleTerrainIdx()[0];
  if (visibleAnimalIdx().indexOf(blobL.animal) === -1) blobL.animal = randomAnimalIdx();
  if (visibleAnimalIdx().indexOf(blobR.animal) === -1) blobR.animal = randomAnimalIdx();
}
// valide un indice d'animal reçu du réseau : dans les bornes, et cohérent
// avec le mode (normal/Belzébuth) actif chez l'hôte.
function clampVisibleAnimal(v) {
  const i = Math.max(0, Math.min(ANIMALS.length - 1, v | 0));
  return (!!ANIMALS[i].hidden === darkMode) ? i : visibleAnimalIdx()[0];
}

// ---------- Identité des camps ----------
// Les couleurs d'équipe rouge/verte ont disparu : chaque animal a sa couleur
// naturelle. Un camp est désormais identifié par sa position (Gauche/Droite)
// et affiché avec la couleur de l'animal qui y joue.
function sideName(side) { return side === 0 ? "Gauche" : "Droite"; }
// nom affiché PENDANT le jeu (HUD, service, points…) : le nom de l'animal en
// 1v1 — bien plus parlant qu'un générique "Gauche"/"Droite" quand un
// personnage précis représente ce camp — ou le nom d'équipe en 2v2 (pas un
// seul personnage). sideName() reste "Gauche"/"Droite" pour l'écran de
// sélection, où l'animal n'est justement pas encore choisi pour ce joueur.
function sideLabel(side) {
  if (mode === "2v2") return side === 0 ? "Équipe 1" : "Équipe 2";
  const b = side === 0 ? blobL : blobR;
  return ANIMALS[b.animal].name;
}
function sideColor(side) {
  const b = side === 0 ? blobL : blobR;
  const a = ANIMALS[b.animal];
  return (a && a.color) || (side === 0 ? "#e8913b" : "#4db3ff");
}

// ---------- État du jeu ----------
// state: "menu" | "aiDifficulty" | "gameModeSelect"
//        | "selectAnimal" | "selectTerrain" | "serve" | "play" | "point" | "gameover"
//        | états du mode en ligne : "onlineMenu" | "joinEntry" | "hostWait"
//          | "connecting" | "netWait" | "netError"
// Flux du menu : menu → (Solo IA : aiDifficulty → gameModeSelect) | (Local : gameModeSelect direct)
//                     → selectAnimal → selectTerrain → partie
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
  // aim : 1 = place ses frappes LOIN de l'adversaire (drive profond / amorti court)
  // tous les réglages progressent de façon monotone d'un niveau à l'autre
  // (chacun au moins aussi élevé que le précédent) — un niveau plus dur qui
  // recule sur un critère se lit comme un oubli, pas comme un choix.
  { name: "Facile",      speedMul: 0.82, err: 40, jumpDist: 100, rush: 0.25, attack: 8,  react: 0.55, dbl: false, aim: 0 },
  { name: "Normale",     speedMul: 1.0,  err: 15, jumpDist: 118, rush: 0.5,  attack: 15, react: 0.8,  dbl: true,  aim: 0 },
  { name: "Difficile",   speedMul: 1.22, err: 3,  jumpDist: 138, rush: 0.85, attack: 24, react: 1.0,  dbl: true,  aim: 1 },
  { name: "Impitoyable", speedMul: 1.5,  err: 0,  jumpDist: 160, rush: 0.9,  attack: 28, react: 1.0,  dbl: true,  aim: 1 }
];
let aiLevel = 1;
let aiErr = 0, aiErrTimer = 0;  // erreur de placement volontaire de l'IA
let aiRush = false;             // envie du moment : provoquer un duel au filet

const X_LEVEL = { name: "X", speedMul: 1.2, err: 0, jumpDist: 999, rush: 1, attack: 30, react: 1, dbl: true, aim: 1 };
const xOn = [false, false, false, false];

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
//   Monsieur Chibre → "Coup de boutoir" : la frappe suivante part en boulet rasant
//   Madame Schneck → "Retombée de chat" : sauts illimités + vol plané (gravité réduite)
//   Scooby → "Scooby Snack" : panique turbo (comme le lapin) pendant ~1,5 s
//   Sammy → "Zoinks !" : panique turbo (comme Scooby) pendant ~1,5 s
const SUPER_NEED = 3;
const streak = [0, 0];        // points d'affilée par camp
const superCharge = [0, 0];   // 0 = vide, 1 = super prête
const SUPER_DUR = { oiseau: 40, grenouille: 24, manchot: 60, lapin: 100, chibre: 55, chneck: 110, scooby: 90, samy: 90 };
let superFlash = "";          // libellé "SUPER !" affiché brièvement
let superFlashT = 0;

const FATIGUE_MAX = 8; // coups avant que le lapin soit visiblement épuisé
const ANGER_MAX = 8;    // coups avant que le manchot soit au comble de la fureur
const CRAZY_MAX = 8;    // coups avant que la grenouille soit complètement folle

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
    this.fatigue = 0;     // fatigue du lapin (oreilles/sueur) : 0 → FATIGUE_MAX
    this.anger = 0;       // fureur du manchot (rougeurs, vapeur) : 0 → ANGER_MAX
    this.crazy = 0;       // folie de la grenouille (yeux, langue, tics) : 0 → CRAZY_MAX
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
    const turbo = (a.key === "lapin" || a.key === "scooby" || a.key === "samy") && this.superT > 0;
    const cat = a.key === "chneck" && this.superT > 0;  // Retombée de chat : vol plané
    this.vx = 0;
    const sp = BLOB_SPEED * this.speedMul * a.speed * grip * (turbo ? 1.7 : 1);
    if (input.left)  this.vx = -sp;
    if (input.right) this.vx =  sp;

    // dérapage du lapin : la vitesse affichée rattrape la consigne avec
    // inertie — facteur volontairement bas : encore moins stable, il glisse
    // longtemps avant de suivre une consigne de vitesse/arrêt.
    if (a.slip) {
      this.dispVx += (this.vx - this.dispVx) * 0.07;
      if (Math.abs(this.dispVx) < 0.05) this.dispVx = 0;
    } else {
      this.dispVx = this.vx;
    }
    const moveVx = a.slip ? this.dispVx : this.vx;

    if (this.onGround && moveVx !== 0) {
      // le lapin pédale frénétiquement en permanence dès qu'il court (pas
      // seulement quand la vitesse réelle est en retard sur la consigne) :
      // c'est sa signature, Turbo-Jeannot ne trottine jamais tranquillement.
      // Scooby / Sammy : encore plus paniqués (galop cartoon + poussière).
      const scrambling = a.slip;
      const gangPanic = a.key === "scooby" || a.key === "samy";
      this.scramble = scrambling ? 1 : 0;
      // Sammy : avance un peu plus vite la phase pour un cycle de marche lisible
      const phaseStep = a.key === "samy" ? 1.35 : (gangPanic ? 1.15 : 0.9);
      this.walkPhase += scrambling ? phaseStep : 0.3;
      if (Math.random() < (scrambling ? (gangPanic ? 0.48 : 0.35) : 0.1)) {
        spawnSand(this.x - Math.sign(this.vx || moveVx) * 12, GROUND_Y, gangPanic ? 2 : 1);
      }
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
    } else if (jumpPressed && !this.onGround && (turbo || cat || this.jumpsUsed < 2)) {
      // double saut (ou sauts illimités pendant Turbo-bond / Retombée de chat)
      this.vy = BLOB_JUMP * a.jump * (turbo ? 0.8 : cat ? 0.7 : DOUBLE_JUMP_MUL);
      if (!turbo && !cat) this.jumpsUsed = 2;
      spawnAirPuff(this.x, this.y - 6);
      beep(turbo ? 500 : cat ? 620 : 330, 0.07, "sine", 0.09, 0, turbo ? 760 : cat ? 900 : 520);
    }
    // vol plané de la chatte : gravité fortement réduite tant que le super dure
    if (!this.onGround) this.vy += GRAV_BLOB * (cat ? 0.55 : 1);

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
let bombTime = BOMB_TIME;         // durée de mèche choisie (ticks) : 5/7/10 s
// options du menu « Durée de la bombe » (300/420/600 ticks à 60 Hz)
const BOMB_DURATIONS = [
  { secs: 5,  ticks: 300 },
  { secs: 7,  ticks: 420 },
  { secs: 10, ticks: 600 }
];

// Soft ownership 1v1 : l'invité différé awardPoint → l'hôte valide (anti-divergence).
let netDeferScore = false;
let pendingNetPoint = null;       // { side, reason, seq } | null
let ballScoreLock = false;        // invité : point armé → physique balle figée
let netPtSeq = 0;                 // séquence monotone des points différés

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

