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

test("les 18 modules se chargent et exposent l'API", () => {
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

test("IA : le niveau Impitoyable bat un adversaire scripté moyen", () => {
  const NET_X = 450; // W/2
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(3); // Impitoyable (IA = joueur droit)
  g.newGame(2026);
  // adversaire GAUCHE piloté par un bot « moyen » : se met sous la balle, sert,
  // saute pour renvoyer. Sert de garde-fou : si l'IA se remet à rater ses renvois
  // (ex. bug de placement hors du rayon de frappe), elle ne gagnera plus.
  function driveLeft() {
    const me = g.blobL, b = g.ball, serving = g.getServing?.() === 0;
    let target = me.x;
    if (b.frozen) target = b.x;
    else if (b.x < NET_X + 40) target = Math.min(b.x, NET_X - 45);
    const dx = target - me.x;
    g.keys.KeyA = dx < -6; g.keys.KeyD = dx > 6;
    const close = Math.abs(b.x - me.x) < 46 && b.y < me.y - 34 && b.y > me.y - 150;
    g.keys.KeyW = (!b.frozen && b.x < NET_X && close && me.onGround) ||
                  (b.frozen && Math.abs(b.x - me.x) < 20 && me.onGround);
  }
  let f = 0;
  for (; f < 300000 && g.getState() !== "gameover"; f++) { driveLeft(); g.update(); }
  assert.strictEqual(g.getState(), "gameover", "le match doit se terminer");
  assert.ok(g.scores[1] > g.scores[0],
    "l'IA Impitoyable (" + g.scores[1] + ") doit battre le bot (" + g.scores[0] + ")");
});

test("bombe : fonctionne en 2v2 (mèche à zéro → point à l'autre équipe)", () => {
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(1);
  g.setMode("2v2");
  g.setBombMode(true);
  g.newGame(11);
  g.setState("play"); g.setServeCountdown(0);
  // bombe immobile côté GAUCHE, mèche presque finie
  g.ball.frozen = false; g.ball.x = 180; g.ball.y = 150; g.ball.vx = 0; g.ball.vy = 0;
  g.setBombTimer(4);
  const N = { left:false, right:false, jump:false, super:false };
  const ins = g.getActiveBlobs().map(() => N);
  for (let i = 0; i < 12; i++) g.stepGame(null, null, ins);
  assert.strictEqual(g.scores[0] + g.scores[1], 1, "un point doit tomber à l'explosion en 2v2");
  assert.strictEqual(g.scores[1], 1, "bombe à gauche → l'équipe de droite marque");
});

test("bombe : durée choisie appliquée (startRally) et présente dans le snapshot", () => {
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(1);
  g.setBombMode(true); g.setBombTime(300); // 5 secondes
  g.newGame(3); // startRally doit initialiser bombTimer = bombTime
  assert.strictEqual(g.getBombTimer(), 300, "la mèche démarre à la durée choisie (5 s)");
  const snap = g.getSnapshot();
  assert.strictEqual(snap.bombMode, true, "bombMode sérialisé pour l'invité");
  assert.strictEqual(snap.bombTimer, 300, "bombTimer sérialisé pour le compte à rebours invité");
});

test("filet : une balle qui passe AU-DESSUS n'est pas bloquée", () => {
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(1);
  g.newGame(5);
  g.setState("play"); g.setServeCountdown(0);
  // balle clairement au-dessus du filet, en traversée gauche → droite
  g.ball.frozen = false;
  g.ball.x = g.consts.NET_X - 40;
  g.ball.y = g.consts.NET_TOP - 40;
  g.ball.vx = 10; g.ball.vy = -1;
  const startX = g.ball.x;
  for (let i = 0; i < 20; i++) g.updateBall();
  assert.ok(g.ball.x > g.consts.NET_X + 20, "la balle doit passer de l'autre côté (x=" + g.ball.x + ", start=" + startX + ")");
  assert.ok(g.ball.vx > 0, "la vitesse horizontale reste vers la droite");
});

test("filet : un lob qui frôle le sommet passe (pas de rejet latéral)", () => {
  // Régression du bug « balle coincée au filet » : la gravité faisait
  // retomber y sous NET_TOP pile dans le poteau → rebond latéral alors
  // que la trajectoire était un passage par-dessus.
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(1);
  g.newGame(7);
  g.setState("play"); g.setServeCountdown(0);
  g.ball.frozen = false;
  g.ball.x = g.consts.NET_X - 30;
  g.ball.y = g.consts.NET_TOP - 5;
  g.ball.vx = 8; g.ball.vy = 3;
  for (let i = 0; i < 25; i++) g.updateBall();
  assert.ok(g.ball.x > g.consts.NET_X + 30, "le lob frôlant doit passer (x=" + g.ball.x + ")");
  assert.ok(g.ball.vx > 0, "vx reste vers la droite (pas de rebond poteau)");
});

test("filet : balle coincée dans le poteau est éjectée (anti-stick)", () => {
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(1);
  g.newGame(6);
  g.setState("play"); g.setServeCountdown(0);
  g.ball.frozen = false;
  g.ball.x = g.consts.NET_X; // pile dans le poteau
  g.ball.y = g.consts.NET_TOP + 40;
  g.ball.vx = 0.3; g.ball.vy = 1;
  for (let i = 0; i < 8; i++) g.updateBall();
  const clear = Math.abs(g.ball.x - g.consts.NET_X) > g.consts.NET_W / 2 + g.consts.BALL_R - 1;
  assert.ok(clear, "la balle doit sortir du poteau (x=" + g.ball.x + ")");
  assert.ok(Math.abs(g.ball.vx) >= 2, "vitesse d'éjection minimale");
});

test("soft ownership : zone invité hors filet (marge)", () => {
  const g = loadGame();
  const M = g.consts.GUEST_BALL_MARGIN;
  assert.ok(M >= 40, "marge assez large pour éviter le poteau");
  assert.strictEqual(g.ballInGuestOwnZone(g.consts.NET_X + M + 1), true);
  assert.strictEqual(g.ballInGuestOwnZone(g.consts.NET_X + M), false);
  assert.strictEqual(g.ballInGuestOwnZone(g.consts.NET_X), false);
  assert.strictEqual(g.ballInGuestOwnZone(g.consts.NET_X - 40), false);
});

test("soft ownership : skipBall avance les corps sans bouger la balle", () => {
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(1);
  g.newGame(9);
  g.setState("play"); g.setServeCountdown(0);
  g.ball.frozen = false;
  g.ball.x = 700; g.ball.y = 120; g.ball.vx = 0; g.ball.vy = 0;
  const bx = g.ball.x, by = g.ball.y;
  const x0 = g.blobL.x;
  const N = { left: false, right: true, jump: false, super: false };
  g.stepGame(N, N, null, { skipBall: true });
  assert.strictEqual(g.ball.x, bx, "skipBall ne déplace pas la balle");
  assert.strictEqual(g.ball.y, by);
  assert.ok(g.blobL.x !== x0 || g.blobL.vx !== 0, "les corps avancent quand même");
});

test("balle crevée : sans holder local, le point tombe quand même", () => {
  // Régression soft-own : popped reçu sans hasBall bloquait la partie.
  const g = loadGame();
  g.setVsAI(true); g.setAiLevel(1);
  g.newGame(42);
  g.setState("play"); g.setServeCountdown(0);
  g.ball.frozen = false;
  g.ball.popped = true;
  g.ball.lastTouchSide = 1; // Vert a crevé → point pour Rouge
  g.blobL.hasBall = false; g.blobR.hasBall = false;
  g.updateBall();
  assert.strictEqual(g.getState(), "point", "un point doit être marqué");
  assert.strictEqual(g.scores[0], 1, "le camp opposé au lastTouch marque");
});

test("Scooby : animal visible avec dessin et super turbo", () => {
  const g = loadGame();
  const scooby = g.ANIMALS.find(a => a.key === "scooby");
  assert.ok(scooby, "entrée ANIMALS scooby");
  assert.strictEqual(scooby.hidden, undefined);
  assert.ok(scooby.slip && scooby.tired, "traits slip + tired");
  assert.ok(typeof g.drawScooby === "function", "drawScooby défini");
  const idx = g.ANIMALS.indexOf(scooby);
  assert.ok(idx >= 6, "append en fin de tableau (pas de casse d'indices terrain)");
  g.blobL.animal = idx;
  assert.strictEqual(g.blobL.animal, idx);
});

test("sprites Scooby / Mystery Machine déclarés", () => {
  const g = loadGame();
  assert.ok(g.SPRITES, "SPRITES exposé");
  assert.ok(g.SPRITES.scoobyRun, "sprite run");
  assert.ok(g.SPRITES.mysteryVan, "sprite van");
  assert.ok(g.SPRITES.manoirBg, "fond manoir");
  assert.ok(Array.isArray(g.SPRITES.scoobyWalk) && g.SPRITES.scoobyWalk.length === 8, "cycle walk 8 frames");
  assert.strictEqual(g.spriteReady(null), false);
  assert.strictEqual(g.spriteReady(g.SPRITES.scoobyRun), false, "stub Image → fallback canvas");
});

test("terrain Manoir Hanté lié à Scooby", () => {
  const g = loadGame();
  const manoir = g.TERRAINS.find(t => t.key === "manoir");
  assert.ok(manoir, "terrain manoir présent");
  assert.ok(!manoir.hidden, "terrain visible (pas Belzébuth)");
  assert.strictEqual(g.ANIMALS[manoir.animal].key, "scooby");
  assert.ok(typeof g.drawBgManoir === "function", "drawBgManoir défini");
});

test("soft ownership : pack/applyBallState round-trip", () => {
  const g = loadGame();
  g.newGame(2);
  g.setState("play"); g.setServeCountdown(0);
  g.ball.frozen = false;
  g.ball.x = 620; g.ball.y = 150; g.ball.vx = -3; g.ball.vy = 4;
  g.ball.angle = 1.2; g.ball.touches = [1, 2];
  const packed = g.packBallState(true);
  assert.strictEqual(packed.own, 1, "own:1 quand l'invité simule");
  assert.strictEqual(g.packBallState(false).own, 0, "own:0 hors possession");
  g.ball.x = 0; g.ball.y = 0; g.ball.vx = 0; g.ball.vy = 0;
  g.applyBallState(packed);
  assert.strictEqual(g.ball.x, 620);
  assert.strictEqual(g.ball.y, 150);
  assert.strictEqual(g.ball.vx, -3);
  assert.strictEqual(g.ball.vy, 4);
  assert.deepStrictEqual(g.ball.touches, [1, 2]);
});

console.log("\n" + pass + " réussis, " + fail + " échoués");
process.exit(fail ? 1 : 0);
