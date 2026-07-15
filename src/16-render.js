// crabby-volley · rendu — punch caméra, boucle de rendu
"use strict";

// ---------- Smash Battle : affichage ----------
// éclairs entre les joueurs et la balle pendant le duel (purement visuel)
function drawBattleFx() {
  ctx.save();
  ctx.lineWidth = 2.5;
  for (const b of [blobL, blobR]) {
    ctx.strokeStyle = b.side === 0 ? "rgba(232,69,69,0.8)" : "rgba(76,175,80,0.8)";
    ctx.beginPath();
    const x0 = b.x, y0 = b.y - 64;
    ctx.moveTo(x0, y0);
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      ctx.lineTo(
        x0 + (ball.x - x0) * t + (i < steps ? (Math.random() - 0.5) * 18 : 0),
        y0 + (ball.y - y0) * t + (i < steps ? (Math.random() - 0.5) * 18 : 0)
      );
    }
    ctx.stroke();
  }
  // halo pulsant autour de la balle figée
  ctx.strokeStyle = "rgba(255,204,0,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R + 6 + Math.sin(performance.now() / 50) * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBattleHUD() {
  if (!battle.active) return;
  const blink = Math.sin(performance.now() / 70) > 0;
  ctx.save();
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(20,20,40,0.6)";
  ctx.fillRect(W / 2 - 330, 118, 660, 140);
  ctx.strokeStyle = "#ffcc00";
  ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 330, 118, 660, 140);

  ctx.fillStyle = blink ? "#ffcc00" : "#ff9800";
  ctx.font = "bold 42px 'Trebuchet MS', sans-serif";
  ctx.fillText("⚡ SMASH BATTLE ! ⚡", W / 2, 162);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 17px 'Trebuchet MS', sans-serif";
  ctx.fillText("Martelez SAUT le plus vite possible !", W / 2, 188);

  // jauges de martelage, dos à dos depuis le centre
  const maxC = Math.max(10, battle.count[0], battle.count[1]);
  for (const s of [0, 1]) {
    const w = 250 * (battle.count[s] / maxC);
    ctx.fillStyle = s === 0 ? "#e84545" : "#4caf50";
    ctx.fillRect(s === 0 ? W / 2 - 20 - w : W / 2 + 20, 202, w, 18);
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.fillText(battle.count[s], s === 0 ? W / 2 - 295 : W / 2 + 295, 216);
  }
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(W / 2 - 2, 198, 4, 26);

  // barre de temps restant
  const tw = 400 * battle.t / BATTLE_TICKS;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(W / 2 - 200, 236, 400, 8);
  ctx.fillStyle = "#ffcc00";
  ctx.fillRect(W / 2 - tw / 2, 236, tw, 8);
  ctx.restore();
}

// ---------- Rendu ----------
// ---------- Punch de caméra & ralenti (temps forts) ----------
// Le ZOOM est 100 % rendu : chaque client l'applique localement, sans jamais
// toucher la simulation → aucun risque de désynchronisation en ligne.
// Le RALENTI (timeScale) n'est activé QU'EN HORS-LIGNE, justement pour ne pas
// désynchroniser l'hôte et l'invité (qui doivent avancer au même rythme).
let camZoom = 1, camFX = W / 2, camFY = H / 2;
let timeScale = 1;

function render() {
  // repère logique 900×500 → pixels physiques (Hi-DPI)
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
  // décroissance des éléments purement visuels
  // ola sonore : rugissement quand la ferveur bondit (point/smash)
  if (crowdHype > prevCrowdHype + 15) crowdCheer(Math.min(1, crowdHype / 60));
  prevCrowdHype = crowdHype;
  if (crowdHype > 0) crowdHype -= 1;
  for (const e of emotes) if (e && e.t > 0) e.t--;
  if (state === "menu") { drawMenu(); return; }
  if (state === "rules") { drawRules(); return; }
  if (state === "selectAnimal") { drawSelectAnimal(); return; }
  if (state === "selectTerrain") { drawSelectTerrain(); return; }
  if (state === "onlineMenu") { drawOnlineMenu(); return; }
  if (state === "joinEntry") { drawJoinEntry(); return; }
  if (state === "hostWait") { drawHostWait(); return; }
  if (state === "hostLobby") { drawHostLobby(); return; }
  if (state === "connecting") { drawNetScreen("Connexion", "Recherche de la partie"); return; }
  if (state === "netWait") { drawNetScreen("Tu es Vert (à droite)", "En attente du lancement par l'hôte"); return; }
  if (state === "netError") { drawNetError(); return; }

  // invité : le monde affiché vient de l'interpolation des instantanés
  if (online && netRole === "guest") guestApplyView();

  ctx.save();
  if (shake > 0) {
    // tremblement d'écran sur les frappes puissantes et les points
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shake *= 0.88;
    if (shake < 0.4) shake = 0;
  }
  // punch de caméra : léger zoom vers l'action sur les temps forts
  let tz = 1;
  if (state === "play" && ball.smash > 0) tz = 1.16;   // smash destructeur en vol
  else if (state === "point") tz = 1.10;               // sur le point marqué
  camZoom += (tz - camZoom) * 0.12;
  if (camZoom > 1.002) {
    const fx = Math.max(W * 0.30, Math.min(W * 0.70, ball.x));
    const fy = Math.max(H * 0.32, Math.min(H * 0.72, ball.y));
    camFX += (fx - camFX) * 0.15;
    camFY += (fy - camFY) * 0.15;
    ctx.translate(camFX, camFY);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-camFX, -camFY);
  }
  drawBackground();
  drawNet();
  // dessin des joueurs (1 à 4). Le personnage prédit de l'invité est dessiné
  // avec le décalage de lissage, qui se résorbe après chaque réconciliation.
  const mine = (online && netRole === "guest") ? activeBlobs[mySlot] : null;
  for (const b of activeBlobs) {
    if (b === mine && (guestSmoothX || guestSmoothY)) {
      b.x += guestSmoothX; b.y += guestSmoothY;
      b.draw();
      b.x -= guestSmoothX; b.y -= guestSmoothY;
    } else {
      b.draw();
    }
  }
  drawBall();
  if (battle.active) drawBattleFx();
  drawParticles();
  ctx.restore();
  drawBallMarker();
  drawHUD();
  drawBattleHUD();
  if (online && netConnected) drawNetHUD();

  if (state === "point") {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(20,20,40,0.75)";
    ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
    ctx.fillRect(W / 2 - 260, H / 2 - 45, 520, 70);
    ctx.fillStyle = "#ffcc00";
    ctx.fillText(pointMsg, W / 2, H / 2);
  } else if (state === "gameover") {
    if (online) {
      const mySide = netRole === "host" ? 0 : (mode === "2v2" ? (mySlot < 2 ? 0 : 1) : 1);
      const win = (scores[0] > scores[1] ? 0 : 1) === mySide;
      overlay(pointMsg, win ? "Victoire !" : "Défaite…");
      ctx.font = "18px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      let line;
      if (mode === "2v2") {
        line = netRole === "host" ? "Entrée : rejouer    •    Échap : quitter"
                                  : "En attente de l'hôte…    •    Échap : quitter";
      } else {
        line = "R : revanche";
        if (rematchMe) line += " ✓ (toi)";
        if (rematchPeer) line += " ✓ (adversaire)";
        line += "    •    Échap : quitter";
      }
      ctx.fillText(line, W / 2, H / 2 + 58);
    } else {
      overlay(pointMsg, "Espace ou Entrée pour revenir au menu");
    }
  }
}

