# Lot C — UI & confort (agent C)

## Fichiers modifiés
- `src/app/options.ts` : chargement/sauvegarde localStorage (clé `kid-icarus-options`,
  séparée de `kid-icarus/profil/`), `basculerOption(cle)`, `chargerOptions()` à l'import.
  Les trois booléens `secousses/flashs/hitstop` gardent leurs noms ; mutation en place
  de l'objet partagé → effet immédiat pour caméra (A) et combat/boucle (B), qui l'importent déjà.
- `src/scenes/stage/hudStage.ts` :
  - **SousTitres** : panneau antique via `dessinerPanneau` (parchemin sombre alpha 0.82,
    double bord or/bronze, losanges d'angle), nom du locuteur en `styleTitre(26, OR)`,
    texte en `styleTexte(28)` (wrap 1100 px inchangé). Portrait à gauche si asset connu :
    `assets/art/pit/pit_profil.webp` (seul portrait existant ; chargé via `BASE_URL`,
    échec silencieux → panneau seul). Clé = `ligne.perso` des dialogues. Textes, touche
    de passage et durées intacts (`mettreAJour`/fondu non touchés).
  - **MenuPause** : entrée « Options » entre Reprendre et Abandonner ; sous-vue avec
    3 bascules `Bouton` (« Secousses d'écran / Flashs lumineux / Arrêts sur impact
    (hitstop) : Oui/Non », police 24 pour tenir dans le panneau) + Retour. Navigation
    manette/souris via `Menu` existant, Échap/pause = retour vue principale, refermer
    restaure « Reprendre » sélectionné. Persistance immédiate à chaque bascule.
- `src/ui/hud.ts` : libellé discret « VOL » (styleTexte 15, bronze) à droite de la jauge
  bleue ; cooldowns des pouvoirs en voile radial (secteur sombre sur la part restante)
  + arc or de progression sur le cadre, compte à rebours chiffré conservé ; pulsation
  douce des cœurs pleins/partiels (scale ±7 %, ~1 Hz) quand 0 < pv ≤ 25 % pvMax,
  échelle de base mémorisée pour éviter toute dérive cumulative.
- `src/scenes/stage/monde.ts` : dérive additive du fond lointain uniquement
  (sin ±6 px / 24 s en X, ±4 px / 31 s en Y, horloge propre `tempsFond`), ajoutée aux
  offsets parallax existants dans les deux branches (ascension/horizontal). Plans
  milieu, avant-plan, particules et gameplay inchangés ; scale 1.15 du fond absorbe la marge.
- `src/app/sauvegarde.ts` : **non modifié** — `stockageLocal` (lecture/écriture protégées)
  est réutilisé tel quel par options.ts ; aucun changement nécessaire.

## Vérifications
- `npx tsc --noEmit` : aucune erreur dans les fichiers du lot ; restent 8 erreurs
  préexistantes hors périmètre (`app/contenu.ts`, `core/preload.ts`).
- Contrats préservés : alias d'exports, `window.__sim`, timings de dialogue, hitboxes.
- Assets via `import.meta.env.BASE_URL` (`scenes/stage/base.ts`).