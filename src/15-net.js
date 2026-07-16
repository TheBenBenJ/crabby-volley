// crabby-volley · mode en ligne — PeerJS, 1v1/2v2, HUD réseau
"use strict";

// ============================================================
//                     MODE EN LIGNE (WebRTC)
// ============================================================
// Architecture hybride (voir MULTIJOUEUR.md) — 1v1 :
//  - SOFT OWNERSHIP : l'invité simule la balle UNIQUEMENT quand elle est
//    clairement dans son camp (x > NET_X + GUEST_BALL_MARGIN). Zone filet,
//    camp hôte, scoring, service/point → toujours l'hôte. Pas de handoff
//    bilatéral (évite les deadlocks poteau de l'ancien ownership 0↔1).
//  - CORPS : chacun prédit son perso ; snaps pour le monde distant.
//  - 2v2 : hôte pleinement autoritaire.
// La signalisation passe par le cloud PeerJS ; ensuite WebRTC en direct.

const SNAP_EVERY = 2;          // cadence de base (~30 Hz)
const SNAP_NEAR_NET = 1;       // près du filet : 60 Hz (passage de balle fluide)
const NET_SNAP_ZONE = 160;     // px autour de NET_X → snaps accélérés
const INTERP_DELAY = 3;        // délai d'interpolation de base (~50 ms), adaptatif
const INTERP_MIN = 2;          // plancher du délai (bonne connexion)
const INTERP_MAX = 7;          // plafond du délai (connexion instable)
const EXTRAP_MAX = 8;          // ticks d'extrapolation max quand un snapshot tarde
const NET_TIMEOUT = 2500;      // ms de silence → pause "connexion instable"
const RECONCILE_SNAP = 60;     // px d'écart au-delà desquels on téléporte
const BALL_STALE_MS = 200;     // sans paquet balle invité → l'hôte reprend
const GUEST_BALL_HOLD = 8;     // ticks de renvoi balle après sortie de zone
const GUEST_COAST_TICKS = 14;  // après sortie : dead-reckoning local avant snaps
const CODE_LEN = 5;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I/O/0/1
const PEER_PREFIX = "vda26-";  // espace de noms sur le cloud PeerJS

// serveurs ICE : STUN (par défaut) + TURN de secours. Sans TURN, deux joueurs
// derrière un NAT strict/pare-feu d'entreprise (fréquent en 4G ou au bureau)
// ne peuvent tout simplement jamais établir de connexion directe — la partie
// restait bloquée sur "Recherche…" (voir CONNECT_TIMEOUT) sans que rien ne
// puisse la débloquer. Le TURN relaie le trafic quand le direct échoue.
const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
  ]
};

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
let netErrorDetail = "";       // diagnostic technique (état ICE/canaux) affiché en petit sous l'erreur
let matchId = 0;               // n° de manche : ignore les paquets périmés
// ms max pour établir les 2 canaux avant d'abandonner. 20s (pas moins) : une
// négociation ICE qui doit basculer sur le relais TURN (direct/STUN en échec)
// peut légitimement prendre 15-20s avant d'aboutir ou d'échouer pour de bon —
// un ancien essai à 12s a coupé une connexion encore "checking", donc pas
// forcément vouée à l'échec.
const CONNECT_TIMEOUT = 20000;
let connectTimer = null;       // garde-fou : évite de rester bloqué sur "Recherche…"

// --- côté hôte ---
let guestIn = { left: false, right: false, jump: false }; // dernière entrée reçue (1v1)
let guestInSeq = 0;            // n° de séquence de cette entrée (= ack renvoyé)
let netFrame = 0;              // cadence d'envoi des snapshots
let lastPeerMsg = 0;           // horodatage du dernier message reçu
let netFrozen = false;         // simulation gelée (invité silencieux)
let guestBall = null;          // dernier état balle reçu de l'invité
let lastGuestBallAt = 0;       // horodatage de ce paquet
let guestBallGen = 0;          // incrémenté à chaque nouveau paquet own:1
let appliedGuestBallGen = -1;  // dernier paquet déjà posé (anti-freeze RTT)
let lastGuestPtSeq = 0;        // dernier point différé consommé (idempotence)
let guestBallHold = 0;         // invité : renvoi balle après sortie de zone
let guestBallAuthority = false; // possession explicite (PAS dérivée de ball.x affiché)
let guestBallSmoothX = 0, guestBallSmoothY = 0; // lissage visuel handoff filet
// Côte visuelle après sortie de zone : on continue la physique locale un
// instant au lieu de sauter sur l'interp retardée (= gros freeze au filet).
let guestCoast = null;         // {x,y,vx,vy,angle} | null
let guestCoastLeft = 0;

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
  peer = new Peer(PEER_PREFIX + netCode, { config: ICE_CONFIG });
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
  peer = new Peer(undefined, { config: ICE_CONFIG }); // id aléatoire pour l'invité
  peer.on("open", () => {
    hookConn(peer.connect(PEER_PREFIX + code, { label: "rel",  reliable: true,  serialization: "json" }));
    hookConn(peer.connect(PEER_PREFIX + code, { label: "fast", reliable: false, serialization: "json" }));
  });
  peer.on("error", onPeerError);
  peer.on("disconnected", () => { if (peer && !peer.destroyed) peer.reconnect(); });
  // garde-fou : si la négociation WebRTC directe n'aboutit jamais (NAT strict,
  // pare-feu…), le code peut être valide (pas de "peer-unavailable") mais la
  // connexion réelle ne s'établit jamais — sans ça, l'écran restait bloqué
  // sur "Recherche de la partie…" indéfiniment, sans aucun message.
  clearTimeout(connectTimer);
  connectTimer = setTimeout(() => {
    if (!netConnected) {
      netFail("Connexion impossible — vérifie le code, ou la connexion réseau de ton ami.",
              "code: connect-timeout · " + netDiag());
    }
  }, CONNECT_TIMEOUT);
}

function hookConn(c) {
  if (c.label === "rel") connRel = c; else connFast = c;
  c.on("data", onNetData);
  c.on("open", checkBothOpen);
  c.on("close", onConnClosed);
  // un échec explicite du canal ne doit pas être avalé en silence : sans
  // connexion établie, on abandonne tout de suite (au lieu d'attendre le
  // garde-fou CONNECT_TIMEOUT) ; déjà connecté, "close" gère la déconnexion.
  c.on("error", (err) => {
    if (!netConnected) {
      netFail("Connexion impossible — vérifie le code, ou la connexion réseau de ton ami.",
              "code: " + (c.label || "?") + "-channel-error (" + ((err && err.type) || (err && err.message) || "?") + ") · " + netDiag());
    }
  });
  if (c.open) checkBothOpen();
}

function checkBothOpen() {
  if (netConnected || !connRel || !connRel.open || !connFast || !connFast.open) return;
  netConnected = true;
  clearTimeout(connectTimer); connectTimer = null;
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

// diagnostic technique (état des 2 canaux + de la négociation ICE sous-jacente)
// affiché en petit sous le message d'erreur — utile pour nous remonter ce qui
// bloque exactement (signalisation PeerJS OK mais WebRTC direct qui échoue,
// TURN jamais atteint, etc.), à capturer AVANT teardownNet() (qui vide tout).
function netDiag() {
  const chan = c => !c ? "absent" : c.open ? "ouvert" : "en attente";
  const ice = c => c && c.peerConnection ? c.peerConnection.iceConnectionState : "-";
  return "rel:" + chan(connRel) + "/" + ice(connRel) + " · fast:" + chan(connFast) + "/" + ice(connFast);
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
  netFail(msg, "code: " + (t || "inconnu"));
}

function onConnClosed() {
  if (!online || state === "netError" || state === "menu") return;
  netFail("Adversaire déconnecté.", "code: connection-closed · " + netDiag());
}

function netFail(msg, detail) {
  teardownNet();
  netErrorMsg = msg;
  netErrorDetail = detail || "";
  state = "netError";
}

function teardownNet() {
  online = false; netRole = null; netConnected = false;
  peerReady = false; netFrozen = false;
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  clearTimeout(connectTimer); connectTimer = null;
  const p = peer;
  peer = connRel = connFast = null;
  if (p) { try { p.destroy(); } catch (e) {} }
  snapBuf.length = 0; inputHistory.length = 0;
  prevSnap = null; pingMs = -1;
  guestSmoothX = guestSmoothY = 0;
  rematchMe = rematchPeer = false;
  guests = []; lobbyStarted = false; mySlot = 1;
  paused = false;
  netErrorDetail = "";
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
    case "in": // hôte : entrées de l'invité (+ balle soft-own éventuelle)
      if (netRole !== "host" || m.m !== matchId) break;
      if (m.s > guestInSeq) {
        guestInSeq = m.s;
        guestIn = { left: !!m.l, right: !!m.r, jump: !!m.j, super: !!m.sp };
        setX(blobR, !!m.x);
      }
      if (m.b) {
        if (m.b.own === 1) {
          guestBall = m.b;
          lastGuestBallAt = performance.now();
          guestBallGen++;
        } else {
          // own:0 = sortie immédiate — ne PAS garder le dernier own:1
          // (sinon l'hôte le réapplique pendant tout le RTT = freeze filet)
          if (m.b.pt) guestBall = m.b; // garder un pt éventuel
          else hostInvalidateGuestBall();
          if (m.b.pt) { guestBall.own = 0; lastGuestBallAt = 0; }
        }
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
  guestBall = null; lastGuestBallAt = 0; lastGuestPtSeq = 0;
  guestBallGen = 0; appliedGuestBallGen = -1;
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
  pendingNetPoint = null;
  netPtSeq = 0;
  guestBallHold = 0;
  guestBallAuthority = false;
  guestBallSmoothX = guestBallSmoothY = 0;
  guestCoast = null; guestCoastLeft = 0;
  ballScoreLock = false;
}

// Possession soft-own : flag explicite. Ne JAMAIS dériver de ball.x affiché
// (l'interp retardée le remettait dans la zone → reprise en boucle = freeze).
function guestOwnsBall() {
  return guestBallAuthority;
}

function guestCanAcquireBall() {
  if (mode !== "1v1" || battle.active) return false;
  if (state !== "play" && state !== "serve") return false;
  const n = snapBuf.length;
  if (!n) return false;
  const b = snapBuf[n - 1].ball;
  // frozen OK (notre service) ; refuser seulement crevée / hors zone
  return b && !b.popped && ballInGuestOwnZone(b.x);
}

// Balle « live » depuis le dernier snap (âge + RTT/2), pour le passage filet.
function guestLiveBallFromSnap() {
  const n = snapBuf.length;
  if (!n) return null;
  const last = snapBuf[n - 1];
  if (!last.ball || (last.state !== "play" && last.state !== "serve")) return null;
  if (last.ball.frozen || last.ball.popped) return null;
  const tickMs = 1000 / 60;
  const age = lastSnapArrival ? (performance.now() - lastSnapArrival) / tickMs : 0;
  const rttHalf = pingMs > 0 ? (pingMs * 0.5) / tickMs : 1.5;
  const dt = Math.max(0, Math.min(EXTRAP_MAX, age + rttHalf));
  const pb = predictBallMotion(last.ball.x, last.ball.y, last.ball.vx, last.ball.vy, dt);
  return { x: pb.x, y: pb.y, vx: pb.vx, vy: pb.vy, angle: last.ball.angle + pb.vx * 0.03 * dt };
}

// Hôte : n'applique la balle invité QUE si l'invité revendique explicitement
// la possession (own:1) ET que l'hôte a déjà la balle à droite. Sinon un
// paquet périmé du rally / de la sortie précédente téléportait la balle
// vers le sol → « tombe toute seule à l'arrivée dans le camp adverse ».
function hostUsesGuestBall() {
  const HOST_ACCEPT = NET_X + 24;
  return mode === "1v1" && !battle.active &&
         guestBall && guestBall.own === 1 &&
         (performance.now() - lastGuestBallAt) < BALL_STALE_MS &&
         guestBall.x > HOST_ACCEPT &&
         ball.x > NET_X;
}

function hostInvalidateGuestBall() {
  guestBall = null;
  lastGuestBallAt = 0;
  appliedGuestBallGen = -1;
}

// Au moment où l'invité prend la balle : partir du DERNIER snap hôte
// (présent), pas de l'interpolation retardée (sinon la balle « chute » d'un coup).
function guestSeedBallFromSnap() {
  const n = snapBuf.length;
  if (!n) return;
  const b = snapBuf[n - 1].ball;
  if (!b) return;
  ball.x = b.x; ball.y = b.y; ball.vx = b.vx; ball.vy = b.vy;
  ball.angle = b.angle;
  ball.frozen = b.frozen; ball.popped = !!b.popped;
  ball.smash = b.smash || 0;
  ball.lastTouchSide = b.lastTouchSide;
  ball.touches = [b.touches[0], b.touches[1]];
  ballScoreLock = false;
}

// Point différé invité — idempotent par séquence (anti multi-score).
function hostTakeGuestBallPoint() {
  if (!guestBall || !guestBall.pt || !Array.isArray(guestBall.pt)) return;
  const side = guestBall.pt[0] | 0;
  const reason = guestBall.pt[1] || "";
  const seq = guestBall.pt[2] | 0;
  guestBall.pt = null;
  if (seq <= lastGuestPtSeq) return;
  lastGuestPtSeq = seq;
  if (state === "play" || state === "serve") awardPoint(side, reason);
}

// Pose les blobs distants d'après le dernier snap (collisions locales invité).
function guestSyncRemoteBlobs() {
  const n = snapBuf.length;
  if (!n) return;
  const last = snapBuf[n - 1];
  activeBlobs.forEach((b, i) => {
    if (i === mySlot) return;
    const sb = last.blobs[i]; if (!sb) return;
    b.x = sb.x; b.y = sb.y; b.vx = sb.vx; b.vy = sb.vy;
    b.onGround = sb.onGround; b.walkPhase = sb.walkPhase; b.squash = sb.squash;
  });
}

function hostSnapCadence() {
  // près du filet / balle rapide vers l'autre camp → snaps à 60 Hz
  if (state !== "play" && state !== "serve") return SNAP_EVERY;
  if (Math.abs(ball.x - NET_X) < NET_SNAP_ZONE) return SNAP_NEAR_NET;
  if (Math.abs(ball.vx) > 8) return SNAP_NEAR_NET;
  return SNAP_EVERY;
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
  peer = new Peer(PEER_PREFIX + netCode, { config: ICE_CONFIG });
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
    // n'importe quel joueur connecté (hôte ou invité) peut faire avancer
    // l'écran "Point pour ..." en appuyant sur saut/confirmation, comme
    // hors-ligne (voir update() dans 13-simulation.js) — sinon, filet de
    // sécurité au bout de POINT_MAX_WAIT.
    const elapsed = POINT_MAX_WAIT - pointTimer;
    const guestWants = guests.some(g => g.connected && g.in.jump);
    if ((elapsed >= POINT_MIN_WAIT && (pointAdvanceRequested() || guestWants)) || pointTimer <= 0) startRally();
  } else if (state === "play" || state === "serve") {
    const bySlot = {}; for (const g of guests) if (g.connected) bySlot[g.slot] = g;
    const ins = activeBlobs.map((b, s) => {
      if (s === 0) return onlineLocalInput();           // l'hôte
      const g = bySlot[s];
      return g ? g.in : aiInput2v2(b);                  // invité, sinon IA
    });
    stepGame(null, null, ins);
  }
  // diffusion d'un instantané à tous les invités, ack propre à chacun
  netFrame++;
  if (netFrame % hostSnapCadence() === 0) {
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
        // hôte OU invité peut faire avancer l'écran "Point pour ..." en
        // appuyant sur saut/confirmation (comme hors-ligne) — sinon, filet
        // de sécurité au bout de POINT_MAX_WAIT.
        const elapsed = POINT_MAX_WAIT - pointTimer;
        if ((elapsed >= POINT_MIN_WAIT && (pointAdvanceRequested() || guestIn.jump)) || pointTimer <= 0) startRally();
      } else if (state === "play" || state === "serve") {
        // Soft ownership : invité revendique (own:1) + balle déjà à droite.
        if (hostUsesGuestBall()) {
          if (appliedGuestBallGen !== guestBallGen) {
            applyBallState(guestBall);
            appliedGuestBallGen = guestBallGen;
          } else {
            // Même paquet (trou RTT après sortie / jitter) : avancer 1 tick
            // au lieu de reposer la même pose → anti-freeze filet côté hôte.
            const pb = predictBallMotion(ball.x, ball.y, ball.vx, ball.vy, 1);
            ball.x = pb.x; ball.y = pb.y; ball.vx = pb.vx; ball.vy = pb.vy;
          }
          stepGame(onlineLocalInput(), guestIn, null, { skipBall: true });
        } else {
          if (ball.x <= NET_X + GUEST_BALL_MARGIN) hostInvalidateGuestBall();
          stepGame(onlineLocalInput(), guestIn);
          if (ball.x <= NET_X + 24) hostInvalidateGuestBall();
        }
        hostTakeGuestBallPoint(); // y compris pt arrivé avec own:0
      }
    }
    netFrame++;
    if (netFrame % hostSnapCadence() === 0) {
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
      const err = target - renderTick;
      renderTick += err * (Math.abs(err) > 4 ? 0.35 : 0.12);
      renderTick = Math.max(snapBuf[0].tick,
                            Math.min(renderTick, latestTick + EXTRAP_MAX));
    }
    guestSmoothX *= 0.75; guestSmoothY *= 0.75;
    guestBallSmoothX *= 0.7; guestBallSmoothY *= 0.7;

    if (state === "play" || state === "serve") {
      const input = onlineLocalInput();
      inputSeq++;
      inputHistory.push({ s: inputSeq, i: input });
      if (inputHistory.length > 240) inputHistory.shift();

      let ballPkt = null;

      // Acquisition : uniquement si le DERNIER snap hôte a la balle dans
      // la zone (pas le ball.x affiché retardé — ça causait le freeze).
      if (!guestBallAuthority && !battle.active && guestCanAcquireBall()) {
        const ox = ball.x, oy = ball.y;
        guestBallAuthority = true;
        guestCoast = null; guestCoastLeft = 0;
        guestSeedBallFromSnap();
        guestBallSmoothX = ox - ball.x;
        guestBallSmoothY = oy - ball.y;
      }

      if (guestBallAuthority) {
        guestSyncRemoteBlobs();
        netDeferScore = true;
        const me = activeBlobs[mySlot];
        if (state === "serve" && serveCountdown > 0) {
          me.update({ left: input.left, right: input.right, jump: false });
          serveCountdown--;
          ball.y += Math.sin(tick / 18) * 0.3;
        } else {
          maybeActivateSuper(me, input);
          me.update(input);
          updateBall();
          tickSuper(me);
        }
        if (state === "serve" && !ball.frozen) state = "play";
        netDeferScore = false;
        ballPkt = packBallState(true);
        // Libération : basée sur la simu LOCALE, une seule fois
        if (!ballInGuestOwnZone(ball.x) || ball.popped || battle.active) {
          guestBallAuthority = false;
          guestBallHold = GUEST_BALL_HOLD;
          guestCoast = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, angle: ball.angle };
          guestCoastLeft = GUEST_COAST_TICKS;
        }
      } else if (!battle.active) {
        activeBlobs[mySlot].update(input);
        if (guestBallHold > 0) {
          guestBallHold--;
          ballPkt = packBallState(false);
        }
        // Côte : avancer la prédiction locale 1 tick / frame
        if (guestCoastLeft > 0 && guestCoast) {
          const pb = predictBallMotion(guestCoast.x, guestCoast.y,
                                       guestCoast.vx, guestCoast.vy, 1);
          guestCoast.x = pb.x; guestCoast.y = pb.y;
          guestCoast.vx = pb.vx; guestCoast.vy = pb.vy;
          guestCoast.angle += pb.vx * 0.03;
          guestCoastLeft--;
          if (guestCoastLeft <= 0) guestCoast = null;
        }
      }

      const msg = { t: "in", m: matchId, s: inputSeq,
                    l: input.left ? 1 : 0, r: input.right ? 1 : 0,
                    j: input.jump ? 1 : 0, sp: input.super ? 1 : 0,
                    x: xOn[mySlot] ? 1 : 0 };
      if (ballPkt) msg.b = ballPkt;
      sendFast(msg);
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
  const iOwnBall = guestOwnsBall() || guestBallHold > 0;
  const prevState = state;
  state = d.state; servingSide = d.servingSide;
  pointMsg = d.pointMsg;
  if (!iOwnBall) tick = d.tick;
  if (!iOwnBall) serveCountdown = d.serveCountdown || 0;
  scores[0] = d.scores[0]; scores[1] = d.scores[1];
  // Changement d'état (point / serve / fin) : adopter ENTIÈREMENT la balle
  // hôte (évite balle périmée du rally précédent → service bloqué).
  if (prevState !== d.state &&
      (d.state === "point" || d.state === "gameover" || d.state === "serve")) {
    pendingNetPoint = null;
    ballScoreLock = false;
    guestBallHold = 0;
    guestBallAuthority = false;
    guestCoast = null; guestCoastLeft = 0;
    guestBallSmoothX = guestBallSmoothY = 0;
    ball.x = d.ball.x; ball.y = d.ball.y;
    ball.vx = d.ball.vx; ball.vy = d.ball.vy;
    ball.angle = d.ball.angle;
    ball.frozen = d.ball.frozen; ball.popped = !!d.ball.popped;
    ball.smash = d.ball.smash || 0;
    ball.lastTouchSide = d.ball.lastTouchSide;
    ball.touches = [d.ball.touches[0], d.ball.touches[1]];
    ball.trail.length = 0;
    if (d.serveCountdown !== undefined) serveCountdown = d.serveCountdown;
  }
  if (d.streak) { streak[0] = d.streak[0]; streak[1] = d.streak[1]; }
  if (d.superCharge) { superCharge[0] = d.superCharge[0]; superCharge[1] = d.superCharge[1]; }
  if (d.weather !== undefined) { weather = d.weather; weatherTimer = d.weatherTimer; }
  if (d.bombMode !== undefined) { bombMode = d.bombMode; bombTimer = d.bombTimer || 0; }
  // Physique balle : ne pas écraser si on simule localement (anti rubber-band)
  if (!iOwnBall) {
    ball.frozen = d.ball.frozen; ball.popped = !!d.ball.popped;
    ball.smash = d.ball.smash || 0;
    ball.lastTouchSide = d.ball.lastTouchSide;
    ball.touches = [d.ball.touches[0], d.ball.touches[1]];
  }
  // Reprise hôte confirmée par snap (balle hors zone) → lâcher l'autorité
  if (guestBallAuthority && d.ball && !ballInGuestOwnZone(d.ball.x) &&
      (d.state === "play" || d.state === "serve") && prevState === d.state) {
    guestBallAuthority = false;
    guestBallHold = 0;
    ballScoreLock = false;
    guestCoast = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, angle: ball.angle };
    guestCoastLeft = GUEST_COAST_TICKS;
  }
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

// Pose la balle vue invité hors ownership : côte locale et/ou live-extrap
// du dernier snap (jamais l'interp retardée près du filet → freeze).
function guestApplyBallView(s0, s1, a, last) {
  const L = (u, v) => u + (v - u) * a;
  const nearNet = last.ball && Math.abs(last.ball.x - NET_X) < NET_SNAP_ZONE;
  const live = (nearNet || guestCoastLeft > 0) ? guestLiveBallFromSnap() : null;

  let sx, sy, sa;
  if (live) {
    sx = live.x; sy = live.y; sa = live.angle;
  } else {
    const x0 = s0.ball.x, y0 = s0.ball.y, x1 = s1.ball.x, y1 = s1.ball.y;
    let yAtNet = null;
    if ((x0 - NET_X) * (x1 - NET_X) < 0 && Math.abs(x1 - x0) > 1e-6) {
      yAtNet = y0 + ((NET_X - x0) / (x1 - x0)) * (y1 - y0);
    }
    const clearsOver = yAtNet !== null && yAtNet <= NET_TOP + 1;
    const throughPost = yAtNet !== null && yAtNet > NET_TOP + 1;
    if (throughPost && s0.tick !== s1.tick &&
        s0.state === "play" && !s0.ball.frozen && !s0.ball.popped) {
      const dt = Math.max(0, renderTick - s0.tick);
      const pb = predictBallMotion(x0, y0, s0.ball.vx, s0.ball.vy, dt);
      const k = a * 0.4;
      sx = pb.x + (x1 - pb.x) * k;
      sy = pb.y + (y1 - pb.y) * k;
      sa = L(s0.ball.angle, s1.ball.angle);
    } else {
      sx = L(x0, x1); sy = L(y0, y1); sa = L(s0.ball.angle, s1.ball.angle);
      if (!clearsOver && sy > NET_TOP + 2) {
        const leftC = NET_X - NET_W / 2 - BALL_R;
        const rightC = NET_X + NET_W / 2 + BALL_R;
        if (sx > leftC && sx < rightC) sx = sx < NET_X ? leftC : rightC;
      }
    }
  }

  // Blend côte locale → snap live pendant le handoff
  if (guestCoast && guestCoastLeft > 0) {
    const k = 1 - (guestCoastLeft / GUEST_COAST_TICKS); // 0 → 1
    const ease = k * k; // ease-in vers le snap
    ball.x = guestCoast.x + (sx - guestCoast.x) * ease;
    ball.y = guestCoast.y + (sy - guestCoast.y) * ease;
    ball.angle = guestCoast.angle + (sa - guestCoast.angle) * ease;
  } else {
    ball.x = sx; ball.y = sy; ball.angle = sa;
  }
}

// avant le rendu : écrit dans ball/blobs les positions interpolées
function guestApplyView() {
  const n = snapBuf.length;
  if (!n) return;
  const last = snapBuf[n - 1];
  const iOwnBall = guestOwnsBall();

  // --- extrapolation adversaire (+ balle si pas owner / pas côte gérée plus bas)
  if (renderTick > last.tick + 0.001 && last.state === "play" &&
      !last.ball.frozen && !last.ball.popped && !(last.battle && last.battle.active)) {
    const dt = Math.min(renderTick - last.tick, EXTRAP_MAX);
    if (!iOwnBall) {
      // près du filet / côte : même chemin que l'interp (live + blend)
      guestApplyBallView(last, last, 1, last);
    }
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
  if (s0.state !== s1.state) a = 1;

  const L = (u, v) => u + (v - u) * a;
  if (!iOwnBall) guestApplyBallView(s0, s1, a, last);

  activeBlobs.forEach((b, i) => {
    if (i === mySlot) return;
    const b0 = s0.blobs[i], b1 = s1.blobs[i];
    if (!b0 || !b1) return;
    b.x = L(b0.x, b1.x);
    b.y = L(b0.y, b1.y);
    b.walkPhase = L(b0.walkPhase, b1.walkPhase);
    b.vx = b1.vx; b.onGround = b1.onGround; b.squash = b1.squash;
  });

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
    ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(p + " ms", W - 14, 25);
  }
  ctx.textAlign = "right";
  ctx.font = "13px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(netRole === "host" ? "Tu joues à gauche" : "Tu joues à droite", W - 14, 44);

  // pause automatique si l'autre ne donne plus signe de vie
  const stale = netRole === "host"
    ? netFrozen
    : performance.now() - lastSnapTime > NET_TIMEOUT &&
      (state === "play" || state === "serve" || state === "point");
  if (stale) overlay("Connexion instable…", "La partie reprendra automatiquement");
}

// En-tête éditorial commun aux écrans en ligne (réutilise le design-system de
// 12-menus, disponible au runtime). kicker + titre flush-left + filet + folio.
function netScreenBase(title, kicker, subtitle) {
  drawBackground(); drawNet(); blobL.draw(); blobR.draw();
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(10,11,16,0.90)");
  g.addColorStop(0.6, "rgba(10,11,16,0.70)");
  g.addColorStop(1, "rgba(10,11,16,0.46)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const mx = UI.mx;
  uiLabel(kicker || "En ligne · WebRTC", mx, 82, 12, UI.accent, 3);
  ctx.textAlign = "left"; ctx.fillStyle = UI.ink;
  ctx.font = "800 " + (title.length > 20 ? 36 : 42) + "px " + UI.sans;
  ctx.fillText(title, mx, 130);
  uiRule(mx, W - mx, 150, UI.faint);
  if (subtitle) uiLabel(subtitle, mx, 174, 12, UI.muted, 1);
  uiRule(mx, W - mx, H - 42, UI.faint);
  // manquait ici : contrairement à menuScreenBase, ce lien n'était pas
  // cliquable — sur ces écrans (attente hôte, salon, saisie de code…) seul
  // le clavier/la manette permettaient de revenir en arrière, impossible au
  // tactile. Même zone agrandie sur tactile que menuScreenBase.
  if (hasTouch) hit(mx + 110, H - 24, 260, 52, "Escape");
  else hit(mx + 45, H - 32, 130, 24, "Escape");
  uiLabel("Échap ← Retour", mx, H - 26, 10, UI.muted, 1.5);
  uiLabel((darkMode ? "Pussy Volley" : "Crabby Volley") + " · En ligne", W - mx, H - 26, 10, UI.muted, 1.5, "right");
}

function drawOnlineMenu() {
  netScreenBase("Jouer en ligne", "En ligne · Créer ou rejoindre",
                "Connexion directe entre navigateurs (WebRTC)");
  // "Créer une partie" amène au même écran de format que le solo (1v1/en
  // équipes/Bombe, voir drawGameModeSelect) — plus de doublons à plat ici.
  const opts = [
    "1  —  Créer une partie",
    "2  —  Rejoindre avec un code"
  ];
  drawOptionList(opts, 224, 44);
  uiLabel("L'hôte partage son code · en équipes : places libres tenues par l'IA", UI.mx, H - 70, 10, UI.muted, 1);
}

// gros code de partie, calé à gauche sous l'en-tête
function drawHostCode(size, y) {
  uiLabel("Code de la partie", UI.mx, y - 30, 11, UI.muted, 2);
  ctx.textAlign = "left"; ctx.fillStyle = UI.gold;
  ctx.font = "700 " + size + "px " + UI.mono;
  ctx.fillText(peerReady ? netCode.split("").join(" ") : "· · · · ·", UI.mx, y);
}

function drawHostWait() {
  netScreenBase("Partie 1v1 en ligne", "En ligne · Hôte · Tu joues à gauche");
  drawHostCode(60, 258);
  const dots = ".".repeat(1 + Math.floor(performance.now() / 400) % 3);
  ctx.textAlign = "left"; ctx.fillStyle = UI.ink; ctx.font = "500 18px " + UI.sans;
  ctx.fillText(
    netConnected ? "Joueur connecté ! Il choisit son animal" + dots
    : peerReady  ? "En attente d'un joueur — envoie-lui ce code"
    :              "Création de la partie" + dots,
    UI.mx, 306);
  uiLabel("Bouger Q/D ou ← →   ·   Sauter Z ↑ Espace", UI.mx, H - 70, 10, UI.muted, 1);
}

function drawHostLobby() {
  netScreenBase("Partie 2v2 en ligne", "En ligne · Hôte · Salon");
  drawHostCode(44, 214);

  // 4 cartes de slots : 0 hôte + 1 coéquipier (gauche) ; 2 + 3 (droite)
  const occ = {}; for (const g of guests) occ[g.slot] = g;
  const labels = { 0: "Toi (hôte)", 1: "Coéquipier", 2: "Adversaire", 3: "Adversaire" };
  const cols   = { 0: "#e84545", 1: "#ff8a3d", 2: "#4caf50", 3: "#3d8bff" };
  const cw = 172, gap = 14, x0 = UI.mx, y = 250, ch = 88;
  ctx.textAlign = "left";
  [0, 1, 2, 3].forEach((s, i) => {
    const x = x0 + i * (cw + gap);
    const g = occ[s];
    const human = s === 0 || !!g;
    ctx.fillStyle = "rgba(10,12,18,0.42)";
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 8); ctx.fill(); }
    else ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = cols[s]; ctx.fillRect(x, y, 4, ch); // liseré d'équipe à gauche
    uiLabel(i < 2 ? "Équipe gauche" : "Équipe droite", x + 16, y + 22, 9, UI.muted, 1);
    ctx.fillStyle = cols[s]; ctx.font = "700 17px " + UI.sans; ctx.textAlign = "left";
    ctx.fillText(labels[s], x + 16, y + 46);
    ctx.fillStyle = human ? UI.ink : UI.muted; ctx.font = "500 14px " + UI.sans;
    ctx.fillText(s === 0 ? "prêt" : g ? (g.ready ? "connecté — prêt" : "connecté…") : "IA (place libre)", x + 16, y + 68);
  });

  const n = guests.length;
  const dots = ".".repeat(1 + Math.floor(performance.now() / 400) % 3);
  if (n >= 1) hit(W / 2, 372, W - UI.mx * 2, 32, "Enter"); // clic = lancer la partie (comme Entrée)
  ctx.textAlign = "left"; ctx.fillStyle = UI.ink; ctx.font = "500 18px " + UI.sans;
  ctx.fillText(n === 0
    ? "En attente de joueurs — envoie le code (jusqu'à 3)" + dots
    : n + (n > 1 ? " joueurs connectés" : " joueur connecté") + "  ·  Entrée : lancer", UI.mx, 380);
  uiLabel("Places libres tenues par l'IA", UI.mx, H - 70, 10, UI.muted, 1);
}

function drawJoinEntry() {
  netScreenBase("Rejoindre une partie", "En ligne · Invité", "Saisis le code donné par l'hôte");
  const cw = 56, gap = 12, x0 = UI.mx, y = 220;
  for (let i = 0; i < CODE_LEN; i++) {
    const x = x0 + i * (cw + gap);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, cw, 66, 8); ctx.fill(); }
    else ctx.fillRect(x, y, cw, 66);
    ctx.strokeStyle = i === joinCode.length ? UI.gold : "rgba(255,255,255,0.28)";
    ctx.lineWidth = i === joinCode.length ? 2.5 : 1.5;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, cw, 66, 8); ctx.stroke(); }
    else ctx.strokeRect(x, y, cw, 66);
    if (joinCode[i]) {
      ctx.fillStyle = UI.gold; ctx.textAlign = "center";
      ctx.font = "700 40px " + UI.mono;
      ctx.fillText(joinCode[i], x + cw / 2, y + 46);
    }
  }
  ctx.textAlign = "left"; ctx.fillStyle = UI.ink; ctx.font = "500 17px " + UI.sans;
  ctx.fillText(joinCode.length === CODE_LEN
    ? "Entrée : se connecter"
    : "Lettres et chiffres · Retour arrière pour corriger", UI.mx, 328);
}

function drawNetScreen(title, sub) {
  netScreenBase(title, "En ligne · Connexion");
  const dots = ".".repeat(1 + Math.floor(performance.now() / 400) % 3);
  ctx.textAlign = "left"; ctx.fillStyle = UI.ink; ctx.font = "500 20px " + UI.sans;
  ctx.fillText(sub + dots, UI.mx, 236);
}

function drawNetError() {
  hit(W / 2, H / 2, W, H, "Enter"); // clic n'importe où = retour au menu
  netScreenBase("Oups", "En ligne · Erreur");
  ctx.textAlign = "left"; ctx.fillStyle = "#ff8a8a"; ctx.font = "600 20px " + UI.sans;
  ctx.fillText(netErrorMsg, UI.mx, 236);
  // diagnostic technique (état des canaux/ICE) : à remonter tel quel si
  // le problème persiste — évite de deviner où ça bloque.
  let hintY = 272;
  if (netErrorDetail) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "12px " + UI.mono;
    const maxW = W - UI.mx * 2;
    const words = String(netErrorDetail).split(" ");
    let line = "", y = 268;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, UI.mx, y); y += 16; line = w;
      } else line = test;
    }
    if (line) { ctx.fillText(line, UI.mx, y); y += 16; }
    hintY = y + 16;
  }
  uiLabel("Entrée / Échap — retour au menu", UI.mx, hintY, 10, UI.muted, 1);
}


