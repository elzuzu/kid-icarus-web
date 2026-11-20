# Rapport — module app (index-B7iqobnr.js)

## Périmètre
- L1–3441 du bundle = internes pixi 8 (Application, autoDetectRenderer, FederatedEvents,
  EventSystem, FilterSystem, TilingSprite, NineSliceSprite, MeshGeometry) + polyfill
  modulepreload Vite : NON portés, remplacés par l'API publique `pixi.js`.
- L3442–5934 = code jeu, porté fidèlement. `__vite__mapDeps` et le wrapper de preload
  `x(...)` (alias `o` de core = `__vitePreload`) supprimés ; imports dynamiques de scènes
  → `../scenes/<nom>` (stage → `../scenes/stage`).

## Correspondance des 30 exports (alias = symbole bundle → nom source)
A=j→base (import.meta.env.BASE_URL) · C=Kn→borner · D=fn→sfxProjectile · E=Un→effacerPresses
O=Rt→Signal · S=Q→arrondi · T=Hn→fusionnerEntrees · _=Zn→creerArme · a=Er→multCoeursIntensite
b=tr→puissanceArme · c=fr→gagnerXp · d=hr→basculerRelique · f=br→effetsJoueur
g=ir→fusionnerArmes · h=xr→pvMax · i=Sr→miseStage · k=ge→FederatedEvent (pixi.js)
l=pr→armeEquipee · m=yr→pouvoirsActifs · n=wr→multDegatsIntensite · o=Cr→multPvIntensite
p=vr→placerPouvoir · r=Dr→gainStage · s=mr→ajouterArme · t=Tr→chanceElite · u=gr→tailleGrille
v=rr→nomArme · w=Vn→EtatEntrees · x=Jn→Effets · y=er→statsArme

## Renommages internes principaux
R→Rampe · Ft→BusAudio · Lt→ChargeurAudio · It→lireAudio · z→urlRessource
qt→FileDialogues · Jt→LecteurDialogues · cn→LecteurMusique · hn→ReglesSfx · gn→LecteurSfx
vn→Audio · Rn→Contenu · zn/Bn→chargerContenu/chargerContenuFetch · Pn→SCHEMAS
Gn→Entrees (méthode t→touche) · Jn→Effets · Pr→Partie · kr→stockageLocal · Nr→calculerRang
Fr→migrerProfil · Ir→chargeursScenes · Lr→demarrer (bootstrap, side-effect conservé)
S(core r)→Flux · ne(core i)→Graines · b/C(core n/t)→LARGEUR/HAUTEUR

## Hypothèses pixi
- `Te` = Application (init avec preference:"webgl", antialias, autoDensity:false,
  background:"#07060a", width/height 1920×1080 via core) — autoDetectRenderer public
  reproduit l'ordre webgl→webgpu→canvas du bundle.
- `D` = Container (racine de scène), `ge` = FederatedEvent (export k, utilisé par hud/vitrine).
- Aucun TODO-pixi : tous les symboles pixi du code jeu sont identifiés sans ambiguïté.

## Zones incertaines / notes
- `migrerProfil` (Fr) : boucle vide `for(;v<VERSION;)v++` reproduite telle quelle (no-op).
- `calculerRang` : 5e param nommé `vie` (hypothèse : fraction de PV restants, seuil 0.5).
- Noms des multiplicateurs d'intensite (o/n/t/a) déduits des usages dans stage/carte.
- `typeof AudioContext > "u"` (artefact minification) → `=== "undefined"` (équivalent strict).
- Deux fonctions identiques de clamp 0..1 (Mt, $t) conservées séparément (borner01 ×2).
- Hooks debug : `window.__erreur` (2 catch) et params URL `?scene=…`, `muet=1` préservés.
  Pas de `window.__sim` dans ce bundle (hors périmètre).
- Chaîne d'erreur « à déclarer dans src/core/contenu.ts » conservée verbatim malgré le
  déplacement du code dans app/contenu.ts.
- Aucune déviation de comportement known. Fichiers : base, signal, nombres, audio/{base,
  dialogues,musique,sfx,index}, contenu, entrees, effets, armes, progression, sauvegarde,
  scenes, bootstrap, index.