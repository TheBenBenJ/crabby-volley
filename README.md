# 🏐 Crabby Volley — Volley des Animaux

Un jeu de volley 2D où des animaux rigolos s'affrontent sur la plage, la banquise
ou sous les étoiles. Techniques signature, météo dynamique, public en délire… et
un **mode multijoueur en ligne** (1v1 et 2v2) en pair-à-pair.

Le jeu tient dans une page HTML + Canvas, **sans build ni dépendance à installer** :
la seule librairie externe est [PeerJS](https://peerjs.com/) (chargée via CDN)
pour la signalisation du mode en ligne.

## ▶️ Jouer

Le jeu doit être servi en HTTP (le chargement des modules `src/` échoue en
`file://`). Depuis la racine du dépôt :

```bash
npm start          # sert le dossier sur http://localhost:8000
# ou
python3 -m http.server 8000
```

Puis ouvre <http://localhost:8000>. Le mode **en ligne** nécessite en plus une
connexion Internet (CDN PeerJS) et, entre machines distantes, un accès en **HTTPS**.

### Modes de jeu

| Menu | Mode |
|------|------|
| 1 / 2 / 3 | Solo contre l'IA (facile / normale / difficile) |
| 4 | Deux joueurs (même clavier ou 2 manettes) |
| 6 | **2v2** hors-ligne : toi + IA contre 2 IA |
| 5 | **En ligne** : créer/rejoindre une partie 1v1 ou 2v2 |

### Commandes

- **Rouge** : `Q`/`D` (ou flèches) pour bouger, `Z`/`Espace`/`↑` pour sauter, `S` pour la technique SUPER.
- **Vert** : `←`/`→`, `↑`, `↓` (SUPER).
- Manettes prises en charge (Gamepad API). `P` : pause · `M` : son · `N` : musique.

## 🗂️ Structure du code

Le jeu était historiquement un seul gros fichier. Il est désormais découpé en
**modules thématiques** chargés dans l'ordre par `index.html`. Ce sont des scripts
classiques qui **partagent le même scope global** : le découpage est purement
organisationnel, le comportement est strictement identique à l'ancien fichier
unique (vérifié par diff et par la suite de tests).

L'ordre de chargement **est** l'ordre des dépendances :

| Fichier | Rôle |
|---------|------|
| `src/01-core.js` | Constantes, canvas Hi-DPI, RNG déterministe |
| `src/02-audio.js` | Sons, cris des animaux, musique chiptune |
| `src/03-input.js` | Clavier & manettes (Gamepad API) |
| `src/04-state.js` | État, terrains, animaux, classe `Blob`, combos/supers |
| `src/05-animals.js` | Dessin des animaux & expressions faciales |
| `src/06-physics.js` | Balle & physique (collisions, filet, murs) |
| `src/07-scoring.js` | Points & score |
| `src/08-ai.js` | Intelligence artificielle (3 niveaux, 1v1 & 2v2) |
| `src/09-particles.js` | Particules (plumes, sable, confettis…) |
| `src/10-scenery.js` | Décor commun (public, ombres, filet) |
| `src/11-terrains.js` | Fonds & ambiances (plage, banquise, nuit) |
| `src/12-menus.js` | Écrans de menu et de sélection |
| `src/13-simulation.js` | Boucle de simulation à pas fixe (`stepGame`) |
| `src/14-snapshots.js` | Sérialisation d'état (snapshots réseau) |
| `src/15-net.js` | Multijoueur en ligne (WebRTC/PeerJS), 1v1 & 2v2 |
| `src/16-render.js` | Rendu (caméra, HUD, composition) |
| `src/17-main.js` | Boucle 60 Hz & amorçage |

La simulation est **déterministe** (pas fixe 60 Hz + RNG seedé), ce qui est la
condition du mode en ligne : voir [`docs/MULTIJOUEUR.md`](docs/MULTIJOUEUR.md)
pour l'architecture réseau (hôte autoritaire, prédiction/réconciliation).

## ✅ Tests

Une petite suite sans dépendance sert de **filet de sécurité**. Elle charge les
modules `src/` exactement comme le navigateur (concaténation dans l'ordre) puis
vérifie déterminisme, physique, score, round-trip de snapshot et simulation 2v2.

```bash
npm test
```

## 📦 Déploiement

Le jeu est un site statique : n'importe quel serveur web suffit. Copier
`index.html` + le dossier `src/` (et servir en HTTPS pour le multijoueur en ligne).

## 📄 Licence

[MIT](LICENSE) © Benjamin Mille
