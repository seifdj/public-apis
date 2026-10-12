# J.A.R.V.I.S. pour ton ordinateur

Ton assistant personnel en version installée : tableau de bord, objectifs financiers, entreprises (dont SHD Multiservices), clients potentiels, finances, et conversation vocale avec Claude.

Par rapport à la version sur claude.ai :

- **Le micro fonctionne.** Tu cliques sur « Démarrer Jarvis » ou tu appuies sur **Ctrl + J**. Il t'écoute, te répond à voix haute, puis se remet à écouter jusqu'à ce que tu dises « stop ».
- **Il s'ouvre dans sa propre fenêtre**, avec son icône, comme un vrai logiciel.
- **Tes données restent sur ton ordinateur**, dans le dossier `data`, avec une sauvegarde automatique chaque jour (les 14 derniers jours sont gardés).

---

## Installation (une seule fois, environ 10 minutes)

### 1. Télécharger Jarvis
Récupère le dossier `jarvis-desktop` et place-le où tu veux, par exemple dans `Documents`.

### 2. Installer Node.js
Node.js est le moteur qui fait tourner Jarvis. C'est gratuit.
Va sur **https://nodejs.org/fr/download**, télécharge la version **LTS** et installe-la en laissant les options par défaut.

### 3. Créer ta clé API Claude
C'est elle qui permet à Jarvis de réfléchir et de te répondre.

1. Va sur **https://console.anthropic.com** et crée un compte.
2. Dans **Billing**, ajoute un moyen de paiement et un peu de crédit (5 à 10 € suffisent pour commencer).
3. Dans **Settings → API Keys**, clique sur **Create Key** et copie la clé (elle commence par `sk-ant-`).

> 💶 **Coût :** l'API se paie à l'usage. Ce n'est pas compris dans un abonnement Claude.ai. Compte environ **2 à 5 centimes par échange** avec Jarvis. Dans la console, tu peux fixer une limite de dépense mensuelle.

### 4. Lancer Jarvis
- **Windows :** double-clique sur **`Demarrer-Jarvis.bat`**.
  - Si Windows affiche « Windows a protégé votre ordinateur », clique sur *Informations complémentaires*, puis sur *Exécuter quand même*.
  - Pour avoir l'icône Jarvis sur ton Bureau, double-clique une fois sur **`Creer-raccourci-Bureau.bat`**.
- **Mac :** fais un clic droit sur **`Demarrer-Jarvis.command`**, puis *Ouvrir* (la première fois seulement).

Au premier lancement, Jarvis installe ses composants, ce qui prend environ 30 secondes. Ensuite, sa fenêtre s'ouvre et il te demande ta clé API : colle-la et clique sur **Enregistrer**.

### 5. Autoriser le micro
Au premier clic sur **Démarrer Jarvis**, le navigateur demande l'accès au micro : clique sur **Autoriser**.

---

## Utilisation au quotidien

- **Démarrer :** double-clique sur l'icône Jarvis. Une petite fenêtre noire s'ouvre aussi. Elle fait tourner Jarvis, alors laisse-la ouverte. Pour arrêter Jarvis, ferme-la.
- **Parler :** clique sur **Démarrer Jarvis** (ou Ctrl + J), puis parle normalement. Par exemple :
  - « Ajoute Mme Dupont comme prospect pour SHD, un devis de 400 euros, à rappeler jeudi. »
  - « Combien j'ai dépensé ce mois-ci ? »
  - « Fais-moi un plan pour trouver dix nouveaux clients pour SHD. »
- **Arrêter la conversation :** dis « stop », « arrête » ou « au revoir ».
- **Changer la voix :** dans l'écran *Parler à Jarvis*, utilise le menu **Voix** et le bouton **Tester**.

## La voix la plus réaliste

Jarvis choisit automatiquement la voix d'homme la plus naturelle de ton ordinateur.

- **Windows :** Jarvis s'ouvre dans **Microsoft Edge**, qui propose les voix naturelles **Henri** et **Rémy**. Ce sont les plus réalistes.
- **Mac :** dans Réglages Système, puis Accessibilité, Contenu énoncé, Voix du système, télécharge **Thomas** ou **Daniel** en version *Premium* ou *Améliorée*.

## Tes données

- Elles sont dans `data/jarvis-data.json`, et les sauvegardes dans `data/sauvegardes/`.
- Le bouton **Réglages**, en bas à gauche, permet d'exporter toutes tes données ou de changer ta clé API.
- Ta clé API est enregistrée dans `data/config.json`. **Ne partage jamais ce fichier.**

## En cas de problème

| Problème | Solution |
|---|---|
| « Node.js n'est pas installé » | Installe Node.js (étape 2), puis relance. |
| « La clé API est refusée » | Ouvre Réglages et colle à nouveau ta clé. |
| « Ton compte API n'a plus de crédit » | Recharge ton crédit sur console.anthropic.com, dans Billing. |
| Jarvis ne m'entend pas | Vérifie que le micro est autorisé (icône 🎤 ou 🔒 à gauche de la barre d'adresse) et qu'il est bien branché. |
| La fenêtre ne s'ouvre pas | Va sur **http://localhost:4747** dans Edge ou Chrome. |

---

### Pour les développeurs

- `server.js` : serveur local (port 4747, accessible uniquement depuis ton ordinateur). Il sert l'interface, enregistre les données en JSON et transmet les demandes à Claude via le SDK officiel `@anthropic-ai/sdk` (modèle `claude-opus-5-5`).
- `public/local-runtime.js` : fait le lien entre l'interface et le serveur local, et gère la boucle d'outils de Claude.
- `public/index.html` : interface générée à partir de `../jarvis/index.html` (la version claude.ai). Après chaque modification de cette interface, lance `node sync-ui.mjs`.
