// crabby-volley · boucle à pas fixe 60 Hz & amorçage
"use strict";

// ---------- Boucle à pas fixe (60 Hz) ----------
// La simulation avance par ticks constants, découplés du framerate :
// prérequis pour rejouer/synchroniser des entrées en réseau.
let acc = 0;
let lastT = performance.now();
function advance(now) {
  acc += Math.min(now - lastT, 100) * timeScale; // évite la spirale après un onglet inactif
  lastT = now;
  while (acc >= STEP) {
    update();
    if (state !== "menu" && !paused) updateParticles();
    acc -= STEP;
  }
}
function loop(now) {
  pollPads();      // l'API Gamepad se sonde à chaque frame
  handlePadMenu(); // navigation des menus à la manette
  musicTick();     // planifie la musique de fond
  // ralenti dramatique sur les smashs destructeurs — HORS-LIGNE uniquement
  // (en ligne, le rythme doit rester identique des deux côtés)
  const tScale = (!online && state === "play" && ball.smash > 0) ? 0.45 : 1;
  timeScale += (tScale - timeScale) * 0.25;
  advance(now);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Onglet masqué : requestAnimationFrame s'arrête, mais l'hôte d'une partie
// en ligne doit continuer à simuler et à diffuser (voir MULTIJOUEUR.md).
setInterval(() => {
  if (document.hidden && online && netRole === "host" && netConnected) {
    advance(performance.now());
  }
}, 50);
