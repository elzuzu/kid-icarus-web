# REPORT — scènes secondaires (carte, titre, vitrine, resultats, fin)

Port fidèle des 5 bundles ; alias `lancer` préservé (`export { lancer }`).
Aucune déviation de comportement connue. Séquences virgules du bundle réécrites
en instructions équivalentes (même ordre d'évaluation) ; `&&=` de carte converti
en `if` équivalent.

## Pixi (chunks bibliothèque → "pixi.js", identifiés par usage, aucun TODO-pixi)
- Filter-CTLKor2l `l`→Container, `s`→Sprite (vérifié dans les chunks du build).
- CanvasRenderer `n`→Graphics ; Assets `t`→Assets (singleton) ;
  CanvasPool `L`→Rectangle, `w`→Texture (vitrine : frame chaînes + Texture.from).
- Text, Particle, ParticleContainer, AnimatedSprite, TilingSprite, filtre bloom :
  importés via les modules source (textures `o/a/i`, hud `c/s/o`) comme le bundle,
  pas directement depuis pixi.js. Le bloom (`hud o`) est un AdvancedBloomFilter
  reconstruit par l'agent hud ; hypothèse : options threshold/bloomScale/
  brightness/blur/quality identiques.

## Base path
`A` (app, `/kid-icarus-web/`) remplacé par `const base = import.meta.env.BASE_URL`
dans carte/titre/vitrine/fin ; import `A` supprimé (seul usage). Chemins exacts
préservés (assets/art/ui|decors, levels/w1/1-1/stage.json, pit/pit.json, ?image=).

## Renommages principaux (minifié → source)
- carte : `_`→positionsNoeuds, `ae`→etapesChemins, `oe`→couleursMondes,
  `R`→selectionner, `q`→rafraichirChaudron, `J`→ouvrirChaudron, `Y`→partir,
  `K`→intensite, `L`→selection, `$`→pas ; app `i/n/o/r/t`→coutIntensite/
  multiplicateurDegats/multiplicateurPV/gainIntensite/probabiliteElites (vérifié).
- titre : `m`→chargerFond, `D`→ajouterBouton, `O`→menu (ui/menu `t`), `j`→pas.
- vitrine : `te`→Braises, `re`→Fleche, `ne`→douillePour, `b`→textureFleche
  (cache `y`→texFlecheCache), `S`→chargerImage, `d`→chargerNiveau (hud `r`),
  `l`→construireTuiles (hud `n`), `H`→creerAnimation, `ge`→tirerFleche ;
  16 textures destructurées renommées (texPitProfil chargée mais inutilisée,
  comme le bundle — conservée).
- resultats : `f`→couleursRang, `_`→resultat, `C`→blocRang, `k`→pas.
- fin : `d`→textesFin, `_`→variante, `D`→pas.
- core `n/t`→largeur/hauteur (1920/1080), `r`→Flux ; theme `a/c/i/n/o/r/s/t`→
  dessinerPanneau/CoucheParticules/formatNombre/couleurOr/styleTexte/
  couleurBronze/styleTitre/Bouton (vérifié dans le bundle theme).

## Zones incertaines
- Typage : ContexteScene local par fichier (app/partie/audio/entrees en `any`),
  niveau/atlas vitrine en `any` ; interfaces Braise/Etincelle ajoutées.
- vitrine : pas de cleanup retourné (ticker jamais retiré) — fidèle au bundle.
- `useDefineForClassFields:false` : champs de Braises/Fleche déclarés comme le
  bundle (initialiseurs de classe conservés, pas déplacés en constructor).
- Contrats attendus des autres agents : hud `afficher({pv,pvMax,vol,monnaie,
  pouvoirs,manette,fioles})`, theme Bouton(libelle,460,64,action)+`.actif/.largeur`,
  Menu(boutons)+`.pas(dt,entrees)`, CoucheParticules(tex,type,l,h,n)+`.mettreAJour`.