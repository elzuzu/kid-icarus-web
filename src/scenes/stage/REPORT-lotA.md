# Lot A — game feel (6 fichiers, additif et gated)

## 1. Hitstop global (`combat.ts`, `index.ts`)
- `Combat.gelGlobal` (secondes) + `geler(duree)` qui prend le max et respecte `options.hitstop`.
 Distinct de `gelTicks` (micro-gel par coup, inchangé).
- Déclencheurs : `combattantMort` ennemi → 70 ms ; `coupPorte` avec `coup.critique` sur ennemi → 45 ms ;
  `bossVaincuSignal` (index.ts) → 120 ms. Pas de gel sur dégâts subis ni jarres (NEUTRE).
- Boucle index.ts : tant que `gelGlobal > 0`, décrément en dt réel, `sim.tick` sauté,
  accumulateur purgé (pas de rafale de rattrapage), rendu/effets continuent. `window.__sim` intact.

## 2. Shake proportionnel (`camera.ts`, `index.ts`)
- `Camera.secouer` ignore si `options.secousses = false` (gate centralisé, trauma²×14 inchangé).
- index.ts : mort ennemi → 0.25 ; `explosionSignal` → 0.3 ; mort de boss → 0.5.
- Phase de secousse sur horloge réelle (`horlogeSecousse`) au lieu de `sim.temps` :
  la vibration continue pendant le hitstop. Rail caméra inchangé.

## 3. Mêlée visible (`joueur.ts`, `effets.ts`, `index.ts`)
- `melee()` vit dans `arme.ts` (hors lot, non modifié) : index.ts relaie `arme.aFrappe(combo)`
  vers `joueur.frapperMelee(combo)` qui émet `aFrappeVisuel(combo, face)` et arme le lunge.
- `EffetsCombat.brancherJoueur` : arc croissant additif doré (0xFFD27A), rayon 1.6 tuile,
  durée 0.15 s, orienté selon face ; combo 3 = anneau 360°.
- Lunge : +30 % `vitesseCourse` vers face pendant 0.08 s, appliqué au déplacement puis retiré
  (`vx` simulé intact), inactif en DASH/vol libre. I-frames, coyote, tuning inchangés.

## 4. Flèches lisibles (`visuelProjectile.ts`)
- Traînée : 10 → 4 segments, alpha ×0.5 (0.4/0.25 × reste). Faisceau dégradé conservé.
- Pointe procédurale : petit triangle ivoire (0xFFF8E7), blend normal (non additif),
  orientée selon `atan2(vy, vx)`, en tête du faisceau, taille ×1.3 si chargée.

## 5. Poussières (`effets.ts`)
- Conteneur `poussiere` NON additif, pool dédié. Bouffées 4-6 particules gris-blanc (0xD9D9D2),
  durée 0.3 s, alpha 0.4 dégressif, scale 0.16 → 0.38.
- Déclencheurs : `aAtterri`, course au sol (`auSol`, état SOL, |vx| > 4) toutes les 0.18 s,
  départ de dash (`aDashe`, biais opposé à la direction).

## 6. Chiffres de dégâts + flash (`effets.ts`)
- Pop : scale 1.4 → 1 en 0.12 s (ease-out quadratique), puis stable ; crit ×1.3 et doré (0xFFC83A).
- Flash blanc d'impact (anneau sur `coupPorte`) : nouveau param `intensite`, ÷3 si `options.flashs = false`.

Vérif : `npx tsc --noEmit` sans erreur dans les 6 fichiers du lot.