# 00 — Décisions à valider avant de coder

Chaque point ci-dessous a un impact sur le coût, sur la validation des stores, ou sur le schéma. Je propose une réponse par défaut ; dis-moi ce que tu changes.

## A. Les trois questions ouvertes de la spec

| Sujet | Ma proposition | Impact si tu dis non |
|---|---|---|
| **Commentaires sous les publications** | **Non en V1.** La vente se fait en message privé, et les commentaires publics doublent la charge de modération (signalements, DSA). Je prévois la table `comments` dans le schéma, désactivée par un réglage `features.comments = false`. | Si oui : + 1 écran, + 1 onglet dans la file de modération, + filtrage par mots-clés. |
| **Compteur « X intéressés »** | **Oui, calculé, pas stocké** : nombre de conversations distinctes ouvertes sur la publication + enregistrements. Affiché seulement à partir de 3, pour ne pas montrer « 0 intéressé ». | Aucun impact schéma. |
| **Modérateurs par zone** | **Oui, mais en option** : un modérateur a une zone (`all`, `department`, `city`). Un modérateur « France entière » voit tout. Au lancement, tu nommeras sans doute un ou deux modérateurs en `all`, et la zone servira plus tard. Coût : une colonne et une condition RLS. | Si non : je laisse la colonne à `all` et je masque le champ dans l'admin. |

## B. Choix à impact coût

| Sujet | Proposition | Coût estimé au lancement |
|---|---|---|
| **Vidéo** | **Mux**, qualité « Basic » | Encodage gratuit en Basic. Stockage 0,0024 $/min/mois en 720p (150 vidéos de 1 min = 0,36 $/mois). 100 000 min de lecture offertes par mois, puis 0,0008 $/min. Cloudflare Stream coûte au minimum 5 $/mois (1 000 min stockées) et 1 $ par 1 000 min lues sans franchise. **Mux est moins cher jusqu'à plusieurs milliers d'utilisateurs actifs.** À reconsidérer au-delà de 100 000 min lues par mois. |
| **SMS d'inscription** | Supabase Auth par téléphone avec **Twilio Verify** (ou MessageBird). Supabase ne fournit pas les SMS. | Environ 0,05 à 0,08 € par SMS vers la France. 1 000 inscriptions ≈ 60 €. À surveiller : les attaques par SMS (« SMS pumping »). Je limiterai à 3 codes par numéro et par heure, et un captcha Supabase (Turnstile) au-delà. |
| **Supabase** | Plan **Pro** (25 $/mois) dès la bêta : sauvegardes quotidiennes, pas de mise en pause, 8 Go de base, 100 Go de stockage. Le plan gratuit suffit pendant les étapes 1 à 5. | 0 $ puis 25 $/mois. |
| **Expo / EAS** | **Expo SDK 58** (dernier stable en novembre 2026) sauf si SHD Suivi est sur un autre SDK que tu veux garder aligné. EAS Build plan gratuit : 30 builds/mois, files d'attente longues. | 0 $ au début. Plan Production à 99 $/mois seulement si les files d'attente gênent. |
| **Comptes développeur** | Apple Developer Program 99 $/an, Google Play 25 $ une fois. | À prévoir avant l'étape 2 (Sign in with Apple exige le compte Apple). |
| **RevenueCat** | Gratuit jusqu'à 2 500 $ de revenu mensuel. | 0 $. |
| **Nom de domaine** | Un domaine (ex. `getbizz.fr` ou `bizz.app`) est **obligatoire** pour les deep links universels (Apple App Site Association, Android App Links) et pour la redirection vers le store. | 10 à 30 €/an. Hébergement des deux fichiers de vérification sur Cloudflare Pages ou Supabase Edge Function. |
| **Push** | Expo Notifications, gratuit. | 0 $. |

## C. Points de validation des stores à anticiper

- **Sign in with Apple obligatoire** dès qu'on propose Google : prévu à l'étape 2.
- **Contenu généré par les utilisateurs (Apple 1.2)** : l'app doit avoir, dès la première soumission, le signalement, le blocage, des CGU acceptées à l'inscription, et un moyen pour l'équipe de retirer un contenu. Les étapes 10 et 14 couvrent ça, mais je placerai **signalement + blocage dès l'étape 4** (feed) pour pouvoir soumettre une bêta TestFlight propre.
- **Suppression du compte dans l'app** (Apple 5.1.1(v), Google) : étape 2 (bouton), effacement réel à l'étape 14.
- **Achats in-app** : les packs, Bizz+ et boosts passent par StoreKit / Play Billing via RevenueCat. Aucun lien vers un paiement externe. Les prix côté admin (`app_settings`) servent à l'affichage et aux quotas ; **le prix réel est celui déclaré dans App Store Connect et Play Console**. Changer un prix demande donc une modification dans les consoles, pas une republication de l'app.
- **Crédits valables 30 jours** : à écrire noir sur blanc dans la fiche produit et les CGU, sinon risque de rejet pour « consommable à expiration non signalée ».
- **Géolocalisation** : demandée seulement quand l'utilisateur ouvre « Près de moi », avec un texte d'explication (`NSLocationWhenInUseUsageDescription`).
- **Âge** : classification 17+ probable sur l'App Store à cause du contenu utilisateur non filtré. Je propose 12+ avec filtrage par mots-clés et modération ; Apple tranchera.
- **Contrefaçons** dans les catégories interdites : prévoir dans les CGU la responsabilité du vendeur (DSA, article 6).

## D. Décisions techniques prises (à contester si besoin)

1. **Rôle dans le JWT** : un *Custom Access Token Hook* Supabase copie `profiles.role` dans `app_metadata.role`. Les policies lisent `auth.jwt()`, pas une sous-requête, ce qui évite une lecture de `profiles` à chaque requête. Un changement de rôle prend effet au prochain rafraîchissement du token (une heure maximum, ou immédiatement avec `refreshSession()` côté app).
2. **Un `shop` par profil**, créé au moment où l'utilisateur devient prestataire. `profiles.role` passe de `client` à `seller`. Modérateur et admin sont des rôles **supplémentaires** : un modérateur peut aussi vendre. Je stocke donc `role` comme enum `client | seller` et deux booléens `is_moderator`, `is_admin`. C'est plus propre que quatre valeurs exclusives, et conforme à « un seul compte par personne ».
3. **Jour Paris** : toutes les fonctions de quota utilisent `(now() at time zone 'Europe/Paris')::date`. Pas de cron à minuit : la réinitialisation est implicite, la ligne de `daily_post_usage` du jour n'existe pas encore.
4. **Ordre de consommation** : publication gratuite du jour d'abord, puis quota Bizz+, puis crédits (les plus proches de l'expiration en premier).
5. **Images** : Supabase Storage, bucket `post-media` public en lecture, écriture limitée au propriétaire par policy. Redimensionnement côté app avec `expo-image-manipulator` (max 1 600 px, JPEG 80 %) avant envoi, pour la vitesse et le coût.
6. **Feed « Pour toi »** : en V1, un score simple en SQL (récence, proximité si position connue, catégories des boutiques suivies, boosts). Pas de machine learning.
7. **Recherche** : `tsvector` en français sur titre + description + hashtags, avec `pg_trgm` pour la tolérance aux fautes.
8. **Villes** : table `cities` chargée depuis le référentiel officiel des communes (code INSEE, nom, département, coordonnées). Le picker de ville cherche dedans. Évite les villes saisies à la main et rend « Près de moi » fiable.
9. **Nom de l'app** : `src/config/brand.ts` exporte `APP_NAME = 'Bizz'`, `APP_NAME_PLUS = 'Bizz+'`, les URL et le scheme. Aucun « Bizz » en dur ailleurs.
10. **Dépôt** : l'app Expo aura son propre dépôt (`bizz-app`) avec `supabase/` à la racine. Ce dépôt-ci n'est pas adapté.
