import { O as Signal, w as Intention } from "../../app";
import { Corps } from "./corps";

export const dureeInvulnerabiliteBase = 1.2;
const vitesseVolLibre = 9;
const accelerationVolLibre = 70;

export enum EtatJoueur {
  SOL = 0,
  AIR = 1,
  DASH = 2,
}

export const approcher = (valeur: number, cible: number, pas: number): number =>
  valeur < cible ? Math.min(valeur + pas, cible) : Math.max(valeur - pas, cible);

export function viseeHaut(intention: any): boolean {
  return intention.viseeX === 0 && intention.viseeY === 0
    ? intention.deplacementY < -0.5
    : intention.viseeY / Math.hypot(intention.viseeX, intention.viseeY) < -0.57;
}

export class PhysiqueJoueur {
  reglages: any;
  corps: Corps;
  etat = EtatJoueur.AIR;
  face = 1;
  accroupi = false;
  planant = false;
  sautsRestants = 1;
  jaugeVol = 1;
  invulnerable = 0;
  intention = new Intention();
  adherence = 1;
  vent = 0;
  multVitesse = 1;
  courant = 0;
  volLibre = false;
  traverseGrilles = false;
  traverseeInterdite = false;
  aubergine = false;
  dureeInvulnerabilite = dureeInvulnerabiliteBase;
  aSaute = new Signal();
  aAtterri = new Signal();
  aDashe = new Signal();
  aBoucle = new Signal();
  aFrappeVisuel = new Signal();
  impulsionMelee = 0;
  coyote = 0;
  tamponSaut = 0;
  sautCoupe = true;
  dashRestant = 0;
  dashRecharge = 0;
  dashAirDispo = true;
  dashDirection = 1;
  traversee = 0;

  constructor(reglages: any, niveau: any) {
    this.reglages = reglages;
    this.corps = new Corps(niveau, reglages.largeur, reglages.hauteur);
  }

  get x() {
    return this.corps.x;
  }

  get y() {
    return this.corps.y;
  }

  pointTir(haut = false) {
    const c = this.corps,
      nom = this.accroupi
        ? haut
          ? "haut_accroupi"
          : "accroupi"
        : c.auSol
          ? haut
            ? "haut_debout"
            : Math.abs(c.vx) > 20
              ? "course"
              : "debout"
          : haut
            ? "haut_air"
            : "air",
      point = this.reglages.pointsTir[nom];
    return { x: c.x + this.face * point.x, y: c.y - point.y };
  }

  centre() {
    return { x: this.corps.x, y: this.corps.y - this.corps.hauteur / 2 };
  }

  placerSurTuile(col: number, ligne: number) {
    this.corps.x = (col + 0.5) * 16;
    this.corps.y = (ligne + 1) * 16;
    this.corps.vx = this.corps.vy = 0;
    this.etat = EtatJoueur.AIR;
  }

  recevoirCoup(dirX: number) {
    this.invulnerable = this.dureeInvulnerabilite;
    const sens = Math.abs(dirX) > 0.1 ? Math.sign(dirX) : -this.face;
    this.corps.vx = sens * 5 * 16;
    this.corps.vy = -104;
    if (this.etat === EtatJoueur.DASH) this.etat = EtatJoueur.AIR;
    this.planant = false;
  }

  // Relais visuel/feel de la mêlée (l'attaque elle-même reste dans arme.ts) :
  // petite avancée de ~0.08 s, sans toucher aux i-frames ni au tuning.
  frapperMelee(combo: number) {
    this.impulsionMelee = 0.08;
    this.aFrappeVisuel.emettre(combo, this.face);
  }

  simuler(dt: number) {
    const t = this.intention,
      n = this.reglages,
      r = this.corps,
      auSol = r.auSol;
    this.decompter(dt);
    if (this.volLibre) {
      this.voler(t, dt);
      return;
    }
    if (auSol) {
      this.coyote = n.coyote;
      this.sautsRestants = 1;
      this.dashAirDispo = true;
      this.jaugeVol = Math.min(1, this.jaugeVol + dt / n.rechargeVol);
    }
    if (t.sautPresse) this.tamponSaut = n.tamponSaut;
    this.accroupi = auSol && t.deplacementY > 0.5 && this.etat !== EtatJoueur.DASH;
    this.ajusterHauteur(this.accroupi ? n.hauteurAccroupi : n.hauteur);
    if (this.accroupi && this.tamponSaut > 0 && r.surPlateforme && !this.traverseeInterdite) {
      this.tamponSaut = 0;
      this.traversee = n.traversee;
      r.opts.traversePlateformes = true;
      r.auSol = false;
      r.y += 2;
    }
    if (t.dashPresse && !this.aubergine && this.dashRecharge <= 0 && (auSol || this.dashAirDispo))
      this.commencerDash(t, auSol);
    r.opts.traverseGrilles = this.etat === EtatJoueur.DASH && this.traverseGrilles;
    if (
      this.etat === EtatJoueur.DASH &&
      this.tamponSaut > 0 &&
      (auSol || this.coyote > 0 || this.sautsRestants > 0)
    ) {
      this.etat = +!auSol;
      r.vx = this.dashDirection * n.vitesseCourse;
    }
    if (this.etat === EtatJoueur.DASH) {
      this.dashRestant -= dt;
      r.vx = this.dashDirection * n.vitesseDash;
      r.vy = 0;
      if (this.dashRestant <= 0) {
        this.etat = EtatJoueur.AIR;
        r.vx *= 0.45;
      }
    } else {
      this.courir(t, auSol, dt);
      this.sauter(t, auSol);
      this.tomber(t, auSol, dt);
    }
    const vyAvant = r.vy,
      // Lunge appliqué uniquement au déplacement puis retiré : vx simulé intact.
      impulsion =
        this.impulsionMelee > 0 && this.etat !== EtatJoueur.DASH
          ? this.face * n.vitesseCourse * 0.3
          : 0;
    r.vx += impulsion;
    const boucle = r.deplacer(dt);
    r.vx -= impulsion;
    if (r.auSol) {
      if (this.etat !== EtatJoueur.DASH) {
        if (this.etat === EtatJoueur.AIR && !auSol) this.aAtterri.emettre(vyAvant);
        this.etat = EtatJoueur.SOL;
      }
      this.planant = false;
    } else if (this.etat === EtatJoueur.SOL) this.etat = EtatJoueur.AIR;
    if (boucle !== 0) this.aBoucle.emettre(boucle);
  }

  decompter(dt: number) {
    this.coyote = Math.max(0, this.coyote - dt);
    this.tamponSaut = Math.max(0, this.tamponSaut - dt);
    this.dashRecharge = Math.max(0, this.dashRecharge - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.impulsionMelee = Math.max(0, this.impulsionMelee - dt);
    if (this.traversee > 0) {
      this.traversee -= dt;
      this.corps.opts.traversePlateformes = this.traversee > 0;
    }
  }

  courir(intention: any, auSol: boolean, dt: number) {
    const n = this.reglages;
    let cible =
      this.accroupi || (auSol && intention.tir && viseeHaut(intention))
        ? 0
        : intention.deplacementX * n.vitesseCourse * this.multVitesse;
    if (this.aubergine) cible *= 0.7;
    cible += this.vent * (auSol ? 0.5 : 1);
    let accel;
    accel = auSol
      ? Math.abs(cible) > 0.01
        ? n.accelerationSol
        : n.freinageSol
      : n.accelerationAir;
    if (auSol) accel *= this.adherence;
    this.corps.vx = approcher(this.corps.vx, cible, accel * dt);
    if (Math.abs(intention.deplacementX) > 0.2) this.face = intention.deplacementX > 0 ? 1 : -1;
  }

  sauter(intention: any, auSol: boolean) {
    const n = this.reglages,
      r = this.corps,
      descente = this.accroupi && this.corps.surPlateforme && !this.traverseeInterdite;
    if (this.tamponSaut > 0 && (auSol || this.coyote > 0) && !descente) {
      r.vy = -n.vitesseSaut;
      this.tamponSaut = 0;
      this.coyote = 0;
      this.sautCoupe = false;
      this.etat = EtatJoueur.AIR;
      r.auSol = false;
      this.aSaute.emettre(false);
    } else if (this.tamponSaut > 0 && !auSol && this.coyote <= 0 && this.sautsRestants > 0) {
      r.vy = -n.vitesseDoubleSaut;
      --this.sautsRestants;
      this.tamponSaut = 0;
      this.sautCoupe = false;
      this.aSaute.emettre(true);
    }
    if (!this.sautCoupe && r.vy < 0 && !intention.saut) {
      r.vy *= n.coupeSaut;
      this.sautCoupe = true;
    }
  }

  tomber(intention: any, auSol: boolean, dt: number) {
    const n = this.reglages,
      r = this.corps;
    if (auSol && r.vy >= 0 && this.courant <= 0) {
      this.planant = false;
      return;
    }
    let gravite = n.gravite;
    if (r.vy > 0) gravite *= n.multiplicateurChute;
    if (intention.saut && Math.abs(r.vy) < n.seuilApex) gravite *= n.graviteApex;
    r.vy = Math.min(r.vy + gravite * dt, n.chuteMax);
    if (this.courant > 0) r.vy = Math.max(r.vy - this.courant * dt, -n.vitesseSaut * 1.1);
    // Un saut mis en tampon exprime l'intention de sauter à l'atterrissage :
    // on ne plane pas pendant ce délai, sinon la chute ralentie ferait expirer
    // le tampon avant le sol et le buffer serait inopérant en maintenant saut.
    this.planant = intention.saut && r.vy > 0 && this.jaugeVol > 0 && this.tamponSaut <= 0;
    if (this.planant) {
      r.vy = Math.min(r.vy, n.vitessePlane);
      this.jaugeVol = Math.max(0, this.jaugeVol - dt / n.dureeVol);
    }
  }

  voler(intention: any, dt: number) {
    const n = this.reglages,
      r = this.corps;
    this.accroupi = false;
    this.planant = true;
    this.face = 1;
    if (intention.dashPresse && this.dashRecharge <= 0) {
      const norme = Math.hypot(intention.deplacementX, intention.deplacementY),
        [dx, dy] =
          norme > 0.2
            ? [intention.deplacementX / norme, intention.deplacementY / norme]
            : [1, 0];
      r.vx = dx * n.vitesseDash * 0.8;
      r.vy = dy * n.vitesseDash * 0.8;
      this.dashRecharge = n.rechargeDash;
      this.invulnerable = Math.max(this.invulnerable, n.invulnerabiliteDash);
      this.aDashe.emettre(1);
    } else {
      const norme = Math.max(1, Math.hypot(intention.deplacementX, intention.deplacementY)),
        vitesse = vitesseVolLibre * 16,
        cx = (intention.deplacementX / norme) * vitesse,
        cy = (intention.deplacementY / norme) * vitesse,
        ex = cx - r.vx,
        ey = cy - r.vy,
        ecart = Math.hypot(ex, ey),
        pas = accelerationVolLibre * 16 * dt;
      if (ecart <= pas) {
        r.vx = cx;
        r.vy = cy;
      } else {
        r.vx += (ex / ecart) * pas;
        r.vy += (ey / ecart) * pas;
      }
    }
    this.etat = EtatJoueur.AIR;
    const boucle = r.deplacer(dt);
    if (boucle !== 0) this.aBoucle.emettre(boucle);
  }

  commencerDash(intention: any, auSol: boolean) {
    const n = this.reglages;
    if (Math.abs(intention.deplacementX) > 0.2) this.face = intention.deplacementX > 0 ? 1 : -1;
    this.dashDirection = this.face;
    this.dashRestant = n.dureeDash;
    this.dashRecharge = n.rechargeDash;
    this.invulnerable = Math.max(this.invulnerable, n.invulnerabiliteDash);
    if (!auSol) this.dashAirDispo = false;
    this.etat = EtatJoueur.DASH;
    this.planant = false;
    this.aDashe.emettre(this.dashDirection);
  }

  ajusterHauteur(hauteur: number) {
    if (Math.abs(this.corps.hauteur - hauteur) < 0.01) return;
    if (hauteur > this.corps.hauteur && this.corps.chevauche(this.corps.x, this.corps.y, hauteur)) return;
    this.corps.hauteur = hauteur;
  }
}

const pointsTir = [
  "debout",
  "course",
  "accroupi",
  "air",
  "haut_debout",
  "haut_air",
  "haut_accroupi",
];

export class ReglagesJoueur {
  vitesseCourse = 0;
  accelerationSol = 0;
  freinageSol = 0;
  accelerationAir = 0;
  gravite = 0;
  vitesseSaut = 0;
  vitesseDoubleSaut = 0;
  multiplicateurChute = 0;
  chuteMax = 0;
  coupeSaut = 0;
  seuilApex = 0;
  graviteApex = 0;
  vitessePlane = 0;
  dureeVol = 0;
  rechargeVol = 0;
  vitesseDash = 0;
  dureeDash = 0;
  rechargeDash = 0;
  invulnerabiliteDash = 0;
  coyote = 0;
  tamponSaut = 0;
  traversee = 0;
  largeur = 0;
  hauteur = 0;
  hauteurAccroupi = 0;
  pointsTir: Record<string, { x: number; y: number }> = {};
  brut: any = {};

  static depuis(brut: any): ReglagesJoueur {
    const r = new ReglagesJoueur();
    r.appliquer(brut);
    return r;
  }

  appliquer(brut: any) {
    this.brut = brut;
    const t = (cle: string): number => {
      const v = brut[cle];
      if (typeof v != "number") throw Error(`Réglage joueur manquant : ${cle}`);
      return v;
    };
    this.vitesseCourse = t("vitesse_course") * 16;
    this.accelerationSol = this.vitesseCourse / t("temps_acceleration");
    this.freinageSol = this.vitesseCourse / t("temps_freinage");
    this.accelerationAir = this.vitesseCourse / t("temps_acceleration_air");
    const hauteurSaut = t("hauteur_saut") * 16,
      tempsApex = t("temps_apex");
    this.gravite = (2 * hauteurSaut) / (tempsApex * tempsApex);
    this.vitesseSaut = (2 * hauteurSaut) / tempsApex;
    this.vitesseDoubleSaut = Math.sqrt(2 * this.gravite * t("hauteur_double_saut") * 16);
    this.multiplicateurChute = t("multiplicateur_chute");
    this.chuteMax = t("chute_max") * 16;
    this.coupeSaut = t("coupe_saut");
    this.seuilApex = t("seuil_apex") * 16;
    this.graviteApex = t("gravite_apex");
    this.vitessePlane = t("vitesse_plane") * 16;
    this.dureeVol = t("duree_vol");
    this.rechargeVol = t("recharge_vol");
    this.vitesseDash = t("vitesse_dash") * 16;
    this.dureeDash = t("duree_dash");
    this.rechargeDash = t("recharge_dash");
    this.invulnerabiliteDash = t("invulnerabilite_dash");
    this.coyote = t("coyote");
    this.tamponSaut = t("tampon_saut");
    this.traversee = t("traversee");
    this.largeur = t("largeur") * 16;
    this.hauteur = t("hauteur") * 16;
    this.hauteurAccroupi = t("hauteur_accroupi") * 16;
    for (const nom of pointsTir)
      this.pointsTir[nom] = {
        x: t(`tir_${nom}_x`) * 16,
        y: t(`tir_${nom}_y`) * 16,
      };
  }

  copier(): ReglagesJoueur {
    return ReglagesJoueur.depuis(this.brut);
  }
}