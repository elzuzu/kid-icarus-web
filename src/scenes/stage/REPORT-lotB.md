# Lot B — Poses procédurales (visuelJoueur, visuelEnnemi, comportements)

Aucun asset ajouté. Transforms 100 % additifs recalculés chaque frame : ancres par
frame intactes, hitboxes/dégâts/despawn inchangés, `window.__sim` intact (lecture seule).

## visuelJoueur.ts
- Swing mêlée : abonnement lecture seule au relais `joueur.aFrappeVisuel` (ajouté en
  parallèle) sinon `__sim.arme.aFrappe` (identité joueur vérifiée ; `aFrappe` vit sur
  l'arme, index.ts ne passe que le joueur). Pose 0.18 s : inclinaison ±0.35 rad selon
  face (sin π), punch scale (1.1, 0.9)→(1,1) ease-out, override frame d'armes existante
  (`course_tir` si course, sinon `tir_debout` frame 3, repli `tir`). Combo 3 : rotation
  2π en 0.25 s. Retour propre : l'override réutilise les noms d'anim standard.
- Squash & stretch : aAtterri → (1.25, 0.75)→(1,1) en 0.12 s ; aSaute → (0.8, 1.2)→(1,1)
  en 0.1 s (ease-out). Compensation y via l'ancre de la frame : pieds au sol préservés.
  `douilleEcran` calculé après les poses → muzzle aligné.
- Afterimages dash : conteneur `fantomes` inséré sous le joueur dans `plan` (espace
  monde). Spawn /0.03 s pendant DASH (+ fenêtre 0.18 s sur aDashe pour le dash en vol
  libre), max 3 vivants, texture courante partagée, tint 0xcfe8ff, alpha 0.35→0 sur
  0.25 s, destruction à expiration + `destroy()` surchargé (conteneur frère).

## visuelEnnemi.ts
- Prepare : recul scale (1.12, 0.88) monté en 0.1 s + pulse tint blanc→or 8 Hz,
  amplitude 0.25 (flash de coup prioritaire).
- Attaque : windup→strike (0.9, 1.15) + inclinaison 0.2 rad vers la cible
  (`versCible()` si dispo, sinon face), retour ease-out 0.15 s. Frame attaque conservée.
- Mort : sursaut (1.2, 1.2) 0.06 s → affaissement (1.1, 0.6) + rotation ±0.4 rad +
  sink +8 px sur 0.35 s → fade 0.35 s démarrant à t=0.35 (chevauche l'affaissement) :
  alpha 0 à t=0.7, despawn simulation (ennemi.ts) inchangé.
- Horodatage local des transitions (prepareDepuis/attaqueDepuis), aucune minuterie sim.

## comportements.ts
- Vérification : la valeur ~0.125 s annoncée n'existe NULLE PART (src + data). Durées
  réelles : params JSON `preparation` 0.55–0.8 s (chargeur, lanceur, piqueur, orage) +
  fenêtres codées tourelle 0.4 s, tireur_volant 0.45 s, emergeant 0.5 s, dormeur 0.6 s
  — toutes déjà ≥ 0.3 s.
- Implémentation : plancher `dureePrepare(d) = max(0.3, d)` appliqué à ces 8 sites sans
  réécrire les JSON. No-op avec les données actuelles ; garantit qu'aucune donnée
  future ne descende sous le télégraphe lisible de 0.3 s.

## Vérification
`npx tsc --noEmit` : 0 erreur dans les 3 fichiers (préexistantes ailleurs : contenu, preload).