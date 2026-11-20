import { Container, Sprite, Graphics, TextStyle } from "pixi.js";
import { r as Flux } from "../../core";
import { o as Texte } from "../../render/textures";
import { n as textureHalo } from "../../render/textures";
import { Camp } from "./combat";

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

export class EffetsCombat extends Container {
  additif = new Container();
  textes = new Container();
  particules: any[] = [];
  chiffres: any[] = [];
  anneaux: any[] = [];
  foudres: any[] = [];
  flux = new Flux("decor|effets_combat");

  constructor(combat: any) {
    super();
    this.additif.blendMode = "add";
    this.addChild(this.additif, this.textes);
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
      this.etincelles(c.x, c.y, 16747056, 26, 220, 0, -1);
      this.etincelles(c.x, c.y, 10119935, 10, 120, 0, -1);
      this.anneau(c.x, c.y, 16760944, 2.4);
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
  }

  etincelles(x: number, y: number, couleur: number, nombre: number, vitesse: number, dirX: number, dirY: number) {
    const px = x * 4,
      py = y * 4,
      angle = Math.hypot(dirX, dirY) > 0.01 ? Math.atan2(dirY, dirX) : 0,
      oriente = Math.hypot(dirX, dirY) > 0.01;
    for (let i = 0; i < nombre; i++) {
      const a = oriente ? angle + this.flux.randfRange(-1.1, 1.1) : this.flux.randf() * Math.PI * 2,
        v = this.flux.randfRange(0.35, 1) * vitesse * 4 * 0.45;
      let part = this.particules.find((p) => p.vie >= p.duree);
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

  foudre(x: number, y: number) {
    const g = new Graphics(),
      px = x * 4,
      py = y * 4,
      points: number[] = [];
    for (let i = 0; i <= 9; i++) {
      const t = i / 9;
      points.push(px + (i === 9 ? 0 : this.flux.randfRange(-38, 38)), py - 760 * (1 - t));
    }
    g.poly(points, false).stroke({ color: 7317759, width: 18, alpha: 0.45 });
    g.poly(points, false).stroke({ color: 15923455, width: 5 });
    this.additif.addChild(g);
    this.foudres.push({ g, vie: 0 });
    this.anneau(x, y, 11063551, 2);
  }

  anneau(x: number, y: number, couleur: number, taille: number) {
    let an = this.anneaux.find((a) => a.vie >= a.duree);
    if (!an) {
      const s = new Sprite(textureHalo(128));
      s.anchor.set(0.5);
      this.additif.addChild(s);
      an = { s, vie: 0, duree: 0.22, taille };
      this.anneaux.push(an);
    }
    an.vie = 0;
    an.taille = taille;
    an.s.visible = true;
    an.s.tint = couleur;
    an.s.position.set(x * 4, y * 4);
  }

  chiffre(x: number, y: number, montant: number, critique: boolean, joueur: boolean) {
    let ch = this.chiffres.find((c) => c.vie >= c.duree);
    if (!ch) {
      const t = new Texte({ text: "", style: styleChiffre.clone() });
      t.anchor.set(0.5);
      this.textes.addChild(t);
      ch = { t, vx: 0, vy: 0, vie: 0, duree: 0.9 };
      this.chiffres.push(ch);
    }
    ch.t.text = critique ? `${montant}!` : String(montant);
    ch.t.style.fill = joueur ? 16734794 : critique ? 16762938 : 16774368;
    ch.t.style.fontSize = critique ? 44 : joueur ? 32 : 30;
    ch.t.visible = true;
    const px = x * 4,
      py = y * 4,
      voisins = this.chiffres.filter(
        (c) =>
          c !== ch &&
          c.vie < c.duree * 0.6 &&
          Math.abs(c.t.x - px) < 90 &&
          c.t.y < py + 40 &&
          c.t.y > py - 200,
      ).length;
    ch.t.position.set(px + (voisins % 2 ? 26 : -26) * Math.min(1, voisins), py - voisins * 34);
    ch.vx = this.flux.randfRange(-60, 60);
    ch.vy = -260;
    ch.vie = 0;
  }

  mettreAJour(dt: number) {
    for (const f of [...this.foudres]) {
      f.vie += dt;
      f.g.alpha = Math.max(0, 1 - f.vie / 0.3) * (Math.floor(f.vie * 40) % 2 ? 0.6 : 1);
      if (f.vie >= 0.3) {
        f.g.destroy();
        this.foudres.splice(this.foudres.indexOf(f), 1);
      }
    }
    for (const p of this.particules) {
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
      }
    }
    for (const a of this.anneaux) {
      if (a.vie >= a.duree) continue;
      a.vie += dt;
      const t = Math.min(1, a.vie / a.duree);
      a.s.scale.set(a.taille * (0.4 + 1.4 * t));
      a.s.alpha = 1 - t;
      if (a.vie >= a.duree) a.s.visible = false;
    }
    for (const c of this.chiffres) {
      if (c.vie >= c.duree) continue;
      c.vie += dt;
      c.vy += 520 * dt;
      c.t.x += c.vx * dt;
      c.t.y += c.vy * dt;
      const t = c.vie / c.duree;
      c.t.scale.set(t < 0.12 ? 0.6 + (t / 0.12) * 0.6 : 1.2 - Math.min(0.2, (t - 0.12) * 0.4));
      c.t.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      if (c.vie >= c.duree) c.t.visible = false;
    }
  }
}