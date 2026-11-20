import { O as Signal, _ as genererArme, v as nomArme, g as fusionnerArmes } from "../../app";
import { r as Flux } from "../../core";
import { i as construireNiveau } from "../../ui/hud";
import { Combattant, Camp } from "./combat";
import { ModeCamera } from "./camera";
import {
  offreArme,
  offreEauDeVie,
  offrePlume,
  offreRelique,
  offrePouvoir,
  offreBenediction,
  calculerPrix,
  appliquerOffre,
} from "./offres";

const intervalleEpreuve = 45,
  exclusBestiaire = ["reaper", "brute_hades"],
  bestiaireSecours = ["nettler", "specknose", "monoeye"],
  refus = (message: string) => ({ ok: false, message });

export function tirerChambre(contenu: any, rng: any): string {
  const chambres = contenu.liste("chambres").filter((c: any) => c.hasard > 0);
  if (chambres.length === 0) throw Error('Aucune chambre tirable (clé "hasard")');
  return chambres[rng.indicePondere(chambres.map((c: any) => c.hasard))].id;
}

export function niveauChambre(def: any, kit = "") {
  return construireNiveau(
    {
      id: `chambre/${def.id}`,
      nom: def.nom,
      type: "salle",
      largeur: def.gabarit[0]?.length ?? 0,
      boucle: false,
      kit,
      marqueurs: def.marqueurs,
      sans_arrivee: true,
    },
    [def.gabarit],
  );
}

const formater = (modele: string, valeurs: any[]): string => {
  let i = 0;
  return modele.replace(/%d/g, () => String(valeurs[i++] ?? ""));
};

export class Forge {
  contenu: any;
  eco: any;
  prix: number;
  cle: string;
  choisies: string[] = [];
  affixes: any[] = [];
  forges = 0;
  forgee = new Signal();

  constructor(contenu: any, eco: any, prix: number, cle: string) {
    this.contenu = contenu;
    this.eco = eco;
    this.prix = prix;
    this.cle = cle;
  }

  armes() {
    return this.eco.profil.armes;
  }

  basculer(uid: string) {
    const index = this.choisies.indexOf(uid);
    if (index >= 0) this.choisies.splice(index, 1);
    else if (this.choisies.length < 2 && this.arme(uid)) this.choisies.push(uid);
  }

  apercu() {
    const [a, b] = this.paire();
    return a && b ? fusionnerArmes(this.contenu, a, b, this.flux(), this.affixes) : null;
  }

  raisonRefus(): string {
    const [a, b] = this.paire();
    return !a || !b
      ? "Choisis deux armes"
      : this.eco.coeurs() < this.prix
        ? "Pas assez de cœurs"
        : "";
  }

  forger() {
    const raison = this.raisonRefus(),
      [a, b] = this.paire();
    if (raison !== "" || !a || !b) return { ok: false, message: raison, arme: null };
    const fusion = fusionnerArmes(this.contenu, a, b, this.flux(), this.affixes);
    this.forges += 1;
    const profil = this.eco.profil,
      equipee = profil.arme_equipee === a.uid || profil.arme_equipee === b.uid;
    for (const arme of [a, b]) profil.armes.splice(profil.armes.indexOf(arme), 1);
    profil.armes.push(fusion);
    if (equipee) profil.arme_equipee = fusion.uid;
    this.eco.ajouterCoeurs(-this.prix);
    this.choisies.length = 0;
    this.affixes = [];
    if (equipee) this.eco.appliquerProgression();
    this.forgee.emettre(fusion);
    return { ok: true, message: `Forge : ${nomArme(this.contenu, fusion)}`, arme: fusion };
  }

  fermer() {
    this.eco.appliquerProgression();
  }

  arme(uid: string) {
    return this.eco.profil.armes.find((a: any) => a.uid === uid);
  }

  paire() {
    const [a, b] = this.choisies;
    return [a === undefined ? undefined : this.arme(a), b === undefined ? undefined : this.arme(b)];
  }

  flux() {
    return new Flux(`${this.cle}|forge|${this.forges}`);
  }
}

export class Chambre {
  stage: any;
  eco: any;
  contenu: any;
  def: any;
  flux: any;
  cle: string;
  salle: any;
  origineY = -384;
  sortie: { x: number; y: number };
  accueil: string;
  offres: any[] = [];
  interactifs: any[] = [];
  jarres: any[] = [];
  coffres: any[] = [];
  pnj: any[] = [];
  source: any = null;
  forge: Forge | null = null;
  verrouillee = false;
  vague = -1;
  abattus = 0;
  tempsRestant = 0;
  epreuveFinie = false;
  epreuveReussie = false;
  benie = false;
  invite = "";
  inviteAction = false;
  ouverte = true;
  annonce = new Signal();
  son = new Signal();
  terminee = new Signal();
  offrePrise = new Signal();
  jarreBrisee = new Signal();
  vagueLancee = new Signal();
  epreuveTerminee = new Signal();
  coffreOuvert = new Signal();
  forgeOuverte = new Signal();
  ennemis: any[] = [];
  ticks = 0;
  resteSoin = 0;
  attenteVague = -1;

  static ouvrir(stage: any, eco: any, contenu: any, id: string, flux: any, cle: string): Chambre | null {
    const def = contenu.chercher("chambres", id);
    if (!def) {
      console.error(`Chambre inconnue : ${id}`);
      return null;
    }
    const { niveau, erreurs } = niveauChambre(def, stage.niveau.kit);
    if (erreurs.length) {
      console.error(`Chambre ${id} : ${erreurs.join(", ")}`);
      return null;
    }
    return new Chambre(stage, eco, contenu, def, niveau, flux, cle);
  }

  constructor(stage: any, eco: any, contenu: any, def: any, salle: any, flux: any, cle: string) {
    this.stage = stage;
    this.eco = eco;
    this.contenu = contenu;
    this.def = def;
    this.flux = flux;
    this.cle = cle;
    this.salle = salle;
    stage.niveau.annexe = salle;
    stage.niveau.annexeLigne = -24;
    this.sortie = this.px(salle.depart);
    this.accueil =
      def.id === "epreuve"
        ? formater(def.accueil, [def.objectif ?? 0, def.duree ?? 0])
        : def.accueil;
    switch (def.id) {
      case "boutique":
      case "marche_noir":
        this.peuplerBoutique();
        break;
      case "tresor":
        this.peuplerTresor();
        break;
      case "source_chaude":
        this.peuplerSource();
        break;
      case "nid":
        this.verrouillee = true;
        this.attenteVague = 1.5;
        break;
      case "divine":
        this.peuplerDivine();
        break;
      case "epreuve":
        this.verrouillee = true;
        this.tempsRestant = def.duree ?? 40;
        break;
      case "forge":
        this.peuplerForge();
        break;
      case "hopital":
        this.peuplerHopital();
    }
  }

  get type(): string {
    return this.def.id;
  }

  get nom(): string {
    return this.def.nom;
  }

  get nbVagues(): number {
    return this.def.vagues?.length ?? 0;
  }

  get objectif(): number {
    return this.def.objectif ?? 0;
  }

  px(pos: { c: number; l: number }) {
    return { x: (pos.c + 0.5) * 16, y: this.origineY + (pos.l + 1) * 16 };
  }

  marqueurs(role: string) {
    return this.salle.marqueurs.filter((m: any) => m.def.role === role).map((m: any) => m.pos);
  }

  rect() {
    return {
      x: 0,
      y: this.origineY,
      l: this.salle.largeurPx(),
      h: this.salle.hauteurPx(),
    };
  }

  pas(dt: number, interagir = false) {
    if (!this.ouverte) return;
    this.ticks += 1;
    if (this.type === "source_chaude") this.majSource(dt);
    else if (this.type === "nid") this.majNid(dt);
    else if (this.type === "epreuve") this.majEpreuve(dt);
    const proche = this.proche();
    this.invite = proche
      ? proche.invite
      : this.aLaSortie()
        ? this.verrouillee
          ? "La porte est scellée !"
          : "Sortir"
        : this.statut();
    this.inviteAction = !!proche || (this.aLaSortie() && !this.verrouillee);
    if (interagir && this.stage.combattant.vivant) this.interagir();
  }

  interagir() {
    const proche = this.proche();
    return proche ? this.activer(proche) : this.aLaSortie() ? this.sortir() : refus("");
  }

  proche() {
    const joueur = this.stage.joueur;
    let choisi: any = null,
      meilleure = Infinity;
    for (const interactif of this.interactifs) {
      if (!interactif.actif) continue;
      const dx = Math.abs(interactif.x - joueur.x),
        dy = Math.abs(interactif.y - joueur.y);
      if (dx <= 14 && dy <= 20 && dx < meilleure) {
        meilleure = dx;
        choisi = interactif;
      }
    }
    return choisi;
  }

  aLaSortie(): boolean {
    const joueur = this.stage.joueur;
    return (
      joueur.corps.auSol &&
      Math.abs(joueur.x - this.sortie.x) <= 14 &&
      Math.abs(joueur.y - this.sortie.y) <= 20
    );
  }

  statut(): string {
    return this.type === "nid" && this.verrouillee
      ? `Vague ${Math.max(0, this.vague) + 1} / ${this.nbVagues}`
      : this.type === "epreuve" && !this.epreuveFinie
        ? `Épreuve : ${this.abattus} / ${this.objectif}   -   ${Math.ceil(this.tempsRestant)} s`
        : "";
  }

  activer(interactif: any) {
    switch (interactif.genre) {
      case "offre":
        return this.acheter(interactif.cible);
      case "coffre":
        return this.ouvrirCoffre(interactif.cible);
      case "enclume":
        return this.ouvrirForge();
      case "medecin":
        return this.soigner();
    }
  }

  acheter(index: number) {
    const entree = this.offres[index];
    if (!entree || !entree.disponible || !this.ouverte) return refus("Rien à prendre ici");
    if (entree.payant && this.eco.coeurs() < entree.offre.prix)
      return this.refuser("Pas assez de cœurs", 1.2);
    const message = appliquerOffre(this.contenu, entree.offre, this.eco.profil, this.eco);
    if (message.startsWith("!")) return this.refuser(message.slice(1), 1.4);
    if (entree.payant) {
      this.eco.ajouterCoeurs(-entree.offre.prix);
      this.son.emettre("achat");
    }
    const divin =
      entree.offre.type === "benediction" ||
      entree.offre.type === "relique" ||
      entree.offre.type === "pouvoir";
    this.son.emettre(divin ? "benediction" : "arme_rare");
    this.desactiver(entree, true);
    if (entree.groupe !== "")
      for (const autre of this.offres)
        if (autre !== entree && autre.groupe === entree.groupe) this.desactiver(autre, false);
    this.annonce.emettre(message, 2.2);
    this.offrePrise.emettre(entree);
    return { ok: true, message };
  }

  choisirBenediction(index: number) {
    return this.type === "divine" ? this.acheter(index) : refus("Ce n'est pas une chambre divine");
  }

  choisirJarre(index: number) {
    const jarre = this.jarres[index];
    if (!jarre || !jarre.actif || !this.ouverte) return refus("Pas de jarre ici");
    jarre.combattant.vivant = false;
    this.briser(jarre);
    return { ok: true, message: "" };
  }

  ouvrirCoffre(index = 0) {
    const coffre = this.coffres[index];
    if (!coffre || coffre.ouvert || !this.ouverte) return refus("Pas de coffre à ouvrir");
    coffre.ouvert = true;
    for (const interactif of this.interactifs)
      if (interactif.genre === "coffre" && interactif.cible === index) interactif.actif = false;
    this.son.emettre("coffre_ouvre");
    const recompenses = this.eco.recompenses;
    recompenses.lacher(coffre.x, coffre.y - 10, this.flux.randiRange(30, 60), this.flux);
    recompenses.lacherArme(
      coffre.x,
      coffre.y - 10,
      genererArme(this.contenu, this.flux, this.eco.niveauObjet + 1, this.eco.intensite, "", "rare"),
    );
    const message = "Le coffre regorge de trésors !";
    this.annonce.emettre(message, 1.6);
    this.coffreOuvert.emettre(coffre);
    return { ok: true, message };
  }

  ouvrirForge() {
    if (!this.forge || !this.ouverte) return refus("Pas d'enclume ici");
    this.forgeOuverte.emettre(this.forge);
    return { ok: true, message: "" };
  }

  soigner() {
    if (this.type !== "hopital" || !this.ouverte) return refus("Pas de médecin ici");
    const combattant = this.stage.combattant;
    combattant.soigner(combattant.pvMax);
    combattant.statuts.clear();
    const message = "Remis sur pied !";
    this.annonce.emettre(message, 1.6);
    return { ok: true, message };
  }

  sortir() {
    if (!this.ouverte) return refus("");
    if (this.verrouillee) return refus("La porte est scellée !");
    this.fermer();
    return { ok: true, message: "" };
  }

  fermer() {
    if (!this.ouverte) return;
    this.ouverte = false;
    this.stage.apparitions?.vider();
    this.ennemis.length = 0;
    for (const jarre of this.jarres) this.stage.combat.retirer(jarre.combattant);
    this.eco.recompenses.retirerDans(this.rect());
    if (this.stage.niveau.annexe === this.salle) this.stage.niveau.annexe = null;
    this.invite = "";
    this.terminee.emettre();
  }

  refuser(message: string, duree: number) {
    this.annonce.emettre(message, duree);
    this.son.emettre("refus");
    return refus(message);
  }

  desactiver(entree: any, prise: boolean) {
    entree.disponible = false;
    entree.prise = prise;
    for (const interactif of this.interactifs)
      if (interactif.genre === "offre" && interactif.cible === entree.index) interactif.actif = false;
  }

  ajouterOffre(offre: any, point: { x: number; y: number }, socle: string, payant: boolean, groupe: string) {
    const index = this.offres.length;
    this.offres.push({
      index,
      offre,
      payant,
      groupe,
      socle,
      x: point.x,
      y: point.y,
      disponible: true,
      prise: false,
    });
    this.interactifs.push({
      genre: "offre",
      cible: index,
      x: point.x,
      y: point.y,
      actif: true,
      invite: `${payant ? "Acheter" : "Prendre"} ${offre.nom}${offre.detail ? ` (${offre.detail})` : ""}${payant ? ` : ${offre.prix} cœurs` : ""}`,
    });
  }

  ajouterPnj(role: string) {
    for (const pos of this.marqueurs(role)) this.pnj.push({ role, ...this.px(pos) });
  }

  peuplerBoutique() {
    const contenu = this.contenu,
      flux = this.flux,
      profil = this.eco.profil,
      niveauObjet = this.eco.niveauObjet;
    let offres: any[];
    if (this.type === "boutique") {
      offres = [offreArme(contenu, flux, niveauObjet, this.eco.intensite), offreEauDeVie()];
      const extras = [offrePlume(), offreRelique(contenu, flux, profil), offrePouvoir(contenu, flux, profil)];
      offres.push(extras[flux.randiRange(0, extras.length - 1)]);
    } else
      offres = [
        offreArme(contenu, flux, niveauObjet + 1, this.eco.intensite, "epique"),
        offreRelique(contenu, flux, profil),
        offrePouvoir(contenu, flux, profil),
      ];
    const piedestaux = this.marqueurs("piedestal");
    for (let i = 0; i < Math.min(offres.length, piedestaux.length); i++) {
      const offre = offres[i];
      offre.prix = calculerPrix(contenu, offre, this.def, flux);
      this.ajouterOffre(offre, this.px(piedestaux[i]), "piedestal", true, "");
    }
    this.ajouterPnj("marchand");
  }

  peuplerDivine() {
    const contenu = this.contenu,
      flux = this.flux,
      profil = this.eco.profil,
      offres = flux.melanger([
        offreRelique(contenu, flux, profil),
        offrePouvoir(contenu, flux, profil),
        offreBenediction(flux),
      ]),
      autels = this.marqueurs("autel");
    for (let i = 0; i < Math.min(offres.length, autels.length); i++)
      this.ajouterOffre(offres[i], this.px(autels[i]), "autel", false, "present");
  }

  peuplerTresor() {
    const contenus = this.flux.melanger([...(this.def.contenu ?? [])]);
    if (contenus.length === 0) return;
    this.marqueurs("jarre").forEach((pos: any, index: number) => {
      const point = this.px(pos),
        combattant = new Combattant({ x: point.x, y: point.y }, Camp.NEUTRE, 1, "jarre");
      combattant.boite = { x: -9, y: -26, l: 18, h: 26 };
      this.stage.combat.enregistrer(combattant);
      const jarre = {
        index,
        x: point.x,
        y: point.y,
        contenu: contenus[index % contenus.length],
        actif: true,
        combattant,
      };
      combattant.mort.connecter(() => this.briser(jarre));
      this.jarres.push(jarre);
    });
  }

  briser(jarre: any) {
    if (!jarre.actif) return;
    jarre.actif = false;
    this.stage.combat.retirer(jarre.combattant);
    const x = jarre.x,
      y = jarre.y - 8,
      recompenses = this.eco.recompenses,
      flux = this.flux;
    switch (jarre.contenu) {
      case "coeurs_petit":
        recompenses.lacher(x, y, flux.randiRange(5, 12), flux);
        break;
      case "coeurs_gros":
        recompenses.lacher(x, y, flux.randiRange(25, 45), flux);
        this.annonce.emettre("Un trésor !", 1.2);
        break;
      case "eau_de_vie":
        this.annonce.emettre(
          appliquerOffre(this.contenu, offreEauDeVie(), this.eco.profil, this.eco),
          1.8,
        );
        break;
      case "arme":
        recompenses.lacherArme(
          x,
          y,
          genererArme(this.contenu, flux, this.eco.niveauObjet, this.eco.intensite, "", "rare"),
        );
        break;
      case "pauvrete":
        this.annonce.emettre("Le dieu de la Pauvreté ! Les autres jarres s'évanouissent...", 2.8);
        for (const autre of this.jarres)
          if (autre.actif) {
            autre.actif = false;
            this.stage.combat.retirer(autre.combattant);
          }
        break;
      default:
        console.error(`Contenu de jarre inconnu : ${jarre.contenu}`);
    }
    this.jarreBrisee.emettre(jarre);
  }

  peuplerSource() {
    const marqueurs = this.marqueurs("source"),
      premier = marqueurs[0];
    if (!premier) return;
    let minX = Infinity,
      maxX = -Infinity;
    for (const pos of marqueurs) {
      const point = this.px(pos);
      minX = Math.min(minX, point.x - 8);
      maxX = Math.max(maxX, point.x + 8);
    }
    const y = this.px(premier).y;
    this.source = { x: minX, y: y - 19.2, l: maxX - minX, h: 22.4 };
  }

  majSource(dt: number) {
    const source = this.source,
      joueur = this.stage.joueur,
      x = joueur.x,
      y = joueur.y - 2;
    if (!source || x < source.x || x >= source.x + source.l || y < source.y || y >= source.y + source.h)
      return;
    const combattant = this.stage.combattant;
    this.resteSoin += combattant.pvMax * (this.def.soin_par_s ?? 0.1) * dt;
    const soin = Math.floor(this.resteSoin);
    if (soin > 0 && combattant.pv < combattant.pvMax) combattant.soigner(soin);
    this.resteSoin -= soin;
    this.stage.flacons = Math.max(this.stage.flacons, this.stage.flaconsMax);
    const benediction = this.def.benediction;
    if (!this.benie && benediction) {
      this.benie = true;
      this.eco.benedictions.push({ ...benediction });
      this.eco.appliquerProgression();
      this.son.emettre("benediction");
      this.annonce.emettre(`Bénédiction des sources : +${benediction.v} % de dégâts pour ce stage`, 2.6);
    }
  }

  bestiaire(): string[] {
    const ids: string[] = [];
    for (const marqueur of this.stage.niveau.marqueurs) {
      const id = marqueur.def.ennemi;
      if (typeof id === "string" && !ids.includes(id) && !exclusBestiaire.includes(id)) ids.push(id);
    }
    return ids.length ? ids : [...bestiaireSecours];
  }

  faireApparaitre(nombre: number) {
    const apparitions = this.stage.apparitions,
      marqueurs = this.marqueurs("apparition");
    if (!apparitions || marqueurs.length === 0) return;
    const bestiaire = this.bestiaire();
    for (let i = 0; i < nombre; i++) {
      const point = this.px(marqueurs[i % marqueurs.length]),
        x = point.x + this.flux.randfRange(-12, 12),
        ennemi = apparitions.creer(bestiaire[this.flux.randiRange(0, bestiaire.length - 1)], x, point.y - 4);
      if (ennemi) {
        this.ennemis.push(ennemi);
        ennemi.combattant.mort.connecter(() => {
          this.abattus += 1;
        });
      }
    }
  }

  vivants(): number {
    for (let i = this.ennemis.length - 1; i >= 0; i--) {
      const ennemi = this.ennemis[i];
      if (ennemi.disparu || !ennemi.combattant.vivant) this.ennemis.splice(i, 1);
    }
    return this.ennemis.length;
  }

  majNid(dt: number) {
    if (!this.verrouillee) return;
    const vagues = this.def.vagues ?? [];
    if (this.attenteVague >= 0) {
      this.attenteVague -= dt;
      if (this.attenteVague < 0 && this.vague + 1 < vagues.length) {
        this.vague += 1;
        this.annonce.emettre(`Vague ${this.vague + 1} / ${vagues.length}`, 1.2);
        this.vagueLancee.emettre(this.vague + 1, vagues.length);
        this.faireApparaitre(vagues[this.vague] ?? 0);
      }
      return;
    }
    if (this.vivants() > 0) return;
    if (this.vague + 1 < vagues.length) {
      this.attenteVague = 1.2;
      return;
    }
    this.verrouillee = false;
    this.annonce.emettre("Nid purifié ! Un coffre apparaît.", 2);
    for (const pos of this.marqueurs("coffre")) {
      const point = this.px(pos),
        index = this.coffres.length;
      this.coffres.push({ index, x: point.x, y: point.y, ouvert: false });
      this.interactifs.push({
        genre: "coffre",
        cible: index,
        x: point.x,
        y: point.y,
        actif: true,
        invite: "Ouvrir le coffre",
      });
    }
  }

  majEpreuve(dt: number) {
    if (this.epreuveFinie) return;
    this.tempsRestant -= dt;
    if (this.abattus >= this.objectif) {
      this.finirEpreuve(true);
      return;
    }
    if (this.tempsRestant <= 0) {
      this.finirEpreuve(false);
      return;
    }
    if (this.vivants() < (this.def.simultanes ?? 5) && this.ticks % intervalleEpreuve === 0)
      this.faireApparaitre(1);
  }

  finirEpreuve(reussie: boolean) {
    this.epreuveFinie = true;
    this.epreuveReussie = reussie;
    this.verrouillee = false;
    this.stage.apparitions?.vider();
    this.ennemis.length = 0;
    this.tempsRestant = Math.max(0, this.tempsRestant);
    if (!reussie) {
      this.annonce.emettre("Épreuve échouée... Le temps est écoulé.", 2.4);
      this.epreuveTerminee.emettre(false);
      return;
    }
    this.annonce.emettre("Épreuve réussie ! Les dieux te récompensent.", 2.4);
    const piedestal = this.marqueurs("piedestal")[0];
    if (piedestal)
      this.ajouterOffre(
        offrePouvoir(this.contenu, this.flux, this.eco.profil),
        this.px(piedestal),
        "piedestal",
        false,
        "",
      );
    this.epreuveTerminee.emettre(true);
  }

  peuplerForge() {
    this.ajouterPnj("forgeron");
    const prix = this.def.prix_fusion ?? 60,
      forge = new Forge(this.contenu, this.eco, prix, this.cle);
    forge.forgee.connecter((arme: any) => {
      this.son.emettre("forge_frappe");
      this.annonce.emettre(`Forge : ${nomArme(this.contenu, arme)}`, 2.4);
    });
    this.forge = forge;
    for (const pos of this.marqueurs("enclume")) {
      const point = this.px(pos);
      this.interactifs.push({
        genre: "enclume",
        cible: 0,
        x: point.x,
        y: point.y,
        actif: true,
        invite: `Forger : fusionner deux armes (${prix} cœurs)`,
      });
    }
  }

  peuplerHopital() {
    this.ajouterPnj("medecin");
    for (const pos of this.marqueurs("medecin")) {
      const point = this.px(pos);
      this.interactifs.push({
        genre: "medecin",
        cible: 0,
        x: point.x,
        y: point.y,
        actif: true,
        invite: "Se faire soigner",
      });
    }
  }
}

export class GestionChambres {
  stage: any;
  eco: any;
  contenu: any;
  chambre: Chambre | null = null;
  porteProche = -1;
  portesScellees = new Set<number>();
  invite = "";
  inviteAction = false;
  entree = new Signal();
  sortie = new Signal();
  annonce = new Signal();
  son = new Signal();
  hautAvant = true;
  retour = { x: 0, y: 0 };
  avant: any = null;
  retourPorte = true;

  constructor(stage: any, eco: any, contenu: any) {
    this.stage = stage;
    this.eco = eco;
    this.contenu = contenu;
    stage.reapparu.connecter(() => this.fermerApresMort());
  }

  pas(intention: any, dt: number) {
    const haut = intention.deplacementY < -0.7,
      interagir = intention.interagirPresse || (haut && !this.hautAvant);
    this.hautAvant = haut;
    const chambre = this.chambre;
    if (chambre) {
      chambre.pas(dt, interagir);
      if (this.chambre) {
        this.invite = this.chambre.invite;
        this.inviteAction = this.chambre.inviteAction;
      }
      return;
    }
    const stage = this.stage,
      joueur = stage.joueur;
    this.porteProche = -1;
    if (stage.combattant.vivant && !stage.fini && joueur.corps.auSol) {
      const centre = joueur.centre(),
        col = Math.floor(centre.x / 16),
        ligne = Math.floor(centre.y / 16);
      this.porteProche = stage.niveau.portes.findIndex(
        (porte: any) => porte.pos.c === col && Math.abs(ligne - porte.pos.l) <= 1,
      );
    }
    this.invite =
      this.porteProche < 0
        ? ""
        : this.portesScellees.has(this.porteProche)
          ? "Porte scellée"
          : "Entrer";
    this.inviteAction = this.invite === "Entrer";
    if (this.porteProche >= 0 && interagir) this.entrer(this.porteProche);
  }

  entrer(index: number, id = ""): Chambre | null {
    const stage = this.stage,
      joueur = stage.joueur;
    if (this.chambre || stage.fini || !stage.combattant.vivant) return null;
    if (this.portesScellees.has(index)) {
      this.annonce.emettre("La porte est scellée.", 1.2);
      return null;
    }
    const cle = [stage.graine, "chambre", stage.niveau.id, index].join("|"),
      flux = new Flux(cle);
    let chambreId = id === "" ? (stage.niveau.portes[index]?.chambre ?? "hasard") : id;
    if (chambreId === "hasard") chambreId = tirerChambre(this.contenu, flux);
    stage.apparitions?.vider();
    stage.combat.viderProjectiles(Camp.ENNEMI);
    const chambre = Chambre.ouvrir(stage, this.eco, this.contenu, chambreId, flux, cle);
    if (!chambre) return null;
    this.chambre = chambre;
    if (index >= 0) this.portesScellees.add(index);
    const camera = stage.camera;
    this.retour = { x: joueur.x, y: joueur.y };
    this.avant = {
      mode: camera.mode,
      salle: camera.salle,
      salleAuto: camera.salleAuto,
      boucle: stage.niveau.boucle,
      adherence: joueur.adherence,
    };
    stage.niveau.boucle = false;
    joueur.adherence = 1;
    stage.enChambre = true;
    joueur.corps.x = chambre.sortie.x;
    joueur.corps.y = chambre.sortie.y - 1;
    joueur.corps.vx = joueur.corps.vy = 0;
    camera.mode = ModeCamera.SALLE;
    camera.salleAuto = false;
    camera.salle = chambre.rect();
    camera.recaler();
    chambre.annonce.connecter((message: string, duree: number) => this.annonce.emettre(message, duree));
    chambre.son.connecter((nom: string) => this.son.emettre(nom));
    chambre.terminee.connecter(() => this.apresFermeture(chambre));
    this.entree.emettre(chambre);
    this.annonce.emettre(chambre.accueil, 2.8);
    return chambre;
  }

  sortir() {
    return this.chambre ? this.chambre.sortir() : refus("");
  }

  fermerApresMort() {
    if (!this.chambre) return;
    this.retourPorte = false;
    this.chambre.fermer();
  }

  apresFermeture(chambre: Chambre) {
    if (this.chambre !== chambre) return;
    const stage = this.stage,
      joueur = stage.joueur,
      camera = stage.camera;
    this.chambre = null;
    stage.enChambre = false;
    this.invite = "";
    const avant = this.avant;
    if (avant) {
      stage.niveau.boucle = avant.boucle;
      joueur.adherence = avant.adherence;
      camera.mode = avant.mode;
      camera.salle = avant.salle;
      camera.salleAuto = avant.salleAuto;
    }
    if (this.retourPorte) {
      joueur.corps.x = this.retour.x;
      joueur.corps.y = this.retour.y;
      joueur.corps.vx = joueur.corps.vy = 0;
    }
    this.retourPorte = true;
    camera.recaler();
    this.sortie.emettre(chambre);
    this.annonce.emettre(stage.niveau.nom, 1);
  }
}

export function creerGestionChambres(stage: any, contenu: any, eco: any): GestionChambres {
  const gestion = new GestionChambres(stage, eco, contenu);
  stage.modules.push(gestion);
  return gestion;
}