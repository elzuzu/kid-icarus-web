import { O as Signal } from "../../app";
import { options } from "../../app/options";
import { r as Flux } from "../../core";

export enum Element {
  NEUTRE = 0,
  FEU = 1,
  GLACE = 2,
  POISON = 3,
  FOUDRE = 4,
  LUMIERE = 5,
}

export class Coup {
  montant = 0;
  source = "";
  element = 0;
  critique = false;
  reculX = 0;
  reculY = 0;
  statuts: any[] = [];
  auteur: any = null;

  static simple(montant: number, source: string, reculX = 0, reculY = 0): Coup {
    const c = new Coup();
    c.montant = montant;
    c.source = source;
    c.reculX = reculX;
    c.reculY = reculY;
    return c;
  }
}

export function calculerCoup(attaque: any, cible: any, charge: boolean, flux: Flux): Coup {
  const coup = new Coup();
  coup.element = attaque.element ?? 0;
  let degats = (attaque.base ?? 1) * (1 + (attaque.bonus_degats ?? 0));
  if (charge) degats *= attaque.mult_charge ?? 3;
  if (flux.randf() < (attaque.chance_critique ?? 0.05)) {
    coup.critique = true;
    degats *= attaque.mult_critique ?? 1.75;
  }
  const resistance = Math.min(0.9, Math.max(-1, cible.resistances[coup.element] ?? 0));
  degats *= 1 - resistance;
  degats -= cible.defense;
  coup.montant = Math.max(1, Math.round(degats));
  return coup;
}

export enum Camp {
  JOUEUR = 0,
  ENNEMI = 1,
  NEUTRE = 2,
}

export class Combattant {
  corps: any;
  camp: Camp;
  pv: number;
  identifiant: string;
  boite = { x: -6, y: -20, l: 12, h: 20 };
  boiteTouche: any = null;
  pvMax: number;
  defense = 0;
  resistances: Record<number, number> = {};
  invulnerable = 0;
  invulnerabiliteCoup = 0;
  statuts = new Map<string, any>();
  vivant = true;
  sensibiliteRecul = 1;
  degatsContact: any = null;
  bouclier: any = null;
  multDegatsRecus = 1;
  elite = false;
  meta: any = {};
  proprietaire: any = null;
  touche = new Signal();
  mort = new Signal();

  constructor(corps: any, camp: Camp, pv: number, identifiant = "") {
    this.corps = corps;
    this.camp = camp;
    this.pv = pv;
    this.identifiant = identifiant;
    this.pvMax = pv;
  }

  boiteMonde() {
    return {
      x: this.corps.x + this.boite.x,
      y: this.corps.y + this.boite.y,
      l: this.boite.l,
      h: this.boite.h,
    };
  }

  boiteToucheMonde() {
    const b = this.boiteTouche;
    if (!b) return this.boiteMonde();
    const x = (this.corps.face ?? 1) < 0 ? -b.x - b.l : b.x;
    return { x: this.corps.x + x, y: this.corps.y + b.y, l: b.l, h: b.h };
  }

  centre() {
    const b = this.boiteMonde();
    return { x: b.x + b.l / 2, y: b.y + b.h / 2 };
  }

  peutEtreTouche(): boolean {
    return this.vivant && this.invulnerable <= 0 && !(this.bouclier?.() ?? false);
  }

  recevoir(coup: Coup): boolean {
    if (!this.peutEtreTouche()) return false;
    this.pv = Math.max(0, this.pv - coup.montant);
    this.invulnerable = this.invulnerabiliteCoup;
    for (const s of coup.statuts)
      this.statuts.set(s.id, {
        duree: s.duree,
        puissance: s.puissance ?? 1,
        tic: 0,
      });
    this.touche.emettre(coup);
    if (this.pv <= 0) {
      this.vivant = false;
      this.mort.emettre(coup);
    }
    return true;
  }

  soigner(montant: number) {
    if (this.vivant) this.pv = Math.min(this.pvMax, this.pv + montant);
  }

  avancer(dt: number): number {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    let degats = 0;
    for (const [id, statut] of [...this.statuts]) {
      statut.duree -= dt;
      statut.tic += dt;
      if ((id === "brulure" || id === "poison") && statut.tic >= 0.5) {
        statut.tic = 0;
        const tic = Math.max(1, Math.round(statut.puissance));
        this.pv = Math.max(0, this.pv - tic);
        degats += tic;
        if (this.pv <= 0 && this.vivant) {
          this.vivant = false;
          this.mort.emettre(Coup.simple(tic, id));
        }
      }
      if (statut.duree <= 0) this.statuts.delete(id);
    }
    return degats;
  }

  aStatut(id: string): boolean {
    return this.statuts.has(id);
  }

  facteurVitesse(): number {
    return this.statuts.has("gel") ? 0.5 : 1;
  }
}

export class Projectile {
  x = 0;
  y = 0;
  precX = 0;
  precY = 0;
  vx = 0;
  vy = 0;
  rayon = 3;
  camp = Camp.JOUEUR;
  attaque: any = {};
  charge = false;
  vie = 1;
  perce = 0;
  rebonds = 0;
  gravite = 0;
  guidage = 0;
  explosion = 0;
  grappe = 0;
  visuel = "fleche";
  source = "";
  auteur: any = null;
  actif = true;
  dejaTouches = new Set<any>();
}

export const cercleRect = (x: number, y: number, rayon: number, rect: any): boolean => {
  const cx = Math.min(Math.max(x, rect.x), rect.x + rect.l),
    cy = Math.min(Math.max(y, rect.y), rect.y + rect.h);
  return (x - cx) ** 2 + (y - cy) ** 2 <= rayon * rayon;
};

export const rectsChevauchent = (a: any, b: any): boolean =>
  a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.h && b.y < a.y + a.h;

export class Combat {
  niveau: any;
  combattants: Combattant[] = [];
  projectiles: Projectile[] = [];
  gelTicks = 0;
  // Hitstop global en secondes (rendu continu, simulation gelée par la boucle) ;
  // distinct de gelTicks qui est le micro-gel par coup existant.
  gelGlobal = 0;
  ticks = 0;
  flux: Flux;
  coupPorte = new Signal();
  projectileFini = new Signal();
  combattantMort = new Signal();
  coupBloque = new Signal();
  explosionSignal = new Signal();
  projectileTire = new Signal();
  joueurBlesse = new Signal();

  constructor(niveau: any, graine = "partie") {
    this.niveau = niveau;
    this.flux = new Flux(`${graine}|combat|${niveau?.id ?? "defaut"}`);
    // Pas de hitstop sur les dégâts subis par le joueur : le gel ne récompense que ses coups.
    this.combattantMort.connecter((cible: Combattant) => {
      if (cible.camp === Camp.ENNEMI) this.geler(0.07);
    });
    this.coupPorte.connecter((cible: Combattant, coup: Coup) => {
      if (coup.critique && cible.camp === Camp.ENNEMI) this.geler(0.045);
    });
  }

  geler(duree: number) {
    if (options.hitstop) this.gelGlobal = Math.max(this.gelGlobal, duree);
  }

  enregistrer(combattant: Combattant): Combattant {
    this.combattants.push(combattant);
    combattant.mort.connecter((coup: Coup) => this.combattantMort.emettre(combattant, coup));
    return combattant;
  }

  retirer(combattant: Combattant) {
    const i = this.combattants.indexOf(combattant);
    if (i >= 0) this.combattants.splice(i, 1);
  }

  viderProjectiles(camp: Camp) {
    this.projectiles = this.projectiles.filter((p) => p.camp !== camp);
  }

  estGele(): boolean {
    return this.gelTicks > 0;
  }

  tirer(projectile: Projectile): Projectile {
    projectile.precX = projectile.x;
    projectile.precY = projectile.y;
    this.projectiles.push(projectile);
    this.projectileTire.emettre(projectile);
    return projectile;
  }

  pas(dt: number): boolean {
    this.ticks += 1;
    if (this.gelTicks > 0) return (--this.gelTicks, false);
    for (const c of [...this.combattants]) {
      const degats = c.avancer(dt);
      if (degats > 0 && c.camp === Camp.JOUEUR) this.joueurBlesse.emettre(degats, "statut");
    }
    this.avancerProjectiles(dt);
    this.contacts();
    if (this.ticks % 60 == 0) this.projectiles = this.projectiles.filter((p) => p.actif);
    return true;
  }

  appliquer(cible: Combattant, attaque: any, charge: boolean, dirX: number, dirY: number, auteur: any, source: string): Coup {
    const norme = Math.hypot(dirX, dirY) || 1,
      nx = dirX / norme,
      ny = dirY / norme;
    if (cible.meta.bouclier_frontal && cible.vivant) {
      const face = cible.corps.face ?? 1;
      if (Math.abs(ny) < 0.6 && nx * face < 0) {
        this.coupBloque.emettre(cible, cible.centre());
        return Coup.simple(0, source);
      }
    }
    let effective = attaque;
    if (cible.elite && (attaque.degats_elites ?? 0) > 0)
      effective = {
        ...attaque,
        bonus_degats: (attaque.bonus_degats ?? 0) + (attaque.degats_elites ?? 0),
      };
    const coup = calculerCoup(
      effective,
      { defense: cible.defense, resistances: cible.resistances },
      charge,
      this.flux,
    );
    if (cible.multDegatsRecus !== 1)
      coup.montant = Math.max(1, Math.round(coup.montant * cible.multDegatsRecus));
    coup.source = source;
    coup.auteur = auteur;
    const recul = (attaque.recul ?? 100) * cible.sensibiliteRecul;
    coup.reculX = nx * recul;
    coup.reculY = ny * recul;
    for (const s of attaque.statuts ?? []) coup.statuts.push(s);
    if (!cible.recevoir(coup)) {
      coup.montant = 0;
      return coup;
    }
    this.coupPorte.emettre(cible, coup, cible.centre());
    this.gelTicks = Math.max(this.gelTicks, charge || coup.critique || !cible.vivant ? 5 : 2);
    let vol = attaque.vol_de_vie ?? 0;
    if (auteur?.meta.elite_vol_de_vie) vol = Math.max(vol, auteur.meta.elite_vol_de_vie);
    if (vol > 0 && auteur && auteur.vivant)
      auteur.soigner(Math.max(1, Math.round(coup.montant * vol)));
    if (cible.camp === Camp.JOUEUR) this.joueurBlesse.emettre(coup.montant, source);
    return coup;
  }

  renvoyer(zone: any, auteur: any): number {
    let n = 0;
    for (const p of this.projectiles)
      if (
        p.actif &&
        p.camp === Camp.ENNEMI &&
        !(p.x < zone.x || p.x > zone.x + zone.l || p.y < zone.y || p.y > zone.y + zone.h)
      ) {
        p.vx = -p.vx * 1.3;
        p.vy = -p.vy * 1.3;
        p.camp = Camp.JOUEUR;
        p.attaque = { ...p.attaque, base: (p.attaque.base ?? 10) * 1.5 };
        p.dejaTouches.clear();
        p.auteur = auteur;
        p.source = "renvoi";
        this.coupBloque.emettre(auteur, { x: p.x, y: p.y });
        n++;
      }
    return n;
  }

  frapperZone(zone: any, camp: Camp, attaque: any, charge: boolean, dirX: number, dirY: number, auteur: any, source: string): number {
    let n = 0;
    for (const c of [...this.combattants])
      if (this.adversaires(camp, c) && c.peutEtreTouche() && rectsChevauchent(zone, c.boiteToucheMonde())) {
        this.appliquer(c, attaque, charge, dirX, dirY, auteur, source);
        n++;
      }
    return n;
  }

  plusProche(x: number, y: number, camp: Camp, portee: number): Combattant | null {
    let proche: Combattant | null = null,
      meilleur = portee * portee;
    for (const c of this.combattants) {
      if (!this.adversaires(camp, c) || !c.vivant) continue;
      const e = this.ecart(x, y, c.centre().x, c.centre().y),
        d2 = e.x * e.x + e.y * e.y;
      if (d2 < meilleur) {
        meilleur = d2;
        proche = c;
      }
    }
    return proche;
  }

  avancerProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.actif) continue;
      p.precX = p.x;
      p.precY = p.y;
      p.vie -= dt;
      if (p.vie <= 0) {
        this.finir(p, false);
        continue;
      }
      if (p.guidage > 0) {
        const cible = this.plusProche(p.x, p.y, p.camp, 160);
        if (cible) {
          const e = this.ecart(p.x, p.y, cible.centre().x, cible.centre().y),
            visee = Math.atan2(e.y, e.x),
            vitesse = Math.hypot(p.vx, p.vy);
          let angle = Math.atan2(p.vy, p.vx),
            delta = visee - angle;
          while (delta > Math.PI) delta -= 2 * Math.PI;
          while (delta < -Math.PI) delta += 2 * Math.PI;
          angle += Math.max(-p.guidage * dt, Math.min(p.guidage * dt, delta));
          p.vx = Math.cos(angle) * vitesse;
          p.vy = Math.sin(angle) * vitesse;
        }
      }
      p.vy += p.gravite * dt;
      const nx = p.x + p.vx * dt,
        ny = p.y + p.vy * dt;
      if (this.dansMur(nx, ny)) {
        if (p.rebonds > 0) {
          --p.rebonds;
          if (this.dansMur(nx, p.y)) p.vx = -p.vx;
          if (this.dansMur(p.x, ny)) p.vy = -p.vy;
        } else {
          p.x = nx;
          p.y = ny;
          this.finir(p, true);
          continue;
        }
      } else {
        p.x = nx;
        p.y = ny;
      }
      if (this.niveau?.boucle) {
        const largeurPx = this.niveau.largeurPx();
        if (p.x < 0 || p.x >= largeurPx) {
          const x = ((p.x % largeurPx) + largeurPx) % largeurPx;
          p.precX += x - p.x;
          p.x = x;
        }
      }
      this.toucher(p);
    }
  }

  toucher(p: Projectile) {
    for (const c of [...this.combattants]) {
      if (!p.actif) return;
      if (
        !this.adversaires(p.camp, c) ||
        !c.peutEtreTouche() ||
        p.dejaTouches.has(c) ||
        !cercleRect(p.x, p.y, p.rayon, c.boiteToucheMonde())
      )
        continue;
      let reflet = 0;
      if (p.camp === Camp.JOUEUR && c.meta.elite_reflet) reflet = c.meta.elite_reflet;
      else if (
        p.camp === Camp.ENNEMI &&
        c.meta.bouclier_miroir &&
        Math.sign(p.vx) === -(c.corps.face ?? 1)
      )
        reflet = c.meta.bouclier_miroir;
      if (reflet > 0 && this.flux.randf() < reflet) {
        p.vx = -p.vx;
        p.vy = -p.vy;
        p.camp = p.camp === Camp.JOUEUR ? Camp.ENNEMI : Camp.JOUEUR;
        p.dejaTouches.clear();
        p.auteur = c;
        p.source = "reflet_" + c.identifiant;
        this.coupBloque.emettre(c, { x: p.x, y: p.y });
        return;
      }
      this.appliquer(c, p.attaque, p.charge, p.vx, p.vy, p.auteur, p.source);
      p.dejaTouches.add(c);
      --p.perce;
      if (p.perce < 0) this.finir(p, false);
    }
  }

  contacts() {
    const joueurs = this.combattants.filter((c) => c.camp === Camp.JOUEUR && c.peutEtreTouche());
    if (joueurs.length) {
      for (const ennemi of this.combattants)
        if (ennemi.camp === Camp.ENNEMI && ennemi.vivant && ennemi.degatsContact) {
          for (const joueur of joueurs)
            if (joueur.peutEtreTouche() && rectsChevauchent(ennemi.boiteMonde(), joueur.boiteMonde())) {
              const e = this.ecart(
                ennemi.centre().x,
                ennemi.centre().y,
                joueur.centre().x,
                joueur.centre().y,
              );
              this.appliquer(joueur, ennemi.degatsContact, false, e.x, e.y, ennemi, ennemi.identifiant);
            }
        }
    }
  }

  finir(p: Projectile, mur: boolean) {
    p.actif = false;
    this.projectileFini.emettre(p, { x: p.x, y: p.y }, mur);
    if (!(p.explosion <= 0)) {
      this.exploser(p.x, p.y, p.explosion, p.camp, p.attaque, p.auteur, p.source);
      for (let i = 0; i < p.grappe; i++) {
        const g = new Projectile();
        g.x = p.x;
        g.y = p.y - 4;
        const angle = -Math.PI / 2 + (i - (p.grappe - 1) / 2) * 0.6;
        g.vx = Math.cos(angle) * 170;
        g.vy = Math.sin(angle) * 170;
        g.gravite = 480;
        g.camp = p.camp;
        g.attaque = { ...p.attaque, base: (p.attaque.base ?? 10) * 0.45 };
        g.vie = 1.2;
        g.visuel = "boule_feu";
        g.explosion = p.explosion * 0.55;
        g.source = p.source;
        g.auteur = p.auteur;
        this.tirer(g);
      }
    }
  }

  exploser(x: number, y: number, rayon: number, camp: Camp, attaque: any, auteur: any, source: string) {
    const portee = rayon * 16,
      degats = { ...attaque, base: (attaque.base ?? 10) * 0.7 };
    for (const c of [...this.combattants])
      if (this.adversaires(camp, c) && c.peutEtreTouche() && cercleRect(x, y, portee, c.boiteToucheMonde())) {
        const e = this.ecart(x, y, c.centre().x, c.centre().y);
        this.appliquer(c, degats, false, e.x, e.y, auteur, source + "_explosion");
      }
    this.explosionSignal.emettre({ x, y }, portee, camp);
  }

  dansMur(x: number, y: number): boolean {
    if (!this.niveau) return false;
    const ligne = Math.floor(y / 16);
    return ligne >= this.niveau.hauteur ? false : this.niveau.estBloquant(Math.floor(x / 16), ligne);
  }

  adversaires(camp: Camp, cible: Combattant): boolean {
    return cible.camp === Camp.NEUTRE ? camp === Camp.JOUEUR : cible.camp !== camp;
  }

  ecart(x1: number, y1: number, x2: number, y2: number) {
    let dx = x2 - x1,
      dy = y2 - y1;
    if (this.niveau?.boucle) {
      const largeurPx = this.niveau.largeurPx();
      dx = ((((dx + largeurPx / 2) % largeurPx) + largeurPx) % largeurPx) - largeurPx / 2;
    }
    return { x: dx, y: dy };
  }
}