# Prompt Claude Code : Bizz, le mini réseau social des vendeurs

> À coller dans Claude Code au début du projet, ou à enregistrer comme `SPEC.md` à la racine du repo.
> Maquettes de référence : https://claude.ai/artifact/JjEaXSmDKUabQZ8rY3dsQX (rangées « Liquid Glass » et « client / prestataire / modo / admin »).

---

## 1. Le concept

**Bizz** est une application mobile (iOS + Android uniquement, pas de site web). Elle regroupe et référence les personnes qui vendent aujourd'hui sur Snapchat, Instagram, Facebook et TikTok : objets, créations fait-main, prestations (coiffure, ongles, pâtisserie, bricolage…), locations.

Elle fonctionne comme un **mini réseau social de la vente** :
- chaque prestataire a sa **boutique** (profil), sur laquelle il publie,
- les clients **scrollent un feed**, **suivent** des boutiques, **cherchent** par catégorie et par ville, et **contactent** le prestataire,
- **la vente se fait hors de l'app** (message, WhatsApp, téléphone, main propre). Bizz ne gère aucun paiement entre utilisateurs.

Cible : surtout des particuliers, partout en France.
Le nom « Bizz » doit être centralisé dans un fichier de config, au cas où il change.

---

## 2. Les quatre rôles

Un seul compte par personne, avec un champ `role` et un champ `active_mode`.

| Rôle | Comment on l'obtient | Ce qu'il voit |
|---|---|---|
| **Client** | Choisi à l'inscription (« Je cherche ») | Feed, recherche, messages, favoris, profil |
| **Prestataire** | Choisi à l'inscription (« Je propose »), ou activé plus tard depuis le profil | Son espace : quota du jour, stats, demandes à traiter, ses publications. Il peut basculer en « Mode client » à tout moment. |
| **Modérateur** | Nommé par un admin, jamais à l'inscription. Rattaché à une zone (ville ou département), ou à toute la France. | File des signalements de sa zone, avec les actions Ignorer / Masquer / Suspendre |
| **Admin** | Défini en base (moi) | Chiffres globaux, équipe de modération, journal des décisions, réglages des prix, quotas et catégories |

Règles :
- Un prestataire est aussi un client : le bouton « Mode client » change seulement la navigation (`active_mode`), pas le compte.
- Un client qui appuie sur le bouton **+** arrive sur un écran « Ouvre ta boutique » qui le passe prestataire.
- Les rôles modérateur et admin se vérifient **côté serveur** (RLS + claims), jamais seulement dans l'interface.
- Toute action de modération est écrite dans une table `moderation_actions` (qui, quoi, quand, motif). Le motif est envoyé au prestataire concerné, et il peut contester.

---

## 3. Modèle économique : quota de publications

- **Gratuit : 1 publication par jour** par prestataire. Le compteur repart à zéro à minuit, heure de Paris.
- **Packs** (achats consommables, crédits valables 30 jours) : +3 publications pour 0,99 €, +10 pour 2,49 €.
- **Abonnement Bizz+** à 4,99 €/mois : 5 publications par jour, badge, 1 remontée offerte par semaine, stats détaillées.
- **Boosts** : Remonter une publication (0,49 €), À la une 24 h dans une ville et une catégorie (1,99 €).

Contraintes :
- Les prix et les quotas sont réglables depuis l'espace admin, sans republier l'app (table `app_settings`).
- Ces achats sont des services numériques consommés dans l'app : Apple et Google imposent leurs paiements in-app. **Utilise RevenueCat**, avec un webhook vers une Edge Function Supabase pour créditer le compte.
- **Le quota se vérifie côté serveur** (fonction Postgres appelée à la publication). Ne jamais faire confiance au client.
- Au lancement, les 500 premiers prestataires reçoivent le badge « Fondateur ».

---

## 4. Écrans (voir les maquettes)

### Parcours d'entrée
1. **Accueil** : cartes produit flottantes, titre « Ton bizz, ta vitrine. », bouton « C'est parti ».
2. **Choix du rôle** : deux cartes, « Je cherche » (client) et « Je propose » (prestataire).
3. **Inscription** : téléphone (code SMS), Apple ou Google. Le téléphone vérifié est obligatoire pour publier.

### Côté client
4. **Feed** : onglets « Pour toi », « Abonnements », « Près de moi ». Publication en plein écran (photo ou vidéo), avec colonne d'actions à droite (like, enregistrer, partager en story), prix, hashtags et bouton « C'est dispo ? ». En haut, la rangée « Drops du jour » : les boutiques suivies qui ont publié aujourd'hui.
5. **Recherche et annuaire** : barre de recherche, filtres (ville et rayon, prix, type, note), grille de catégories, liste « Vendeurs près de toi ».
6. **Profil boutique** : avatar, nom, @pseudo, bio, abonnés / publications / note, boutons Suivre et Message, liens vers Insta, Snap, TikTok, WhatsApp, grille des publications, onglet Avis.
7. **Messagerie** : conversation 1-to-1 rattachée à une publication, « C'est dispo ? » en un tap, envoi de photos.

### Côté prestataire
8. **Espace prestataire** : carte « 1 publication gratuite dispo » avec le bouton Publier, trois chiffres (vues sur 7 jours, messages, abonnés), « Demandes à traiter », « Mes publications » avec leur statut (Dispo / Réservé / Vendu), lien vers Bizz+.
9. **Publier** : compteur du quota, photos ou vidéo, type (Objet / Service / Création / Location), titre, prix, ville, catégorie, option « Partager aussi en story ». Objectif : publier en moins de 30 secondes.
10. **Publier plus** : packs, Bizz+, boosts.

### Côté modérateur
11. **Modération** : compteur « à traiter », onglets Publications / Comptes / Messages, cartes de signalement (publication, vendeur, nombre de signalements, motif) avec les actions Ignorer / Masquer / Suspendre. Navigation : file, historique, comptes, retour à l'app.

### Côté admin
12. **Admin** : utilisateurs, prestataires actifs, publications du jour, revenus du mois ; équipe de modération (nommer, changer la zone, retirer) ; dernières décisions ; réglages « Prix et quotas » et « Catégories ».

---

## 5. Fonctionnalités V1

- **Publications** : 1 à 10 photos ou 1 vidéo de 60 s max, titre, description, prix ou « sur devis », catégorie, type, ville, statut. Modifier ou changer le statut ne consomme pas de quota. Expiration après 60 jours.
- **Feed** : tri par récence, proximité et catégories suivies. Les mises en avant payantes portent la mention « Sponsorisé ».
- **Abonnements, likes, favoris.**
- **Recherche** : plein texte + filtres, géolocalisation avec PostGIS, alertes de recherche avec notification.
- **Messagerie** temps réel (Supabase Realtime) + notifications push.
- **Partage en story** : génération d'une image verticale (photo, prix, @pseudo, logo Bizz, QR code) pour Insta, Snap et TikTok. Deep link vers la publication, avec redirection vers le store si l'app n'est pas installée.
- **Avis** : note sur 5 et commentaire, réservés aux utilisateurs qui ont échangé au moins un message avec le prestataire.
- **Signalement et blocage** par tous les utilisateurs. Filtrage par mots-clés à la publication. Catégories interdites : armes, animaux, médicaments, tabac et vape, contrefaçons, contenu adulte.
- **Parrainage** : un code par prestataire. Quand le filleul publie pour la première fois, les deux reçoivent 3 publications bonus.
- **Conformité** : suppression du compte dans l'app, export des données (RGPD), CGU, politique de confidentialité, traitement des signalements avec motif (DSA).

### À me faire confirmer avant de coder
Ces éléments sont dans les maquettes mais je ne les ai pas encore validés :
- les **commentaires** sous les publications,
- le compteur **« X intéressés »**,
- les **modérateurs par zone** (sinon : tous les modérateurs voient toute la France).

### Hors V1 (à prévoir dans l'architecture, sans le coder)
Import des posts Instagram, lives de vente, paiement intégré entre utilisateurs, version web.

---

## 6. Design system

Style : **verre dépoli sur fond blanc**, épuré, inspiré de la charte de mon app SHD Suivi.

| Élément | Valeur |
|---|---|
| Couleur principale (boutons, sélection) | Marine `#163E6F` |
| Couleur d'accent (logo, prix, mises en avant) | Orange `#EF8412`, et `#D9700A` quand c'est du texte sur blanc |
| Texte | `#15122B`, secondaire `#55516E` |
| Fond | Blanc `#FFFFFF`, avec deux halos flous très légers (marine et orange, opacité d'environ 20 %) |
| Danger (suspendre) | `#B42318` |
| Titres | Montserrat 700/800 |
| Texte courant | Inter 400 à 800 |
| Cartes « verre » | Blanc à 70 % d'opacité, flou d'arrière-plan, bordure blanche, ombre marine douce, coins de 24 à 30 px |
| Boutons | En forme de pilule, hauteur minimale de 44 px |
| Navigation | Barre flottante en pilule, bouton **+** carré arrondi et surélevé au centre |

Consignes :
- Tous les tokens dans un seul fichier `theme.ts`.
- Effet verre avec `expo-blur`. Sur Android, si le flou coûte trop cher en performance, remplace-le par un fond blanc opaque à 92 %.
- Pas de dégradés multicolores, pas d'emoji dans l'interface : icônes au trait uniquement.
- Contraste du texte : 4,5:1 minimum.

---

## 7. Stack technique imposée

- **App** : React Native + **Expo** (même version du SDK que mon app SHD Suivi, SDK 54 ou plus récent), Expo Router, TypeScript strict.
- **Backend** : **Supabase** (Postgres + PostGIS, Auth par téléphone, Storage pour les photos, Realtime, Edge Functions, pg_cron). **RLS sur toutes les tables.**
- **Vidéo** : Mux ou Cloudflare Stream. Propose-moi le moins cher pour démarrer.
- **Achats in-app** : RevenueCat.
- **Push** : Expo Notifications.
- **Data** : TanStack Query + Zustand.
- **Build** : EAS Build + EAS Submit.

### Tables attendues (à compléter)
`profiles` (avec `role`, `active_mode`, `moderation_zone`), `shops`, `posts`, `post_media`, `categories`, `follows`, `likes`, `saves`, `conversations`, `messages`, `reviews`, `reports`, `blocks`, `moderation_actions`, `post_credits`, `daily_post_usage`, `subscriptions`, `purchases`, `boosts`, `referrals`, `search_alerts`, `app_settings`.

---

## 8. Comment je veux qu'on travaille

1. **Ne code rien tout de suite.** Propose-moi d'abord :
   - le schéma de base complet (tables, relations, index, policies RLS par rôle, fonction de vérification du quota),
   - l'arborescence des écrans, avec les quatre navigations (client, prestataire, modérateur, admin),
   - le découpage en étapes, chacune testable sur mon téléphone.
2. Attends ma validation, puis avance étape par étape. À la fin de chaque étape, donne-moi : ce qui est fait, comment le tester, et ce qui reste.
3. Migrations SQL versionnées dans `supabase/migrations/`.
4. Données de démo : environ 30 prestataires et 150 publications réalistes dans plusieurs villes, plus un compte de test par rôle.
5. Préviens-moi avant tout choix qui a un impact sur les coûts ou sur la validation des stores.
6. Code en anglais, interface en français.

### Ordre de construction
1. Setup Expo + Supabase + design system (`theme.ts`, composants verre, barre de navigation)
2. Accueil, choix du rôle, inscription par téléphone
3. Boutique et publications (photos) + quota de 1 par jour vérifié côté serveur
4. Feed + abonnements + likes + favoris
5. Recherche + annuaire + géolocalisation
6. Messagerie + notifications push
7. Espace prestataire (stats, demandes, statuts)
8. Partage en story + deep links
9. Achats in-app avec RevenueCat (packs, Bizz+, boosts)
10. Signalements + espace modérateur + journal des décisions
11. Espace admin (modérateurs, réglages, chiffres)
12. Avis + parrainage
13. Vidéo
14. Préparation des stores (icône, captures, fiches, CGU, politique de confidentialité)
