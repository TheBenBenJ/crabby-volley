// crabby-volley · menus & écrans de sélection
"use strict";

// ---------- Écrans de menu et de sélection ----------
function handleMenuKeys(code, key) {
  // pavé numérique équivalent au clavier principal dans tous les menus
  // (sélection d'animal/terrain, difficulté, etc.) — sauf en saisie de code
  // de partie (joinEntry gère déjà Numpad lui-même, plus bas).
  if (state !== "joinEntry" && /^Numpad[0-9]$/.test(code)) code = "Digit" + code.slice(-1);
  if (code === "NumpadEnter") code = "Enter";

  // suite de touches "6-6-6" : marche sur tous les écrans de menu (accueil,
  // règles, difficulté, choix du mode, sélection perso/terrain, lobby en
  // ligne…) — seulement pas pendant la saisie d'un code de partie ni en
  // pleine partie, où les chiffres ont un autre sens.
  if (!MENU_LIKE_EXCLUDED.has(state)) {
    if (code === "Digit6") {
      darkSeq = (darkSeq + "6").slice(-3);
      if (darkSeq === "666") { setDarkMode(!darkMode); darkSeq = ""; beep(darkMode ? 140 : 90, 0.3, "sawtooth", 0.2, 0, 60); }
    } else if (/^Digit[0-9]$/.test(code)) darkSeq = "";
  } else {
    darkSeq = "";
  }

  // M coupe le son — sauf pendant la saisie d'un code (M peut en faire partie).
  // code (position physique, norme QWERTY) ≠ lettre imprimée sur un clavier
  // AZERTY : la touche M y est déplacée à l'emplacement "Semicolon" (celle du
  // point-virgule QWERTY), et "KeyM" y correspond à la virgule. On accepte les
  // deux pour que "M" fonctionne, qu'on soit en QWERTY ou en AZERTY.
  if ((code === "KeyM" || code === "Semicolon") && state !== "joinEntry") { muted = !muted; saveSettings(); return; }
  if (code === "KeyN" && state !== "joinEntry") { musicOn = !musicOn; saveSettings(); return; }

  // clic sur l'icône/le libellé "VOLUME" (voir drawVolumeControl) : coupe/
  // rétablit le son, comme M — indépendant du niveau réglé sur les crans.
  if (code === "MuteToggle") { muted = !muted; saveSettings(); return; }

  // clic sur un cran du slider de volume (voir drawVolumeControl) : règle le
  // niveau et réactive le son au passage, où qu'on soit dans les menus.
  const volMatch = /^Vol([1-5])$/.exec(code);
  if (volMatch) { muted = false; setVolume(Number(volMatch[1]) / 5); return; }

  if (state === "menu") {
    // Écran d'accueil : 3 grandes catégories, chacune débouche sur ses propres
    // sous-choix (difficulté, mode de jeu…) au lieu d'un mur de 8 options.
    if (code === "Digit1") { state = "aiDifficulty"; }                        // Solo vs IA
    if (code === "Digit2") { pendingMode = { vsAI: false }; state = "gameModeSelect"; } // Multijoueur local
    if (code === "Digit3") {                                                  // Jouer en ligne
      if (typeof Peer === "undefined") {
        netErrorMsg = "PeerJS n'a pas pu être chargé — le mode en ligne nécessite Internet.";
        state = "netError";
      } else {
        state = "onlineMenu";
      }
    }
    if (code === "KeyR") state = "rules";

  } else if (state === "aiDifficulty") {
    // Étape 2 (Solo vs IA) : la difficulté choisie amorce pendingMode, complété
    // ensuite par le mode de jeu dans "gameModeSelect".
    const lvl = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[code];
    if (lvl !== undefined) { pendingMode = { vsAI: true, aiLevel: lvl }; state = "gameModeSelect"; }
    if (code === "Escape") state = "menu";

  } else if (state === "gameModeSelect") {
    // Étape finale avant le choix d'animal : type de partie. La 2v2 (toi + IA
    // coéquipière vs 2 IA) n'a de sens que côté Solo — hors-ligne, seul le
    // slot 0 est humain (voir update()/aiInput2v2 dans 08-ai.js/13-simulation.js).
    // La Bombe est désormais un MODIFICATEUR : dispo en 1v1 comme en 2v2.
    // Choisir une option Bombe amène à l'écran de durée (5/7/10 s).
    if (pendingMode.vsAI) {
      if (code === "Digit1") { startAnimalSelect(); }                              // 1v1 classique
      if (code === "Digit2") { pendingMode.mode2v2 = true; startAnimalSelect(); }   // 2v2 (toi + IA vs 2 IA)
      if (code === "Digit3") { pendingMode.bomb = true; state = "bombDuration"; }   // 💣 Bombe 1v1
      if (code === "Digit4") { pendingMode.bomb = true; pendingMode.mode2v2 = true; state = "bombDuration"; } // 💣 Bombe 2v2
    } else {
      if (code === "Digit1") { startAnimalSelect(); }                              // 1v1 classique
      if (code === "Digit2") { pendingMode.bomb = true; state = "bombDuration"; }   // 💣 Bombe (2 joueurs)
    }
    if (code === "Escape") state = pendingMode.vsAI ? "aiDifficulty" : "menu";

  } else if (state === "bombDuration") {
    // durée de la mèche, commune à tous les modes (offline & hôte online)
    const d = { Digit1: 0, Digit2: 1, Digit3: 2 }[code];
    if (d !== undefined) { pendingMode.bombTime = BOMB_DURATIONS[d].ticks; startAnimalSelect(); }
    if (code === "Escape") state = pendingMode.online ? "onlineMenu" : "gameModeSelect";

  } else if (state === "rules") {
    if (code === "Escape" || code === "Enter" || code === "Space" || code === "KeyR") state = "menu";

  } else if (state === "onlineMenu") {
    if (code === "Digit1") { pendingMode = { online: true }; startAnimalSelect(); }
    if (code === "Digit3") { pendingMode = { online: true, o2v2: true }; startAnimalSelect(); }
    if (code === "Digit4") { pendingMode = { online: true, bomb: true }; state = "bombDuration"; }             // 💣 Bombe 1v1 en ligne
    if (code === "Digit5") { pendingMode = { online: true, o2v2: true, bomb: true }; state = "bombDuration"; }  // 💣 Bombe 2v2 en ligne
    if (code === "Digit2") { joinCode = ""; state = "joinEntry"; }
    if (code === "Escape") state = "menu";

  } else if (state === "hostLobby") {
    if ((code === "Enter" || code === "Space") && guests.length >= 1) hostStartMatch2v2();
    if (code === "Escape") { quitOnline(); }

  } else if (state === "joinEntry") {
    if (code === "Escape") { state = "onlineMenu"; return; }
    if (code === "Backspace") { joinCode = joinCode.slice(0, -1); return; }
    if (code === "Enter" && joinCode.length === CODE_LEN) {
      initGuestPeer(joinCode);
      state = "connecting";
      return;
    }
    // chiffres : par touche physique (fiable sur AZERTY) ; lettres : par e.key
    let ch = null;
    if (/^(Digit|Numpad)[0-9]$/.test(code)) ch = code.slice(-1);
    else if (key && key.length === 1) ch = key.toUpperCase();
    if (ch && CODE_ALPHABET.includes(ch) && joinCode.length < CODE_LEN) joinCode += ch;

  } else if (state === "hostWait" || state === "connecting" || state === "netWait") {
    if (code === "Escape") { teardownNet(); state = "onlineMenu"; }

  } else if (state === "netError") {
    if (code === "Escape" || code === "Enter" || code === "Space") state = "menu";

  } else if (state === "selectAnimal") {
    const slot = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 }[code];
    const vis = visibleAnimalIdx();
    const n = slot !== undefined && slot < vis.length ? vis[slot] : undefined;
    if (n !== undefined) {
      (selPlayer === 0 ? blobL : blobR).animal = n;
      if (pendingMode.online) {
        if (netRole === "guest") {
          // l'invité a choisi : on prévient l'hôte, qui lancera la partie
          sendRel({ t: "hello", animal: n });
          state = "netWait";
        } else {
          state = "selectTerrain"; // l'hôte choisit aussi le terrain
        }
      } else if (selPlayer === 0 && !pendingMode.vsAI) {
        selPlayer = 1; // au joueur vert de choisir
      } else {
        if (pendingMode.vsAI) blobR.animal = randomAnimalIdx();
        state = "selectTerrain";
      }
    }
    if (code === "Escape") {
      if (pendingMode.online && netRole === "guest") quitOnline();
      else state = pendingMode.online ? "onlineMenu" : "gameModeSelect"; // garde le contexte (difficulté/local)
    }

  } else if (state === "selectTerrain") {
    const slotT = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[code];
    const visT = visibleTerrainIdx();
    const n = slotT !== undefined && slotT < visT.length ? visT[slotT] : undefined;
    if (n !== undefined) { terrain = n; commitSetup(); }
    if (code === "Escape") { selPlayer = 0; state = "selectAnimal"; }

  } else if (state === "gameover") {
    if (online && mode === "2v2") {
      // 2v2 : l'hôte relance directement (renvoie "start" à tous) ; les invités attendent
      if (netRole === "host" && (code === "Enter" || code === "Space" || code === "KeyR")) hostStartMatch2v2();
      if (code === "Escape") quitOnline();
    } else if (online) {
      if (code === "KeyR" && !rematchMe) {
        rematchMe = true;
        sendRel({ t: "rematch" });
        if (netRole === "host" && rematchPeer) hostStartMatch();
      }
      if (code === "Escape") quitOnline();
    } else if (code === "Space" || code === "Enter") {
      state = "menu";
    }

  } else if (code === "KeyP") {
    if (!online) paused = !paused; // pas de pause manuelle en ligne
  } else if (code === "Escape") {
    if (online) quitOnline();
    else { paused = false; state = "menu"; }
  }
}

function startAnimalSelect() {
  selPlayer = 0;
  state = "selectAnimal";
}

// Valide la configuration choisie (fin de selectTerrain) et lance la partie
// ou l'hébergement en ligne. Point unique : applique bombMode + bombTime
// (5/7/10 s) pour TOUS les modes — 1v1, 2v2 et en ligne.
function commitSetup() {
  bombMode = !!pendingMode.bomb;
  bombTime = pendingMode.bombTime || BOMB_TIME;
  if (pendingMode.online) {
    // l'hôte diffusera bombMode/bombTime dans son message "start" (voir 15-net.js)
    if (pendingMode.o2v2) { state = "hostLobby"; initHostPeer2v2(); }
    else { state = "hostWait"; initHostPeer(); }
  } else {
    vsAI = pendingMode.vsAI;
    if (pendingMode.vsAI) aiLevel = pendingMode.aiLevel;
    setMode(pendingMode.mode2v2 ? "2v2" : "1v1");
    newGame();
  }
}

function newGame(seed) {
  // graine partagée : en ligne, l'hôte l'enverra à l'invité (voir MULTIJOUEUR.md)
  setSeed(seed !== undefined ? seed : (Math.random() * 2 ** 31) | 0);
  tick = 0;
  scores[0] = 0; scores[1] = 0;
  blobL.speedMul = 1;
  blobR.speedMul = vsAI ? AI_LEVELS[aiLevel].speedMul : 1;
  if (mode === "2v2" && !online) {
    // HORS-LIGNE : les trois IA (blob2L coéquipier, blobR + blob2R adverses)
    // prennent la vitesse du niveau ; le joueur (blobL) garde 1. Animaux au hasard.
    // (En ligne, l'hôte fixe animaux et vitesses — voir hostStartMatch2v2.)
    const sm = AI_LEVELS[aiLevel].speedMul;
    blob2L.speedMul = sm; blobR.speedMul = sm; blob2R.speedMul = sm;
    for (const b of [blob2L, blobR, blob2R]) b.animal = randomAnimalIdx();
    blob2L._aiT = blobR._aiT = blob2R._aiT = 0; // timers IA neutres
  }
  particles.length = 0;
  aiErr = 0; aiErrTimer = 0; aiRush = false; // repart d'un état IA neutre (déterminisme)
  xOn.fill(false);
  for (const b of [blobL, blob2L, blobR, blob2R]) b._xSpd = undefined;
  streak[0] = streak[1] = 0; superCharge[0] = superCharge[1] = 0;
  superFlash = ""; superFlashT = 0;
  resetWeather();
  servingSide = rng() < 0.5 ? 0 : 1;
  startRally();
}

// ---------- Design-system de l'interface (registre "suisse") ----------
// Mise en page éditoriale calée à gauche : kicker mono en capitales, gros titre
// grotesque, filet, listes à index mono. Palette restreinte + un accent.
const UI = {
  mx: 66,                              // marge gauche (colonne d'accroche)
  ink: "#f4f5f7",                      // encre (quasi-blanc) sur le voile sombre
  muted: "rgba(244,245,247,0.52)",
  faint: "rgba(244,245,247,0.15)",
  accent: "#ff3b3b",                   // accent unique
  gold: "#ffcc00",
  mono: "'Space Mono', ui-monospace, monospace",
  sans: "'Inter', system-ui, sans-serif"
};
function uiAccent() { return darkMode ? "#ff2e2e" : UI.accent; }

// libellé mono en capitales, espacé (kicker / folio / label technique)
function uiLabel(txt, x, y, size, col, spacing, align) {
  ctx.save();
  ctx.textAlign = align || "left";
  ctx.fillStyle = col || UI.muted;
  ctx.font = "700 " + (size || 12) + "px " + UI.mono;
  try { ctx.letterSpacing = (spacing == null ? 2 : spacing) + "px"; } catch (e) {}
  ctx.fillText(txt.toUpperCase(), x, y);
  ctx.restore();
}
function uiRule(x1, x2, y, col) {
  ctx.strokeStyle = col || UI.faint;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x1, y + 0.5); ctx.lineTo(x2, y + 0.5); ctx.stroke();
}

// Habillage commun d'un écran de menu : monde animé en fond + voile éditorial,
// kicker + titre flush-left + filet + sous-titre + folio de pied de page.
// Signature objet : { title, subtitle, kicker, titleSize }.
function menuScreenBase(o) {
  if (typeof o === "string") o = { title: o, subtitle: arguments[1], titleSize: arguments[2] };
  drawBackground();
  drawNet();
  blobL.draw();
  blobR.draw();
  // voile : dégradé sombre plus dense à gauche (colonne de texte)
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, darkMode ? "rgba(22,0,0,0.92)" : "rgba(10,11,16,0.90)");
  g.addColorStop(0.6, darkMode ? "rgba(22,0,0,0.74)" : "rgba(10,11,16,0.70)");
  g.addColorStop(1, darkMode ? "rgba(22,0,0,0.5)" : "rgba(10,11,16,0.46)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (darkMode) drawHellVignette();

  const mx = UI.mx, acc = uiAccent();
  uiLabel(o.kicker || (darkMode ? "VOLLEY DES GÉNITAUX" : "Crabby Volley"), mx, 82, 12, acc, 3);
  ctx.textAlign = "left";
  ctx.fillStyle = UI.ink;
  ctx.font = "800 " + (o.titleSize || 42) + "px " + UI.sans;
  ctx.fillText(o.title, mx, 130);
  uiRule(mx, W - mx, 150, UI.faint);
  if (o.subtitle) uiLabel(o.subtitle, mx, 174, 12, UI.muted, 1);

  // folio de pied de page : court rappel à gauche, signature à droite.
  // (les écrans qui ont plus d'infos les posent PLUS HAUT, cf. drawMenu.)
  uiRule(mx, W - mx, H - 42, UI.faint);
  if (!o.noEscHint) uiLabel("Échap ← Retour", mx, H - 26, 10, UI.muted, 1.5);
  uiLabel(darkMode ? "Pussy Volley" : "Crabby Volley", W - mx, H - 26, 10, UI.muted, 1.5, "right");
}

// petite ambiance "Belzébuth" superposée aux écrans de menu concernés :
// vignette rouge sur les bords + braises qui remontent.
function drawHellVignette() {
  const t = performance.now() / 1000;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.8);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(140,0,0,0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const cyc = (t * (24 + (i % 5) * 5) + i * 53) % (H + 40);
    const ex = (i * 97.3) % W + Math.sin(t * 2 + i) * 14;
    const ey = H - cyc;
    ctx.globalAlpha = Math.max(0, 1 - cyc / (H + 40)) * 0.85;
    ctx.fillStyle = i % 3 === 0 ? "#ffcf3d" : "#ff5a2e";
    ctx.beginPath(); ctx.arc(ex, ey, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- Souris : clic pour naviguer dans les menus ----------
// Chaque écran de menu enregistre ses zones cliquables via hit() pendant son
// tracé. menuHitboxes (en construction cette frame) devient menuHitboxesPrev
// au tout début du prochain render() — ainsi hover/clic testent toujours des
// zones correspondant à ce qui est RÉELLEMENT affiché à l'écran (pas de zone
// à moitié construite), avec un décalage d'une seule frame, imperceptible.
let menuHitboxes = [];
let menuHitboxesPrev = [];
function hit(cx, cy, w, h, code) {
  menuHitboxes.push({ x: cx - w / 2, y: cy - h / 2, w, h, code });
}
function hitTestIn(list, x, y) {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.code;
  }
  return null;
}
function isHover(code) {
  return mouseActive && hitTestIn(menuHitboxesPrev, mouseX, mouseY) === code;
}

// liste verticale d'options, calée à gauche : index mono + libellé grotesque.
// L'élément surligné (manette) reçoit une barre d'accent et passe en gras.
// Les chaînes gardent le format "N  —  Libellé" (l'index est extrait/mis en mono).
function drawOptionList(items, y0, spacing, font) {
  const mx = UI.mx;
  ctx.textAlign = "left";
  items.forEach(([txt, col], i) => {
    const y = y0 + i * spacing;
    const parts = txt.split("—");
    const idx = parts[0].trim();
    const label = parts.length > 1 ? parts.slice(1).join("—").trim() : txt;
    // code clavier associé : chiffre → DigitN, lettre seule (ex. "R") → KeyX
    const code = /^[0-9]$/.test(idx) ? "Digit" + idx : "Key" + idx;
    hit(W / 2, y - 6, W - mx * 2, spacing - 6, code);
    const sel = (padConnected && navIdx === i) || isHover(code);
    if (sel) { ctx.fillStyle = uiAccent(); ctx.fillRect(mx - 20, y - 16, 6, 22); }
    // index en mono
    ctx.textAlign = "left";
    ctx.fillStyle = sel ? uiAccent() : UI.muted;
    ctx.font = "700 16px " + UI.mono;
    ctx.fillText(idx, mx, y);
    // libellé grotesque ; on garde une teinte pour les items « spéciaux »
    const special = col && col !== "#fff";
    ctx.fillStyle = sel ? UI.ink : (special ? col : UI.ink);
    ctx.font = (sel ? "700 " : "500 ") + "22px " + UI.sans;
    ctx.fillText(label, mx + 42, y);
  });
}

// petit contrôle de volume (5 crans cliquables, même langage visuel que les
// jauges de stats des animaux) — un clic sur un cran règle le volume
// directement à ce niveau, et réactive le son au passage s'il était coupé.
// (x, y) = coin haut-droit (aligné à droite, comme le kicker est à gauche).
function drawVolumeControl(x, y) {
  const bw = 14, gap = 4, n = 5;
  const totalW = n * bw + (n - 1) * gap;
  const labelGap = 78; // place réservée au libellé à gauche des crans
  const bx0 = x - labelGap - totalW;
  // icône + libellé : clic = coupe/rétablit le son (comme M), indépendamment du niveau
  const hov = isHover("MuteToggle");
  hit(x - labelGap / 2, y - 5, labelGap, 18, "MuteToggle");
  ctx.textAlign = "right";
  ctx.font = "700 10px " + UI.mono;
  ctx.fillStyle = hov ? UI.gold : UI.muted;
  ctx.fillText((muted ? "🔇" : "🔊") + " VOLUME", x, y);
  for (let i = 0; i < n; i++) {
    const bxi = bx0 + i * (bw + gap);
    const code = "Vol" + (i + 1);
    hit(bxi + bw / 2, y - 4, bw + gap, 18, code);
    const filled = !muted && volume * n > i + 0.001;
    ctx.fillStyle = filled ? UI.gold : "rgba(255,255,255,0.18)";
    ctx.fillRect(bxi, y - 9, bw, 9);
    if (isHover(code)) { ctx.strokeStyle = UI.gold; ctx.lineWidth = 1.5; ctx.strokeRect(bxi - 1, y - 10, bw + 2, 11); }
  }
}

function drawMenu() {
  const nP = visibleAnimalIdx().length, nT = visibleTerrainIdx().length;
  menuScreenBase({ title: darkMode ? "PUSSY VOLLEY" : "CRABBY VOLLEY",
                   kicker: (darkMode ? "Volley des génitaux · " : "Volley des animaux · ") + nP + " persos · " + nT + " terrains",
                   titleSize: 58, noEscHint: true });
  drawVolumeControl(W - UI.mx, 82);

  // écran d'accueil : 3 grandes catégories + les règles, chacune débouche
  // ensuite sur ses propres sous-choix (difficulté, mode de jeu…)
  const items = [
    ["1  —  Solo contre l'IA", "#fff"],
    ["2  —  Multijoueur local (même écran)", "#fff"],
    ["3  —  Jouer en ligne (avec un ami)", "#fff"],
    ["R  —  Règles du jeu & animaux", "#fff"]
  ];
  drawOptionList(items, 226, 44);

  // bloc d'infos technique (au-dessus du folio pour ne pas se chevaucher) —
  // le mode de contrôle réellement actif (manette/tactile/clavier), pas
  // toujours le clavier par défaut même si une manette est branchée ou qu'on
  // joue au doigt.
  uiLabel(controlsHint(), UI.mx, H - 58, 10, controlsHintColor(), 1);
  uiLabel("Premier à " + WIN_SCORE + " · 2 pts d'écart · " + MAX_TOUCHES + " touches max · P pause · M son · N musique",
          UI.mx, H - 26, 10, UI.muted, 1);
}

// résumé du mode de contrôle ACTIF (manette branchée > tactile détecté >
// clavier par défaut), utilisé partout où un rappel des commandes est affiché
// — sans ça, un joueur à la manette ou au doigt ne voyait toujours QUE des
// raccourcis clavier, jamais mis à jour selon son matériel réel.
function controlsHint() {
  if (padConnected) return "🎮 Manette — stick/croix choisir · A valider · B retour";
  if (hasTouch) return "📱 Tactile — pavé directionnel + boutons SAUT/SUPER à l'écran pendant la partie";
  return "Gauche  Q/D + Z/Espace · S super        Droite  ← → + ↑ · ↓ super";
}
function controlsHintColor() { return (padConnected || hasTouch) ? "#7ed957" : UI.muted; }

// ---------- Assistant de configuration : position dans le parcours ----------
// Le nombre total d'étapes DÉPEND DU CHEMIN (IA ou non, Bombe ou non) — jamais
// fixe. Tant que le choix Bombe n'est pas encore fait (Difficulté/Format), ce
// total n'est pas connu à l'avance : on affiche alors SEULEMENT le numéro
// d'étape (jamais un "/total" qui serait faux un coup sur deux). Dès que le
// chemin est fixé (Durée de mèche puis Personnage/Terrain), le total exact
// s'affiche — et coïncide alors avec l'étape courante pour la toute dernière.
function wizardTotal() {
  return (pendingMode.vsAI ? 1 : 0) + 1 /* Format (ou l'écran "Jouer en ligne") */
       + (pendingMode.bomb ? 1 : 0) + 2 /* Personnage + Terrain */;
}
function wizardStepOnly(idx, label) { return "Étape " + idx + " · " + label; }
function wizardStep(idx, label) { return "Étape " + idx + "/" + wizardTotal() + " · " + label; }

function drawAiDifficulty() {
  menuScreenBase({ title: "Solo contre l'IA", kicker: wizardStepOnly(1, "Difficulté"),
                   subtitle: "Choisis la difficulté de l'adversaire" });
  const items = [
    ["1  —  Facile", "#7ed957"],
    ["2  —  Normale", UI.gold],
    ["3  —  Difficile", UI.accent],
    ["4  —  Impitoyable  ☠", "#c48cff"]
  ];
  drawOptionList(items, 238, 50);
}

function drawGameModeSelect() {
  const subtitle = pendingMode.vsAI
    ? "Solo — " + AI_LEVELS[pendingMode.aiLevel].name + "  —  choisis le mode de jeu"
    : "Multijoueur local  —  choisis le mode de jeu";
  menuScreenBase({ title: "Mode de jeu", kicker: wizardStepOnly(pendingMode.vsAI ? 2 : 1, "Format"), subtitle: subtitle });

  const items = pendingMode.vsAI ? [
    ["1  —  1v1 classique", "#fff"],
    ["2  —  2v2 : toi + IA  vs  2 IA", "#fff"],
    ["3  —  💣 Bombe 1v1", "#ff7043"],
    ["4  —  💣 Bombe 2v2", "#ff7043"]
  ] : [
    ["1  —  1v1 classique", "#fff"],
    ["2  —  💣 Bombe 1v1", "#ff7043"]
  ];
  drawOptionList(items, 236, 48);
}

function drawBombDuration() {
  menuScreenBase({ title: "Mode Bombe", kicker: wizardStep(wizardTotal() - 2, "💣 Durée de mèche"),
                   subtitle: "Renvoie la bombe avant la fin de la mèche" });
  const items = [
    ["1  —  5 secondes   ·   nerveux", UI.accent],
    ["2  —  7 secondes   ·   équilibré", UI.gold],
    ["3  —  10 secondes   ·   posé", "#7ed957"]
  ];
  drawOptionList(items, 240, 52);
}

function drawRules() {
  hit(W / 2, H / 2, W, H, "Escape"); // clic n'importe où = retour
  // fond sombre
  ctx.fillStyle = darkMode ? "#160303" : "#0e0f14";
  ctx.fillRect(0, 0, W, H);
  if (darkMode) drawHellVignette();
  uiLabel(darkMode ? "Belzébuth · Manuel" : "Manuel du joueur", UI.mx, 30, 10, uiAccent(), 2);
  ctx.textAlign = "left"; ctx.fillStyle = UI.ink;
  ctx.font = "800 24px " + UI.sans;
  ctx.fillText(darkMode ? "Règles des Enfers" : "Règles du jeu", UI.mx, 54);
  uiRule(UI.mx, W - UI.mx, 66, UI.faint);

  // colonne gauche : règles générales (bornée pour ne jamais mordre sur la droite)
  const lx = UI.mx;
  const leftMaxW = W / 2 - UI.mx - 16;
  const hCol = darkMode ? "#ff6a4d" : "#7ed957";
  ctx.textAlign = "left";
  let y = 78;
  const h = (txt, c) => { ctx.fillStyle = c || hCol; ctx.font = "700 15px " + UI.sans; ctx.fillText(txt, lx, y); y += 20; };
  const p = (txt) => {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "13px " + UI.sans;
    const words = txt.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > leftMaxW && line) {
        ctx.fillText(line, lx, y); y += 17; line = w;
      } else line = test;
    }
    if (line) { ctx.fillText(line, lx, y); y += 17; }
  };

  h("But du jeu");
  p("Faire tomber la balle dans le camp adverse.");
  p("Premier à " + WIN_SCORE + " points avec 2 points d'écart gagne.");
  p("Maximum " + MAX_TOUCHES + " touches par camp avant de renvoyer.");
  y += 6;
  h("Commandes");
  p("Gauche : Q/D bouger, Z ou Espace sauter.");
  p("Droite : ← → bouger, ↑ sauter. (en ligne : les deux)");
  p("Manette : stick bouger, A sauter, B/gâchette SUPER.");
  p("SUPER : Gauche = S · Droite = ↓");
  p("Double saut : réappuie en l'air.");
  p("P pause · M son · N musique · Échap menu");
  y += 6;
  h("★ Techniques SUPER", "#ffd93d");
  p("3 points d'affilée chargent ta jauge de SUPER.");
  p("Une fois prête, déclenche la technique de ton animal (fiche à droite).");
  y += 4;
  h(darkMode ? "Météo & Duel infernal" : "Météo & Smash Battle", darkMode ? "#ff9a4d" : "#4db3ff");
  p("Intempérie : sol glissant, balle plus lourde.");
  p("Deux au filet, balle proche : duel de martelage → smash !");

  // colonne droite : animaux + stats + traits
  const rx = W / 2 + 20;
  ctx.textAlign = "left";
  ctx.fillStyle = hCol;
  ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
  ctx.fillText(darkMode ? "Les damnés" : "Les animaux", rx, 78);
  ctx.font = "11px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("V=Vitesse  D=Détente  P=Puissance  C=Contrôle", rx, 96);

  const cellW = (W / 2 - 60) / 2;
  const visR = visibleAnimalIdx();
  // 5 animaux → 3 rangées : on resserre l'espacement pour ne pas déborder
  const compact = visR.length > 4;
  const rowH = compact ? 120 : 168;
  const ay0 = compact ? 104 : 118;
  for (let slot = 0; slot < visR.length; slot++) {
    const i = visR[slot];
    const a = ANIMALS[i];
    const col = slot % 2, row = Math.floor(slot / 2);
    const ax = rx + col * (cellW + 20);
    const ay = ay0 + row * rowH;

    // aperçu de l'animal
    drawAnimal({ x: ax + 28, y: ay + 70, groundY: ay + 70, side: 0,
      color: "#e84545", darkColor: "#b32e2e",
      onGround: true, vx: 0, walkPhase: 0, squash: 0, animal: i, molt: 0 });

    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px 'Inter', system-ui, sans-serif";
    ctx.fillText(a.name, ax + 62, ay + 22);

    // mini-jauges
    const st = a.stats;
    const pairs = [["V", st.vitesse], ["D", st.detente], ["P", st.puissance], ["C", st.controle]];
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    pairs.forEach((pr, k) => {
      const gy = ay + 38 + k * 15;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(pr[0], ax + 62, gy + 8);
      for (let s = 0; s < 5; s++) {
        ctx.fillStyle = s < pr[1] ? "#ffcc00" : "rgba(255,255,255,0.18)";
        ctx.fillRect(ax + 74 + s * 11, gy, 8, 8);
      }
    });

    // trait
    ctx.fillStyle = "rgba(255,204,0,0.9)";
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    wrapText2(a.trait, ax, ay + (compact ? 106 : 116), cellW - 4, 13);
  }

  uiLabel("Échap ← Retour au menu", UI.mx, H - 14, 10, UI.muted, 1.5);
}

// texte multi-lignes aligné à gauche
function wrapText2(text, x, y, maxW, lh) {
  const words = text.split(" ");
  let line = "", yy = y;
  ctx.textAlign = "left";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawStatGauge(x, y, label, val) {
  ctx.textAlign = "left";
  ctx.font = "11px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(label, x, y - 3);
  for (let k = 0; k < 5; k++) {
    ctx.fillStyle = k < val ? "#ffcc00" : "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 62 + k * 13, y - 11, 10, 9);
  }
}

function drawSelectAnimal() {
  drawBackground();
  drawNet();
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, darkMode ? "rgba(22,0,0,0.9)" : "rgba(10,11,16,0.88)");
  gr.addColorStop(1, darkMode ? "rgba(22,0,0,0.78)" : "rgba(10,11,16,0.72)");
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  if (darkMode) drawHellVignette();

  const pcolor = darkMode ? "#ff5a3d" : "#ffd36b";
  const pdark  = darkMode ? "#7a1408" : "#d99e18";
  // en-tête éditorial compact (au-dessus de la rangée de cartes) — l'invité en
  // ligne ne choisit que son personnage (l'hôte gère le terrain) : un compteur
  // d'étape n'a pas de sens pour lui, un simple libellé suffit.
  const guestPicking = pendingMode.online && netRole === "guest";
  uiLabel(guestPicking ? "En ligne · Ton personnage" : wizardStep(wizardTotal() - 1, "Personnage"),
          UI.mx, 34, 11, uiAccent(), 2);
  ctx.textAlign = "left"; ctx.fillStyle = UI.ink;
  ctx.font = "800 26px " + UI.sans;
  ctx.fillText("Joueur " + sideName(selPlayer) + (darkMode ? " — choisis ton génital" : " — choisis ton animal"), UI.mx, 60);

  const vis = visibleAnimalIdx();
  const cw = W / vis.length; // largeur de carte adaptative (4, 5 ou 6 animaux…)
  for (let slot = 0; slot < vis.length; slot++) {
    const i = vis[slot];
    const cx = cw * slot + cw / 2;
    const a = ANIMALS[i];
    const code = "Digit" + (slot + 1);
    hit(cx, 240, cw, 336, code);
    if ((padConnected && navIdx === slot) || isHover(code)) {
      // carte surlignée (manette ou survol souris)
      ctx.strokeStyle = "#ffcc00";
      ctx.lineWidth = 3;
      ctx.strokeRect(cw * slot + 8, 72, cw - 16, 336);
    }
    const preview = {
      x: cx, y: 168, groundY: 168,
      side: selPlayer, color: pcolor, darkColor: pdark,
      onGround: true, vx: 0, walkPhase: 0, squash: 0, animal: i, molt: 0
    };
    drawAnimal(preview);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    // police du nom adaptée au nombre de cartes (plus serré à 5-6 animaux)
    ctx.font = "bold " + (vis.length >= 6 ? 14 : vis.length === 5 ? 16 : 20) + "px 'Inter', system-ui, sans-serif";
    ctx.fillText((slot + 1) + " — " + a.name, cx, 205);

    // jauges de stats
    const gx = cx - 68, gy0 = 232;
    drawStatGauge(gx, gy0,      "Vitesse",   a.stats.vitesse);
    drawStatGauge(gx, gy0 + 20, "Détente",   a.stats.detente);
    drawStatGauge(gx, gy0 + 40, "Puissance", a.stats.puissance);
    drawStatGauge(gx, gy0 + 60, "Contrôle",  a.stats.controle);

    // trait spécial (encadré, sur plusieurs lignes)
    ctx.textAlign = "center";
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,204,0,0.92)";
    wrapText(a.trait, cx, 322, cw - 30, 14);

    // technique SUPER
    ctx.fillStyle = "#ffd93d";
    ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
    ctx.fillText("★ " + a.superName, cx, 372);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    wrapText(a.superDesc, cx, 388, cw - 26, 13);
  }

  uiLabel("3 points d'affilée chargent le SUPER (S / ↓)   ·   Choisis 1 – " + vis.length + "   ·   Échap ← retour",
          UI.mx, 466, 10, UI.muted, 1);
}

// utilitaire : texte multi-lignes centré
function wrapText(text, cx, y, maxW, lh) {
  const words = text.split(" ");
  let line = "", lines = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
}

function drawSelectTerrain() {
  ctx.fillStyle = darkMode ? "#160303" : "#0e0f14";
  ctx.fillRect(0, 0, W, H);
  if (darkMode) drawHellVignette();
  uiLabel(wizardStep(wizardTotal(), "Terrain"), UI.mx, 40, 11, uiAccent(), 2);
  ctx.textAlign = "left"; ctx.fillStyle = UI.ink;
  ctx.font = "800 30px " + UI.sans;
  ctx.fillText(darkMode ? "Choisis ton bourbier" : "Choisis le terrain", UI.mx, 74);
  uiRule(UI.mx, W - UI.mx, 92, UI.faint);

  const visT = visibleTerrainIdx();
  // largeur de vignette adaptée au nombre de terrains (tient sur 900px de large)
  const n = visT.length, gap = 20;
  const pw = Math.min(250, Math.floor((W - 40 - (n - 1) * gap) / n)), ph = 170, py = 130;
  const rowW = n * pw + (n - 1) * gap, startX = (W - rowW) / 2;
  for (let slot = 0; slot < n; slot++) {
    const i = visT[slot];
    const px = startX + slot * (pw + gap);
    // aperçu réduit du terrain (le vrai rendu, animé)
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    ctx.translate(px, py);
    ctx.scale(pw / W, ph / H);
    const saved = terrain;
    terrain = i;
    drawBackground();
    drawNet();
    terrain = saved;
    ctx.restore();

    const code = "Digit" + (slot + 1);
    hit(px + pw / 2, py + ph / 2, pw, ph + 40, code);
    const sel = (padConnected && navIdx === slot) || isHover(code);
    ctx.strokeStyle = sel ? (darkMode ? "#ff3b3b" : "#ffcc00") : "rgba(255,255,255,0.6)";
    ctx.lineWidth = sel ? 4 : 2;
    ctx.strokeRect(px, py, pw, ph);

    // index mono + nom du terrain, centrés sous la vignette
    ctx.textAlign = "center";
    ctx.fillStyle = sel ? uiAccent() : UI.muted;
    ctx.font = "700 12px " + UI.mono;
    ctx.fillText(String(slot + 1), px + pw / 2, py + ph + 24);
    ctx.fillStyle = sel ? UI.ink : "rgba(244,245,247,0.85)";
    ctx.font = (n > 3 ? "600 15px " : "600 18px ") + UI.sans;
    ctx.fillText(TERRAINS[i].name, px + pw / 2, py + ph + 44);
  }

  uiLabel("Choisis 1 – " + n + "   ·   Échap ← retour", UI.mx, 466, 10, UI.muted, 1);
}

