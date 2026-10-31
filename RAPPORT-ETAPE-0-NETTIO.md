# Nettio — Rapport d'étape 0 : analyse de SHD Suivi v2

Date : 31 octobre 2026. Analyse en lecture seule. Rien n'a été modifié, ni dans le code, ni dans les bases.

Sources analysées :
- le dépôt `seifdj/shd-suivi-v2` (poussé depuis `C:\app\shd-suivi-v2`), 263 commits, dernier commit réel du 4 septembre 2026 (version 1.16.7) ;
- le projet Supabase `SHD V2` (`bzbfnljlsdbesufpccbm`), en lecture catalogue seulement (tables, fonctions, policies, triggers, buckets, grants) ;
- le projet Supabase `Nettio` (`uuozkdtpudegbjctpuol`), qui existe déjà dans votre organisation et est vide.

---

## 0. Trois constats qui changent le plan

### 0.1 Le code poussé a deux mois de retard sur la base de production

| Élément | Code (dépôt) | Base SHD V2 |
|---|---|---|
| Dernière évolution | 4 septembre 2026 | 26 octobre 2026 (Edge Function `page-avis`) |
| Fonctions SQL | 242 créées par les migrations du dépôt | 776 en base, soit 800 Ko de source |
| RPC appelées par l'app | 334 | 25 d'entre elles n'existent plus en base |
| Fonctions en base jamais appelées par ce code | — | 359 (tchat, groupes clients, avis publics, documents, procédures, rendez-vous, matériel, échanges de passages, dispos renfort…) |
| Edge Functions | 4 dans le dépôt | 9 déployées (en plus : `send-commande-email`, `page-avis`, `smartcar`, `maison`, `cockpit-img`) |
| Tables | 28 créées par les migrations | 99 en base |

Les 25 RPC manquantes concernent les circuits Airbnb, les logements, les livraisons et `pro_create_commande`. Une app compilée depuis ce code échouerait donc sur ces écrans. Conclusion : **le code qui tourne réellement en production n'est pas celui du dossier poussé**, ou bien ce dossier a été figé pendant que la base continuait d'évoluer depuis un autre poste. Il faut trancher ce point avant tout plan (question Q1).

### 0.2 Le schéma de base n'est pas versionné

Les 81 migrations du dépôt sont des correctifs additifs posés sur une base préexistante. Les tables fondatrices (`residences`, `codes_acces`, `interventions`, `notes`, `demandes_intervention`, `heures_agents`, `push_tokens`…), les RPC de connexion et la plupart des fonctions `tokens_*` n'ont jamais été écrites dans un fichier. Les migrations les retrouvent par introspection (« la table qui porte `code` et `role` »), parfois sans ordre déterministe, et plusieurs fonctions sont réécrites par manipulation de texte de `pg_get_functiondef`.

Conséquence : « copier le code » ne suffit pas. Il faudra d'abord **extraire le schéma complet** (tables, contraintes, fonctions, triggers) de SHD V2, en lecture seule, pour en faire la migration zéro de Nettio.

### 0.3 Il n'y a pas d'identité, seulement des codes

Aucun compte Supabase Auth (0 ligne dans `auth.users`). L'identité d'une personne est un code court en clair, stocké dans AsyncStorage et renvoyé en premier paramètre (`p_code`) de chacune des 334 RPC, toutes `security definer` et accordées à `anon`. Il n'existe ni session serveur, ni JWT, ni `auth.uid()`, ni policy RLS (RLS est activé sur toutes les tables mais **aucune policy n'existe** : RLS sert de verrou pour bloquer l'accès direct, pas de filtre).

Une « RLS stricte par organisation » au sens Supabase est impossible avec ce modèle : rien dans la requête ne porte une identité vérifiable. Le choix d'identité pour Nettio est la décision structurante du projet (question Q2).

---

## 1. Structure du projet

### 1.1 Pile technique

- Expo SDK 54, expo-router 6, React Native 0.81, React 19, TypeScript strict, `@supabase/supabase-js` 2.110.
- Polices Montserrat (structure) et Roboto (texte) via `@expo-google-fonts`. Thème centralisé dans `src/theme.ts` : orange `#EF8412`, marine `#163E6F`. Les couleurs demandées pour Nettio sont déjà celles de SHD.
- Builds EAS (`eas.json`), bundle `com.seifdj.shdsuiviv2`, scheme `shdsuivi`, projet EAS `4fbac98e-…`, App Store id `6792833912`.
- Tests : 16 modules purs dans `src/*.test.ts`, 200 tests sous `node --test`, sans émulateur. `npm run verifie` = `tsc --noEmit` + tests.
- Documentation abondante en français : `CLAUDE.md` (25 Ko), `LISEZ-MOI.md` (59 Ko), `ETAT-APPLICATION.md`, guides de publication. `CLAUDE.md` est en partie périmé par rapport à la base (voir 2.4).

### 1.2 Arborescence

| Dossier | Contenu | Taille |
|---|---|---|
| `app/` | 93 fichiers expo-router : 87 écrans, 5 layouts, 1 redirection | ~60 000 lignes |
| `app/agent/` | équipe et gérant (mêmes écrans, `isAdmin` décide) | 71 fichiers |
| `app/client/` | résident, pro, chantier, Airbnb, syndic | 14 fichiers |
| `lib/supabase.ts` | toute la couche données : 342 fonctions exportées, 334 RPC | 5 425 lignes |
| `lib/notifs.ts` | vidage de la file de notifications | |
| `src/` | 16 modules purs testés + composants (`UI.tsx` 1 582 lignes) + PDF + notifications + présence | |
| `supabase/migrations/` | 81 migrations idempotentes (29 juillet → 2 septembre) | |
| `supabase/functions/` | 4 Edge Functions (3 emails Resend, 1 page publique) | |
| `scripts/`, `web/`, `notices/`, `affiches/`, `plaquette/` | affiche QR, notices PDF, widget web Wix, plaquette Nettio | |

Écrans très lourds à découper avant tout verrouillage par offre : `app/agent/(tabs)/index.tsx` (4 847 lignes), `app/agent/admin/site-fiche.tsx` (3 384), `app/agent/emploi-du-temps.tsx` (1 929), `app/client/(tabs)/index.tsx` (1 856), `app/agent/(tabs)/terrain.tsx` (1 853).

### 1.3 Carte fonctionnelle (87 écrans)

| Groupe | Écrans | Exemples |
|---|---|---|
| Réglages & administration (dont pilotage gérant) | 14 | hub « La maison », fiche site, assistant site (4 étapes), accès/codes, fiche agent, réglages, invitation, médias |
| Tournées & planning | 10 | emploi du temps, planning, postes titulaire/remplaçant, durées et créneaux, pauses, absences, liste de travail |
| Légal / onboarding | 9 | portail unique, 5 anciennes portes `login-*`, bienvenue, règlement, à propos |
| Stock & commandes | 8 | besoins, navette, 3 lieux (dépôt/sites/chariots), commandes, réception signée, catalogue produits, trousseaux de clés |
| Espace client | 7 | accueil, contrat (grille semaine), signalements, boutique/devis, planning, rapports |
| Airbnb / logements | 7 | assistant hôte, circuits, logements, tournée appartement par appartement |
| Pointage & présence | 6 | tournée du jour + pointage, suivi journée, couverture, activité |
| Interventions & missions | 5 | demandes, création, pointage d'intervention avec photos avant/après, missions proposées, coin pro |
| Signalements & réponses | 5 | notes, réponse signée, bilan du délai de réponse, retours |
| Récaps PDF & paie | 5 | mes heures, récap mensuel à valider/contester, heures par membre, PDF mensuel par site |
| Photos & preuves | 4 | rapport chantier, validation, rapports par site, médias |
| Messagerie & notifications | 4 | messagerie équipe avec accusés, historique notifs, annonces clients, rappels |
| Qualité | 2 | contrôle qualité, sondage mensuel |
| Syndic / régie | 1 | onglet « Informer » |

Types de sites (`src/typesSites.ts`) : `copropriete`, `bureaux`, `commerce` (sous contrat, pointage quotidien) ; `chantier`, `client`, `particulier` (= Airbnb, ponctuel). Le brief parle de 3 catégories ; le code en a 6, et le parcours Airbnb (circuits, logements, linge) est un module complet que le brief ne mentionne pas.

En base aujourd'hui : 10 résidences (4 copropriétés, 5 bureaux, 1 commerce), 31 codes (2 admin, 27 agents, 2 responsables).

---

## 2. Schéma Supabase actuel (projet SHD V2, lecture seule)

### 2.1 Tables (99)

- **Cœur métier (préexistant, hors dépôt)** : `residences` (28 colonnes dont `access_code`, `syndic_code`, `type_site`, `groupe_id`, `demo`, `jeton_avis`), `codes_acces` (22 colonnes dont `code`, `role`, `actif`, `partage_presence`, `demo`, `renfort`), `code_residences`, `interventions` (= passages), `notes` (signalements, 45 colonnes), `demandes_intervention` (65 colonnes), `rapports_chantier`, `heures_agents`, `planning_agents`, `push_tokens`, `prestations`, `residence_taches`, `taches_types`, `emails_destinataires`, `annonces`, `rappels`, `commandes_fournitures`, `durees_site`, `demande_agents`, `messages_equipe`, `controles_qualite`, `alertes_stock`, `consignes`, `retours_rapport`, `interventions_periodiques`, `notifications_log`.
- **Créées par les migrations du dépôt (28)** : `reglages_entreprise`, `notifications_file`, `recaps_mensuels`, `residence_tarifs`, `inventaire_site`, `presences_site`, `absences`, `interventions_vues`, `logements`, `sondages`, `sondages_envois`, `pauses_pointage`, `manques_stock`, `chariots`, `mouvements_stock`, `missions_proposees`, `missions_acceptees`, `trousseaux`, `trousseaux_mouvements`, `constats_arrivee`, `postes`, `taches_travail`, `prestations_periodiques`, `produits`, `livraisons`, `panier_fournisseur` (+ `circuits`, `circuit_arrets` qui n'existent plus en base).
- **Postérieures au dépôt (absentes du code)** : `conversations`, `conversation_membres`, `messages_conv`, `messages_lus` (tchat v2), `groupes_clients`, `tokens_syndic`, `annonces_equipe` (+ `_lus`, `_reponses`), `documents_site`, `documents_equipe` (+ `_vus`), `procedures` (+ `_lus`), `evenements_agenda`, `rdv_gerant`, `responsables_sites`, `propositions_remplacement`, `repartition_taches`, `dispos_renfort_type`, `dispos_renfort_exceptions`, `dispos_semaine_confirmees`, `materiel`, `materiel_mouvements`, `passages_exceptions`, `echanges_passages`, `pointages_vus`, `connexions_clients`, `informations_site`, `conseils_site`, `missions_refus`, `taches_en_cours`, `absences_remplacements`, `notifs_requetes`, `rappels_site`, `planning_agents_archive`, `avis_publics`.
- **Hors périmètre Nettio, usage personnel du gérant** : `cockpit_donnees`, `prospects`, `maison_reglages`, `maison_appareils`, `maison_journal` (domotique Tuya), `camion_etat`, `smartcar_jetons` (+ Edge Functions `smartcar`, `maison`, `cockpit-img`, cron `smartcar-releve` toutes les 30 min).

### 2.2 Fonctions (776, toutes `security definer` sauf 2)

| Préfixe | Nombre | Rôle |
|---|---|---|
| `admin_*` | 298 | gérant |
| `equipe_*` | 171 | agent ou gérant |
| `shd_*` | 97 | helpers internes : `shd_est_admin`, `shd_exiger_admin`, `shd_exiger_code`, `shd_code_id`, `shd_code_nom`, `shd_notif`, `shd_demo_garde`, `shd_jour_paris`, purges… |
| `agent_*` | 72 | agent |
| `client_*` | 61 | client |
| `trg_*` | 13 | triggers |
| `tchat_*` | 10 | messagerie v2 (absente du code) |
| `syndic_*` | 9 | syndic |
| `tokens_*` | 7 | résolution des jetons push |
| `notifs_*`, `pro_*`, `responsable_*`, `get_*`, `groupe_*`, `recap_*`, `avis_*`, `catalogue_*`… | ~40 | divers |

Environ 140 fonctions `*__demo_brut` et 427 fonctions mentionnant « demo » : un **système de démonstration** (codes `DEMOADMIN`/`DEMOAGENT`/`DEMOSITE`, colonne `demo` sur `residences` et `codes_acces`, garde `shd_demo_garde` qui interdit à un compte réel de toucher la « maison de démo » et inversement). C'est déjà un cloisonnement à deux partitions : il montre à la fois que l'idée est faisable et ce que coûte un cloisonnement fait fonction par fonction.

### 2.3 Sécurité telle qu'elle est

- **0 policy RLS** sur 99 tables. RLS activé partout, donc l'accès direct PostgREST est fermé. Mais `anon` détient `INSERT/UPDATE/DELETE/TRUNCATE/SELECT` sur 28 tables : la seule chose qui protège ces tables est l'absence de policy. Une policy `using (true)` ajoutée un jour sur l'une d'elles exposerait tout.
- Validation de `p_code` incohérente : les premières migrations normalisent (`upper(btrim())`) et vérifient `actif` ; depuis la migration 51, 73 contrôles comparent en exact, sans vérifier `actif`. Désactiver un code ne coupe donc pas tout.
- `shd_exiger_admin` n'admet que `admin`, alors que les migrations récentes admettent `admin` ou `responsable`.
- Fuites internes : `notifs_a_envoyer` renvoie toute la file à n'importe quel code d'équipe ; `recap_mensuel_passages` ouvre tous les sites à tout code d'équipe ; `syndic_login` renvoie l'`access_code` des résidents ; `shd_logement_consignes` est accordée à `anon` sans code.
- Buckets Storage `documents`, `interventions-photos`, `notes-photos` : **tous publics**, chemins `residence_id/timestamp.jpg` ou sans identifiant (`constats/`, `taches-travail/`). `supprimerFichierStorage` laisse le client supprimer n'importe quel objet avec la clé anon.
- Edge Functions email déployées `--no-verify-jwt`, sans vérification de code : relais d'email ouvert à qui possède la clé anon (publique par nature). `send-note-email` injecte `message`, `residenceNom`, `auteurNom` dans le HTML sans échappement.
- Codes courts choisis par l'humain (ex. `BASTILLE`), comparaison insensible à la casse, aucune limite de débit : les RPC de connexion sont des oracles directs.
- Pas de session serveur : le code en clair dans AsyncStorage est un bearer permanent, sans expiration ni révocation par appareil.

### 2.4 Notifications : la base a changé de mécanisme

`CLAUDE.md` affirme « ni cron, ni Edge Function, l'app vide la file ». En base aujourd'hui : le trigger `notifications_file_envoyer` appelle `shd_notif_envoyer`, qui pousse directement vers `exp.host` via `pg_net`, par lots de 100, avec table `notifs_requetes` de suivi. L'app garde en parallèle le vidage client (`lib/notifs.ts`) et des envois directs depuis le téléphone (`src/notifications.ts`). Le filtre des 7 familles est appliqué côté émetteur avec un cache de 5 minutes non indexé.

### 2.5 Triggers (25) et cron

Triggers de notification sur `notes`, `alertes_stock`, `manques_stock`, `demandes_intervention`, `livraisons`, `notifications_file` ; normalisation d'heures sur `postes` et `demandes_intervention` ; `rapport_valide_boucle` (répondeur par défaut **« SHD Multiservices »** en dur) ; `residences_jeton_avis` ; `absences_sync_flag`. Cron : `smartcar-releve` uniquement.

---

## 3. Tout ce qui est spécifique SHD ou mono-entreprise

### 3.1 Singletons et hypothèses « une seule maison »

- `reglages_entreprise` : une ligne `cle='entreprise'`, lue avec `limit 1`, mise à jour par un `update` **sans `where`** (migration 71). Clés jsonb : `choix`, `canaux`, `copies`, `notifs`, `objectifs`, `email_fournisseur`, `notifs_encadrement`.
- Cible logique `'encadrement'` = tous les `admin`/`responsable` de la base.
- `residence_id is null` = « toute la maison » : dépôt de stock, pauses générales, emails, conseils, trousseaux au dépôt.
- `sondages.mois unique` : une campagne par mois pour toute la base.
- Missions proposées à **tous** les agents de `codes_acces`.
- Index uniques globaux : `produits.lower(btrim(nom))`, `inventaire_depot_article_idx` (un seul dépôt au monde), `residences_syndic_code_idx`, unicité des codes d'accès supposée globale (le portail compte dessus : « un code n'existe qu'à un seul endroit »).
- Un seul projet Supabase, une seule clé anon, un seul `projectId` EAS, un seul canal Android.
- Aucune clé locale ne porte d'identifiant d'entreprise ; la file hors ligne `shd_pointages_en_attente` est rejouée avec le code courant, quel que soit le compte qui l'a créée.

### 3.2 Marque SHD en dur

- Nom d'app « SHD Suivi » et société « SHD Multiservices » / « SHD Propreté » / « Équipe SHD » : environ 120 occurrences dans 39 fichiers de `app/` et `src/`. Fichiers les plus touchés : `app/reglement.tsx` (tout le règlement), `app/about.tsx`, `app/index.tsx` (héros « PROPRETÉ & SERVICES · LYON »), `app/client/(tabs)/*`, `app/agent/admin/invitation.tsx`, `src/legal.ts` (`PROPRIETAIRE`, copyright), les titres de push.
- PDF : `src/recapPdf.ts` et `src/rapportPdf.ts` embarquent `assets/logo-login.png` en base64, le repli texte « SHD », le pied « SHD Multiservices — Meyzieu, Grand Lyon / 07 67 75 22 39 — shd-clean.com », et recopient les couleurs du thème en dur.
- Emails : expéditeur `SHD Suivi <notifications@shd-mail.com>`, sujets et pieds « SHD », destinataire par défaut `Shd.multiservices@gmail.com`, bandeau `#122a4f` (ancienne marine).
- SQL : `'SHD vous a répondu.'` (migration 11), répondeur `'SHD Multiservices'` (17), « Contactez SHD » (36) ; 27 fonctions en base contiennent un texte SHD ; 97 fonctions `shd_*` ; réglages de session `shd.table_*`.
- Coordonnées : 5 adresses email différentes, 3 domaines (`shd-clean.com`, `shd-mail.com`, `shd-multiservices.fr`), téléphone `07 67 75 22 39` dans 12 endroits, « Meyzieu, Grand Lyon ». Aucun SIRET nulle part.
- Identifiants techniques : ~30 clés AsyncStorage `shd_*`, scheme `shdsuivi`, bundle `com.seifdj.shdsuiviv2`, slug `shd-suivi-v2`, owner `seifdj`.
- Pages web : `web/pointages.html` (widget Wix sur shd-clean.com, URL et clé Supabase en dur, ancienne palette), Edge `page-pointages`, `confidentialite.html` (contact `seif.djiridi@gmail.com`).
- Scripts : `scripts/affiche-qr.js` et `scripts/notice-client.js` (chemins Windows, Chrome headless, textes SHD, 5 notices PDF déjà générées).
- `app.json` : textes de permission et copyright **mal encodés** (UTF-8 double, « Â© », « accÃ©der »).
- `eas.json` : URL et clé publiable Supabase commitées dans les 3 profils (acceptable pour une clé publiable, mais à ne pas reproduire pour Nettio sans réflexion).
- `plaquette/nettio.html` existe déjà : vision produit Nettio (gérant / agents / clients, preuve photo, QR hall, Airbnb, missions), sans prix ni formule, charte verte différente de celle demandée, signée « SHD Multiservices — Seif Djiridi ».

### 3.3 Comportements liés à SHD à revoir

- Portail unique : essaie `pro_login` → `client_login` → `syndic_login` sans filtre d'entreprise.
- Le gérant tape les codes à la main ; le code syndic est généré côté client avec `Math.random()`.
- L'invitation ne crée rien : elle envoie un code existant et un lien TestFlight codé en dur.
- Le rôle `responsable` n'est pas routé au redémarrage (`app/index.tsx`), `shd_agent_prenom` n'est jamais écrit, la déconnexion ne vide ni la file hors ligne ni les caches.

---

## 4. Risques

### 4.1 Risques structurels pour Nettio

1. **Code ≠ base** (0.1). Travailler sur le mauvais code produirait un Nettio qui ne correspond à aucune réalité.
2. **Schéma non versionné** (0.2). Sans extraction complète, impossible de reconstruire une base Nettio ; les migrations du dépôt ne tiennent pas seules.
3. **Identité par code** (0.3). Pour une isolation réelle, chaque fonction doit dériver l'organisation du code et filtrer chaque table : 776 fonctions, 99 tables, un seul oubli = fuite. Alternative : passer à une identité vérifiable (JWT) et laisser RLS filtrer.
4. **Volume** : 800 Ko de SQL et 75 000 lignes de TypeScript. Un refactor « ajouter `organization_id` partout » est un chantier de plusieurs semaines, pas une migration.
5. **Fonctions générées ou réécrites dynamiquement** : leur source réel n'existe qu'en base.
6. **Périmètre fonctionnel non arbitré** : stock à 3 lieux, commandes, trousseaux, paie, tarification, Airbnb, qualité, missions, matériel, tchat v2, groupes clients, avis publics… Le brief n'en parle pas. Chaque module gardé coûte en cloisonnement, feature flags et tests.
7. **Modules personnels** (cockpit, domotique, Smartcar, prospects) mêlés à la base métier : à exclure explicitement.

### 4.2 Risques de sécurité à corriger dans Nettio (et à envisager dans SHD)

- Edge Functions email ouvertes, injection HTML dans `send-note-email`.
- Buckets publics, suppression libre côté client.
- 28 tables avec grants complets à `anon`, protégées uniquement par l'absence de policy.
- File de notifications globale lisible par tout code d'équipe.
- Codes devinables, sans limite de débit, sans expiration.
- Jetons push exposés au client et envois directs vers Expo depuis le téléphone.

### 4.3 Risques de qualité

- Trois palettes de couleurs (thème, emails `#122a4f`, web `#1B3A5C`) ; couleurs recopiées en dur dans les PDF.
- `app.json` mal encodé.
- File hors ligne sans idempotence ni verrou (doublons de pointage possibles).
- Course entre `synchroniserRappels` (`cancelAll`) et les rappels de pointage.
- `CLAUDE.md` et `ETAT-APPLICATION.md` périmés sur plusieurs points (notifications, nombre de migrations, écrans).

---

## 5. Ce qui existe déjà pour Nettio

- Projet Supabase `Nettio` (`uuozkdtpudegbjctpuol`, eu-west-1, créé le 11 août 2026), **vide**. C'est un candidat naturel pour la base dédiée.
- `plaquette/nettio.html` : vision produit.
- Thème orange/marine, polices Montserrat/Roboto : déjà en place dans `src/theme.ts`.
- Composants prêts pour l'état « verrouillé » : `BoutonPrincipal` (`verrouille`, `libelleVerrouille`), `Bandeau`, `LigneListe` (prop `droite`), `Badge`.
- Points d'accroche pour les feature flags : `app/agent/_layout.tsx` (garde de route unique), `app/agent/(tabs)/_layout.tsx` (onglets déjà conditionnés par `isAdmin`), hub `app/agent/(tabs)/admin.tsx`, `app/client/(tabs)/_layout.tsx`.
- Système « demo » en base : un précédent de cloisonnement fonction par fonction, à étudier avant de choisir l'approche.

---

## 6. Questions à trancher avant le plan

**Q1 — Quel code est la production ?** Le dossier poussé date du 4 septembre ; la base a évolué jusqu'au 26 octobre avec des fonctionnalités absentes du code (tchat v2, groupes clients, avis publics, documents, procédures, matériel, échanges de passages). Existe-t-il un autre dossier ou un autre poste avec le code courant ? Nettio doit partir du code réel.

**Q2 — Modèle d'identité.** Trois options :
- A. Supabase Auth pour tout le monde (email + mot de passe ou lien magique), `organization_id` en claim JWT, RLS classique. Le plus propre, mais change l'expérience « un code dans le hall » des résidents.
- B. Hybride : le gérant et les agents ont un compte Auth ; les clients/résidents/syndics gardent un code, échangé contre un JWT court signé par une Edge Function (claims `organization_id`, `role`, `residence_id`). RLS fonctionne pour tous. **C'est ma recommandation.**
- C. Garder les codes seuls et cloisonner dans chaque fonction. Pas de RLS réelle, 776 points de contrôle.

**Q3 — Périmètre fonctionnel.** Pour chaque module hors brief, garder ou retirer de Nettio v1 : stock (3 lieux, navette, chariots), commandes fournisseurs et réception signée, catalogue produits et boutique client, trousseaux de clés, Airbnb (circuits, logements, linge), postes titulaire/remplaçant, absences et remplacements, missions proposées, liste de travail, heures et paie (forfait plancher, récap à contester), tarification et devis avec majorations, contrôle qualité et sondage mensuel, annonces et rappels, journal d'activité, tchat v2, groupes clients multi-sites, avis publics, documents et procédures d'équipe, matériel. Les modules cockpit, domotique, Smartcar et prospects sont à exclure (à confirmer).

**Q4 — Répartition par offre.** Proposition à valider :
- Essentiel : pointage, tournée du jour, suivi journée, planning, absences, heures (sans paie), messagerie équipe, notifications, widget présence.
- Pro : + interventions et missions, photos avant/après et rapports, signalements et réponses, espace client (résident, pro, chantier), syndic, PDF récaps et rapports, qualité, stock et commandes.
- Sur-mesure : tout + marque blanche + Airbnb + modules optionnels.

**Q5 — Multi-appartenance.** Une personne (syndic, agent) peut-elle appartenir à plusieurs organisations ? (Recommandation : oui pour les syndics via table `organization_members`, non pour les agents en v1.)

**Q6 — Fin d'abonnement.** Lecture seule ou blocage complet ? (Recommandation : lecture seule 30 jours, puis blocage.)

**Q7 — Marque blanche.** Logo, couleurs, nom affiché dans l'app et les PDF, expéditeur email… suffisent-ils, ou faut-il aussi un nom d'app et un bundle ID par client (un build par client) ? Les PDF Essentiel/Pro portent-ils « Propulsé par Nettio » ?

**Q8 — Extraction du schéma.** Pour la migration zéro de Nettio, acceptez-vous que j'extraie le schéma complet de SHD V2 en lecture seule (DDL des tables et `pg_get_functiondef` des 776 fonctions) ? Alternative : vous lancez `supabase db dump --schema-only` localement et poussez le fichier dans le dépôt.

**Q9 — Base Nettio.** Utiliser le projet Supabase `Nettio` déjà créé (vide) ?

**Q10 — Onboarding client.** Qui crée les comptes clients et régies : le gérant seul, ou auto-inscription par lien d'invitation ?
