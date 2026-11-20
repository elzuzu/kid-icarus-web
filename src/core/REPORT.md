# REPORT — module core (unites-BgaM9hDp.js)

## Nature du bundle
L1–1167 = code interne pixi (CanvasTextSystem/Pipe, pipes ParticleContainer,
extensions d'environnement browser/webworker) + helper Vite, tree-shakés dans ce
chunk. Seuls B et N sont exportés depuis cette partie. En source, `import "pixi.js"`
(8.8.0) enregistre lui-même systèmes/pipes/environnements : non portés (règle 3).
Le code jeu réel est L1168–1260 (hash, RNG, graines, constantes).

## Renommages (minifié → nom)
| Minifié | Nom | Fichier | Rôle |
|---|---|---|---|
| ye | hacherGraine | alea.ts | hash cyrb128 (4×u32) |
| Q (alias r) | Flux | alea.ts | RNG sfc32 seedé (randi/randf/randiRange/randfRange/randfn/choisir/indicePondere/melanger) |
| $ (alias i) | Graines | graines.ts | fabrique de Flux par graine (`graine="partie"`, `flux(nom,extra)`, static `graineDuJour`) |
| be (alias n) | largeurReference | constantes.ts | 1920 |
| xe (alias t) | hauteurReference | constantes.ts | 1080 |
| N (alias o) | prechargerModule | preload.ts | helper `__vitePreload` (deps + événement `vite:preloadError`) |
| B (alias a) | generateurTexteCanvas | texteCanvas.ts | singleton générateur de texte canvas pixi |
| P/F | canvasMesure/contexteMesure | texteCanvas.ts | canvas 2D singleton de trim |
| oe / I / L / se | preparerCanvasMesure / ligneVide / colonneVide / rognerCanvas | texteCanvas.ts | trim alpha |
| z / R | compterEspaces / cadreTrim | texteCanvas.ts | justify / Rectangle partagé |

## Hypothèses pixi (imports de B, tous vérifiés présents dans pixi.js 8.8.0)
- CanvasPool (h), CanvasTextMetrics (O), Color (i), DOMAdapter (l), Rectangle (t),
  fontStringFromTextStyle (k), getCanvasFillStyle (j), nextPow2 (d).
- TODO-pixi: B = `canvasTextGenerator` de pixi >= 8.10 (strings de dépréciation
  « 8.10.0 » dans le bundle ; le build original utilisait un pixi plus récent que
  8.8.0). Absent de l'API publique 8.8.0 → porté à l'identique dans texteCanvas.ts.
  `TextStyle._getFinalPadding()` n'existe pas en 8.8.0 (appel non gardé → crash si
  B est réellement appelé avec un TextStyle 8.8.0) ; `_gradientBounds`,
  `_gradientOffset`, `runsByLine` absents mais gardés par truthiness (chemins
  inertes). `getCanvasFillStyle` 8.8.0 a 4 params : les offsets (args 5-7) sont
  ignorés → cast any. Si l'intégration monte pixi >= 8.10, remplacer texteCanvas.ts
  par l'export public `canvasTextGenerator`.
- Consommation réelle de `a` : uniquement textures (classe Text pixi, updateBounds
  avec trim) — probablement remplacée par le Text public côté render/textures,
  donc B peut rester inerte au runtime.

## Zones incertaines / déviations
- `new Graines();` (L1258) : instantiation au résultat jeté, reproduite telle quelle.
- prechargerModule : logique complète du helper conservée (liens modulepreload/CSS,
  nonce CSP, `vite:preloadError`), base `/kid-icarus-web/` → `import.meta.env.BASE_URL`.
  En source les callers ne passent plus de deps (mapDeps supprimé, règle 4) → seule
  la chaîne `Promise.resolve().then(importer().catch(...))` est active.
- `import.meta.resolve` accédé via cast any (non typé par vite/client).
- Classe anonyme de B nommée GenerateurTexteCanvas (seul `.name` diffère).
- Aucune autre déviation : opérateurs comma du bundle convertis en statements
  séquencés (ordre d'évaluation identique), chaînes et constantes numériques intactes.