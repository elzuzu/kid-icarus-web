import { n as largeurEcran, t as hauteurEcran } from "../../core";
import { secoussesActives, techart } from "../../render/ambiance";

export enum ModeCamera {
  RAIL = 0,
  SUIVI = 1,
  SALLE = 2,
  ARENE = 3,
  DEFILEMENT = 4,
}

const decalageRail = 1.5;
const decalageSuivi = 2.2;
const zoneMorte = 1.5;
// Lookahead horizontal amorti : ~24 px de regard dans le sens de la course.
const regardMax = 24;

export class Camera {
  niveau: any;
  cible: any;
  mode = ModeCamera.RAIL;
  cx = 0;
  cy = 0;
  precedentX = 0;
  precedentY = 0;
  salle: any = null;
  salleAuto = false;
  pointFixeX = 0;
  pointFixeY = 0;
  vitesseDefilement = 0;
  trauma = 0;
  solReference: (() => number) | null = null;
  // Regard lissé (vitesse estimée) + horloge de drift vertical.
  regardX = 0;
  dernierCentreX = 0;
  tempsDrift = 0;
  driftPrecedent = 0;

  constructor(niveau: any, cible: any) {
    this.niveau = niveau;
    this.cible = cible;
    this.dernierCentreX = cible.centre().x;
    techart.camera = this;
  }

  static demi() {
    return { x: largeurEcran / 4 / 2, y: hauteurEcran / 4 / 2 };
  }

  configurer(mode: ModeCamera) {
    this.mode = mode;
    const centre = this.cible.centre();
    if (mode === ModeCamera.RAIL) {
      this.cx = this.niveau.largeurPx() / 2;
      this.cy = this.cibleRail();
    } else if (mode === ModeCamera.SUIVI) {
      this.cx = centre.x;
      this.cy = centre.y - decalageSuivi * 16;
    } else if (mode === ModeCamera.DEFILEMENT) {
      this.cx = 0;
      this.cy = this.niveau.hauteurPx() / 2;
    } else {
      this.cx = centre.x;
      this.cy = centre.y;
    }
    this.borner();
    this.precedentX = this.cx;
    this.precedentY = this.cy;
    this.regardX = 0;
    this.dernierCentreX = centre.x;
  }

  basVisible(): number {
    return this.cy + Camera.demi().y;
  }

  pas(dt: number) {
    this.precedentX = this.cx;
    this.precedentY = this.cy;
    const lissage = 1 - Math.exp(-7 * dt),
      centre = this.cible.centre();
    // Lookahead horizontal : vitesse estimée bornée, regard amorti (~24 px max)
    // vers l'avant du joueur. N'affecte QUE les modes libres (SUIVI/SALLE).
    const vx = dt > 0 ? Math.max(-400, Math.min(400, (centre.x - this.dernierCentreX) / dt)) : 0;
    this.dernierCentreX = centre.x;
    const regardCible = Math.max(-regardMax, Math.min(regardMax, vx * 0.14)) + this.cible.face * 6;
    this.regardX += (regardCible - this.regardX) * (1 - Math.exp(-3.5 * dt));
    this.tempsDrift += dt;
    // Drift vertical subtil ±2.5 px, appliqué en delta après le lissage. Les modes
    // RAIL/ARENE/DEFILEMENT ne le reçoivent jamais ; borner() ré-applique ensuite
    // le verrou cy (stages horizontaux à hauteur fixe) — le verrou gagne toujours.
    const driftY =
      Math.sin((this.tempsDrift * Math.PI * 2) / 9) * 1.6 +
      Math.sin((this.tempsDrift * Math.PI * 2) / 14.7) * 0.9;
    switch (this.mode) {
      case ModeCamera.RAIL: {
        const cible = this.cibleRail();
        if (cible < this.cy) this.cy += (cible - this.cy) * lissage;
        break;
      }
      case ModeCamera.SUIVI: {
        const cibleX = centre.x + this.regardX,
          cibleY = centre.y - decalageSuivi * 16;
        this.cx += (cibleX - this.cx) * lissage * 0.6;
        const ecart = cibleY - this.cy,
          marge = zoneMorte * 16;
        if (Math.abs(ecart) > marge) this.cy += (cibleY - Math.sign(ecart) * marge - this.cy) * lissage;
        this.cy += driftY - this.driftPrecedent;
        break;
      }
      case ModeCamera.SALLE:
        if (this.salleAuto) this.salle = this.rectSalle(centre.x, centre.y);
        this.cx += (centre.x + this.regardX * 0.5 - this.cx) * lissage;
        this.cy += (centre.y - this.cy) * lissage + (driftY - this.driftPrecedent) * 0.6;
        break;
      case ModeCamera.ARENE:
        this.cx += (this.pointFixeX - this.cx) * lissage * 0.5;
        this.cy += (this.pointFixeY - this.cy) * lissage * 0.5;
        break;
      case ModeCamera.DEFILEMENT:
        this.cx += this.vitesseDefilement * dt;
    }
    this.driftPrecedent = driftY;
    this.borner();
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  secouer(intensite: number) {
    if (!secoussesActives()) return;
    this.trauma = Math.min(1, this.trauma + intensite);
  }

  recaler() {
    const centre = this.cible.centre();
    if (this.mode === ModeCamera.RAIL) this.cy = this.cibleRail();
    else if (this.mode === ModeCamera.ARENE) {
      this.cx = this.pointFixeX;
      this.cy = this.pointFixeY;
    } else if (this.mode === ModeCamera.DEFILEMENT) this.cx = Math.max(this.cx, centre.x);
    else {
      if (this.mode === ModeCamera.SALLE && this.salleAuto)
        this.salle = this.rectSalle(centre.x, centre.y);
      this.cx = centre.x;
      this.cy = centre.y - (this.mode === ModeCamera.SUIVI ? decalageSuivi * 16 : 0);
    }
    this.borner();
    this.precedentX = this.cx;
    this.precedentY = this.cy;
    this.regardX = 0;
    this.dernierCentreX = centre.x;
  }

  cadrerArene(x: number, y: number, centrer = false) {
    this.mode = ModeCamera.ARENE;
    this.pointFixeX = centrer ? x : this.cx;
    this.pointFixeY = y;
  }

  cibleRail(): number {
    let y = this.cible.centre().y;
    if (this.solReference)
      y = Math.min(this.solReference() - this.cible.hauteurCorps / 2, y + 64);
    return y - decalageRail * 16;
  }

  rectSalle(x: number, y: number) {
    const taille = this.niveau.tailleSalle(),
      salle = this.niveau.salleDe({
        c: Math.floor(x / 16),
        l: Math.floor(y / 16),
      });
    return { x: salle.c * taille.c * 16, y: salle.l * taille.l * 16, l: taille.c * 16, h: taille.l * 16 };
  }

  borner() {
    const demi = Camera.demi(),
      cadre =
        this.mode === ModeCamera.SALLE && this.salle
          ? this.salle
          : {
              x: 0,
              y: 0,
              l: this.niveau.largeurPx(),
              h: this.niveau.hauteurPx(),
            };
    this.cx =
      this.mode === ModeCamera.RAIL
        ? cadre.l / 2
        : cadre.l > demi.x * 2
          ? Math.min(Math.max(this.cx, cadre.x + demi.x), cadre.x + cadre.l - demi.x)
          : cadre.x + cadre.l / 2;
    this.cy =
      cadre.h > demi.y * 2
        ? Math.min(Math.max(this.cy, cadre.y + demi.y), cadre.y + cadre.h - demi.y)
        : cadre.y + cadre.h / 2;
  }
}