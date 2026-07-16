// crabby-volley · terrains & parallaxe (plage, banquise, nuit)
"use strict";

// ---------- Parallaxe (profondeur multi-couches) ----------
// Décalage horizontal type « caméra » piloté par la position de la balle :
// les couches lointaines glissent peu, les proches davantage → sensation de
// profondeur. 100 % visuel (lit ball.x, n'affecte ni la simulation ni les
// snapshots), et l'invité a la position de la balle par interpolation.
function paraX(depth) {
  const focus = Math.max(-1, Math.min(1, (ball.x - W / 2) / (W / 2)));
  const drift = Math.sin(performance.now() / 3000);
  return -(focus * 34 + drift * 10) * depth;
}

// silhouette de collines/reliefs remplie, décalée selon sa profondeur.
// pts = crêtes [x, y] ; la base plate (baseY) est ensuite masquée par les
// couches dessinées par-dessus (gradins, montagnes…), ce qui empile les plans.
function drawHillLayer(baseY, color, depth, pts) {
  const ox = paraX(depth);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-60 + ox, baseY);
  for (const p of pts) ctx.lineTo(p[0] + ox, p[1]);
  ctx.lineTo(W + 60 + ox, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawBgPlage() {
  const sun = celestialPos();
  const storm = weather === "storm";
  const raining = weather === "rain" || storm; // tempête de sable (même impact que la pluie)

  // ciel : bleu clair par beau temps, voilé d'ocre pendant la tempête de sable
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  if (storm) {
    sky.addColorStop(0, "#8a6a3f");
    sky.addColorStop(1, "#c2a367");
  } else if (raining) {
    sky.addColorStop(0, "#a68a58");
    sky.addColorStop(1, "#d8c088");
  } else {
    sky.addColorStop(0, "#4da6e8");
    sky.addColorStop(1, "#bfe6ff");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // parallaxe : collines côtières lointaine (bleutée) + intermédiaire, noyées dans le sable en l'air
  drawHillLayer(GROUND_Y - 100, storm ? "#8f7a52" : raining ? "#b8a374" : "#a9d4ec", 0.12,
    [[110, GROUND_Y - 150], [300, GROUND_Y - 118], [470, GROUND_Y - 162], [660, GROUND_Y - 122], [820, GROUND_Y - 152]]);
  drawHillLayer(GROUND_Y - 92, storm ? "#7c6a48" : raining ? "#a08e64" : "#7fbfe0", 0.3,
    [[180, GROUND_Y - 128], [380, GROUND_Y - 104], [560, GROUND_Y - 134], [760, GROUND_Y - 108]]);

  // soleil (dérive lente) — voilé de sable, presque invisible pendant la tempête
  if (!storm) {
    const halo = raining ? 0.15 : 0.35;
    ctx.fillStyle = "rgba(255,230,128," + halo + ")";
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = raining ? "rgba(255,225,170,0.6)" : "#ffe680";
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 38, 0, Math.PI * 2); ctx.fill();
  }

  drawClouds(storm ? "rgba(150,120,75,0.9)" : raining ? "rgba(210,185,135,0.8)" : "rgba(255,255,255,0.85)");

  // tribunes (derrière la mer)
  drawCrowd();

  // mer au loin (plus sombre sous l'orage)
  ctx.fillStyle = storm ? "#1f4c6b" : "#2e86c1";
  ctx.fillRect(0, GROUND_Y - 55, W, 18);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(0, GROUND_Y - 55, W, 3);

  // sable : clair par beau temps, terni/voilé de poussière pendant la tempête
  const sand = ctx.createLinearGradient(0, GROUND_Y - 38, 0, H);
  if (raining) {
    sand.addColorStop(0, "#c9a25a");
    sand.addColorStop(1, "#a07f3f");
  } else {
    sand.addColorStop(0, "#f4d58d");
    sand.addColorStop(1, "#d9b25f");
  }
  ctx.fillStyle = sand;
  ctx.fillRect(0, GROUND_Y - 37, W, H - GROUND_Y + 37);
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, GROUND_Y, W, 2);

  // grains de sable (positions fixes, purement décoratif)
  ctx.fillStyle = "rgba(120,90,30,0.18)";
  for (let i = 0; i < 42; i++) {
    const gx = (i * 193.7) % W;
    const gy = GROUND_Y + 4 + (i * 37.3) % (H - GROUND_Y - 10);
    ctx.fillRect(gx, gy, 2, 2);
  }

  // vaguelettes d'écume animées au bord de l'eau
  const tw = performance.now() / 1000;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = GROUND_Y - 38 + Math.sin(x / 26 + tw * 2) * 2;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  drawPalm(52, storm);
  drawSkyBirds();
  drawCrab();
  if (raining) drawSandstorm(storm ? 1 : 0.55);
}

// palmier qui se balance doucement (plus fort sous l'orage)
function drawPalm(px, storm) {
  const t = performance.now() / 1000;
  const sway = Math.sin(t * (storm ? 3 : 0.8)) * (storm ? 6 : 2.5);
  const topY = GROUND_Y - 148;
  // interactif : la cime est repoussée quand la balle passe tout près
  const bd = Math.hypot((px + 16) - ball.x, topY - ball.y);
  const bend = bd < 95 ? (1 - bd / 95) * ((px + 16) >= ball.x ? 16 : -16) : 0;
  const topX = px + 16 + sway + bend;
  ctx.save();
  // tronc courbé
  ctx.strokeStyle = "#8d6e63";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(px - 6, GROUND_Y - 30);
  ctx.quadraticCurveTo(px + 2, GROUND_Y - 95, topX, topY);
  ctx.stroke();
  // anneaux du tronc
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 2;
  for (let i = 1; i <= 4; i++) {
    const ty = GROUND_Y - 30 - i * 24;
    ctx.beginPath();
    ctx.moveTo(px - 9 + i, ty);
    ctx.lineTo(px + 1 + i, ty - 4);
    ctx.stroke();
  }
  // palmes en éventail
  ctx.strokeStyle = "#2e7d32";
  ctx.lineWidth = 5;
  for (let i = 0; i < 6; i++) {
    const ang = -Math.PI * 0.15 - i * 0.35 + sway * 0.02;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(ang) * 30, topY + Math.sin(ang) * 30 - 12,
      topX + Math.cos(ang) * 52, topY + Math.sin(ang) * 52 + 10
    );
    ctx.stroke();
  }
  // noix de coco
  ctx.fillStyle = "#5d4037";
  for (const [ox, oy] of [[-5, 4], [4, 6]]) {
    ctx.beginPath(); ctx.arc(topX + ox, topY + oy, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBgNeige() {
  const t = performance.now() / 1000;
  const heavy = weather === "rain";    // chute de neige soutenue
  const blizzard = weather === "storm"; // blizzard
  // ciel pâle, plombé quand il neige fort / blizzard
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  if (blizzard) { sky.addColorStop(0, "#7d8ea0"); sky.addColorStop(1, "#b9c9d8"); }
  else if (heavy) { sky.addColorStop(0, "#93aac2"); sky.addColorStop(1, "#d3e2ef"); }
  else { sky.addColorStop(0, "#a8c4dd"); sky.addColorStop(1, "#e9f4fc"); }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // soleil voilé (dérive lente) — caché par le blizzard
  if (!blizzard) {
    const sunN = celestialPos();
    ctx.fillStyle = heavy ? "rgba(255,250,230,0.45)" : "rgba(255,250,230,0.7)";
    ctx.beginPath(); ctx.arc(sunN.x, sunN.y, 32, 0, Math.PI * 2); ctx.fill();
  }

  drawClouds(blizzard ? "rgba(200,210,220,0.9)" : "rgba(255,255,255,0.7)");

  // parallaxe : chaîne très lointaine (pâle) + chaîne intermédiaire, derrière
  // les montagnes proches → trois plans de relief qui glissent à des vitesses
  // différentes selon la balle.
  drawHillLayer(GROUND_Y - 95, "#eaf2fb", 0.1,
    [[90, GROUND_Y - 165], [280, GROUND_Y - 120], [470, GROUND_Y - 188], [680, GROUND_Y - 128], [860, GROUND_Y - 170]]);
  drawHillLayer(GROUND_Y - 78, "#d3e2f0", 0.28,
    [[160, GROUND_Y - 122], [360, GROUND_Y - 96], [560, GROUND_Y - 126], [780, GROUND_Y - 100]]);

  // montagnes
  ctx.fillStyle = "#dfe9f2";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y - 55);
  ctx.lineTo(150, GROUND_Y - 170); ctx.lineTo(320, GROUND_Y - 55);
  ctx.lineTo(430, GROUND_Y - 140); ctx.lineTo(600, GROUND_Y - 55);
  ctx.lineTo(720, GROUND_Y - 185); ctx.lineTo(W, GROUND_Y - 55);
  ctx.closePath();
  ctx.fill();

  // tribunes (devant les montagnes)
  drawCrowd();

  // lac gelé
  ctx.fillStyle = "#a8cfe3";
  ctx.fillRect(0, GROUND_Y - 55, W, 18);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(0, GROUND_Y - 55, W, 3);

  // neige au sol
  const snow = ctx.createLinearGradient(0, GROUND_Y - 38, 0, H);
  snow.addColorStop(0, "#fbfdff");
  snow.addColorStop(1, "#d7e4ee");
  ctx.fillStyle = snow;
  ctx.fillRect(0, GROUND_Y - 37, W, H - GROUND_Y + 37);
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0, GROUND_Y, W, 2);

  // sapins
  for (const [px, sc] of [[50, 1], [110, 0.7], [815, 0.9]]) {
    ctx.fillStyle = "#2e5e46";
    for (let l = 0; l < 3; l++) {
      const w2 = (26 - l * 6) * sc, yTop = GROUND_Y - (52 - l * 14) * sc;
      ctx.beginPath();
      ctx.moveTo(px, yTop);
      ctx.lineTo(px - w2, yTop + 22 * sc);
      ctx.lineTo(px + w2, yTop + 22 * sc);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#5d4037";
    ctx.fillRect(px - 3 * sc, GROUND_Y - 10 * sc, 6 * sc, 10 * sc);
  }

  // bonhomme de neige — interactif : il rentre la tête quand la balle approche
  const sx = 862;
  const sbd = Math.hypot(sx - ball.x, (GROUND_Y - 30) - ball.y);
  const sy = GROUND_Y + (sbd < 80 ? (1 - sbd / 80) * 8 : 0);
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(sx, sy - 12, 14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx, sy - 34, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(sx - 3, sy - 36, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + 3, sy - 36, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff9800";
  ctx.beginPath();
  ctx.moveTo(sx, sy - 33); ctx.lineTo(sx + 9, sy - 31); ctx.lineTo(sx, sy - 29);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx - 12, sy - 14); ctx.lineTo(sx - 22, sy - 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx + 12, sy - 14); ctx.lineTo(sx + 22, sy - 22); ctx.stroke();

  // flocons (positions dérivées du temps : aucun état à synchroniser).
  // Densité et vent selon la météo : léger / chute soutenue / blizzard.
  const flakes = blizzard ? 190 : heavy ? 110 : 45;
  const wind = blizzard ? 60 : heavy ? 22 : 0;
  const spd = blizzard ? 1.9 : heavy ? 1.4 : 1;
  ctx.fillStyle = "#fff";
  for (let i = 0; i < flakes; i++) {
    const fx = ((i * 97.3 + t * (18 + (i % 5) * 6) * spd + wind * t + Math.sin(t + i) * 12) % (W + 40)) - 20;
    const fy = (i * 53.7 + t * (30 + (i % 7) * 8) * spd) % (GROUND_Y + 20);
    ctx.globalAlpha = 0.45 + (i % 4) * 0.13;
    ctx.beginPath();
    ctx.arc(fx, fy, 1.2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // voile blanc du blizzard
  if (blizzard) { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(0, 0, W, GROUND_Y); }
}

// aurore boréale : rubans lumineux ondoyants (fondu additif → effet de lueur).
function drawAurora(t) {
  const bands = [
    { y: 66,  c: "rgba(70,240,170,0.13)" },
    { y: 94,  c: "rgba(140,110,255,0.10)" },
    { y: 120, c: "rgba(90,210,255,0.09)" }
  ];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let b = 0; b < bands.length; b++) {
    const baseY = bands[b].y;
    const grad = ctx.createLinearGradient(0, baseY - 42, 0, baseY + 90);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.45, bands[b].c);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 120);
    for (let x = 0; x <= W; x += 20) {
      const y = baseY + Math.sin(x / 90 + t * 0.5 + b) * 22 + Math.sin(x / 40 - t * 0.35) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, baseY + 120);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBgNuit() {
  const t = performance.now() / 1000;
  const rainy = weather === "rain" || weather === "storm";
  const stormy = weather === "storm";
  // ciel nocturne (plus noir sous l'orage)
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  if (stormy) { sky.addColorStop(0, "#05060f"); sky.addColorStop(1, "#1a2036"); }
  else { sky.addColorStop(0, "#0a0f2e"); sky.addColorStop(1, "#2c3d6e"); }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // éclair : flash blanc bref et périodique (purement visuel)
  if (stormy) {
    const cyc = t % 3.3, on = cyc < 0.09 || (cyc > 0.16 && cyc < 0.24);
    if (on) { ctx.fillStyle = "rgba(220,230,255,0.5)"; ctx.fillRect(0, 0, W, GROUND_Y); }
  }

  // étoiles scintillantes (voilées par les nuages quand il pleut)
  const starA = rainy ? 0.25 : 1;
  for (let i = 0; i < 60; i++) {
    const sxx = (i * 127.7) % W;
    const syy = (i * 67.3) % (GROUND_Y - 130);
    ctx.globalAlpha = (0.35 + Math.abs(Math.sin(t * 1.5 + i * 2.1)) * 0.65) * starA;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(sxx, syy, i % 5 === 0 ? 1.8 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // aurore boréale par temps clair (voilée quand il pleut)
  if (!rainy) drawAurora(t);
  if (rainy) drawClouds(stormy ? "rgba(40,46,66,0.95)" : "rgba(70,80,110,0.9)");

  // lune (dérive lente d'est en ouest)
  const moon = celestialPos();
  const mnx = moon.x, mny = moon.y;
  ctx.fillStyle = "rgba(240,234,214,0.25)";
  ctx.beginPath(); ctx.arc(mnx, mny, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f0ead6";
  ctx.beginPath(); ctx.arc(mnx, mny, 32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (const [mx, my, mr] of [[-10, -6, 6], [8, 4, 4], [2, -14, 3]]) {
    ctx.beginPath(); ctx.arc(mnx + mx, mny + my, mr, 0, Math.PI * 2); ctx.fill();
  }

  // parallaxe : collines nocturnes lointaines + intermédiaires (silhouettes)
  drawHillLayer(GROUND_Y - 95, "#0c1330", 0.1,
    [[120, GROUND_Y - 150], [320, GROUND_Y - 120], [520, GROUND_Y - 158], [720, GROUND_Y - 124], [880, GROUND_Y - 146]]);
  drawHillLayer(GROUND_Y - 82, "#111a3c", 0.26,
    [[200, GROUND_Y - 118], [420, GROUND_Y - 98], [640, GROUND_Y - 122], [840, GROUND_Y - 100]]);

  // tribunes (guirlandes lumineuses dans la nuit)
  drawCrowd();

  // eau stagnante du marais + reflet de lune (sous l'astre)
  ctx.fillStyle = "#0f2a22";
  ctx.fillRect(0, GROUND_Y - 55, W, 18);
  ctx.fillStyle = "rgba(240,234,214,0.2)";
  for (let i = 0; i < 5; i++) {
    const rw = 26 - i * 4;
    ctx.fillRect(mnx - rw / 2 + Math.sin(t * 2 + i) * 6, GROUND_Y - 54 + i * 3.4, rw, 2);
  }

  // berge boueuse du marais
  const sand = ctx.createLinearGradient(0, GROUND_Y - 38, 0, H);
  sand.addColorStop(0, "#6e6b42");
  sand.addColorStop(1, "#4a4a2e");
  ctx.fillStyle = sand;
  ctx.fillRect(0, GROUND_Y - 37, W, H - GROUND_Y + 37);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, GROUND_Y, W, 2);

  // nénuphars flottant sur l'eau sombre, près de la berge
  ctx.fillStyle = "#0f3322";
  for (const [lx, ly, lr] of [[108, GROUND_Y - 47, 9], [176, GROUND_Y - 44, 6],
                              [758, GROUND_Y - 46, 8], [822, GROUND_Y - 43, 6]]) {
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0.25 * Math.PI, 1.9 * Math.PI);
    ctx.closePath();
    ctx.fill();
  }

  // roseaux du marais : silhouettes de tiges qui se balancent, ancrées sur
  // la berge (deux touffes de chaque côté, hors de la zone de jeu)
  ctx.strokeStyle = "#0d2a1c";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const [rx, cnt, rh] of [[36, 4, 46], [138, 3, 34], [786, 5, 50], [858, 3, 36]]) {
    for (let k = 0; k < cnt; k++) {
      const sway = Math.sin(t * 1.2 + rx + k) * 4;
      const bx2 = rx + k * 7;
      const topY = GROUND_Y - 38 - rh + Math.sin(t + k) * 2;
      ctx.beginPath();
      ctx.moveTo(bx2, GROUND_Y - 34);
      ctx.quadraticCurveTo(bx2 + sway * 0.5, GROUND_Y - 34 - rh * 0.6, bx2 + sway, topY);
      ctx.stroke();
      ctx.fillStyle = "#1a3d28";
      ctx.beginPath(); ctx.ellipse(bx2 + sway, topY, 2.4, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // lucioles (sorties seulement par temps clair) — sinon, la brume se lève
  if (!rainy) {
    for (let i = 0; i < 7; i++) {
      let fx = W / 2 + Math.sin(t * (0.3 + i * 0.07) + i * 2.4) * (W * 0.42);
      let fy = GROUND_Y - 60 - Math.abs(Math.sin(t * (0.5 + i * 0.1) + i)) * 120;
      // interactif : elles s'écartent vivement du passage de la balle
      const dfx = fx - ball.x, dfy = fy - ball.y, dd = Math.hypot(dfx, dfy) || 1;
      if (dd < 72) { const push = (72 - dd); fx += dfx / dd * push; fy += dfy / dd * push; }
      const a = 0.35 + Math.abs(Math.sin(t * 2 + i * 1.7)) * 0.65;
      ctx.fillStyle = "rgba(220,255,120," + (a * 0.25).toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(235,255,150," + a.toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    drawFog(stormy ? 1 : 0.55);
  }
}

function drawBgPrairie() {
  const t = performance.now() / 1000;
  const storm = weather === "storm";
  const raining = weather === "rain" || storm;

  // ciel : bleu vif par beau temps, verdâtre plombé à l'orage
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  if (storm) {
    sky.addColorStop(0, "#4a5245");
    sky.addColorStop(1, "#7c8a6f");
  } else if (raining) {
    sky.addColorStop(0, "#7d9a7a");
    sky.addColorStop(1, "#b8d0a8");
  } else {
    sky.addColorStop(0, "#57b8ea");
    sky.addColorStop(1, "#c9ecff");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // collines verdoyantes en parallaxe (lointaine puis intermédiaire)
  drawHillLayer(GROUND_Y - 100, storm ? "#5c6b4a" : raining ? "#8fa876" : "#a8d67e", 0.12,
    [[100, GROUND_Y - 148], [290, GROUND_Y - 116], [480, GROUND_Y - 160], [670, GROUND_Y - 120], [830, GROUND_Y - 150]]);
  drawHillLayer(GROUND_Y - 90, storm ? "#4a5c3a" : raining ? "#7d9a62" : "#7ec654", 0.3,
    [[170, GROUND_Y - 122], [370, GROUND_Y - 100], [550, GROUND_Y - 130], [770, GROUND_Y - 104]]);

  // arc-en-ciel : quand il pleut mais que le soleil reste visible
  if (raining && sunVisible() && !storm) drawRainbow();

  // soleil (dérive lente) — voilé sous la pluie, masqué à l'orage
  if (!storm) {
    const sun = celestialPos();
    const halo = raining ? 0.18 : 0.35;
    ctx.fillStyle = "rgba(255,250,180," + halo + ")";
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = raining ? "rgba(255,250,210,0.75)" : "#fff2a0";
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 36, 0, Math.PI * 2); ctx.fill();
  }

  drawClouds(storm ? "rgba(90,100,90,0.9)" : raining ? "rgba(220,225,210,0.85)" : "rgba(255,255,255,0.9)");

  // tribunes
  drawCrowd();

  // clôture en bois au loin (remplace la mer/le lac des autres terrains)
  ctx.strokeStyle = storm ? "#5a4530" : "#7a5c3c";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y - 46); ctx.lineTo(W, GROUND_Y - 46); ctx.stroke();
  ctx.lineWidth = 3;
  for (let px = 20; px < W; px += 70) {
    ctx.beginPath(); ctx.moveTo(px, GROUND_Y - 58); ctx.lineTo(px, GROUND_Y - 36); ctx.stroke();
  }

  // herbe : vive par beau temps, sombre et terne sous la pluie
  const grass = ctx.createLinearGradient(0, GROUND_Y - 38, 0, H);
  if (raining) { grass.addColorStop(0, "#5a7a3e"); grass.addColorStop(1, "#425c2c"); }
  else { grass.addColorStop(0, "#7ed957"); grass.addColorStop(1, "#5aab3c"); }
  ctx.fillStyle = grass;
  ctx.fillRect(0, GROUND_Y - 37, W, H - GROUND_Y + 37);
  if (raining) {
    // flaques luisantes sur l'herbe détrempée
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(0, GROUND_Y, W, 6);
  }
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, GROUND_Y, W, 2);

  // brins d'herbe (positions fixes, purement décoratif) qui se penchent
  ctx.strokeStyle = raining ? "rgba(30,50,15,0.5)" : "rgba(40,90,20,0.45)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 50; i++) {
    const gx = (i * 173.3) % W;
    const gy = GROUND_Y + 3 + (i * 31.1) % (H - GROUND_Y - 8);
    const lean = Math.sin(t * 2 + i) * 2;
    ctx.beginPath(); ctx.moveTo(gx, gy + 5); ctx.lineTo(gx + lean, gy - 3); ctx.stroke();
  }

  // trèfles à trois feuilles, éparpillés dans l'herbe
  ctx.fillStyle = raining ? "#4a6a34" : "#5fae3f";
  for (let i = 0; i < 10; i++) {
    const cx2 = (i * 251.7) % W;
    const cy2 = GROUND_Y + 8 + (i * 47.3) % (H - GROUND_Y - 14);
    for (const [ox, oy] of [[-2.5, 0], [2.5, 0], [0, -2.5]]) {
      ctx.beginPath(); ctx.ellipse(cx2 + ox, cy2 + oy, 2.2, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawCarrotPatch(60, storm);
  drawHayBale(W - 60);
  drawButterflies();
  if (raining) drawRain(storm ? 1 : 0.55);
}

// touffe de carottes plantées dans l'herbe — clin d'œil à Turbo-Jeannot
function drawCarrotPatch(px, storm) {
  const t = performance.now() / 1000;
  const sway = Math.sin(t * (storm ? 3 : 1)) * (storm ? 4 : 1.5);
  for (const [ox, h] of [[-14, 26], [-4, 32], [8, 24], [16, 30]]) {
    const topX = px + ox + sway, topY = GROUND_Y - 34 - h;
    ctx.strokeStyle = "#2e7d32";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (const spread of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(px + ox, GROUND_Y - 34);
      ctx.quadraticCurveTo(px + ox + spread * 0.5 + sway * 0.5, topY + 8, topX + spread, topY);
      ctx.stroke();
    }
    // petit sommet de carotte affleurant (orange)
    ctx.fillStyle = "#ff9800";
    ctx.beginPath();
    ctx.moveTo(px + ox - 4, GROUND_Y - 34);
    ctx.lineTo(px + ox + 4, GROUND_Y - 34);
    ctx.lineTo(px + ox, GROUND_Y - 26);
    ctx.closePath();
    ctx.fill();
  }
}

// botte de foin ronde, décorative
function drawHayBale(px) {
  const py = GROUND_Y - 24;
  ctx.fillStyle = "#d4a843";
  ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(120,85,20,0.5)";
  ctx.lineWidth = 2;
  for (const a of [-0.6, 0, 0.6]) {
    ctx.beginPath();
    ctx.arc(px, py, 26, Math.PI * 0.5 + a - 0.25, Math.PI * 0.5 + a + 0.25);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(120,85,20,0.7)";
  ctx.beginPath(); ctx.moveTo(px - 26, py); ctx.lineTo(px + 26, py); ctx.stroke();
}

// ---------- Manoir hanté (Scooby) ----------
function drawBgManoir() {
  const t = performance.now() / 1000;
  const rainy = weather === "rain" || weather === "storm";
  const stormy = weather === "storm";

  // ciel violet-nuit
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  if (stormy) { sky.addColorStop(0, "#0a0614"); sky.addColorStop(1, "#1a1230"); }
  else { sky.addColorStop(0, "#1a0f2e"); sky.addColorStop(1, "#3a2a55"); }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // étoiles timides
  const starA = rainy ? 0.2 : 0.7;
  for (let i = 0; i < 40; i++) {
    const sxx = (i * 139.1) % W;
    const syy = (i * 71.3) % (GROUND_Y - 160);
    ctx.globalAlpha = (0.3 + Math.abs(Math.sin(t * 1.2 + i)) * 0.5) * starA;
    ctx.fillStyle = "#e8e0ff";
    ctx.beginPath();
    ctx.arc(sxx, syy, i % 6 === 0 ? 1.6 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // lune jaunâtre voilée
  const moon = celestialPos();
  ctx.fillStyle = "rgba(255,230,160,0.15)";
  ctx.beginPath(); ctx.arc(moon.x, moon.y, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rainy ? "rgba(230,210,150,0.55)" : "#f5e6b8";
  ctx.beginPath(); ctx.arc(moon.x, moon.y, 28, 0, Math.PI * 2); ctx.fill();

  if (rainy) drawClouds(stormy ? "rgba(30,25,45,0.95)" : "rgba(55,45,75,0.88)");

  // collines sombres
  drawHillLayer(GROUND_Y - 100, "#1a1528", 0.1,
    [[80, GROUND_Y - 140], [280, GROUND_Y - 110], [500, GROUND_Y - 150], [720, GROUND_Y - 115], [880, GROUND_Y - 135]]);
  drawHillLayer(GROUND_Y - 85, "#221c35", 0.28,
    [[160, GROUND_Y - 115], [400, GROUND_Y - 95], [620, GROUND_Y - 125], [820, GROUND_Y - 100]]);

  drawHauntedManor(W * 0.28, GROUND_Y - 38, t, stormy);
  drawDeadTrees();
  drawGravestones();
  drawCrowd();
  drawMysteryMachine(W * 0.78, GROUND_Y - 8, t);

  // sol : terre sombre / herbe morte
  const ground = ctx.createLinearGradient(0, GROUND_Y - 38, 0, H);
  ground.addColorStop(0, rainy ? "#3a3830" : "#4a4638");
  ground.addColorStop(1, "#2a2820");
  ctx.fillStyle = ground;
  ctx.fillRect(0, GROUND_Y - 37, W, H - GROUND_Y + 37);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0, GROUND_Y, W, 2);

  // brins d'herbes mortes
  ctx.strokeStyle = "rgba(80,70,40,0.45)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 36; i++) {
    const gx = (i * 181.3) % W;
    const gy = GROUND_Y + 4 + (i * 29.7) % (H - GROUND_Y - 10);
    const lean = Math.sin(t * 1.5 + i) * 2.5;
    ctx.beginPath(); ctx.moveTo(gx, gy + 4); ctx.lineTo(gx + lean, gy - 4); ctx.stroke();
  }

  // lucioles vertes « fantômes » par temps clair
  if (!rainy) {
    for (let i = 0; i < 6; i++) {
      let fx = W / 2 + Math.sin(t * (0.25 + i * 0.06) + i * 2) * (W * 0.4);
      let fy = GROUND_Y - 50 - Math.abs(Math.sin(t * (0.4 + i * 0.08) + i)) * 100;
      const a = 0.25 + Math.abs(Math.sin(t * 2.2 + i)) * 0.55;
      ctx.fillStyle = "rgba(120,255,160," + (a * 0.2).toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(fx, fy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(160,255,180," + a.toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    drawFog(stormy ? 1 : 0.6);
  }
}

function drawHauntedManor(cx, baseY, t, stormy) {
  const flash = stormy && ((t % 3.2) < 0.08 || ((t % 3.2) > 0.14 && (t % 3.2) < 0.2));
  // corps principal
  ctx.fillStyle = "#2a2438";
  ctx.fillRect(cx - 90, baseY - 130, 180, 130);
  // ailes
  ctx.fillStyle = "#241e32";
  ctx.fillRect(cx - 140, baseY - 95, 55, 95);
  ctx.fillRect(cx + 85, baseY - 110, 60, 110);
  // toits pointus
  ctx.fillStyle = "#1a1524";
  ctx.beginPath();
  ctx.moveTo(cx - 100, baseY - 130);
  ctx.lineTo(cx, baseY - 190);
  ctx.lineTo(cx + 100, baseY - 130);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 145, baseY - 95);
  ctx.lineTo(cx - 112, baseY - 140);
  ctx.lineTo(cx - 80, baseY - 95);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 80, baseY - 110);
  ctx.lineTo(cx + 115, baseY - 165);
  ctx.lineTo(cx + 150, baseY - 110);
  ctx.closePath();
  ctx.fill();
  // tour
  ctx.fillStyle = "#2e273c";
  ctx.fillRect(cx + 95, baseY - 175, 28, 70);
  ctx.beginPath();
  ctx.moveTo(cx + 90, baseY - 175);
  ctx.lineTo(cx + 109, baseY - 210);
  ctx.lineTo(cx + 128, baseY - 175);
  ctx.closePath();
  ctx.fill();
  // fenêtres verdâtres (clignotent un peu)
  const winCol = flash ? "rgba(220,255,200,0.85)" : "rgba(140,220,120," + (0.35 + Math.abs(Math.sin(t * 2)) * 0.35).toFixed(2) + ")";
  ctx.fillStyle = winCol;
  for (const [wx, wy, ww, wh] of [
    [cx - 60, baseY - 105, 18, 22], [cx - 20, baseY - 105, 18, 22], [cx + 25, baseY - 105, 18, 22],
    [cx - 55, baseY - 60, 16, 20], [cx + 5, baseY - 60, 16, 20], [cx + 40, baseY - 60, 16, 20],
    [cx - 125, baseY - 70, 14, 18], [cx + 100, baseY - 80, 14, 18], [cx + 100, baseY - 155, 12, 14]
  ]) {
    ctx.fillRect(wx, wy, ww, wh);
  }
  // porte
  ctx.fillStyle = "#1a1420";
  ctx.fillRect(cx - 18, baseY - 48, 36, 48);
  ctx.strokeStyle = "#3a3048";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 18, baseY - 48, 36, 48);
  ctx.fillStyle = "#c9a84a";
  ctx.beginPath(); ctx.arc(cx + 10, baseY - 24, 2.5, 0, Math.PI * 2); ctx.fill();
  // chauves-souris
  ctx.strokeStyle = "rgba(20,15,30,0.85)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    const bx = cx - 40 + i * 45 + Math.sin(t * 2 + i) * 30;
    const by = baseY - 200 - Math.abs(Math.sin(t * 3 + i * 1.3)) * 25;
    const flap = Math.sin(t * 10 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(bx - 8, by + flap);
    ctx.quadraticCurveTo(bx - 3, by - 3, bx, by);
    ctx.quadraticCurveTo(bx + 3, by - 3, bx + 8, by + flap);
    ctx.stroke();
  }
}

function drawDeadTrees() {
  const t = performance.now() / 1000;
  ctx.strokeStyle = "#1e1830";
  ctx.lineCap = "round";
  for (const [tx, th] of [[55, 70], [W - 50, 80]]) {
    const sway = Math.sin(t * 0.8 + tx) * 3;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(tx, GROUND_Y - 36);
    ctx.quadraticCurveTo(tx + sway, GROUND_Y - 36 - th * 0.5, tx + sway * 1.2, GROUND_Y - 36 - th);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    for (const [ang, len] of [[-0.7, 22], [0.5, 18], [-0.2, 14]]) {
      const tipX = tx + sway * 1.2 + Math.cos(ang - Math.PI / 2) * len;
      const tipY = GROUND_Y - 36 - th + 10 + Math.sin(ang - Math.PI / 2) * len;
      ctx.beginPath();
      ctx.moveTo(tx + sway * 0.8, GROUND_Y - 36 - th + 18);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }
  }
}

function drawGravestones() {
  ctx.fillStyle = "#3a3848";
  for (const [gx, gh] of [[120, 22], [155, 18], [W - 140, 20]]) {
    ctx.beginPath();
    ctx.moveTo(gx - 10, GROUND_Y - 36);
    ctx.lineTo(gx - 10, GROUND_Y - 36 - gh);
    ctx.arc(gx, GROUND_Y - 36 - gh, 10, Math.PI, 0);
    ctx.lineTo(gx + 10, GROUND_Y - 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(gx - 4, GROUND_Y - 36 - gh + 4, 8, 3);
    ctx.fillStyle = "#3a3848";
  }
}

// Mystery Machine : van bleu/vert fleuri (clin d'œil Scooby-Doo)
function drawMysteryMachine(px, py, t) {
  const bob = Math.sin(t * 1.5) * 0.6;
  const y = py + bob;
  ctx.save();
  // ombre
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(px, GROUND_Y - 34, 52, 6, 0, 0, Math.PI * 2); ctx.fill();

  // caisse principale (turquoise)
  ctx.fillStyle = "#3d9e9a";
  ctx.beginPath();
  ctx.moveTo(px - 55, y - 18);
  ctx.lineTo(px - 55, y - 48);
  ctx.quadraticCurveTo(px - 50, y - 62, px - 30, y - 64);
  ctx.lineTo(px + 35, y - 64);
  ctx.quadraticCurveTo(px + 55, y - 62, px + 58, y - 48);
  ctx.lineTo(px + 58, y - 18);
  ctx.closePath();
  ctx.fill();

  // bande orange basse
  ctx.fillStyle = "#e07a2a";
  ctx.fillRect(px - 55, y - 28, 113, 10);

  // portes / flancs verts
  ctx.fillStyle = "#2f7a48";
  ctx.fillRect(px - 20, y - 52, 38, 24);
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(px - 20, y - 52, 38, 24);

  // fleurs hippies
  for (const [fx, fy, col] of [[px - 40, y - 40, "#f0c94a"], [px + 42, y - 38, "#e85d8a"], [px + 8, y - 58, "#f0c94a"]]) {
    ctx.fillStyle = col;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(fx + Math.cos(a) * 4, fy + Math.sin(a) * 4, 3.2, 2.2, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff8c8";
    ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  // pare-brise
  ctx.fillStyle = "rgba(180,220,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(px - 48, y - 48);
  ctx.lineTo(px - 30, y - 60);
  ctx.lineTo(px - 8, y - 60);
  ctx.lineTo(px - 8, y - 48);
  ctx.closePath();
  ctx.fill();

  // phares
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath(); ctx.arc(px - 52, y - 24, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + 54, y - 24, 3.5, 0, Math.PI * 2); ctx.fill();

  // roues
  for (const wx of [px - 32, px + 32]) {
    ctx.fillStyle = "#222";
    ctx.beginPath(); ctx.arc(wx, y - 12, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#888";
    ctx.beginPath(); ctx.arc(wx, y - 12, 5, 0, Math.PI * 2); ctx.fill();
  }

  // antenne
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + 20, y - 64);
  ctx.lineTo(px + 20 + Math.sin(t * 3) * 3, y - 78);
  ctx.stroke();
  ctx.fillStyle = "#e85d8a";
  ctx.beginPath();
  ctx.arc(px + 20 + Math.sin(t * 3) * 3, y - 78, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- Terrains Belzébuth (mode caché) ----------
function drawBgEnfer() {
  const t = performance.now() / 1000;
  const storm = weather === "storm";
  const active = weather === "rain" || storm; // éruption plus intense

  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#0a0000");
  sky.addColorStop(1, active ? "#5a0f0f" : "#3a0808");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // lueur pulsante (soleil infernal)
  const pulse = 0.5 + Math.sin(t * (storm ? 3 : 1.2)) * 0.25;
  const glow = ctx.createRadialGradient(W / 2, 70, 10, W / 2, 70, 170);
  glow.addColorStop(0, "rgba(255,90,20," + (0.55 * pulse).toFixed(2) + ")");
  glow.addColorStop(1, "rgba(255,90,20,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, GROUND_Y);

  drawHillLayer(GROUND_Y - 100, "#1a0505", 0.12,
    [[100, GROUND_Y - 150], [260, GROUND_Y - 190], [420, GROUND_Y - 140], [600, GROUND_Y - 200], [800, GROUND_Y - 150]]);
  drawHillLayer(GROUND_Y - 90, "#2a0808", 0.3,
    [[170, GROUND_Y - 120], [370, GROUND_Y - 160], [560, GROUND_Y - 110], [770, GROUND_Y - 150]]);

  drawCrowd();

  // rivière de lave au loin
  ctx.fillStyle = "#7a1a00";
  ctx.fillRect(0, GROUND_Y - 55, W, 18);
  ctx.fillStyle = "rgba(255,160,40,0.5)";
  for (let i = 0; i < 6; i++) {
    const lx = (i * 160 + Math.sin(t + i) * 20 + W) % W;
    ctx.fillRect(lx, GROUND_Y - 54, 30, 3);
  }

  // croûte noire fissurée, lueur orange dans les fissures
  ctx.fillStyle = "#120404";
  ctx.fillRect(0, GROUND_Y - 37, W, H - GROUND_Y + 37);
  ctx.strokeStyle = "rgba(255,110,30,0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const cx2 = (i * 97.3) % W, cy2 = GROUND_Y + 6 + (i * 23) % (H - GROUND_Y - 10);
    ctx.globalAlpha = 0.4 + Math.abs(Math.sin(t * 2 + i)) * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx2 - 14, cy2); ctx.lineTo(cx2, cy2 - 4); ctx.lineTo(cx2 + 14, cy2 + 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // braises montantes
  ctx.fillStyle = "#ff6a2e";
  for (let i = 0; i < 40; i++) {
    const cyc = (t * (30 + (i % 7) * 8) + i * 41) % (H + 40);
    const ex = (i * 67.7) % W + Math.sin(t * 1.6 + i) * 10;
    const ey = H - cyc;
    ctx.globalAlpha = Math.max(0, 1 - cyc / (H + 40)) * 0.85;
    ctx.beginPath(); ctx.arc(ex, ey, 1.4 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawSkullPole(60);
  if (storm) {
    const cyc = t % 2.4;
    if (cyc < 0.08) { ctx.fillStyle = "rgba(255,60,20,0.35)"; ctx.fillRect(0, 0, W, GROUND_Y); }
  }
}

function drawSkullPole(px) {
  const baseY = GROUND_Y - 4;
  ctx.strokeStyle = "#3a1a10"; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(px, baseY); ctx.lineTo(px, baseY - 90); ctx.stroke();
  ctx.fillStyle = "#e8e2d0";
  ctx.beginPath(); ctx.arc(px, baseY - 104, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1a0a05";
  ctx.beginPath(); ctx.arc(px - 5, baseY - 106, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px + 5, baseY - 106, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(px - 3, baseY - 98, 6, 5);
}

function drawBgStyx() {
  const t = performance.now() / 1000;
  const foggy = weather === "rain" || weather === "storm";

  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#0a1208");
  sky.addColorStop(1, foggy ? "#233a1e" : "#162412");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  const mx = W * 0.8, my = 90;
  ctx.fillStyle = "rgba(150,255,140,0.18)";
  ctx.beginPath(); ctx.arc(mx, my, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9fce7a";
  ctx.beginPath(); ctx.arc(mx, my, 30, 0, Math.PI * 2); ctx.fill();

  drawHillLayer(GROUND_Y - 95, "#0d160a", 0.12,
    [[110, GROUND_Y - 140], [300, GROUND_Y - 110], [500, GROUND_Y - 150], [700, GROUND_Y - 115], [850, GROUND_Y - 140]]);
  drawHillLayer(GROUND_Y - 82, "#131f0e", 0.3,
    [[180, GROUND_Y - 112], [380, GROUND_Y - 96], [580, GROUND_Y - 118], [790, GROUND_Y - 100]]);

  drawCrowd();

  // le Styx : eau sombre, reflet verdâtre de la lune
  ctx.fillStyle = "#0c1a10";
  ctx.fillRect(0, GROUND_Y - 55, W, 18);
  ctx.fillStyle = "rgba(150,255,140,0.12)";
  for (let i = 0; i < 5; i++) {
    const rw = 26 - i * 4;
    ctx.fillRect(mx - rw / 2 + Math.sin(t * 2 + i) * 6, GROUND_Y - 54 + i * 3.4, rw, 2);
  }

  // rive boueuse
  const mud = ctx.createLinearGradient(0, GROUND_Y - 38, 0, H);
  mud.addColorStop(0, "#2a2314");
  mud.addColorStop(1, "#181206");
  ctx.fillStyle = mud;
  ctx.fillRect(0, GROUND_Y - 37, W, H - GROUND_Y + 37);

  drawDeadTree(60);
  drawDeadTree(840);

  // feux follets
  for (let i = 0; i < 6; i++) {
    const fx = W / 2 + Math.sin(t * (0.3 + i * 0.07) + i * 2.4) * (W * 0.42);
    const fy = GROUND_Y - 70 - Math.abs(Math.sin(t * (0.5 + i * 0.1) + i)) * 100;
    const a = 0.35 + Math.abs(Math.sin(t * 2 + i * 1.7)) * 0.65;
    ctx.fillStyle = "rgba(150,255,140," + (a * 0.25).toFixed(2) + ")";
    ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(190,255,170," + a.toFixed(2) + ")";
    ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
  }

  if (foggy) {
    ctx.fillStyle = "rgba(180,220,180,0.08)";
    for (let i = 0; i < 3; i++) {
      const fy2 = GROUND_Y - 10 - i * 8;
      ctx.beginPath();
      ctx.ellipse(((t * 20 + i * 300) % (W + 200)) - 100, fy2, 160, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawDeadTree(px) {
  ctx.strokeStyle = "#1a1508"; ctx.lineWidth = 7; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(px, GROUND_Y - 6); ctx.lineTo(px - 4, GROUND_Y - 70); ctx.stroke();
  ctx.lineWidth = 4;
  for (const [dx, dy, ang] of [[-4, -70, -0.6], [-4, -70, 0.5], [-10, -50, -0.9]]) {
    ctx.beginPath();
    ctx.moveTo(px + dx, GROUND_Y + dy);
    ctx.lineTo(px + dx + Math.cos(ang) * 30, GROUND_Y + dy + Math.sin(ang) * 30 - 10);
    ctx.stroke();
  }
}

function drawNet() {
  // ombre au sol du poteau
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(NET_X + 6, GROUND_Y + 4, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // poteau en dégradé (effet de volume)
  const pg = ctx.createLinearGradient(NET_X - NET_W / 2, 0, NET_X + NET_W / 2, 0);
  pg.addColorStop(0, "#a1887f");
  pg.addColorStop(0.45, "#8d6e63");
  pg.addColorStop(1, "#5d4037");
  ctx.fillStyle = pg;
  ctx.fillRect(NET_X - NET_W / 2, NET_TOP, NET_W, GROUND_Y - NET_TOP);
  // maille croisée
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  for (let y = NET_TOP + 10; y < GROUND_Y - 4; y += 12) {
    ctx.beginPath();
    ctx.moveTo(NET_X - NET_W / 2 + 1, y);
    ctx.lineTo(NET_X + NET_W / 2 - 1, y + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(NET_X + NET_W / 2 - 1, y);
    ctx.lineTo(NET_X - NET_W / 2 + 1, y + 6);
    ctx.stroke();
  }
  // pommeau brillant
  const kg = ctx.createRadialGradient(NET_X - 2, NET_TOP - 2, 1, NET_X, NET_TOP, NET_W / 2 + 4);
  kg.addColorStop(0, "#8d6e63");
  kg.addColorStop(1, "#4e342e");
  ctx.fillStyle = kg;
  ctx.beginPath(); ctx.arc(NET_X, NET_TOP, NET_W / 2 + 3, 0, Math.PI * 2); ctx.fill();
}

// ---------- Mode Bombe : dessin de la bombe ----------
function drawBomb() {
  const frac = Math.max(0, bombTimer) / (bombTime || BOMB_TIME); // 1 (pleine) → 0 (explosion)
  const danger = 1 - frac;
  const now = performance.now();

  // fumée de la mèche (réutilise la traînée de la balle)
  for (let i = 0; i < ball.trail.length; i++) {
    const t = ball.trail[i];
    const f = (i + 1) / ball.trail.length;
    ctx.fillStyle = "rgba(120,120,130," + (f * 0.18).toFixed(3) + ")";
    ctx.beginPath(); ctx.arc(t.x, t.y - BALL_R, BALL_R * (0.4 + f * 0.5), 0, Math.PI * 2); ctx.fill();
  }

  // ombre au sol
  const shScale = Math.max(0.3, 1 - (GROUND_Y - ball.y) / 400);
  ctx.fillStyle = "rgba(0,0,0," + (0.3 * shScale) + ")";
  ctx.beginPath();
  ctx.ellipse(ball.x, GROUND_Y + 6, BALL_R * shScale + 5, 5 * shScale + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // halo de danger rouge pulsé : de plus en plus rapide et large
  const pulse = 0.5 + 0.5 * Math.sin(now / (90 - danger * 66));
  const haloR = BALL_R + 6 + pulse * (4 + danger * 12);
  ctx.fillStyle = "rgba(255,50,40," + (0.12 + danger * 0.3 * pulse).toFixed(3) + ")";
  ctx.beginPath(); ctx.arc(ball.x, ball.y, haloR, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.angle * 0.4);
  // corps : sphère métallique sombre. Vire au rouge et clignote en fin de mèche.
  const flashRed = frac < 0.25 && Math.floor(now / 120) % 2 === 0;
  const bgrad = ctx.createRadialGradient(-4, -5, 2, 0, 0, BALL_R + 2);
  bgrad.addColorStop(0, flashRed ? "#ff6a5a" : "#5a5f6b");
  bgrad.addColorStop(0.6, flashRed ? "#c62a1c" : "#2b2f38");
  bgrad.addColorStop(1, flashRed ? "#7d160c" : "#15171c");
  ctx.fillStyle = bgrad;
  ctx.beginPath(); ctx.arc(0, 0, BALL_R + 1, 0, Math.PI * 2); ctx.fill();
  // reflet
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath(); ctx.ellipse(-5, -6, 3.5, 2.2, -0.6, 0, Math.PI * 2); ctx.fill();

  // embout (col) au sommet
  ctx.fillStyle = "#3a3d45";
  ctx.fillRect(-4, -BALL_R - 5, 8, 6);
  ctx.restore();

  // mèche + étincelle (repère fixe au sommet de la bombe)
  const capX = ball.x, capY = ball.y - BALL_R - 5;
  ctx.strokeStyle = "#8a6b3a";
  ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(capX, capY);
  ctx.quadraticCurveTo(capX + 8, capY - 10, capX + 3, capY - 18);
  ctx.stroke();
  // étincelle : scintille et grossit à mesure que la mèche se consume
  const sx = capX + 3, sy = capY - 18;
  const spark = 3 + danger * 3 + Math.random() * 2;
  ctx.fillStyle = "#fff3b0";
  ctx.beginPath(); ctx.arc(sx, sy, spark * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,150,0," + (0.6 + Math.random() * 0.4).toFixed(2) + ")";
  ctx.beginPath(); ctx.arc(sx, sy, spark, 0, Math.PI * 2); ctx.fill();
  // petites braises
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "rgba(255," + (120 + ((Math.random() * 120) | 0)) + ",0,0.9)";
    ctx.beginPath();
    ctx.arc(sx + (Math.random() - 0.5) * 10, sy - Math.random() * 8, 1 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBall() {
  // balle crevée : galette flasque dégonflée, sans traînée
  if (ball.popped) {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.fillStyle = "#e0b400";
    ctx.beginPath();
    ctx.ellipse(0, BALL_R * 0.4, BALL_R * 1.1, BALL_R * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b58a00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, BALL_R * 0.4, BALL_R * 1.1, BALL_R * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // petits plis
    ctx.beginPath(); ctx.moveTo(-BALL_R * 0.6, BALL_R * 0.4); ctx.lineTo(-BALL_R * 0.2, BALL_R * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(BALL_R * 0.5, BALL_R * 0.4); ctx.lineTo(BALL_R * 0.15, BALL_R * 0.15); ctx.stroke();
    ctx.restore();
    return;
  }
  // mode bombe : la balle est une bombe à mèche
  if (bombMode) { drawBomb(); return; }
  // traînée (enflammée pendant un smash destructeur)
  const fiery = ball.smash > 0;
  for (let i = 0; i < ball.trail.length; i++) {
    const t = ball.trail[i];
    const f = (i + 1) / ball.trail.length;
    ctx.fillStyle = fiery
      ? "rgba(255," + Math.floor(60 + f * 120) + ",0," + (f * 0.5).toFixed(2) + ")"
      : "rgba(255,204,0," + (f * 0.15).toFixed(3) + ")";
    ctx.beginPath(); ctx.arc(t.x, t.y, BALL_R * (0.5 + f * (fiery ? 0.8 : 0.5)), 0, Math.PI * 2); ctx.fill();
  }
  if (fiery) {
    // halo de feu autour de la balle
    ctx.fillStyle = "rgba(255,120,0,0.35)";
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R + 7, 0, Math.PI * 2); ctx.fill();
  }
  // lignes de vitesse quand la balle fuse (lecture de la vélocité → visuel pur)
  const bspd = Math.hypot(ball.vx, ball.vy);
  if (!ball.frozen && bspd > 9) {
    const inten = Math.min(1, (bspd - 9) / 12);
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(Math.atan2(ball.vy, ball.vx));
    ctx.strokeStyle = fiery ? "rgba(255,150,40," + (0.55 * inten).toFixed(2) + ")"
                            : "rgba(255,255,255," + (0.42 * inten).toFixed(2) + ")";
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      const off = i * (BALL_R * 0.55);
      const len = 16 + inten * 26;
      ctx.lineWidth = 2.4 - Math.abs(i) * 0.7;
      ctx.beginPath();
      ctx.moveTo(-BALL_R - 2, off);
      ctx.lineTo(-BALL_R - 2 - len, off * 1.35);
      ctx.stroke();
    }
    ctx.restore();
  }
  // ombre
  const shScale = Math.max(0.3, 1 - (GROUND_Y - ball.y) / 400);
  ctx.fillStyle = "rgba(0,0,0," + (0.25 * shScale) + ")";
  ctx.beginPath();
  ctx.ellipse(ball.x, GROUND_Y + 6, BALL_R * shScale + 4, 5 * shScale + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.angle);
  // volume : dégradé radial éclairé en haut-gauche + liseré
  const bgrad = ctx.createRadialGradient(-4, -5, 2, 0, 0, BALL_R);
  bgrad.addColorStop(0, "#ffe98a");
  bgrad.addColorStop(0.65, "#ffcc00");
  bgrad.addColorStop(1, "#dfa300");
  ctx.fillStyle = bgrad;
  ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#c78f00";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, BALL_R - 0.5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#e6a800";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, BALL_R - 1, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, BALL_R - 1, BALL_R * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, BALL_R * 0.45, BALL_R - 1, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath(); ctx.arc(-4, -5, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// bandeau du mode bombe : compte à rebours central + camp en danger
function drawBombHUD() {
  // voile rouge pulsé sur la moitié de terrain où se trouve la bombe
  if (state === "play" && !ball.frozen && !ball.popped) {
    const low = bombTimer <= 180;
    const p = 0.10 + 0.10 * (0.5 + 0.5 * Math.sin(performance.now() / (low ? 80 : 220)));
    const gx = ball.x < NET_X ? 0 : NET_X;
    const g = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y - 160);
    g.addColorStop(0, "rgba(255,40,40," + p.toFixed(3) + ")");
    g.addColorStop(1, "rgba(255,40,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(gx, GROUND_Y - 160, NET_X, 160);
  }
  const secs = Math.max(0, Math.ceil(bombTimer / 60));
  const frac = Math.max(0, bombTimer) / (bombTime || BOMB_TIME);
  const low = bombTimer <= 180;
  const col = frac > 0.5 ? "#7ed957" : frac > 0.25 ? "#ffcc00" : "#ff4030";
  const blink = low && Math.floor(performance.now() / 140) % 2 === 0;
  ctx.save();
  const bx = NET_X - 56, by = 18, bw = 112, bh = 44;
  ctx.fillStyle = "rgba(10,12,18,0.72)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 8);
  else ctx.rect(bx, by, bw, bh);
  ctx.fill();
  ctx.strokeStyle = blink ? "#fff" : col;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = blink ? "#fff" : col;
  ctx.font = "800 24px " + (typeof UI !== "undefined" ? UI.sans : "'Inter', system-ui, sans-serif");
  ctx.fillText(secs + "s", NET_X, by + 32);
  ctx.restore();
}

function drawHUD() {
  // mode bombe : éclair d'explosion plein écran (visuel, se résorbe au rendu)
  if (bombFlash > 0) {
    ctx.fillStyle = "rgba(255,240,205," + (bombFlash * 0.6).toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);
    bombFlash *= 0.8;
    if (bombFlash < 0.02) bombFlash = 0;
  }
  if (bombMode && (state === "play" || state === "serve")) drawBombHUD();

  // ---- tableau de score : UN panneau plein par camp (label, chiffre,
  // touches, jauge de combo) — plutôt que des éléments séparés dont certains
  // flottaient nus sur le décor (illisibles dès que le fond était clair).
  const MONO = "'Space Mono', ui-monospace, monospace";
  const SANS = "'Inter', system-ui, sans-serif";
  const sideLbl = s => (mode === "2v2" ? (s === 0 ? "ÉQUIPE 1" : "ÉQUIPE 2") : sideLabel(s)).toUpperCase();
  for (const s of [0, 1]) {
    const cx = s === 0 ? W * 0.25 : W * 0.75;
    const col = sideColor(s);
    // panneau plein (assez opaque pour rester lisible sur n'importe quel
    // terrain/ciel derrière, clair ou sombre)
    ctx.fillStyle = "rgba(10,12,18,0.6)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - 68, 14, 136, 112, 12);
    else ctx.rect(cx - 68, 14, 136, 112);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.stroke();
    // label mono (toujours blanc plein, jamais une teinte qui pourrait se
    // fondre dans le panneau sombre)
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 10px " + MONO;
    ctx.save(); try { ctx.letterSpacing = "2px"; } catch (e) {}
    ctx.fillText(sideLbl(s), cx, 32);
    ctx.restore();
    // chiffre (Inter 900, grossit sur un point marqué)
    ctx.fillStyle = col;
    ctx.font = "900 " + (30 + scorePop[s] * 1.0) + "px " + SANS;
    ctx.fillText(scores[s], cx, 62);
    if (scorePop[s] > 0) scorePop[s]--;
  }
  // séparateur central mono
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "700 12px " + MONO;
  ctx.fillText("VS", NET_X, 46);

  // indicateur de touches (petits points, dans le panneau)
  for (const side of [0, 1]) {
    const baseX = side === 0 ? W * 0.25 - 24 : W * 0.75 - 24;
    for (let i = 0; i < MAX_TOUCHES; i++) {
      ctx.beginPath();
      ctx.arc(baseX + i * 24, 84, 5, 0, Math.PI * 2);
      ctx.fillStyle = i < ball.touches[side] ? sideColor(side) : "rgba(255,255,255,0.35)";
      ctx.fill();
    }
  }

  // jauges de SUPER (combo) dans le panneau, sous les touches
  for (const s of [0, 1]) {
    const cx = s === 0 ? W * 0.25 : W * 0.75;
    const col = sideColor(s);
    const bw = 108, bx = cx - bw / 2, by = 98;
    const ready = superCharge[s] === 1;
    const frac = ready ? 1 : (streak[s] % SUPER_NEED) / SUPER_NEED;
    // cadre
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
    // remplissage
    if (ready) {
      const t = performance.now() / 300;
      ctx.fillStyle = (Math.sin(t * 6) > 0) ? "#ffd93d" : "#fff2a0";
    } else ctx.fillStyle = col;
    ctx.fillRect(bx, by, bw * frac, 7);
    // libellé mono — toujours blanc plein (85%), jamais une teinte pâle qui
    // pourrait se fondre dans le fond du panneau
    ctx.textAlign = "center";
    if (ready) {
      ctx.fillStyle = "#ffd93d";
      ctx.font = "700 10px " + MONO;
      ctx.fillText("SUPER — " + (s === 0 ? "S" : "↓"), cx, by + 22);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "700 10px " + MONO;
      ctx.fillText("COMBO " + (streak[s] % SUPER_NEED) + "/" + SUPER_NEED, cx, by + 22);
    }
  }

  // message flash de SUPER
  if (superFlashT > 0 && superFlash) {
    ctx.textAlign = "center";
    ctx.globalAlpha = Math.min(1, superFlashT / 12);
    ctx.fillStyle = "#ffd93d";
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 4; ctx.lineJoin = "round";
    ctx.font = "bold 34px 'Inter', system-ui, sans-serif";
    ctx.strokeText(superFlash, NET_X, 150);
    ctx.fillText(superFlash, NET_X, 150);
    ctx.globalAlpha = 1;
  }

  // balle de match — liseré sombre systématique : sans lui, la couleur de
  // l'animal (pas toujours claire) peut se fondre dans le décor.
  if (state === "play" || state === "serve") {
    for (const s of [0, 1]) {
      if (scores[s] >= WIN_SCORE - 1 && scores[s] - scores[1 - s] >= 1) {
        const txt = "★ Balle de match — " + sideLabel(s) + " ★";
        ctx.textAlign = "center";
        ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
        ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
        ctx.strokeText(txt, NET_X, 128);
        ctx.fillStyle = sideColor(s);
        ctx.fillText(txt, NET_X, 128);
      }
    }
  }

  // décompte avant service, puis invite de service — fond plein arrondi
  // systématique : jamais de texte flottant nu directement sur le décor
  // (illisible dès que le fond est clair ou que sa couleur varie).
  if (state === "serve" && serveCountdown > 0) {
    const n = Math.ceil((serveCountdown - 6) / 21); // 3 → 2 → 1 → (GO)
    const label = n <= 0 ? "GO !" : String(n);
    ctx.textAlign = "center";
    const bw = n <= 0 ? 220 : 140, bh = 110, bx = NET_X - bw / 2, by = H / 2 - 70;
    ctx.fillStyle = "rgba(10,12,18,0.6)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 18); else ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 88px 'Inter', system-ui, sans-serif";
    ctx.fillText(label, NET_X, H / 2 + 20);
  } else if (state === "serve") {
    const txt = "Service : " + sideLabel(servingSide) + " — touchez la balle !";
    ctx.textAlign = "center";
    ctx.font = "700 17px 'Inter', system-ui, sans-serif";
    const tw = ctx.measureText(txt).width;
    // sous les panneaux de score (qui vont jusqu'à y=126) : avec le nom de
    // l'animal (souvent plus long que "Gauche"/"Droite"), la pastille est
    // parfois plus large qu'eux — la garder plus haut la faisait chevaucher.
    const pw = tw + 36, ph = 34, px = NET_X - pw / 2, py = 134;
    // pastille pleine (au lieu de texte nu semi-transparent) : lisible sur
    // n'importe quel terrain/ciel, clair ou sombre, sans distinction à gérer.
    ctx.fillStyle = "rgba(10,12,18,0.68)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 10); else ctx.rect(px, py, pw, ph);
    ctx.fill();
    ctx.fillStyle = "#ffcc00";
    ctx.fillText(txt, NET_X, py + 23);
  }

  if (paused) {
    overlay("PAUSE", "Appuyez sur P pour reprendre");
  }
}

function overlay(title, subtitle) {
  // voile éditorial + plaque centrée (même grammaire que les menus)
  ctx.fillStyle = "rgba(8,9,14,0.72)";
  ctx.fillRect(0, 0, W, H);
  const pw = 520, ph = 160, px = (W - pw) / 2, py = (H - ph) / 2 - 8;
  ctx.fillStyle = "rgba(10,12,18,0.88)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 12);
  else ctx.rect(px, py, pw, ph);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.stroke();
  uiLabel(darkMode ? "Pussy Volley" : "Crabby Volley", W / 2, py + 28, 10, uiAccent(), 2, "center");
  ctx.textAlign = "center";
  ctx.fillStyle = UI.ink;
  ctx.font = "800 36px " + UI.sans;
  ctx.fillText(title, W / 2, py + 78);
  if (subtitle) {
    ctx.font = "400 15px " + UI.sans;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(subtitle, W / 2, py + 118);
  }
}

