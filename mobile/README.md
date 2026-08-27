# Skull King Ultimate Score : emballage mobile (Capacitor)

Ce dossier emballe l'application web de la racine du depot (`index.html`,
`manifest.webmanifest`, `icons/`) dans deux applications natives, Android et
iOS, avec [Capacitor](https://capacitorjs.com). Rien n'est duplique : les
assets web sont copies a la demande depuis la racine par `sync-www.mjs`.

- Identifiant : `fr.thinkr.skullkingscore`
- Nom affiche : Skull King Ultimate Score
- Version : 1.0.0 (Android `versionCode` et iOS build = numero de run de l'integration continue ; 1 en local)

## Pre-requis

- Node 22+ et npm (Capacitor 8 l'exige ; les workflows utilisent Node 22).
- Android : JDK 21, Android SDK avec `platform-tools`, `build-tools;35.0.0`,
  `platforms;android-35` et `platforms;android-36` (Capacitor 8 compile avec
  `compileSdk` 36, l'application cible `targetSdk` 36). Variable
  `ANDROID_HOME` pointant sur le SDK, ou un fichier `android/local.properties`
  contenant `sdk.dir=/chemin/vers/Sdk`.
- iOS : un Mac avec Xcode, voir `IOS.md`.

```sh
cd mobile
npm install
```

## Synchroniser les assets web (une commande)

```sh
npm run sync            # Android + iOS
npm run sync:android    # Android seulement
npm run sync:ios        # iOS seulement
```

`sync-www.mjs` reconstruit `mobile/www/` a partir de la racine du depot :

- `index.html` est copie avec le bloc d'enregistrement du service worker
  retire (le script echoue si ce bloc n'est pas trouve, pour ne jamais livrer
  silencieusement une version differente) ;
- `manifest.webmanifest` et `icons/` sont copies tels quels ;
- `sw.js` n'est pas embarque.

Puis `npx cap sync` recopie `www/` dans `android/app/src/main/assets/public`
et `ios/App/App/public`. Toute modification de `index.html` a la racine doit
etre suivie d'un `npm run sync` avant de reconstruire.

Pourquoi retirer le service worker : dans un WebView natif, les fichiers sont
deja locaux, il n'y a rien a mettre en cache. Sur Android, le service worker
se serait bien enregistre (origine `https://localhost`) et aurait ajoute une
couche de cache susceptible de servir un ancien `index.html` apres une mise a
jour de l'application. Sur iOS (`capacitor://localhost`), le test
`location.protocol.indexOf('http') === 0` de la page l'aurait de toute facon
ignore. Le retirer donne un comportement identique sur les deux plateformes.

## Origine du WebView et persistance des donnees

L'application stocke tout dans `localStorage` (parties, hall of fame,
reglages). Ce stockage est lie a l'origine de la page :

- Android : `https://localhost` (defaut Capacitor) ;
- iOS : `capacitor://localhost` (defaut Capacitor).

Ces valeurs sont laissees par defaut dans `capacitor.config.json` et ne
doivent pas etre modifiees d'une version a l'autre : changer `server.hostname`
ou `server.androidScheme`/`iosScheme` changerait l'origine et ferait
disparaitre les donnees des utilisateurs (elles resteraient sur le disque
mais ne seraient plus visibles). Les donnees ne sont pas partagees avec la
version web (`https://vincentguyader.github.io/skull-king-score/`), qui a sa
propre origine.

`android:allowBackup="true"` (defaut) laisse Android sauvegarder le WebView
dans la sauvegarde du compte Google ; `allowMixedContent` est a `false` et
l'application n'appelle aucun reseau.

## Android

### Cle de signature (upload key)

- Keystore : `mobile/android/upload-keystore.jks` (alias `upload`, RSA 4096,
  valide jusqu'en 2054).
- Mots de passe : `mobile/android/keystore.properties`.

Les deux fichiers sont ignores par git (`mobile/.gitignore`). Il faut les
sauvegarder ailleurs (gestionnaire de mots de passe, coffre). Avec Play App
Signing (obligatoire pour un nouveau projet Play Console), cette cle est la
cle d'upload : Google re-signe l'AAB avec la cle de l'application. En cas de
perte, il est possible de demander a Google une reinitialisation de la cle
d'upload, mais c'est une procedure manuelle de plusieurs jours.

`app/build.gradle` lit `keystore.properties` s'il existe ; sans ce fichier le
build release passe mais l'AAB n'est pas signe.

Empreinte de la cle (a garder pour verification) :

```sh
keytool -list -v -keystore android/upload-keystore.jks -alias upload
```

### Construire l'AAB de release

```sh
npm run sync:android
npm run android:bundle
# ou : cd android && ./gradlew bundleRelease
```

Sortie : `mobile/android/app/build/outputs/bundle/release/app-release.aab`.

Un APK de test (a installer avec `adb install`) :

```sh
npm run android:apk
# mobile/android/app/build/outputs/apk/release/app-release.apk
```

Verification rapide du contenu :

```sh
unzip -l android/app/build/outputs/bundle/release/app-release.aab | grep -E "AndroidManifest|assets/public/index.html"
jarsigner -verify -verbose android/app/build/outputs/bundle/release/app-release.aab | tail -3
```

### Reglages natifs

- `android/variables.gradle` : `minSdkVersion` 24 (defaut Capacitor),
  `compileSdkVersion` 36, `targetSdkVersion` 36.
- `android/app/src/main/AndroidManifest.xml` : `screenOrientation="portrait"`.
- `android/app/src/main/res/values/colors.xml` et `styles.xml` : barre de
  statut, barre de navigation, fond de fenetre et ecran de lancement en
  `#0d151d`.
- Icones : generees par `@capacitor/assets` a partir de `mobile/assets/`
  (`icon-only.png`, `icon-foreground.png`, `icon-background.png`,
  `splash.png`, `splash-dark.png`). Pour regenerer :

  ```sh
  npx capacitor-assets generate --android --ios \
    --iconBackgroundColor '#0d151d' --iconBackgroundColorDark '#0d151d' \
    --splashBackgroundColor '#0d151d' --splashBackgroundColorDark '#0d151d'
  ```

  Les fichiers de `mobile/assets/` ont ete produits par agrandissement des PNG
  512 px de `icons/` (pas de source vectorielle dans le depot). Un rendu net
  demande de les refaire depuis l'illustration d'origine.

## iOS

Voir `IOS.md` (Xcode, signature, archive, TestFlight, notes pour la review).

## Monter de version

Les numeros de build sont fournis par l'integration continue : `versionCode`
Android et `CURRENT_PROJECT_VERSION` iOS valent le numero de run du workflow
(`github.run_number`), strictement croissant par construction. En local,
`VERSION_CODE=42 npm run android:bundle` force la valeur ; sans variable,
`versionCode` vaut 1.

A chaque version visible par les utilisateurs :

1. Android, `android/app/build.gradle` : `versionName` (ex. `1.0.1`).
2. iOS, `ios/App/App.xcodeproj/project.pbxproj` (ou Xcode > cible App >
   General) : `MARKETING_VERSION` (= `CFBundleShortVersionString`), les deux
   occurrences (Debug et Release).
3. `mobile/package.json` : champ `version`, pour information.
4. Pousser un tag `vX.Y.Z` : les workflows `android-release.yml` et
   `ios-release.yml` construisent, signent et envoient (piste interne Play,
   TestFlight). Ils se lancent aussi a la main depuis l'onglet Actions, avec
   le choix de la piste Play et du mode construction seule pour iOS.

## Workflows de publication

- `.github/workflows/android-release.yml` (Ubuntu) : `sync:android`, AAB
  release signe par la cle d'upload lue dans les secrets
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`, artefact publie, puis envoi sur Google Play si
  `PLAY_SERVICE_ACCOUNT_JSON` existe (textes de nouveautes dans
  `store/whatsnew/`).
- `.github/workflows/ios-release.yml` (macOS) : `sync:ios`, archive signee par
  Apple (signature cloud avec la cle API App Store Connect : secrets
  `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_P8`,
  `APPLE_TEAM_ID`), envoi a App Store Connect, d'ou TestFlight.

## Points d'attention avant soumission

- Le nom "Skull King" est une marque deposee (jeu edite par Grandpa Beck's
  Games, Schmidt Spiele en Europe). Les deux boutiques peuvent demander une
  autorisation ou refuser le nom ; ce dossier ne renomme rien, la decision
  revient a l'editeur de l'application.
- Google Play exige `targetSdk` 36 pour les nouvelles applications a partir
  de fin aout 2026 : c'est la valeur de `android/variables.gradle`.
- Android 16 ignore `screenOrientation` sur les ecrans de 600 dp et plus
  (tablettes, pliables ouverts) : l'application peut y etre affichee en
  paysage, la mise en page reste une colonne centree.
- Formulaire "Securite des donnees" Play et "App Privacy" App Store : aucune
  collecte, aucun tracking, aucun compte, aucune connexion reseau.
