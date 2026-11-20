// Suite de mesures perf QA — protocole IDENTIQUE avant/après.
// Usage : node tools/mesure.mjs <label> [--cb N]
// Sortie : /tmp/kiw-aaa/qa/mesures-<label>.json + table console.
import { mkdirSync, writeFileSync } from "node:fs";
import {
  ab, evalJSON, evalRaw, ouvrir, attendre, capture, erreurs,
  maintenir, attendreSim, fps, heapPrecis, ressources, mo, BASE_URL, cacheFroid,
} from "./qa-lib.mjs";

const label = process.argv[2] ?? "run";
const cb = process.argv.includes("--cb") ? process.argv[process.argv.indexOf("--cb") + 1] : "0";
const dossier = "/tmp/kiw-aaa/qa";
mkdirSync(dossier, { recursive: true });
const r = { label, date: new Date().toISOString(), url: `${BASE_URL}?scene=stage&cb=${cb}` };

async function cycleScenes() {
  // stage -> pause -> Abandonner -> resultats -> carte -> titre -> carte -> chaudron -> stage
  await maintenir("Escape", 150); await attendre(350);
  await maintenir("KeyS", 150); await attendre(200);
  await maintenir("KeyS", 150); await attendre(200);
  await maintenir("Enter", 150); await attendre(1400); // resultats
  await maintenir("Enter", 150); await attendre(1400); // carte
  await maintenir("Escape", 150); await attendre(1100); // titre
  await maintenir("Enter", 150); await attendre(1400); // carte (Continuer)
  await maintenir("Enter", 150); await attendre(300);  // chaudron
  await maintenir("Enter", 150);                        // partir -> stage
  const debut = Date.now();
  while (Date.now() - debut < 20000) {
    const v = evalJSON(`window.__sim ? window.__sim.temps : -1`);
    if (v >= 0 && v < 1.5) return true;
    await attendre(150);
  }
  return false;
}

console.log(`== mesures ${label} ==`);
await cacheFroid();
try {
  await evalRaw(`fetch('/__qa/reset').then(r=>r.json())`);
} catch {
  ouvrir(BASE_URL);
  await evalRaw(`fetch('/__qa/reset').then(r=>r.json())`);
}
ouvrir(r.url);
// Capture tôt : écran de chargement (ou écran noir avant correctif).
await attendre(350);
capture(`${dossier}/${label}-chargement.png`);
r.tti_ms = Math.round(await attendreSim(45000)); // borne sup (poll 80 ms)
r.tti_exact_ms = evalJSON(`window.__qa?.tti ?? null`);
await attendre(1500);
const res = ressources();
r.transfert_navigateur = { total_Mo: mo(res.total), fichiers: res.n, par: Object.fromEntries(
  Object.entries(res.par).map(([k, v]) => [k, { Mo: mo(v.octets), n: v.n }])) };
// Vérité terrain : journal du serveur (inclut les fetch des workers pixi).
const journal = await evalRaw(`fetch('/__qa/stats').then(r=>r.json())`);
const cat = (u) => /\/statique\/|\.js(\?|$)/.test(u) ? "js"
  : u.includes("/data/") ? "data" : u.includes("/levels/") ? "levels"
  : u.includes("/assets/musique/") ? "musique" : u.includes("/assets/sfx/") ? "sfx"
  : u.includes("/assets/art/") ? "art" : "autre";
const par = {};
let total = 0, n = 0, manquants = [];
for (const q of journal.requetes) {
  if (!q.url.startsWith("/kid-icarus-web/")) continue;
  if (q.status !== 200) { manquants.push(q.url); continue; }
  const c = cat(q.url);
  par[c] ??= { Mo: 0, n: 0 };
  par[c].Mo = +(par[c].Mo + q.octets / 1e6).toFixed(2);
  par[c].n++;
  total += q.octets; n++;
}
r.transfert = { total_Mo: mo(total), fichiers: n, par, manquants };
capture(`${dossier}/${label}-stage.png`);

r.fps_idle = await fps(2500);

// Course : maintien KeyD pendant la mesure.
evalRaw(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}));1`);
r.fps_course = await fps(2500);
evalRaw(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}));1`);

// Combat : 6 ennemis spawnés autour du joueur + tir maintenu.
r.combat_spawns = evalJSON(`(() => {
  const s = window.__sim; if (!s?.apparitions) return 0;
  let n = 0;
  for (const [dx, dy] of [[-40,-60],[40,-60],[-60,-20],[60,-20],[0,-90],[30,-40]])
    if (s.apparitions.creer('monoeye', s.joueur.x + dx, s.joueur.y + dy)) n++;
  return n;
})()`);
evalRaw(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ'}));1`);
await attendre(400);
r.fps_combat = await fps(2500);
capture(`${dossier}/${label}-combat.png`);
evalRaw(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyJ'}));1`);
r.ennemis_vivants = evalJSON(`window.__sim?.apparitions?.vivants?.length ?? -1`);

// Boss : stage horizontal w2/2-1, téléportation près du marqueur B.
ouvrir(`${BASE_URL}?scene=stage&stage=w2/2-1&cb=${cb}`);
await attendreSim(45000);
await attendre(800);
r.boss_preparation = evalJSON(`(() => {
  const s = window.__sim, m = s.niveau.boss;
  if (!m || m.c < 0) return 'pas de marqueur boss';
  const c = m.c - 8;
  let l = m.l;
  for (let i = 0; i < 24; i++) { if (s.niveau.estAppui(c, m.l + i)) { l = m.l + i; break; } }
  s.joueur.corps.x = (c + 0.5) * 16;
  s.joueur.corps.y = (l + 1) * 16;
  s.joueur.corps.vx = s.joueur.corps.vy = 0;
  return { c, l };
})()`);
await attendre(1500);
r.boss_actif = evalJSON(`!!window.__sim?.boss`);
evalRaw(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ'}));1`);
await attendre(400);
r.fps_boss = await fps(2500);
capture(`${dossier}/${label}-boss.png`);
r.gouverneur_boss = evalJSON(`window.__qa?.gouverneur ?? null`);
// Complément (hors protocole avant/après) : état stabilisé, gouverneur établi.
await attendre(4000);
r.fps_boss_stabilise = await fps(2500);
r.gouverneur_boss_stabilise = evalJSON(`window.__qa?.gouverneur ?? null`);
evalRaw(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyJ'}));1`);

// Mémoire : 5 cycles de scènes UI-driven, heap précis (GC CDP) après chaque.
r.cycles = [];
for (let i = 0; i < 5; i++) {
  const ok = await cycleScenes();
  await attendre(700);
  const entree = { i: i + 1, ok, heap_Mo: mo(await heapPrecis()) };
  const compteurs = evalJSON(`window.__qa?.compteurs ? window.__qa.compteurs() : null`);
  if (compteurs) entree.compteurs = compteurs;
  r.cycles.push(entree);
  console.log(`cycle ${i + 1}: ok=${ok} heap=${entree.heap_Mo} Mo`, compteurs ?? "");
}

// 3 rechargements : croissance heap < 20 %.
r.reloads = [];
for (let i = 0; i < 3; i++) {
  ab("reload");
  await attendreSim(45000);
  await attendre(1500);
  r.reloads.push({ i: i + 1, heap_Mo: mo(await heapPrecis()) });
}
const h0 = r.reloads[0].heap_Mo, h2 = r.reloads[2].heap_Mo;
r.croissance_reloads_pct = +(((h2 - h0) / h0) * 100).toFixed(1);
r.erreurs_runtime = erreurs();
r.erreur_page = evalJSON(`window.__erreur ?? null`);

writeFileSync(`${dossier}/mesures-${label}.json`, JSON.stringify(r, null, 2));
console.log(JSON.stringify(r, null, 2));
console.log(`== écrit : ${dossier}/mesures-${label}.json ==`);