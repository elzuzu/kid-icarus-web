// Génère manifeste.json { fichier: { octets, palier } } pour l'écran de chargement.
// Paliers : critique = données + niveau + joueur + hud ; jeu = décors/ennemis/boss/effets/objets/ui ;
// differe = musique + sfx (streaming/lazy côté audio).
// Usage : node tools/gen-manifeste.mjs [sortie]
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE = new URL("..", import.meta.url).pathname;
const PUBLIC = join(RACINE, "public");
const EXTENSIONS = /\.(webp|json|ogg|mp3|png|jpg|svg)$/;

function palier(chemin) {
  if (chemin.startsWith("data/") || chemin.startsWith("levels/")) return "critique";
  if (chemin.startsWith("assets/musique/") || chemin.startsWith("assets/sfx/")) return "differe";
  if (/^assets\/art\/(pit|hud)\//.test(chemin)) return "critique";
  return "jeu";
}

function* fichiers(dossier) {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const complet = join(dossier, entree.name);
    if (entree.isDirectory()) yield* fichiers(complet);
    else if (EXTENSIONS.test(entree.name) && !entree.name.endsWith(".import")) yield complet;
  }
}

const manifeste = {};
let total = 0;
for (const dossier of ["assets", "data", "levels"]) {
  for (const complet of fichiers(join(PUBLIC, dossier))) {
    const chemin = relative(PUBLIC, complet).split("\\").join("/");
    const octets = statSync(complet).size;
    manifeste[chemin] = { octets, palier: palier(chemin) };
    total += octets;
  }
}
const sortie = process.argv[2] ?? join(RACINE, "tools", "manifeste.json");
writeFileSync(sortie, JSON.stringify(manifeste));
const parPalier = {};
for (const { octets, palier: p } of Object.values(manifeste)) {
  parPalier[p] ??= { fichiers: 0, octets: 0 };
  parPalier[p].fichiers++;
  parPalier[p].octets += octets;
}
console.log(
  `manifeste : ${Object.keys(manifeste).length} fichiers, ${(total / 1e6).toFixed(1)} Mo`,
  JSON.stringify(parPalier),
  "→",
  sortie,
);