// Helpers agent-browser + CDP pour les outils QA (probe / mesure).
// Session : AGENT_BROWSER_SESSION=kiw-aaa-qa (surchargeable via env).
import { execFileSync } from "node:child_process";

export const SESSION = process.env.AGENT_BROWSER_SESSION ?? "kiw-aaa-qa";
export const BASE_URL =
  process.env.QA_URL ?? "http://127.0.0.1:8656/kid-icarus-web/";

export function ab(...args) {
  return execFileSync("agent-browser", args, {
    env: { ...process.env, AGENT_BROWSER_SESSION: SESSION },
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

// eval renvoie la valeur JSON-encodée par le CLI.
export function evalRaw(expr) {
  const brut = ab("eval", expr);
  try {
    return JSON.parse(brut);
  } catch {
    return brut;
  }
}

export function evalJSON(expr) {
  const v = evalRaw(`JSON.stringify(${expr})`);
  return typeof v === "string" ? JSON.parse(v) : v;
}

export const ouvrir = (url) => {
  erreursClear();
  return ab("open", url);
};
export const attendre = (ms) => evalRaw(`new Promise(r=>setTimeout(r,${ms}))`);
export const capture = (chemin) => ab("screenshot", chemin);

// Le buffer d'erreurs du daemon survit aux navigations : on le vide AVANT
// chaque ouverture pour ne pas attribuer à un build les erreurs d'un autre.
// Les rechargements successifs accumulent volontairement (gate 3 reloads).
export function erreursClear() {
  try {
    ab("errors", "--clear");
  } catch {}
}
export const recharger = () => ab("reload");

export function erreurs() {
  const brut = ab("errors");
  if (!brut) return [];
  return brut.split("\n").filter((l) => l.trim() && !/^no errors/i.test(l));
}

// Inputs edge-triggered : keydown et keyup dans DEUX evals séparés, maintien >= 0.12 s.
export const toucheDown = (code) =>
  evalRaw(`window.dispatchEvent(new KeyboardEvent('keydown',{code:${JSON.stringify(code)}}));1`);
export const toucheUp = (code) =>
  evalRaw(`window.dispatchEvent(new KeyboardEvent('keyup',{code:${JSON.stringify(code)}}));1`);
export async function maintenir(code, ms) {
  toucheDown(code);
  await attendre(ms);
  toucheUp(code);
}

export async function attendreSim(timeoutMs = 30000) {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) {
    const v = evalJSON(`window.__sim ? performance.now() : -1`);
    if (v >= 0) return v;
    await attendre(80);
  }
  throw Error(`__sim absent après ${timeoutMs} ms`);
}

// fps réel via rAF (le ticker pixi tourne sur rAF).
export function fps(dureeMs = 2500) {
  return evalRaw(`new Promise(r=>{let n=0;const t0=performance.now();
    const f=()=>{n++;const dt=performance.now()-t0;
      if(dt<${dureeMs})requestAnimationFrame(f);else r(+(n/(dt/1000)).toFixed(1))};
    requestAnimationFrame(f)})`);
}

// --- CDP : GC forcé + heap précis (performance.memory est bucketizé) ---
let cdpPromise = null;
async function cdp() {
  if (cdpPromise) return cdpPromise;
  cdpPromise = (async () => {
    const url = ab("get", "cdp-url");
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(Error("CDP ws error"));
    });
    let id = 0;
    const attente = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && attente.has(msg.id)) {
        const { res, rej } = attente.get(msg.id);
        attente.delete(msg.id);
        msg.error ? rej(Error(msg.error.message)) : res(msg.result);
      }
    };
    const envoyer = (method, params = {}, sessionId) =>
      new Promise((res, rej) => {
        const mid = ++id;
        attente.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
      });
    const { targetInfos } = await envoyer("Target.getTargets");
    const page = targetInfos.find((t) => t.type === "page" && t.url.includes("kid-icarus-web"))
      ?? targetInfos.find((t) => t.type === "page");
    if (!page) throw Error("cible page introuvable");
    const { sessionId } = await envoyer("Target.attachToTarget", {
      targetId: page.targetId,
      flatten: true,
    });
    return { envoyer, sessionId, ws };
  })();
  return cdpPromise;
}

export async function heapPrecis() {
  try {
    const { envoyer, sessionId } = await cdp();
    await envoyer("HeapProfiler.collectGarbage", {}, sessionId);
    const { usedSize } = await envoyer("Runtime.getHeapUsage", {}, sessionId);
    return usedSize;
  } catch {
    return evalJSON(`performance.memory?.usedJSHeapSize ?? -1`);
  }
}

// Cache froid : transferts réels au démarrage (sinon transferSize = 0).
export async function cacheFroid() {
  const { envoyer, sessionId } = await cdp();
  await envoyer("Network.enable", {}, sessionId);
  await envoyer("Network.clearBrowserCache", {}, sessionId);
  await envoyer("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
}

export function ressources() {
  return evalJSON(`(() => {
    const es = performance.getEntriesByType('resource');
    const cat = u => u.includes('/statique/') || /\\.js(\\?|$)/.test(u) ? 'js'
      : u.includes('/data/') ? 'data' : u.includes('/levels/') ? 'levels'
      : u.includes('/assets/musique/') ? 'musique' : u.includes('/assets/sfx/') ? 'sfx'
      : u.includes('/assets/art/') ? 'art' : 'autre';
    const par = {}; let total = 0, n = 0;
    for (const e of es) {
      const octets = e.transferSize || e.encodedBodySize || 0;
      const c = cat(e.name);
      par[c] ??= { octets: 0, n: 0 };
      par[c].octets += octets; par[c].n++;
      total += octets; n++;
    }
    return { total, n, par };
  })()`);
}

export const mo = (octets) => +(octets / 1e6).toFixed(2);