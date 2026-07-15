// crabby-volley · menus & écrans de sélection
"use strict";

// ---------- Écrans de menu et de sélection ----------
function handleMenuKeys(code, key) {
  // pavé numérique équivalent au clavier principal dans tous les menus
  // (sélection d'animal/terrain, difficulté, etc.) — sauf en saisie de code
  // de partie (joinEntry gère déjà Numpad lui-même, plus bas).
  if (state !== "joinEntry" && /^Numpad[0-9]$/.test(code)) code = "Digit" + code.slice(-1);

  // M coupe le son — sauf pendant la saisie d'un code (M peut en faire partie)
  if (code === "KeyM" && state !== "joinEntry") { muted = !muted; return; }
  if (code === "KeyN" && state !== "joinEntry") { musicOn = !musicOn; return; }

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
    if (pendingMode.vsAI) {
      if (code === "Digit1") { startAnimalSelect(); }                              // 1v1 classique
      if (code === "Digit2") { pendingMode.mode2v2 = true; startAnimalSelect(); }   // 2v2 (toi + IA vs 2 IA)
      if (code === "Digit3") { pendingMode.bomb = true; startAnimalSelect(); }      // 💣 Bombe
    } else {
      if (code === "Digit1") { startAnimalSelect(); }                              // 1v1 classique
      if (code === "Digit2") { pendingMode.bomb = true; startAnimalSelect(); }      // 💣 Bombe (2 joueurs)
    }
    if (code === "Escape") state = pendingMode.vsAI ? "aiDifficulty" : "menu";

  } else if (state === "rules") {
    if (code === "Escape" || code === "Enter" || code === "Space" || code === "KeyR") state = "menu";

  } else if (state === "onlineMenu") {
    if (code === "Digit1") { pendingMode = { online: true }; startAnimalSelect(); }
    if (code === "Digit3") { pendingMode = { online: true, o2v2: true }; startAnimalSelect(); }
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
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 }[code];
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
        if (pendingMode.vsAI) blobR.animal = Math.floor(Math.random() * ANIMALS.length);
        state = "selectTerrain";
      }
    }
    if (code === "Escape") {
      if (pendingMode.online && netRole === "guest") quitOnline();
      else state = pendingMode.online ? "onlineMenu" : "gameModeSelect"; // garde le contexte (difficulté/local)
    }

  } else if (state === "selectTerrain") {
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[code];
    if (n !== undefined) {
      terrain = n;
      if (pendingMode.online) {
        bombMode = false; // le mode bombe reste hors-ligne pour l'instant
        if (pendingMode.o2v2) { state = "hostLobby"; initHostPeer2v2(); }
        else { state = "hostWait"; initHostPeer(); }
      } else {
        vsAI = pendingMode.vsAI;
        if (pendingMode.vsAI) aiLevel = pendingMode.aiLevel;
        bombMode = !!pendingMode.bomb;
        setMode(pendingMode.mode2v2 ? "2v2" : "1v1");
        newGame();
      }
    }
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
    for (const b of [blob2L, blobR, blob2R]) b.animal = Math.floor(Math.random() * ANIMALS.length);
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

// ---------- Aides d'affichage communes aux écrans de menu ----------
// Fond animé assombri + titre, pour un habillage cohérent entre l'accueil et
// les sous-écrans (une variante locale : netScreenBase existe côté 15-net.js,
// mais un module ne doit pas dépendre d'un module chargé après lui).
function menuScreenBase(title, subtitle, titleSize) {
  drawBackground();
  drawNet();
  blobL.draw();
  blobR.draw();
  ctx.fillStyle = "rgba(20,20,40,0.68)";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcc00";
  ctx.font = "bold " + (titleSize || 46) + "px 'Trebuchet MS', sans-serif";
  ctx.fillText(title, W / 2, 92);
  if (subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "17px 'Trebuchet MS', sans-serif";
    ctx.fillText(subtitle, W / 2, 122);
  }
}

// liste verticale d'options, navigable au clavier comme à la manette
function drawOptionList(items, y0, spacing, font) {
  ctx.textAlign = "center";
  ctx.font = font || "bold 24px 'Trebuchet MS', sans-serif";
  items.forEach(([txt, col], i) => {
    const sel = padConnected && navIdx === i;
    ctx.fillStyle = sel ? "#ffcc00" : col;
    ctx.fillText((sel ? "▶  " : "") + txt + (sel ? "  ◀" : ""), W / 2, y0 + i * spacing);
  });
}

function drawMenu() {
  menuScreenBase("VOLLEY DES ANIMAUX", null, 54);
  ctx.fillStyle = "#ffcc00";
  ctx.beginPath(); ctx.arc(W / 2, 125, 12, 0, Math.PI * 2); ctx.fill();

  // écran d'accueil : 3 grandes catégories + les règles, chacune débouche
  // ensuite sur ses propres sous-choix (difficulté, mode de jeu…)
  const items = [
    ["1  —  Solo contre l'IA", "#fff"],
    ["2  —  Multijoueur local (même écran)", "#fff"],
    ["3  —  Jouer en ligne (avec un ami)", "#7ed957"],
    ["R  —  Règles du jeu & animaux", "#ffcc00"]
  ];
  drawOptionList(items, 210, 42);

  ctx.font = "17px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("Gauche : Q/D + Z/Espace, S = SUPER   •   Droite : ← → + ↑, ↓ = SUPER", W / 2, 412);
  ctx.fillText("Premier à " + WIN_SCORE + " (2 pts d'écart) — " + MAX_TOUCHES + " touches max   •   P : pause   •   M : son   •   N : musique", W / 2, 438);
  if (padConnected) {
    ctx.fillStyle = "#7ed957";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.fillText("🎮 Manette détectée — croix/stick pour choisir, A pour valider, B pour revenir", W / 2, 468);
  }
}

function drawAiDifficulty() {
  menuScreenBase("Solo contre l'IA", "Choisis la difficulté");
  const items = [
    ["1  —  Facile", "#7ed957"],
    ["2  —  Normale", "#ffd93d"],
    ["3  —  Difficile", "#ff6b6b"],
    ["4  —  Impitoyable  ☠", "#c48cff"]
  ];
  drawOptionList(items, 200, 46);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "17px 'Trebuchet MS', sans-serif";
  ctx.fillText("Échap : retour", W / 2, 430);
}

function drawGameModeSelect() {
  const subtitle = pendingMode.vsAI
    ? "Solo — " + AI_LEVELS[pendingMode.aiLevel].name + "  —  choisis le mode de jeu"
    : "Multijoueur local  —  choisis le mode de jeu";
  menuScreenBase("Mode de jeu", subtitle);

  const items = pendingMode.vsAI ? [
    ["1  —  1v1 classique", "#fff"],
    ["2  —  2v2 : toi + IA  vs  2 IA", "#ffb26b"],
    ["3  —  💣 Bombe : renvoie-la avant qu'elle explose !", "#ff7043"]
  ] : [
    ["1  —  1v1 classique", "#fff"],
    ["2  —  💣 Bombe : renvoie-la avant qu'elle explose !", "#ff7043"]
  ];
  drawOptionList(items, 220, 52);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "17px 'Trebuchet MS', sans-serif";
  ctx.fillText("Échap : retour", W / 2, 430);
}

function drawRules() {
  // fond sombre
  ctx.fillStyle = "#14142a";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcc00";
  ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
  ctx.fillText("Règles du jeu", W / 2, 40);

  // colonne gauche : règles générales
  const lx = 40;
  ctx.textAlign = "left";
  let y = 78;
  const h = (txt, c) => { ctx.fillStyle = c || "#7ed957"; ctx.font = "bold 17px 'Trebuchet MS', sans-serif"; ctx.fillText(txt, lx, y); y += 22; };
  const p = (txt) => { ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "14px 'Trebuchet MS', sans-serif"; ctx.fillText(txt, lx, y); y += 19; };

  h("But du jeu");
  p("Faire tomber la balle dans le camp adverse.");
  p("Premier à " + WIN_SCORE + " points avec 2 points d'écart gagne.");
  p("Maximum " + MAX_TOUCHES + " touches par camp avant de renvoyer.");
  y += 8;
  h("Commandes");
  p("Gauche : Q/D bouger, Z ou Espace sauter.");
  p("Droite : ← → bouger, ↑ sauter. (en ligne : les deux)");
  p("Manette : stick bouger, A sauter, B/gâchette SUPER.");
  p("SUPER : Gauche = S, Droite = ↓. Double saut : réappuie en l'air.");
  p("P : pause  •  M : son  •  N : musique  •  Échap : menu");
  y += 8;
  h("★ Techniques SUPER", "#ffd93d");
  p("3 points d'affilée chargent ta jauge de SUPER.");
  p("Une fois prête, déclenche la technique de ton animal");
  p("(voir la fiche de chacun à droite). À toi de bien la placer !");
  y += 6;
  h("Météo & Smash Battle", "#4db3ff");
  p("Intempérie : sol glissant, balle plus lourde (tous terrains).");
  p("Deux au filet, balle proche : duel de martelage → smash !");

  // colonne droite : animaux + stats + traits
  const rx = W / 2 + 20;
  ctx.textAlign = "left";
  ctx.fillStyle = "#7ed957";
  ctx.font = "bold 17px 'Trebuchet MS', sans-serif";
  ctx.fillText("Les animaux", rx, 78);
  ctx.font = "11px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("V=Vitesse  D=Détente  P=Puissance  C=Contrôle", rx, 96);

  const cellW = (W / 2 - 60) / 2;
  // 5 animaux → 3 rangées : on resserre l'espacement pour ne pas déborder
  const compact = ANIMALS.length > 4;
  const rowH = compact ? 120 : 168;
  const ay0 = compact ? 104 : 118;
  for (let i = 0; i < ANIMALS.length; i++) {
    const a = ANIMALS[i];
    const col = i % 2, row = Math.floor(i / 2);
    const ax = rx + col * (cellW + 20);
    const ay = ay0 + row * rowH;

    // aperçu de l'animal
    drawAnimal({ x: ax + 28, y: ay + 70, groundY: ay + 70, side: 0,
      color: "#e84545", darkColor: "#b32e2e",
      onGround: true, vx: 0, walkPhase: 0, squash: 0, animal: i, molt: 0 });

    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px 'Trebuchet MS', sans-serif";
    ctx.fillText(a.name, ax + 62, ay + 22);

    // mini-jauges
    const st = a.stats;
    const pairs = [["V", st.vitesse], ["D", st.detente], ["P", st.puissance], ["C", st.controle]];
    ctx.font = "11px 'Trebuchet MS', sans-serif";
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
    ctx.font = "11px 'Trebuchet MS', sans-serif";
    wrapText2(a.trait, ax, ay + (compact ? 106 : 116), cellW - 4, 13);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "16px 'Trebuchet MS', sans-serif";
  ctx.fillText("Échap : retour au menu", W / 2, H - 12);
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
  ctx.font = "11px 'Trebuchet MS', sans-serif";
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
  ctx.fillStyle = "rgba(20,20,40,0.72)";
  ctx.fillRect(0, 0, W, H);

  // couleurs indicatives (le vrai rendu de l'aperçu prend la couleur naturelle
  // de l'animal via drawAnimal) : on garde juste un ton neutre pour l'en-tête.
  const pcolor = "#ffd36b";
  const pdark  = "#d99e18";
  ctx.textAlign = "center";
  ctx.fillStyle = pcolor;
  ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
  ctx.fillText("Choisis ton animal — Joueur " + sideName(selPlayer), W / 2, 52);

  const cw = W / ANIMALS.length; // largeur de carte adaptative (4 ou 5 animaux…)
  for (let i = 0; i < ANIMALS.length; i++) {
    const cx = cw * i + cw / 2;
    const a = ANIMALS[i];
    if (padConnected && navIdx === i) {
      // carte surlignée à la manette
      ctx.strokeStyle = "#ffcc00";
      ctx.lineWidth = 3;
      ctx.strokeRect(cw * i + 8, 72, cw - 16, 336);
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
    ctx.font = "bold " + (ANIMALS.length >= 6 ? 14 : ANIMALS.length === 5 ? 16 : 20) + "px 'Trebuchet MS', sans-serif";
    ctx.fillText((i + 1) + " — " + a.name, cx, 205);

    // jauges de stats
    const gx = cx - 68, gy0 = 232;
    drawStatGauge(gx, gy0,      "Vitesse",   a.stats.vitesse);
    drawStatGauge(gx, gy0 + 20, "Détente",   a.stats.detente);
    drawStatGauge(gx, gy0 + 40, "Puissance", a.stats.puissance);
    drawStatGauge(gx, gy0 + 60, "Contrôle",  a.stats.controle);

    // trait spécial (encadré, sur plusieurs lignes)
    ctx.textAlign = "center";
    ctx.font = "12px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "rgba(255,204,0,0.92)";
    wrapText(a.trait, cx, 322, cw - 30, 14);

    // technique SUPER
    ctx.fillStyle = "#ffd93d";
    ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
    ctx.fillText("★ " + a.superName, cx, 372);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px 'Trebuchet MS', sans-serif";
    wrapText(a.superDesc, cx, 388, cw - 26, 13);
  }

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "16px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Technique : 3 points d'affilée chargent le SUPER (S / ↓)", W / 2, 452);
  ctx.fillText("Appuie sur 1 – " + ANIMALS.length + "      •      Échap : retour", W / 2, 474);
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
  ctx.fillStyle = "#14142a";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcc00";
  ctx.font = "bold 34px 'Trebuchet MS', sans-serif";
  ctx.fillText("Choisis le terrain", W / 2, 75);

  // largeur de vignette adaptée au nombre de terrains (tient sur 900px de large)
  const n = TERRAINS.length, gap = 20;
  const pw = Math.min(250, Math.floor((W - 40 - (n - 1) * gap) / n)), ph = 170, py = 130;
  const rowW = n * pw + (n - 1) * gap, startX = (W - rowW) / 2;
  for (let i = 0; i < n; i++) {
    const px = startX + i * (pw + gap);
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

    const sel = padConnected && navIdx === i;
    ctx.strokeStyle = sel ? "#ffcc00" : "rgba(255,255,255,0.6)";
    ctx.lineWidth = sel ? 4 : 2;
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = "#fff";
    ctx.font = "bold " + (n > 3 ? 16 : 20) + "px 'Trebuchet MS', sans-serif";
    ctx.fillText((i + 1) + "  —  " + TERRAINS[i].name, px + pw / 2, py + ph + 35);
  }

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "18px 'Trebuchet MS', sans-serif";
  ctx.fillText("Appuie sur 1 – " + n + "      •      Échap : retour", W / 2, 460);
}

