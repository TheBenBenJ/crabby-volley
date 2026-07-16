// crabby-volley · décors — public, astres, météo
"use strict";

// ---------- Décors ----------
function drawClouds(color) {
  ctx.fillStyle = color;
  for (const [cx, cy, sc] of [[150, 90, 1], [420, 60, 0.8], [680, 130, 0.65]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 22 * sc, 0, Math.PI * 2);
    ctx.arc(cx + 24 * sc, cy - 8 * sc, 18 * sc, 0, Math.PI * 2);
    ctx.arc(cx + 46 * sc, cy, 20 * sc, 0, Math.PI * 2);
    ctx.arc(cx + 22 * sc, cy + 8 * sc, 18 * sc, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- Tribunes animées (public) ----------
// Bande de spectateurs derrière le terrain : ola permanente + explosion de joie
// (bras/ailes/oreilles levés, bonds) quand crowdHype grimpe (point marqué,
// smash). Le public de chaque terrain est composé de l'animal qui le
// possède (ANIMALS[TERRAINS[terrain].animal]) : des manchots sur la
// banquise, des piou-piou sur la plage, etc. Purement visuel, dérivé du
// temps → rien à synchroniser en ligne.
function drawCrowd() {
  const t = performance.now() / 1000;
  const key = TERRAINS[terrain].key;
  const hell = key === "enfer" || key === "styx";
  // en enfer, le public est fait de petits diablotins — pas l'animal du
  // terrain (Chibre/Schneck), pour rester sobre à cette échelle miniature.
  const species = hell ? "demon" : ANIMALS[TERRAINS[terrain].animal].key;
  const top = GROUND_Y - 118, bot = GROUND_Y - 78;
  let stand, rail, pal, glow = false;
  if (key === "neige") {
    stand = "#aabecd"; rail = "#8299ab";
    pal = ["#e57373", "#64b5f6", "#ffffff", "#ffb74d", "#ba68c8", "#4db6ac"];
  } else if (key === "nuit") {
    stand = "#161c30"; rail = "#28304c"; glow = true; // halo de veilleuse nocturne
    pal = ["#ff8a80", "#82b1ff", "#ffd180", "#b388ff", "#a7ffeb", "#ffffff"];
  } else if (key === "prairie") {
    stand = "#8fae52"; rail = "#6b8a3a";
    pal = ["#ff6f61", "#ffd93d", "#7ed957", "#4db3ff", "#c07bff", "#ffffff"];
  } else if (hell) {
    stand = "#2a0808"; rail = "#160303"; glow = true;
    pal = ["#ff3b3b", "#ff8a3d", "#ffcf3d", "#ff5a2e", "#c62828", "#ff7a59"];
  } else {
    stand = "#b98a4b"; rail = "#8f6a38";
    pal = ["#ff6f61", "#ffd93d", "#4db3ff", "#7ed957", "#c07bff", "#ffffff"];
  }
  // gradins
  ctx.fillStyle = stand;
  ctx.fillRect(0, top, W, bot - top);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let g = 1; g < 3; g++) ctx.fillRect(0, top + (bot - top) * g / 3, W, 2);

  const hype = Math.min(1, crowdHype / 60);
  for (let row = 0; row < 3; row++) {
    const ry = top + 12 + row * 12;
    const off = row * 9;
    for (let x = 8 + off; x < W; x += 18) {
      const i = (x * 7 + row * 131) | 0;
      const col = pal[(i >> 3) % pal.length];
      const wave = Math.sin(t * 3 - x * 0.05 + row);         // ola continue
      const jit = Math.sin(t * (8 + (i % 5)) + i);
      const bounce = Math.max(0, wave) * 2.5 + hype * Math.abs(jit) * 7;
      const hy = ry - bounce;
      const excited = hype > 0.35 && jit > 0.2; // explosion de joie du moment
      drawCrowdCritter(species, x, hy, col, excited, glow);
      // certains spectateurs agitent un fanion (plus fort quand ça chauffe)
      if (i % 5 === 0) {
        const wav = Math.sin(t * (3 + hype * 7) + i);
        const stx = x + 6, sty = hy + 2, topX = stx + wav * 2, topY = hy - 11 - hype * 5;
        ctx.strokeStyle = "rgba(110,80,55,0.85)"; ctx.lineWidth = 1.2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(stx, sty); ctx.lineTo(topX, topY); ctx.stroke();
        ctx.fillStyle = pal[(i >> 5) % pal.length];
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(topX + 11, topY + 3 + wav * (1 + hype * 2.5));
        ctx.lineTo(topX + 2, topY + 8);
        ctx.closePath(); ctx.fill();
      }
    }
  }
  ctx.fillStyle = rail;
  ctx.fillRect(0, bot - 3, W, 4);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(0, bot - 3, W, 1);
}

// un spectateur, dessiné en version miniature de l'animal du terrain.
// (x, hy) = position de la tête (déjà animée : ola + bonds d'excitation).
// col = teinte d'accessoire/plumage propre à ce spectateur (variété dans la
// foule). excited = bras/ailes/oreilles levés (explosion de joie du moment).
function drawCrowdCritter(species, x, hy, col, excited, glow) {
  if (species === "manchot") {
    // corps sombre + plastron blanc + petit foulard coloré (variété) + bec orange
    ctx.fillStyle = "#20303f";
    ctx.beginPath(); ctx.ellipse(x, hy + 4, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(x, hy + 6, 2.6, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, hy - 3, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, hy, 3.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff9800";
    ctx.beginPath(); ctx.moveTo(x - 1, hy - 3); ctx.lineTo(x - 4, hy - 2); ctx.lineTo(x - 1, hy - 1); ctx.closePath(); ctx.fill();
    if (excited) { // ailerons levés
      ctx.strokeStyle = "#20303f"; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x - 4, hy + 2); ctx.lineTo(x - 8, hy - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 4, hy + 2); ctx.lineTo(x + 8, hy - 5); ctx.stroke();
    }
  } else if (species === "grenouille") {
    // corps vert (teinté), gros yeux globuleux sur le dessus
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, hy + 4, 5.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 3, hy - 3, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 3, hy - 3, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a3d28";
    ctx.beginPath(); ctx.arc(x - 3, hy - 3, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 3, hy - 3, 1.1, 0, Math.PI * 2); ctx.fill();
    if (glow) { // halo de veilleuse la nuit
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath(); ctx.arc(x, hy - 3, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (excited) { // pattes avant levées, ravies
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x - 4, hy + 3); ctx.lineTo(x - 7, hy - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 4, hy + 3); ctx.lineTo(x + 7, hy - 4); ctx.stroke();
    }
  } else if (species === "lapin") {
    // corps + tête teintés (variété de la foule), longues oreilles dressées
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, hy + 4, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, hy - 3, 3.6, 0, Math.PI * 2); ctx.fill();
    const earSpread = excited ? 0.32 : 0.16;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x + side * 2, hy - 6);
      ctx.rotate(side * earSpread);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, -6, 1.7, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } else if (species === "demon") {
    // petit diablotin : corps teinté, cornes, yeux qui brillent dans le noir
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, hy + 4, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, hy - 3, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a0a0a";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * 1.5, hy - 6);
      ctx.lineTo(x + side * 4.5, hy - 11);
      ctx.lineTo(x + side * 3, hy - 5);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,225,80,0.16)";
    ctx.beginPath(); ctx.arc(x, hy - 3, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath(); ctx.arc(x - 1.3, hy - 3, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 1.3, hy - 3, 1, 0, Math.PI * 2); ctx.fill();
    if (excited) { // petite fourche brandie
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x - 4, hy + 3); ctx.lineTo(x - 7, hy - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 4, hy + 3); ctx.lineTo(x + 7, hy - 5); ctx.stroke();
    }
  } else {
    // oiseau (piou-piou) : petit corps teinté, bec orange, ailes qui s'agitent
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, hy + 4, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, hy - 3, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff9800";
    ctx.beginPath(); ctx.moveTo(x + 3, hy - 3); ctx.lineTo(x + 7, hy - 2); ctx.lineTo(x + 3, hy - 1); ctx.closePath(); ctx.fill();
    if (excited) { // ailes levées
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x - 4, hy + 3); ctx.lineTo(x - 7, hy - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 4, hy + 3); ctx.lineTo(x + 7, hy - 4); ctx.stroke();
    }
  }
}

function drawSkyBirds() {
  const t = performance.now() / 1000;
  ctx.strokeStyle = "rgba(60,60,80,0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const x = ((t * (14 + i * 6) + i * 320) % (W + 120)) - 60;
    const y = 55 + i * 28 + Math.sin(t * 2 + i * 2) * 5;
    const w = Math.sin(t * 6 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + w);
    ctx.quadraticCurveTo(x - 4, y - 4, x, y);
    ctx.quadraticCurveTo(x + 4, y - 4, x + 8, y + w);
    ctx.stroke();
  }
}

// papillons voletant au-dessus de la prairie : trajectoire en zigzag doux,
// deux ailes qui battent en accordéon (purement décoratif).
const BUTTERFLY_COLS = ["#ff6fae", "#ffd93d", "#7ed957", "#ffffff"];
function drawButterflies() {
  const t = performance.now() / 1000;
  for (let i = 0; i < 5; i++) {
    const speed = 10 + (i % 3) * 4;
    const x = ((t * speed + i * 210) % (W + 80)) - 40;
    const y = 130 + i * 26 + Math.sin(t * 1.4 + i * 1.7) * 22;
    const flap = Math.sin(t * 14 + i * 2) * 0.5 + 0.55; // 0.05 → 1.05
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = BUTTERFLY_COLS[i % BUTTERFLY_COLS.length];
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.beginPath();
      ctx.ellipse(3, 0, 5 * flap, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

// La crabette enchaîne des figures façon meneuse de revue : elle traverse
// la plage en changeant de numéro toutes les quelques secondes (marche
// dansante, série de sauts, roulade, agitation de banderole), avec des
// pompons qui changent de couleur. Purement décoratif (Math.random / temps).
const CRAB_BANNERS = [
  "SDK LES FILES ?",
  "LA LAPINERIE N'EST JAMAIS FINIE !",
  "ICI C'EST CRABY !",
  "ATTENTION À LA MOUSSE !",
  "SEA, SEX & SUN",
  "¡ VAMOS A LA PLAYA !",
  "PINCE-MOI JE RÊVE",
  "TEAM PIOU-PIOU <3",
  "SMASHEZ-MOI ÇA !",
  "PLUS DE SEL SUR LE TERRAIN",
  "LE CRABE MARCHE DE TRAVERS, PAS LE JEU",
  "BALLE DE PLAGE, COEUR DE CHAMPION",
  "GG WP LES BLOBS",
  "404 : DÉFAITE NOT FOUND",
  "ICI ÇA DORO"
];
const POM_COLORS = [
  ["#ffd93d", "#ffe680"], ["#ff6fae", "#ffa7cf"],
  ["#7ed957", "#b6f0a0"], ["#4db3ff", "#a9dbff"], ["#c07bff", "#e0c2ff"]
];
let crabState = null; // position/état du crabe pour la banderole au premier plan

// banderole dessinée APRÈS les joueurs et la balle (donc au premier plan),
// avec un panneau blanc bordé autour du slogan.
function drawCrabBanner() {
  if (!crabState || crabState.routine !== 3) return;
  const { cx, cy, beat, t } = crabState;
  const bx = cx, by = cy - 44 + Math.sin(beat) * 3;
  const msg = CRAB_BANNERS[Math.floor(t / 20) % CRAB_BANNERS.length];

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
  const wText = ctx.measureText(msg).width;
  const padX = 8, padY = 5, wBox = wText + padX * 2, hBox = 19;

  // deux petits mâts qui relient le panneau aux pinces
  ctx.strokeStyle = "#c0006e"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - wBox / 2 + 5, by + hBox / 2); ctx.lineTo(cx - 12, cy - 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + wBox / 2 - 5, by + hBox / 2); ctx.lineTo(cx + 12, cy - 14); ctx.stroke();

  // panneau blanc bordé
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ff4da6";
  ctx.lineWidth = 2.5;
  const rx = bx - wBox / 2, ry = by - hBox / 2;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(rx, ry, wBox, hBox, 5); ctx.fill(); ctx.stroke(); }
  else { ctx.fillRect(rx, ry, wBox, hBox); ctx.strokeRect(rx, ry, wBox, hBox); }

  ctx.fillStyle = "#c0006e";
  ctx.fillText(msg, bx, by + 1);
  ctx.restore();
}
function drawCrab() {
  const t = performance.now() / 1000;
  const span = W - 160;
  // position de base : va-et-vient à vitesse douce, légèrement modulée.
  // /!\ La phase est l'INTÉGRALE de la vitesse, pas « t × vitesse » : écrire
  // (t * speedPhase(t)) % 2 faisait exploser la vitesse réelle avec le temps
  // (terme en t·speedPhase'(t)) → la crabette accélérait sans fin en cours de
  // partie. Ici la vitesse reste bornée dans [0.03, 0.05] tour/s.
  //   v(t) = 0.04 + 0.01·sin(0.23t)  →  ∫v = 0.04t − (0.01/0.23)·cos(0.23t)
  const ph = (0.04 * t - 0.0435 * Math.cos(t * 0.23) + 0.0435) % 2;
  let cx = 80 + (ph < 1 ? ph : 2 - ph) * span;
  const dirMove = ph < 1 ? 1 : -1;

  // séquenceur de figures : cycle de 20 s — marche(4)/sauts(4)/roulade(4)/banderole(8)
  const CYCLE = 20;
  const u = t % CYCLE;
  let routine, local;
  if (u < 4)       { routine = 0; local = u / 4; }
  else if (u < 8)  { routine = 1; local = (u - 4) / 4; }
  else if (u < 12) { routine = 2; local = (u - 8) / 4; }
  else             { routine = 3; local = (u - 12) / 8; } // banderole : 8 s
  let cy = H - 16, roll = 0, hop = 0, armUp = 1;

  if (routine === 0) {            // marche dansante avec petits rebonds
    hop = Math.max(0, Math.sin(t * 4)) * 5;
    cy = H - 16 - hop;
  } else if (routine === 1) {     // série de 3 sauts francs
    hop = Math.abs(Math.sin(t * 6)) * 22;
    cy = H - 16 - hop;
  } else if (routine === 2) {     // roulade : tourne sur elle-même en avançant
    roll = local * Math.PI * 4 * dirMove;
    hop = Math.sin(local * Math.PI) * 10;
    cy = H - 16 - hop;
  } else {                        // agite une banderole en sautillant
    hop = Math.max(0, Math.sin(t * 5)) * 6;
    cy = H - 16 - hop;
    armUp = 1.4;
  }

  const beatSpeed = routine === 1 ? 7 : routine === 3 ? 6 : 4.5;
  const beat = t * beatSpeed;
  const pom = POM_COLORS[Math.floor(t / 2) % POM_COLORS.length];

  // mémorise l'état pour dessiner la banderole au premier plan (voir drawCrabBanner)
  crabState = { cx, cy, roll, beat, routine, t };

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll);

  // rubans qui flottent derrière les pinces (figures 0 et 2)
  if (routine === 0 || routine === 2) {
    for (const side of [-1, 1]) {
      ctx.strokeStyle = side < 0 ? "#ffd93d" : "#ff6fae";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const bxr = side * 16, byr = -8;
      ctx.moveTo(bxr, byr);
      for (let k = 1; k <= 6; k++) {
        ctx.lineTo(bxr + side * k * 3, byr + k * 2 + Math.sin(beat + k) * 3);
      }
      ctx.stroke();
    }
  }

  // pattes qui gigotent
  ctx.strokeStyle = "#a04000";
  ctx.lineWidth = 2;
  for (const lx of [-10, -5, 5, 10]) {
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx * 1.6, 6 + Math.sin(beat + lx) * 2);
    ctx.stroke();
  }

  // corps (carapace bombée avec reflet et liseré)
  ctx.fillStyle = "#d35400";
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(122,38,0,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath(); ctx.ellipse(-4, -3, 5, 2.5, -0.3, 0, Math.PI * 2); ctx.fill();

  // bras/pinces avec pompons agités
  const armL = -0.9 * armUp - Math.sin(beat) * 0.5;
  const armR = -0.9 * armUp + Math.sin(beat) * 0.5;
  for (const [side, ang] of [[-1, armL], [1, armR]]) {
    const sx = side * 12, sy = -4;
    const ex = sx + side * 15 * Math.cos(ang), ey = sy + 15 * Math.sin(ang);
    ctx.strokeStyle = "#d35400";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = pom[0];
    for (let k = 0; k < 8; k++) {
      const a2 = k / 8 * Math.PI * 2 + beat;
      ctx.beginPath();
      ctx.arc(ex + Math.cos(a2) * 4, ey + Math.sin(a2) * 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = pom[1];
    ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
  }

  // yeux pédonculés
  ctx.strokeStyle = "#d35400";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-5, -12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(5, -12); ctx.stroke();
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(-5, -13, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -13, 2, 0, Math.PI * 2); ctx.fill();

  // grand sourire
  ctx.strokeStyle = "#7a2600";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, -2, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.restore();

  // banderole dessinée juste après le crabe (même plan) : les mâts sont
  // désormais reliés au corps, plus de panneau flottant dans le vide.
  drawCrabBanner();
}

// ---------- Course du soleil / de la lune ----------
// L'astre décrit lentement un arc d'est en ouest. La position dérive du
// temps réel (effet purement visuel, aucune incidence sur la simulation),
// avec un cycle volontairement long pour rester discret pendant une partie.
const SKY_CYCLE = 240; // secondes pour traverser le ciel
function celestialPos() {
  const t = (performance.now() / 1000) % SKY_CYCLE;
  const p = t / SKY_CYCLE;               // 0 → 1 sur toute la traversée
  const x = 60 + p * (W - 120);          // gauche → droite
  const y = 150 - Math.sin(p * Math.PI) * 95; // arc : haut au milieu
  return { x, y, p };
}

// ---------- Météo (plage) ----------
// État météo déterministe : dérivé du RNG seedé et rangé dans les snapshots,
// pour que l'hôte et l'invité voient exactement le même ciel en ligne.
// "clear" → "rain" (sable humide) ; si le soleil perce → arc-en-ciel ;
// si la pluie s'intensifie → ciel sombre (orage).
let weather = "clear";        // "clear" | "rain" | "storm"
let weatherTimer = 0;         // ticks avant le prochain changement (0 = jamais planifié)
let rainDrops = [];           // gouttes (visuel, régénéré localement)
let sandGrains = [];          // grains soufflés (plage, visuel, régénéré localement)
let fogPuffs = [];            // bancs de brume (marais, visuel, régénéré localement)

function resetWeather() {
  weather = "clear";
  weatherTimer = 600 + Math.floor(rng() * 1200); // ~10-30 s avant 1er changement
  rainDrops = [];
  sandGrains = [];
  fogPuffs = [];
}

// avancé une fois par tick DANS la simulation (déterministe).
// Même machine à états sur les 4 terrains ; seul l'habillage change :
//  plage → tempête de sable · banquise → chute de neige/blizzard
//  marais nocturne → brume qui se lève · prairie → averse/orage
function stepWeather() {
  if (--weatherTimer > 0) return;
  const r = rng();
  if (weather === "clear") {
    weather = "rain";
    weatherTimer = 480 + Math.floor(rng() * 720);
  } else if (weather === "rain") {
    // soit ça se dégage, soit l'orage éclate
    weather = r < 0.5 ? "clear" : "storm";
    weatherTimer = 360 + Math.floor(rng() * 720);
  } else { // storm
    weather = "rain";
    weatherTimer = 360 + Math.floor(rng() * 600);
  }
}

// true si le soleil est (au moins partiellement) visible → arc-en-ciel possible
function sunVisible() { return weather === "clear" || weather === "rain"; }

const MOLT_MAX = 8; // coups avant que l'oiseau soit totalement déplumé

// adhérence du sol : 1 (sec) → 0.8 (intempérie) → 0.6 (déchaînée). Tous terrains.
// Sur la banquise, la neige rend déjà le sol un peu glissant même au "sec".
function groundGrip() {
  const icy = TERRAINS[terrain].key === "neige" ? 0.92 : 1;
  if (weather === "storm") return 0.6 * (icy < 1 ? 0.9 : 1);
  if (weather === "rain") return 0.8 * icy;
  return icy;
}
// facteur appliqué à la gravité/rebond de la balle : plus lourd = monte moins haut
function ballLift() {
  if (weather === "storm") return 1.4;
  if (weather === "rain") return 1.2;
  return 1;
}

function drawRain(intensity) {
  // gouttes purement visuelles : densité selon l'intensité
  const target = Math.floor(intensity * 140);
  while (rainDrops.length < target) {
    rainDrops.push({ x: Math.random() * (W + 60) - 30, y: Math.random() * GROUND_Y,
                     len: 8 + Math.random() * 10, sp: 9 + Math.random() * 6 });
  }
  if (rainDrops.length > target) rainDrops.length = target;
  ctx.strokeStyle = weather === "storm" ? "rgba(150,170,200,0.5)" : "rgba(180,200,230,0.45)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  const wind = 2.2;
  for (const d of rainDrops) {
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - wind, d.y + d.len);
    ctx.stroke();
    d.y += d.sp; d.x -= wind * 0.4;
    if (d.y > GROUND_Y) { d.y = -d.len; d.x = Math.random() * (W + 60) - 30; }
  }
}

// tempête de sable (plage) : grains soufflés quasi à l'horizontale + voile ocre
function drawSandstorm(intensity) {
  const target = Math.floor(intensity * 150);
  while (sandGrains.length < target) {
    sandGrains.push({ x: Math.random() * (W + 80) - 40, y: Math.random() * GROUND_Y,
                     len: 10 + Math.random() * 16, sp: 10 + Math.random() * 8 });
  }
  if (sandGrains.length > target) sandGrains.length = target;
  ctx.fillStyle = "rgba(196,156,84," + (0.1 + intensity * 0.14).toFixed(2) + ")";
  ctx.fillRect(0, 0, W, GROUND_Y);
  ctx.strokeStyle = weather === "storm" ? "rgba(150,112,58,0.55)" : "rgba(180,145,90,0.45)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (const g of sandGrains) {
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x - g.len, g.y + g.len * 0.28);
    ctx.stroke();
    g.x -= g.sp; g.y += g.sp * 0.22;
    if (g.x < -40) { g.x = W + 40; g.y = Math.random() * GROUND_Y; }
  }
}

// brume qui se lève (marais) : bancs translucides dérivant lentement du sol
function drawFog(intensity) {
  const target = Math.floor(intensity * 9) + 3;
  while (fogPuffs.length < target) {
    fogPuffs.push({ x: Math.random() * (W + 200) - 100, y: GROUND_Y - Math.random() * 90,
                    r: 40 + Math.random() * 50, sp: 0.2 + Math.random() * 0.35, rise: 0.06 + Math.random() * 0.08 });
  }
  if (fogPuffs.length > target) fogPuffs.length = target;
  for (const f of fogPuffs) {
    ctx.fillStyle = "rgba(220,228,224," + (0.06 + intensity * 0.08).toFixed(2) + ")";
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    f.x += f.sp; f.y -= f.rise;
    if (f.x > W + 100) f.x = -100;
    if (f.y < GROUND_Y - 130) { f.y = GROUND_Y - 10 + Math.random() * 10; f.x = Math.random() * (W + 200) - 100; }
  }
  ctx.fillStyle = "rgba(200,212,208," + (0.05 + intensity * 0.07).toFixed(2) + ")";
  ctx.fillRect(0, GROUND_Y - 90, W, 90);
}

function drawRainbow() {
  const cx = W / 2, cy = GROUND_Y + 40, rOut = 340;
  const cols = ["#ff5b5b", "#ffa23e", "#ffe14d", "#5bd97a", "#4db3ff", "#8a6bff"];
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 9;
  for (let i = 0; i < cols.length; i++) {
    ctx.strokeStyle = cols[i];
    ctx.beginPath();
    ctx.arc(cx, cy, rOut - i * 9, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}


// ---------- Terrains ----------
function drawBackground() {
  const key = TERRAINS[terrain].key;
  if (key === "plage") drawBgPlage();
  else if (key === "neige") drawBgNeige();
  else if (key === "nuit") drawBgNuit();
  else if (key === "prairie") drawBgPrairie();
  else if (key === "enfer") drawBgEnfer();
  else drawBgStyx();
}

