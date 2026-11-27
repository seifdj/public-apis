# Bizz — dossier de cadrage

Ce dossier contient le cadrage de l'app **Bizz** avant toute ligne de code.

| Fichier | Contenu |
|---|---|
| `SPEC.md` | La spec d'origine (prompt fourni), inchangée |
| `docs/00-decisions.md` | Décisions à valider, points à impact coût / stores, réponses aux questions ouvertes |
| `docs/01-schema.md` | Schéma Postgres complet : tables, relations, index, RLS par rôle, fonctions (quota, modération, feed) |
| `docs/02-screens.md` | Arborescence Expo Router et les quatre navigations (client, prestataire, modérateur, admin) |
| `docs/03-roadmap.md` | Découpage en étapes, chacune testable sur téléphone, avec critères de test |

Remarque : ce dépôt (`public-apis`) n'est pas celui de l'app. L'app Expo vivra dans son propre dépôt (`bizz-app`), avec `supabase/` à la racine. Ces documents y seront copiés au démarrage de l'étape 1.
