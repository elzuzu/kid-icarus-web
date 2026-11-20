import { Application, Assets, Container, Graphics, GraphicsContext, Sprite, Text } from "pixi.js";
import { n as LARGEUR, t as HAUTEUR } from "../core";
import { EcranChargement, instrumenterFetch, instrumenterFuites } from "../core/chargement";
import { Audio } from "./audio";
import { base } from "./base";
import { chargerContenuFetch, TABLES } from "./contenu";
import { Entrees } from "./entrees";
import { Partie, stockageLocal } from "./sauvegarde";
import { chargeursScenes } from "./scenes";

// Instrumentation QA : compteurs nets listeners/timers/rAF + écran de chargement
// affiché AVANT toute initialisation (plus d'écran noir muet pendant le boot).
const compteurs = instrumenterFuites();
// Compteur cumulatif de GraphicsContext soldés (preuve de la politique destroy).
const gcStats = { detruits: 0 };
const gcDestroyOriginal = GraphicsContext.prototype.destroy;
GraphicsContext.prototype.destroy = function (...args: any[]) {
  if (!this.destroyed) gcStats.detruits++;
  return gcDestroyOriginal.apply(this, args);
};
const ecran = new EcranChargement();
const params = Object.fromEntries(new URLSearchParams(location.search));
const sceneInitiale = chargeursScenes[params.scene ?? "titre"] ? (params.scene ?? "titre") : "titre";

const ART_CRITIQUE = [
  "pit/pit.json",
  "pit/pit_profil.webp",
  ...["coeur", "coeur_vide", "aile", "etoile", "fiole", "fleche"].map((n) => `hud/${n}.webp`),
];
const ART_PAR_SCENE: Record<string, string[]> = {
  stage: [
    ...["soin", "super_saut", "autoguidage", "pluie_fleches", "bouclier", "vitesse", "eclair", "invisibilite"].map(
      (n) => `hud/pouvoir_${n}.webp`,
    ),
  ],
  titre: ["ui/titre.webp"],
  carte: ["ui/carte_monde.webp", "ui/chaudron.webp"],
  resultats: ["ui/titre.webp"],
  fin: ["ui/titre.webp"],
  vitrine: [],
};

async function demarrer() {
  // Manifeste optionnel (généré par tools/gen-manifeste.mjs) : octets attendus + paliers.
  const manifeste: Record<string, { octets: number; palier: string }> | null = await fetch(
    base + "manifeste.json",
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const prefetch = [...ART_CRITIQUE, ...(ART_PAR_SCENE[sceneInitiale] ?? [])].map(
    (c) => `assets/art/${c}`,
  );
  const tablesAttendues = TABLES.length;
  let tablesFaites = 0,
    prefetchFaits = 0,
    scenePrete = false;
  const totalConnus = tablesAttendues + prefetch.length + 1; // +1 = premier frame rendu

  const stats = instrumenterFetch(base, manifeste, (s) => {
    ecran.maj({
      octets: s.octets,
      paliers: s.paliers,
      manquants: s.manquants,
      detail: scenePrete
        ? "bon vol, Pit."
        : tablesFaites < tablesAttendues
          ? `données du monde… (${tablesFaites}/${tablesAttendues} tables)`
          : prefetchFaits < prefetch.length
            ? `assets critiques… (${prefetchFaits}/${prefetch.length} fichiers, ${s.enCours} en cours)`
            : `préparation de la scène… (${s.enCours} fichiers en cours, décors & ennemis)`,
    });
  });

  // Les webp partent dans les workers pixi (décodage hors thread UI, indispensable
  // au TTI) : leur fetch est invisible du wrapper principal. On solde donc leurs
  // octets via le manifeste à la résolution d'Assets.load, et on rend leurs 404
  // visibles (avertissement écran + stats) au lieu d'une dégradation silencieuse.
  const chargerOriginal = Assets.load.bind(Assets);
  const relatifDe = (url: string) => {
    let chemin: string;
    try {
      chemin = new URL(url, location.href).pathname;
    } catch {
      chemin = url;
    }
    return chemin.startsWith(base) ? chemin.slice(base.length) : chemin.replace(/^\/+/, "");
  };
  (Assets as any).load = (...args: any[]) =>
    chargerOriginal(...args).then(
      (valeur) => {
        const relatif = relatifDe(String(args[0]));
        if (/\.(webp|png|jpg|jpeg|svg)$/.test(relatif) && manifeste?.[relatif] && !stats.dejaComptes.has(relatif)) {
          stats.dejaComptes.add(relatif);
          const p = stats.paliers[manifeste[relatif].palier] ?? stats.paliers.jeu;
          p.octets += manifeste[relatif].octets;
          p.fichiers++;
          stats.octets += manifeste[relatif].octets;
          ecran.maj({ octets: stats.octets, paliers: stats.paliers });
        }
        return valeur;
      },
      (erreur) => {
        const relatif = relatifDe(String(args[0]));
        stats.echecs++;
        stats.manquants.push(relatif);
        ecran.avertissement(relatif);
        throw erreur;
      },
    );

  const echelle = () => Math.min(window.innerWidth / LARGEUR, window.innerHeight / HAUTEUR);
  // Plafond pixel ratio : min(devicePixelRatio, 2) × échelle d'affichage réelle.
  // Le canvas 1920×1080 était rendu plein pot puis rétréci en CSS : on rend
  // directement à la taille affichée (≈ 28 % de pixels en moins sur laptop).
  const resolutionPour = (e: number) =>
    Math.max(0.5, Math.min(2, e * Math.min(window.devicePixelRatio || 1, 2)));

  let app = new Application();
  await app.init({
    width: LARGEUR,
    height: HAUTEUR,
    background: "#07060a",
    // Pixel-art 4× : le MSAA n'apporte rien aux sprites (quads texturés) et
    // coûte un resolve plein écran par frame ; les formes Graphics restent
    // nettes via roundPixels.
    antialias: false,
    roundPixels: true,
    preference: "webgl",
    autoDensity: false,
    powerPreference: "high-performance",
    resolution: resolutionPour(echelle()),
  });
  let hote = document.getElementById("jeu");
  if (!hote) throw Error("#jeu absent");
  hote.appendChild(app.canvas);
  let minuterieResize = 0;
  let facteurResolution = 1;
  const ajuster = () => {
    const e = echelle();
    app.canvas.style.width = `${Math.floor(LARGEUR * e)}px`;
    app.canvas.style.height = `${Math.floor(HAUTEUR * e)}px`;
    const voulue = resolutionPour(e) * facteurResolution;
    if (Math.abs(app.renderer.resolution - voulue) > 0.01) app.renderer.resolution = voulue;
  };
  // Resize débouncé : pas de thrash (resolutionChange réalloue les render targets).
  window.addEventListener("resize", () => {
    window.clearTimeout(minuterieResize);
    minuterieResize = window.setTimeout(ajuster, 120);
  });
  ajuster();

  // Palier critique préchargé en parallèle de l'init renderer : le réseau et
  // la création du contexte WebGL se recouvrent au lieu de se succéder.
  const promessePrefetch = Promise.all(
    prefetch.map((c) =>
      Assets.load(base + c)
        .then(() => {
          prefetchFaits++;
          ecran.maj({ faits: tablesFaites + prefetchFaits + (scenePrete ? 1 : 0), total: totalConnus });
        })
        .catch(() => {
          prefetchFaits++;
          ecran.avertissement(c);
          ecran.maj({ faits: tablesFaites + prefetchFaits + (scenePrete ? 1 : 0), total: totalConnus });
        }),
    ),
  );

  ecran.maj({ phase: "Données du monde", faits: 0, total: totalConnus });
  let contenu = await chargerContenuFetch(base, () => {
    tablesFaites++;
    ecran.maj({
      faits: tablesFaites + prefetchFaits + (scenePrete ? 1 : 0),
      total: totalConnus,
      octets: stats.octets,
    });
  });
  contenu.exigerValide();
  ecran.maj({ phase: "Assets critiques", faits: tablesFaites + prefetchFaits, total: totalConnus });
  await promessePrefetch;

  let partie = new Partie(contenu, stockageLocal),
    audio = new Audio(contenu, {
      base,
      reglages:
        new URLSearchParams(location.search).get("muet") === "1"
          ? { general: 0 }
          : {},
    }),
    reveil = () => {
      audio.demarrer();
    };
  window.addEventListener("pointerdown", reveil);
  window.addEventListener("keydown", reveil);
  let racine = new Container();
  app.stage.addChild(racine);

  // Filet anti-fuite : tout callback ticker ajouté pendant la vie d'une scène
  // lui appartient ; s'il survit au nettoyer() de la scène, on le retire ici.
  // (vitrine.ts ajoute un ticker anonyme sans nettoyer — hors périmètre qa.)
  const tickersScene = new Set<any>();
  const addTicker = app.ticker.add.bind(app.ticker);
  const removeTicker = app.ticker.remove.bind(app.ticker);
  app.ticker.add = ((fn: any, contexte?: any, priorite?: number) => {
    tickersScene.add(fn);
    return addTicker(fn, contexte, priorite);
  }) as typeof app.ticker.add;
  app.ticker.remove = ((fn: any, contexte?: any) => {
    tickersScene.delete(fn);
    return removeTicker(fn, contexte);
  }) as typeof app.ticker.remove;

  // Gouverneur adaptatif : sous charge CPU/GPU (machine partagée, portable
  // modeste), dégrade par paliers le bloom puis la résolution pour tenir 60 fps ;
  // restaure les valeurs d'origine dès que la marge revient. Rien n'est figé :
  // les réglages bloom d'origine sont mémorisés par filtre.
  const PALIERS_GOUVERNEUR: { bloom: [number, number] | null; facteur: number }[] = [
    { bloom: null, facteur: 1 },
    { bloom: [3, 4], facteur: 1 },
    { bloom: [2, 3], facteur: 0.85 },
    { bloom: [1, 2], facteur: 0.7 },
  ];
  let palierGouverneur = 0,
    mauvaisEchantillons = 0,
    bonsEchantillons = 0,
    cooldownGouverneur = 0,
    dernierEchantillon = 0;
  const originauxBloom = new WeakMap<any, [number, number]>();
  const appliquerPalier = () => {
    const p = PALIERS_GOUVERNEUR[palierGouverneur];
    facteurResolution = p.facteur;
    const voulue = resolutionPour(echelle()) * p.facteur;
    if (Math.abs(app.renderer.resolution - voulue) > 0.01) app.renderer.resolution = voulue;
    const regler = (c: any) => {
      for (const f of c.filters ?? []) {
        if (!f || typeof f.quality !== "number" || typeof f.blur !== "number") continue;
        if (!originauxBloom.has(f)) originauxBloom.set(f, [f.quality, f.blur]);
        const [q, b] = p.bloom ?? originauxBloom.get(f)!;
        f.quality = q;
        f.blur = b;
      }
      for (const e of c.children ?? []) regler(e);
    };
    regler(racine);
  };
  addTicker(() => {
    const maintenant = performance.now();
    if (maintenant - dernierEchantillon < 1000) return;
    dernierEchantillon = maintenant;
    if (cooldownGouverneur > 0) {
      cooldownGouverneur--;
      return;
    }
    const fps = app.ticker.FPS;
    if (fps < 54) {
      mauvaisEchantillons++;
      bonsEchantillons = 0;
    } else if (fps > 58) {
      bonsEchantillons++;
      mauvaisEchantillons = 0;
    } else {
      mauvaisEchantillons = 0;
      bonsEchantillons = 0;
    }
    if (mauvaisEchantillons >= 2 && palierGouverneur < PALIERS_GOUVERNEUR.length - 1) {
      palierGouverneur++;
      mauvaisEchantillons = 0;
      cooldownGouverneur = 3;
      appliquerPalier();
    } else if (bonsEchantillons >= 6 && palierGouverneur > 0) {
      palierGouverneur--;
      bonsEchantillons = 0;
      cooldownGouverneur = 3;
      appliquerPalier();
    }
    if ((window as any).__qa)
      (window as any).__qa.gouverneur = { palier: palierGouverneur, fps: +fps.toFixed(1) };
  });

  // Signaux traversant les scènes (l'audio survit aux changements) : les
  // écouteurs branchés pendant la vie d'une scène sont débranchés à sa sortie.
  // Sans ça, le SousTitres détruit d'un stage reçoit le dialogue suivant et
  // crash sur ses textures nulles (fuite observée en cycles de scènes).
  const deconnexionsScene: (() => void)[] = [];
  // Les branchements internes de l'audio (LecteurDialogues, créés à la réveil)
  // sont permanents : ils ne doivent pas être débranchés à la sortie d'une scène.
  let dansAudio = false;
  const demarrerOriginal = audio.demarrer.bind(audio);
  (audio as any).demarrer = (...args: any[]) => {
    dansAudio = true;
    try {
      return demarrerOriginal(...args);
    } finally {
      dansAudio = false;
    }
  };
  for (const cle of ["sousTitre", "sousTitreFini"]) {
    const signal: any = (audio as any)[cle];
    if (!signal?.connecter) continue;
    const connecterOriginal = signal.connecter.bind(signal);
    signal.connecter = (fn: any) => {
      const off = connecterOriginal(fn);
      if (!dansAudio) deconnexionsScene.push(off);
      return off;
    };
    // Garde-fou : un écouteur qui throw (ex. SousTitres détruit d'une scène
    // précédente) est débranché et journalisé au lieu de crasher l'émission.
    const journal: any[] = ((window as any).__qaJournalSignaux ??= []);
    signal.emettre = (...args: any[]) => {
      for (const fn of [...signal.ecouteurs]) {
        try {
          fn(...args);
        } catch (e) {
          journal.push({ cle, erreur: String(e), fn: String(fn).slice(0, 120), n: signal.ecouteurs.length });
          const i = signal.ecouteurs.indexOf(fn);
          if (i >= 0) signal.ecouteurs.splice(i, 1);
        }
      }
    };
  }

  // Les filtres (bloom) ne sont pas détruits par Container.destroy : leurs
  // render targets GPU fuient à chaque changement de scène si on ne les solde pas.
  const detruireFiltres = (conteneur: any) => {
    if (conteneur.filters?.length) {
      for (const f of conteneur.filters) {
        // FiltreBloom possède deux sous-filtres (extract + blur) que son
        // destroy() ne solde pas : on les détruit aussi (Shader.destroy est
        // idempotent et ne touche PAS aux GlProgram cachés/partagés).
        f?._extractFilter?.destroy?.();
        f?._blurFilter?.destroy?.();
        f?.destroy?.();
      }
      conteneur.filters = null;
    }
    for (const enfant of conteneur.children ?? []) detruireFiltres(enfant);
  };

  // Politique de destroy complète. Fuite réelle : Graphics.destroy(options)
  // ne détruit son contexte QUE si options est falsy ou {context:true} —
  // l'ancien destroy({children:true}) passait un objet truthy → chaque
  // GraphicsContext (instructions JS + batches GPU) fuyait à chaque scène.
  // Text : pixi 8.21 rend ses textures canvas via un pool à compteurs de
  // références (getManagedTexture/onTextUnload) ; destroy() les solde via
  // unload(), et les options texture explicites sont sans danger (ignorées
  // par AbstractText, jamais de texture partagée détruite). Les textures
  // d'Assets et le cache canvas de render/textures.ts restent intacts :
  // destroy() sans option texture ne les touche pas → rechargement sûr.
  const detruireArbre = (c: any) => {
    for (const enfant of [...(c.children ?? [])]) detruireArbre(enfant);
    if (c instanceof Text) {
      c.destroy({ texture: true, textureSource: true });
      return;
    }
    if (c instanceof Graphics && c.context && !c.context.destroyed) c.context.destroy();
    c.destroy();
  };

  let nettoyer: any,
    chaine = Promise.resolve(),
    premierLancer = true,
    contexte = {
      app,
      contenu,
      audio,
      partie,
      racine,
      entrees: new Entrees(app.canvas),
      allerA(scene: string, options: any = {}) {
        chaine = chaine
          .then(async () => {
            nettoyer?.();
            for (const fn of tickersScene) removeTicker(fn);
            tickersScene.clear();
            for (const off of deconnexionsScene) off();
            deconnexionsScene.length = 0;
            audio.taireDialogues();
            detruireFiltres(racine);
            for (let enfant of racine.removeChildren()) detruireArbre(enfant);
            nettoyer = await (await chargeursScenes[scene]()).lancer(contexte, options);
            if (premierLancer) {
              premierLancer = false;
              // TTI = premier frame de jeu réellement rendu après le lancer.
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
              scenePrete = true;
              (window as any).__qa.tti = Math.round(performance.now());
              ecran.maj({
                phase: "Prêt",
                faits: totalConnus,
                total: totalConnus,
                octets: stats.octets,
              });
              await ecran.terminer();
            }
            if (scene === "resultats") prefetchStageSuivant(partie);
          })
          .catch((e) => {
            console.error(e);
            (window as any).__erreur = String(e);
            ecran.erreur(
              `${String(e)}\n\nAssets manquants : ${stats.manquants.length ? stats.manquants.join(", ") : "aucun détecté par le fetch"}`,
            );
          });
      },
    };

  // Prefetch du stage suivant pendant les résultats (palier jeu, en idle).
  function prefetchStageSuivant(partieCourante: any) {
    window.setTimeout(async () => {
      try {
        const ordre: string[] = partieCourante.ordreStages();
        const idx = ordre.indexOf(partieCourante.stageDemande);
        const suivant = idx >= 0 ? ordre[idx + 1] : undefined;
        if (!suivant) return;
        const niveau = await fetch(`${base}levels/${suivant}/stage.json`).then((r) =>
          r.ok ? r.json() : null,
        );
        if (!niveau) return;
        const monde = await import("../scenes/stage/monde");
        await monde.chargerDecor(String(niveau.ambiance ?? "")).catch(() => null);
        if (niveau.boss)
          await Assets.load(`${base}assets/art/boss/${niveau.boss}/${niveau.boss}.json`).catch(
            () => null,
          );
      } catch {
        /* prefetch opportuniste : jamais bloquant */
      }
    }, 600);
  }

  (window as any).__qa = {
    tti: null,
    stats,
    Assets,
    allerA: (scene: string, options: any = {}) => contexte.allerA(scene, options),
    get app() {
      return app;
    },
    get audio() {
      return audio;
    },
    get scene() {
      return sceneInitiale;
    },
    compteurs: () => ({
      ...compteurs(),
      tickers: app.ticker.count,
      graphicsContextsDetruits: gcStats.detruits,
      fetch: { demarres: stats.demarres, finis: stats.finis, echecs: stats.echecs, enCours: stats.enCours },
    }),
    // Recensement des objets vivants de la scène (preuve anti-accumulation).
    census: () => {
      const c = { conteneurs: 0, graphics: 0, text: 0, sprites: 0 };
      const parcourir = (n: any) => {
        c.conteneurs++;
        if (n instanceof Graphics) c.graphics++;
        if (n instanceof Text) c.text++;
        if (n instanceof Sprite) c.sprites++;
        for (const e of n.children ?? []) parcourir(e);
      };
      parcourir(racine);
      return c;
    },
  };

  contexte.allerA(sceneInitiale, params);
}

demarrer().catch((e) => {
  console.error(e);
  (window as any).__erreur = String(e);
  ecran.erreur(String(e));
});