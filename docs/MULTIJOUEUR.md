# Volley des Animaux — Conception du mode multijoueur en ligne

Réflexion d'architecture pour jouer à deux à distance, avec synchronisation.
Le code de `index.html` a déjà été préparé en conséquence (voir « Ce qui est déjà prêt »).

## 1. Les deux grandes approches

### A. Serveur autoritaire (WebSocket)

```
Client A ──inputs──▶ ┌─────────┐ ◀──inputs── Client B
                     │ Serveur │
Client A ◀──état──── │ (Node)  │ ────état──▶ Client B
                     └─────────┘
```

- Un petit serveur Node (`ws`) fait tourner la simulation ; les clients envoient
  leurs entrées et reçoivent l'état.
- **Plus** : anti-triche naturel, pas de problème NAT, reconnexion simple.
- **Moins** : il faut héberger et payer un serveur, latence = 2 × (client↔serveur).

### B. Pair-à-pair WebRTC, hôte autoritaire (retenu)

```
        signalisation (uniquement pour se trouver)
Hôte ◀─────────── serveur de signalisation ───────────▶ Invité
  │                                                        │
  └──────────── DataChannel WebRTC (direct) ───────────────┘
       Invité ──▶ inputs (60 Hz)
       Hôte  ──▶ snapshots (~30 Hz, 60 Hz près du filet)
```

- L'**hôte** fait tourner la vraie simulation (balle, collisions, score).
- L'**invité** envoie ses entrées, affiche les snapshots (interpolation +
  dead reckoning), et prédit localement son propre personnage.
- Près du filet, cadence de snapshots portée à 60 Hz pour un passage fluide.
- Signalisation via **PeerJS** ; TURN de secours pour les NAT stricts.
- **Plus** : robuste (pas de handoff), latence directe, pas de serveur de jeu.
- **Moins** : hits côté invité ressentent le RTT/2 ; triche possible côté hôte
  (acceptable entre amis).

> **Note** : une variante « ownership balle par camp » a été essayée puis
> abandonnée — les handoffs au filet provoquaient des balles bloquées /
> deadlocks. L'hôte autoritaire est le modèle stable.

### Variante écartée : lockstep déterministe pur

Échanger uniquement les entrées et faire tourner la simulation des deux côtés.
Très économe en bande passante, mais le moindre écart de calcul fait diverger
les deux parties, et la latence bloque le jeu (chacun attend les entrées de
l'autre). Le modèle hôte-autoritaire + snapshots est plus robuste. On garde
néanmoins le déterminisme du moteur : il permet la **prédiction** côté invité
et servira de filet de sécurité.

## 2. Modèle de synchronisation retenu

| Rôle   | Simule ?                  | Envoie              | Reçoit    |
|--------|---------------------------|---------------------|-----------|
| Hôte   | Oui (autorité complète)   | snapshot 30–60 Hz   | inputs    |
| Invité | Prédiction de son perso   | inputs 60 Hz        | snapshots |

- **Tick fixe 60 Hz** : la simulation avance par pas constants, jamais liés au
  framerate ni à l'horloge murale.
- **Interpolation** : l'invité affiche l'état avec ~100 ms de retard et interpole
  entre les deux derniers snapshots → mouvement fluide même si un paquet manque.
- **Prédiction + réconciliation** : l'invité applique immédiatement ses propres
  entrées à son personnage ; quand un snapshot arrive, il corrige en douceur
  (lissage sur quelques frames si l'écart est faible, téléport sinon).
- **Horloge** : le `tick` de l'hôte fait foi ; l'invité estime l'offset via
  ping/pong régulier.
- **Fiabilité** : DataChannel en mode non-ordonné/non-fiable pour inputs et
  snapshots (les vieux paquets sont jetés), un canal fiable séparé pour les
  événements critiques (début de partie, score, fin de match).

## 3. Protocole (JSON pour commencer, binaire si besoin)

```jsonc
// Invité → Hôte, à chaque tick
{ "t": "in", "tick": 1234, "l": false, "r": true, "j": false }

// Hôte → Invité, ~20 Hz  (contenu = getSnapshot() de index.html)
{ "t": "snap", "tick": 1236, "data": { /* état complet */ } }

// Poignée de main au début
{ "t": "hello", "name": "Ben", "animal": 2 }
{ "t": "start", "seed": 987654321, "terrain": 1, "animals": [0, 2] }

// Mesure de latence
{ "t": "ping", "id": 7 }   { "t": "pong", "id": 7 }
```

Débit estimé : snapshot ≈ 300 octets × 20 Hz ≈ 6 ko/s — négligeable.

## 4. Cas limites à gérer

- **Paquet perdu** : inputs → l'hôte réutilise la dernière entrée connue ;
  snapshots → le suivant écrase tout, aucune retransmission nécessaire.
- **Latence > 200 ms** : agrandir le tampon d'interpolation, afficher le ping.
- **Silence > 2 s** : pause automatique « connexion instable… », reprise à la
  réception du prochain snapshot (l'état complet suffit à repartir).
- **Déconnexion franche** : écran « adversaire déconnecté », retour menu.
- **Pause/onglet caché** : `requestAnimationFrame` s'arrête quand l'onglet est
  masqué → utiliser un `setInterval` de secours pour la boucle réseau de l'hôte.

## 5. Ce qui est déjà prêt dans `index.html`

- ✅ **Boucle à pas fixe 60 Hz** (accumulateur), découplée du rendu.
- ✅ **`stepGame(inL, inR)`** : la simulation ne lit plus le clavier directement,
  elle consomme des objets d'entrées `{left, right, jump}` — l'unité exacte
  qu'on échangera sur le réseau.
- ✅ **RNG seedé** (mulberry32) : toute la logique de jeu (service, erreurs de
  l'IA) tire dans `rng()` ; les effets visuels gardent `Math.random()`.
- ✅ **Compteur `tick`** : plus aucune horloge murale dans la simulation
  (un bug de ce type a été détecté et corrigé grâce au test de déterminisme).
- ✅ **`getSnapshot()` / `applySnapshot()`** : sérialisation complète de l'état.
- ✅ **Testé** : deux simulations indépendantes, même graine + mêmes entrées,
  produisent des états strictement identiques sur 2000 ticks
  (`determinism.js`, exécuté sous Node avec un canvas factice).

## 6. Feuille de route

1. **Extraction** : sortir la logique réseau dans `netplay.js` (le jeu reste
   jouable hors-ligne sans lui).
2. **Lobby** : écran « Créer une partie » (affiche un code à 4-6 caractères) /
   « Rejoindre » (saisie du code), via PeerJS.
3. **Prototype naïf** : l'hôte simule, l'invité envoie ses inputs et affiche
   les snapshots bruts (30 min de jeu laggy mais fonctionnel).
4. **Interpolation** côté invité (fluidité).
5. **Prédiction + réconciliation** du personnage de l'invité (réactivité).
6. **Confort** : indicateur de ping, pause auto, revanche sans repasser
   par le lobby, choix d'animal/terrain dans le lobby.

Estimation : étape 3 ≈ une demi-journée ; étapes 4-5 ≈ une journée ;
le tout jouable confortablement sur Internet en ~2-3 jours de travail.

## 7. Questions ouvertes

- **PeerJS cloud ou auto-hébergé ?** Le cloud gratuit suffit pour commencer ;
  un serveur TURN (ex. coturn) sera nécessaire pour ~10 % des joueurs derrière
  des NAT stricts.
- **Spectateurs ?** Le modèle snapshot les rend quasi gratuits (même flux).
- **Mobile** : le mode en ligne rend les contrôles tactiles plus intéressants
  (un seul joueur par écran) — à faire en parallèle de l'étape 2.
