# Skull King Ultimate Score : construire et publier la version iOS

Le projet Xcode est genere par `npx cap add ios` (Capacitor 8). Il utilise
Swift Package Manager (`ios/App/CapApp-SPM`), pas CocoaPods : il n'y a pas de
`Podfile` et `pod install` n'est pas necessaire. Tout ce qui suit se fait sur
un Mac ; sous Linux seul le squelette du projet peut etre genere et
configure.

## Etat du projet genere

- Bundle id : `fr.thinkr.skullkingscore` (`PRODUCT_BUNDLE_IDENTIFIER`).
- Nom affiche : Skull King Ultimate Score (`CFBundleDisplayName`).
- Version : `MARKETING_VERSION` 1.0.0, `CURRENT_PROJECT_VERSION` 1.
- Cible de deploiement : iOS 15.0 (defaut Capacitor 8), iPhone et iPad.
- Orientation : portrait seulement (iPhone) ; portrait et portrait inverse
  (iPad), `Info.plist`.
- Barre de statut : `UIStatusBarStyleLightContent`,
  `UIViewControllerBasedStatusBarAppearance` = NO, `UIUserInterfaceStyle`
  = Dark.
- Fond : `#0d151d` (`capacitor.config.json` > `ios.backgroundColor`, plus
  ecran de lancement genere dans `Assets.xcassets/Splash.imageset`).
- `ITSAppUsesNonExemptEncryption` = NO dans `Info.plist` (pas de
  chiffrement propre, pas de question a chaque build TestFlight).
- Icone : `Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
  (1024 x 1024, une seule image, format Xcode 14+).

Point a corriger avant soumission : cette icone 1024 px a ete produite par
agrandissement de `icons/icon-512.png` (le depot n'a pas de source
vectorielle). App Store Connect accepte le fichier, mais le rendu sera
legerement flou sur la fiche App Store. Remplacer `mobile/assets/icon-only.png`
(1024 x 1024, sans transparence) par un export de l'illustration d'origine,
puis relancer `npx capacitor-assets generate --ios ...` (commande dans
`README.md`).

## Pre-requis sur le Mac

- macOS recent et Xcode 16.x (ou plus recent : Apple exige l'iOS 18 SDK
  depuis avril 2025 pour toute soumission ; verifier la version minimale
  demandee dans les News App Store Connect au moment de l'envoi).
- Outils en ligne de commande : `xcode-select --install`.
- Node 22+ et npm.
- Un compte Apple Developer Program (payant) avec une equipe (Team) et les
  droits App Manager ou Admin.

## Etapes

```sh
git clone https://github.com/vincentguyader/skull-king-score
cd skull-king-score/mobile
npm install
npm run sync:ios          # node sync-www.mjs && npx cap sync ios
npx cap open ios          # ouvre ios/App/App.xcodeproj dans Xcode
```

Au premier lancement, Xcode resout les paquets Swift (`CapacitorApp-SPM`,
Capacitor) depuis GitHub ; attendre la fin de la resolution.

Dans Xcode :

1. Cible `App` > onglet Signing & Capabilities : cocher "Automatically manage
   signing", choisir la Team. Xcode cree l'App ID
   `fr.thinkr.skullkingscore` et les profils.
2. Onglet General : verifier Display Name, Bundle Identifier, Version
   (1.0.0) et Build (1).
3. Selectionner "Any iOS Device (arm64)" comme destination.
4. Product > Archive. A la fin, la fenetre Organizer s'ouvre.
5. Distribute App > App Store Connect > Upload, options par defaut
   (symbols, manage version and build number decoche pour garder le controle
   du numero).
6. Dans App Store Connect (https://appstoreconnect.apple.com), creer
   l'application (Mes apps > +) avec le meme bundle id si ce n'est pas deja
   fait, puis attendre que le build apparaisse dans TestFlight (quelques
   minutes a une heure).
7. TestFlight : ajouter des testeurs internes (jusqu'a 100, sans review),
   ou externes (review legere).
8. Pour la publication : onglet App Store, remplir la fiche, captures
   d'ecran (6.7", 6.5" ou 6.9" iPhone et 13" iPad puisque la cible inclut
   l'iPad), choisir le build, puis Submit for Review.

Test rapide sur simulateur avant l'archive : choisir un simulateur iPhone et
Product > Run.

## Verifier avant l'upload

- `Info.plist` contient bien `ITSAppUsesNonExemptEncryption` = NO.
- Le nombre de build (`CURRENT_PROJECT_VERSION`) n'a jamais ete envoye pour
  cette version marketing ; App Store Connect refuse un doublon.
- Les donnees sont dans `localStorage` sous l'origine
  `capacitor://localhost` ; ne pas modifier `server.iosScheme` ni
  `server.hostname` dans `capacitor.config.json` entre deux versions, sinon
  les utilisateurs perdent leurs parties.

## Notes pour la review App Store (a coller dans "Notes" de la soumission)

- Compteur de points hors ligne pour le jeu de cartes Skull King.
- Aucun compte, aucune connexion, aucun contenu telecharge : tout
  fonctionne sans reseau, l'application n'effectue aucune requete.
- Aucune collecte de donnees, aucun tracking, aucun SDK publicitaire ou
  d'analyse. App Privacy : "Data Not Collected".
- Les donnees (parties, hall of fame, reglages) restent sur l'appareil dans
  le stockage du WebView.
- Pas de chiffrement propre ; `ITSAppUsesNonExemptEncryption` = NO.
- Pas d'achat integre.
- Pour tester : lancer l'application, saisir des noms de joueurs, valider
  des annonces et des plis par manche ; le partage des scores utilise la
  feuille de partage systeme.
- Le nom "Skull King" est celui du jeu de cartes de Grandpa Beck's Games ;
  l'application est un accessoire de comptage non officiel. Apple peut
  demander une preuve d'autorisation d'usage de la marque (guideline 5.2.1) :
  prevoir la reponse (accord de l'editeur, ou renommage) avant la
  soumission.

## Choix restants du cote editeur

- Nom d'affichage si l'usage de la marque est refuse.
- Categorie App Store : Jeux > Cartes, ou Utilitaires.
- Prise en charge iPad : le projet la garde (`TARGETED_DEVICE_FAMILY`
  "1,2") ; passer a "1" pour iPhone seul et ne fournir que des captures
  iPhone.
