# Skull King Score

Compteur de points pour le jeu de cartes **Skull King**, en français, anglais, allemand et espagnol.
Application web autonome, sans compte, sans serveur, qui fonctionne hors-ligne une fois installée.

## Fonctionnalités

- Saisie rapide des annonces et des plis avec des compteurs plus/moins, valeur par défaut 0
- Barème Classique ou Rascal (Mitraille et Boulet)
- Options Butin, Kraken, Baleine blanche
- Pirates nommés : pouvoirs rappelés, pari du Rascal, réglage d'annonce de Harry
- Règles maison : vos propres cartes et pénalités, avec points, quantité et plis supplémentaires
- Bonus officiels, ajustement libre par joueur et par manche
- Classement, courbe de progression, tableau manche par manche, correction d'une manche
- Hall of fame : répertoire de joueurs, archive des parties, statistiques, face à face
- Identité visuelle par joueur : couleur libre et pictogramme parmi 50
- Sauvegarde et restauration de tout l'historique dans un fichier

## Déploiement

1. Créer un dépôt GitHub et y pousser ces fichiers sur la branche `main`.
2. Dans **Settings → Pages**, choisir **Source : GitHub Actions**.
3. Pousser. Le workflow `.github/workflows/deploy.yml` publie le site à chaque commit sur `main`.

L'URL sera de la forme `https://<compte>.github.io/<dépôt>/`.

Le workflow vérifie au passage la syntaxe JavaScript de l'application et horodate la version du
cache du service worker, pour que les visiteurs reçoivent la nouvelle version sans vider leur cache.

## Où vivent les données des joueurs

Il n'y a **pas de serveur**. Tout est enregistré dans le `localStorage` du navigateur de chaque
utilisateur, sous l'origine du site. Conséquences à connaître :

- **Rien ne remonte nulle part.** Aucune donnée personnelle ne transite ni n'est stockée côté hébergeur.
- **Le stockage est lié à l'URL.** Si vous déplacez le site vers un autre domaine ou un autre chemin,
  les historiques semblent disparaître : ils restent rangés sous l'ancienne origine. Prévenez vos
  utilisateurs et faites-leur exporter leur fichier de sauvegarde avant un déménagement.
- **Pas de synchronisation entre appareils.** Le téléphone et l'ordinateur ont deux historiques
  distincts. Le fichier de sauvegarde sert aussi à transférer l'un vers l'autre.
- **Sur iPhone, l'installation n'est pas cosmétique.** Safari efface les données d'un site après
  7 jours sans visite. Une application ajoutée à l'écran d'accueil échappe à cette règle. L'app
  affiche un bandeau qui explique la manœuvre tant qu'elle tourne dans un onglet.
- L'application demande `navigator.storage.persist()` au démarrage, ce que Chrome accorde souvent
  à une PWA installée, pour éviter l'éviction automatique du stockage.
- Un rappel discret propose d'exporter l'historique au-delà de 10 parties non sauvegardées.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | l'application entière : interface, moteur de score, traductions |
| `manifest.webmanifest` | métadonnées d'installation |
| `sw.js` | service worker : hors-ligne et mises à jour |
| `icons/` | icônes d'installation |
| `.github/workflows/deploy.yml` | publication automatique sur GitHub Pages |

## Développement

`index.html` est autonome : ouvrez-le directement dans un navigateur pour tester. Le service worker
est ignoré en protocole `file:`, le reste fonctionne à l'identique.

Le moteur de score est isolé entre les marqueurs `/*ENGINE_START*/` et `/*ENGINE_END*/` et ne dépend
d'aucune API du navigateur, ce qui permet de le tester sous Node en extrayant simplement ce bloc.

## Langues

La langue est détectée depuis le navigateur au premier lancement, avec repli sur l'anglais, et se
change à tout moment dans le menu. La terminologie suit les éditions officielles : Grandpa Beck's
Games en anglais, Schmidt Spiele en allemand, Devir en espagnol.

## Licence

Skull King est une marque de Grandpa Beck's Games. Cette application est un compteur de points non
officiel, sans affiliation avec l'éditeur, et ne reproduit aucun élément graphique du jeu.
