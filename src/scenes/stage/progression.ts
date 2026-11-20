import {
  O as Signal,
  x as Mods,
  f as calculerMods,
  y as statsArme,
  l as armeEquipee,
  h as pvMaxPour,
  C as borner,
  S as arrondi,
  o as multPvIntensite,
  n as multDegatsIntensite,
  a as multCoeursIntensite,
  t as chanceElite,
  _ as genererArme,
  c as ajouterXp,
  s as ajouterArme,
  v as nomArme,
} from "../../app";
import { r as Flux } from "../../core";
import { options } from "../../app/options";
import { Recompenses } from "./recompenses";
import { Boss } from "./boss";
import { Ennemi } from "./ennemi";
import { Camp, multDifficulte } from "./combat";
import { brancherEconomie } from "./comportements";
import { dureeInvulnerabiliteBase } from "./joueur";

const affixesConnus = [
  "vol_de_vie",
  "explosion_mort",
  "invocation",
  "intervalle",
  "reflet",
  "teleportation",
];

function appliquerElites(contenu: any, ennemi: any, intensite: number) {
  if (ennemi.elites.length === 0 && ennemi.rng.randf() >= chanceElite(intensite)) {
    appliquerIntensite(ennemi, intensite);
    return;
  }
  if (ennemi.elites.length === 0) {
    const ids = contenu.ids("elites"),
      nombre = intensite < 5 || ennemi.rng.randf() < 0.6 ? 1 : 2;
    for (let i = 0; i < nombre; i++) {
      const id = ids[ennemi.rng.randiRange(0, ids.length - 1)];
      if (!ennemi.elites.includes(id)) ennemi.elites.push(id);
    }
  }
  appliquerAffixes(contenu, ennemi, intensite);
}

function appliquerAffixes(contenu: any, ennemi: any, intensite: number) {
  const combattant = ennemi.combattant;
  combattant.elite = true;
  let pv = combattant.pvMax * 2,
    degats = 1;
  for (const id of ennemi.elites) {
    const affixe = contenu.entree("elites", id);
    pv *= affixe.pv_mult ?? 1;
    degats *= affixe.degats_mult ?? 1;
    ennemi.vitesseMult *= affixe.vitesse_mult ?? 1;
    combattant.defense += affixe.defense ?? 0;
    for (const cle of affixesConnus) {
      const valeur = affixe[cle];
      if (valeur !== undefined) {
        ennemi.meta[`elite_${cle}`] = valeur;
        if (typeof valeur === "number" && combattant.meta) combattant.meta[`elite_${cle}`] = valeur;
      }
    }
  }
  combattant.pvMax = arrondi(pv);
  combattant.pv = combattant.pvMax;
  majDegatsContact(combattant, degats);
  ennemi.meta.degats_mult = degats;
  appliquerIntensite(ennemi, intensite);
}

function appliquerIntensite(ennemi: any, intensite: number) {
  const combattant = ennemi.combattant;
  combattant.pvMax = arrondi(combattant.pvMax * multPvIntensite(intensite));
  combattant.pv = combattant.pvMax;
  majDegatsContact(combattant, multDegatsIntensite(intensite));
  ennemi.meta.mult_degats_intensite = multDegatsIntensite(intensite);
}

function majDegatsContact(combattant: any, mult: number) {
  if (combattant.degatsContact && Object.keys(combattant.degatsContact).length !== 0)
    combattant.degatsContact = {
      ...combattant.degatsContact,
      base: (combattant.degatsContact.base ?? 10) * mult,
    };
}

const tresorsSacres = ["sandales", "bouclier", "fleches"],
  chanceMiroir = 0.35,
  textesObjets: Record<string, string> = {
    carte: "Carte de la forteresse",
    crayon: "Crayon : les passages inexplorés sont notés",
    torche: "Torche : le boss et les trésors apparaissent sur la carte",
    maillet: "Maillet de Palutena : libère les Centurions",
    sandales: "Sandales d'Hermès : le dash traverse les grilles !",
    bouclier: "Bouclier miroir : il renvoie parfois les tirs qui arrivent de face !",
    fleches: "Flèches de lumière : chaque tir transperce un ennemi de plus !",
  };

function parsePaire(valeur: any, defaut: [number, number]): [number, number] {
  return Array.isArray(valeur) && valeur.length === 2
    ? [Number(valeur[0]), Number(valeur[1])]
    : defaut;
}

export class Progression {
  stage: any;
  contenu: any;
  profil: any;
  recompenses: Recompenses;
  mods = new Mods();
  niveauObjet: number;
  benedictions: any[] = [];
  objetsForteresse = new Set<string>();
  defi: Set<string>;
  coeursChanges = new Signal();
  armeObtenue = new Signal();
  niveauGagne = new Signal();
  progressionAppliquee = new Signal();
  annonce = new Signal();
  son = new Signal();
  reglagesBase: any;
  flaconsBase: number;
  flaconsAchetes = 0;
  plumeAccordee = false;
  apparitionsBranchees: any = null;
  difficulteVue = "";

  constructor(stage: any, contenu: any, profil: any, intensite: number, options: any = {}) {
    this.stage = stage;
    this.contenu = contenu;
    this.profil = profil;
    this.defi = new Set(options.defi ?? []);
    this.reglagesBase = stage.joueur.reglages.copier();
    this.flaconsBase = stage.flaconsMax;
    this.intensite = intensite;
    this.niveauObjet = Number(stage.niveau.definition.niveau ?? 1) + arrondi(intensite / 2);
    this.recompenses = new Recompenses(stage.niveau, stage.cible(), stage.combat);
    for (const marqueur of stage.niveau.marqueurs) {
      const objet = marqueur.def.objet;
      if (typeof objet === "string" && !this.aObjet(objet))
        this.recompenses.poserObjet(
          objet,
          (marqueur.pos.c + 0.5) * 16,
          (marqueur.pos.l + 0.5) * 16,
        );
    }
    this.recompenses.ramasse.connecter((montant: number) => this.ajouterCoeurs(montant));
    this.recompenses.armeRamassee.connecter((inst: any) => this.surArmeRamassee(inst));
    this.recompenses.objetPris.connecter((id: string) => this.surObjetPris(id));
    stage.combat.combattantMort.connecter((combattant: any) => this.surMort(combattant));
    stage.joueurMort.connecter(() => this.surMortJoueur());
    stage.termine.connecter(() => this.surFinDuStage());
    this.brancherApparitions();
    this.appliquerProgression();
    stage.flacons = stage.flaconsMax;
  }

  get intensite(): number {
    return this.stage.intensite;
  }

  set intensite(valeur: number) {
    this.stage.intensite = valeur;
    this.stage.multBoss = {
      pv: multPvIntensite(valeur) * multDifficulte().pv,
      degats: multDegatsIntensite(valeur),
    };
  }

  get flacons(): number {
    return this.stage.flacons;
  }

  set flacons(valeur: number) {
    this.stage.flacons = valeur;
  }

  get plumeDisponible(): boolean {
    return this.stage.plumeDisponible;
  }

  set plumeDisponible(valeur: boolean) {
    this.stage.plumeDisponible = valeur;
  }

  coeurs(): number {
    return this.profil.coeurs;
  }

  ajouterCoeurs(montant: number) {
    this.profil.coeurs = Math.max(0, this.profil.coeurs + montant);
    this.coeursChanges.emettre(this.profil.coeurs);
  }

  capacites(): string[] {
    return this.profil.capacites ?? [];
  }

  aObjet(id: string): boolean {
    return tresorsSacres.includes(id)
      ? this.capacites().includes(id)
      : this.objetsForteresse.has(id);
  }

  pas(intention: any, dt: number) {
    // Relecture live de `difficulte` : un changement en cours de stage met à jour
    // immédiatement les cœurs et le boss ; les PV des ennemis déjà apparus restent
    // ceux de leur apparition (pas de réécriture rétroactive des PV en combat).
    const difficulte = String((options as any).difficulte ?? "normal");
    if (difficulte !== this.difficulteVue) {
      this.difficulteVue = difficulte;
      this.majMultiplicateurs();
      this.stage.multBoss = {
        pv: multPvIntensite(this.intensite) * multDifficulte().pv,
        degats: multDegatsIntensite(this.intensite),
      };
    }
    this.brancherApparitions();
    this.recompenses.pas(dt);
  }

  appliquerProgression() {
    const contenu = this.contenu,
      profil = this.profil,
      stage = this.stage,
      mods = calculerMods(contenu, profil);
    for (const benediction of this.benedictions) mods.ajouter(benediction, "benediction");
    this.mods = mods;
    stage.arme.stats = statsArme(contenu, armeEquipee(profil), mods);
    this.appliquerJoueur(mods);
    stage.flaconsMax = Math.trunc(mods.joueur("flacons", this.flaconsBase)) + this.flaconsAchetes;
    if (mods.drapeau("plume") && !this.plumeAccordee) {
      this.plumeAccordee = true;
      stage.plumeDisponible = true;
    }
    const combattant = stage.combattant;
    if (this.defi.has("sans_soin")) {
      stage.flaconsMax = 0;
      stage.flacons = Math.min(stage.flacons, 0);
    }
    if (this.defi.has("fragile")) {
      combattant.pvMax = Math.max(1, Math.trunc(combattant.pvMax / 2));
      combattant.pv = Math.min(combattant.pv, combattant.pvMax);
    }
    this.majMultiplicateurs();
    const capacites = this.capacites();
    stage.joueur.traverseGrilles = capacites.includes("sandales");
    if (capacites.includes("bouclier")) combattant.meta.bouclier_miroir = chanceMiroir;
    if (capacites.includes("fleches")) stage.arme.bonus.perce = 1;
    this.progressionAppliquee.emettre(mods);
  }

  appliquerJoueur(mods: any) {
    const joueur = this.stage.joueur,
      base = this.reglagesBase,
      pct = (cle: string) => mods.joueurPct.get(cle) ?? 0,
      reglages = base.copier(),
      multVitesse = Math.max(0.5, 1 + pct("vitesse_course") / 100);
    reglages.vitesseCourse = base.vitesseCourse * multVitesse;
    reglages.accelerationSol = base.accelerationSol * multVitesse;
    reglages.freinageSol = base.freinageSol * multVitesse;
    reglages.accelerationAir = base.accelerationAir * multVitesse;
    reglages.dureeVol = base.dureeVol * Math.max(0.3, 1 + pct("jauge_vol") / 100);
    reglages.rechargeDash = base.rechargeDash * Math.max(0.3, 1 + pct("recharge_dash") / 100);
    joueur.reglages = reglages;
    joueur.dureeInvulnerabilite =
      dureeInvulnerabiliteBase * Math.max(0.3, 1 + pct("invulnerabilite") / 100);
    const combattant = this.stage.combattant,
      ratio = combattant.pv / Math.max(1, combattant.pvMax),
      pvMax = pvMaxPour(this.profil, mods);
    combattant.pvMax = pvMax;
    combattant.pv = borner(arrondi(pvMax * ratio), 1, pvMax);
    combattant.defense = mods.joueur("defense", 0);
    combattant.multDegatsRecus = Math.max(0.2, 1 + mods.joueur("degats_subis_pct", 0) / 100);
  }

  majMultiplicateurs() {
    const pct = (cle: string) => this.mods.joueurPct.get(cle) ?? 0,
      recompenses = this.recompenses;
    recompenses.multCoeurs =
      Math.max(0.1, 1 + pct("coeurs") / 100) *
      multCoeursIntensite(this.intensite) *
      multDifficulte().coeurs;
    recompenses.multAimant = Math.max(0.5, 1 + pct("aimant") / 100);
    recompenses.multVie = Math.max(0.2, 1 + this.mods.joueur("vie_coeurs_pct", 0) / 100);
  }

  modifierEnnemi = (ennemi: any) => {
    if (this.defi.has("elites") && ennemi.elites.length === 0 && ennemi.rng.randf() < chanceElite(9)) {
      const ids = this.contenu.ids("elites");
      ennemi.elites.push(ids[ennemi.rng.randiRange(0, ids.length - 1)]);
    }
    appliquerElites(this.contenu, ennemi, this.intensite);
    const md = multDifficulte();
    if (md.pv !== 1) {
      const c = ennemi.combattant;
      c.pvMax = arrondi(c.pvMax * md.pv);
      c.pv = c.pvMax;
    }
    if (this.defi.has("rapide")) ennemi.vitesseMult *= 1.3;
  };

  brancherApparitions() {
    const apparitions = this.stage.apparitions;
    if (apparitions && apparitions !== this.apparitionsBranchees) {
      this.apparitionsBranchees = apparitions;
      apparitions.modificateur = this.modifierEnnemi;
    }
  }

  surMort(combattant: any) {
    const proprietaire = combattant.proprietaire;
    if (proprietaire instanceof Boss) {
      this.surBossVaincu(proprietaire);
      return;
    }
    if (combattant.camp !== Camp.ENNEMI || !(proprietaire instanceof Ennemi)) return;
    const ennemi = proprietaire,
      [min, max] = parsePaire(ennemi.def.coeurs, [0, 0]),
      elite = ennemi.elites.length > 0,
      centre = combattant.centre();
    this.recompenses.lacher(
      centre.x,
      centre.y,
      ennemi.rng.randiRange(min, max) * (elite ? 3 : 1) + Number(ennemi.meta.butin ?? 0),
      ennemi.rng,
    );
    const id = ennemi.def.id;
    this.profil.bestiaire[id] = (this.profil.bestiaire[id] ?? 0) + 1;
    const multXp = 1 + (this.mods.joueurPct.get("xp") ?? 0) / 100;
    this.gagnerXp(arrondi(Number(ennemi.def.xp ?? 1) * (elite ? 3 : 1) * multXp), true);
    if (ennemi.rng.randf() < (elite ? 0.25 : 0.015))
      this.recompenses.lacherArme(
        centre.x,
        centre.y,
        genererArme(this.contenu, ennemi.rng, this.niveauObjet, this.intensite),
      );
  }

  surBossVaincu(boss: Boss) {
    const def = boss.definition,
      rng = new Flux(`${this.stage.graine}|butin_boss|${this.stage.niveau.id}|${def.id}`),
      [min, max] = parsePaire(def.coeurs, [50, 50]),
      centre = boss.combattant.centre();
    this.recompenses.lacher(centre.x, centre.y, rng.randiRange(min, max), rng);
    const rareteMin = this.profil.stages[this.stage.niveau.id]?.boss ? "" : (def.rarete_min ?? "rare");
    this.recompenses.lacherArme(
      centre.x,
      centre.y,
      genererArme(this.contenu, rng, this.niveauObjet + 1, this.intensite, "", rareteMin),
    );
    this.gagnerXp(def.xp ?? 100, false);
    this.annonce.emettre(`${def.nom ?? def.id} est ${def.feminin === true ? "vaincue" : "vaincu"} !`, 3);
  }

  gagnerXp(montant: number, annoncer: boolean) {
    if (ajouterXp(this.profil, montant) <= 0) return;
    this.appliquerProgression();
    if (annoncer) {
      this.stage.combattant.soigner(this.stage.combattant.pvMax);
      this.annonce.emettre(`Niveau ${this.profil.niveau} !`, 2);
    }
    this.niveauGagne.emettre(this.profil.niveau);
  }

  surMortJoueur() {
    if (this.intensite <= 0) return;
    this.intensite = Math.max(0, this.intensite - 1);
    this.profil.intensite = this.intensite;
    this.majMultiplicateurs();
    this.annonce.emettre(`Intensité ${this.intensite.toFixed(1)}`, 1.6);
  }

  surArmeRamassee(inst: any) {
    const rarete = this.contenu.entree("raretes", inst.rarete);
    if (ajouterArme(this.profil, inst)) {
      this.annonce.emettre(`${nomArme(this.contenu, inst)}  (${rarete.nom})`, 2.2);
      this.armeObtenue.emettre(inst, true);
    } else {
      this.annonce.emettre("Inventaire plein !", 1.5);
      this.armeObtenue.emettre(inst, false);
    }
  }

  surObjetPris(id: string) {
    if (tresorsSacres.includes(id)) {
      const capacites = (this.profil.capacites ??= []);
      if (!capacites.includes(id)) capacites.push(id);
      this.appliquerProgression();
      this.son.emettre("tresor_sacre");
    } else {
      this.objetsForteresse.add(id);
      this.son.emettre("arme_rare");
    }
    this.annonce.emettre(textesObjets[id] ?? id, 2.6);
  }

  surFinDuStage() {
    const id = this.stage.niveau.id,
      etat = this.profil.stages[id] ?? {};
    etat.termine = true;
    etat.boss = !!etat.boss || this.stage.bossVaincu;
    this.profil.stages[id] = etat;
  }
}

export function creerProgression(
  stage: any,
  contenu: any,
  profil: any,
  intensite: number,
  options: any = {},
): Progression {
  const progression = new Progression(stage, contenu, profil, intensite, options);
  stage.modules.push(progression);
  brancherEconomie({
    coeurs: () => progression.coeurs(),
    ajouter: (montant: number) => progression.ajouterCoeurs(montant),
  });
  return progression;
}