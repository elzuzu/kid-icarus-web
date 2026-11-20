# REPORT — module ui (hud + menu)

## Fichiers
- `hud.ts` : classe Hud + ré-exports des alias (point d'entrée).
- `niveau.ts` : enum TypeTuile, classe Niveau, parsing/chargement des chunks.
- `terrain.ts` : construction visuelle du sol (blocs, bords, ombres, plateformes).
- `filtres.ts` : port fidèle des filtres du bundle (voir hypothèses).
- `menu.ts` : classe Menu (navigation boutons clavier/manette).

## Rôle des exports (alias préservés)
| Alias | Bundle | Nom source | Rôle |
|---|---|---|---|
| hud `a` | G | TypeTuile | enum tuiles (VIDE…GRILLE) |
| hud `c` | y | AnimatedSprite | classe pixi 8.8.0 inlinée → ré-export `pixi.js` |
| hud `i` | Y | construireNiveau | (definition, chunks) → {niveau, erreurs} |
| hud `n` | ae | construireSol | (niveau, kit, l0, l1) → Container terrain |
| hud `o` | W | AdvancedBloomFilter | filtre bloom (stage/vitrine : `new p({…})`) |
| hud `r` | ie | chargerNiveau | async (chemin, lireTexte) → Niveau |
| hud `s` | x | TilingSprite | classe pixi 8.8.0 inlinée → ré-export `pixi.js` |
| hud `t` | se | Hud | PV cœurs, jauge vol, 2 pouvoirs + fioles, touches |
| menu `t` | r | Menu | boutons actif/selectionne/dessiner/action, pas(dt, entree) |

## Renommages principaux
q→Niveau, J→lignesChunk, X→assemblerVertical, re→assemblerHorizontal,
Z→segmentsTuiles, Q→estPlein, oe→construirePlateforme, $→police,
K→caracteres, t(0.35)→delaiInitial, n(0.11)→delaiRepeat.
Imports : core `n`→largeurEcran (=1920, vérifié dans unites), textures `o`→Text
(classe Text pixi ré-exportée par render/textures, vérifié).

## Hypothèses pixi
- AnimatedSprite/TilingSprite : code pixi core inliné par rollup → ré-export
  direct depuis `pixi.js` (comportement identique, zéro réimplémentation).
- KawaseBlur/ExtractBrightness/AdvancedBloom = pixi-filters, ABSENT de
  package.json → portés à l'identique dans `filtres.ts` via l'API publique
  (Filter, GlProgram, GpuProgram, Texture, TexturePool, deprecation).
  `u` (getSameSizeTexture/returnTexture) = TexturePool ; `m` = Filter ;
  `r` = GpuProgram ; `n` = GlProgram ; `e(t,…)` = deprecation(version, msg).
- Champs de classe : initializers TS (useDefineForClassFields:false) = même
  ordre qu'esbuild (après super()). DEFAULT_OPTIONS.pixelSize partagé par
  référence, comme dans le bundle (mutation possible via setters).

## Zones incertaines / déviations
- `import "../app"` (hud) et `import "../core"` (menu) : imports d'effet de
  bord du bundle conservés (ordre d'exécution ; pas de cycle, index n'importe
  pas hud statiquement).
- Espaces de fin de ligne dans les shaders GLSL/WGSL normalisés (sans effet
  sur la compilation des shaders).
- Littéraux couleurs gardés en décimal, valeurs et opérateurs identiques.
- Aucune autre déviation : logique, textes d'erreur et géométrie copiés tels quels.