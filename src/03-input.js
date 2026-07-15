// crabby-volley · entrées — clavier & manettes (Gamepad API)
"use strict";

// ---------- Entrées clavier ----------
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.code] = true;
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","KeyW","KeyA","KeyS","KeyD"].includes(e.code)) e.preventDefault();
  handleMenuKeys(e.code, e.key);
});
window.addEventListener("keyup", e => { keys[e.code] = false; });

// ---------- Manettes (Gamepad API) ----------
// Manette 1 → joueur Rouge, manette 2 → joueur Vert. Le clavier reste actif
// en parallèle. Stick gauche / croix : bouger · A, B, X, Y ou croix-haut : sauter.
// Dans les menus : croix/stick pour surligner, A pour valider, B pour revenir.
const PAD_DEADZONE = 0.4;
let padsNow = [], padsPrev = [];
let padConnected = false;
let navIdx = 0; // option surlignée à la manette dans les menus

function readPad(gp) {
  if (!gp || !gp.connected) return null;
  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  return {
    left:    ax < -PAD_DEADZONE || b(14),
    right:   ax >  PAD_DEADZONE || b(15),
    jump:    b(0) || b(3) || b(12),
    superT:  b(1) || b(2) || b(4) || b(5) || b(6) || b(7), // B/X ou gâchettes → SUPER
    up:      ay < -0.5 || b(12),
    down:    ay >  0.5 || b(13),
    confirm: b(0),          // A / Croix
    back:    b(1) || b(8)   // B / Rond, ou Select
  };
}

// relu à chaque frame d'affichage (l'API Gamepad se sonde, pas d'événements)
function pollPads() {
  padsPrev = padsNow;
  padsNow = [];
  const list = (navigator.getGamepads && navigator.getGamepads()) || [];
  for (const gp of list) {
    const r = readPad(gp);
    if (r) padsNow.push(r);
  }
  padConnected = padsNow.length > 0;
}

// front montant du bouton sur au moins une manette (pour les menus)
function padEdge(field) {
  for (let i = 0; i < padsNow.length; i++) {
    if (padsNow[i][field] && !(padsPrev[i] && padsPrev[i][field])) return true;
  }
  return false;
}

// entrées de jeu de la manette n° i (fusionnées avec le clavier)
function padGameInput(i) {
  const p = padsNow[i];
  return p ? { left: p.left, right: p.right, jump: p.jump, super: p.superT }
           : { left: false, right: false, jump: false, super: false };
}

// options navigables à la manette, par état (mêmes codes que le clavier)
function navOptions() {
  switch (state) {
    case "menu":          return ["Digit1", "Digit2", "Digit3", "KeyR"];
    case "aiDifficulty":  return ["Digit1", "Digit2", "Digit3"];
    // le nombre d'options dépend du contexte (Solo IA : 3 ; local : 2, pas de 2v2)
    case "gameModeSelect": return pendingMode && pendingMode.vsAI
      ? ["Digit1", "Digit2", "Digit3"] : ["Digit1", "Digit2"];
    case "onlineMenu":    return ["Digit1", "Digit3", "Digit2"];
    case "selectAnimal":  return ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"];
    case "selectTerrain": return ["Digit1", "Digit2", "Digit3"];
    default: return null;
  }
}

function handlePadMenu() {
  const opts = navOptions();
  if (opts) {
    const horiz = state === "selectAnimal" || state === "selectTerrain";
    if (navIdx >= opts.length) navIdx = 0;
    if (padEdge(horiz ? "right" : "down")) { navIdx = (navIdx + 1) % opts.length; beep(500, 0.03, "square", 0.05); }
    if (padEdge(horiz ? "left" : "up"))    { navIdx = (navIdx - 1 + opts.length) % opts.length; beep(500, 0.03, "square", 0.05); }
    if (padEdge("confirm")) { const c = opts[navIdx]; navIdx = 0; handleMenuKeys(c, ""); return; }
    if (padEdge("back")) { navIdx = 0; handleMenuKeys("Escape", ""); }
  } else if (state === "rules" || state === "netError") {
    if (padEdge("confirm") || padEdge("back")) handleMenuKeys("Escape", "");
  } else if (state === "gameover") {
    if (padEdge("confirm")) handleMenuKeys(online ? "KeyR" : "Space", "");
    if (padEdge("back")) handleMenuKeys("Escape", "");
  } else if (state === "hostWait" || state === "connecting" || state === "netWait" || state === "joinEntry") {
    if (padEdge("back")) handleMenuKeys("Escape", "");
  } else if (state === "hostLobby") {
    if (padEdge("confirm")) handleMenuKeys("Enter", "");
    if (padEdge("back")) handleMenuKeys("Escape", "");
  }
}

