// Tests « filet de sécurité » — sans dépendance externe (node tests/game.test.js).
// Objectif : garantir que la simulation se comporte comme avant le découpage en
// modules. On charge le jeu exactement comme le navigateur (concat de src/ dans
// l'ordre) puis on pilote la simulation via l'API exposée par tests/_load.js.
"use strict";
const assert = require("assert");
const { loadGame } = require("./_load.js");

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; console.log("  ✗ " + name + "\n      " + (e && e.message)); }
}

// démarre une partie 1v1 prête à jouer (balle lancée), IA à droite
function freshRally(seed) {
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(1);
  g.newGame(seed);
  g.setState("play"); g.setServeCountdown(0);
  g.ball.frozen = false; g.ball.x = 250; g.ball.y = 200; g.ball.vx = 4; g.ball.vy = -6;
  return g;
}

console.log("crabby-volley — tests");

test("les 17 modules se chargent et exposent l'API", () => {
  const g = loadGame();
  assert.strictEqual(typeof g.stepGame, "function");
  assert.strictEqual(typeof g.getSnapshot, "function");
  assert.ok(g.ball && g.blobL && g.blobR);
});

test("newGame initialise un état de service propre", () => {
  const g = loadGame();
  g.newGame(1);
  assert.strictEqual(g.getState(), "serve");
  assert.deepStrictEqual(g.scores, [0, 0]);
});

test("gravité : une balle libre en l'air accélère vers le bas", () => {
  const g = loadGame();
  g.newGame(1);
  g.setState("play"); g.setServeCountdown(0);
  g.ball.frozen = false; g.ball.x = 120; g.ball.y = 80; g.ball.vx = 0; g.ball.vy = 0;
  const y0 = g.ball.y;
  g.stepGame({ left:false,right:false,jump:false }, { left:false,right:false,jump:false });
  assert.ok(g.ball.vy > 0, "vy devrait être positive après un tick");
  assert.ok(g.ball.y > y0, "la balle devrait être descendue");
});

test("déterminisme : même graine + mêmes entrées → snapshots identiques", () => {
  const run = () => {
    const g = freshRally(1234);
    const neutral = { left:false, right:false, jump:false };
    for (let i = 0; i < 400; i++) g.stepGame(neutral, g.aiInput());
    return JSON.stringify(g.getSnapshot());
  };
  const a = run(), b = run();
  assert.strictEqual(a, b, "deux exécutions identiques doivent produire le même snapshot");
});

test("un échange finit par marquer un point (physique + IA + score)", () => {
  const g = freshRally(7);
  const neutral = { left:false, right:false, jump:false };
  let scored = false;
  for (let i = 0; i < 3000 && !scored; i++) {
    g.stepGame(neutral, g.aiInput());
    if (g.scores[0] + g.scores[1] > 0) scored = true;
  }
  assert.ok(scored, "aucun point marqué en 3000 ticks");
});

test("round-trip snapshot : appliquer un snapshot reproduit le même snapshot", () => {
  const g = freshRally(99);
  const neutral = { left:false, right:false, jump:false };
  for (let i = 0; i < 120; i++) g.stepGame(neutral, g.aiInput());
  const s1 = g.getSnapshot();
  g.applySnapshot(JSON.parse(JSON.stringify(s1)));
  const s2 = g.getSnapshot();
  assert.strictEqual(JSON.stringify(s2), JSON.stringify(s1));
});

test("2v2 : setMode('2v2') active 4 joueurs et la simulation tourne", () => {
  const g = loadGame();
  g.setMode("2v2");
  g.setAiLevel(1);
  g.newGame(3);
  const blobs = g.getActiveBlobs();
  assert.strictEqual(blobs.length, 4, "4 blobs attendus en 2v2");
  g.setState("play"); g.setServeCountdown(0);
  g.ball.frozen = false; g.ball.x = 300; g.ball.y = 150; g.ball.vx = 5; g.ball.vy = -3;
  const t0 = g.getTick();
  for (let i = 0; i < 300; i++) {
    const ins = blobs.map((b, s) => s === 0
      ? { left:false, right:false, jump:false, super:false }
      : g.aiInput2v2(b));
    g.stepGame(null, null, ins);
  }
  assert.ok(g.getTick() > t0, "le tick doit avancer");
  assert.ok(Number.isFinite(g.ball.x) && Number.isFinite(g.ball.y), "balle en état fini");
  assert.ok(Number.isFinite(g.scores[0]) && Number.isFinite(g.scores[1]));
});

test("bombe : la mèche à zéro fait perdre le camp qui détient la bombe", () => {
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(1);
  g.setBombMode(true);
  g.newGame(5);
  g.setState("play"); g.setServeCountdown(0);
  // bombe immobile côté GAUCHE, mèche presque terminée
  g.ball.frozen = false; g.ball.x = 200; g.ball.y = 150; g.ball.vx = 0; g.ball.vy = 0;
  g.setBombTimer(5);
  const neutral = { left:false, right:false, jump:false, super:false };
  for (let i = 0; i < 12; i++) g.stepGame(neutral, neutral);
  assert.strictEqual(g.scores[0] + g.scores[1], 1, "un point doit tomber à l'explosion");
  assert.strictEqual(g.scores[1], 1, "bombe à gauche → le camp droit marque");
  assert.ok(g.getBombTimer() <= 0, "la mèche doit être à zéro");
});

test("bombe : touche le sol → explosion et point à l'adversaire", () => {
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(1);
  g.setBombMode(true);
  g.newGame(9);
  g.setState("play"); g.setServeCountdown(0);
  g.setBombTimer(600); // mèche pleine : c'est la CHUTE qui doit déclencher
  // bombe qui plonge côté DROIT, loin des joueurs (pas de renvoi possible)
  g.ball.frozen = false; g.ball.x = 850; g.ball.y = 430; g.ball.vx = 0; g.ball.vy = 6;
  const neutral = { left:false, right:false, jump:false, super:false };
  let scored = false;
  for (let i = 0; i < 30 && !scored; i++) {
    g.stepGame(neutral, neutral);
    if (g.scores[0] + g.scores[1] > 0) scored = true;
  }
  assert.ok(scored, "la bombe au sol doit marquer un point");
  assert.strictEqual(g.scores[0], 1, "bombe à droite → le camp gauche marque");
});

test("filet : une balle très rapide ne traverse pas le poteau (anti-tunnel)", () => {
  const g = loadGame();
  const C = g.consts;
  g.newGame(1);
  g.setState("play"); g.setServeCountdown(0);
  // balle juste à gauche du filet, sous le sommet, lancée à droite plus vite
  // qu'un tick de filet ne peut « couvrir » (franchissement en un seul pas)
  g.ball.frozen = false;
  g.ball.x = C.NET_X - C.NET_W / 2 - C.BALL_R - 2;
  g.ball.y = C.NET_TOP + 80;
  g.ball.vx = 40; g.ball.vy = 0;
  g.stepGame({ left:false,right:false,jump:false }, { left:false,right:false,jump:false });
  assert.ok(g.ball.x < C.NET_X, "la balle ne doit pas s'être téléportée de l'autre côté du filet");
  assert.ok(g.ball.vx < 0, "la balle doit avoir rebondi (vx inversée)");
});

console.log("\n" + pass + " réussis, " + fail + " échoués");
process.exit(fail ? 1 : 0);
