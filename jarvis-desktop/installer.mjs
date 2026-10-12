// Installe Jarvis sans fichier .bat (compatible avec le Contrôle intelligent des applications de Windows 11).
// Usage : ouvre un terminal dans ce dossier et tape :  node installer.mjs
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const win = process.platform === "win32";
const ps = cmd => execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd], { stdio: "inherit" });

console.log("\n  Installation de J.A.R.V.I.S.\n");

if (win) {
  // Retire la marque « téléchargé depuis Internet » des fichiers de Jarvis.
  try { ps(`Get-ChildItem -LiteralPath '${DIR}' -Recurse | Unblock-File`); console.log("  ✓ Fichiers débloqués"); }
  catch { console.log("  (déblocage des fichiers ignoré)"); }
}

if (!fs.existsSync(path.join(DIR, "node_modules", "@anthropic-ai", "sdk"))) {
  console.log("  … Installation des composants (environ 30 secondes)");
  execSync(`${win ? "npm.cmd" : "npm"} install --omit=dev --no-audit --no-fund`, { cwd: DIR, stdio: "inherit" });
}
console.log("  ✓ Composants installés");

if (win) {
  // Raccourci sur le Bureau qui lance directement node.exe (signé par son éditeur, donc autorisé).
  const q = s => s.replace(/'/g, "''");
  ps(`$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut("$d\\Jarvis.lnk");
      $s.TargetPath='${q(process.execPath)}'; $s.Arguments='"${q(path.join(DIR, "server.mjs"))}"'; $s.WorkingDirectory='${q(DIR)}';
      $s.IconLocation='${q(path.join(DIR, "public", "jarvis.ico"))}'; $s.WindowStyle=7; $s.Description='Demarrer Jarvis'; $s.Save()`);
  console.log("  ✓ Icône « Jarvis » créée sur ton Bureau");
}

console.log("\n  Installation terminée. Jarvis démarre…\n");
await import("./server.mjs");
