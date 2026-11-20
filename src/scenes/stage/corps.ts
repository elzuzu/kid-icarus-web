import { a as Tuile } from "../../ui/hud";

export const tailleTuile = 16;
const pasCollision = 4;
const hauteurMarche = 8;
const toleranceSol = 6;
const epsilon = 0.01;

export class Corps {
  niveau: any;
  largeur: number;
  hauteur: number;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  auSol = false;
  auPlafond = false;
  auMur = 0;
  surPlateforme = false;
  opts = { traversePlateformes: false, traverseGrilles: false };

  constructor(niveau: any, largeur: number, hauteur: number) {
    this.niveau = niveau;
    this.largeur = largeur;
    this.hauteur = hauteur;
  }

  plein(col: number, ligne: number): boolean {
    const t = this.niveau.tuile(col, ligne);
    return (
      t === Tuile.SOLIDE ||
      t === Tuile.FRIABLE ||
      (t === Tuile.GRILLE && !this.opts.traverseGrilles)
    );
  }

  chevauche(x: number, y: number, hauteur = this.hauteur): boolean {
    const gauche = x - this.largeur / 2 + epsilon,
      droite = x + this.largeur / 2 - epsilon,
      haut = y - hauteur + epsilon,
      bas = y - epsilon;
    for (let ligne = Math.floor(haut / tailleTuile); ligne <= Math.floor(bas / tailleTuile); ligne++)
      for (let col = Math.floor(gauche / tailleTuile); col <= Math.floor(droite / tailleTuile); col++)
        if (this.plein(col, ligne)) return true;
    return false;
  }

  surfacePente(x: number, col: number, ligne: number): number | null {
    const t = this.niveau.tuile(col, ligne),
      dx = Math.min(tailleTuile, Math.max(0, x - col * tailleTuile));
    return t === Tuile.PENTE_MONTANTE
      ? (ligne + 1) * tailleTuile - dx
      : t === Tuile.PENTE_DESCENDANTE
        ? ligne * tailleTuile + dx
        : null;
  }

  surfaceSol(x: number, depuis: number, jusqua: number): { y: number; plateforme: boolean } | null {
    const resultat = { y: 1 / 0, plateforme: false },
      retenir = (y: number, plateforme: boolean) => {
        if (y >= depuis - epsilon && y <= jusqua + epsilon && y < resultat.y) {
          resultat.y = y;
          resultat.plateforme = plateforme;
        }
      },
      gauche = x - this.largeur / 2 + epsilon,
      droite = x + this.largeur / 2 - epsilon;
    for (let ligne = Math.floor((depuis - epsilon) / tailleTuile); ligne <= Math.floor((jusqua + epsilon) / tailleTuile); ligne++) {
      const haut = ligne * tailleTuile;
      for (let col = Math.floor(gauche / tailleTuile); col <= Math.floor(droite / tailleTuile); col++) {
        const t = this.niveau.tuile(col, ligne);
        if (this.plein(col, ligne) && !this.plein(col, ligne - 1)) retenir(haut, false);
        else if (t === Tuile.PLATEFORME && !this.opts.traversePlateformes) retenir(haut, true);
      }
      const col = Math.floor(x / tailleTuile),
        pente = this.surfacePente(x, col, ligne);
      if (pente !== null) retenir(pente, false);
    }
    const pente = this.surfacePente(x, Math.floor(x / tailleTuile), Math.floor((depuis - epsilon) / tailleTuile));
    if (pente !== null && pente < depuis - epsilon && depuis - pente <= hauteurMarche && pente < resultat.y) {
      resultat.y = pente;
      resultat.plateforme = false;
    }
    return resultat.y === 1 / 0 ? null : resultat;
  }

  deplacer(dt: number): number {
    const etaitAuSol = this.auSol;
    this.auPlafond = false;
    this.auMur = 0;
    this.deplacerX(this.vx * dt, etaitAuSol);
    const touche = this.deplacerY(this.vy * dt);
    this.auSol = touche;
    if (!touche && etaitAuSol && this.vy >= 0) {
      const sol = this.surfaceSol(this.x, this.y, this.y + toleranceSol);
      if (sol) {
        this.y = sol.y;
        this.vy = 0;
        this.auSol = true;
        this.surPlateforme = sol.plateforme;
      }
    }
    if (!this.auSol) this.surPlateforme = false;
    if (this.niveau.boucle) {
      const largeurPx = this.niveau.largeurPx();
      if (this.x < 0 || this.x >= largeurPx) {
        const avant = this.x;
        this.x = ((this.x % largeurPx) + largeurPx) % largeurPx;
        return this.x - avant;
      }
    }
    return 0;
  }

  deplacerX(dx: number, etaitAuSol: boolean) {
    if (dx === 0) return;
    const pas = Math.ceil(Math.abs(dx) / pasCollision),
      d = dx / pas;
    for (let i = 0; i < pas; i++) {
      const x = this.x + d;
      if (
        !(etaitAuSol
          ? this.chevauche(x, this.y - hauteurMarche, this.hauteur - hauteurMarche)
          : this.chevauche(x, this.y))
      ) {
        this.x = x;
        if (etaitAuSol) {
          const sol = this.surfaceSol(this.x, this.y - hauteurMarche, this.y + hauteurMarche);
          if (sol && !this.chevauche(this.x, sol.y)) {
            this.y = sol.y;
            this.surPlateforme = sol.plateforme;
          }
        }
        continue;
      }
      this.auMur = d > 0 ? 1 : -1;
      const cale =
        d > 0
          ? Math.floor((this.x + this.largeur / 2 + d) / tailleTuile) * tailleTuile - this.largeur / 2
          : Math.ceil((this.x - this.largeur / 2 + d) / tailleTuile) * tailleTuile + this.largeur / 2;
      if (Math.abs(cale - this.x) <= pasCollision && !this.chevauche(cale, this.y)) this.x = cale;
      this.vx = 0;
      return;
    }
  }

  deplacerY(dy: number): boolean {
    if (dy > 0) {
      const pas = Math.ceil(dy / pasCollision),
        d = dy / pas;
      for (let i = 0; i < pas; i++) {
        const y = this.y + d,
          sol = this.surfaceSol(this.x, this.y, y);
        if (sol) {
          this.y = sol.y;
          this.vy = 0;
          this.surPlateforme = sol.plateforme;
          return true;
        }
        this.y = y;
      }
      return false;
    }
    if (dy < 0) {
      const pas = Math.ceil(-dy / pasCollision),
        d = dy / pas;
      for (let i = 0; i < pas; i++) {
        const y = this.y + d;
        if (this.chevauche(this.x, y)) {
          const nudge = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5].find(
            (o) => !this.chevauche(this.x + o, y) && !this.chevauche(this.x + o, this.y),
          );
          if (nudge !== void 0) {
            this.x += nudge;
            this.y = y;
            continue;
          }
          const haut = y - this.hauteur;
          this.y = (Math.floor(haut / tailleTuile) + 1) * tailleTuile + this.hauteur;
          this.vy = 0;
          this.auPlafond = true;
          return false;
        }
        this.y = y;
      }
      return false;
    }
    const sol = this.surfaceSol(this.x, this.y, this.y + 0.5);
    if (sol) {
      this.surPlateforme = sol.plateforme;
      return true;
    }
    return false;
  }
}