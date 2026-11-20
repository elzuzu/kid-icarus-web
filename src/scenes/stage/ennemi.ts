import { O as Signal } from "../../app";
import { Corps } from "./corps";
import { Camp, Combattant, Element, Projectile } from "./combat";

const dureeEtourdi = 0.12;

export class Ennemi {
  def: any;
  combat: any;
  niveau: any;
  cible: any;
  rng: any;
  corps: Corps;
  combattant: Combattant;
  comportement: any;
  volant: boolean;
  face = -1;
  age = 0;
  elites: any[] = [];
  etatVisuel = "idle";
  mortDepuis = -1;
  vitesseMult = 1;
  taille: { x: number; y: number };
  fondu = 0;
  meta: any = {};
  disparu = false;
  etourdi = 0;
  eliteTemps = 0;
  invocation = new Signal();
  aDisparu = new Signal();
  tue = new Signal();

  constructor(def: any, combat: any, niveau: any, cible: any, rng: any, fabrique: any) {
    this.def = def;
    this.combat = combat;
    this.niveau = niveau;
    this.cible = cible;
    this.rng = rng;
    this.volant = !!def.volant;
    const taille = def.taille ?? [1, 1];
    this.taille = { x: taille[0] * 16, y: taille[1] * 16 };
    this.corps = new Corps(niveau, this.taille.x * 0.9, this.taille.y);
    const soi = this;
    this.combattant = new Combattant(
      {
        get x() {
          return soi.corps.x;
        },
        get y() {
          return soi.corps.y;
        },
        get face() {
          return soi.face;
        },
      },
      Camp.ENNEMI,
      def.pv ?? 10,
      def.id,
    );
    this.combattant.proprietaire = this;
    this.combattant.boite = {
      x: -this.taille.x / 2,
      y: -this.taille.y,
      l: this.taille.x,
      h: this.taille.y,
    };
    const zone = def.zone_touche;
    if (zone)
      this.combattant.boiteTouche = {
        x: zone[0] * 16,
        y: zone[1] * 16,
        l: zone[2] * 16,
        h: zone[3] * 16,
      };
    this.combattant.defense = def.defense ?? 0;
    for (const [cle, valeur] of Object.entries(def.resistances ?? {}))
      this.combattant.resistances[Number(cle)] = valeur as number;
    this.combattant.degatsContact =
      def.contact && Object.keys(def.contact).length ? { ...def.contact } : null;
    this.combattant.touche.connecter((coup: any) => this.surCoup(coup));
    this.combattant.mort.connecter((coup: any) => this.surMort(coup));
    this.comportement = fabrique(def.comportement ?? "marcheur", def.params ?? {});
  }

  get x() {
    return this.corps.x;
  }

  get y() {
    return this.corps.y;
  }

  get vx() {
    return this.corps.vx;
  }

  set vx(v: number) {
    this.corps.vx = v;
  }

  get vy() {
    return this.corps.vy;
  }

  set vy(v: number) {
    this.corps.vy = v;
  }

  placer(x: number, y: number) {
    this.corps.x = x;
    this.corps.y = y;
  }

  demarrer() {
    this.comportement.demarrer(this);
  }

  vitesse(): number {
    return (this.def.vitesse ?? 2) * 16 * this.vitesseMult * this.combattant.facteurVitesse();
  }

  estAuSol(): boolean {
    return this.corps.auSol;
  }

  retirer() {
    if (!this.disparu) {
      this.disparu = true;
      this.aDisparu.emettre(this);
    }
  }

  pas(dt: number) {
    if (this.disparu) return;
    this.age += dt;
    if (!this.combattant.vivant) {
      this.mortDepuis += dt;
      if (this.mortDepuis >= 0.7) {
        this.disparu = true;
        this.aDisparu.emettre(this);
      }
      return;
    }
    if (this.etourdi > 0) {
      this.etourdi -= dt;
      const norme = Math.hypot(this.vx, this.vy),
        pas = 900 * dt;
      if (norme <= pas) {
        this.vx = 0;
        this.vy = 0;
      } else {
        this.vx -= (this.vx / norme) * pas;
        this.vy -= (this.vy / norme) * pas;
      }
    } else this.comportement.simuler(this, dt);
    if (this.elites.length) this.pasElite(dt);
    if (this.volant) {
      this.corps.x += this.vx * dt;
      this.corps.y += this.vy * dt;
      if (this.niveau.boucle) {
        const largeurPx = this.niveau.largeurPx();
        if (this.corps.x < 0 || this.corps.x >= largeurPx)
          this.corps.x = ((this.corps.x % largeurPx) + largeurPx) % largeurPx;
      }
    } else {
      if (!this.corps.auSol) this.vy = Math.min(this.vy + 900 * dt, 380);
      this.corps.deplacer(dt);
    }
  }

  versCible() {
    if (!this.cible) return { x: 0, y: 0 };
    const cible = this.cible.centre(),
      moi = this.centre();
    let dx = cible.x - moi.x;
    if (this.niveau.boucle) {
      const largeurPx = this.niveau.largeurPx();
      dx = ((((dx + largeurPx / 2) % largeurPx) + largeurPx) % largeurPx) - largeurPx / 2;
    }
    return { x: dx, y: cible.y - moi.y };
  }

  centre() {
    return { x: this.corps.x, y: this.corps.y - this.taille.y / 2 };
  }

  cibleVivante(): boolean {
    return !!this.cible && this.cible.vivant && !this.cible.invisible;
  }

  solDevant(): boolean {
    const col = Math.floor((this.corps.x + this.face * (this.taille.x / 2 + 2)) / 16),
      ligne = Math.floor((this.corps.y + 4) / 16);
    return this.niveau.estAppui(col, ligne);
  }

  murDevant(): boolean {
    const col = Math.floor((this.corps.x + this.face * (this.taille.x / 2 + 2)) / 16),
      ligne = Math.floor((this.corps.y - this.taille.y / 2) / 16);
    return this.niveau.estBloquant(col, ligne);
  }

  tirer(dirX: number, dirY: number, options: any) {
    const norme = Math.hypot(dirX, dirY) || 1,
      nx = dirX / norme,
      ny = dirY / norme,
      p = new Projectile(),
      centre = this.centre();
    p.x = options.origine ? options.origine.x : centre.x + nx * this.taille.x * 0.5;
    p.y = options.origine ? options.origine.y : centre.y + ny * this.taille.x * 0.5;
    const vitesse = (options.vitesse ?? 8) * 16;
    p.vx = nx * vitesse;
    p.vy = ny * vitesse;
    p.gravite = (options.gravite ?? 0) * 16;
    p.rayon = options.rayon === void 0 ? 5 : options.rayon * 16;
    p.camp = Camp.ENNEMI;
    const mult =
      Number(this.meta.mult_degats_intensite ?? 1) * Number(this.meta.degats_mult ?? 1);
    p.attaque = {
      base: (options.base ?? 10) * mult,
      element: options.element ?? Element.NEUTRE,
      recul: 120,
      chance_critique: 0,
    };
    if (options.statuts) p.attaque.statuts = options.statuts;
    p.vie = options.vie ?? 3;
    p.visuel = options.visuel ?? "boule_feu";
    p.source = this.def.id;
    p.auteur = this.combattant;
    return this.combat.tirer(p);
  }

  surCoup(coup: any) {
    if (this.combattant.vivant && this.combattant.sensibiliteRecul > 0) {
      this.vx = coup.reculX;
      this.vy = coup.reculY;
      this.etourdi = dureeEtourdi;
    }
    this.comportement.surCoup(this, coup);
  }

  pasElite(dt: number) {
    this.eliteTemps += dt;
    const invocation = this.meta.elite_invocation;
    if (typeof invocation == "string" && this.eliteTemps >= Number(this.meta.elite_intervalle ?? 6)) {
      this.eliteTemps = 0;
      const c = this.centre();
      this.invocation.emettre(invocation, c.x, c.y - 24);
    }
    const teleportation = this.meta.elite_teleportation;
    if (typeof teleportation == "number" && this.eliteTemps >= teleportation && this.cibleVivante() && this.cible) {
      this.eliteTemps = 0;
      const sens = this.rng.randf() < 0.5 ? -1 : 1,
        x = this.cible.x + sens * 4 * 16,
        y = this.cible.y - 32;
      if (this.volant || !this.niveau.estBloquant(Math.floor(x / 16), Math.floor(y / 16)))
        this.placer(x, y);
    }
  }

  surMort(_coup: any) {
    const explosion = this.meta.elite_explosion_mort;
    if (typeof explosion == "number") {
      const c = this.centre();
      this.combat.exploser(
        c.x,
        c.y,
        explosion,
        Camp.ENNEMI,
        {
          base: 18 * Number(this.meta.mult_degats_intensite ?? 1),
          chance_critique: 0,
          element: Element.FEU,
        },
        this.combattant,
        this.def.id,
      );
    }
    this.mortDepuis = 0;
    this.etatVisuel = "mort";
    this.vx = 0;
    this.vy = 0;
    this.tue.emettre(this);
  }
}