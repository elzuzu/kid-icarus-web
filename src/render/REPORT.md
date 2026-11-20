# REPORT — src/render (textures.ts, theme.ts)

## Rôle des exports
textures.ts : `a`=Particle (pixi), `i`=ParticleContainer (pixi), `o`=Text (pixi),
`n`=textureTache (blob radial blanc, cache `tache:<taille>`), `r`=textureVignette
(480×270, cache `vig:<opacite>`), `t`=textureDegrade (4×hauteur, cache `deg:…`).
theme.ts : `a`=dessinerPanneau, `c`=ChampParticules (système d'ambiance, export sans
alias dans le bundle), `i`=nombreFr (toFixed + virgule), `n`=OR (15255672),
`o`=styleTexte, `r`=BRONZE (9071150), `s`=styleTitre, `t`=Bouton.

## Renommages principaux
| Bundle | Source |
|---|---|
| textures: E (Map) | cacheTextures |
| textures: D / O / k | textureTache / textureVignette / textureDegrade |
| theme: s (presets) | presetsParticules (+ interface ReglesParticules) |
| theme: c | ChampParticules ; champ `r` → `regles` (interne, vérifié sans accès externe) |
| theme: c.nouvelle / mettreAJour | inchangés ; record {p,vx,vy,vie,duree,phase} → ParticuleAmbiante |
| theme: u / d / f / p / m | POLICE_TITRE / POLICE_TEXTE / OR / BRONZE / CREME |
| theme: l / h / g / _ / v | nombreFr / styleTitre / styleTexte / dessinerPanneau / Bouton |

Champs de classes conservés tels quels (contrat runtime vérifié dans menu/titre/scènes :
`.actif`, `.action`, `.selectionne`, `.dessiner()`, `.largeur`, `.mettreAJour`, `.liste`…).
Valeurs numériques (couleurs décimales, tailles, alphas) reproduites à l'identique.

## Hypothèses pixi / VERSION CRITIQUE
Les classes h/y (AbstractText/Text), b (Particle), w (ParticleContainer) du bundle sont
le code pixi inliné par Vite → ré-exportées depuis "pixi.js" (règle 3), pas réimplémentées.
**Le bundle ne correspond PAS à pixi 8.8.0** (version épinglée dans package.json) :
- Text du bundle : `textureStyle`, `autoGenerateMipmaps`, branche `trim` dans updateBounds,
  warning `warnIgnoredTextureStyle` → absents de 8.8.0, présents à partir de ~8.17/8.21.
- Particle.tint du bundle : toujours `Color.shared.setValue(...).toBgrNumber()` ; 8.8.0 a
  un fast-path numérique (`this._tint = value`) qui change le comportement couleur.
- Comparaison faite avec les sources npm : correspondance exacte avec **pixi.js 8.21.0**
  (Text.mjs, AbstractText.mjs dont `destroy` met `owner=null`, Particle.mjs,
  ParticleContainer.mjs, warnIgnoredTextureStyle.mjs). 8.22/8.23 non vérifiées en détail.
→ L'orchestrateur doit monter pixi.js à ≥8.21.0 (latest 8.23.0) pour l'équivalence.
Autres symboles lib identifiés par usage : Filter.l=Container, CanvasRenderer.n=Graphics,
BitmapFont.n=TextStyle, CanvasPool.w=Texture. Aucun TODO-pixi restant.

## Notes
- Contrairement à l'intuition de la consigne, AUCUN chargement d'atlas ni chemin d'asset
  dans ces bundles : textures procédurales (canvas 2d) uniquement. Pas de BASE_URL ici.
- `import { a as c } from unites` (CanvasTextGenerator) dans textures : inutile après
  ré-export pixi ; `r` de core = Flux (RNG xoshiro, vérifié dans unites L1192-1256).
- `(i.scaleX = (n.etire, a))` (opérateur virgule du minifieur) → `p.scaleX = taille` :
  strictement équivalent. Séquences virgules du bundle déroulées en instructions.
- Chaînes backticks du bundle conservées ; message `canvas 2d indisponible` identique.
- Déviations de comportement : aucune (hors écart de version pixi signalé ci-dessus).