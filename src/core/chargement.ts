// Écran de chargement + instrumentation QA (périmètre qa).
// Progression RÉELLE : octets reçus (content-length / corps de réponse), fichiers
// terminés/démarrés, paliers du manifeste (critique / jeu / différé).
// Sert aussi de panneau d'erreur : aucun échec ne doit produire un écran noir muet.

export interface EtatChargement {
  phase: string;
  detail: string;
  faits: number;
  total: number;
  octets: number;
  octetsAttendus: number | null;
  paliers: Record<string, { octets: number; fichiers: number }>;
  manquants: string[];
}

const COULEURS = {
  fond: "#07060a",
  surface: "#120d1c",
  encre: "#f4e9d8",
  ambre: "#ffb347",
  braise: "#ff5a3c",
  ciel: "#7fd4ff",
  magenta: "#ff4fa0",
  or: "#ffd76a",
  succes: "#7de08a",
  avertissement: "#ffc44d",
  danger: "#ff5470",
  info: "#7fd4ff",
};

export class EcranChargement {
  racine: HTMLDivElement;
  private barre: HTMLDivElement;
  private pourcent: HTMLSpanElement;
  private phase: HTMLDivElement;
  private detail: HTMLDivElement;
  private chiffres: HTMLDivElement;
  private paliers: HTMLDivElement;
  private alertes: HTMLDivElement;
  private etat: EtatChargement = {
    phase: "Initialisation",
    detail: "réveil du renderer…",
    faits: 0,
    total: 0,
    octets: 0,
    octetsAttendus: null,
    paliers: {},
    manquants: [],
  };
  private retire = false;

  constructor() {
    const style = document.createElement("style");
    style.textContent = `
#kiw-chargement{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(120% 90% at 50% 110%, #2a1030 0%, #140b20 45%, ${COULEURS.fond} 100%);
  color:${COULEURS.encre};font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  transition:opacity .45s ease;overflow:hidden}
#kiw-chargement::before{content:"";position:absolute;inset:-40%;pointer-events:none;opacity:.5;
  background:radial-gradient(38% 30% at 22% 30%, rgba(255,90,60,.16), transparent 70%),
             radial-gradient(30% 26% at 78% 22%, rgba(127,212,255,.12), transparent 70%),
             radial-gradient(46% 34% at 60% 82%, rgba(255,79,160,.10), transparent 70%);
  animation:kiw-aurore 14s ease-in-out infinite alternate}
#kiw-chargement::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.07;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")}
@keyframes kiw-aurore{from{transform:translate3d(-2%,1%,0) rotate(-1deg)}to{transform:translate3d(2%,-2%,0) rotate(1deg)}}
@keyframes kiw-monte{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes kiw-bat{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.82)}}
#kiw-chargement .kiw-carte{position:relative;width:min(560px,88vw);padding:34px 38px 28px;
  background:linear-gradient(160deg, rgba(28,18,44,.92), rgba(14,9,24,.94));
  border:1px solid rgba(255,179,71,.28);border-radius:14px;
  box-shadow:0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(127,212,255,.06) inset, 0 0 60px rgba(255,90,60,.08) inset;
  animation:kiw-monte .5s ease both}
#kiw-chargement .kiw-embleme{display:flex;align-items:center;gap:14px;margin-bottom:6px}
#kiw-chargement .kiw-embleme svg{filter:drop-shadow(0 0 10px rgba(255,215,106,.45));animation:kiw-bat 2.6s ease-in-out infinite}
#kiw-chargement h1{margin:0;font:700 26px/1.1 ui-monospace,Menlo,monospace;letter-spacing:.14em;
  background:linear-gradient(92deg, ${COULEURS.or} 10%, ${COULEURS.ambre} 45%, ${COULEURS.magenta} 90%);
  -webkit-background-clip:text;background-clip:text;color:transparent}
#kiw-chargement .kiw-sous{margin:2px 0 22px;font-size:11px;letter-spacing:.32em;color:${COULEURS.ciel};opacity:.85;text-transform:uppercase}
#kiw-chargement .kiw-phase{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:8px}
#kiw-chargement .kiw-phase strong{font-size:13px;letter-spacing:.08em;color:${COULEURS.encre}}
#kiw-chargement .kiw-pct{font-size:22px;font-weight:700;color:${COULEURS.or};font-variant-numeric:tabular-nums}
#kiw-chargement .kiw-piste{height:12px;border-radius:7px;background:#1c1430;border:1px solid rgba(127,212,255,.18);overflow:hidden;position:relative}
#kiw-chargement .kiw-barre{position:relative;height:100%;width:0%;border-radius:6px;transition:width .25s ease;
  background:linear-gradient(90deg, ${COULEURS.braise}, ${COULEURS.ambre} 40%, ${COULEURS.or} 62%, ${COULEURS.ciel} 100%);
  box-shadow:0 0 14px rgba(255,179,71,.55)}
#kiw-chargement .kiw-barre::after{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(115deg, rgba(255,255,255,.14) 0 8px, transparent 8px 16px);
  mix-blend-mode:overlay;animation:kiw-flux 1.1s linear infinite}
@keyframes kiw-flux{from{background-position:0 0}to{background-position:32px 0}}
#kiw-chargement .kiw-detail{margin-top:8px;font-size:12px;color:#c9bba9;min-height:18px}
#kiw-chargement .kiw-chiffres{margin-top:14px;display:flex;gap:18px;font-size:12px;color:#a99c8b;font-variant-numeric:tabular-nums}
#kiw-chargement .kiw-chiffres b{color:${COULEURS.encre};font-weight:600}
#kiw-chargement .kiw-paliers{margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#kiw-chargement .kiw-palier{padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)}
#kiw-chargement .kiw-palier i{display:block;font-style:normal;font-size:10px;letter-spacing:.18em;margin-bottom:3px}
#kiw-chargement .kiw-palier b{font-size:13px;font-variant-numeric:tabular-nums}
#kiw-chargement .kiw-palier.critique i{color:${COULEURS.ambre}}
#kiw-chargement .kiw-palier.jeu i{color:${COULEURS.ciel}}
#kiw-chargement .kiw-palier.differe i{color:${COULEURS.magenta}}
#kiw-chargement .kiw-alertes{margin-top:12px;max-height:96px;overflow-y:auto;font-size:11.5px;color:${COULEURS.avertissement};
  scrollbar-width:thin;scrollbar-color:${COULEURS.ambre} #1c1430}
#kiw-chargement .kiw-alertes::-webkit-scrollbar{width:8px}
#kiw-chargement .kiw-alertes::-webkit-scrollbar-track{background:#1c1430;border-radius:4px}
#kiw-chargement .kiw-alertes::-webkit-scrollbar-thumb{background:${COULEURS.ambre};border-radius:4px}
#kiw-chargement .kiw-alertes::-webkit-scrollbar-thumb:hover{background:${COULEURS.or}}
#kiw-chargement .kiw-alertes div{padding:2px 0;border-bottom:1px dashed rgba(255,196,77,.2)}
#kiw-chargement.kiw-erreur .kiw-carte{border-color:rgba(255,84,112,.5);box-shadow:0 24px 80px rgba(0,0,0,.7),0 0 60px rgba(255,84,112,.12) inset}
#kiw-chargement .kiw-err{display:none;margin-top:14px;padding:12px 14px;border-radius:8px;background:rgba(255,84,112,.08);
  border:1px solid rgba(255,84,112,.35);color:#ffd9e0;font-size:12.5px;white-space:pre-wrap;max-height:180px;overflow-y:auto;
  scrollbar-width:thin;scrollbar-color:${COULEURS.danger} #20101c}
#kiw-chargement .kiw-err::-webkit-scrollbar{width:8px}
#kiw-chargement .kiw-err::-webkit-scrollbar-track{background:#20101c}
#kiw-chargement .kiw-err::-webkit-scrollbar-thumb{background:${COULEURS.danger};border-radius:4px}
#kiw-chargement.kiw-erreur .kiw-err{display:block}
#kiw-chargement .kiw-actions{display:none;margin-top:14px;gap:10px}
#kiw-chargement.kiw-erreur .kiw-actions{display:flex}
#kiw-chargement button{cursor:pointer;font:600 13px ui-monospace,Menlo,monospace;letter-spacing:.06em;padding:10px 18px;border-radius:8px;
  border:1px solid rgba(255,215,106,.5);background:linear-gradient(120deg, rgba(255,179,71,.22), rgba(255,79,160,.18));color:${COULEURS.or}}
#kiw-chargement button:hover{background:linear-gradient(120deg, rgba(255,179,71,.38), rgba(255,79,160,.3));box-shadow:0 0 18px rgba(255,179,71,.35)}
#kiw-chargement .kiw-pied{margin-top:16px;font-size:10.5px;letter-spacing:.14em;color:#6f6478;text-transform:uppercase}
`;
    document.head.appendChild(style);
    this.racine = document.createElement("div");
    this.racine.id = "kiw-chargement";
    this.racine.innerHTML = `
<div class="kiw-carte" role="status" aria-live="polite">
  <div class="kiw-embleme">
    <svg width="46" height="34" viewBox="0 0 46 34" aria-hidden="true">
      <path d="M23 6 C17 2 8 2 2 8 C9 8 13 10 16 13 C10 12 5 14 1 19 C8 18 13 19 17 22 C13 23 10 26 9 30 C14 27 19 26 23 26 C27 26 32 27 37 30 C36 26 33 23 29 22 C33 19 38 18 45 19 C41 14 36 12 30 13 C33 10 37 8 44 8 C38 2 29 2 23 6 Z" fill="#ffd76a"/>
      <circle cx="23" cy="16" r="5" fill="#ff5a3c"/><circle cx="23" cy="16" r="2.4" fill="#fff3d6"/>
    </svg>
    <div><h1>KID ICARUS</h1></div>
  </div>
  <div class="kiw-sous">L’Ascension — chargement</div>
  <div class="kiw-phase"><strong class="kiw-libelle">Initialisation</strong><span class="kiw-pct">0%</span></div>
  <div class="kiw-piste"><div class="kiw-barre"></div></div>
  <div class="kiw-detail">réveil du renderer…</div>
  <div class="kiw-chiffres"><span><b class="kiw-fichiers">0</b> fichiers</span><span><b class="kiw-mo">0,0</b> Mo reçus</span><span><b class="kiw-attente">0</b> en cours</span></div>
  <div class="kiw-paliers">
    <div class="kiw-palier critique"><i>CRITIQUE</i><b>—</b></div>
    <div class="kiw-palier jeu"><i>JEU</i><b>—</b></div>
    <div class="kiw-palier differe"><i>DIFFÉRÉ</i><b>—</b></div>
  </div>
  <div class="kiw-alertes"></div>
  <div class="kiw-err"></div>
  <div class="kiw-actions"><button type="button" class="kiw-reload">Recharger</button></div>
  <div class="kiw-pied">paliers : critique → jeu → différé (musique &amp; sfx en lazy)</div>
</div>`;
    document.body.appendChild(this.racine);
    this.barre = this.racine.querySelector(".kiw-barre")!;
    this.pourcent = this.racine.querySelector(".kiw-pct")!;
    this.phase = this.racine.querySelector(".kiw-libelle")!;
    this.detail = this.racine.querySelector(".kiw-detail")!;
    this.chiffres = this.racine.querySelector(".kiw-chiffres")!;
    this.paliers = this.racine.querySelector(".kiw-paliers")!;
    this.alertes = this.racine.querySelector(".kiw-alertes")!;
    this.racine.querySelector(".kiw-reload")!.addEventListener("click", () => location.reload());
  }

  maj(patch: Partial<EtatChargement>) {
    Object.assign(this.etat, patch);
    if (this.retire) return;
    const e = this.etat;
    if (e.manquants.length) {
      this.alertes.innerHTML = e.manquants
        .slice(0, 12)
        .map((m) => `<div>⚠ asset manquant : ${m}</div>`)
        .join("");
    }
    // En mode erreur, le panneau garde son message : pas de réécriture par le flux.
    if (this.racine.classList.contains("kiw-erreur")) return;
    const ratio =
      e.octetsAttendus && e.octetsAttendus > 0
        ? e.octets / e.octetsAttendus
        : e.total > 0
          ? e.faits / e.total
          : 0;
    const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    this.barre.style.width = `${pct}%`;
    this.pourcent.textContent = `${pct}%`;
    this.phase.textContent = e.phase;
    this.detail.textContent = e.detail;
    this.chiffres.innerHTML = `<span><b>${e.faits}</b> fichiers</span><span><b>${(e.octets / 1e6).toFixed(1).replace(".", ",")}</b> Mo reçus</span><span><b>${Math.max(0, e.total - e.faits)}</b> en cours</span>`;
    for (const [nom, palier] of Object.entries(e.paliers)) {
      const noeud = this.paliers.querySelector(`.kiw-palier.${nom} b`);
      if (noeud) noeud.textContent = `${(palier.octets / 1e6).toFixed(1).replace(".", ",")} Mo · ${palier.fichiers} f`;
    }
  }

  avertissement(message: string) {
    this.etat.manquants.push(message);
    this.maj({});
  }

  async terminer() {
    if (this.retire) return;
    this.maj({ phase: "Prêt", detail: "bon vol, Pit.", faits: this.etat.total, octetsAttendus: this.etat.octets || 1, octets: this.etat.octets || 1 });
    this.retire = true;
    this.racine.style.opacity = "0";
    await new Promise((r) => setTimeout(r, 480));
    this.racine.remove();
  }

  erreur(message: string) {
    this.retire = false;
    if (!this.racine.isConnected) document.body.appendChild(this.racine);
    this.racine.style.opacity = "1";
    this.racine.classList.add("kiw-erreur");
    this.racine.querySelector(".kiw-err")!.textContent = message;
    this.phase.textContent = "Chargement interrompu";
    this.detail.textContent = "le jeu n’a pas pu démarrer — détail ci-dessous.";
    this.barre.style.width = "100%";
    this.barre.style.background = `linear-gradient(90deg, ${COULEURS.danger}, ${COULEURS.magenta})`;
    this.pourcent.textContent = "✕";
  }
}

// --- Instrumentation fetch : octets réels, fichiers, 404, paliers ---
export interface StatsFetch {
  demarres: number;
  finis: number;
  echecs: number;
  octets: number;
  enCours: number;
  manquants: string[];
  paliers: Record<string, { octets: number; fichiers: number }>;
  dejaComptes: Set<string>;
}

export function instrumenterFetch(
  base: string,
  manifeste: Record<string, { octets: number; palier: string }> | null,
  surMaj: (stats: StatsFetch) => void,
): StatsFetch {
  const stats: StatsFetch = {
    demarres: 0,
    finis: 0,
    echecs: 0,
    octets: 0,
    enCours: 0,
    manquants: [],
    paliers: { critique: { octets: 0, fichiers: 0 }, jeu: { octets: 0, fichiers: 0 }, differe: { octets: 0, fichiers: 0 } },
    dejaComptes: new Set<string>(),
  };
  const original = window.fetch.bind(window);
  const palierDe = (chemin: string): string => {
    if (manifeste?.[chemin]) return manifeste[chemin].palier;
    if (/^assets\/(musique|sfx)\//.test(chemin)) return "differe";
    if (/^(data|levels)\//.test(chemin) || /^assets\/art\/(pit|hud)\//.test(chemin)) return "critique";
    return "jeu";
  };
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    // pixi (path.toAbsolute) passe des URLs ABSOLUES http://… : on normalise
    // via pathname, sinon le suivi rate tous les fetch du loader Assets.
    let chemin: string;
    try {
      chemin = new URL(url, location.href).pathname;
    } catch {
      chemin = url;
    }
    const relatif = chemin.startsWith(base) ? chemin.slice(base.length) : chemin.replace(/^\/+/, "");
    const suivi = /^(assets|data|levels)\//.test(relatif) && !relatif.endsWith(".import");
    if (!suivi) return original(input, init);
    stats.demarres++;
    stats.enCours++;
    const palier = palierDe(relatif);
    surMaj(stats);
    let reponse: Response;
    try {
      reponse = await original(input, init);
    } catch (e) {
      stats.echecs++;
      stats.enCours--;
      stats.manquants.push(relatif);
      surMaj(stats);
      throw e;
    }
    stats.enCours--;
    if (!reponse.ok) {
      stats.echecs++;
      stats.manquants.push(`${relatif} (HTTP ${reponse.status})`);
      surMaj(stats);
      // Corps vide : pixi loadJson ne vérifie PAS response.ok et ferait
      // response.json() sur le corps d'erreur — un body "404" (serveurs QA)
      // se parserait en nombre et produirait une fausse planche valide.
      // Un corps vide force un rejet propre → dégradation gracieuse.
      return new Response(null, { status: reponse.status, statusText: reponse.statusText, headers: reponse.headers });
    }
    const attendu = manifeste?.[relatif]?.octets;
    const entete = Number(reponse.headers.get("content-length"));
    const octets = Number.isFinite(entete) && entete > 0 ? entete : (attendu ?? 0);
    stats.finis++;
    stats.octets += octets;
    stats.dejaComptes.add(relatif);
    const p = stats.paliers[palier] ?? (stats.paliers[palier] = { octets: 0, fichiers: 0 });
    p.octets += octets;
    p.fichiers++;
    surMaj(stats);
    return reponse;
  };
  return stats;
}

// --- Compteurs de fuites : listeners / timers / rAF (net) ---
export function instrumenterFuites() {
  const compte = { listeners: 0, intervals: 0, timeouts: 0, raf: 0 };
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (...args: any[]) {
    compte.listeners++;
    return (add as any).apply(this, args);
  };
  EventTarget.prototype.removeEventListener = function (...args: any[]) {
    compte.listeners--;
    return (remove as any).apply(this, args);
  };
  const si = window.setInterval.bind(window);
  const ci = window.clearInterval.bind(window);
  window.setInterval = ((...args: any[]) => {
    compte.intervals++;
    return (si as any)(...args);
  }) as typeof window.setInterval;
  window.clearInterval = ((id: any) => {
    compte.intervals--;
    return ci(id);
  }) as typeof window.clearInterval;
  const st = window.setTimeout.bind(window);
  const ct = window.clearTimeout.bind(window);
  const timeoutsActifs = new Set<number>();
  window.setTimeout = ((...args: any[]) => {
    const id = (st as any)(...args);
    timeoutsActifs.add(id);
    compte.timeouts++;
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id: any) => {
    if (timeoutsActifs.delete(id)) compte.timeouts--;
    return ct(id);
  }) as typeof window.clearTimeout;
  // Les timeouts expirés ne sont pas "clear" : on les solde via wrapper de callback.
  const st2 = window.setTimeout;
  window.setTimeout = ((fn: any, ms?: any, ...reste: any[]) => {
    if (typeof fn !== "function") return (st2 as any)(fn, ms, ...reste);
    return (st2 as any)(
      (...a: any[]) => {
        compte.timeouts--;
        return fn(...a);
      },
      ms,
      ...reste,
    );
  }) as typeof window.setTimeout;
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  const rafActifs = new Set<number>();
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = raf((t) => {
      rafActifs.delete(id);
      compte.raf--;
      cb(t);
    });
    rafActifs.add(id);
    compte.raf++;
    return id;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => {
    if (rafActifs.delete(id)) compte.raf--;
    return caf(id);
  }) as typeof window.cancelAnimationFrame;
  return () => ({ ...compte });
}