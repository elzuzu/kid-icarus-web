import { Container, Sprite, Graphics, TextStyle } from "pixi.js";
import { r as Flux } from "../../core";
import { o as Texte } from "../../render/textures";
import { n as textureHalo } from "../../render/textures";
import { flashesActifs, techart } from "../../render/ambiance";
import { Camp } from "./combat";
import { EtatJoueur } from "./joueur";

const styleChiffre = new TextStyle({
  fontFamily: `"Segoe UI", "Trebuchet MS", sans-serif`,
  fontSize: 30,
  fontWeight: "800",
  fill: 16777215,
  stroke: { color: 1707014, width: 5 },
  dropShadow: {
    color: 0,
    alpha: 0.6,
    blur: 2,
    distance: 2,
    angle: Math.PI / 2,
  },
});

// Plafonds durs des pools : aucune croissance non bornée en combat prolongé.
const MAX_PARTICULES = 240,
  MAX_POUSSIERES = 64,
  MAX_ANNEAUX = 24,
  MAX_CHIFFRES = 24,
  MAX_ARCS = 8,
  MAX_FOUDRES = 4;

export class EffetsCombat extends Container {
  additif = new Container();
  poussiere = new Container();
  textes = new Container();
  particules: any[] = [];
  poussieres: any[] = [];
  chiffres: any[] = [];
  anneaux: any[] = [];
  foudres: any[] = [];
  arcs: any[] = [];
  joueur: any = null;
  ticCourse = 0;
  flux = new Flux("decor|effets_combat");

  constructor(combat: any) {
    super();
    this.additif.blendMode = "add";
    this.addChild(this.poussiere, this.additif, this.textes);
    combat.coupPorte.connecter((cible: any, coup: any, point: any) => {
      const joueur = cible.camp === Camp.JOUEUR,
        ampleur = coup.critique ? 1.6 : 1;
      this.etincelles(
        point.x,
        point.y,
        joueur ? 16732224 : 16765562,
        Math.round(10 * ampleur),
        260 * ampleur,
        -coup.reculX,
        -coup.reculY,
      );
      this.anneau(point.x, point.y, joueur ? 16736336 : 16773312, coup.critique ? 1.8 : 1.1);
      if (coup.montant > 0) this.chiffre(point.x, point.y - 10, coup.montant, coup.critique, joueur);
      if (coup.source === "eclair") this.foudre(cible.centre().x, cible.centre().y);
    });
    combat.combattantMort.connecter((cible: any) => {
      const c = cible.centre();
      if (cible.camp === Camp.JOUEUR) {
        // Mort du joueur : dissolution ascendante poolée (le respawn est instantané
        // côté sim, le burst visuel porte la lecture de la mort).
        this.dissolution(c.x, c.y, 0x9fd8ff);
        this.anneau(c.x, c.y, 0x9fd8ff, 2.6);
      } else {
        this.etincelles(c.x, c.y, 16747056, 26, 220, 0, -1);
        this.etincelles(c.x, c.y, 10119935, 10, 120, 0, -1);
        this.anneau(c.x, c.y, 16760944, 2.4);
      }
    });
    combat.coupBloque.connecter((_cible: any, point: any) => {
      this.etincelles(point.x, point.y, 11065599, 12, 300, 0, 0);
      this.anneau(point.x, point.y, 12642559, 1.2);
    });
    combat.explosionSignal.connecter((point: any, rayon: number) => {
      this.anneau(point.x, point.y, 16752704, (rayon * 4) / 40);
      this.etincelles(point.x, point.y, 16756816, 30, 360, 0, -0.5);
    });
    combat.projectileFini.connecter((p: any, point: any, mur: boolean) => {
      if (mur)
        this.etincelles(
          point.x,
          point.y,
          p.camp === Camp.JOUEUR ? 16769184 : 16748640,
          6,
          140,
          -p.vx,
          -p.vy,
        );
    });
    techart.effets = this;
  }

  brancherJoueur(joueur: any) {
    this.joueur = joueur;
    joueur.aFrappeVisuel.connecter((combo: number, face: number) => {
      const c = joueur.centre();
      this.arcMelee(c.x + face * 6, c.y, face, combo);
    });
    joueur.aAtterri.connecter(() => this.bouffiere(joueur.x, joueur.y, 0));
    joueur.aDashe.connecter((dir: number) => this.bouffiere(joueur.x, joueur.y, -dir));
  }

  // Slot libre d'un pool (vie >= duree) ; si plein et plafonné, réécrit le plus
  // vieux. Retourne null seulement quand le pool peut encore grandir.
  private libre(liste: any[], max: number): any | null {
    for (let i = 0; i < liste.length; i++) if (liste[i].vie >= liste[i].duree) return liste[i];
    if (liste.length < max) return null;
    let vieux = liste[0];
    for (let i = 1; i < liste.length; i++) if (liste[i].vie > vieux.vie) vieux = liste[i];
    return vieux;
  }

  arcMelee(x: number, y: number, face: number, combo: number) {
    let arc = this.libre(this.arcs, MAX_ARCS);
    if (!arc) {
      arc = { g: new Graphics(), vie: 0, duree: 0.15, intensite: 1 };
      this.arcs.push(arc);
      this.additif.addChild(arc.g);
    }
    const g = arc.g as Graphics,
      rayon = 1.6 * 16 * 4,
      couleur = 16765562;
    g.clear();
    if (combo === 3) {
      g.circle(0, 0, rayon).stroke({ color: couleur, width: 12, alpha: 0.55 });
      g.circle(0, 0, rayon).stroke({ color: 16774102, width: 4, alpha: 0.9 });
      g.rotation = 0;
    } else {
      g.arc(0, 0, rayon * 0.85, -1.05, 1.05).stroke({ color: couleur, width: 14, alpha: 0.55 });
      g.arc(0, 0, rayon * 0.85, -0.95, 0.95).stroke({ color: 16774102, width: 5, alpha: 0.9 });
      g.rotation = face > 0 ? 0 : Math.PI;
    }
    g.position.set(x * 4, y * 4);
    g.visible = true;
    arc.vie = 0;
    arc.intensite = flashesActifs() ? 1 : 0.6;
  }

  bouffiere(x: number, y: number, biaisX: number) {
    const nombre = 4 + Math.floor(this.flux.randf() * 3);
    for (let i = 0; i < nombre; i++) {
      let part = this.libre(this.poussieres, MAX_POUSSIERES);
      if (!part) {
        const s = new Sprite(textureHalo(32));
        s.anchor.set(0.5);
        this.poussiere.addChild(s);
        part = { s, vx: 0, vy: 0, vie: 0, duree: 0.3 };
        this.poussieres.push(part);
      }
      part.vx = (this.flux.randfRange(-14, 14) + biaisX * 12) * 4;
      part.vy = this.flux.randfRange(-22, -6) * 4;
      part.vie = 0;
      part.duree = 0.3;
      part.s.visible = true;
      part.s.tint = 14277074;
      part.s.position.set(x * 4 + this.flux.randfRange(-12, 12), y * 4 - 2);
      part.s.scale.set(0.16);
      part.s.alpha = 0.4;
    }
  }

  etincelles(x: number, y: number, couleur: number, nombre: number, vitesse: number, dirX: number, dirY: number) {
    const px = x * 4,
      py = y * 4,
      oriente = Math.hypot(dirX, dirY) > 0.01,
      angle = oriente ? Math.atan2(dirY, dirX) : 0;
    for (let i = 0; i < nombre; i++) {
      const a = oriente ? angle + this.flux.randfRange(-1.1, 1.1) : this.flux.randf() * Math.PI * 2,
        v = this.flux.randfRange(0.35, 1) * vitesse * 4 * 0.45;
      let part = this.libre(this.particules, MAX_PARTICULES);
      if (!part) {
        const s = new Sprite(textureHalo(32));
        s.anchor.set(0.5);
        this.additif.addChild(s);
        part = { s, vx: 0, vy: 0, vie: 0, duree: 1, gravite: 0, etire: true };
        this.particules.push(part);
      }
      const s = part.s;
      part.vx = Math.cos(a) * v;
      part.vy = Math.sin(a) * v;
      part.vie = 0;
      part.duree = this.flux.randfRange(0.18, 0.45);
      part.gravite = 900;
      part.etire = true;
      s.visible = true;
      s.tint = couleur;
      s.position.set(px, py);
    }
  }

  // Dissolution : particules poolées qui montent et s'éteignent (mort joueur).
  dissolution(x: number, y: number, couleur: number) {
    const px = x * 4,
      py = y * 4;
    for (let i = 0; i < 18; i++) {
      let part = this.libre(this.particules, MAX_PARTICULES);
      if (!part) {
        const s = new Sprite(textureHalo(32));
        s.anchor.set(0.5);
        this.additif.addChild(s);
        part = { s, vx: 0, vy: 0, vie: 0, duree: 1, gravite: 0, etire: true };
        this.particules.push(part);
      }
      const a = this.flux.randf() * Math.PI * 2,
        v = this.flux.randfRange(20, 110) * 4;
      part.vx = Math.cos(a) * v * 0.5;
      part.vy = -Math.abs(Math.sin(a) * v) - 60;
      part.vie = 0;
      part.duree = this.flux.randfRange(0.5, 0.9);
      part.gravite = -140;
      part.etire = false;
      part.s.visible = true;
      part.s.tint = i % 3 === 0 ? 0xffffff : couleur;
      part.s.position.set(px + this.flux.randfRange(-16, 16), py + this.flux.randfRange(-24, 8));
      part.s.scale.set(0.16);
    }
  }

  foudre(x: number, y: number) {
    let f = this.libre(this.foudres, MAX_FOUDRES);
    if (!f) {
      f = { g: new Graphics(), vie: 0, duree: 0.3, points: [] as number[] };
      this.foudres.push(f);
      this.additif.addChild(f.g);
    }
    const g = f.g as Graphics,
      px = x * 4,
      py = y * 4,
      points = f.points as number[];
    points.length = 0;
    for (let i = 0; i <= 9; i++) {
      const t = i / 9;
      points.push(px + (i === 9 ? 0 : this.flux.randfRange(-38, 38)), py - 760 * (1 - t));
    }
    g.clear();
    g.poly(points, false).stroke({ color: 7317759, width: 18, alpha: 0.45 });
    g.poly(points, false).stroke({ color: 15923455, width: 5 });
    g.visible = true;
    f.vie = 0;
    this.anneau(x, y, 11063551, 2);
  }

  anneau(x: number, y: number, couleur: number, taille: number, intensite = 1) {
    let an = this.libre(this.anneaux, MAX_ANNEAUX);
    if (!an) {
      const s = new Sprite(textureHalo(128));
      s.anchor.set(0.5);
      this.additif.addChild(s);
      an = { s, vie: 0, duree: 0.22, taille, intensite: 1 };
      this.anneaux.push(an);
    }
    an.vie = 0;
    an.taille = taille;
    // Gate flashes : les pics additifs sont réduits, pas supprimés (lisibilité).
    an.intensite = intensite * (flashesActifs() ? 1 : 0.45);
    an.s.visible = true;
    an.s.tint = couleur;
    an.s.position.set(x * 4, y * 4);
  }

  chiffre(x: number, y: number, montant: number, critique: boolean, joueur: boolean) {
    let ch = this.libre(this.chiffres, MAX_CHIFFRES);
    if (!ch) {
      const t = new Texte({ text: "", style: styleChiffre.clone() });
      t.anchor.set(0.5);
      this.textes.addChild(t);
      ch = { t, vx: 0, vy: 0, vie: 0, duree: 0.9, echelle: 1 };
      this.chiffres.push(ch);
    }
    ch.t.text = critique ? `${montant}!` : String(montant);
    ch.t.style.fill = critique ? 16762938 : joueur ? 16734794 : 16774368;
    ch.t.style.fontSize = critique ? 44 : joueur ? 32 : 30;
    ch.echelle = critique ? 1.3 : 1;
    ch.t.scale.set(1.4 * ch.echelle);
    ch.t.visible = true;
    const px = x * 4,
      py = y * 4;
    let voisins = 0;
    for (let i = 0; i < this.chiffres.length; i++) {
      const c = this.chiffres[i];
      if (
        c !== ch &&
        c.vie < c.duree * 0.6 &&
        Math.abs(c.t.x - px) < 90 &&
        c.t.y < py + 40 &&
        c.t.y > py - 200
      )
        voisins++;
    }
    ch.t.position.set(px + (voisins % 2 ? 26 : -26) * Math.min(1, voisins), py - voisins * 34);
    ch.vx = this.flux.randfRange(-60, 60);
    ch.vy = -260;
    ch.vie = 0;
  }

  // Inspection QA : comptes de particules actives par pool (bornés par construction).
  compterActifs() {
    const compter = (liste: any[]) => {
      let n = 0;
      for (let i = 0; i < liste.length; i++) if (liste[i].vie < liste[i].duree) n++;
      return n;
    };
    return {
      particules: compter(this.particules),
      poussieres: compter(this.poussieres),
      anneaux: compter(this.anneaux),
      chiffres: compter(this.chiffres),
      arcs: compter(this.arcs),
      foudres: compter(this.foudres),
      tailles: {
        particules: this.particules.length,
        poussieres: this.poussieres.length,
        anneaux: this.anneaux.length,
        chiffres: this.chiffres.length,
        arcs: this.arcs.length,
        foudres: this.foudres.length,
      },
    };
  }

  mettreAJour(dt: number) {
    if (this.joueur) {
      const j = this.joueur;
      this.ticCourse -= dt;
      if (j.corps.auSol && j.etat === EtatJoueur.SOL && Math.abs(j.corps.vx) > 4) {
        if (this.ticCourse <= 0) {
          this.ticCourse = 0.18;
          this.bouffiere(j.x, j.y, -Math.sign(j.corps.vx));
        }
      } else this.ticCourse = 0;
    }
    // Boucles indexées, pools fixes : ni spread, ni splice, ni destroy par frame.
    for (let i = 0; i < this.arcs.length; i++) {
      const a = this.arcs[i];
      if (a.vie >= a.duree) continue;
      a.vie += dt;
      const t = Math.min(1, a.vie / a.duree);
      a.g.scale.set(0.8 + 0.35 * t);
      a.g.alpha = (1 - t) * a.intensite;
      if (a.vie >= a.duree) a.g.visible = false;
    }
    for (let i = 0; i < this.poussieres.length; i++) {
      const p = this.poussieres[i];
      if (p.vie >= p.duree) continue;
      p.vie += dt;
      if (p.vie >= p.duree) {
        p.s.visible = false;
        continue;
      }
      p.vx *= 1 - dt * 3;
      p.vy *= 1 - dt * 3;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      const reste = 1 - p.vie / p.duree;
      p.s.alpha = 0.4 * reste;
      p.s.scale.set(0.16 + 0.22 * (1 - reste));
    }
    const ampFoudre = flashesActifs() ? 1 : 0.5;
    for (let i = 0; i < this.foudres.length; i++) {
      const f = this.foudres[i];
      if (f.vie >= f.duree) continue;
      f.vie += dt;
      f.g.alpha = Math.max(0, 1 - f.vie / f.duree) * (Math.floor(f.vie * 40) % 2 ? 0.6 : 1) * ampFoudre;
      if (f.vie >= f.duree) f.g.visible = false;
    }
    for (let i = 0; i < this.particules.length; i++) {
      const p = this.particules[i];
      if (p.vie >= p.duree) continue;
      p.vie += dt;
      if (p.vie >= p.duree) {
        p.s.visible = false;
        continue;
      }
      p.vx *= 1 - dt * 4;
      p.vy = p.vy * (1 - dt * 4) + p.gravite * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      const reste = 1 - p.vie / p.duree;
      p.s.alpha = reste;
      if (p.etire) {
        p.s.rotation = Math.atan2(p.vy, p.vx);
        p.s.scale.set(0.25 + Math.hypot(p.vx, p.vy) / 900, 0.08 + 0.1 * reste);
      } else {
        p.s.scale.set(0.16 + 0.14 * (1 - reste));
      }
    }
    for (let i = 0; i < this.anneaux.length; i++) {
      const a = this.anneaux[i];
      if (a.vie >= a.duree) continue;
      a.vie += dt;
      const t = Math.min(1, a.vie / a.duree);
      a.s.scale.set(a.taille * (0.4 + 1.4 * t));
      a.s.alpha = (1 - t) * a.intensite;
      if (a.vie >= a.duree) a.s.visible = false;
    }
    for (let i = 0; i < this.chiffres.length; i++) {
      const c = this.chiffres[i];
      if (c.vie >= c.duree) continue;
      c.vie += dt;
      c.vy += 520 * dt;
      c.t.x += c.vx * dt;
      c.t.y += c.vy * dt;
      const t = c.vie / c.duree,
        pop = Math.min(1, c.vie / 0.12),
        easeOut = 1 - (1 - pop) * (1 - pop);
      c.t.scale.set((1.4 - 0.4 * easeOut) * (c.echelle ?? 1));
      c.t.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      if (c.vie >= c.duree) c.t.visible = false;
    }
  }
}