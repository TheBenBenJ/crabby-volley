// crabby-volley · mode en ligne — PeerJS, 1v1/2v2, HUD réseau
"use strict";

// ============================================================
//                     MODE EN LIGNE (WebRTC)
// ============================================================
// Architecture "hôte autoritaire" (voir MULTIJOUEUR.md) :
//  - L'HÔTE (Rouge, à gauche) fait tourner la vraie simulation, exactement
//    comme en local. Il consomme les entrées de l'invité et diffuse des
//    instantanés (getSnapshot) à ~20 Hz + les événements via un canal fiable.
//  - L'INVITÉ (Vert, à droite) ne simule pas la partie : il envoie ses
//    entrées à 60 Hz, affiche le monde ~100 ms dans le passé en interpolant
//    entre deux instantanés, et PRÉDIT son propre personnage localement
//    (réconciliation par rejeu des entrées non encore acquittées).
// La signalisation (mise en relation par code) passe par le cloud PeerJS ;
// ensuite les données circulent en direct entre les deux navigateurs.

const SNAP_EVERY = 2;          // 1 instantané tous les 2 ticks (30 Hz)
const INTERP_DELAY = 3;        // délai d'interpolation de base (~50 ms), adaptatif
const INTERP_MIN = 2.5;        // plancher du délai (bonne connexion)
const INTERP_MAX = 7;          // plafond du délai (connexion instable)
const EXTRAP_MAX = 8;          // ticks d'extrapolation max quand un snapshot tarde
const NET_TIMEOUT = 2500;      // ms de silence → pause "connexion instable"
const RECONCILE_SNAP = 60;     // px d'écart au-delà desquels on téléporte
const CODE_LEN = 5;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I/O/0/1
const PEER_PREFIX = "vda26-";  // espace de noms sur le cloud PeerJS

let online = false;            // mode en ligne actif (dès le lobby)
let netRole = null;            // "host" | "guest"
let netConnected = false;      // les deux canaux WebRTC sont ouverts
let peer = null;               // objet Peer (PeerJS)
let connRel = null;            // canal fiable : hello/start/rematch/bye
let connFast = null;           // canal non fiable : inputs/snapshots/ping
let peerReady = false;         // l'hôte est enregistré (code utilisable)
let netCode = "";              // code de la partie (hôte)
let joinCode = "";             // saisie du code (invité)
let netErrorMsg = "";
let matchId = 0;               // n° de manche : ignore les paquets périmés

// --- côté hôte ---
let guestIn = { left: false, right: false, jump: false }; // dernière entrée reçue (1v1)
let guestInSeq = 0;            // n° de séquence de cette entrée (= ack renvoyé)
let netFrame = 0;              // cadence d'envoi des snapshots
let lastPeerMsg = 0;           // horodatage du dernier message reçu
let netFrozen = false;         // simulation gelée (invité silencieux)

// --- 2v2 en ligne ---
// L'hôte accepte jusqu'à 3 invités. Chaque joueur occupe un « slot » = son
// index dans activeBlobs : 0 = hôte (Rouge), 1 = coéquipier (Orange),
// 2 = adversaire (Vert), 3 = adversaire (Bleu). Les slots libres sont pilotés
// par l'IA de l'hôte. L'ordre d'attribution équilibre les équipes au fur et à
// mesure des arrivées : 1er invité → adversaire, 2e → coéquipier, 3e → dernier.
const SLOT_ORDER = [2, 1, 3];
let mySlot = 1;                // slot du joueur local (hôte = 0 ; invité 1v1 = 1)
let guests = [];               // hôte 2v2 : {id, rel, fast, slot, animal, inSeq, in, ready, connected}
let lobbyStarted = false;      // hôte 2v2 : la partie a été lancée

// --- côté invité ---
const snapBuf = [];            // instantanés reçus, triés par tick
let renderTick = 0;            // tête de lecture (float) pour l'interpolation
let inputSeq = 0;
const inputHistory = [];       // entrées locales pas encore acquittées
let guestSmoothX = 0, guestSmoothY = 0; // lissage visuel post-réconciliation
let prevSnap = null;           // pour détecter les événements (sons, popups)
let lastSnapTime = 0;
// délai d'interpolation adaptatif : mesuré sur l'espacement réel des snapshots
let interpDelay = INTERP_DELAY; // en ticks, ajusté selon la gigue réseau
let lastSnapArrival = 0;        // horodatage du snapshot précédent
let snapGapEMA = 0, snapJitterEMA = 0; // moyennes lissées (ms)

// --- commun ---
let pingMs = -1;
let pingTimer = null;
let rematchMe = false, rematchPeer = false;

function makeCode() {
  let c = "";
  for (let i = 0; i < CODE_LEN; i++) {
    c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return c;
}

function sendRel(m)  { if (connRel  && connRel.open)  connRel.send(m); }
function sendFast(m) { if (connFast && connFast.open) connFast.send(m); }

function onlineLocalInput() {
  // en ligne, chacun est seul devant son écran : tous les mappings clavier
  // marchent, et n'importe quelle manette branchée pilote le joueur local
  let pl = false, pr = false, pj = false, ps = false;
  for (const p of padsNow) { pl = pl || p.left; pr = pr || p.right; pj = pj || p.jump; ps = ps || p.super; }
  const raw = {
    left:  !!(keys["KeyA"] || keys["ArrowLeft"]) || pl,
    right: !!(keys["KeyD"] || keys["ArrowRight"]) || pr,
    jump:  !!(keys["KeyW"] || keys["Space"] || keys["ArrowUp"]) || pj,
    super: !!(keys["KeyS"] || keys["ArrowDown"]) || ps
  };
  return xInput(mySlot, activeBlobs[mySlot], raw);
}

// ---------- Connexion ----------
function initHostPeer() {
  online = true; netRole = "host";
  netConnected = false; peerReady = false;
  netCode = makeCode();
  peer = new Peer(PEER_PREFIX + netCode);
  peer.on("open", () => { peerReady = true; });
  peer.on("connection", c => {
    // n'accepter que les 2 canaux d'un seul et même invité
    if ((c.label !== "rel" && c.label !== "fast") ||
        (connRel && connRel.peer !== c.peer) ||
        (connFast && connFast.peer !== c.peer)) {
      setTimeout(() => { try { c.close(); } catch (e) {} }, 500);
      return;
    }
    hookConn(c);
  });
  peer.on("error", onPeerError);
  peer.on("disconnected", () => { if (peer && !peer.destroyed) peer.reconnect(); });
}

function initGuestPeer(code) {
  online = true; netRole = "guest";
  netConnected = false;
  peer = new Peer(); // id aléatoire pour l'invité
  peer.on("open", () => {
    hookConn(peer.connect(PEER_PREFIX + code, { label: "rel",  reliable: true,  serialization: "json" }));
    hookConn(peer.connect(PEER_PREFIX + code, { label: "fast", reliable: false, serialization: "json" }));
  });
  peer.on("error", onPeerError);
  peer.on("disconnected", () => { if (peer && !peer.destroyed) peer.reconnect(); });
}

function hookConn(c) {
  if (c.label === "rel") connRel = c; else connFast = c;
  c.on("data", onNetData);
  c.on("open", checkBothOpen);
  c.on("close", onConnClosed);
  c.on("error", () => {});
  if (c.open) checkBothOpen();
}

function checkBothOpen() {
  if (netConnected || !connRel || !connRel.open || !connFast || !connFast.open) return;
  netConnected = true;
  lastPeerMsg = lastSnapTime = performance.now();
  startPinging();
  if (netRole === "guest") {
    // connecté : l'invité choisit son animal (le vert), puis enverra "hello"
    pendingMode = { online: true };
    selPlayer = 1;
    state = "selectAnimal";
  }
  // côté hôte : l'écran hostWait affiche "joueur connecté…" jusqu'au hello
}

function onPeerError(err) {
  const t = err && err.type;
  if (netRole === "host" && t === "unavailable-id" && state === "hostWait") {
    // collision de code (rarissime) : on en retire un autre
    const p = peer; peer = null;
    try { p.destroy(); } catch (e) {}
    initHostPeer();
    return;
  }
  let msg = "Erreur réseau" + (t ? " (" + t + ")" : "") + ".";
  if (t === "peer-unavailable") msg = "Partie introuvable — vérifie le code !";
  if (t === "network" || t === "server-error" || t === "socket-error") {
    msg = "Impossible de joindre le serveur de mise en relation.";
  }
  netFail(msg);
}

function onConnClosed() {
  if (!online || state === "netError" || state === "menu") return;
  netFail("Adversaire déconnecté.");
}

function netFail(msg) {
  teardownNet();
  netErrorMsg = msg;
  state = "netError";
}

function teardownNet() {
  online = false; netRole = null; netConnected = false;
  peerReady = false; netFrozen = false;
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  const p = peer;
  peer = connRel = connFast = null;
  if (p) { try { p.destroy(); } catch (e) {} }
  snapBuf.length = 0; inputHistory.length = 0;
  prevSnap = null; pingMs = -1;
  guestSmoothX = guestSmoothY = 0;
  rematchMe = rematchPeer = false;
  guests = []; lobbyStarted = false; mySlot = 1;
  paused = false;
}

function quitOnline() {
  if (netRole === "host" && guests.length) {
    for (const g of guests) { try { if (g.rel && g.rel.open) g.rel.send({ t: "bye" }); } catch (e) {} }
  } else {
    sendRel({ t: "bye" });
  }
  teardownNet();
  state = "menu";
}

function startPinging() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (netRole === "host" && mode === "2v2") {
      for (const g of guests) if (g.fast && g.fast.open) g.fast.send({ t: "ping", ts: performance.now() });
    } else {
      sendFast({ t: "ping", ts: performance.now() });
    }
  }, 500);
}

// ---------- Protocole ----------
function onNetData(m) {
  if (!m || typeof m !== "object") return;
  lastPeerMsg = performance.now();
  switch (m.t) {
    case "ping": sendFast({ t: "pong", ts: m.ts }); break;
    case "pong": {
      const rtt = performance.now() - m.ts;
      pingMs = pingMs < 0 ? rtt : pingMs * 0.7 + rtt * 0.3; // moyenne lissée
      break;
    }
    case "hello": // hôte : l'invité a choisi son animal → on lance !
      if (netRole !== "host") break;
      blobR.animal = clampVisibleAnimal(m.animal);
      hostStartMatch();
      break;
    case "start": { // invité : configuration reçue de l'hôte → départ
      if (netRole !== "guest") break;
      matchId = m.m;
      terrain = Math.max(0, Math.min(TERRAINS.length - 1, m.terrain | 0));
      bombMode = !!m.bomb;                          // l'hôte décide de la règle Bombe…
      bombTime = m.bt || BOMB_TIME;                 // …et de la durée de mèche
      guestResetMatch();
      vsAI = false;
      const clampA = v => Math.max(0, Math.min(ANIMALS.length - 1, v | 0));
      if (m.mode === "2v2") {
        setMode("2v2");
        mySlot = Math.max(0, Math.min(3, m.slot | 0));
        activeBlobs.forEach((b, s) => { b.animal = clampA((m.a && m.a[s]) || 0); });
      } else {
        setMode("1v1"); mySlot = 1;       // invité 1v1 = Vert (slot 1)
        blobL.animal = clampA(m.a[0]);
        blobR.animal = clampA(m.a[1]);
      }
      newGame(m.seed); // même graine → mêmes positions/service de départ
      break;
    }
    case "in": // hôte : entrées de l'invité (on ne garde que la plus récente)
      if (netRole !== "host" || m.m !== matchId) break;
      if (m.s > guestInSeq) {
        guestInSeq = m.s;
        guestIn = { left: !!m.l, right: !!m.r, jump: !!m.j, super: !!m.sp };
        setX(blobR, !!m.x);
      }
      break;
    case "snap": // invité : instantané de l'hôte
      if (netRole !== "guest" || m.m !== matchId) break;
      onSnapMsg(m);
      break;
    case "rematch":
      rematchPeer = true;
      if (netRole === "host" && rematchMe) hostStartMatch();
      break;
    case "bye":
      netFail("L'adversaire a quitté la partie.");
      break;
  }
}

function hostStartMatch() {
  matchId++;
  rematchMe = rematchPeer = false;
  guestInSeq = 0;
  guestIn = { left: false, right: false, jump: false };
  netFrame = 0;
  const seed = (Math.random() * 2 ** 31) | 0;
  sendRel({ t: "start", m: matchId, seed, terrain, a: [blobL.animal, blobR.animal],
            bomb: bombMode ? 1 : 0, bt: bombTime });
  vsAI = false;
  setMode("1v1"); mySlot = 0; // hôte 1v1 = Rouge (slot 0)
  newGame(seed);
}

function guestResetMatch() {
  rematchMe = rematchPeer = false;
  snapBuf.length = 0;
  inputHistory.length = 0;
  inputSeq = 0;
  renderTick = 0;
  prevSnap = null;
  guestSmoothX = guestSmoothY = 0;
  lastSnapTime = performance.now();
  interpDelay = INTERP_DELAY;
  lastSnapArrival = 0; snapGapEMA = 0; snapJitterEMA = 0;
}

// ============================================================
//                 MODE EN LIGNE 2v2 (HÔTE)
// ============================================================
// L'hôte reste autoritaire (il simule tout) et accepte jusqu'à 3 invités.
// Chaque invité ouvre ses 2 canaux (rel/fast) ; on les regroupe par id de pair.
// Les slots libres sont pilotés par l'IA de l'hôte. Les invités, eux, gardent
// exactement le même code que le 1v1 (connRel/connFast, onNetData) : ils
// apprennent juste leur slot via le message "start".

function initHostPeer2v2() {
  online = true; netRole = "host";
  netConnected = false; peerReady = false;
  guests = []; lobbyStarted = false;
  setMode("2v2"); mySlot = 0;
  aiLevel = 1; vsAI = false;
  netCode = makeCode();
  peer = new Peer(PEER_PREFIX + netCode);
  peer.on("open", () => { peerReady = true; });
  peer.on("connection", c => hostAcceptConn(c));
  peer.on("error", onPeerError);
  peer.on("disconnected", () => { if (peer && !peer.destroyed) peer.reconnect(); });
}

function hostAcceptConn(c) {
  if (c.label !== "rel" && c.label !== "fast") {
    setTimeout(() => { try { c.close(); } catch (e) {} }, 500);
    return;
  }
  let g = guests.find(x => x.id === c.peer);
  if (!g) {
    const taken = new Set(guests.map(x => x.slot));
    const slot = SLOT_ORDER.find(s => !taken.has(s));
    if (slot === undefined || lobbyStarted) { // complet ou partie lancée → refus
      setTimeout(() => { try { c.close(); } catch (e) {} }, 500);
      return;
    }
    g = { id: c.peer, rel: null, fast: null, slot, animal: 0,
          inSeq: 0, in: { left: false, right: false, jump: false, super: false },
          ready: false, connected: false, ping: null };
    guests.push(g);
  }
  if (c.label === "rel") g.rel = c; else g.fast = c;
  c.on("data", m => onHostData(g, m));
  c.on("open", () => hostGuestCheck(g));
  c.on("close", () => onGuestClosed(g));
  c.on("error", () => {});
  if (c.open) hostGuestCheck(g);
}

function hostGuestCheck(g) {
  if (g.connected || !g.rel || !g.rel.open || !g.fast || !g.fast.open) return;
  g.connected = true;
  netConnected = true;             // au moins un invité relié
  lastPeerMsg = performance.now();
  if (!pingTimer) startPinging();
}

function onGuestClosed(g) {
  const i = guests.indexOf(g);
  if (i >= 0) guests.splice(i, 1);
  try { if (g.rel)  g.rel.close();  } catch (e) {}
  try { if (g.fast) g.fast.close(); } catch (e) {}
  // en pleine partie : le slot libéré repasse simplement à l'IA (aucun blocage)
  if (guests.length === 0 && !lobbyStarted) netConnected = false;
}

function onHostData(g, m) {
  if (!m || typeof m !== "object") return;
  lastPeerMsg = performance.now();
  switch (m.t) {
    case "ping": if (g.fast && g.fast.open) g.fast.send({ t: "pong", ts: m.ts }); break;
    case "pong": {
      const rtt = performance.now() - m.ts;
      g.ping = g.ping == null ? rtt : g.ping * 0.7 + rtt * 0.3;
      pingMs = Math.max(0, ...guests.map(x => x.ping || 0));
      break;
    }
    case "hello": // l'invité a choisi son animal (lobby)
      g.animal = clampVisibleAnimal(m.animal);
      g.ready = true;
      break;
    case "in": // entrées de cet invité (on ne garde que la plus récente)
      if (m.m !== matchId) break;
      if (m.s > g.inSeq) {
        g.inSeq = m.s;
        g.in = { left: !!m.l, right: !!m.r, jump: !!m.j, super: !!m.sp };
        setX(activeBlobs[g.slot], !!m.x);
      }
      break;
    case "bye": onGuestClosed(g); break;
  }
}

function hostStartMatch2v2() {
  if (guests.length === 0) return; // au moins un humain en face
  matchId++;
  lobbyStarted = true;
  netFrame = 0;
  vsAI = false; aiLevel = 1;
  setMode("2v2"); mySlot = 0;
  const seed = (Math.random() * 2 ** 31) | 0;
  const occ = {}; for (const g of guests) occ[g.slot] = g;
  // animaux : slot 0 = hôte ; slots invités = leur choix ; slots libres = IA
  const anims = [];
  for (let s = 0; s < 4; s++) {
    anims[s] = s === 0 ? blobL.animal
             : occ[s] ? occ[s].animal
             : randomAnimalIdx();
  }
  newGame(seed); // réinitialise positions/scores (n'écrase pas animal/speedMul en ligne)
  activeBlobs.forEach((b, s) => {
    b.animal = anims[s];
    b.speedMul = (s === 0 || occ[s]) ? 1 : AI_LEVELS[aiLevel].speedMul; // IA sur slots libres
  });
  for (const g of guests) {
    if (g.rel && g.rel.open) {
      g.rel.send({ t: "start", m: matchId, mode: "2v2", slot: g.slot, seed, terrain, a: anims,
                   bomb: bombMode ? 1 : 0, bt: bombTime });
    }
  }
}

// boucle de l'hôte 2v2 (appelée par netUpdate)
function hostUpdate2v2() {
  if (!lobbyStarted) return; // encore dans le lobby
  const inMatch = state === "play" || state === "serve" ||
                  state === "point" || state === "gameover";
  if (!inMatch) return;

  if (state === "point") {
    pointTimer--;
    if (pointTimer <= 0) startRally();
  } else if (state === "play" || state === "serve") {
    const bySlot = {}; for (const g of guests) if (g.connected) bySlot[g.slot] = g;
    const ins = activeBlobs.map((b, s) => {
      if (s === 0) return onlineLocalInput();           // l'hôte
      const g = bySlot[s];
      return g ? g.in : aiInput2v2(b);                  // invité, sinon IA
    });
    stepGame(null, null, ins);
  }
  // diffusion d'un instantané (~20 Hz) à tous les invités, ack propre à chacun
  netFrame++;
  if (netFrame % SNAP_EVERY === 0) {
    const snap = getSnapshot();
    for (const g of guests) {
      if (g.fast && g.fast.open) g.fast.send({ t: "snap", m: matchId, ack: g.inSeq, d: snap });
    }
  }
}

// ---------- Boucle réseau (appelée à 60 Hz par update) ----------
function netUpdate() {
  if (!netConnected) return;
  const now = performance.now();

  if (netRole === "host") {
    if (mode === "2v2") { hostUpdate2v2(); return; } // hôte 2v2 : boucle dédiée
    // silence de l'invité → gel de la simulation (personne n'est lésé)
    netFrozen = now - lastPeerMsg > NET_TIMEOUT;
    const inMatch = state === "play" || state === "serve" ||
                    state === "point" || state === "gameover";
    if (!inMatch) return; // encore dans le lobby

    if (!netFrozen) {
      if (state === "point") {
        pointTimer--;
        if (pointTimer <= 0) startRally();
      } else if (state === "play" || state === "serve") {
        stepGame(onlineLocalInput(), guestIn);
      }
    }
    // diffusion : 1 snapshot sur SNAP_EVERY frames (~20 Hz), même en pause
    // instable ou sur l'écran de fin (l'état complet suffit à repartir)
    netFrame++;
    if (netFrame % SNAP_EVERY === 0) {
      sendFast({ t: "snap", m: matchId, ack: guestInSeq, d: getSnapshot() });
    }

  } else {
    // ---- invité ----
    // tête de lecture : avance de 1 tick, se recale en douceur ~INTERP_DELAY
    // ticks derrière le dernier instantané, sans jamais sortir du tampon
    if (snapBuf.length) {
      const latestTick = snapBuf[snapBuf.length - 1].tick;
      const target = latestTick - interpDelay;
      renderTick += 1;
      // rattrapage : doux près de la cible, ferme si on a décroché (anti-lag
      // qui s'accumule) — évite que l'invité prenne du retard permanent
      const err = target - renderTick;
      renderTick += err * (Math.abs(err) > 4 ? 0.35 : 0.12);
      // on autorise un léger dépassement du dernier snapshot : guestApplyView
      // extrapolera alors la balle/l'adversaire au lieu de figer l'image
      renderTick = Math.max(snapBuf[0].tick,
                            Math.min(renderTick, latestTick + EXTRAP_MAX));
    }
    guestSmoothX *= 0.75; guestSmoothY *= 0.75; // le lissage s'estompe

    if (state === "play" || state === "serve") {
      const input = onlineLocalInput();
      inputSeq++;
      inputHistory.push({ s: inputSeq, i: input });
      if (inputHistory.length > 240) inputHistory.shift();
      sendFast({ t: "in", m: matchId, s: inputSeq,
                 l: input.left ? 1 : 0, r: input.right ? 1 : 0, j: input.jump ? 1 : 0, sp: input.super ? 1 : 0,
                 x: xOn[mySlot] ? 1 : 0 });
      // prédiction : son propre personnage répond immédiatement
      // (sauf pendant un Smash Battle : le monde est figé, seuls les
      // appuis comptent — l'hôte fait foi sur les compteurs)
      if (!battle.active) activeBlobs[mySlot].update(input);
    }
  }
}

// ---------- Invité : réception d'un instantané ----------
function onSnapMsg(m) {
  const now = performance.now();
  // mesure de l'espacement réel des snapshots + gigue → délai d'interpolation
  // adaptatif : juste ce qu'il faut pour absorber la gigue, pas plus (latence mini)
  if (lastSnapArrival) {
    const gap = now - lastSnapArrival;
    snapGapEMA = snapGapEMA ? snapGapEMA * 0.85 + gap * 0.15 : gap;
    snapJitterEMA = snapJitterEMA * 0.85 + Math.abs(gap - snapGapEMA) * 0.15;
    const tickMs = 1000 / 60;
    const wanted = (snapGapEMA + snapJitterEMA * 2.5) / tickMs;
    interpDelay = Math.max(INTERP_MIN, Math.min(INTERP_MAX, wanted));
  }
  lastSnapArrival = now;
  lastSnapTime = now;
  const d = m.d, n = snapBuf.length;
  if (n && d.tick < snapBuf[n - 1].tick) return;            // paquet périmé
  if (n && d.tick === snapBuf[n - 1].tick) snapBuf[n - 1] = d; // même tick (pause, point…)
  else { snapBuf.push(d); if (snapBuf.length > 12) snapBuf.shift(); }
  guestDetectEvents(prevSnap, d);
  applyDiscrete(d);
  reconcileGuest(d, m.ack);
  prevSnap = d;
}

// champs "discrets" (non interpolables) : appliqués dès réception
function applyDiscrete(d) {
  state = d.state; servingSide = d.servingSide;
  pointMsg = d.pointMsg; tick = d.tick; serveCountdown = d.serveCountdown || 0;
  scores[0] = d.scores[0]; scores[1] = d.scores[1];
  if (d.streak) { streak[0] = d.streak[0]; streak[1] = d.streak[1]; }
  if (d.superCharge) { superCharge[0] = d.superCharge[0]; superCharge[1] = d.superCharge[1]; }
  if (d.weather !== undefined) { weather = d.weather; weatherTimer = d.weatherTimer; }
  if (d.bombMode !== undefined) { bombMode = d.bombMode; bombTimer = d.bombTimer || 0; }
  ball.frozen = d.ball.frozen; ball.popped = !!d.ball.popped;
  ball.smash = d.ball.smash || 0;
  ball.lastTouchSide = d.ball.lastTouchSide;
  ball.touches = [d.ball.touches[0], d.ball.touches[1]];
  if (d.battle) {
    battle.active = d.battle.active; battle.t = d.battle.t;
    battle.count = [d.battle.count[0], d.battle.count[1]];
    battle.cooldown = d.battle.cooldown;
  }
  activeBlobs.forEach((b, i) => {
    const sb = d.blobs[i]; if (!sb) return;
    if (sb.animal !== undefined) b.animal = sb.animal;
    b.molt = sb.molt || 0; b.tongueOut = !!sb.tongueOut; b.scramble = sb.scramble || 0;
    b.hasBall = !!sb.hasBall;
    b.superT = sb.superT || 0; b.superKind = sb.superKind || ""; b.superSmash = !!sb.superSmash;
    b.tongueT = sb.tongueT || 0; b.tongueTX = sb.tongueTX || 0; b.tongueTY = sb.tongueTY || 0;
  });
}

// sons et effets côté invité, déduits des transitions entre instantanés
function guestDetectEvents(prev, d) {
  if (!prev) return;
  // début / fin d'un Smash Battle
  if (d.battle && prev.battle) {
    if (d.battle.active && !prev.battle.active) { shake = 6; beep(880, 0.12, "square", 0.18); }
    if (!d.battle.active && prev.battle.active) { shake = 14; beep(180, 0.4, "sawtooth", 0.25); }
  }
  // explosion de la bombe : la mèche vient de passer à zéro → éclair + boum
  if (d.bombMode && prev.bombTimer > 0 && (d.bombTimer || 0) <= 0) {
    bombFlash = 1; shake = Math.max(shake, 18);
    beep(70, 0.5, "sawtooth", 0.3, 0, 30); beep(130, 0.4, "square", 0.22, 0.02, 40);
  }
  // déclenchement d'un SUPER (superT passe de 0 à >0)
  for (let i = 0; i < activeBlobs.length; i++) {
    const pb = prev.blobs[i], cb = d.blobs[i];
    if (cb && pb && (cb.superT || 0) > 0 && (pb.superT || 0) <= 0) {
      shake = Math.max(shake, 7);
      crowdHype = Math.max(crowdHype, 45);
      superSound(cb.superKind || animOf(activeBlobs[i]).key);
      superFlash = ANIMALS[cb.animal].name + " !";
      superFlashT = 48;
      spawnSuperBurst(activeBlobs[i]);
    }
  }
  for (const s of [0, 1]) {
    if (d.scores[s] > prev.scores[s]) {
      scorePop[s] = 20;
      shake = 8;
      crowdHype = 60;
      spawnConfetti(22, s === 0 ? W * 0.25 : W * 0.75);
      setEmote(s, "happy");
      setEmote(1 - s, "sad");
      beep(s === 0 ? 660 : 550, 0.25, "sine", 0.2);
    }
  }
  const t0 = prev.ball.touches[0] + prev.ball.touches[1];
  const t1 = d.ball.touches[0] + d.ball.touches[1];
  if (t1 > t0 || (d.ball.lastTouchSide !== prev.ball.lastTouchSide &&
                  d.ball.lastTouchSide !== -1)) {
    // frappeur : le blob du bon camp le plus proche de la balle (visuel/son)
    let hitter = blobL, best = 1e9;
    for (const b of activeBlobs) {
      if (b.side !== d.ball.lastTouchSide) continue;
      const dd = Math.hypot(b.x - d.ball.x, b.y - d.ball.y);
      if (dd < best) { best = dd; hitter = b; }
    }
    noiseBurst(0.05, 0.15, 1300);
    animalHitSound(animOf(hitter));
    if (animOf(hitter).molt) spawnFeathers(d.ball.x, d.ball.y - BALL_R, hitter.color, 6);
  }
}

// réconciliation : état serveur + rejeu silencieux des entrées non acquittées
function reconcileGuest(d, ack) {
  while (inputHistory.length && inputHistory[0].s <= ack) inputHistory.shift();
  const me = activeBlobs[mySlot];
  const sb = d.blobs[mySlot]; if (!sb) return;
  const px = me.x + guestSmoothX, py = me.y + guestSmoothY; // position affichée
  me.x = sb.x; me.y = sb.y;
  me.vx = sb.vx; me.vy = sb.vy;
  me.onGround = sb.onGround;
  noFx = true;
  if (!battle.active) for (const h of inputHistory) me.update(h.i);
  noFx = false;
  const dx = px - me.x, dy = py - me.y;
  if (Math.hypot(dx, dy) < RECONCILE_SNAP) {
    // petit écart : on le résorbe visuellement sur quelques frames
    guestSmoothX = dx; guestSmoothY = dy;
  } else {
    // gros écart (reset de manche, gros lag) : téléportation franche
    guestSmoothX = guestSmoothY = 0;
  }
}

// avant le rendu : écrit dans ball/blobL les positions interpolées
function guestApplyView() {
  const n = snapBuf.length;
  if (!n) return;
  const last = snapBuf[n - 1];

  // --- extrapolation (dead reckoning) ---
  // Si la tête de lecture a dépassé le dernier snapshot (paquet en retard),
  // on prolonge la balle et l'adversaire avec leur vitesse au lieu de figer
  // l'image : le jeu reste fluide malgré la gigue réseau.
  if (renderTick > last.tick + 0.001 && last.state === "play" &&
      !last.ball.frozen && !last.ball.popped && !(last.battle && last.battle.active)) {
    const dt = Math.min(renderTick - last.tick, EXTRAP_MAX);
    ball.x = Math.max(BALL_R, Math.min(W - BALL_R, last.ball.x + last.ball.vx * dt));
    ball.y = last.ball.y + last.ball.vy * dt + 0.5 * GRAV_BALL * dt * dt;
    ball.angle = last.ball.angle + last.ball.vx * 0.03 * dt;
    activeBlobs.forEach((b, i) => {
      if (i === mySlot) return;
      const b1 = last.blobs[i]; if (!b1) return;
      b.x = b1.x + b1.vx * dt;
      b.y = b1.onGround ? b1.y : b1.y + b1.vy * dt + 0.5 * GRAV_BLOB * dt * dt;
      b.walkPhase = b1.walkPhase + Math.abs(b1.vx) * 0.06 * dt;
      b.vx = b1.vx; b.onGround = b1.onGround; b.squash = b1.squash;
    });
    if (!ball.frozen) { ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 8) ball.trail.shift(); }
    return;
  }

  let i0 = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (snapBuf[i].tick <= renderTick) { i0 = i; break; }
  }
  const s0 = snapBuf[i0], s1 = snapBuf[Math.min(i0 + 1, n - 1)];
  let a = s1.tick > s0.tick ? (renderTick - s0.tick) / (s1.tick - s0.tick) : 1;
  a = Math.max(0, Math.min(1, a));
  if (s0.state !== s1.state) a = 1; // reset de manche : pas de glissade

  const L = (u, v) => u + (v - u) * a;
  ball.x = L(s0.ball.x, s1.ball.x);
  ball.y = L(s0.ball.y, s1.ball.y);
  ball.angle = L(s0.ball.angle, s1.ball.angle);
  // tous les joueurs sauf le sien (prédit localement) : position interpolée
  activeBlobs.forEach((b, i) => {
    if (i === mySlot) return;
    const b0 = s0.blobs[i], b1 = s1.blobs[i];
    if (!b0 || !b1) return;
    b.x = L(b0.x, b1.x);
    b.y = L(b0.y, b1.y);
    b.walkPhase = L(b0.walkPhase, b1.walkPhase);
    b.vx = b1.vx; b.onGround = b1.onGround; b.squash = b1.squash;
  });

  // traînée de balle recomposée localement (effet purement visuel)
  if (!ball.frozen) {
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 8) ball.trail.shift();
  } else {
    ball.trail.length = 0;
  }
}

// ---------- HUD et écrans du mode en ligne ----------
function drawNetHUD() {
  if (pingMs >= 0) {
    const p = Math.round(pingMs);
    const col = p < 80 ? "#7ed957" : p < 150 ? "#ffb84d" : "#ff6b6b";
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(W - 70, 20, 5, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = "right";
    ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(p + " ms", W - 14, 25);
  }
  ctx.textAlign = "right";
  ctx.font = "13px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(netRole === "host" ? "Tu joues à gauche" : "Tu joues à droite", W - 14, 44);

  // pause automatique si l'autre ne donne plus signe de vie
  const stale = netRole === "host"
    ? netFrozen
    : performance.now() - lastSnapTime > NET_TIMEOUT &&
      (state === "play" || state === "serve" || state === "point");
  if (stale) overlay("Connexion instable…", "La partie reprendra automatiquement");
}

function netScreenBase(title) {
  drawBackground();
  drawNet();
  ctx.fillStyle = "rgba(20,20,40,0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcc00";
  ctx.font = "bold 40px 'Trebuchet MS', sans-serif";
  ctx.fillText(title, W / 2, 100);
}

function drawOnlineMenu() {
  netScreenBase("Jouer en ligne");
  // ordre calé sur navOptions("onlineMenu") : [1,3,4,5,2]
  const opts = [
    ["1  —  Créer une partie 1v1", "#fff"],
    ["3  —  Créer une partie 2v2", "#ffb26b"],
    ["4  —  💣 Créer une partie Bombe 1v1", "#ff7043"],
    ["5  —  💣 Créer une partie Bombe 2v2", "#ff7043"],
    ["2  —  Rejoindre avec un code", "#fff"]
  ];
  ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
  opts.forEach(([txt, col], i) => {
    const sel = padConnected && navIdx === i;
    ctx.fillStyle = sel ? "#ffcc00" : col;
    ctx.fillText((sel ? "▶  " : "") + txt + (sel ? "  ◀" : ""), W / 2, 178 + i * 40);
  });
  ctx.font = "16px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("L'hôte crée la partie et partage son code. 2v2 : places libres tenues par l'IA.", W / 2, 400);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("Échap : retour", W / 2, 430);
}

function drawHostWait() {
  netScreenBase("Partie en ligne — tu joues à gauche");
  ctx.fillStyle = "#fff";
  ctx.font = "20px 'Trebuchet MS', sans-serif";
  ctx.fillText("Code de la partie :", W / 2, 180);
  ctx.fillStyle = "#ffcc00";
  ctx.font = "bold 62px 'Courier New', monospace";
  ctx.fillText(peerReady ? netCode.split("").join(" ") : "· · · · ·", W / 2, 255);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "19px 'Trebuchet MS', sans-serif";
  const dots = ".".repeat(1 + Math.floor(performance.now() / 400) % 3);
  ctx.fillText(
    netConnected ? "Joueur connecté ! Il choisit son animal" + dots
    : peerReady  ? "En attente d'un joueur — envoie-lui ce code !"
    :              "Création de la partie" + dots,
    W / 2, 320);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "17px 'Trebuchet MS', sans-serif";
  ctx.fillText("En ligne : Q/D ou ←/→ pour bouger — Z, ↑ ou Espace pour sauter", W / 2, 390);
  ctx.fillText("Échap : annuler", W / 2, 430);
}

function drawHostLobby() {
  netScreenBase("Partie 2v2 en ligne");
  ctx.fillStyle = "#fff";
  ctx.font = "18px 'Trebuchet MS', sans-serif";
  ctx.fillText("Code de la partie :", W / 2, 140);
  ctx.fillStyle = "#ffcc00";
  ctx.font = "bold 52px 'Courier New', monospace";
  ctx.fillText(peerReady ? netCode.split("").join(" ") : "· · · · ·", W / 2, 195);

  // 4 cartes de slots : 0 hôte + 1 coéquipier (gauche) ; 2 + 3 (droite)
  const occ = {}; for (const g of guests) occ[g.slot] = g;
  const labels = { 0: "Toi (hôte)", 1: "Coéquipier", 2: "Adversaire", 3: "Adversaire" };
  const cols   = { 0: "#e84545", 1: "#ff8a3d", 2: "#4caf50", 3: "#3d8bff" };
  const order = [0, 1, 2, 3];
  const cw = 180, gap = 16, x0 = W / 2 - (4 * cw + 3 * gap) / 2, y = 225, ch = 92;
  ctx.textAlign = "center";
  order.forEach((s, i) => {
    const x = x0 + i * (cw + gap);
    const g = occ[s];
    const human = s === 0 || !!g;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = cols[s]; ctx.lineWidth = 3; ctx.strokeRect(x, y, cw, ch);
    ctx.fillStyle = cols[s];
    ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
    ctx.fillText(labels[s], x + cw / 2, y + 28);
    ctx.fillStyle = human ? "#fff" : "rgba(255,255,255,0.6)";
    ctx.font = "16px 'Trebuchet MS', sans-serif";
    let status = s === 0 ? "prêt" : g ? (g.ready ? "connecté — prêt" : "connecté…") : "IA (place libre)";
    ctx.fillText(status, x + cw / 2, y + 54);
    if (s !== 0) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "13px 'Trebuchet MS', sans-serif";
      ctx.fillText(i < 2 ? "équipe gauche" : "équipe droite", x + cw / 2, y + 76);
    }
  });

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "19px 'Trebuchet MS', sans-serif";
  const n = guests.length;
  const dots = ".".repeat(1 + Math.floor(performance.now() / 400) % 3);
  ctx.fillText(n === 0
    ? "En attente de joueurs — envoie le code ! (jusqu'à 3)" + dots
    : n + (n > 1 ? " joueurs connectés" : " joueur connecté") + "  •  Entrée : lancer la partie", W / 2, 360);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "16px 'Trebuchet MS', sans-serif";
  ctx.fillText("Les places libres seront tenues par l'IA  •  Échap : annuler", W / 2, 400);
}

function drawJoinEntry() {
  netScreenBase("Rejoindre une partie");
  ctx.fillStyle = "#fff";
  ctx.font = "20px 'Trebuchet MS', sans-serif";
  ctx.fillText("Saisis le code donné par l'hôte :", W / 2, 180);
  const cw = 54, gap = 12, x0 = W / 2 - (CODE_LEN * cw + (CODE_LEN - 1) * gap) / 2;
  for (let i = 0; i < CODE_LEN; i++) {
    const x = x0 + i * (cw + gap);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x, 210, cw, 64);
    ctx.strokeStyle = i === joinCode.length ? "#ffcc00" : "rgba(255,255,255,0.4)";
    ctx.lineWidth = i === joinCode.length ? 3 : 2;
    ctx.strokeRect(x, 210, cw, 64);
    if (joinCode[i]) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 40px 'Courier New', monospace";
      ctx.fillText(joinCode[i], x + cw / 2, 256);
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "18px 'Trebuchet MS', sans-serif";
  ctx.fillText(joinCode.length === CODE_LEN
    ? "Entrée : se connecter"
    : "Lettres et chiffres — Retour arrière pour corriger", W / 2, 330);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "17px 'Trebuchet MS', sans-serif";
  ctx.fillText("Échap : retour", W / 2, 430);
}

function drawNetScreen(title, sub) {
  netScreenBase(title);
  ctx.fillStyle = "#fff";
  ctx.font = "22px 'Trebuchet MS', sans-serif";
  const dots = ".".repeat(1 + Math.floor(performance.now() / 400) % 3);
  ctx.fillText(sub + dots, W / 2, 240);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "17px 'Trebuchet MS', sans-serif";
  ctx.fillText("Échap : annuler", W / 2, 430);
}

function drawNetError() {
  netScreenBase("Oups !");
  ctx.fillStyle = "#ff8a8a";
  ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
  ctx.fillText(netErrorMsg, W / 2, 230);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "18px 'Trebuchet MS', sans-serif";
  ctx.fillText("Entrée ou Échap : retour au menu", W / 2, 320);
}


