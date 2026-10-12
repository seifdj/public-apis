#!/bin/bash
# Démarre Jarvis sur macOS ou Linux (double-clic sur macOS).
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas encore installé. Installe la version LTS depuis https://nodejs.org puis relance ce fichier."
  (open https://nodejs.org/fr/download || xdg-open https://nodejs.org/fr/download) >/dev/null 2>&1
  read -r -p "Appuie sur Entrée pour fermer."
  exit 1
fi
if [ ! -d node_modules/@anthropic-ai/sdk ]; then
  echo "Première utilisation : installation des composants..."
  npm install --omit=dev --no-audit --no-fund
fi
node server.mjs
