# Bizz — app mobile

Mini réseau social de la vente (iOS + Android). Expo SDK 58, Expo Router, TypeScript strict, Supabase.
Le cadrage complet est dans `docs/` et la spec dans `SPEC.md`.

> Ce dossier est l'app complète : il se déplace tel quel dans son propre dépôt `bizz-app` (cf. `docs/00-decisions.md`, point D.10).

## Démarrer

```bash
npm install
cp .env.example .env     # puis renseigner l'URL et la clé publique du projet Supabase "Bizz"
npm run typecheck
npm run lint
npm test                 # tests unitaires (téléphone, pseudo, prix, hashtags)
npm run db:test          # applique les migrations sur un Postgres local (PostGIS) et lance les tests de fumée
npm run web              # prévisualisation dans le navigateur (outil de dev, le produit reste iOS + Android)
```

Tester sur téléphone avec **Expo Go** (le plus simple, aucun build) :

```bash
npm run go            # affiche un QR code : appareil photo sur iPhone, app Expo Go sur Android
npm run go:tunnel     # si le téléphone et l'ordinateur ne sont pas sur le même Wi-Fi
```

Tous les modules natifs utilisés jusqu'à l'étape 3 sont inclus dans Expo Go (SDK 58). Limites d'Expo Go : la connexion Apple et Google ne fonctionne pas (adresse de retour différente). Un build de développement deviendra nécessaire à l'étape 9 (achats in-app), et avant pour tester Apple, Google et les liens `bizz://` :

```bash
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios
npx expo start --dev-client
```

## Base Supabase

Projet **Bizz** (organisation Supabase de Seif, région `eu-west-3` Paris). Les migrations `0001` à `0006` y sont appliquées.

```bash
npx supabase link --project-ref <ref>                  # ref visible dans Project Settings > General
npx supabase db push                                   # applique les nouvelles migrations de supabase/migrations/
npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```

Les 34 875 communes sont chargées dans `cities` (101 départements). Pour recharger : coller `scripts/load-cities.sql` dans le SQL editor. `scripts/load-cities.ts` produit le même contenu en fichier SQL, pour une base locale.

Réglages d'authentification du projet (faits le 28/11 via l'API d'administration) :
- Hook *Customize Access Token* actif sur `public.auth_hook_add_claims`.
- Provider Phone actif, fournisseur Twilio avec des identifiants factices : seuls les numéros de test se connectent (`+33600000001` et `+33600000002`, code connu du propriétaire, jamais écrit ici, valides jusqu'au 30/06/2027).
- Site URL `bizz://`, redirections autorisées `bizz://**`.

Reste à faire dans le dashboard :
- Authentication > Sign In / Providers > Apple (Services ID + clé) et Google (client OAuth).
- Database > Extensions > `pg_cron` (étape 6).
- Avant le lancement (étape 14) : vrais identifiants Twilio Verify, retrait des numéros de test, désactivation du provider Email.

### Données de démo

30 boutiques et 150 publications dans 12 villes sont chargées sur le projet (`supabase/seed/demo.sql`). Les comptes de démo ne peuvent pas se connecter. Les visuels sont des illustrations générées, à remplacer par de vraies photos si besoin.

```bash
node scripts/demo/build-seed-sql.mjs                      # régénère supabase/seed/demo.sql depuis shops.json et archetypes.json
node scripts/demo/make-demo-images.mjs ./demo-images      # régénère les 84 visuels (Playwright + lucide-static)
```

Tout retirer avant le lancement : `delete from auth.users where email like 'demo%@bizz.test';` puis vider le dossier `demo/` du bucket `post-media`.

Créditer des publications à un compte, pour tester : `select private.grant_post_credits('<user id>', 3, 'admin', 'test');`

### Règles de sécurité des migrations

Supabase donne par défaut tous les droits sur les nouveaux objets de `public` aux rôles `anon` et `authenticated`. La migration `0006` retire ces droits par défaut. Depuis :
- `anon` n'a aucun droit (l'app a toujours une session) ;
- chaque table reçoit des `grant` explicites pour `authenticated`, au niveau colonne pour `profiles` ;
- chaque fonction est créée avec `set search_path = ''`, puis `grant execute` nominatif ;
- chaque migration qui crée des fonctions se termine par `revoke execute on all functions in schema public, private from public, anon` ;
- `npm run db:test` échoue si une table n'a pas RLS, si `anon` a un droit, ou si une fonction non listée est exécutable par `authenticated`.

## Structure

```
src/app/            écrans (Expo Router) : (onboarding), profile-setup, open-shop, (client), (seller), legal, (gallery) en dev
src/features/       auth (session, OTP, Apple, Google), account (profil, boutique, ville, avatar), posts (formulaire, quota, tuiles), shell
src/config/brand.ts nom de l'app, scheme, domaine
src/theme/          theme.ts (tokens), fonts.ts
src/ui/             composants verre : GlassCard, PillButton, GlassTabBar, Chip, Avatar, PriceTag, StatusBadge, Skeleton, EmptyState, Screen, Text
src/i18n/fr.ts      toutes les chaînes FR
src/lib/            supabase.ts, env.ts, queryClient.ts, errors.ts, phone.ts, username.ts, price.ts, hashtags.ts, media.ts, database.types.ts
src/store/          Zustand (ui, onboarding)
supabase/           config.toml, migrations/, seed.sql, functions/ (à venir)
scripts/            test-migrations.sh, load-cities.sql, load-cities.ts, demo/ (données de démo)
docs/               cadrage (décisions, schéma, écrans, étapes)
```

## Avancement

| Étape | État |
|---|---|
| 1. Socle Expo + Supabase + design system | Fait (projet Supabase créé, migrations 0001-0006 appliquées) |
| 2. Accueil, choix du rôle, inscription, profil, ouverture de boutique | Fait (migrations 0007-0008). Phone actif en numéros de test ; Apple et Google restent à configurer |
| 3. Boutique et publications (photos) + quota | Fait (migrations 0009-0010, données de démo chargées) |
| 4. Feed + abonnements + likes + favoris | À faire |
