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
npm run db:test          # applique les migrations sur un Postgres local (PostGIS) et lance les tests de fumée
```

Build de développement (nécessaire : expo-blur, expo-haptics et expo-secure-store sont natifs) :

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
npx expo start --dev-client
```

## Base Supabase

```bash
npx supabase link --project-ref <ref>
npx supabase db push                                   # applique supabase/migrations/
node --experimental-strip-types scripts/load-cities.ts > supabase/seed/cities.sql
npx supabase db query --file supabase/seed/cities.sql   # ~35 000 communes
```

Puis, dans le dashboard : Authentication > Hooks > *Custom Access Token* → `public.auth_hook_add_claims` ; Authentication > Providers > Phone (Twilio Verify).

## Structure

```
src/app/            écrans (Expo Router) — étape 1 : groupe (gallery) de démonstration
src/config/brand.ts nom de l'app, scheme, domaine
src/theme/          theme.ts (tokens), fonts.ts
src/ui/             composants verre : GlassCard, PillButton, GlassTabBar, Chip, Avatar, PriceTag, StatusBadge, Skeleton, EmptyState, Screen, Text
src/i18n/fr.ts      toutes les chaînes FR
src/lib/            supabase.ts, env.ts, queryClient.ts, errors.ts, database.types.ts
src/store/          Zustand (ui, session)
supabase/           config.toml, migrations/, seed.sql, functions/ (à venir)
scripts/            test-migrations.sh, load-cities.ts
docs/               cadrage (décisions, schéma, écrans, étapes)
```

## Avancement

| Étape | État |
|---|---|
| 1. Socle Expo + Supabase + design system | Fait |
| 2. Accueil, choix du rôle, inscription par téléphone | À faire |
