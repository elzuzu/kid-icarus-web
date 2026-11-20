import { O as Signal, S as arrondi } from "../../app";

const rayonAimantTuiles = 3.5,
  denominations = [10, 5, 1],
  vitesseChuteMax = 300,
  vitesseAimant = 320,
  rayonObjetTuiles = 1.1,
  intervalleNettoyage = 120;

export class Coeur {
  x = 0;
  y = 0;
  precX = 0;
  precY = 0;
  vx = 0;
  vy = 0;
  valeur = 1;
  vie = 12;
  actif = true;
}

export class ArmeSol {
  inst: any;
  x = 0;
  y = 0;
  precX = 0;
  precY = 0;
  vx = 0;
  vy = 0;
  vie = 60;
  actif = true;

  constructor(inst: any) {
    this.inst = inst;
  }
}

export class Objet {
  id: string;
  x: number;
  y: number;
  actif = true;

  constructor(id: string, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;
  }
}

export class Recompenses {
  niveau: any;
  cible: any;
  combat: any;
  coeurs: Coeur[] = [];
  armes: ArmeSol[] = [];
  objets: Objet[] = [];
  multCoeurs = 1;
  multAimant = 1;
  multVie = 1;
  totalRamasse = 0;
  ramasse = new Signal();
  armeRamassee = new Signal();
  objetPris = new Signal();
  ticks = 0;

  constructor(niveau: any, cible: any, combat: any = null) {
    this.niveau = niveau;
    this.cible = cible;
    this.combat = combat;
  }

  lacher(x: number, y: number, montant: number, rng: any) {
    let reste = Math.max(0, Math.trunc(montant));
    for (const denomination of denominations)
      for (; reste >= denomination; ) {
        reste -= denomination;
        const coeur = new Coeur();
        coeur.x = coeur.precX = x;
        coeur.y = coeur.precY = y;
        coeur.valeur = denomination;
        coeur.vx = rng.randfRange(-70, 70);
        coeur.vy = rng.randfRange(-200, -120);
        coeur.vie = 12 * this.multVie;
        this.coeurs.push(coeur);
      }
  }

  lacherArme(x: number, y: number, inst: any): ArmeSol {
    const arme = new ArmeSol(inst);
    arme.x = arme.precX = x;
    arme.y = arme.precY = y;
    arme.vy = -160;
    this.armes.push(arme);
    return arme;
  }

  poserObjet(id: string, x: number, y: number): Objet {
    const objet = new Objet(id, x, y);
    this.objets.push(objet);
    return objet;
  }

  retirerDans(rect: { x: number; y: number; l: number; h: number }) {
    const dedans = (x: number, y: number) =>
      x >= rect.x && x < rect.x + rect.l && y >= rect.y && y < rect.y + rect.h;
    for (const coeur of this.coeurs) if (dedans(coeur.x, coeur.y)) coeur.actif = false;
    for (const arme of this.armes) if (dedans(arme.x, arme.y)) arme.actif = false;
  }

  pas(dt: number) {
    if (this.combat?.estGele()) return;
    this.ticks += 1;
    const vivant = this.cible?.vivant ?? false,
      centre = this.cible ? this.cible.centre() : null,
      rayonAimant = rayonAimantTuiles * 16 * this.multAimant;
    for (const coeur of this.coeurs) {
      if (!coeur.actif) continue;
      coeur.precX = coeur.x;
      coeur.precY = coeur.y;
      coeur.vie -= dt;
      if (coeur.vie <= 0) {
        coeur.actif = false;
        continue;
      }
      const ecart = centre ? this.ecart(coeur.x, coeur.y, centre.x, centre.y) : null,
        distance = ecart ? Math.hypot(ecart.x, ecart.y) : Infinity;
      if (ecart && vivant && distance < rayonAimant) {
        const dx = distance > 0 ? ecart.x / distance : 0,
          dy = distance > 0 ? ecart.y / distance : 0;
        coeur.vx += (dx * vitesseAimant - coeur.vx) * 0.2;
        coeur.vy += (dy * vitesseAimant - coeur.vy) * 0.2;
      } else {
        coeur.vy = Math.min(coeur.vy + 520 * dt, vitesseChuteMax);
        coeur.vx = approcherZero(coeur.vx, 40 * dt);
      }
      let nx = coeur.x + coeur.vx * dt,
        ny = coeur.y + coeur.vy * dt;
      if (coeur.vy > 0 && this.solide(nx, ny + 4)) {
        coeur.vy = -coeur.vy * 0.35;
        if (Math.abs(coeur.vy) < 30) coeur.vy = 0;
        ny = coeur.y;
      }
      coeur.x = this.boucler(nx);
      coeur.y = ny;
      if (vivant && distance < 12) {
        coeur.actif = false;
        const gain = Math.max(1, arrondi(coeur.valeur * this.multCoeurs));
        this.totalRamasse += gain;
        this.ramasse.emettre(gain, coeur.x, coeur.y);
      }
    }
    for (const arme of this.armes) {
      if (!arme.actif) continue;
      arme.precX = arme.x;
      arme.precY = arme.y;
      arme.vie -= dt;
      arme.vy = Math.min(arme.vy + 520 * dt, vitesseChuteMax);
      let nx = arme.x + arme.vx * dt,
        ny = arme.y + arme.vy * dt;
      if (arme.vy > 0 && this.solide(nx, ny + 6)) {
        arme.vx = arme.vy = 0;
        ny = Math.floor((ny + 6) / 16) * 16 - 6;
      }
      arme.x = this.boucler(nx);
      arme.y = ny;
      if (arme.vie <= 0) arme.actif = false;
      else if (centre && vivant && this.distance(arme.x, arme.y, centre) < 18) {
        arme.actif = false;
        this.armeRamassee.emettre(arme.inst, arme.x, arme.y);
      }
    }
    if (centre && vivant)
      for (const objet of this.objets)
        if (objet.actif && this.distance(objet.x, objet.y, centre) < rayonObjetTuiles * 16) {
          objet.actif = false;
          this.objetPris.emettre(objet.id, objet.x, objet.y);
        }
    if (this.ticks % intervalleNettoyage === 0) {
      this.coeurs = this.coeurs.filter((c) => c.actif);
      this.armes = this.armes.filter((a) => a.actif);
    }
  }

  solide(x: number, y: number): boolean {
    const niveau = this.niveau;
    if (!niveau) return false;
    const ligne = Math.floor(y / 16);
    return ligne < niveau.hauteur && niveau.estAppui(Math.floor(x / 16), ligne);
  }

  ecart(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
    return this.combat ? this.combat.ecart(x1, y1, x2, y2) : { x: x2 - x1, y: y2 - y1 };
  }

  distance(x: number, y: number, point: { x: number; y: number }): number {
    const e = this.ecart(x, y, point.x, point.y);
    return Math.hypot(e.x, e.y);
  }

  boucler(x: number): number {
    const niveau = this.niveau;
    if (!niveau?.boucle) return x;
    const largeur = niveau.largeurPx();
    return x < 0 || x >= largeur ? ((x % largeur) + largeur) % largeur : x;
  }
}

const approcherZero = (valeur: number, pas: number): number =>
  valeur > 0 ? Math.max(0, valeur - pas) : Math.min(0, valeur + pas);