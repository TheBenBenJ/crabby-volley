// crabby-volley · points & score
"use strict";

// ---------- Points / score ----------
function awardPoint(side, reason) {
  if (state !== "play" && state !== "serve") return;
  scores[side]++;
  scorePop[side] = 20;
  shake = 8;
  servingSide = side;
  beep(side === 0 ? 660 : 550, 0.25, "sine", 0.2);

  // le camp qui perd le point subit sa "punition" visuelle au maximum d'un
  // coup (oiseau déplumé, lapin épuisé, manchot fou de rage, grenouille
  // complètement dingue), en plus de la montée progressive au fil des
  // touches — remis à zéro au prochain service via Blob.reset() dans
  // startRally().
  for (const b of activeBlobs) {
    if (b.side !== 1 - side) continue;
    const key = animOf(b).key;
    if (key === "oiseau" && b.molt < MOLT_MAX) {
      b.molt = MOLT_MAX;
      if (!noFx) spawnFeathers(b.x, b.y - 55, b.color, 22);
    } else if (key === "lapin") {
      b.fatigue = FATIGUE_MAX;
    } else if (key === "manchot") {
      b.anger = ANGER_MAX;
    } else if (key === "grenouille") {
      b.crazy = CRAZY_MAX;
    }
  }

  // combo : points d'affilée → charge le SUPER de l'animal
  streak[side]++; streak[1 - side] = 0;
  if (streak[side] % SUPER_NEED === 0 && superCharge[side] === 0) {
    superCharge[side] = 1;
    beep(700, 0.12, "square", 0.16, 0, 1050);
    beep(1050, 0.16, "square", 0.14, 0.1, 1500);
    superFlash = "SUPER PRÊT — " + sideName(side) + " !"; superFlashT = 70;
  }
  const name = sideName(side);
  pointMsg = reason ? reason + "  —  Point " + name : "Point pour " + name + " !";
  // réactions : public en délire, confettis, émotions des joueurs
  crowdHype = 60;
  const smashy = reason && (reason.indexOf("SMASH") >= 0 || reason.indexOf("crevée") >= 0);
  if (!noFx) {
    spawnConfetti(22, side === 0 ? W * 0.25 : W * 0.75);
    setEmote(side, "happy");
    setEmote(1 - side, smashy ? "wow" : "sad");
  }
  const lead = Math.abs(scores[0] - scores[1]);
  if (scores[side] >= WIN_SCORE && lead >= 2) {
    state = "gameover";
    pointMsg = name + " remporte le match " + scores[0] + " – " + scores[1] + " !";
    if (!noFx) { spawnConfetti(90); setEmote(side, "happy"); }
  } else {
    state = "point";
    pointTimer = 75;
  }
}

function startRally() {
  for (const b of activeBlobs) b.reset();
  ball.reset(servingSide);
  battle.active = false;
  battle.t = 0;
  battle.count = [0, 0];
  battle.prevJump = [false, false];
  battle.cooldown = 0;
  bombTimer = BOMB_TIME; // la mèche ne se consume qu'une fois la balle en jeu
  state = "serve";
  serveCountdown = 69; // 3·2·1 (63, ~0.35s chacun) + "GO !" (6)
}

