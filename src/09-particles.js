// crabby-volley · particules & marqueur de balle hors-écran
"use strict";

// ---------- Particules (plumes, sable) ----------
function spawnSand(x, y, n) {
  if (noFx) return;
  const tkey = TERRAINS[terrain].key;
  const col = tkey === "neige" ? "#eef4fa" : tkey === "prairie" ? "#8fbf4a"
            : tkey === "enfer" ? "#ff6a2e" : tkey === "styx" ? "#4a5a2e" : "#c9a24f";
  for (let i = 0; i < n; i++) particles.push({
    type: "sand",
    x: x + (Math.random() - 0.5) * 14, y: y - Math.random() * 4,
    vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2.5 - 0.5,
    life: 25 + Math.random() * 15, maxLife: 40,
    size: 2 + Math.random() * 2, color: col, rot: 0, vr: 0
  });
}

// petit nuage blanc sous les pieds lors d'un double saut
function spawnAirPuff(x, y) {
  if (noFx) return;
  for (let i = 0; i < 6; i++) particles.push({
    type: "sand",
    x: x + (Math.random() - 0.5) * 20, y: y + Math.random() * 6,
    vx: (Math.random() - 0.5) * 2.5, vy: 0.5 + Math.random() * 1.5,
    life: 18 + Math.random() * 10, maxLife: 28,
    size: 2.5 + Math.random() * 2, color: "rgba(255,255,255,0.9)", rot: 0, vr: 0
  });
}

// explosion au sol d'un smash destructeur
function spawnBoom(x, y) {
  if (noFx) return;
  const cols = ["#ff9800", "#ff5722", "#ffcc00", "#fff3c4"];
  for (let i = 0; i < 26; i++) particles.push({
    type: "sand",
    x: x + (Math.random() - 0.5) * 10, y: y - Math.random() * 6,
    vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 6 - 1,
    life: 30 + Math.random() * 25, maxLife: 55,
    size: 2.5 + Math.random() * 3, color: cols[i % cols.length], rot: 0, vr: 0
  });
}

// gerbe d'étoiles à l'activation d'un SUPER
function spawnSuperBurst(blob) {
  if (noFx) return;
  const cols = ["#ffe14d", "#ffffff", "#ffa23e", blob.color];
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2;
    const sp = 3 + Math.random() * 4;
    particles.push({
      type: "star",
      x: blob.x, y: blob.y - 40,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1,
      life: 26 + Math.random() * 16, maxLife: 42,
      size: 3 + Math.random() * 3, color: cols[i % cols.length],
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4
    });
  }
}

// pluie de confettis (célébration d'un point / fin de match)
const CONFETTI_COLS = ["#ff5b5b", "#ffd93d", "#4db3ff", "#7ed957", "#ff6fae", "#c07bff", "#ffffff"];
function spawnConfetti(n, cx) {
  if (noFx) return;
  for (let i = 0; i < n; i++) particles.push({
    type: "confetti",
    x: cx !== undefined ? cx + (Math.random() - 0.5) * 220 : Math.random() * W,
    y: -10 - Math.random() * 40,
    vx: (Math.random() - 0.5) * 2, vy: 1.5 + Math.random() * 2.5,
    life: 90 + Math.random() * 70, maxLife: 160,
    size: 4 + Math.random() * 4, color: CONFETTI_COLS[i % CONFETTI_COLS.length],
    rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.5,
    sway: Math.random() * Math.PI * 2
  });
}

// bulle d'émotion au-dessus d'un joueur (kind: happy/sad/wow/star)
function setEmote(side, kind) {
  if (noFx) return;
  emotes[side] = { kind, t: 55 };
  // petit son d'émotion (beep est déjà coupé si muted/noFx)
  if (kind === "happy") { beep(660, 0.08, "square", 0.07); beep(990, 0.1, "square", 0.06, 0.08); }
  else if (kind === "sad") beep(420, 0.16, "sawtooth", 0.06, 0, 220);
  else if (kind === "wow") { beep(880, 0.06, "square", 0.07); beep(1240, 0.06, "square", 0.06, 0.05); }
}

function spawnFeathers(x, y, color, n) {
  if (noFx) return;
  for (let i = 0; i < n; i++) particles.push({
    type: "feather",
    x, y,
    vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 3 - 1,
    life: 50 + Math.random() * 35, maxLife: 85,
    size: 5 + Math.random() * 3, color,
    rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.25
  });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === "feather") {
      // les plumes tombent doucement en zigzaguant
      p.vy = Math.min(p.vy + 0.06, 1.2);
      p.vx *= 0.97;
      p.x += p.vx + Math.sin(p.life * 0.25) * 0.6;
    } else if (p.type === "confetti") {
      // confetti : chute lente avec balancement latéral
      p.vy = Math.min(p.vy + 0.04, 2.2);
      p.sway += 0.12;
      p.x += p.vx + Math.sin(p.sway) * 1.3;
    } else {
      p.vy += 0.3;
      p.x += p.vx;
    }
    p.y += p.vy;
    p.rot += p.vr;
    p.life--;
    if (p.life <= 0 || p.y > H + 12) particles.splice(i, 1);
  }
  if (particles.length > 320) particles.splice(0, particles.length - 320);
}

// étoile à 5 branches, centrée à l'origine (chemin prêt à remplir)
function drawStarShape(r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.5)));
    ctx.fillStyle = p.color;
    if (p.type === "feather") {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "star") {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      drawStarShape(p.size);
      ctx.fill();
    } else if (p.type === "confetti") {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const w = p.size, h = p.size * 0.5 * (0.4 + Math.abs(Math.sin(p.sway))); // scintille en tournant
      ctx.fillRect(-w / 2, -h / 2, w, h);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------- Marqueur de balle hors écran ----------
function drawBallMarker() {
  if (ball.y >= -BALL_R) return;
  const mx = Math.max(26, Math.min(W - 26, ball.x));
  const pulse = 1 + Math.sin(performance.now() / 120) * 0.12;
  const alt = Math.max(1, Math.round((-ball.y + BALL_R) / 45));

  ctx.save();
  ctx.translate(mx, 24);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = "#ffcc00";
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  // flèche vers le haut
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(11, 0);
  ctx.lineTo(-11, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // mini-balle
  ctx.beginPath();
  ctx.arc(0, 11, 8, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // altitude
  ctx.fillStyle = "rgba(20,20,40,0.65)";
  ctx.fillRect(mx - 24, 44, 48, 20);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
  ctx.fillText(alt + " m", mx, 58);
}

