import { i as Graines, r as Flux } from "../core";
import { gainStage, miseStage, perteStage, profilNeuf } from "./progression";

export const stockageLocal = {
  lire: (cle: string) => {
    try {
      return localStorage.getItem(cle);
    } catch {
      return null;
    }
  },
  ecrire: (cle: string, valeur: string) => {
    try {
      localStorage.setItem(cle, valeur);
    } catch (e) {
      console.warn("Sauvegarde impossible", e);
    }
  },
};

const MODIFICATEURS: Record<string, string> = {
  intense: "Intensité +3",
  elites: "Élites partout",
  fragile: "Pit fragile : moitié de vie",
  rapide: "Ennemis rapides",
  tempete: "Rafales de vent",
  sans_soin: "Aucune Eau de vie",
};
const CLE_PROFIL = "kid-icarus/profil/";
const VERSION_PROFIL = 1;

function calculerRang(reussi: boolean, duree: number, tempsRef: number, morts: number, vie: number) {
  if (!reussi) return "C";
  let points = 0;
  points += duree <= tempsRef ? 2 : +(duree <= tempsRef * 1.5);
  points += morts === 0 ? 2 : +(morts <= 2);
  points += +(vie >= 0.5);
  return points >= 5 ? "S" : points >= 3 ? "A" : points >= 2 ? "B" : "C";
}

export class Partie {
  contenu: any;
  stockage: any;
  slot: number;
  profil: any;
  miseCourante = 0;
  stageDemande = "";
  resultat: any = null;
  introAJouer = false;
  defi: any = null;

  constructor(contenu: any, stockage: any, slot = 0) {
    this.contenu = contenu;
    this.stockage = stockage;
    this.slot = slot;
    this.profil = this.charger() ?? Partie.profilNeuf();
  }

  static profilNeuf() {
    return profilNeuf(new Flux(`profil|${Date.now()}`));
  }

  charger() {
    let brut = this.stockage.lire(CLE_PROFIL + this.slot);
    if (!brut) return null;
    try {
      let sauvegarde = JSON.parse(brut);
      return sauvegarde.profil ? migrerProfil(sauvegarde.version, sauvegarde.profil) : null;
    } catch (e) {
      console.warn("Sauvegarde illisible, nouvelle partie", e);
      return null;
    }
  }

  sauver() {
    this.stockage.ecrire(
      CLE_PROFIL + this.slot,
      JSON.stringify({ version: VERSION_PROFIL, profil: this.profil }),
    );
  }

  aUneSauvegarde() {
    return this.stockage.lire(CLE_PROFIL + this.slot) !== null;
  }

  get coeurs() {
    return this.profil.coeurs;
  }

  ajouterCoeurs(montant: number) {
    this.profil.coeurs = Math.max(0, this.profil.coeurs + montant);
  }

  ordreStages() {
    return this.contenu
      .liste("mondes")
      .flatMap((monde: any) => monde.stages.map((stage: any) => stage.id));
  }

  infosStage(id: string) {
    for (let monde of this.contenu.liste("mondes")) {
      let stage = monde.stages.find((s: any) => s.id === id);
      if (stage) return stage;
    }
  }

  stageTermine(id: string) {
    return !!this.profil.stages[id]?.termine;
  }

  stageDebloque(id: string) {
    let ordre = this.ordreStages(),
      i = ordre.indexOf(id);
    return i === 0 || (i > 0 && this.stageTermine(ordre[i - 1] ?? ""));
  }

  nouvellePartie() {
    this.profil = Partie.profilNeuf();
    this.profil.coeurs = 60;
    this.introAJouer = true;
    this.sauver();
  }

  nouvellePartiePlus() {
    this.profil.ng_plus = (this.profil.ng_plus ?? 0) + 1;
    for (let stage of Object.values(this.profil.stages) as any[]) stage.termine = false;
    this.introAJouer = true;
    this.sauver();
  }

  bonusIntensite() {
    return (
      2 * (this.profil.ng_plus ?? 0) + (this.aModificateur("intense") ? 3 : 0)
    );
  }

  aModificateur(id: string) {
    return this.defi?.modificateurs.includes(id) ?? false;
  }

  defiDuJour(date = new Date()) {
    let graine = Graines.graineDuJour(date),
      flux = new Flux(`defi|${graine}`),
      termines = this.ordreStages().filter((id: string) => this.stageTermine(id));
    if (!termines.length) return null;
    let ids = Object.keys(MODIFICATEURS),
      premier = flux.choisir(ids),
      second = premier;
    while (second === premier) second = flux.choisir(ids);
    return { date: graine, stage: flux.choisir(termines), modificateurs: [premier, second] };
  }

  lancerDefi() {
    this.defi = this.defiDuJour();
    if (!this.defi) return false;
    this.miseCourante = 0;
    this.profil.intensite = 0;
    this.stageDemande = this.defi.stage;
    return true;
  }

  lancerStage(id: string, intensite: number) {
    this.miseCourante = miseStage(intensite);
    this.ajouterCoeurs(-this.miseCourante);
    this.profil.intensite = intensite;
    this.stageDemande = id;
    this.defi = null;
    this.sauver();
  }

  finirStage(id: string, reussi: boolean, vie: number, stats: any) {
    if (this.defi) return this.finirDefi(id, reussi, stats);
    let intensite = this.profil.intensite,
      gain = 0;
    if (reussi) {
      gain = gainStage(intensite);
      this.ajouterCoeurs(gain);
    } else this.ajouterCoeurs(this.miseCourante - perteStage(intensite));
    let infos = this.infosStage(id),
      rang = calculerRang(reussi, stats.duree_s, infos?.temps_ref ?? 300, stats.morts, vie),
      etat = this.profil.stages[id] ?? {};
    if (reussi) {
      etat.termine = true;
      if ("CBAS".indexOf(rang) > "CBAS".indexOf(etat.rang ?? "C")) etat.rang = rang;
      etat.meilleur_temps = Math.min(etat.meilleur_temps ?? 1 / 0, stats.duree_s);
    }
    this.profil.stages[id] = etat;
    let resultat = {
      ...stats,
      id,
      reussi,
      rang: reussi ? rang : "-",
      gain,
      mise: this.miseCourante,
      intensite,
      fin: !!infos?.fin && reussi,
    };
    this.resultat = resultat;
    this.miseCourante = 0;
    this.sauver();
    return resultat;
  }

  finirDefi(id: string, reussi: boolean, stats: any) {
    let defi = this.defi,
      defis = this.profil.defis ?? {},
      record = defis[defi.date]?.temps ?? 1 / 0,
      battu = reussi && stats.duree_s < record;
    if (battu)
      defis[defi.date] = {
        stage: id,
        temps: stats.duree_s,
        modificateurs: defi.modificateurs,
      };
    this.profil.defis = defis;
    let resultat = {
      ...stats,
      id,
      reussi,
      rang: "-",
      gain: 0,
      mise: 0,
      intensite: 0,
      fin: false,
      defi: true,
      record: battu,
    };
    this.resultat = resultat;
    this.defi = null;
    this.sauver();
    return resultat;
  }

  varianteFin() {
    let somme = 0,
      nombre = 0;
    for (let id of this.ordreStages()) {
      let etat = this.profil.stages[id];
      if (etat?.termine) {
        somme += "CBAS".indexOf(etat.rang ?? "C");
        nombre++;
      }
    }
    let moyenne = somme / Math.max(1, nombre);
    return moyenne >= 2.4 ? "heroique" : moyenne < 1.2 ? "sobre" : "lumineuse";
  }
}

function migrerProfil(version: number, profil: any) {
  let v = version;
  for (; v < VERSION_PROFIL; ) v++;
  return profil;
}