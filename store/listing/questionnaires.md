# Questionnaires des boutiques : réponses préremplies

Toutes les réponses découlent d'un même fait : l'application n'a ni serveur, ni compte, ni SDK tiers, ni analytique. Les seules données sont celles que le joueur saisit (prénoms ou pseudos des joueurs à la table, scores), stockées dans le `localStorage` du WebView de l'appareil, et le fichier de sauvegarde que le joueur exporte lui-même quand il le demande.

## Google Play : formulaire « Sécurité des données » (Data safety)

| Question | Réponse |
|---|---|
| Votre application collecte-t-elle ou partage-t-elle des données utilisateur requises ? | **Non** |
| Toutes les données utilisateur collectées sont-elles chiffrées en transit ? | Sans objet (rien ne transite). Si le formulaire impose une réponse : **Non**, en précisant qu'aucune donnée ne quitte l'appareil |
| Proposez-vous un moyen de demander la suppression des données ? | **Non applicable** : rien n'est collecté. L'utilisateur supprime lui-même ses données locales depuis le menu de l'application (effacer l'historique) ou en désinstallant |
| Données collectées, par catégorie | Aucune (ne cocher aucune catégorie : ni Informations personnelles, ni Activité dans l'application, ni Identifiants) |
| Données partagées avec des tiers | Aucune |
| L'application respecte les règles Familles de Play | Non concerné (l'application ne cible pas les enfants) |
| Pratiques de sécurité : engagement à suivre la règle Familles | Non requis |

Précision pour la description publique du formulaire : les noms des joueurs et les scores sont saisis par l'utilisateur et restent sur l'appareil ; le fichier de sauvegarde (`.json`) n'est créé qu'à la demande explicite de l'utilisateur, via la boîte de dialogue de partage ou d'enregistrement du système, et l'application ne l'envoie nulle part. Résultat attendu sur la fiche : « Aucune donnée collectée ».

Lien vers les règles de confidentialité à renseigner dans Play Console : https://vincentguyader.github.io/skull-king-score/privacy.html

## Google Play : classification du contenu (questionnaire IARC)

| Question | Réponse |
|---|---|
| Catégorie de l'application | Jeu (score keeper pour jeu de cartes) ; si le questionnaire propose « Utilitaire, productivité, communication ou autre », cette catégorie est aussi acceptable et donne les mêmes réponses |
| Violence (réaliste, de dessin animé, sang, etc.) | Non, aucune |
| Sexualité, nudité | Non |
| Langage grossier | Non |
| Substances contrôlées (drogue, alcool, tabac) | Non |
| Jeux d'argent (réels ou simulés) | Non. Le « pari du Rascal » est une règle du jeu de cartes portant sur des points, sans argent ni monnaie virtuelle |
| Peur, horreur | Non (le pictogramme tête de mort est un motif de pirate, sans contenu effrayant) |
| Discrimination | Non |
| Contenu généré par les utilisateurs et partagé avec d'autres | **Non** (les noms de joueurs restent locaux ; le partage du résultat passe par la feuille de partage du système, à l'initiative de l'utilisateur, comme un texte) |
| Interaction entre utilisateurs (chat, etc.) | Non |
| Partage de la position | Non |
| Achats numériques | Non |
| Publicité | Non |
| Résultat attendu | PEGI 3 / ESRB Everyone / USK 0 / « Tous publics » |

## Google Play : autres déclarations

| Déclaration | Réponse |
|---|---|
| Public cible | 13 ans et plus (choisir les tranches à partir de 13 ans évite le programme Familles ; l'application n'attire pas spécialement les enfants) |
| Annonces | Non, l'application ne contient pas de publicité |
| Application d'actualités | Non |
| Application COVID-19 | Non |
| Fonctionnalités financières | Aucune |
| Application de santé | Non |
| Applications gouvernementales | Non |

## App Store : étiquette de confidentialité (App Privacy)

| Question | Réponse |
|---|---|
| Collectez-vous des données depuis cette application ? | **Non** : « Data Not Collected » (Données non collectées) |
| Types de données | Aucun |
| Suivi (tracking, ATT) | Non, aucune demande d'autorisation de suivi |
| URL de la politique de confidentialité | https://vincentguyader.github.io/skull-king-score/privacy.html |

Justification, si Apple la demande : aucune donnée n'est transmise hors de l'appareil ; les données saisies (noms, scores) sont stockées localement et exportées uniquement à l'initiative de l'utilisateur.

## App Store : classification par âge (Age Rating)

Apple a remplacé en 2025 le questionnaire de l'App Store Connect par une version étendue ; les réponses sont les mêmes quel que soit le formulaire présenté.

| Question | Réponse |
|---|---|
| Violence de dessin animé ou fantastique | Aucune |
| Violence réaliste | Aucune |
| Violence réaliste prolongée ou graphique | Aucune |
| Grossièretés ou humour vulgaire | Aucun |
| Contenu sexuel ou nudité | Aucun |
| Thèmes horrifiques ou de peur | Aucun |
| Usage ou références à l'alcool, au tabac, à la drogue | Aucun |
| Contenu à caractère médical | Aucun |
| Jeux d'argent (simulés) | Aucun (le pari du Rascal porte sur des points de jeu, il n'y a ni argent ni monnaie virtuelle) |
| Jeux d'argent réels et concours | Aucun |
| Contenu sexuel explicite | Aucun |
| Accès non restreint au web | Non (pas de navigateur intégré ; le seul lien externe éventuel ouvre le dépôt GitHub dans le navigateur du système) |
| Contenu généré par les utilisateurs | Non |
| Fonctions de messagerie ou de chat | Non |
| Fonctions de capacité parentale, de localisation | Non |
| Contrôle parental ou restriction d'âge | Non requis |
| Résultat attendu | 4+ |

## App Store : conformité à l'export (Export Compliance)

| Question | Réponse |
|---|---|
| L'application utilise-t-elle du chiffrement ? | **Non** : aucun chiffrement propriétaire ni standard n'est utilisé par le code de l'application. Si Apple compte les appels HTTPS du WebView : ils relèvent de l'exemption « chiffrement limité au système d'exploitation ». Déclarer alors « Oui » puis « exempté » (usage limité à HTTPS/TLS fourni par le système) |
| Clé Info.plist recommandée | `ITSAppUsesNonExemptEncryption = NO` pour ne plus voir la question à chaque build |

## Résumé pour les deux boutiques

- Aucune donnée collectée, aucune donnée partagée, aucun tiers, aucun SDK, aucune publicité.
- Aucun compte, aucune connexion réseau nécessaire après l'installation.
- Sauvegarde : fichier créé uniquement à la demande de l'utilisateur, par la boîte de dialogue du système.
- Classement attendu : PEGI 3 / Everyone sur Play, 4+ sur l'App Store.
