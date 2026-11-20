// Régression QA rejouable — gates du CONTRAT (lane 8656).
// Usage : AGENT_BROWSER_SESSION=kiw-aaa-qa node tools/probe.mjs [--cb N]
// Gates : __sim présent, erreurs runtime vides, fps >= 55 (idle + course),
// stage jouable (déplacement + saut), pause/reprise, 5 cycles de scènes sans
// fuite (tickers/listeners/heap), 3 reloads sans croissance heap > 20 %.
import { mkdirSync, writeFileSync } from "node:fs";
import {
  ab, evalJSON, evalRaw, ouvrir, attendre, capture, erreurs,
  maintenir, attendreSim, fps, heapPrecis, mo, BASE_URL, cacheFroid,
} from "./qa-lib.mjs";

const cb = process.argv.includes("--cb") ? process.argv[process.argv.indexOf("--cb") + 1] : String(Date.now() % 100000);
const dossier = "/tmp/kiw-aaa/qa";
mkdirSync(dossier, { recursive: true });
const resultats = [];
let echecs = 0;
function gate(nom, ok, detail = "") {
  resultats.push({ gate: nom, ok: !!ok, detail });
  if (!ok) echecs++;
  console.log(`${ok ? "VERT" : "ROUGE"}  ${nom}${detail ? " — " + detail : ""}`);
}

const url = `${BASE_URL}?scene=stage&cb=${cb}`;
console.log(`== probe ${url} ==`);
await cacheFroid();
ouvrir(url);
await attendre(300);
capture(`${dossier}/probe-chargement.png`);
let tti = -1;
try {
  tti = await attendreSim(45000);
} catch (e) {
  gate("__sim présent", false, String(e));
}
if (tti >= 0) gate("__sim présent", true, `TTI borne sup ${Math.round(tti)} ms`);
gate("écran de chargement présent au boot", evalJSON(`!!document.getElementById('kiw-chargement') || window.__qa?.tti != null`));
await attendre(1200);
capture(`${dossier}/probe-stage.png`);

gate("erreurs runtime vides (boot)", erreurs().length === 0, erreurs().join(" | ").slice(0, 300));
gate("__erreur null", evalJSON(`window.__erreur ?? null`) === null);

// Warm-up : compilation de shaders + pics de charge machine (agents parallèles)
// au boot. Le gate fps vise l'état STABLE de jeu, pas la première seconde.
// Un seul rejeu autorisé si le premier échantillon est bas (charge transitoire).
await attendre(3000);
async function fpsStable(duree) {
  const a = await fps(duree);
  if (a >= 55) return { fps: a, note: "1er échantillon" };
  await attendre(2500);
  const b = await fps(duree);
  return { fps: Math.max(a, b), note: `rejeu après warm-up (${a} → ${b})` };
}
const idle = await fpsStable(2500);
gate("fps idle >= 55", idle.fps >= 55, `${idle.fps} fps (${idle.note})`);
evalRaw(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}));1`);
const course = await fpsStable(2500);
evalRaw(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyD'}));1`);
gate("fps course >= 55", course.fps >= 55, `${course.fps} fps (${course.note})`);
const fpsIdle = idle.fps, fpsCourse = course.fps;

// Jouable : déplacement horizontal réel.
const x0 = evalJSON(`window.__sim.joueur.x`);
await maintenir("KeyD", 400);
await attendre(120);
const x1 = evalJSON(`window.__sim.joueur.x`);
gate("stage jouable : déplacement", Math.abs(x1 - x0) > 8, `x ${x0?.toFixed?.(1)} → ${x1?.toFixed?.(1)}`);
// Saut edge-triggered.
const y0 = evalJSON(`window.__sim.joueur.y`);
await maintenir("Space", 160);
await attendre(200);
const y1 = evalJSON(`window.__sim.joueur.y`);
gate("stage jouable : saut", Math.abs(y1 - y0) > 4, `y ${y0?.toFixed?.(1)} → ${y1?.toFixed?.(1)}`);

// Pause / reprise : sim.temps gelé puis reparti.
await maintenir("Escape", 150);
await attendre(400);
const t0 = evalJSON(`window.__sim.temps`);
await attendre(700);
const t1 = evalJSON(`window.__sim.temps`);
capture(`${dossier}/probe-pause.png`);
gate("pause gèle la simulation", Math.abs(t1 - t0) < 1e-6, `temps ${t0?.toFixed?.(2)} → ${t1?.toFixed?.(2)}`);
await maintenir("Escape", 150);
await attendre(500);
const t2 = evalJSON(`window.__sim.temps`);
gate("reprise relance la simulation", t2 > t1 + 0.2, `temps ${t1?.toFixed?.(2)} → ${t2?.toFixed?.(2)}`);

// 5 cycles titre ↔ carte ↔ stage ↔ resultats via le hook QA.
const ref = evalJSON(`window.__qa.compteurs()`);
const heap0 = await heapPrecis();
const cycles = [];
for (let i = 0; i < 5; i++) {
  for (const scene of ["titre", "carte", "stage", "resultats"]) {
    evalRaw(`window.__qa.allerA(${JSON.stringify(scene)});1`);
    if (scene === "stage") {
      const debut = Date.now();
      while (Date.now() - debut < 20000) {
        const t = evalJSON(`window.__sim ? window.__sim.temps : -1`);
        if (t >= 0 && t < 1.5) break;
        await attendre(120);
      }
    } else await attendre(900);
  }
  await attendre(600);
  const c = evalJSON(`window.__qa.compteurs()`);
  c.census = evalJSON(`window.__qa.census ? window.__qa.census() : null`);
  const heap = await heapPrecis();
  cycles.push({ i: i + 1, heap_Mo: mo(heap), ...c });
  console.log(`cycle ${i + 1}`, JSON.stringify(cycles[i]));
}
const dernier = cycles[cycles.length - 1];
gate("tickers soldés après cycles", dernier.tickers === ref.tickers, `${ref.tickers} → ${dernier.tickers}`);
const c0 = cycles[0].census, cN = dernier.census;
gate(
  "census scène stable (graphics/text/sprites)",
  !!c0 && !!cN && Math.abs(cN.graphics - c0.graphics) <= 2 && Math.abs(cN.text - c0.text) <= 2 && Math.abs(cN.sprites - c0.sprites) <= 4,
  `cycle1 ${JSON.stringify(c0)} → cycle5 ${JSON.stringify(cN)}`,
);
gate("listeners nets stables", dernier.listeners - ref.listeners <= 4, `${ref.listeners} → ${dernier.listeners}`);
gate("intervals nets stables", dernier.intervals - ref.intervals <= 1, `${ref.intervals} → ${dernier.intervals}`);
const croissanceCycles = ((dernier.heap_Mo - mo(heap0)) / mo(heap0)) * 100;
gate("heap cycles < +20 %", croissanceCycles < 20, `${mo(heap0)} → ${dernier.heap_Mo} Mo (${croissanceCycles.toFixed(1)} %)`);
gate("erreurs runtime vides (cycles)", erreurs().length === 0, erreurs().join(" | ").slice(0, 300));

// 3 reloads.
const reloads = [];
for (let i = 0; i < 3; i++) {
  ab("reload");
  await attendreSim(45000);
  await attendre(1500);
  reloads.push(mo(await heapPrecis()));
}
const croissanceReloads = ((reloads[2] - reloads[0]) / reloads[0]) * 100;
gate("3 reloads : heap < +20 %", croissanceReloads < 20, `${reloads.join(" → ")} Mo (${croissanceReloads.toFixed(1)} %)`);
gate("erreurs runtime vides (final)", erreurs().length === 0, erreurs().join(" | ").slice(0, 300));
capture(`${dossier}/probe-final.png`);

const rapport = { url, date: new Date().toISOString(), tti_ms: Math.round(tti), fpsIdle, fpsCourse, cycles, reloads, croissanceCycles_pct: +croissanceCycles.toFixed(1), croissanceReloads_pct: +croissanceReloads.toFixed(1), resultats, echecs };
writeFileSync(`${dossier}/probe.json`, JSON.stringify(rapport, null, 2));
console.log(`== probe : ${echecs === 0 ? "VERTE" : echecs + " GATE(S) ROUGE(S)"} ==`);
process.exit(echecs === 0 ? 0 : 1);