# 02 — Arborescence des écrans et navigations

Expo Router (file-based). Quatre groupes de navigation, un seul point d'entrée qui route selon la session et `active_mode`.

## 1. Règle de routage (dans `app/_layout.tsx`)

```
pas de session                    -> (onboarding)
session sans profil complet       -> (onboarding)/profile-setup
active_mode = 'client'            -> (client)
active_mode = 'seller'            -> (seller)
is_moderator, depuis le menu      -> (moderation)    (accessible via Profil > "Espace modérateur")
is_admin, depuis le menu          -> (admin)         (accessible via Profil > "Espace admin")
```

Modérateur et admin ne sont pas des modes exclusifs : on y entre depuis le profil et on en sort par « Retour à l'app ». Le serveur refuse de toute façon les requêtes sans claim.

## 2. Arborescence des fichiers

```
app/
├── _layout.tsx                      Providers (Query, Zustand, Auth), fonts, gate de routage
├── +not-found.tsx
│
├── (onboarding)/
│   ├── _layout.tsx                  Stack sans header
│   ├── index.tsx                    1. Accueil "Ton bizz, ta vitrine." + "C'est parti" + "J'ai déjà un compte"
│   ├── role.tsx                     2. "Tu viens pour quoi ?" : Je cherche / Je propose
│   ├── phone.tsx                    3a. Numéro + boutons Apple / Google
│   ├── otp.tsx                      3b. Code SMS à 6 chiffres
│   ├── profile-setup.tsx            3c. Prénom/pseudo, avatar, ville (+ code parrain optionnel)
│   └── open-shop.tsx                3d. Si "Je propose" : nom de boutique, bio, liens sociaux  (réutilisé par le + côté client)
│
├── (client)/
│   ├── _layout.tsx                  Tabs : barre flottante pilule [Feed] [Recherche] (+) [Messages] [Profil]
│   ├── feed/
│   │   ├── index.tsx                4. Feed plein écran, onglets Pour toi / Abonnements / Près de moi, rangée Drops du jour
│   │   └── drops.tsx                   Liste complète des drops du jour (modal)
│   ├── search/
│   │   ├── index.tsx                5. Barre + filtres + grille catégories + "Vendeurs près de toi"
│   │   ├── results.tsx                 Résultats (liste/grille), tri, bouton "Créer une alerte"
│   │   ├── filters.tsx                 Bottom sheet : ville + rayon, prix, type, note
│   │   └── category/[slug].tsx         Publications d'une catégorie
│   ├── messages/
│   │   ├── index.tsx                7. Liste des conversations
│   │   └── [conversationId].tsx        Conversation (header = publication liée, "C'est dispo ?", photos)
│   └── profile/
│       ├── index.tsx                   Mon profil : avatar, favoris, abonnements, "Ouvre ta boutique" ou "Mode prestataire"
│       ├── saved.tsx                   Favoris (enregistrés)
│       ├── following.tsx               Boutiques suivies
│       ├── alerts.tsx                  Mes alertes de recherche
│       ├── notifications.tsx           Centre de notifications
│       └── settings/
│           ├── index.tsx               Compte, téléphone, notifications, légal, déconnexion
│           ├── edit.tsx                Modifier profil
│           ├── blocked.tsx             Comptes bloqués
│           ├── data.tsx                Export RGPD, suppression du compte
│           └── legal.tsx               CGU, confidentialité
│
├── (seller)/
│   ├── _layout.tsx                  Tabs : [Espace] [Publications] (+ Publier) [Messages] [Boutique]   + bouton "Mode client" dans le header
│   ├── dashboard/
│   │   ├── index.tsx                8. Carte quota + Publier, 3 chiffres (vues 7 j, messages, abonnés), Demandes à traiter, Mes publications récentes, lien Bizz+
│   │   ├── requests.tsx                Demandes à traiter (conversations is_request_pending)
│   │   └── stats.tsx                   Stats détaillées (Bizz+) : vues/jour, top publications, abonnés
│   ├── posts/
│   │   ├── index.tsx                   Mes publications avec filtre Dispo / Réservé / Vendu / Expirées
│   │   └── [postId]/
│   │       ├── edit.tsx                Modifier (ne consomme pas de quota)
│   │       └── boost.tsx               Remonter / À la une (ville + catégorie)
│   ├── publish/
│   │   ├── index.tsx                9. Formulaire unique : médias, type, titre, prix, ville, catégorie, "Partager aussi en story"
│   │   └── done.tsx                    Confirmation + aperçu story si coché + quota restant
│   ├── plus/
│   │   ├── index.tsx               10. Publier plus : packs, Bizz+, boosts (paywall RevenueCat)
│   │   └── history.tsx                 Historique des achats et crédits
│   ├── messages/                       Mêmes écrans que (client)/messages, vue vendeur
│   │   ├── index.tsx
│   │   └── [conversationId].tsx
│   └── shop/
│       ├── index.tsx                   Aperçu de ma boutique (= écran 6 vu par moi) + bouton Modifier
│       ├── edit.tsx                    Nom, bio, avatar, couverture, ville, liens Insta/Snap/TikTok/WhatsApp
│       ├── reviews.tsx                 Mes avis
│       ├── referral.tsx                Mon code de parrainage + partage
│       └── moderation.tsx              Décisions me concernant + contester
│
├── (moderation)/
│   ├── _layout.tsx                  Tabs : [File] [Historique] [Comptes] [Retour à l'app]
│   ├── queue/
│   │   ├── index.tsx               11. Compteur "à traiter", onglets Publications / Comptes / Messages, cartes de signalement
│   │   └── [reportId].tsx              Détail : contenu signalé, tous les signalements groupés, historique de la boutique, actions Ignorer / Masquer / Suspendre + motif obligatoire
│   ├── history.tsx                     Mes décisions (journal), contestations à lire
│   └── accounts/
│       ├── index.tsx                   Boutiques suspendues / masquées dans ma zone
│       └── [shopId].tsx                Fiche boutique côté modération
│
├── (admin)/
│   ├── _layout.tsx                  Tabs : [Vue d'ensemble] [Modération] [Réglages] [Retour à l'app]
│   ├── index.tsx                   12. Chiffres : utilisateurs, prestataires actifs, publications du jour, revenus du mois
│   ├── team/
│   │   ├── index.tsx                   Équipe de modération (nommer, changer la zone, retirer)
│   │   └── add.tsx                     Rechercher un utilisateur, choisir scope + zone
│   ├── decisions/
│   │   ├── index.tsx                   Dernières décisions, filtre par modérateur
│   │   └── [actionId].tsx              Détail + contestation à trancher
│   └── settings/
│       ├── pricing.tsx                 Prix et quotas (app_settings)
│       ├── categories.tsx              Catégories (ordre, actif, ajout)
│       └── keywords.tsx                Mots-clés interdits
│
└── (shared)/                        Écrans accessibles depuis tous les groupes (présentés en modal ou push)
    ├── post/[postId].tsx            Détail publication (depuis recherche, profil, deep link, notification)
    ├── shop/[slug]/
    │   ├── index.tsx                6. Profil boutique public
    │   └── reviews.tsx                 Onglet Avis
    ├── share/[postId].tsx           Génération de l'image story + partage (Insta, Snap, TikTok, autre)
    ├── report.tsx                      Bottom sheet de signalement (type + cible en params)
    └── paywall.tsx                     Paywall contextuel (quota épuisé -> packs / Bizz+)
```

## 3. Les quatre barres de navigation

| Groupe | Onglet 1 | Onglet 2 | Centre (+) | Onglet 4 | Onglet 5 |
|---|---|---|---|---|---|
| **Client** | Feed (maison) | Recherche (loupe) | **+** → `open-shop` si client, sinon bascule prestataire et ouvre `publish` | Messages (bulle, badge non lus) | Profil (avatar) |
| **Prestataire** | Espace (tableau de bord) | Publications (grille) | **+** → `publish` | Messages (badge) | Boutique (avatar) |
| **Modérateur** | File (badge « à traiter ») | Historique | — | Comptes | Retour à l'app |
| **Admin** | Vue d'ensemble | Modération (équipe + décisions) | — | Réglages | Retour à l'app |

Le composant `GlassTabBar` est unique et prend une liste d'onglets ; le bouton central est optionnel.

## 4. Arborescence du code (hors `app/`)

```
src/
├── config/brand.ts            APP_NAME, scheme, domaine, URL stores
├── theme/
│   ├── theme.ts               Tous les tokens (couleurs, typo, rayons, ombres, espacements)
│   └── fonts.ts               Chargement Montserrat + Inter
├── ui/                        Composants verre : GlassCard, GlassTabBar, PillButton, Chip, Avatar, PriceTag, StatusBadge, Sheet, Skeleton, EmptyState
├── features/
│   ├── auth/                  session, OTP, Apple/Google, hooks useSession / useProfile
│   ├── feed/                  FeedItem, FeedList (FlashList plein écran), DropsRow, hooks
│   ├── posts/                 PostForm, MediaPicker, usePostAllowance, useCreatePost, PostCard
│   ├── shops/                 ShopHeader, ShopGrid, useShop, useFollow
│   ├── search/                SearchBar, Filters, CategoryGrid, useSearch, useNearbyShops
│   ├── messaging/             ConversationList, Thread, Composer, useRealtimeMessages
│   ├── seller/                Dashboard, Stats, Requests, PostStatusChip
│   ├── monetization/          RevenueCat init, useOfferings, Paywall, usePurchase
│   ├── story/                 StoryCard (react-native-view-shot + QR), useShareStory
│   ├── moderation/            ReportSheet, ReportCard, ModerationActions, useQueue
│   ├── admin/                 Overview, Team, Settings forms
│   └── notifications/         registerPushToken, handlers, deep link routing
├── lib/
│   ├── supabase.ts            client + typed Database
│   ├── queryKeys.ts
│   ├── errors.ts              mapping codes serveur -> messages FR
│   ├── geo.ts                 permission, position, distance
│   └── links.ts               deep links bizz://post/[id], https://<domaine>/p/[id]
├── store/                     Zustand : session, activeMode, draft de publication, filtres de recherche
└── i18n/fr.ts                 Toutes les chaînes FR (pas de texte en dur dans les composants)
supabase/
├── migrations/                0001_extensions.sql, 0002_types.sql, 0003_profiles.sql ... une par étape
├── functions/                 revenuecat-webhook, send-push, export-data, mux-webhook, deep-link (AASA + redirection store)
└── seed.sql
scripts/
├── load-cities.ts             charge le référentiel des communes
└── seed-demo.ts               30 boutiques, 150 publications
```
