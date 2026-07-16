# 🏐 Crabby Volley — Volley des Animaux - Jeu du volley avec des animaux

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

> 🌐 **Connectivité** — la connexion est en P2P direct (WebRTC), avec repli sur
> un serveur TURN public si le direct échoue (NAT strict, pare-feu). Si la
> négociation n'aboutit pas sous 20 s, un message d'erreur s'affiche (avec un
> diagnostic technique en petit, utile pour signaler un problème) plutôt que de
> rester bloqué indéfiniment sur "Recherche de la partie…".

### Modes de jeu

L'écran d'accueil propose 3 grandes catégories ; chacune débouche sur ses
propres sous-choix plutôt qu'un mur d'options :

| Accueil | Puis... |
|---------|---------|
| **1 — Solo contre l'IA** | choix de la difficulté (Facile/Normale/Difficile/Impitoyable), puis du format : 1v1, 2v2 (toi + IA vs 2 IA), ou 💣 Bombe (1v1/2v2) |
| **2 — Multijoueur local** | même écran/clavier (ou 2 manettes) : 1v1 classique ou 💣 Bombe |
| **3 — Jouer en ligne** | créer une partie 1v1/2v2 (classique ou 💣 Bombe) et partager le code, ou rejoindre avec un code |
| **R — Règles** | rappel des commandes, techniques SUPER et fiche de chaque animal |

> **Mode Bombe** — La balle devient une bombe à mèche (durée réglable : 5/7/10 s).
> Elle explose au bout du délai choisi *ou* dès qu'elle touche le sol. Dans les
> deux cas, **le camp où se trouve la bombe au moment de l'explosion perd le
> point**. Un compte à rebours central et un voile rouge indiquent le camp en
> danger. (Le Smash Battle est désactivé dans ce mode : la mèche, elle, ne
> s'arrête jamais.)

### Commandes & navigation

- **Rouge** : `Q`/`D` (ou flèches) pour bouger, `Z`/`Espace`/`↑` pour sauter, `S` pour la technique SUPER.
- **Vert** : `←`/`→`, `↑`, `↓` (SUPER).
- Manettes prises en charge (Gamepad API) : stick/croix pour naviguer les menus, A valider, B retour.
- **Souris** : tous les menus sont aussi cliquables (survol + clic), en plus du clavier/manette.
- **Tactile (mobile)** : pavé directionnel + boutons saut/SUPER superposés au
  jeu sur un appareil tactile, pendant une manche jouable en solo ou en ligne
  1v1 (le 2v2 tactile n'est pas pris en charge — trop de joueurs pour un seul
  écran de téléphone).
- `P` : pause · `M` : son · `N` : musique. Un curseur de volume (5 crans,
  cliquable) est visible sur l'écran d'accueil ; ces réglages (son coupé,
  musique, volume) sont **mémorisés d'une session à l'autre** (`localStorage`).

> ⌨️ **Clavier AZERTY** : les raccourcis sont pensés nativement pour un clavier
> français (`Q`/`D` pour bouger, `Z` pour sauter — pas `A`/`W` comme en QWERTY).
> Attention si tu ajoutes un raccourci basé sur une lettre : `event.code` reflète
> la **position physique** de la touche (norme QWERTY), pas la lettre imprimée
> sur un clavier AZERTY — certaines touches se déplacent (ex. `M` est à la
> position `Semicolon` en AZERTY, et `KeyM` y correspond à la virgule). Toujours
> vérifier les deux avant de considérer un raccourci lettre comme fiable.

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
| `src/02-audio.js` | Sons, cris des animaux, musique chiptune, volume/réglages persistés (`localStorage`) |
| `src/03-input.js` | Clavier, manettes (Gamepad API), souris (clic menus) & tactile (mobile) |
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
vérifie déterminisme, physique, score, round-trip de snapshot, simulation 2v2,
mode Bombe (explosion en fin de mèche et à la chute) et l'ownership de balle
(prédiction/réconciliation invité en 1v1).

```bash
npm test
```

## 📦 Déploiement

Le jeu est un site statique : n'importe quel serveur web suffit. Copier
`index.html` + le dossier `src/` (et servir en HTTPS pour le multijoueur en ligne).

### Déploiement continu (push sur `main` → prod)

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
lance les tests puis, s'ils passent, synchronise `index.html` + `src/` vers la
racine web du serveur en SSH (`rsync` via `sudo`). Il se déclenche à chaque push
sur `main` (ou manuellement via *Run workflow*). Au passage, il remplace le
suffixe `?v=DEV` des balises `<script>` par le SHA du commit — anti-cache pour
que chaque déploiement serve du frais, même à un navigateur qui aurait mis les
scripts en cache.

Il faut renseigner 4 *secrets* du dépôt (**Settings → Secrets and variables →
Actions → New repository secret**) :

| Secret | Valeur |
|--------|--------|
| `DEPLOY_HOST` | l'adresse du serveur (IP ou nom d'hôte) |
| `DEPLOY_USER` | l'utilisateur SSH (ex. `ubuntu`) |
| `DEPLOY_WEB_ROOT` | la racine web (ex. `/var/www/blobby-volley`) |
| `DEPLOY_SSH_KEY` | la **clé privée** de déploiement, **encodée en base64** (voir ci-dessous) |

> La clé privée est encodée en base64 pour éviter que les retours à la ligne
> soient altérés au copier-coller. Sur macOS :
> `base64 -i ~/.ssh/crabby_deploy | pbcopy` puis colle dans le secret.

La clé publique correspondante doit être ajoutée à `~/.ssh/authorized_keys` de
l'utilisateur SSH sur le serveur, et cet utilisateur doit pouvoir écrire dans la
racine web (ici via `sudo` sans mot de passe).

## 📄 Licence

[MIT](LICENSE) © Benjamin Mille
