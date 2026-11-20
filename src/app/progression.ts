import { appliquerAffixes, statsArme } from "./armes";
import { Effets } from "./effets";
import { arrondi, borner } from "./nombres";

const PALIERS_GRILLE: [number, number][] = [
  [1, 3],
  [5, 4],
  [12, 5],
  [20, 6],
];

export function profilNeuf(flux: any) {
  return {
    version: 1,
    coeurs: 0,
    xp: 0,
    niveau: 1,
    talents: {},
    armes: [
      {
        uid: "depart",
        base: "arc_palutena",
        rarete: "commune",
        niveau: 1,
        affixes: [],
        unique: "",
        maudit: "",
      },
    ],
    arme_equipee: "depart",
    reliques: [],
    reliques_portees: [],
    pouvoirs: ["soin"],
    grille: [{ id: "soin", x: 0, y: 0 }],
    intensite: 0,
    stages: {},
    bestiaire: {},
    graine: flux.randi(),
  };
}

function xpRequise(niveau: number) {
  return arrondi(60 * niveau ** 1.55);
}

export function gagnerXp(profil: any, xp: number) {
  let niveaux = 0;
  profil.xp += xp;
  while (profil.niveau < 30 && profil.xp >= xpRequise(profil.niveau)) {
    profil.xp -= xpRequise(profil.niveau);
    profil.niveau += 1;
    niveaux++;
  }
  return niveaux;
}

export function armeEquipee(profil: any) {
  return profil.armes.find((arme: any) => arme.uid === profil.arme_equipee) ?? profil.armes[0];
}

export function ajouterArme(profil: any, arme: any) {
  if (profil.armes.length >= 30) return false;
  profil.armes.push(arme);
  return true;
}

export function basculerRelique(profil: any, id: string) {
  if (!profil.reliques.includes(id)) return "relique non possédée";
  let i = profil.reliques_portees.indexOf(id);
  if (i >= 0) {
    profil.reliques_portees.splice(i, 1);
    return "";
  }
  if (profil.reliques_portees.length >= 4) return "4 reliques au maximum";
  profil.reliques_portees.push(id);
  return "";
}

export function tailleGrille(niveau: number) {
  let taille = 3;
  for (let [seuil, cote] of PALIERS_GRILLE) if (niveau >= seuil) taille = cote;
  return taille;
}

function cellulesPouvoir(contenu: any, id: string, x: number, y: number) {
  return contenu
    .entree("pouvoirs", id)
    .forme.map(([dx, dy]: number[]) => ({ x: x + dx, y: y + dy }));
}

export function placerPouvoir(contenu: any, profil: any, id: string, x: number, y: number) {
  if (!profil.pouvoirs.includes(id)) return "pouvoir non possédé";
  let cote = tailleGrille(profil.niveau),
    occupees = new Set<string>();
  for (let place of profil.grille)
    if (place.id !== id)
      for (let cellule of cellulesPouvoir(contenu, place.id, place.x, place.y))
        occupees.add(`${cellule.x},${cellule.y}`);
  for (let cellule of cellulesPouvoir(contenu, id, x, y)) {
    if (cellule.x < 0 || cellule.y < 0 || cellule.x >= cote || cellule.y >= cote)
      return "hors de la grille";
    if (occupees.has(`${cellule.x},${cellule.y}`)) return "case déjà occupée";
  }
  profil.grille = [...profil.grille.filter((p: any) => p.id !== id), { id, x, y }];
  return "";
}

export function pouvoirsActifs(contenu: any, profil: any) {
  return profil.grille
    .filter((place: any) => contenu.entree("pouvoirs", place.id).actif)
    .map((place: any) => place.id);
}

export function effetsJoueur(contenu: any, profil: any) {
  let effets = new Effets();
  appliquerAffixes(contenu, armeEquipee(profil), effets);
  let parDieu = new Map<string, number>();
  for (let id of profil.reliques_portees) {
    let relique = contenu.entree("reliques", id);
    for (let effet of relique.effets) effets.ajouter(effet, relique.nom);
    parDieu.set(relique.dieu, (parDieu.get(relique.dieu) ?? 0) + 1);
  }
  for (let [dieu, nombre] of parDieu) {
    let set = contenu.entree("sets", dieu);
    for (let seuil of ["2", "4"])
      if (nombre >= Number(seuil))
        for (let effet of set[seuil]) effets.ajouter(effet, set.nom);
  }
  for (let [id, rang] of Object.entries(profil.talents)) {
    let talent = contenu.entree("talents", id);
    for (let effet of talent.effets)
      effets.ajouter({ ...effet, v: effet.v * (rang as number) }, talent.nom);
  }
  for (let place of profil.grille) {
    let pouvoir = contenu.entree("pouvoirs", place.id);
    if (!pouvoir.actif)
      for (let effet of pouvoir.effets ?? []) effets.ajouter(effet, pouvoir.nom);
  }
  return effets;
}

export function pvMax(profil: any, effets: Effets) {
  return arrondi(effets.joueur("pv_max", 100 + 5 * (profil.niveau - 1)));
}

export function miseStage(intensite: number) {
  return arrondi(10 * Math.max(0, intensite) ** 1.7);
}

export function multPvIntensite(intensite: number) {
  return 1 + 0.16 * intensite;
}

export function multDegatsIntensite(intensite: number) {
  return 1 + 0.11 * intensite;
}

export function chanceElite(intensite: number) {
  return borner(0.03 + 0.045 * intensite, 0, 0.5);
}

export function multCoeursIntensite(intensite: number) {
  return 1 + 0.12 * intensite;
}

export function gainStage(intensite: number) {
  return miseStage(intensite) + arrondi(miseStage(intensite) * 0.5 + 15 * intensite);
}

export function perteStage(intensite: number) {
  return arrondi(miseStage(intensite) * 0.5);
}