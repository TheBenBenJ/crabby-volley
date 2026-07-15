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
  const raining = weather === "rain" || storm;

  // ciel : bleu clair par beau temps, gris plombé à l'orage
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  if (storm) {
    sky.addColorStop(0, "#3a4353");
    sky.addColorStop(1, "#6b7684");
  } else if (raining) {
    sky.addColorStop(0, "#6d8aa8");
    sky.addColorStop(1, "#a9c4d8");
  } else {
    sky.addColorStop(0, "#4da6e8");
    sky.addColorStop(1, "#bfe6ff");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // parallaxe : collines côtières lointaine (bleutée) + intermédiaire
  drawHillLayer(GROUND_Y - 100, storm ? "#58697b" : raining ? "#93b0c4" : "#a9d4ec", 0.12,
    [[110, GROUND_Y - 150], [300, GROUND_Y - 118], [470, GROUND_Y - 162], [660, GROUND_Y - 122], [820, GROUND_Y - 152]]);
  drawHillLayer(GROUND_Y - 92, storm ? "#465868" : raining ? "#7c9db2" : "#7fbfe0", 0.3,
    [[180, GROUND_Y - 128], [380, GROUND_Y - 104], [560, GROUND_Y - 134], [760, GROUND_Y - 108]]);

  // arc-en-ciel : quand il pleut mais que le soleil reste visible
  if (raining && sunVisible() && !storm) drawRainbow();

  // soleil (dérive lente) — voilé sous la pluie, masqué à l'orage
  if (!storm) {
    const halo = raining ? 0.18 : 0.35;
    ctx.fillStyle = "rgba(255,230,128," + halo + ")";
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = raining ? "rgba(255,240,200,0.75)" : "#ffe680";
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 38, 0, Math.PI * 2); ctx.fill();
  }

  drawClouds(storm ? "rgba(90,100,115,0.9)" : raining ? "rgba(200,210,220,0.85)" : "rgba(255,255,255,0.85)");

  // tribunes (derrière la mer)
  drawCrowd();

  // mer au loin (plus sombre sous l'orage)
  ctx.fillStyle = storm ? "#1f4c6b" : "#2e86c1";
  ctx.fillRect(0, GROUND_Y - 55, W, 18);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(0, GROUND_Y - 55, W, 3);

  // sable : sec (clair) ou humide (plus foncé et saturé) sous la pluie
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
  if (raining) {
    // reflet luisant du sable mouillé
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(0, GROUND_Y, W, 6);
  }
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
  if (raining) drawRain(storm ? 1 : 0.55);
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

  // lucioles (sorties seulement par temps clair) — sinon, il pleut
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
    drawRain(stormy ? 1 : 0.55);
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
  const frac = Math.max(0, bombTimer) / BOMB_TIME; // 1 (pleine) → 0 (explosion)
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
  const frac = Math.max(0, bombTimer) / BOMB_TIME;
  const low = bombTimer <= 180;
  const col = frac > 0.5 ? "#7ed957" : frac > 0.25 ? "#ffcc00" : "#ff4030";
  const blink = low && Math.floor(performance.now() / 140) % 2 === 0;
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(20,20,40,0.62)";
  ctx.fillRect(NET_X - 62, 24, 124, 42);
  ctx.strokeStyle = blink ? "#fff" : col;
  ctx.lineWidth = 2;
  ctx.strokeRect(NET_X - 62, 24, 124, 42);
  ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = blink ? "#fff" : col;
  ctx.fillText("💣 " + secs + "s", NET_X, 55);
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
  // scores (avec effet "pop" quand un point est marqué)
  ctx.textAlign = "center";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold " + (42 + scorePop[0] * 1.2) + "px 'Trebuchet MS', sans-serif";
  ctx.strokeText(scores[0], W * 0.25, 55);
  ctx.fillStyle = "#e84545";
  ctx.fillText(scores[0], W * 0.25, 55);
  ctx.font = "bold " + (42 + scorePop[1] * 1.2) + "px 'Trebuchet MS', sans-serif";
  ctx.strokeText(scores[1], W * 0.75, 55);
  ctx.fillStyle = "#4caf50";
  ctx.fillText(scores[1], W * 0.75, 55);
  if (scorePop[0] > 0) scorePop[0]--;
  if (scorePop[1] > 0) scorePop[1]--;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
  ctx.fillText("–", NET_X, 50);

  // indicateur de touches
  for (const side of [0, 1]) {
    const baseX = side === 0 ? W * 0.25 - 24 : W * 0.75 - 24;
    for (let i = 0; i < MAX_TOUCHES; i++) {
      ctx.beginPath();
      ctx.arc(baseX + i * 24, 78, 6, 0, Math.PI * 2);
      ctx.fillStyle = i < ball.touches[side] ? (side === 0 ? "#e84545" : "#4caf50") : "rgba(255,255,255,0.45)";
      ctx.fill();
    }
  }

  // jauges de SUPER (combo) sous chaque score
  for (const s of [0, 1]) {
    const cx = s === 0 ? W * 0.25 : W * 0.75;
    const col = s === 0 ? "#e84545" : "#4caf50";
    const bw = 120, bx = cx - bw / 2, by = 92;
    const ready = superCharge[s] === 1;
    const frac = ready ? 1 : (streak[s] % SUPER_NEED) / SUPER_NEED;
    // cadre
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
    // remplissage
    if (ready) {
      const t = performance.now() / 300;
      ctx.fillStyle = (Math.sin(t * 6) > 0) ? "#ffd93d" : "#fff2a0";
    } else ctx.fillStyle = col;
    ctx.fillRect(bx, by, bw * frac, 7);
    // libellé
    ctx.textAlign = "center";
    ctx.font = "bold 11px 'Trebuchet MS', sans-serif";
    if (ready) {
      ctx.fillStyle = "#ffd93d";
      const key = (s === 0 ? blobL : blobR);
      ctx.fillText("★ SUPER PRÊT — " + (s === 0 ? "S" : "↓") + " ★", cx, by + 22);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText("combo " + (streak[s] % SUPER_NEED) + "/" + SUPER_NEED, cx, by + 22);
    }
  }

  // message flash de SUPER
  if (superFlashT > 0 && superFlash) {
    ctx.textAlign = "center";
    ctx.globalAlpha = Math.min(1, superFlashT / 12);
    ctx.fillStyle = "#ffd93d";
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 4; ctx.lineJoin = "round";
    ctx.font = "bold 34px 'Trebuchet MS', sans-serif";
    ctx.strokeText(superFlash, NET_X, 150);
    ctx.fillText(superFlash, NET_X, 150);
    ctx.globalAlpha = 1;
  }

  // balle de match
  if (state === "play" || state === "serve") {
    for (const s of [0, 1]) {
      if (scores[s] >= WIN_SCORE - 1 && scores[s] - scores[1 - s] >= 1) {
        ctx.fillStyle = s === 0 ? "#e84545" : "#4caf50";
        ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("★ Balle de match — " + (s === 0 ? "Rouge" : "Vert") + " ★", NET_X, 128);
      }
    }
  }

  // décompte avant service, puis invite de service
  if (state === "serve" && serveCountdown > 0) {
    const n = Math.ceil((serveCountdown - 6) / 21); // 3 → 2 → 1 → (GO)
    const label = n <= 0 ? "GO !" : String(n);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(NET_X - (n <= 0 ? 110 : 70), H / 2 - 70, (n <= 0 ? 220 : 140), 110);
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 88px 'Trebuchet MS', sans-serif";
    ctx.fillText(label, NET_X, H / 2 + 20);
  } else if (state === "serve") {
    ctx.fillStyle = terrain === 2 ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.55)";
    ctx.font = "18px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Service : " + (servingSide === 0 ? "Rouge" : "Vert") + " — touchez la balle !", NET_X, 105);
  }

  if (paused) {
    overlay("PAUSE", "Appuyez sur P pour reprendre");
  }
}

function overlay(title, subtitle) {
  ctx.fillStyle = "rgba(20,20,40,0.65)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 44px 'Trebuchet MS', sans-serif";
  ctx.fillText(title, W / 2, H / 2 - 20);
  if (subtitle) {
    ctx.font = "20px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(subtitle, W / 2, H / 2 + 20);
  }
}

