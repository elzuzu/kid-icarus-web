// Robustesse 404 — sert dans la lane QA une copie d'assets volontairement trouée
// (symlinks par fichier, le repo n'est JAMAIS modifié) + manifeste troué.
// Cas A : assets optionnels manquants (planche ennemi, musique, decor optionnel,
//         pouvoir hud) → le jeu reste jouable, avertissements visibles.
// Cas B : asset critique manquant (hud/coeur.webp) → panneau d'erreur explicite,
//         pas d'écran noir muet.
// Usage : node tools/test-404.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, symlinkSync, existsSync, rmSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { readdirSync } from "node:fs";
import { evalJSON, evalRaw, ouvrir, attendre, capture, erreurs, attendreSim, maintenir, mo, heapPrecis } from "./qa-lib.mjs";

const REPO = "/Users/alex/Developer/kid-icarus-src";
const LANE = "/tmp/kiw-lane-qa";
const dossier = "/tmp/kiw-aaa/qa";
const TROUS_OPTIONNELS = [
  "art/ennemis/monoeye/monoeye.json",
  "art/ennemis/monoeye/monoeye.webp",
  "musique/enfers_1.ogg",
  "musique/enfers_1_base.ogg",
  "musique/enfers_1_rythme.ogg",
  "art/decors/profondeurs/accessoire.webp",
  "art/hud/pouvoir_eclair.webp",
];
const TROUS_CRITIQUES = ["art/hud/coeur.webp"];

function arbreSymlinks(trous, destination) {
  rmSync(destination, { recursive: true, force: true });
  const racine = join(REPO, "public/assets");
  const pile = [racine];
  let n = 0;
  while (pile.length) {
    const d = pile.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const complet = join(d, e.name);
      const relatif = relative(racine, complet);
      if (e.isDirectory()) pile.push(complet);
      else if (!trous.includes(relatif)) {
        const cible = join(destination, relatif);
        mkdirSync(dirname(cible), { recursive: true });
        symlinkSync(complet, cible);
        n++;
      }
    }
  }
  return n;
}

function manifesteTroue(trous) {
  const m = JSON.parse(readFileSync(join(LANE, "manifeste.json"), "utf8"));
  for (const t of trous) delete m[`assets/${t}`];
  // entrées fantômes : le manifeste promet des fichiers absents du disque
  m["assets/art/hud/fantome_qa.webp"] = { octets: 12345, palier: "critique" };
  writeFileSync(join(LANE, "manifeste-troue.json"), JSON.stringify(m));
}

// --- orchestration ---
const rapport = { cas: [] };
const lienAssets = join(LANE, "assets");
const manifesteOriginal = readFileSync(join(LANE, "manifeste.json"), "utf8");

async function cas(nom, trous, critique) {
  const arbre = join(LANE, `assets-404-${critique ? "crit" : "opt"}`);
  const n = arbreSymlinks(trous, arbre);
  manifesteTroue(trous);
  rmSync(lienAssets, { force: true }); // symlink
  symlinkSync(arbre, lienAssets);
  renameSync(join(LANE, "manifeste.json"), join(LANE, "manifeste-intact.json"));
  renameSync(join(LANE, "manifeste-troue.json"), join(LANE, "manifeste.json"));
  ouvrir(`http://127.0.0.1:8656/kid-icarus-web/?scene=stage&cb=404${critique ? "c" : "o"}`);
  await attendre(600);
  capture(`${dossier}/404-${nom}-boot.png`);
  let sim = false;
  try {
    await attendreSim(critique ? 12000 : 45000);
    sim = true;
  } catch {}
  await attendre(1500);
  if (sim && !critique) {
    // Chargement PARESSEUX final : la planche monoeye n'est fetchée qu'à la
    // première apparition, la musique qu'au réveil audio (1re interaction).
    // On provoque donc réellement les deux fetch troués au lieu de les attendre.
    evalJSON(`(() => {
      const s = window.__sim;
      return s?.apparitions?.creer('monoeye', s.joueur.x + 40, s.joueur.y - 60) ? 1 : 0;
    })()`);
    await maintenir("KeyD", 160); // réveil audio → fetch enfers_1
    await attendre(2500);
  }
  const etat = evalJSON(`({
    sim: !!window.__sim,
    erreur: window.__erreur ?? null,
    manquants: window.__qa?.stats?.manquants ?? [],
    panneauErreur: !!document.querySelector('#kiw-chargement.kiw-erreur'),
    texteErreur: document.querySelector('#kiw-chargement .kiw-err')?.textContent ?? null,
    alertes: document.querySelector('#kiw-chargement .kiw-alertes')?.textContent ?? null,
  })`);
  capture(`${dossier}/404-${nom}-etat.png`);
  const errs = erreurs();
  const r = {
    nom,
    fichiers_servis: n,
    trous,
    sim,
    erreurs_runtime: errs,
    ...etat,
  };
  if (critique) {
    r.ok = !sim && etat.panneauErreur && /404|coeur/i.test(etat.texteErreur ?? "") && errs.length === 0;
  } else {
    r.ok =
      sim &&
      errs.length === 0 &&
      etat.manquants.some((m) => m.includes("monoeye")) &&
      etat.manquants.some((m) => m.includes("enfers_1"));
  }
  rapport.cas.push(r);
  console.log(`${r.ok ? "VERT" : "ROUGE"}  404 ${nom}`, JSON.stringify({ sim, manquants: etat.manquants.length, panneauErreur: etat.panneauErreur, errs: errs.length }));
  // restauration
  rmSync(lienAssets, { force: true });
  symlinkSync(join(REPO, "public/assets"), lienAssets);
  rmSync(join(LANE, "manifeste.json"), { force: true });
  renameSync(join(LANE, "manifeste-intact.json"), join(LANE, "manifeste.json"));
}

await cas("optionnels", TROUS_OPTIONNELS, false);
await cas("critique", TROUS_CRITIQUES, true);
writeFileSync(`${dossier}/404.json`, JSON.stringify(rapport, null, 2));
const echecs = rapport.cas.filter((c) => !c.ok).length;
console.log(`== 404 : ${echecs === 0 ? "VERT" : echecs + " ROUGE(S)"} ==`);
process.exit(echecs ? 1 : 0);