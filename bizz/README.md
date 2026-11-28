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
npm test                 # tests unitaires (téléphone, pseudo)
npm run db:test          # applique les migrations sur un Postgres local (PostGIS) et lance les tests de fumée
npm run web              # prévisualisation dans le navigateur (outil de dev, le produit reste iOS + Android)
```

Build de développement (nécessaire : expo-blur, expo-haptics et expo-secure-store sont natifs) :

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
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
src/features/       auth (session, OTP, Apple, Google), account (profil, boutique, ville, avatar), shell
src/config/brand.ts nom de l'app, scheme, domaine
src/theme/          theme.ts (tokens), fonts.ts
src/ui/             composants verre : GlassCard, PillButton, GlassTabBar, Chip, Avatar, PriceTag, StatusBadge, Skeleton, EmptyState, Screen, Text
src/i18n/fr.ts      toutes les chaînes FR
src/lib/            supabase.ts, env.ts, queryClient.ts, errors.ts, phone.ts, username.ts, database.types.ts
src/store/          Zustand (ui, onboarding)
supabase/           config.toml, migrations/, seed.sql, functions/ (à venir)
scripts/            test-migrations.sh, load-cities.ts
docs/               cadrage (décisions, schéma, écrans, étapes)
```

## Avancement

| Étape | État |
|---|---|
| 1. Socle Expo + Supabase + design system | Fait (projet Supabase créé, migrations 0001-0006 appliquées) |
| 2. Accueil, choix du rôle, inscription, profil, ouverture de boutique | Fait (migrations 0007-0008). Phone actif en numéros de test ; Apple et Google restent à configurer |
| 3. Boutique et publications (photos) + quota | À faire |
