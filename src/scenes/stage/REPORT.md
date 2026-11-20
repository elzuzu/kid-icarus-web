# REPORT — port de la scène `stage`

Source : `/tmp/kiw-analysis/stage-C0W5OC1f.js` (8082 lignes, lu en entier).
Entry : `index.ts` exporte `lancer` (`Yr as lancer`). Hook `window.__sim = sim` préservé
à l'identique (même objet Simulation), params `?scene=stage&debug=1` (hitboxes) préservés.

## Structure (27 fichiers, ordre de dépendance)
- `base.ts` : `base = import.meta.env.BASE_URL` (remplace `_` du bundle).
- `corps.ts` (Corps), `combat.ts` (Element, Coup, Camp, Combattant, Projectile, Combat),
  `effets.ts` (EffetsCombat), `monde.ts` (chargerDecor, Monde), `visuelEnnemi.ts`.
- `joueur.ts` (PhysiqueJoueur, ReglagesJoueur, EtatJoueur), `arme.ts` (ArmeJoueur),
  `visuelJoueur.ts`, `visuelProjectile.ts` (VisuelsProjectiles).
- `ennemi.ts`, `comportements.ts` (18 comportements + `brancherEconomie`), `camera.ts`,
  `apparitions.ts`, `boss.ts` (CerveauBoss + 14 cerveaux, Boss), `elements.ts` (ElementsStage).
- `simulation.ts` (Simulation), `hudStage.ts` (BarreBoss, SousTitres, Annonces, MenuPause),
  `recompenses.ts` (Coeur, ArmeSol, Objet, Recompenses), `progression.ts` (Progression,
  creerProgression + helpers elites internes), `offres.ts`, `chambres.ts` (Forge, Chambre,
  GestionChambres, creerGestionChambres), `pouvoirs.ts`, `objets.ts` (VisuelObjets),
  `audio.ts` (brancherAudio), `flammes.ts`, `index.ts` (lancer).

## Renommages notables (bundle → TS)
- `Pn`→Simulation, `Xe`→PhysiqueJoueur, `jt`→ReglagesJoueur, `et`→ArmeJoueur, `Be`→Combat,
  `A`→Combattant, `je`→Coup, `k`→Camp, `O`→Element, `Le`→Projectile, `It`→Camera, `U`→ModeCamera,
  `Ut`→Apparitions, `ft`→Ennemi, `Sn`→Boss, `Dn`→ElementsStage, `lr`→Progression, `ur`→creerProgression,
  `rr`→Recompenses, `jr`→Chambre, `Mr`→GestionChambres, `Ar`→Forge, `Pr`→Pouvoirs, `Br`→VisuelObjets,
  `Rn`→BarreBoss, `Bn`→SousTitres, `Vn`→Annonces, `Hn`→MenuPause, `Kr`→Flammes, `Vr`→brancherAudio.
- `Comportement.p`→`param`, static `t`→`tuiles` (internes uniquement).
- `creerGestionChambres(stage, contenu, eco)` : ordre d'arguments du bundle `Nr(e,t,n)→new Mr(e,n,t)`
  conservé tel quel.
- Alias d'imports externes conservés (`O as Signal`, `r as Flux`, `a as Tuile`, `w as Intention`,
  `S as arrondi`, `C as borner`, etc.) conformément à COORDINATION.md.

## Hypothèses pixi / wrappers
- Chunks bibliothèque → `pixi.js` : Filter `l`→Container, `s`→Sprite ; CanvasRenderer `n`→Graphics ;
  Assets `t`→Assets ; BitmapFont `n`→TextStyle (utilisé comme `new TextStyle({...})`).
- Wrappers hud : `c`→SpriteAnime, `s`→SpriteTuile, `o`→FiltreBloom, `n`→renduTuiles, `i`→construireNiveau,
  `r`→chargerNiveau, `t`→Hud. textures : `o`→Texte, `n`→textureHalo, `r`→textureVignette, `t`→textureDegrade.
- Aucun TODO-pixi nécessaire : tous les symboles résolus.

## Zones d'incertitude / omissions volontaires
- Import CanvasPool (`L as e, w as t`) : aucun usage trouvé dans le corps du bundle ; omit.
- No-ops `Object.keys(Ot);` / `Object.keys(bn);` et l'objet `Object.freeze({base:14,…eau…})` jeté
  dans la section boss : statements sans effet, omis (le freeze des presets utiles est conservé).
- `Comportement` de base n'a pas de `simuler` dans le bundle ; `Ennemi.comportement` typé `any`.
- Chaînes minifiées à virgules/&& converties en statements séquentiels équivalents (ordre
  d'évaluation et court-circuits préservés, vérifiés cas par cas : Combat.renvoyer/toucher,
  patrouilleur, Boss.verifierPhase, boucle ticker de `lancer`).
- Données runtime (physique joueur, ennemis, boss, niveaux, décors) : aucun valeur recodée en dur,
  chemins `assets/art/…`, `data/…`, `levels/…` concaténés exactement comme le bundle.
- Vérifications : syntaxe TS valide (node --check strip-types, 27/27), imports internes et alias
  externes validés par script. Pas de build/npm lancé.