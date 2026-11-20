import { Effets } from "./effets";
import { arrondi, nombreDe } from "./nombres";

const PALIERS_NIVEAU = [5, 10];

function palierAffixe(niveau: number) {
  return niveau <= PALIERS_NIVEAU[0] ? 0 : niveau <= PALIERS_NIVEAU[1] ? 1 : 2;
}

export function creerArme(contenu: any, flux: any, niveau: number, intensite = 0, classe = "", rarete = "") {
  let armes = contenu.liste("armes"),
    bonneClasse = (arme: any) => classe === "" || arme.classe === classe,
    candidates = armes.filter((arme: any) => arme.niveau <= niveau && bonneClasse(arme));
  if (candidates.length === 0) candidates = armes.filter(bonneClasse);
  if (candidates.length === 0) throw Error(`Aucune arme de classe « ${classe} »`);
  let poids = candidates.map((arme: any) => 1 + 3 / (1 + Math.abs(niveau - arme.niveau))),
    base = candidates[flux.indicePondere(poids)],
    idRarete = rarete === "" ? tirerRarete(contenu, flux, intensite) : rarete,
    defRarete = contenu.entree("raretes", idRarete),
    arme = {
      uid: flux.randi().toString(16),
      base: base.id,
      rarete: idRarete,
      niveau,
      affixes: [] as any[],
      unique: "",
      maudit: "",
    },
    groupes = new Set<string>();
  for (let i = 0; i < defRarete.affixes; i++) {
    let affixe = tirerAffixe(contenu, flux, "normal", base.classe, groupes);
    if (!affixe) break;
    groupes.add(affixe.groupe ?? affixe.id);
    arme.affixes.push({ id: affixe.id, v: valeurAffixe(flux, affixe, niveau) });
  }
  if (defRarete.unique)
    arme.unique = tirerAffixe(contenu, flux, "unique", base.classe, groupes)?.id ?? "";
  if (defRarete.maudit)
    arme.maudit = tirerAffixe(contenu, flux, "maudit", base.classe, groupes)?.id ?? "";
  return arme;
}

function tirerRarete(contenu: any, flux: any, intensite: number) {
  let raretes = contenu.liste("raretes"),
    poids = raretes.map((r: any) => Math.max(0.05, r.poids + (r.bonus_intensite ?? 0) * intensite));
  return raretes[flux.indicePondere(poids)].id;
}

export function appliquerAffixes(contenu: any, arme: any, effets: Effets) {
  let source = nomArme(contenu, arme);
  for (let affixe of arme.affixes)
    effets.ajouter(effetAffixe(contenu.entree("affixes", affixe.id), affixe.v), source);
  for (let id of [arme.unique, arme.maudit]) {
    if (id === "") continue;
    let def = contenu.entree("affixes", id);
    effets.ajouter(effetAffixe(def, valeurUnique(def, arme.niveau)), source);
    if (def.malus) effets.ajouter(def.malus, source);
  }
}

export function statsArme(contenu: any, arme: any, effets: Effets) {
  let def = contenu.entree("armes", arme.base),
    stats = structuredClone(def.stats);
  stats.id = arme.base;
  stats.classe = def.classe;
  let mult = contenu.entree("raretes", arme.rarete).mult_base ?? 1;
  mult *= 1 + 0.04 * Math.max(0, arme.niveau - def.niveau);
  stats.base = nombreDe(stats, "base") * mult;
  stats.melee_base = nombreDe(stats, "melee_base", 12) * mult;
  stats.chance_critique ??= 0.05;
  stats.mult_critique ??= 1.75;
  return effets.appliquerArme(stats);
}

export function puissanceArme(contenu: any, arme: any) {
  let effets = new Effets();
  appliquerAffixes(contenu, arme, effets);
  let stats = statsArme(contenu, arme, effets),
    dps =
      nombreDe(stats, "base") *
      (1 + nombreDe(stats, "bonus_degats")) *
      nombreDe(stats, "cadence") *
      Math.max(1, nombreDe(stats, "multi", 1)),
    critique = 1 + nombreDe(stats, "chance_critique") * (nombreDe(stats, "mult_critique") - 1),
    rarete = 1 + 0.08 * arme.affixes.length + (arme.unique === "" ? 0 : 0.2);
  return arrondi((dps * critique + nombreDe(stats, "melee_base") * 1.5) * rarete);
}

const SUFFIXES: Record<string, string> = {
  feu: "du brasier",
  glace: "du givre",
  poison: "de la vipère",
  foudre: "de l'orage",
  vol_de_vie: "vampire",
  critique: "de précision",
  cadence: "rapide",
  degats: "puissant",
  perce: "perçant",
  guidage: "chercheur",
};

export function nomArme(contenu: any, arme: any) {
  let nom = contenu.entree("armes", arme.base).nom,
    affixe = arme.affixes.find((a: any) => Object.hasOwn(SUFFIXES, a.id));
  return affixe ? `${nom} ${SUFFIXES[affixe.id]}` : nom;
}

export function fusionnerArmes(contenu: any, armeA: any, armeB: any, flux: any, garder: string[] = []) {
  let meilleure = puissanceArme(contenu, armeA) >= puissanceArme(contenu, armeB) ? armeA : armeB,
    niveau = Math.max(armeA.niveau, armeB.niveau) + 1,
    raretes = contenu.ids("raretes"),
    rang = Math.max(raretes.indexOf(armeA.rarete), raretes.indexOf(armeB.rarete));
  if (flux.randf() < 0.25) rang = Math.min(rang + 1, raretes.length - 1);
  let idRarete = raretes[rang],
    defRarete = contenu.entree("raretes", idRarete),
    tries = [...armeA.affixes, ...armeB.affixes].sort((a: any, b: any) => b.v - a.v),
    candidates = garder.length ? tries.filter((a: any) => garder.includes(a.id)) : tries,
    affixes: any[] = [],
    groupes = new Set<string>();
  for (let affixe of candidates) {
    let def = contenu.entree("affixes", affixe.id),
      groupe = def.groupe ?? def.id;
    if (groupes.has(groupe) || affixes.length >= defRarete.affixes) continue;
    groupes.add(groupe);
    affixes.push({ ...affixe });
  }
  return {
    uid: flux.randi().toString(16),
    base: meilleure.base,
    rarete: idRarete,
    niveau,
    affixes,
    unique: defRarete.unique ? (armeA.unique === "" ? armeB.unique : armeA.unique) : "",
    maudit: defRarete.maudit ? (armeA.maudit === "" ? armeB.maudit : armeA.maudit) : "",
  };
}

function effetAffixe(def: any, v: number) {
  let effet: any = { stat: def.stat, v, mode: def.mode };
  if (def.statut !== undefined) effet.statut = def.statut;
  if (def.element !== undefined) effet.element = def.element;
  if (def.duree !== undefined) effet.duree = def.duree;
  return effet;
}

function valeurUnique(def: any, niveau: number) {
  return def.paliers[palierAffixe(niveau)][0];
}

function tirerAffixe(contenu: any, flux: any, type: string, classe: string, groupes: Set<string>) {
  let candidates = contenu
    .liste("affixes")
    .filter(
      (affixe: any) =>
        affixe.type === type &&
        !groupes.has(affixe.groupe ?? affixe.id) &&
        (affixe.classes === undefined || affixe.classes.includes(classe)),
    );
  return candidates.length === 0
    ? null
    : candidates[flux.indicePondere(candidates.map((a: any) => a.poids ?? 1))];
}

function valeurAffixe(flux: any, def: any, niveau: number) {
  let [min, max] = def.paliers[palierAffixe(niveau)];
  return flux.randiRange(min, max);
}