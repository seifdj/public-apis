// Recopie l'interface de jarvis/index.html (version claude.ai) dans public/index.html (version ordinateur).
// À relancer après chaque modification de l'interface : node sync-ui.mjs
import fs from "node:fs";
const src = fs.readFileSync(new URL("../jarvis/index.html", import.meta.url), "utf8");
const head = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#03080f">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
<script src="local-runtime.js"></script>
</head>
<body>
`;
const out = head + src + "\n</body>\n</html>\n";
fs.writeFileSync(new URL("./public/index.html", import.meta.url), out);
console.log("public/index.html mis à jour.");
