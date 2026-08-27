# Publication de Skull King Ultimate Score : pas à pas

Ce document liste, dans l'ordre, les étapes de mise en ligne sur Google Play et sur l'App Store, avec les champs préremplis à partir des fichiers de `store/listing/`. Il suppose que l'enveloppe native (Android : Trusted Web Activity ou WebView ; iOS : WKWebView / Capacitor) est déjà construite depuis le dossier `mobile/`, et que l'application web est publiée sur https://vincentguyader.github.io/skull-king-score/.

Livrables utilisés ici :

- Captures : `store/screenshots/<taille>/<langue>/*.png`
- Icône Play 512x512 : `store/graphics/play-icon-512.png`
- Bannière Play 1024x500 : `store/graphics/play-feature-graphic-1024x500.png`
- Icône App Store 1024x1024 : `store/graphics/appstore-icon-1024.png`
- Textes : `store/listing/fr.md`, `en.md`, `de.md`, `es.md`
- Réponses aux questionnaires : `store/listing/questionnaires.md`
- Politique de confidentialité : https://vincentguyader.github.io/skull-king-score/privacy.html (fichier `privacy.html` à la racine du dépôt, publié par le workflow de déploiement)

Vérification avant tout envoi : `node store/check.mjs` (dimensions des PNG, longueurs des champs, absence de tirets typographiques).

## 0. Préalables communs

- [ ] Identifiant d'application unique et définitif, identique sur les deux boutiques : `fr.thinkr.skullkingscore` (déjà fixé dans `mobile/capacitor.config.json`, le Gradle et le projet Xcode ; impossible à changer après la première publication).
- [ ] Version 1.0.0, code de version 1 (Android `versionCode`, iOS `CFBundleVersion`).
- [ ] Nom affiché sous l'icône : « Skull King » (court) ou « SK Ultimate Score » ; le nom complet « Skull King Ultimate Score » sert de titre de fiche.
- [ ] `privacy.html` déployé et accessible (tester l'URL dans un navigateur privé).
- [ ] Faire un test réel sur au moins un téléphone Android et un iPhone : hors-ligne, sauvegarde et restauration du fichier, partage du résultat, rotation.
- [ ] Les captures d'écran ne montrent aucune donnée réelle : ce sont des données semées par `store/screenshots/capture.mjs`.

## 1. Google Play Console

### 1.1 Compte et application

- [ ] Compte développeur Google Play (frais uniques de 25 USD ; compte personnel : vérification d'identité et, depuis 2024, test fermé obligatoire avec au moins 12 testeurs pendant 14 jours avant de pouvoir demander l'accès à la production ; compte organisation : numéro D-U-N-S non requis sur Play mais vérification de l'organisation).
- [ ] « Créer une application » : nom `Skull King Ultimate Score`, langue par défaut « Français (France) », type « Application » (le choix « Jeu » est possible mais impose les catégories de jeux ; choisir « Application » puis la catégorie « Jeux > Cartes » n'est pas offert, voir 1.5), gratuite.
- [ ] Accepter les déclarations (règles du programme pour les développeurs, lois sur l'exportation des États-Unis).

### 1.2 Signature et AAB

- [ ] Générer une clé d'upload (keystore) et la conserver hors du dépôt ; noter mot de passe et alias dans le gestionnaire de mots de passe.
- [ ] Activer **Play App Signing** (proposé lors du premier upload) : Google garde la clé de signature de l'application, vous ne gardez que la clé d'upload. Choisir « Laisser Google gérer la clé ».
- [ ] Construire un **Android App Bundle** (`.aab`) signé avec la clé d'upload, `targetSdkVersion` au niveau exigé pour l'année en cours (API 35 ou plus en 2026).
- [ ] Pour une Trusted Web Activity : publier `/.well-known/assetlinks.json` sur le site avec l'empreinte SHA-256 de la **clé de signature Play** (visible dans Play Console > Configuration > Intégrité de l'application), sinon la barre d'adresse reste visible.

### 1.3 Tests

- [ ] **Tests internes** : créer une version, envoyer l'AAB, ajouter les adresses e-mail des testeurs (liste « Testeurs internes »), partager le lien d'adhésion. Vérifier l'installation, le hors-ligne, la sauvegarde.
- [ ] **Tests fermés** (obligatoire pour un compte personnel créé après novembre 2023) : même AAB, 12 testeurs minimum inscrits sans interruption pendant 14 jours, puis « Demander l'accès à la production » dans le tableau de bord et répondre au questionnaire.
- [ ] **Production** : créer la version, réutiliser l'AAB, notes de version (« Nouveautés 1.0.0 » de chaque fichier de `store/listing/`, une entrée par langue fr-FR, en-US, de-DE, es-ES), déploiement progressif facultatif.

### 1.4 Fiche du Play Store (Grandir > Fiche Play Store > Fiche principale)

Pour chaque langue (fr-FR par défaut, puis ajouter en-US, de-DE, es-ES via « Gérer les traductions ») :

| Champ | Valeur |
|---|---|
| Nom de l'application (30) | `Skull King Ultimate Score` |
| Description courte (80) | section « Description courte Play » du fichier de la langue |
| Description complète (4000) | section « Description complète » du fichier de la langue, mention de marque incluse |
| Icône de l'application | `store/graphics/play-icon-512.png` (512x512, PNG 32 bits) |
| Image de présentation (1024x500) | `store/graphics/play-feature-graphic-1024x500.png` |
| Captures téléphone (2 à 8, 16:9 ou 9:16, 320 à 3840 px) | `store/screenshots/play-phone-1080x1920/<langue>/` : choisir 8 parmi les 10 (recommandé : 01, 02, 03, 04, 04b, 05, 06, 07b) |
| Captures tablette 7 pouces et 10 pouces | facultatives, non fournies (l'application est pensée pour le téléphone) |
| Vidéo | aucune |

- [ ] Coordonnées (Fiche Play Store > Coordonnées) : e-mail `vincent@thinkr.fr` (obligatoire, affiché publiquement), site https://vincentguyader.github.io/skull-king-score/.

### 1.5 Catégorie et tags

- [ ] Grandir > Fiche Play Store > Paramètres de la fiche : catégorie « Cartes » (famille Jeux) ; si l'application a été déclarée « Application », choisir « Outils » ou changer le type en « Jeu » dans Configuration > Paramètres avancés. Recommandation : type **Jeu**, catégorie **Cartes**, tags « Jeu de cartes », « Hors connexion », « Score ».

### 1.6 Contenu de l'application (Règles > Contenu de l'application)

Toutes les réponses détaillées sont dans `store/listing/questionnaires.md`.

- [ ] Règles de confidentialité : https://vincentguyader.github.io/skull-king-score/privacy.html
- [ ] Annonces : non.
- [ ] Accès à l'application : toutes les fonctionnalités sont accessibles sans identifiant.
- [ ] Classification du contenu (IARC) : catégorie « Jeu », toutes les réponses à « Non » ; attendu PEGI 3 / Everyone.
- [ ] Public cible et contenu : 13 ans et plus ; « L'application n'attire pas involontairement les enfants ».
- [ ] Application d'actualités : non. COVID : non. Fonctionnalités financières : aucune. Santé : non. Applications gouvernementales : non.
- [ ] Sécurité des données : aucune donnée collectée, aucune donnée partagée (voir questionnaire).

### 1.7 Prix et distribution

- [ ] Monétisation > Tarification : **Gratuite** (irréversible : une application gratuite ne peut pas devenir payante).
- [ ] Production > Pays et régions : « Ajouter des pays/régions » > tout sélectionner (ou au minimum France, Belgique, Suisse, Canada, Allemagne, Autriche, Espagne, Royaume-Uni, États-Unis, Mexique, Argentine).
- [ ] Appareils : téléphones, tablettes ; pas de Wear OS, TV, Auto.

### 1.8 Envoi

- [ ] Tableau de bord : toutes les tâches de « Configurer votre application » cochées.
- [ ] « Envoyer pour examen » depuis Aperçu de la publication. Délai habituel : de quelques heures à 7 jours pour une première application.
- [ ] Si le titre est contesté pour usage de la marque « Skull King » : appliquer le plan de repli (renommer en « Ultimate Score pour Skull King », garder la mention de marque dans la description), puis répondre à l'appel dans la Console.

## 2. App Store Connect

### 2.1 Compte et identifiants

- [ ] Compte Apple Developer Program (99 USD par an ; en tant qu'organisation : numéro D-U-N-S ; en tant que personne : vérification d'identité).
- [ ] Certificates, Identifiers & Profiles : créer l'App ID explicite `fr.thinkr.skullkingscore` (le même identifiant que sur Android par commodité), sans capacité particulière (pas de Push, pas d'iCloud, pas de Sign in with Apple).
- [ ] Xcode : équipe sélectionnée, signature automatique, `Bundle Identifier` identique, `Version` 1.0.0, `Build` 1.
- [ ] `Info.plist` : `ITSAppUsesNonExemptEncryption` = `NO` ; `UIRequiresFullScreen` selon le besoin ; orientations : portrait seul ; cible iPhone uniquement (`TARGETED_DEVICE_FAMILY` 1).
- [ ] Icône : `store/graphics/appstore-icon-1024.png` dans l'asset catalog (1024x1024, sans transparence, coins carrés : Apple applique lui-même le masque). Voir la réserve de qualité dans le rapport : c'est un agrandissement du 512 px.

### 2.2 Fiche App Store Connect

- [ ] Mes apps > « + » > Nouvelle app : plateformes iOS ; nom `Skull King Ultimate Score` ; langue principale « Français (France) » ; Bundle ID ; SKU `skullkingscore-1` ; accès utilisateur : accès complet.
- [ ] Informations sur l'app :

| Champ | Valeur |
|---|---|
| Nom (30) | `Skull King Ultimate Score` |
| Sous-titre (30) | section « Sous-titre App Store » de chaque langue |
| Catégorie principale | Jeux ; sous-catégories Cartes et Plateau |
| Catégorie secondaire | Utilitaires |
| Droits d'auteur | `2026 Vincent Guyader` |
| Classification par âge | questionnaire, toutes réponses « Aucun » : attendu 4+ (voir questionnaires.md) |
| Licence | licence standard Apple (EULA par défaut) |
| Accord de licence spécifique | non |

- [ ] Localisations à ajouter : Anglais (États-Unis), Anglais (Royaume-Uni, copie), Allemand, Espagnol (Espagne), et éventuellement Espagnol (Mexique) et Français (Canada) par copie.

### 2.3 Version 1.0.0 (onglet App Store > iOS App)

Pour chaque langue :

| Champ | Valeur |
|---|---|
| Captures iPhone 6,7 pouces (obligatoire, 1290x2796) | `store/screenshots/appstore-6.7-1290x2796/<langue>/` : jusqu'à 10 captures, prendre les 10 ou les 8 recommandées (01, 02, 03, 04, 04b, 05, 06, 07b) |
| Captures iPhone 6,5 pouces (1284x2778 ou 1242x2688) | `store/screenshots/appstore-6.5-1284x2778/<langue>/` ; depuis 2024 Apple les dérive du 6,7 pouces si on ne les fournit pas, mais les fournir évite le recadrage |
| Captures iPad | non requises : le build est iPhone uniquement |
| Texte promotionnel (170) | section « Texte promotionnel App Store » |
| Description (4000) | section « Description complète » |
| Mots-clés (100) | section « Mots-clés App Store » |
| URL d'assistance | https://github.com/VincentGuyader/skull-king-score |
| URL marketing | https://vincentguyader.github.io/skull-king-score/ |
| Nouveautés (pas demandé pour une 1.0, sinon) | section « Nouveautés 1.0.0 » |

Point de vigilance 2026 : les tailles exigées dépendent des appareils supportés par le build ; App Store Connect affiche la liste exacte au moment de l'envoi (en 2025-2026 : 6,9 pouces 1320x2868 OU 6,5 pouces 1284x2778 pour l'iPhone). Si la case 6,9 pouces est réclamée, régénérer avec `capture.mjs` en ajoutant une entrée `{ key: 'appstore-6.9-1320x2868', w: 440, h: 956, dsf: 3 }` dans `SIZES`.

- [ ] Build : joindre le build téléversé (voir 2.4).
- [ ] Informations générales de la version : icône (prise dans le build), version 1.0.0, copyright, classification.
- [ ] Coordonnées de l'examinateur : nom, téléphone, `vincent@thinkr.fr`. Compte de démonstration : « non requis ».
- [ ] Notes pour l'examen (à coller) :

```
Skull King Ultimate Score is an unofficial score keeper for the Skull King card game (trademark of Grandpa Beck's Games; this is stated in the description). The app needs no account and no network: all data is stored locally on the device. To test: tap "Start the game", enter bids with the + buttons, validate, enter tricks, validate; the scores screen shows the ranking, the chart and the table. The "Hall of fame" is empty until a game is archived. The backup file is created only on user request via the system share sheet. No third-party SDK, no analytics, no ads.
```

- [ ] Diffusion de la version : « Diffuser manuellement cette version » (permet de choisir le moment) ou automatique.
- [ ] Tarification et disponibilité : **Gratuit** (niveau 0), tous les pays ou la sélection ci-dessus ; pas de précommande.

### 2.4 TestFlight

- [ ] Archiver dans Xcode (Product > Archive) puis Distribute App > App Store Connect > Upload. Ou `xcodebuild -exportArchive` puis `xcrun altool` / Transporter.
- [ ] Répondre à la question de conformité à l'export (« Non, pas de chiffrement non exempté ») si `ITSAppUsesNonExemptEncryption` n'est pas dans l'Info.plist.
- [ ] TestFlight > Testeurs internes : ajouter jusqu'à 100 membres de l'équipe, disponible immédiatement.
- [ ] TestFlight > Testeurs externes : groupe, lien public ; le premier build externe passe par un examen TestFlight (1 à 2 jours). Renseigner « Informations de test » : quoi tester, e-mail de contact.
- [ ] Tester sur iPhone : installation, hors-ligne (mode avion), export du fichier (feuille de partage > Enregistrer dans Fichiers), import, partage du résultat, retour arrière avec le geste système.

### 2.5 Confidentialité (App Privacy)

- [ ] URL de la politique : https://vincentguyader.github.io/skull-king-score/privacy.html
- [ ] « Commencer » > Collectez-vous des données ? **Non** > Publier. L'étiquette affichera « Données non collectées ».

### 2.6 Envoi et examen

- [ ] « Ajouter pour examen » puis « Soumettre à l'examen App Review ». Délai habituel : 24 à 48 heures.
- [ ] Motifs de rejet à anticiper :
  - 5.2.1 (propriété intellectuelle, marque « Skull King » dans le nom) : répondre dans le Resolution Center que l'application est un compteur de points compatible, mention de marque présente, aucun élément graphique du jeu repris ; si Apple maintient, appliquer le plan de repli du titre.
  - 4.2 (fonctionnalité minimale, « site web empaqueté ») : souligner le fonctionnement hors-ligne complet, l'absence de navigation web, le partage natif, le maintien de l'écran allumé ; c'est une application autonome, pas une vitrine.
  - 2.1 (informations manquantes) : les notes d'examen ci-dessus suffisent, pas de compte à fournir.

## 3. Déploiement de `privacy.html`

Publié par `.github/workflows/deploy.yml` avec le site (étape « Assembler le site ») : https://vincentguyader.github.io/skull-king-score/privacy.html. Le service worker garde chaque page sous sa propre adresse, la politique ne remplace jamais l'application dans le cache hors-ligne.

## 4. Après publication

- [ ] Renseigner les liens des boutiques dans le README et dans la section « À propos » de l'application.
- [ ] Surveiller les rapports de plantage (Play Console > Vitals ; App Store Connect > Xcode Organizer) pendant la première semaine.
- [ ] Conserver la clé d'upload Android et le certificat de distribution Apple dans un coffre ; sans eux, aucune mise à jour n'est possible.
- [ ] Prévoir un rappel annuel pour le renouvellement Apple Developer et pour la montée de `targetSdkVersion` exigée par Google chaque année (août).
