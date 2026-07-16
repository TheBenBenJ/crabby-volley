// Chargeur de test headless.
// Concatène les modules de src/ DANS L'ORDRE (comme le navigateur charge les
// <script>), les évalue dans un environnement Node avec un canvas factice,
// et expose les internes du jeu pour les assertions.
//
// C'est le même code que celui servi au navigateur : si ces tests passent,
// le découpage en modules n'a rien changé au comportement.
"use strict";
const fs = require("fs");
const path = require("path");

// --- canvas / navigateur factices (aucun rendu réel) ---
const noopCtx = new Proxy({}, {
  get: (t, p) => {
    if (p === "measureText") return () => ({ width: 100 });
    if (p === "createLinearGradient" || p === "createRadialGradient")
      return () => ({ addColorStop: () => {} });
    return typeof p === "string" ? () => noopCtx : undefined;
  },
  set: () => true
});

function define(name, value) {
  Object.defineProperty(global, name, { value, writable: true, configurable: true });
}
define("document", { getElementById: () => ({ getContext: () => noopCtx }), hidden: false });
define("window", { addEventListener: () => {} }); // pas d'innerWidth → resizeCanvas no-op
define("navigator", { getGamepads: () => [] });
define("requestAnimationFrame", () => 0);
define("setInterval", () => 0);
define("clearInterval", () => {});
if (typeof performance === "undefined") define("performance", require("perf_hooks").performance);
if (typeof Peer === "undefined") define("Peer", function () { return {}; }); // stub PeerJS

// épilogue : ce que les tests peuvent inspecter/piloter
const EPILOGUE = `
;module.exports = {
  newGame, stepGame, startRally, update, getSnapshot, applySnapshot,
  ball, blobL, blobR, blob2L, blob2R, scores, battle, aiInput, aiInput2v2, keys,
  setMode, getActiveBlobs: () => activeBlobs,
  getState: () => state, setState: v => { state = v; },
  getMode: () => mode, getTick: () => tick,
  setVsAI: v => { vsAI = v; }, setAiLevel: v => { aiLevel = v; },
  setServeCountdown: v => { serveCountdown = v; },
  setServingSide: v => { servingSide = v; },
  setBombMode: v => { bombMode = v; }, getBombMode: () => bombMode,
  getBombTimer: () => bombTimer, setBombTimer: v => { bombTimer = v; },
  setBombTime: v => { bombTime = v; }, getBombTime: () => bombTime,
  updateBall,
  consts: { W, H, NET_X, NET_W, NET_TOP, GROUND_Y, BALL_R, MAX_BALL_SPEED }
};`;

function srcConcat() {
  const dir = path.join(__dirname, "..", "src");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js")).sort();
  return files.map(f => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
}

// charge une instance NEUVE du jeu (état frais à chaque appel)
function loadGame() {
  const mod = { exports: {} };
  const code = srcConcat() + EPILOGUE;
  new Function("module", "exports", "require", code)(mod, mod.exports, require);
  return mod.exports;
}

module.exports = { loadGame };
