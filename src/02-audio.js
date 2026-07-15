// crabby-volley · audio — sons, cris des animaux, musique chiptune
"use strict";

// ---------- Audio (bips simples) ----------
let audioCtx = null;
// delay : départ différé (s) · freqEnd : glissando vers cette fréquence
function beep(freq, dur = 0.07, type = "square", vol = 0.12, delay = 0, freqEnd = 0) {
  if (muted || noFx) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const t0 = audioCtx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd > 0) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t0); o.stop(t0 + dur);
  } catch (e) { /* audio non dispo */ }
}

// petit "pock" de percussion (bruit filtré) commun à toutes les frappes
function noiseBurst(dur = 0.05, vol = 0.14, freq = 1200, q = 0.9) {
  if (muted || noFx) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const n = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const f = audioCtx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
    const g = audioCtx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(audioCtx.destination);
    src.start();
  } catch (e) { /* audio non dispo */ }
}

// "ola" sonore : rugissement de foule (bruit filtré qui enfle puis retombe).
function crowdCheer(intensity) {
  if (muted || noFx) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const dur = 0.85 + intensity * 0.55;
    const n = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const env = Math.sin(Math.PI * (i / n)); // gonfle puis retombe
      data[i] = (Math.random() * 2 - 1) * env * env;
    }
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const f = audioCtx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 680; f.Q.value = 0.55;
    const g = audioCtx.createGain(); g.gain.value = 0.05 + intensity * 0.07;
    src.connect(f); f.connect(g); g.connect(audioCtx.destination);
    src.start();
  } catch (e) { /* audio non dispo */ }
}

// ---------- Cris des animaux à la frappe ----------
function animalHitSound(a) {
  switch (a.key) {
    case "oiseau":     // "cui-cui !" : deux pépiements aigus (celui qui plaît)
      beep(1350, 0.06, "square", 0.1, 0, 1800);
      beep(1600, 0.07, "square", 0.09, 0.08, 1100);
      break;
    case "grenouille": // "crôââ-â" bien baveux : râle grave + grognement doublé
      beep(175, 0.18, "sawtooth", 0.2, 0, 90);
      beep(88, 0.2, "square", 0.12, 0, 60);
      beep(130, 0.12, "sawtooth", 0.14, 0.15, 70);
      break;
    case "manchot":    // "HO-ONK !" de trompette bien franc
      beep(300, 0.05, "square", 0.16, 0, 360);
      beep(360, 0.16, "square", 0.17, 0.05, 300);
      beep(240, 0.12, "sawtooth", 0.1, 0.05, 220);
      break;
    case "chibre":     // "SPROïNG" de ressort qui se détend + petite claque
      beep(120, 0.05, "sine", 0.2, 0, 900);
      beep(900, 0.16, "sine", 0.18, 0.05, 380);
      beep(500, 0.06, "triangle", 0.12, 0.02, 700);
      break;
    default:           // lapin : gros "BOI-OING" élastique (monte puis redescend)
      beep(240, 0.14, "sine", 0.24, 0, 760);
      beep(760, 0.18, "sine", 0.2, 0.09, 240);
      beep(200, 0.1, "triangle", 0.1, 0, 300);
      break;
  }
}

// ---------- Musique de fond (chiptune procédural) ----------
// Boucle enjouée de 2 mesures, planifiée sur l'horloge audio. Volume discret,
// coupée par M (comme les bruitages) et basculable indépendamment avec N.
let musicOn = true;
let musicStep = 0, musicNextT = 0, musicGain = null;
const MBPM = 128;
//                 mesure 1 (I – vi) ............  mesure 2 (IV – V) ...........
const MUS_MELODY = [12, 16, 19, 16, 9, 12, 16, -1, 17, 14, 12, 9, 7, 11, 14, -1];
const MUS_BASS   = [0, -1, 7, -1, -3, -1, 4, -1, -7, -1, 0, -1, -5, -1, 2, -1];
const MUS_HAT    = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1];
function mfreq(semi) { return 261.63 * Math.pow(2, semi / 12); }
function musicVoice(freq, dur, type, vol, t0) {
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(musicGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function musicTick() {
  if (!musicOn || muted || !audioCtx || audioCtx.state !== "running") return;
  if (!musicGain) { musicGain = audioCtx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(audioCtx.destination); }
  // la musique tourne dans les menus et pendant le jeu
  const on = state !== "netError";
  if (!on) return;
  const spb = 60 / MBPM / 2; // durée d'une croche
  if (musicNextT < audioCtx.currentTime) musicNextT = audioCtx.currentTime + 0.05;
  while (musicNextT < audioCtx.currentTime + 0.12) {
    const st = musicStep % 16;
    const m = MUS_MELODY[st];
    if (m > -1) musicVoice(mfreq(m + 12), spb * 0.92, "triangle", 0.05, musicNextT);
    const b = MUS_BASS[st];
    if (b > -1) musicVoice(mfreq(b - 12), spb * 1.7, "square", 0.045, musicNextT);
    if (MUS_HAT[st]) noiseVoiceHat(musicNextT); // petit charley
    musicStep++;
    musicNextT += spb;
  }
}
function noiseVoiceHat(t0) {
  const dur = 0.03;
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const f = audioCtx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
  const g = audioCtx.createGain(); g.gain.value = 0.03;
  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start(t0);
}

