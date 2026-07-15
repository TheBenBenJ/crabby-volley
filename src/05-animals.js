// crabby-volley · rendu des animaux & expressions faciales
"use strict";

// ---------- Dessin des animaux ----------
// Chaque fonction reçoit un objet "b" (Blob réel ou aperçu du menu) avec :
// x, y, side, color, darkColor, onGround, vx, walkPhase, squash, animal
// et éventuellement groundY (pour les aperçus hors du sol de jeu).

function drawAnimal(b) {
  const A = ANIMALS[b.animal];
  // couleurs NATURELLES du personnage (fini les équipes rouge/verte). On les
  // applique au blob au moment du dessin : purement visuel, hors simulation.
  if (A.color) { b.color = A.color; b.darkColor = A.darkColor; }
  const key = A.key;
  drawSuperAura(b);                         // halo derrière l'animal
  // pendant le Turbo-bond du lapin : traînée d'images fantômes
  if (b.superT > 0 && key === "lapin") drawTurboGhosts(b, key);
  if (key === "oiseau") drawOiseau(b);
  else if (key === "grenouille") drawGrenouille(b);
  else if (key === "manchot") drawManchot(b);
  else if (key === "chibre") drawChibre(b);
  else if (key === "chneck") drawChneck(b);
  else drawLapin(b);
  drawSuperOverlay(b, key);                 // langue-grappin, charge de smash…
  drawEmote(b);                             // bulle d'émotion
}

// n'affiche les effets de super que pour les vrais joueurs (pas les aperçus menu)
function isLiveBlob(b) { return b === blobL || b === blobR; }

// ---------- Expressions faciales ----------
// Humeur PUREMENT visuelle, dérivée d'états déjà connus (émote récente en cours,
// super chargée/active, saut) : aucune donnée nouvelle → rien à synchroniser,
// l'invité affiche la même chose (il reçoit émotes/super via les événements).
function faceMood(b) {
  // chaque animal a une expression de caractère FIXE, en permanence :
  // le lapin a toujours l'air d'une victime (comme quand il perd le point),
  // le manchot a toujours l'air fâché (comme quand il frappe la balle),
  // l'oiseau est perpétuellement sur le qui-vive (son bec fragile peut
  // crever à tout instant), la grenouille reste une diva décontractée
  // (sa détente énorme la rend toujours sûre d'elle).
  const key = animOf(b).key;
  if (key === "lapin") return "sad";
  if (key === "manchot") return "fierce";
  if (key === "oiseau") return "shock";
  if (key === "grenouille") return "happy";
  const side = b === blobL ? 0 : b === blobR ? 1 : -1;
  if (side >= 0) {
    const e = emotes[side];
    if (e && e.t > 0) {
      if (e.kind === "happy") return "happy";
      if (e.kind === "sad") return "sad";
      if (e.kind === "wow") return "shock";
    }
    if (b.superT > 0 || superCharge[side] === 1) return "fierce";
  }
  if (!b.onGround) return "focus";
  return "idle";
}

// deux sourcils au-dessus des yeux ; leur inclinaison porte l'émotion.
// (ex1, ex2) = centres des yeux, eyeY = leur ordonnée, r = rayon de l'œil.
function drawBrows(ex1, ex2, eyeY, r, mood) {
  const cx = (ex1 + ex2) / 2;
  let inner, outer, lift;
  // mood peut être un objet {inner,outer,lift} calculé dynamiquement (ex.
  // fureur croissante du manchot) au lieu d'un des préréglages ci-dessous.
  if (mood && typeof mood === "object") {
    ({ inner, outer, lift } = mood);
  } else switch (mood) {
    case "fierce": inner = 4;  outer = -3; lift = 0;  break; // froncés (déterminé)
    case "focus":  inner = 3;  outer = -1; lift = 1;  break; // concentré
    case "happy":  inner = -3; outer = -4; lift = -3; break; // haussés, joyeux
    case "sad":    inner = -4; outer = 3;  lift = -1; break; // peinés (intérieurs hauts)
    case "shock":  inner = -5; outer = -5; lift = -6; break; // très haussés
    default:       inner = -1; outer = -1; lift = -2;        // repos, à peine levés
  }
  ctx.save();
  ctx.strokeStyle = "rgba(35,28,22,0.82)";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  for (const ex of [ex1, ex2]) {
    const toCenter = ex <= cx ? 1 : -1;         // sens « vers l'intérieur du visage »
    const y0 = eyeY - r - 1 + lift;
    ctx.beginPath();
    ctx.moveTo(ex + toCenter * r * 0.55, y0 + inner); // extrémité interne
    ctx.lineTo(ex - toCenter * r * 0.75, y0 + outer); // extrémité externe
    ctx.stroke();
  }
  ctx.restore();
}

// bouche : ouverture (px) & courbure (+ sourire / − moue) selon l'humeur.
function mouthParams(mood) {
  switch (mood) {
    case "happy":  return { open: 3,   curve: 5 };
    case "sad":    return { open: 2,   curve: -5 };
    case "shock":  return { open: 8,   curve: 0 };
    case "fierce": return { open: 4,   curve: -2 };
    case "focus":  return { open: 5,   curve: 0 };
    default:       return { open: 1.5, curve: 1 };
  }
}
// facteur d'ouverture du bec (0 = fermé, 1 = grand ouvert) pour l'effort/le cri.
function mouthOpen(b) {
  switch (faceMood(b)) {
    case "shock":  return 1;
    case "focus":  return 0.7;
    case "fierce": return 0.5;
    default:       return 0;
  }
}

// bulle d'émotion au-dessus de la tête (réaction aux points/smash)
function drawEmote(b) {
  const side = b === blobL ? 0 : b === blobR ? 1 : -1;
  if (side < 0) return;
  const e = emotes[side];
  if (!e || e.t <= 0) return;
  const prog = 1 - e.t / 55;
  const ex = b.x, ey = b.y - 94 - prog * 14;
  ctx.save();
  ctx.globalAlpha = Math.min(1, e.t / 12);
  ctx.textAlign = "center";
  if (e.kind === "happy") {
    ctx.fillStyle = "#ffd93d";
    ctx.save(); ctx.translate(ex - 11, ey + 2); ctx.rotate(prog); drawStarShape(5); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(ex + 11, ey - 3); ctx.rotate(-prog); drawStarShape(4); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(ex, ey - 8); drawStarShape(6); ctx.fill(); ctx.restore();
  } else if (e.kind === "sad") {
    ctx.fillStyle = "#5db3ff";
    ctx.beginPath();
    ctx.moveTo(ex, ey - 7);
    ctx.quadraticCurveTo(ex + 6, ey + 2, ex, ey + 8);
    ctx.quadraticCurveTo(ex - 6, ey + 2, ex, ey - 7);
    ctx.fill();
  } else if (e.kind === "wow") {
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#e84545"; ctx.lineWidth = 4; ctx.lineJoin = "round";
    ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
    ctx.strokeText("!", ex, ey + 10); ctx.fillText("!", ex, ey + 10);
  }
  ctx.restore();
}

function drawSuperAura(b) {
  if (!isLiveBlob(b)) return;
  const t = performance.now() / 1000;
  if (b.superT > 0) {
    // super ACTIVE : gros halo coloré palpitant
    const pulse = 0.6 + Math.sin(t * 18) * 0.25;
    ctx.save();
    ctx.globalAlpha = pulse;
    const g = ctx.createRadialGradient(b.x, b.y - 40, 6, b.x, b.y - 40, 62);
    g.addColorStop(0, "rgba(255,240,150,0.9)");
    g.addColorStop(1, "rgba(255,200,60,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y - 40, 62, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (superCharge[b.side] === 1) {
    // super PRÊTE : anneau doré tournoyant + étoiles orbitales
    ctx.save();
    ctx.globalAlpha = 0.75 + Math.sin(t * 6) * 0.25;
    ctx.strokeStyle = "#ffd93d";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y - 38, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff4b0";
    for (let i = 0; i < 3; i++) {
      const a = t * 2.4 + i * (Math.PI * 2 / 3);
      ctx.save();
      ctx.translate(b.x + Math.cos(a) * 44, b.y - 38 + Math.sin(a) * 44);
      drawStarShape(5); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawTurboGhosts(b, key) {
  ctx.save();
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = 0.12 * (4 - i);
    const gx = b.x - b.vx * i * 2.2;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.ellipse(gx, b.y - 30, 26, 24, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSuperOverlay(b, key) {
  if (!isLiveBlob(b)) return;
  const dir = b.side === 0 ? 1 : -1;
  // Langue-grappin : la langue file vers la cible attrapée
  if (key === "grenouille" && b.tongueT > 0) {
    const mx = b.x + dir * 8, my = b.y - 46;
    ctx.save();
    ctx.strokeStyle = "#ff4d7e";
    ctx.lineCap = "round";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo((mx + b.tongueTX) / 2, my - 20, b.tongueTX, b.tongueTY);
    ctx.stroke();
    ctx.fillStyle = "#ff7ba3";
    ctx.beginPath(); ctx.arc(b.tongueTX, b.tongueTY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Smash armé (oiseau/manchot) : électricité autour du corps
  if (b.superSmash && b.superT > 0) {
    const t = performance.now() / 1000;
    ctx.save();
    ctx.strokeStyle = key === "manchot" ? "#7fe0ff" : "#fff27a";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 5; i++) {
      const a = t * 9 + i * 1.3;
      const r1 = 30, r2 = 40 + Math.sin(t * 20 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(a) * r1, b.y - 36 + Math.sin(a) * r1);
      ctx.lineTo(b.x + Math.cos(a + 0.3) * r2, b.y - 36 + Math.sin(a + 0.3) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function groundOf(b) { return b.groundY !== undefined ? b.groundY : GROUND_Y; }

// liseré cartoon : trace le contour du chemin courant (après un fill)
function outline(alpha = 0.18) {
  ctx.strokeStyle = "rgba(0,0,0," + alpha + ")";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawShadow(b) {
  // ombre douce (dégradé radial) qui rétrécit et pâlit quand l'animal saute
  const gy = groundOf(b);
  const air = Math.max(0, Math.min(1, (gy - b.y) / 200)); // 0 au sol → 1 en l'air
  const rx = 34 - air * 14, ry = 8 - air * 3;
  const alpha = 0.28 * (1 - air * 0.6);
  const g = ctx.createRadialGradient(b.x, gy + 6, 1, b.x, gy + 6, rx);
  g.addColorStop(0, "rgba(0,0,0," + alpha.toFixed(3) + ")");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(b.x, gy + 6, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// œil blanc dont la pupille suit la balle.
// (gx,gy) optionnel : origine commune du regard → les deux yeux pointent
// PARALLÈLEMENT (fini le strabisme quand la balle est proche entre les yeux).
// redTint (0..1) optionnel : injecte du rouge dans le blanc de l'œil (colère
// croissante du manchot), appliqué avant la pupille pour ne pas la recouvrir.
function drawTrackingEye(ex, ey, r, pr, gx, gy, redTint) {
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
  if (redTint) {
    ctx.fillStyle = "rgba(220,25,20," + Math.min(0.7, redTint * 0.6).toFixed(2) + ")";
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
  }
  const ox = gx !== undefined ? gx : ex, oy = gy !== undefined ? gy : ey;
  const dx = ball.x - ox, dy = ball.y - oy;
  const d = Math.hypot(dx, dy) || 1;
  const amp = r - pr - 0.5;
  const px = ex + dx / d * amp, py = ey + dy / d * amp;
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  // petit reflet pour donner du relief
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(px - pr * 0.35, py - pr * 0.35, Math.max(0.6, pr * 0.35), 0, Math.PI * 2);
  ctx.fill();
}

// pattes fines animées (oiseau, lapin) — renvoie les positions des pieds
// Liseré sombre systématique sous les pattes/pieds : sans lui, des pattes
// claires (blanches sur le lapin) se fondent presque totalement dans un
// terrain clair (neige de la banquise notamment).
function drawLegs(b, dir, s, legColor, footStyle) {
  ctx.lineCap = "round";
  for (let i = 0; i < 2; i++) {
    const hipX = b.x + (i === 0 ? -9 : 9);
    const hipY = b.y - 16 + s;
    let footX, footY;
    if (!b.onGround) {
      footX = hipX - dir * 7;
      footY = b.y - 2;
    } else if (b.vx !== 0) {
      const amp = b.scramble ? 13 : 9;   // patinage : grandes foulées désordonnées
      const lift = b.scramble ? 9 : 6;
      const ph = b.walkPhase + i * Math.PI;
      footX = hipX + Math.sin(ph) * amp;
      footY = b.y - Math.max(0, Math.cos(ph)) * lift;
    } else {
      footX = hipX;
      footY = b.y;
    }
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(footX, footY); ctx.stroke();
    ctx.strokeStyle = legColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    if (footStyle === "toes") {
      for (const toe of [-4, 0, 4]) {
        ctx.beginPath();
        ctx.moveTo(footX, footY);
        ctx.lineTo(footX + toe + dir * 3, footY + 3);
        ctx.stroke();
      }
    } else { // grands pieds (lapin)
      ctx.fillStyle = legColor;
      ctx.beginPath();
      ctx.ellipse(footX + dir * 5, footY + 1, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }
}

// --- effets "adultes" purement visuels (aucune incidence sur la simulation) ---
// Jet de Monsieur Chibre : gerbe de gouttes blanches qui jaillit par à-coups
// du sommet, décrit un arc balistique puis retombe. Piloté par l'horloge murale.
function drawChibreSpray(tipX, tipY, dir) {
  const T = 1500;                              // période d'un jet (ms)
  const ph = (performance.now() % T) / T;      // 0 → 1
  if (ph > 0.72) return;                       // gicle sur la 1re partie du cycle
  const life = ph / 0.72;                      // 0 → 1 sur la phase active
  ctx.save();
  ctx.fillStyle = "rgba(247,250,255,0.97)";
  // jet principal : grosses gouttes lancées vers le haut/avant, arc balistique
  const n = 9;
  for (let i = 0; i < n; i++) {
    const dist = life * (30 + i * 2.4);        // les gouttes s'étalent en éventail
    const vx = 0.75 + (i - (n - 1) / 2) * 0.14;
    const vy = -2.5 - (i % 3) * 0.3;           // lancer franc vers le haut
    const gx = tipX + dir * vx * dist;
    const gy = tipY + vy * dist + 0.06 * dist * dist; // gravité
    const r = 4.6 * (1 - life * 0.4);
    ctx.globalAlpha = 0.95 * (1 - life * 0.35);
    ctx.beginPath(); ctx.arc(gx, gy, Math.max(1.4, r), 0, Math.PI * 2); ctx.fill();
  }
  // filet continu au départ (le jet qui sort)
  if (life < 0.5) {
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgba(247,250,255,0.95)";
    ctx.lineWidth = 5 * (1 - life); ctx.lineCap = "round";
    const d2 = life * 30;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(tipX + dir * 8, tipY - 22, tipX + dir * 0.75 * d2, tipY - 2.5 * d2 + 0.06 * d2 * d2);
    ctx.stroke();
  }
  ctx.restore();
}

// Madame Chneck : effet « mouillé » — une goutte perle au bas puis tombe,
// avec un filet humide au départ. Reflets brillants ajoutés dans le tracé.
function drawChneckWet(bx, botY) {
  const T = 1400;
  const ph = (performance.now() % T) / T;      // 0 → 1
  ctx.save();
  // perle qui grossit puis se détache et tombe
  const dropY = botY + ph * 40;
  const rr = 4.6 * (0.6 + ph * 0.5) * (1 - ph * 0.35);
  ctx.fillStyle = "rgba(208,234,255,0.92)";
  if (ph < 0.4) {                              // filet humide reliant au départ
    ctx.strokeStyle = "rgba(208,234,255,0.7)"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(bx, botY - 8); ctx.lineTo(bx, dropY); ctx.stroke();
  }
  // goutte en larme
  ctx.beginPath();
  ctx.moveTo(bx, dropY - rr * 1.8);
  ctx.quadraticCurveTo(bx + rr, dropY, bx, dropY + rr);
  ctx.quadraticCurveTo(bx - rr, dropY, bx, dropY - rr * 1.8);
  ctx.fill();
  // petit reflet sur la goutte
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath(); ctx.arc(bx - rr * 0.35, dropY - rr * 0.2, rr * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Monsieur Chibre : mascotte-ressort tout en hauteur (gag cartoon assumé).
// Fût vertical couleur de l'équipe, dôme au sommet avec les yeux + sourire,
// deux bosses à la base, petits pieds. S'étire quand il saute (côté ressort).
function drawChibre(b) {
  const s = Math.max(0, b.squash);
  const bx = b.x, by = b.y;
  const dir = b.side === 0 ? 1 : -1;
  const stretch = b.onGround ? 0 : 7;      // s'allonge en l'air (effet ressort)
  const topY = by - 72 - stretch + s * 1.2; // centre du dôme
  const shaftW = 19;
  ctx.save();
  drawShadow(b);
  drawLegs(b, dir, s, b.darkColor, "paws");

  // deux bourses à la base (plus grosses et un peu pendantes)
  ctx.fillStyle = b.darkColor;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(bx + side * 16, by - 8 + s, 18, 16, side * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  outline(0.12);

  // le fût (capsule verticale) : rect coiffé/chaussé par le dôme et les bosses
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.moveTo(bx - shaftW / 2, by - 16 + s);
  ctx.lineTo(bx - shaftW / 2, topY);
  ctx.lineTo(bx + shaftW / 2, topY);
  ctx.lineTo(bx + shaftW / 2, by - 16 + s);
  ctx.closePath();
  ctx.fill();
  outline();

  // gland : dôme bulbeux au sommet (un peu plus large que le fût)
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.ellipse(bx, topY, 28, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  outline();

  // couronne : sillon marqué sous le gland
  ctx.strokeStyle = "rgba(0,0,0,0.14)"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(bx, topY + 4, 26, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();

  // méat au sommet (petite fente verticale)
  ctx.strokeStyle = "rgba(120,60,60,0.55)"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx + dir * 2, topY - 22);
  ctx.lineTo(bx + dir * 2, topY - 15);
  ctx.stroke();

  // reflet clair sur le gland (volume)
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(bx - 9, topY - 9, 8, 6, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // veine stylisée sur le fût (petit détail comique discret)
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bx - dir * 5, by - 20 + s);
  ctx.quadraticCurveTo(bx - dir * 9, by - 42 + s, bx - dir * 4, topY + 14);
  ctx.stroke();

  // yeux (regard partagé depuis le centre du dôme → pas de strabisme) + sourire
  drawTrackingEye(bx + dir * 4, topY - 3, 5.5, 2.7, bx, topY);
  drawTrackingEye(bx + dir * 13, topY - 3, 5.5, 2.7, bx, topY);
  ctx.strokeStyle = "#8a2f2f"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(bx + dir * 7, topY + 9, 5, 0.08 * Math.PI, 0.92 * Math.PI);
  ctx.stroke();
  drawChibreSpray(bx + dir * 2, topY - 20, dir); // ça crache
  ctx.restore();
}

// Madame Chneck : chatte agile — corps rond couleur d'équipe, oreilles pointues,
// museau à moustaches, queue qui ondule. Pendant "Retombée de chat" (superT),
// de petites étincelles d'apesanteur pétillent autour d'elle.
function drawChneck(b) {
  const s = Math.max(0, b.squash);
  const bx = b.x, by = b.y;
  const dir = b.side === 0 ? 1 : -1;
  const headY = by - 62 + s * 1.5;
  const t = performance.now() / 1000;
  ctx.save();
  drawShadow(b);

  // ---- corps en amande : caricature de vulve (le gag de « Madame Chneck ») ----
  const cy = by - 38 + s;              // centre du corps
  const HH = 48 - s * 0.7;             // demi-hauteur de l'amande
  const WW = 30;                       // demi-largeur (lèvres externes)

  // lèvres externes : grande amande pleine, pointe en haut et en bas
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.moveTo(bx, cy - HH);
  ctx.bezierCurveTo(bx + WW * 1.25, cy - HH * 0.45, bx + WW, cy + HH * 0.55, bx, cy + HH);
  ctx.bezierCurveTo(bx - WW, cy + HH * 0.55, bx - WW * 1.25, cy - HH * 0.45, bx, cy - HH);
  ctx.closePath();
  ctx.fill();
  outline();

  // reflet doux (volume des lèvres)
  ctx.fillStyle = "rgba(255,255,255,0.20)";
  ctx.beginPath();
  ctx.ellipse(bx - WW * 0.42, cy - 2, WW * 0.34, HH * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();

  // sillon central (creux sombre)
  ctx.fillStyle = b.darkColor;
  ctx.beginPath();
  ctx.ellipse(bx, cy + 3, WW * 0.44, HH * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();

  // lèvres internes (rose plus vif)
  ctx.fillStyle = "#e07a99";
  ctx.beginPath();
  ctx.ellipse(bx, cy + 5, WW * 0.22, HH * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();

  // brillance humide (reflets spéculaires sur les lèvres internes)
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath(); ctx.ellipse(bx - 2, cy - HH * 0.1, 2.4, HH * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(bx + 3, cy + HH * 0.28, 1.8, HH * 0.16, 0, 0, Math.PI * 2); ctx.fill();

  // fente
  ctx.strokeStyle = "rgba(80,25,45,0.55)"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bx, cy - HH * 0.46);
  ctx.lineTo(bx, cy + HH * 0.74);
  ctx.stroke();

  // capuchon en haut (petit dôme) + bouton
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.ellipse(bx, cy - HH * 0.72, 10, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(0.12);
  ctx.fillStyle = "#e07a99";
  ctx.beginPath();
  ctx.arc(bx, cy - HH * 0.46, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // visage minimal : deux petits yeux qui suivent la balle (garde le perso vivant)
  const eyeY = cy - HH * 0.72;
  drawTrackingEye(bx - 5, eyeY, 3.6, 1.8, bx, eyeY);
  drawTrackingEye(bx + 5, eyeY, 3.6, 1.8, bx, eyeY);

  // étincelles d'apesanteur pendant la Retombée de chat
  if (isLiveBlob(b) && b.superT > 0) {
    ctx.fillStyle = "rgba(255,255,180,0.9)";
    for (let i = 0; i < 5; i++) {
      const a2 = t * 6 + i * 1.4;
      const r = 30 + Math.sin(t * 10 + i) * 5;
      const sx = bx + Math.cos(a2) * r, sy = by - 34 + Math.sin(a2) * r;
      ctx.beginPath(); ctx.arc(sx, sy, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawChneckWet(bx, cy + HH * 0.94); // ça mouille
  ctx.restore();
}

function drawOiseau(b) {
  const s = Math.max(0, b.squash);
  const bx = b.x, by = b.y;
  const dir = b.side === 0 ? 1 : -1;
  const m = (b.molt || 0) / MOLT_MAX;   // 0 (emplumé) → 1 (nu)
  const plume = 1 - m;                   // facteur de plumage restant
  const headY = by - (64 - m * 6) + s * 1.5; // tête descend un peu quand nu
  const SKIN = "#e6a98f", SKIN_D = "#c98a6e";
  // rayon du corps : maigrichon quand déplumé
  const bodyRx = 32 - m * 12, bodyRy = 26 - m * 11;
  ctx.save();
  drawShadow(b);
  drawLegs(b, dir, s, "#e6900a", "toes");

  // queue (disparaît totalement quand nu)
  if (plume > 0.05) {
    ctx.fillStyle = b.darkColor;
    ctx.save();
    ctx.translate(bx - dir * 28, by - 40 + s);
    ctx.rotate(-dir * 0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 16 * plume, 7 * plume, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // moignon de queue nu (2-3 tuyaux de plume)
    ctx.strokeStyle = SKIN_D; ctx.lineWidth = 2;
    for (const o of [-3, 0, 3]) {
      ctx.beginPath(); ctx.moveTo(bx - dir * 22, by - 34 + s);
      ctx.lineTo(bx - dir * 30, by - 34 + o + s); ctx.stroke();
    }
  }

  // corps : peau nue en dessous (toujours), plumes colorées par-dessus qui fondent
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.ellipse(bx, by - 32 + s, bodyRx, bodyRy, 0, 0, Math.PI * 2);
  ctx.fill();
  if (plume > 0.02) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, plume);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.ellipse(bx, by - 32 + s, 32, 26 - s * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    outline();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(bx + dir * 6, by - 26 + s, 17, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // corps nu : côtes visibles + duvet clairsemé quand bien déplumé
  if (m > 0.35) {
    ctx.strokeStyle = SKIN_D; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.6;
    for (let i = 0; i < 3; i++) {
      const ry = by - 40 + i * 7 + s;
      ctx.beginPath();
      ctx.arc(bx + dir * 4, ry, bodyRx * 0.6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // quelques rares plumes rescapées qui dépassent
    ctx.strokeStyle = SKIN_D; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const px = bx - 12 + i * 6, py2 = by - 46 + s + (i % 2) * 4;
      ctx.beginPath(); ctx.moveTo(px, py2); ctx.lineTo(px + dir * 2, py2 - 5); ctx.stroke();
    }
  }

  // aile (rapetisse puis disparaît ; à nu, petit moignon d'aile déplumée)
  if (plume > 0.05) {
    const flap = b.onGround ? 0 : Math.sin(performance.now() / 60) * 0.8;
    ctx.fillStyle = b.darkColor;
    ctx.save();
    ctx.translate(bx - dir * 10, by - 38 + s);
    ctx.rotate(dir * (0.35 + flap));
    ctx.beginPath();
    ctx.ellipse(-dir * 14, 0, 18 * plume, 9 * plume, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.strokeStyle = SKIN_D; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx - dir * 6, by - 36 + s);
    ctx.lineTo(bx - dir * 16, by - 30 + s);
    ctx.stroke();
  }

  // TÊTE : plumée aussi (peau nue quand m élevé), un peu plus petite à nu
  const headR = 22 - m * 4;
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(bx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  if (plume > 0.02) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, plume);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(bx, headY, 22, 0, Math.PI * 2);
    ctx.fill();
    outline();
    ctx.restore();
  }

  // houppette (part en premier ; à nu, 1-2 poils ridicules)
  if (plume > 0.5) {
    ctx.fillStyle = b.darkColor;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(bx + i * 5, headY - 22, 3, 8 * plume, i * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (m > 0.6) {
    ctx.strokeStyle = SKIN_D; ctx.lineWidth = 1;
    for (const o of [-2, 2]) {
      ctx.beginPath();
      ctx.moveTo(bx + o, headY - headR);
      ctx.lineTo(bx + o + dir, headY - headR - 6);
      ctx.stroke();
    }
  }

  // bec (toujours présent) — s'ouvre à l'effort / la surprise
  {
    const g2 = mouthOpen(b) * 6;
    if (g2 > 1.5) {
      ctx.fillStyle = "#7a2233"; // intérieur sombre visible quand ouvert
      ctx.beginPath();
      ctx.moveTo(bx + dir * (headR - 4), headY + 2 - g2 * 0.4);
      ctx.lineTo(bx + dir * (headR + 11), headY + 2);
      ctx.lineTo(bx + dir * (headR - 4), headY + 2 + g2 * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#ff9800";
    // mandibule supérieure
    ctx.beginPath();
    ctx.moveTo(bx + dir * (headR - 4), headY - 3 - g2 * 0.2);
    ctx.lineTo(bx + dir * (headR + 13), headY + 2 - g2);
    ctx.lineTo(bx + dir * (headR - 4), headY + 2 - g2 * 0.4);
    ctx.closePath();
    ctx.fill();
    // mandibule inférieure
    ctx.beginPath();
    ctx.moveTo(bx + dir * (headR - 4), headY + 2 + g2 * 0.4);
    ctx.lineTo(bx + dir * (headR + 13), headY + 2 + g2);
    ctx.lineTo(bx + dir * (headR - 4), headY + 8 + g2 * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  drawTrackingEye(bx + dir * 3, headY - 7, 6, 2.8);
  drawTrackingEye(bx + dir * 13 - m * 3, headY - 7, 6, 2.8);
  drawBrows(bx + dir * 3, bx + dir * 13 - m * 3, headY - 7, 6, faceMood(b));
  ctx.restore();
}

function drawGrenouille(b) {
  const s = Math.max(0, b.squash);
  const bx = b.x, by = b.y;
  const dir = b.side === 0 ? 1 : -1;
  // pattes d'une teinte fixe, différente du corps (qui, lui, prend la couleur
  // du joueur) — comme les pattes de l'oiseau ou du lapin
  const LEG = "#7a4a24";
  ctx.save();
  drawShadow(b);

  // pattes arrière : cuisses repliées au sol (qui se dandinent en marchant),
  // détendues et pédalantes en l'air
  ctx.fillStyle = LEG;
  if (b.onGround) {
    for (const side of [-1, 1]) {
      // en marche, les cuisses montent/descendent en alternance
      const step = b.vx !== 0 ? Math.sin(b.walkPhase + (side < 0 ? 0 : Math.PI)) * 3 : 0;
      ctx.beginPath();
      ctx.ellipse(bx + side * 25, by - 12 + s - step, 13, 10, side * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = LEG;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      const kick = Math.sin(performance.now() / 90 + side) * 5; // pédalage
      ctx.beginPath();
      ctx.moveTo(bx + side * 20, by - 18);
      ctx.lineTo(bx + side * 30, by + 2 + kick);
      ctx.stroke();
    }
  }

  // corps massif
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.ellipse(bx, by - 34 + s, 33, 30 - s * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  outline();

  // ventre clair
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(bx + dir * 4, by - 22 + s, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // pattes avant qui marchent (balancier en alternance). Liseré sombre
  // systématique : sans lui, elles se confondent avec les pattes arrière
  // (même teinte LEG) quand les deux se superposent visuellement.
  ctx.lineCap = "round";
  let i = 0;
  for (const off of [-8, 8]) {
    let footY = by, footX = bx + off + dir * 12;
    if (!b.onGround) { footY = by - 4; }
    else if (b.vx !== 0) {
      const phF = b.walkPhase + i * Math.PI;
      footX += Math.sin(phF) * 6;
      footY = by - Math.max(0, Math.cos(phF)) * 5;
    }
    const hipX2 = bx + off + dir * 10, hipY2 = by - 16 + s;
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.moveTo(hipX2, hipY2); ctx.lineTo(footX, footY); ctx.stroke();
    ctx.strokeStyle = LEG;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hipX2, hipY2);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    // orteils palmés
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 3;
    for (const toe of [-3, 0, 3]) {
      ctx.beginPath();
      ctx.moveTo(footX, footY);
      ctx.lineTo(footX + toe + dir * 2, footY + 3);
      ctx.stroke();
    }
    ctx.strokeStyle = LEG;
    ctx.lineWidth = 1.6;
    for (const toe of [-3, 0, 3]) {
      ctx.beginPath();
      ctx.moveTo(footX, footY);
      ctx.lineTo(footX + toe + dir * 2, footY + 3);
      ctx.stroke();
    }
    i++;
  }

  // large bouche expressive (sourire / moue / grande ouverte) — grande
  // ouverte de force quand la langue traîne dehors, peu importe l'humeur
  {
    const mp = mouthParams(faceMood(b));
    const mcx = bx + dir * 4, mcy = by - 46 + s;
    if (mp.open >= 5 || b.tongueOut) {
      const openAmt = Math.max(mp.open, 6);
      ctx.fillStyle = "#7a2233";
      ctx.beginPath();
      ctx.ellipse(mcx, mcy + 3, 11, openAmt, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!b.tongueOut) {
        ctx.fillStyle = "#ff5c8a"; // langue au fond (bouche ouverte hors coup collant)
        ctx.beginPath();
        ctx.ellipse(mcx, mcy + 3 + openAmt * 0.4, 6, openAmt * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = b.darkColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(mcx - 13, mcy);
      ctx.quadraticCurveTo(mcx, mcy + mp.curve * 1.7, mcx + 13, mcy);
      ctx.stroke();
    }
  }

  // langue sortie (après un coup collant) : bande fine qui fouette hors de
  // la bouche grande ouverte et retombe en s'enroulant, avec sillon central
  // et bout arrondi — pas un amas informe.
  if (b.tongueOut) {
    const mx = bx + dir * 4, my = by - 43 + s;
    const len = 27, curl = dir * 11;
    ctx.strokeStyle = "#ff5c8a";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(mx + dir * len * 0.75, my + len * 0.45, mx + curl, my + len);
    ctx.stroke();
    ctx.strokeStyle = "#d63a68";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(mx, my + 2);
    ctx.quadraticCurveTo(mx + dir * len * 0.75, my + len * 0.45, mx + curl, my + len - 2);
    ctx.stroke();
    ctx.fillStyle = "#ff5c8a";
    ctx.beginPath(); ctx.arc(mx + curl, my + len, 3.6, 0, Math.PI * 2); ctx.fill();
  }

  // yeux globuleux sur le dessus
  for (const off of [-11, 11]) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(bx + off, by - 62 + s * 1.5, 10, 0, Math.PI * 2);
    ctx.fill();
    drawTrackingEye(bx + off, by - 63 + s * 1.5, 7, 3.2);
  }
  drawBrows(bx - 11, bx + 11, by - 63 + s * 1.5, 10, faceMood(b));

  // narines
  ctx.fillStyle = b.darkColor;
  ctx.beginPath(); ctx.arc(bx + dir * 12 - 3, by - 54 + s, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx + dir * 12 + 3, by - 54 + s, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawManchot(b) {
  const s = Math.max(0, b.squash);
  const bx = b.x, by = b.y;
  const dir = b.side === 0 ? 1 : -1;
  // fureur grandissante au fil des touches (purement visuel, 0 → ANGER_MAX) :
  // tremblement de rage qui s'ajoute au dandinement normal.
  const angerT = (b.anger || 0) / ANGER_MAX;
  const angerShake = angerT > 0.12 ? Math.sin(performance.now() / 30) * angerT * 3.6 : 0;
  const waddle = ((b.onGround && b.vx !== 0) ? Math.sin(b.walkPhase) * 3 : 0) + angerShake;
  const headY = by - 66 + s * 1.5;
  ctx.save();
  drawShadow(b);

  // pieds palmés orange, rattachés haut sous le corps (pas de vide)
  ctx.strokeStyle = "#f57c00";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.fillStyle = "#ff9800";
  for (let i = 0; i < 2; i++) {
    const hipX = bx + waddle + (i === 0 ? -7 : 7);
    let footX = hipX + dir * 3, footY = by;
    if (!b.onGround) { footX = hipX - dir * 5; footY = by - 4; }
    else if (b.vx !== 0) {
      const ph = b.walkPhase + i * Math.PI;
      footX = hipX + Math.sin(ph) * 7 + dir * 3;
      footY = by - Math.max(0, Math.cos(ph)) * 4;
    }
    ctx.beginPath();
    ctx.moveTo(hipX, by - 20 + s);   // hanche remontée dans le corps
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(footX + dir * 5, footY + 1, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // CORPS foncé, base descendue jusqu'au sol pour englober les hanches
  ctx.fillStyle = b.darkColor;
  ctx.beginPath();
  ctx.moveTo(bx - 26 + waddle, by - 22 + s);
  ctx.quadraticCurveTo(bx - 30 + waddle, by - 78 + s, bx + waddle, by - 88 + s);
  ctx.quadraticCurveTo(bx + 30 + waddle, by - 78 + s, bx + 26 + waddle, by - 22 + s);
  ctx.quadraticCurveTo(bx + waddle, by - 4 + s, bx - 26 + waddle, by - 22 + s);
  ctx.fill();
  outline();

  // fureur : tout le corps rougit progressivement (pas seulement les joues),
  // par-dessus le corps foncé qui vient d'être dessiné
  if (angerT > 0.08) {
    ctx.fillStyle = "rgba(230,25,15," + Math.min(0.55, angerT * 0.6).toFixed(2) + ")";
    ctx.beginPath();
    ctx.moveTo(bx - 26 + waddle, by - 22 + s);
    ctx.quadraticCurveTo(bx - 30 + waddle, by - 78 + s, bx + waddle, by - 88 + s);
    ctx.quadraticCurveTo(bx + 30 + waddle, by - 78 + s, bx + 26 + waddle, by - 22 + s);
    ctx.quadraticCurveTo(bx + waddle, by - 4 + s, bx - 26 + waddle, by - 22 + s);
    ctx.fill();
  }

  // 2e teinte : bande latérale plus claire (couleur du joueur) sur les flancs
  ctx.fillStyle = b.color;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(bx - dir * 17 + waddle, by - 46 + s, 9, 30, dir * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // plastron blanc net et resserré, descendu jusqu'en bas
  ctx.fillStyle = "#f7fbff";
  ctx.beginPath();
  ctx.moveTo(bx - 14 + waddle, by - 22 + s);
  ctx.quadraticCurveTo(bx - 14 + waddle, by - 60 + s, bx + waddle, by - 64 + s);
  ctx.quadraticCurveTo(bx + 14 + waddle, by - 60 + s, bx + 14 + waddle, by - 22 + s);
  ctx.quadraticCurveTo(bx + waddle, by - 8 + s, bx - 14 + waddle, by - 22 + s);
  ctx.fill();

  // ailerons foncés
  const flap = b.onGround ? 0.15 : Math.sin(performance.now() / 55) * 0.5 + 0.3;
  ctx.fillStyle = b.darkColor;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(bx + side * 24 + waddle, by - 48 + s);
    ctx.rotate(side * (0.55 + flap));
    ctx.beginPath();
    ctx.ellipse(0, 10, 6.5, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // TÊTE foncée
  ctx.fillStyle = b.darkColor;
  ctx.beginPath();
  ctx.arc(bx + waddle, headY, 21, 0, Math.PI * 2);
  ctx.fill();
  outline();

  // large masque facial clair (contraste pour bien voir les yeux)
  ctx.fillStyle = "#fbe7c6";
  ctx.beginPath();
  ctx.ellipse(bx + waddle + dir * 2, headY + 1, 15, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // BEC court orange — s'ouvre à l'effort / la surprise
  {
    const bxw = bx + waddle;
    const g2 = mouthOpen(b) * 6;
    if (g2 > 1.5) {
      ctx.fillStyle = "#7a2233";
      ctx.beginPath();
      ctx.moveTo(bxw + dir * 13, headY + 3 - g2 * 0.4);
      ctx.lineTo(bxw + dir * 25, headY + 3);
      ctx.lineTo(bxw + dir * 13, headY + 3 + g2 * 0.4);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#ff9800";
    ctx.beginPath(); // mandibule supérieure
    ctx.moveTo(bxw + dir * 13, headY - 2 - g2 * 0.2);
    ctx.lineTo(bxw + dir * 27, headY + 3 - g2);
    ctx.lineTo(bxw + dir * 13, headY + 3 - g2 * 0.4);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); // mandibule inférieure
    ctx.moveTo(bxw + dir * 13, headY + 3 + g2 * 0.4);
    ctx.lineTo(bxw + dir * 27, headY + 3 + g2);
    ctx.lineTo(bxw + dir * 13, headY + 8 + g2 * 0.2);
    ctx.closePath(); ctx.fill();
  }

  // yeux bien contrastés : anneau foncé + blanc + pupille (le blanc rougit
  // avec la fureur croissante)
  for (const off of [3, 12]) {
    const ex = bx + waddle + dir * off, ey = headY - 3;
    ctx.fillStyle = b.darkColor;
    ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, Math.PI * 2); ctx.fill();
    drawTrackingEye(ex, ey, 5, 2.6, undefined, undefined, angerT);
  }
  // sourcils : tempérament colérique de base (légèrement froncés au repos),
  // qui s'incline de plus en plus avec la fureur — plus prononcé que le
  // préréglage "fierce" classique une fois la jauge pleine.
  drawBrows(bx + waddle + dir * 3, bx + waddle + dir * 12, headY - 3, 6.5, {
    inner: 1.5 + angerT * 4.5,
    outer: -angerT * 6.5,
    lift: -angerT * 2
  });

  // fureur croissante : joues qui rougissent, éclairs de colère, veines qui
  // pulsent, vapeur qui s'échappe — dessinés en tout dernier pour rester
  // par-dessus la tête.
  if (angerT > 0.05) {
    // joues rouges, sous chaque œil (par-dessus le masque clair)
    ctx.fillStyle = "rgba(235,20,10," + Math.min(0.9, 0.25 + angerT * 0.75).toFixed(2) + ")";
    for (const off of [3, 12]) {
      ctx.beginPath();
      ctx.ellipse(bx + waddle + dir * off, headY + 7, 4 + angerT * 2.5, 2.8 + angerT * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (angerT > 0.2) {
    // veines de colère qui palpitent sur le front (deux, à fureur avancée)
    const pulse = Math.sin(performance.now() / 80) > 0 ? 1 : 0.4;
    ctx.strokeStyle = "rgba(210,20,20," + Math.min(0.95, 0.5 * pulse + angerT * 0.5).toFixed(2) + ")";
    ctx.lineWidth = 1.6 + angerT * 1.4; ctx.lineCap = "round";
    const veins = angerT > 0.55 ? [-8, 6] : [-8];
    for (const vo of veins) {
      const vx0 = bx + waddle + dir * vo, vy0 = headY - 15;
      ctx.beginPath();
      ctx.moveTo(vx0, vy0);
      ctx.lineTo(vx0 + 2, vy0 + 4);
      ctx.lineTo(vx0 - 1, vy0 + 7);
      ctx.lineTo(vx0 + 2, vy0 + 11);
      ctx.stroke();
    }
  }
  if (angerT > 0.15) {
    // vapeur qui s'échappe de la tête, de plus en plus dense et épaisse —
    // liseré sombre systématique (sinon invisible sur la banquise, tout en blanc)
    const nPuffs = Math.min(6, Math.ceil((angerT - 0.15) / 0.13));
    const t = performance.now() / 220;
    for (let p = 0; p < nPuffs; p++) {
      const cyc = (t + p * 0.3) % 1; // 0 → 1 : monte et s'estompe
      const px = bx + waddle + (p - (nPuffs - 1) / 2) * 10 + Math.sin(t * 3 + p) * 3;
      const py = headY - 22 - cyc * 30;
      ctx.globalAlpha = (1 - cyc) * (0.75 + angerT * 0.25);
      const r2 = 5 + angerT * 4 + cyc * 5;
      ctx.fillStyle = "rgba(235,240,245,0.95)";
      ctx.strokeStyle = "rgba(90,90,100,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, r2, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (angerT > 0.3) {
    // éclairs de colère au-dessus de la tête (façon bande dessinée), bien
    // au-dessus de la vapeur — de plus en plus nombreux et vifs
    const nBolts = Math.min(3, Math.ceil((angerT - 0.3) / 0.22));
    const t2 = performance.now() / 130;
    for (let bIdx = 0; bIdx < nBolts; bIdx++) {
      const jitter = Math.sin(t2 + bIdx * 2.1) * 2;
      const cx3 = bx + waddle + (bIdx - (nBolts - 1) / 2) * 16 + jitter;
      const cy3 = headY - 58 - Math.abs(Math.sin(t2 * 0.7 + bIdx)) * 4;
      ctx.save();
      ctx.translate(cx3, cy3);
      ctx.rotate(Math.sin(t2 + bIdx) * 0.25);
      ctx.fillStyle = "#ffd400";
      ctx.strokeStyle = "rgba(120,60,0,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, -9);
      ctx.lineTo(2, -2);
      ctx.lineTo(-1, -2);
      ctx.lineTo(4, 9);
      ctx.lineTo(-2, 1);
      ctx.lineTo(1, 1);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawLapin(b) {
  const s = Math.max(0, b.squash);
  const bx = b.x, by = b.y;
  const dir = b.side === 0 ? 1 : -1;
  const fatigueT = (b.fatigue || 0) / FATIGUE_MAX;
  // à fatigue max, la tête s'affaisse un peu : posture d'épave
  const headY = by - 64 + s * 1.5 + fatigueT * 6;
  ctx.save();
  drawShadow(b);
  drawLegs(b, dir, s, "#f2f2f2", "paws"); // pattes arrière blanches

  // queue pompon
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(bx - dir * 27, by - 26 + s, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // corps
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.ellipse(bx, by - 30 + s, 30, 26 - s * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  outline();

  // ventre clair
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(bx + dir * 5, by - 24 + s, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // petites pattes avant : deux toutes petites rondelles blanches posées sur
  // le ventre (à hauteur du poitrail, PAS en bas du buste) — léger rebond en
  // marche
  ctx.fillStyle = "#f2f2f2";
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1.2;
  for (let pi = 0; pi < 2; pi++) {
    const bob = (b.onGround && b.vx !== 0)
      ? Math.max(0, Math.sin(b.walkPhase + pi * Math.PI)) * 2 : 0;
    const pawX = bx + dir * (4 + pi * 7), pawY = by - 19 + s - bob;
    ctx.beginPath();
    ctx.arc(pawX, pawY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // oreilles (penchées en arrière pendant le saut ; s'affaissent
  // progressivement avec la fatigue — purement visuel, 0 → FATIGUE_MAX)
  const earBack = b.onGround ? 0 : -dir * 0.35;
  const earDroop = fatigueT * 1.9; // à fatigue max, elles pendent, complètement molles
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(bx + side * 8, headY - 14);
    ctx.rotate(side * (0.18 + earDroop) + earBack * (1 - fatigueT));
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.ellipse(0, -16, 6.5, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f5b7c5";
    ctx.beginPath();
    ctx.ellipse(0, -15, 3.2, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // tête
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.arc(bx, headY, 21, 0, Math.PI * 2);
  ctx.fill();
  outline();

  // museau : nez rose
  ctx.fillStyle = "#f06292";
  ctx.beginPath();
  ctx.moveTo(bx + dir * 16, headY + 1);
  ctx.lineTo(bx + dir * 23, headY + 4);
  ctx.lineTo(bx + dir * 16, headY + 7);
  ctx.closePath();
  ctx.fill();
  // moustaches des deux côtés
  ctx.strokeStyle = "rgba(80,80,80,0.6)";
  ctx.lineWidth = 1;
  for (const sgn of [1, -1]) {
    for (const wy of [-1, 3]) {
      ctx.beginPath();
      ctx.moveTo(bx + dir * 15, headY + 4);
      ctx.lineTo(bx + dir * 15 + sgn * 16, headY + 4 + wy * sgn);
      ctx.stroke();
    }
  }
  // deux petites quenottes sous le nez
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(80,80,80,0.5)";
  ctx.lineWidth = 0.6;
  for (const qx of [-2.5, 2.5]) {
    ctx.beginPath();
    ctx.rect(bx + dir * 14 + qx, headY + 8, 4, 6);
    ctx.fill(); ctx.stroke();
  }
  // petite bouche ouverte à l'effort (sous les quenottes)
  {
    const mo = mouthOpen(b);
    if (mo >= 0.7) {
      ctx.fillStyle = "#b3475e";
      ctx.beginPath();
      ctx.ellipse(bx + dir * 16, headY + 16, 3.2, 2 + mo * 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // regard partagé depuis le centre des deux yeux → yeux bien parallèles
  const gzx = bx + dir * 7.5, gzy = headY - 6;
  drawTrackingEye(bx + dir * 3, headY - 6, 5.5, 2.6, gzx, gzy);
  drawTrackingEye(bx + dir * 12, headY - 6, 5.5, 2.6, gzx, gzy);
  drawBrows(bx + dir * 3, bx + dir * 12, headY - 6, 5.5, faceMood(b));

  // paupières lourdes à la fatigue : les yeux finissent presque totalement
  // fermés (regard à bout de forces), par-dessus les yeux déjà dessinés
  if (fatigueT > 0.1) {
    const lidH = Math.min(10.8, (fatigueT - 0.1) / 0.9 * 10.8);
    ctx.fillStyle = b.color;
    for (const ex of [bx + dir * 3, bx + dir * 12]) {
      ctx.fillRect(ex - 6, headY - 12, 12, lidH);
    }
  }

  // langue qui pend sous le menton, halètement à bout de souffle (dès le
  // tiers de la jauge) — bande allongée qui se balance, PAS un amas collé
  // au museau : elle part de sous les dents et descend clairement.
  if (fatigueT > 0.32) {
    const tongueLen = 5 + (fatigueT - 0.32) / 0.68 * 20; // 5 → 25 px
    const wob = Math.sin(performance.now() / 150) * 2;
    const tx = bx + dir * 13, ty = headY + 15;
    const tipX = tx + wob, tipY = ty + tongueLen;
    ctx.fillStyle = "#ff6f91";
    ctx.strokeStyle = "rgba(190,50,90,0.7)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx - 3, ty);
    ctx.lineTo(tx + 3, ty);
    ctx.quadraticCurveTo(tx + 3 + wob * 0.3, ty + tongueLen * 0.6, tipX + 2.5, tipY);
    ctx.quadraticCurveTo(tipX, tipY + 2.5, tipX - 2.5, tipY);
    ctx.quadraticCurveTo(tx - 3 + wob * 0.3, ty + tongueLen * 0.6, tx - 3, ty);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // sillon central pour lire la langue comme une bande, pas un blob
    ctx.beginPath();
    ctx.moveTo(tx, ty + 1);
    ctx.quadraticCurveTo(tx + wob * 0.3, ty + tongueLen * 0.6, tipX, tipY - 2);
    ctx.stroke();
  }

  // gouttes de sueur (de plus en plus nombreuses et grosses) — dessinées en
  // tout dernier pour rester par-dessus la tête. Un déluge complet à fatigue max.
  if (fatigueT > 0.08) {
    const nDrops = Math.min(9, Math.ceil(fatigueT * 9));
    ctx.strokeStyle = "rgba(60,120,180,0.6)";
    ctx.lineWidth = 0.8;
    for (let d = 0; d < nDrops; d++) {
      const dropSize = 4.5 + fatigueT * 3.2;
      const onLeft = d % 2 === 0;
      const dx = (onLeft ? bx - dir * 22 : bx + dir * 25) + (d % 3) * 3;
      const dy = headY - 26 + Math.floor(d / 2) * 10 + Math.sin(performance.now() / 200 + d) * 1.5;
      ctx.fillStyle = "rgba(140,205,255," + (0.75 + fatigueT * 0.25).toFixed(2) + ")";
      ctx.beginPath();
      ctx.moveTo(dx, dy - dropSize);
      ctx.quadraticCurveTo(dx + dropSize * 0.75, dy + dropSize * 0.25, dx, dy + dropSize);
      ctx.quadraticCurveTo(dx - dropSize * 0.75, dy + dropSize * 0.25, dx, dy - dropSize);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

