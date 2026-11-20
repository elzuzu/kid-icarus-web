# COORDINATION — Reconstruction du source Kid Icarus

## Mission
Reconstruire le source TypeScript perdu à partir des bundles Vite minifiés (build du repo
`~/Developer/kid-icarus-web`). **Port fidèle : ZÉRO changement de comportement.**
On ne refactorise pas, on ne « améliore » rien, on ne corrige aucun bug apparent.
Les améliorations viendront dans un second temps, après vérification d'équivalence.

## Sources de référence (lecture seule, ne JAMAIS modifier)
- Bundles formatés (lisibles, identifiants français conservés) : `/tmp/kiw-analysis/*.js`
- Build original + assets + données : `~/Developer/kid-icarus-web/`
- Chaque agent ne modifie QUE son répertoire assigné dans `~/Developer/kid-icarus-src/src/`.

## Table des modules (bundle → source)
| Bundle formaté | Module source | Exports (alias à préserver EXACTEMENT) |
|---|---|---|
| `unites-BgaM9hDp.js` | `src/core/index.ts` | `a, i, n, o, r, t` |
| `index-B7iqobnr.js` | `src/app/index.ts` | `A, C, D, E, O, S, T, _, a, b, c, d, f, g, h, i, k, l, m, n, o, p, r, s, t, u, v, w, x, y` |
| `textures-D1yxMr3f.js` | `src/render/textures.ts` | `a, i, n, o, r, t` |
| `theme-bw901_YC.js` | `src/render/theme.ts` | `a, c, i, n, o, r, s, t` |
| `hud-9m1pTS6w.js` | `src/ui/hud.ts` | `a, c, i, n, o, r, s, t` |
| `menu-CAY8ALrk.js` | `src/ui/menu.ts` | `t` |
| `stage-C0W5OC1f.js` | `src/scenes/stage/index.ts` | `lancer` |
| `carte-DEvBm0CQ.js` | `src/scenes/carte.ts` | `lancer` |
| `titre-pwV6zi8h.js` | `src/scenes/titre.ts` | `lancer` |
| `vitrine-D26A5z9H.js` | `src/scenes/vitrine.ts` | `lancer` |
| `resultats-Db6ND_vw.js` | `src/scenes/resultats.ts` | `lancer` |
| `fin-fQzWhzBQ.js` | `src/scenes/fin.ts` | `lancer` |
| tous les autres chunks | bibliothèque `pixi.js` v8.8.0 (npm) | — |

## Règles impératives
1. **Exports alias** : chaque module ré-exporte ses symboles sous les alias lettre listés
   ci-dessus (ex. core : `export { B as a, $ as i, be as n, N as o, Q as r, xe as t }`
   devient `export { registre as a, ... }` — les NOMS INTERNES changent, les ALIAS restent).
   C'est le contrat inter-modules : les imports des autres modules utilisent ces lettres.
2. **Imports inter-modules** : reproduire les imports du bundle en pointant vers la table
   ci-dessus. Exemple : `import { a as B } from "./unites-BgaM9hDp.js"` →
   `import { a as B } from "../core"`. Garder les noms locaux minifiés importés si leur
   rôle n'est pas certain, les renommer sinon (le renom local est libre).
3. **Pixi** : les chunks bibliothèque sont pixi.js 8.8.0. Identifier chaque symbole minifié
   importé depuis un chunk lib par son usage (`new X()` conteneur → Container, X.from →
   Texture.from, Graphics, Text, TextStyle, Assets, Ticker, Rectangle, Point, Color,
   FillGradient, BlurFilter, ColorMatrixFilter, Sprite, CanvasTexture, RenderTexture…).
   Importer depuis `"pixi.js"`. Si un symbole est ambigu : meilleure hypothèse +
   commentaire `// TODO-pixi: <symbole> <hypothèse>` (l'intégration tranchera).
   NE PAS réimplémenter du code pixi interne (renderer, pools, etc.) : utiliser l'API publique.
   Le code de sélection de renderer dans index (~L239-276) est probablement
   `autoDetectRenderer` de pixi : le remplacer par l'API pixi équivalente si c'est le cas.
4. **Imports dynamiques de scènes** (index ~L5800-5833) : `import("./titre-…")` →
   `import("../scenes/titre")`, idem carte/stage/resultats/fin/vitrine.
   Supprimer `__vite__mapDeps` (helper de preload Vite, inutile en source).
5. **Base path** : les bundles préfixent les URLs d'assets par une constante base
   `/kid-icarus-web/`. En source : `import.meta.env.BASE_URL` (vite.config base identique).
   Préserver la concaténation exacte des chemins (`assets/art/...`, `data/...`, `levels/...`).
6. **Hooks debug** : `window.__sim`, `window.__erreur`, params URL `?scene=…&debug=1`
   doivent être préservés à l'identique (mêmes noms, mêmes structures exposées).
7. **Français** : identifiants internes en français (les bundles le sont déjà largement :
   joueur, combat, camera, secouer, melee…). Noms de classes lisibles
   (ex. stage : Ae→Monde, Pe→EffetsCombat, Ie→VisuelEnnemi, at→VisuelJoueur,
   Xe→PhysiqueJoueur, It→Camera, lt→VisuelProjectile — vérifier le rôle avant de nommer).
8. **TypeScript pragmatique** : strict=false. Typer ce qui est évident (interfaces des
   données JSON, états), `any` assumé ailleurs. La fidélité prime sur le typage.
   `useDefineForClassFields: false` (déjà dans tsconfig) — NE PAS convertir les champs
   de classe en initialisations constructor si le bundle les déclare autrement.
9. **Pas de commentaires** sauf WHY non-évident et `TODO-pixi`. Pas de docstrings.
10. **Données runtime** : les JSON de `data/` et `levels/` sont chargés par fetch —
    préserver chemins et logique de chargement. Ne pas importer les JSON en dur.
11. **Découpage interne libre** : un agent peut découper son module en plusieurs fichiers
    tant que le point d'entrée de la table ré-exporte les bons alias. Écrire
    incrémentalement (un fichier à la fois) pour les gros modules.
12. **Rapport** : à la fin, écrire `REPORT.md` dans son répertoire : table des renommages
    principaux (minifié→nom), hypothèses pixi/TODO, zones incertaines, déviations (aucune
    normalement). 50 lignes max.

## Vérification (ne pas lancer soi-même)
L'orchestrateur fera : `npm install`, `vite build`, puis tests d'équivalence en navigateur
(hooks `__sim`, mesures physique/dégâts, captures). Ne pas lancer de build ni de serveur.
Ne pas toucher à `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`.

## Contexte jeu (aide à la compréhension)
Remake fan de Kid Icarus (NES) en PixiJS 8 : platformer vertical + RPG.
Moveset Celeste-like (coyote, buffer, apex gravity), caméra 5 modes dont rail vertical,
42 ennemis / 14 boss, combo mêlée 3 coups, tir chargé, dash à i-frames, pouvoirs grille
Tetris, reliques/affixes. Scènes : titre, carte (monde), stage (gameplay), vitrine
(inventaire/pouvoirs), resultats, fin. HUD : PV, jauge vol, pouvoirs, dialogue.