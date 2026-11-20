import {
  _ as genererArme,
  v as nomArme,
  b as valeurArme,
  s as ajouterArme,
  d as basculerRelique,
  u as tailleGrille,
  p as placerPouvoir,
  S as arrondi,
} from "../../app";

const couleurRelique = [1, 0.8, 0.35];

export const benedictions = [
  {
    nom: "Faveur de Palutena",
    detail: "+25 PV max jusqu'à la fin du stage",
    effet: { stat: "pv_max", v: 25, mode: "joueur_add" },
  },
  {
    nom: "Colère d'Arès",
    detail: "+20 % de dégâts jusqu'à la fin du stage",
    effet: { stat: "bonus_degats", v: 20, mode: "pct" },
  },
  {
    nom: "Sagesse d'Athéna",
    detail: "+50 % d'expérience jusqu'à la fin du stage",
    effet: { stat: "xp", v: 50, mode: "joueur_pct" },
  },
  {
    nom: "Main d'Hermès",
    detail: "+60 % de cadence jusqu'à la fin du stage",
    effet: { stat: "cadence", v: 60, mode: "pct" },
  },
];

export function offreArme(contenu: any, rng: any, niveauObjet: number, intensite: number, rareteMin = "") {
  const inst = genererArme(contenu, rng, niveauObjet, intensite, "", rareteMin),
    rarete = contenu.entree("raretes", inst.rarete);
  return {
    type: "arme",
    inst,
    nom: nomArme(contenu, inst),
    detail: `${rarete.nom}, valeur ${valeurArme(contenu, inst)}`,
    couleur: [...rarete.couleur],
    rang: rarete.rang,
    prix: 0,
  };
}

export function offreEauDeVie() {
  return {
    type: "eau_de_vie",
    nom: "Eau de vie",
    detail: "un flacon de soin de plus",
    couleur: [0.45, 0.8, 1],
    prix: 0,
  };
}

export function offrePlume() {
  return {
    type: "plume",
    nom: "Plume d'ange",
    detail: "sauve d'une chute, une fois",
    couleur: [1, 1, 0.95],
    prix: 0,
  };
}

const nomsDieux: Record<string, string> = {
  athena: "Athéna",
  hades: "Hadès",
  palutena: "Palutena",
  poseidon: "Poséidon",
  zeus: "Zeus",
};

function joliNom(id: string): string {
  return id
    .split("_")
    .filter((mot) => mot !== "")
    .map((mot) => (mot[0] ?? "").toUpperCase() + mot.slice(1))
    .join(" ");
}

export function offreRelique(contenu: any, rng: any, profil: any) {
  const ids = contenu.ids("reliques").filter((id: string) => !profil.reliques.includes(id));
  if (ids.length === 0) return offreEauDeVie();
  // Tirage pondéré « chasse de set » : un dieu déjà porté pèse plus lourd, et un
  // dieu à 1 ou 3 reliques (bonus 2/4 pièces à un pas) pèse encore plus — les
  // bonus de sets.json deviennent réellement poursuivables, pas un loterie plate.
  const parDieu = new Map<string, number>();
  for (const id of profil.reliques_portees ?? []) {
    const dieu = contenu.entree("reliques", id).dieu;
    parDieu.set(dieu, (parDieu.get(dieu) ?? 0) + 1);
  }
  const poids = ids.map((id: string) => {
    const n = parDieu.get(contenu.entree("reliques", id).dieu) ?? 0;
    return n === 1 || n === 3 ? 3.5 : n === 2 ? 1.6 : 1;
  });
  const relique = contenu.entree("reliques", ids[rng.indicePondere(poids)]);
  return {
    type: "relique",
    id: relique.id,
    nom: relique.nom,
    detail: `relique de ${nomsDieux[relique.dieu] ?? joliNom(relique.dieu)}`,
    couleur: [...couleurRelique],
    prix: 0,
  };
}

export function offrePouvoir(contenu: any, rng: any, profil: any) {
  const ids = contenu.ids("pouvoirs").filter((id: string) => !profil.pouvoirs.includes(id));
  if (ids.length === 0) return offreRelique(contenu, rng, profil);
  const pouvoir = contenu.entree("pouvoirs", ids[rng.randiRange(0, ids.length - 1)]);
  return {
    type: "pouvoir",
    id: pouvoir.id,
    nom: pouvoir.nom,
    detail: pouvoir.actif ? "pouvoir actif, touche 1 ou 2" : "pouvoir passif, toujours actif",
    couleur: [0.4, 1, 0.85],
    prix: 0,
  };
}

export function offreBenediction(rng: any) {
  const modele = benedictions[rng.randiRange(0, benedictions.length - 1)];
  return {
    type: "benediction",
    effet: { ...modele.effet },
    nom: modele.nom,
    detail: modele.detail,
    couleur: [1, 0.95, 0.6],
    prix: 0,
  };
}

// Calibration économie (mesurée, lane loot) : revenu stage 1-1 ≈ 58 cœurs trash
// + 80 boss = 138 (expert ×0.85 ≈ 117). Cible : 2-3 achats significatifs par
// stage, sans inflation triviale ni mur. Les prix de base viennent de
// chambres.json (level) ; ces coefficients les recalibrent contre le revenu réel.
// eau 45→35, plume 70→50, pouvoir 110→90, relique 140→100.
const calibrationPrix: Record<string, number> = {
    eau_de_vie: 0.8,
    plume: 0.7,
    pouvoir: 0.8,
    relique: 0.7,
  },
  // valeurArme (puissance DPS) médiane mesurée : niv1 commune 72 / rare 84 /
  // épique 97 ; niv18 épique 171 / légendaire 235 / mythique 305. À 0.8 le mur
  // était réel (arme rare 120 > revenu stage) ; 0.45 donne commune 50, rare 75,
  // épique 105 en 1-1, et 175/285/430 en endgame (revenu intensité 12 ≈ 1400).
  coefValeurArme = 0.45;

export function calculerPrix(contenu: any, offre: any, def: any, rng: any): number {
  const prix = { ...def.prix };
  let montant: number;
  montant =
    offre.type === "arme"
      ? (prix.arme_base ?? 20) + valeurArme(contenu, offre.inst) * coefValeurArme * (1 + 0.5 * offre.rang)
      : (prix[offre.type] ?? 60) * (calibrationPrix[offre.type] ?? 1);
  const [min, max] = def.mult_prix ?? [1, 1];
  montant *= rng.randfRange(min, max);
  return Math.max(5, arrondi(montant / 5) * 5);
}

export function appliquerOffre(contenu: any, offre: any, profil: any, progression: any = null) {
  switch (offre.type) {
    case "arme":
      return ajouterArme(profil, offre.inst)
        ? `Nouvelle arme : ${offre.nom}`
        : "!Inventaire plein";
    case "eau_de_vie":
      if (progression) {
        progression.flaconsAchetes += 1;
        progression.appliquerProgression();
        progression.flacons += 1;
      }
      return `Eau de vie ! (${progression ? progression.flacons : 1} flacon${progression && progression.flacons > 1 ? "s" : ""})`;
    case "plume":
      if (progression) {
        if (progression.plumeDisponible) return "!Tu as déjà une plume d'ange";
        progression.plumeDisponible = true;
      }
      return "Plume d'ange : une chute pardonnée";
    case "coeurs":
      if (progression) progression.ajouterCoeurs(offre.n);
      else profil.coeurs += offre.n;
      return `+${offre.n} cœurs`;
    case "relique": {
      if (profil.reliques.includes(offre.id)) return "!Relique déjà possédée";
      profil.reliques.push(offre.id);
      const portee = basculerRelique(profil, offre.id) === "";
      progression?.appliquerProgression();
      return `Relique : ${offre.nom}${portee ? " (portée)" : ""}`;
    }
    case "pouvoir": {
      if (profil.pouvoirs.includes(offre.id)) return "!Pouvoir déjà possédé";
      profil.pouvoirs.push(offre.id);
      const placable = pouvoirPlacable(contenu, profil, offre.id);
      progression?.appliquerProgression();
      return `Pouvoir : ${offre.nom}${placable ? "" : " (grille pleine : voir le menu)"}`;
    }
    case "benediction":
      if (progression) {
        progression.benedictions.push(offre.effet);
        progression.appliquerProgression();
      }
      return `${offre.nom} : ${offre.detail.toLowerCase()}`;
  }
}

export function pouvoirPlacable(contenu: any, profil: any, id: string): boolean {
  const taille = tailleGrille(profil.niveau);
  for (let ligne = 0; ligne < taille; ligne++)
    for (let col = 0; col < taille; col++)
      if (placerPouvoir(contenu, profil, id, col, ligne) === "") return true;
  return false;
}