// crabby-volley · entrées — clavier & manettes (Gamepad API)
"use strict";

// ---------- Entrées clavier ----------
const keys = {};
let xSeq = "";
window.addEventListener("keydown", e => {
  keys[e.code] = true;
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","KeyW","KeyA","KeyS","KeyD"].includes(e.code)) e.preventDefault();
  const ch = (e.key || "").toLowerCase();
  if (ch.length === 1) { xSeq = (xSeq + ch).slice(-4); if (xSeq === "rler" && typeof xToggleLocal === "function") xToggleLocal(); }
  handleMenuKeys(e.code, e.key);
});
window.addEventListener("keyup", e => { keys[e.code] = false; });

// ---------- Souris (navigation des menus) ----------
// Convertit une position écran (px CSS) en repère logique 900×500 : le canvas
// est affiché à une taille CSS variable (voir resizeCanvas() dans 01-core.js),
// donc on ne peut pas comparer directement clientX/Y aux coordonnées de jeu.
let mouseX = -1, mouseY = -1, mouseActive = false;
function toGameXY(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left) / rect.width * W, y: (clientY - rect.top) / rect.height * H };
}
// portée globale (pas seulement dans le bloc ci-dessous) : les menus (12-menus.js)
// s'en servent pour adapter le texte d'aide (clavier/manette/tactile).
const hasTouch = (typeof window !== "undefined") &&
  (("ontouchstart" in window) || (navigator && navigator.maxTouchPoints > 0));
if (typeof canvas.addEventListener === "function") { // absent en environnement de test (voir tests/_load.js)
  canvas.addEventListener("mousemove", e => {
    const p = toGameXY(e.clientX, e.clientY);
    mouseX = p.x; mouseY = p.y; mouseActive = true;
  });
  canvas.addEventListener("mouseleave", () => { mouseActive = false; });
  canvas.addEventListener("click", e => {
    const p = toGameXY(e.clientX, e.clientY);
    const code = hitTestIn(menuHitboxesPrev, p.x, p.y);
    if (code) handleMenuKeys(code, "");
  });

  // ---------- Contrôles tactiles (mobile) ----------
  // Pilotent directement `keys{}`, exactement comme le clavier : aucun
  // changement requis dans localInputs()/onlineLocalInput(), qui lisent déjà
  // cet objet partagé. Le pavé tactile est UNIQUE (pas un par joueur) : sur
  // un téléphone, un seul joueur humain tient l'appareil, donc on détermine
  // dynamiquement QUEL jeu de touches physiques il pilote selon le contexte.
  if (hasTouch) {
    const tc = document.getElementById("touchControls");
    function touchKeySet() {
      if (online) {
        if (mySlot === 0) return { left: "KeyA", right: "KeyD", jump: "KeyW", super: "KeyS" };
        if (mySlot === 1) return { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", super: "ArrowDown" };
        return null; // 2v2 en ligne (slots 2/3) : pas pris en charge au tactile
      }
      if (vsAI || mode === "2v2") return { left: "KeyA", right: "KeyD", jump: "KeyW", super: "KeyS" };
      return null; // 2 joueurs locaux sur le même appareil : peu pertinent au tactile
    }
    function bindTouchBtn(sel, field) {
      const btn = tc.querySelector(sel);
      let heldCode = null;
      const press = e => {
        e.preventDefault();
        const set = touchKeySet();
        heldCode = set && set[field];
        if (heldCode) { keys[heldCode] = true; btn.classList.add("tc-active"); }
      };
      const release = e => {
        if (e) e.preventDefault();
        if (heldCode) keys[heldCode] = false;
        heldCode = null;
        btn.classList.remove("tc-active");
      };
      btn.addEventListener("touchstart", press, { passive: false });
      btn.addEventListener("touchend", release, { passive: false });
      btn.addEventListener("touchcancel", release, { passive: false });
    }
    bindTouchBtn('[data-tc="left"]', "left");
    bindTouchBtn('[data-tc="right"]', "right");
    bindTouchBtn('[data-tc="jump"]', "jump");
    bindTouchBtn('[data-tc="super"]', "super");

    // affiché uniquement pendant une manche jouable, et seulement si un jeu
    // de touches s'applique effectivement (sinon les boutons ne feraient rien)
    setInterval(() => {
      const show = (state === "play" || state === "serve") && !!touchKeySet();
      tc.classList.toggle("tc-visible", show);
    }, 200);
  }
}

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
    case "menu":          return ["Digit1", "Digit2", "Digit3", "KeyR", "KeyC"];
    case "aiDifficulty":  return ["Digit1", "Digit2", "Digit3", "Digit4"];
    case "bombDuration":  return ["Digit1", "Digit2", "Digit3"];
    // le nombre d'options dépend du contexte (Solo IA : 1v1/2v2/bombe1v1/bombe2v2 ;
    // local : 1v1 + bombe)
    case "gameModeSelect": return pendingMode && pendingMode.vsAI
      ? ["Digit1", "Digit2", "Digit3", "Digit4"] : ["Digit1", "Digit2"];
    case "onlineMenu":    return ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];
    case "selectAnimal":  return ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"].slice(0, visibleAnimalIdx().length);
    case "selectTerrain": return ["Digit1", "Digit2", "Digit3", "Digit4"].slice(0, visibleTerrainIdx().length);
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
  } else if (state === "rules" || state === "netError" || state === "credits") {
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

