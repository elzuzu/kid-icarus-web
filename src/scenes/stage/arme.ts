import { O as Signal } from "../../app";
import { r as Flux } from "../../core";
import { Camp, Element, Projectile } from "./combat";
import { EtatJoueur } from "./joueur";

export const statsArcDefaut = {
  id: "arc_palutena",
  classe: "arc",
  base: 10,
  cadence: 5,
  vitesse: 26,
  portee: 7.5,
  temps_charge: 0.9,
  mult_charge: 3,
  perce_charge: 2,
  chance_critique: 0.05,
  mult_critique: 1.75,
  recul: 90,
  melee_base: 14,
  melee_portee: 1.6,
};

export function directionCardinale(x: number, y: number, face: number): [number, number] {
  const norme = Math.hypot(x, y);
  return norme < 1e-6
    ? [face, 0]
    : y / norme < -0.57
      ? [0, -1]
      : [Math.abs(x / norme) > 0.05 ? Math.sign(x) : face, 0];
}

export const tourner = (x: number, y: number, angle: number): [number, number] => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
];

export class ArmeJoueur {
  joueur: any;
  combattant: any;
  combat: any;
  stats: any = { ...statsArcDefaut };
  bonus: any = {};
  chargePrete = false;
  combo = 0;
  aTire = new Signal();
  aFrappe = new Signal();
  recharge = 0;
  repos = 0;
  comboTemps = 0;
  meleeRecharge = 0;
  sillageTic = 0;
  flux: Flux;

  constructor(joueur: any, combattant: any, combat: any, graine = "partie", id = "") {
    this.joueur = joueur;
    this.combattant = combattant;
    this.combat = combat;
    this.flux = new Flux(`${graine}|arme_joueur|${id}`);
  }

  stat(cle: string, defaut = 0): number {
    const v = this.stats[cle];
    return (
      (typeof v == "number" ? v : typeof v == "boolean" ? +!!v : defaut) + (this.bonus[cle] ?? 0)
    );
  }

  drapeau(cle: string): boolean {
    return this.stat(cle, 0) > 0;
  }

  pas(dt: number) {
    if (!this.combattant.vivant) return;
    if (this.joueur.aubergine) {
      this.chargePrete = false;
      return;
    }
    const t = this.joueur.intention;
    this.recharge -= dt;
    this.repos += dt;
    this.meleeRecharge -= dt;
    this.comboTemps -= dt;
    if (this.comboTemps <= 0) this.combo = 0;
    this.chargePrete = this.repos >= this.stat("temps_charge", 0.9);
    const tirAutorise = this.joueur.etat !== EtatJoueur.DASH || this.drapeau("tir_en_dash");
    if (t.meleePresse && this.meleeRecharge <= 0) this.melee();
    else if (t.tir && this.recharge <= 0 && tirAutorise) this.tirer(this.chargePrete);
    if (this.joueur.etat === EtatJoueur.DASH && this.drapeau("sillage")) this.sillage(dt);
  }

  directionTir(): [number, number] {
    const intention = this.joueur.intention,
      joueur = this.joueur;
    let x = intention.viseeX,
      y = intention.viseeY;
    if (x === 0 && y === 0) {
      x = joueur.face;
      if (intention.deplacementY < -0.5) {
        x = 0;
        y = -1;
      }
    }
    return directionCardinale(x, y, joueur.face);
  }

  attaque(charge: boolean) {
    return {
      base: this.stat("base", 10),
      chance_critique: this.stat("chance_critique", 0.05),
      mult_critique: this.stat("mult_critique", 1.75),
      mult_charge: this.stat("mult_charge", 3),
      recul: this.stat("recul", 90) * (charge ? 2 : 1),
      bonus_degats: this.stat("bonus_degats", 0),
      element: typeof this.stats.element == "number" ? this.stats.element : Element.NEUTRE,
      statuts: this.stats.statuts ?? [],
      vol_de_vie: this.stat("vol_de_vie", 0),
      degats_elites: this.stat("degats_elites", 0),
    };
  }

  tirer(charge: boolean) {
    const [dx, dy] = this.directionTir();
    if (Math.abs(dx) > 0.15) this.joueur.face = dx > 0 ? 1 : -1;
    let nombre = Math.max(1, Math.round(this.stat("multi", 1)));
    const eventail = charge && this.drapeau("eventail_charge");
    if (eventail) nombre = Math.max(nombre, 5);
    const dispersion = (this.stat("dispersion", 0) * Math.PI) / 180,
      ecart = this.stat("ecart", 0);
    for (let i = 0; i < nombre; i++) {
      let dir: [number, number] = [dx, dy],
        decalage = [0, 0];
      const u = i - (nombre - 1) / 2;
      if (eventail) dir = tourner(dx, dy, (u * 12 * Math.PI) / 180);
      else if (ecart > 0) decalage = [-dy * u * ecart, dx * u * ecart];
      else if (nombre > 1) dir = tourner(dx, dy, (u * 8 * Math.PI) / 180);
      if (dispersion > 0) dir = tourner(dir[0], dir[1], this.flux.randfRange(-dispersion, dispersion) * 0.5);
      this.projectile(dir, decalage, charge);
    }
    this.recharge = 1 / this.stat("cadence", 5);
    this.repos = 0;
    this.chargePrete = false;
    this.aTire.emettre(charge, dx, dy);
  }

  projectile(dir: number[], decalage: number[], charge: boolean) {
    const point = this.joueur.pointTir(dir[1] < -0.5);
    if (this.combat.dansMur(point.x, point.y)) point.x = this.joueur.x;
    const p = new Projectile();
    p.x = point.x + decalage[0];
    p.y = point.y + decalage[1];
    const vitesseBase = this.stat("vitesse", 26) * 16,
      vitesse = vitesseBase * (charge ? 1.25 : 1);
    p.vx = dir[0] * vitesse;
    p.vy = dir[1] * vitesse;
    p.rayon = charge ? 6 : 4;
    p.camp = Camp.JOUEUR;
    p.attaque = this.attaque(charge);
    p.charge = charge;
    // Portée en tuiles : la durée de vie est dérivée de la vitesse réelle pour
    // que la distance parcourue soit exactement `portee` tuiles (+50% en tir
    // chargé), indépendamment des bonus de vitesse (affixe vitesse_tir) : la
    // vitesse ne change que le temps d'impact, pas la portée. Axe de progression.
    p.vie = (this.stat("portee", 7.5) * 16 * (charge ? 1.5 : 1)) / Math.max(64, vitesse);
    p.perce = charge
      ? this.stat("perce_charge", 2) + this.stat("perce", 0)
      : this.stat("perce", 0);
    p.rebonds = this.stat("rebonds", 0);
    p.guidage = this.stat("guidage", 0);
    p.gravite = this.stat("gravite", 0) * 16;
    p.explosion = this.stat("explosion", 0) * (charge ? 1.3 : 1);
    if (p.explosion > 0 && p.explosion < 1) p.explosion = 1.2;
    p.grappe = this.stat("grappe", 0);
    p.visuel =
      String(this.stats.visuel ?? "") ||
      (this.stats.classe === "canon" ? "boule_feu" : charge ? "fleche_chargee" : "fleche");
    p.source = String(this.stats.id);
    p.auteur = this.combattant;
    this.combat.tirer(p);
  }

  melee() {
    this.combo = (this.combo % 3) + 1;
    const j = this.joueur,
      portee = this.stat("melee_portee", 1.6) * 16,
      hauteur = j.corps.hauteur;
    let zone = { x: j.x + (j.face > 0 ? 0 : -portee), y: j.y - hauteur - 4, l: portee, h: hauteur + 8 };
    if (this.combo === 3 && this.drapeau("tourbillon"))
      zone = { x: j.x - portee * 1.3, y: j.y - hauteur - 10, l: portee * 2.6, h: hauteur + 20 };
    const attaque = this.attaque(this.combo === 3);
    attaque.base = this.stat("melee_base", 14);
    attaque.recul = this.stat("recul", 90) * (this.combo === 3 ? 2.5 : 1.2);
    this.combat.frapperZone(
      zone,
      Camp.JOUEUR,
      attaque,
      this.combo === 3,
      j.face,
      -0.3,
      this.combattant,
      `${String(this.stats.id)}_melee`,
    );
    if (this.drapeau("renvoi"))
      this.combat.renvoyer(
        { x: zone.x - 6, y: zone.y - 6, l: zone.l + 12, h: zone.h + 12 },
        this.combattant,
      );
    this.comboTemps = 0.55;
    // Cadence de mêlée héritée du poids de l'arme (inverse de la cadence de tir) :
    // massues/canons frappent lentement mais fort, griffes/palmes enchaînent vite.
    this.meleeRecharge = Math.max(0.2, Math.min(0.6, 0.9 / this.stat("cadence", 5)));
    this.aFrappe.emettre(this.combo);
  }

  sillage(dt: number) {
    this.sillageTic -= dt;
    if (this.sillageTic > 0) return;
    this.sillageTic = 0.05;
    const attaque = this.attaque(false);
    attaque.base = this.stat("base", 10) * 0.6;
    attaque.element = Element.FEU;
    attaque.statuts = [{ id: "brulure", duree: 2, puissance: 2 }];
    const boite = this.combattant.boiteMonde();
    this.combat.frapperZone(
      { x: boite.x - 6, y: boite.y - 6, l: boite.l + 12, h: boite.h + 12 },
      Camp.JOUEUR,
      attaque,
      false,
      this.joueur.face,
      0,
      this.combattant,
      "sillage",
    );
  }
}