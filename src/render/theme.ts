import { Container, Graphics, TextStyle } from "pixi.js";
import type { Texture } from "pixi.js";
import { r as Flux } from "../core";
import { a as Particle, i as ParticleContainer, o as Text } from "./textures";

interface ReglesParticules {
  couleurs: number[];
  taille: [number, number];
  vx: [number, number];
  vy: [number, number];
  vie: [number, number];
  ondulation: number;
  additif: boolean;
  etire: boolean;
  scintille: boolean;
}

interface ParticuleAmbiante {
  p: Particle;
  vx: number;
  vy: number;
  vie: number;
  duree: number;
  phase: number;
}

const presetsParticules: Record<string, ReglesParticules> = {
  braises: {
    couleurs: [16752704, 16738848, 16765056],
    taille: [0.05, 0.22],
    vx: [-18, 18],
    vy: [-90, -25],
    vie: [4, 11],
    ondulation: 22,
    additif: true,
    etire: false,
    scintille: true,
  },
  ames: {
    couleurs: [12098303, 9099519, 14733567],
    taille: [0.15, 0.4],
    vx: [-10, 10],
    vy: [-45, -15],
    vie: [6, 12],
    ondulation: 30,
    additif: true,
    etire: false,
    scintille: false,
  },
  neige: {
    couleurs: [16777215, 14741759],
    taille: [0.06, 0.18],
    vx: [-30, 10],
    vy: [40, 110],
    vie: [8, 14],
    ondulation: 25,
    additif: false,
    etire: false,
    scintille: false,
  },
  pluie: {
    couleurs: [11057368, 13161710],
    taille: [0.05, 0.08],
    vx: [-160, -120],
    vy: [900, 1200],
    vie: [1.2, 1.8],
    ondulation: 0,
    additif: false,
    etire: true,
    scintille: false,
  },
  petales: {
    couleurs: [16769260, 16777215, 16763100],
    taille: [0.07, 0.14],
    vx: [20, 60],
    vy: [25, 60],
    vie: [8, 14],
    ondulation: 40,
    additif: false,
    etire: false,
    scintille: false,
  },
  lumieres: {
    couleurs: [16773296, 16769152, 16777215],
    taille: [0.04, 0.14],
    vx: [-15, 15],
    vy: [-25, 10],
    vie: [5, 10],
    ondulation: 18,
    additif: true,
    etire: false,
    scintille: true,
  },
  poussiere: {
    couleurs: [14207200, 12101832],
    taille: [0.03, 0.08],
    vx: [-12, 12],
    vy: [-8, 8],
    vie: [6, 12],
    ondulation: 12,
    additif: true,
    etire: false,
    scintille: true,
  },
  // Spores luminescentes : vert acide / cyan, montée lente, scintillement additif.
  spores: {
    couleurs: [0x9dffb0, 0x6fe8c8, 0xd8ff9a],
    taille: [0.08, 0.26],
    vx: [-14, 14],
    vy: [-32, -8],
    vie: [6, 13],
    ondulation: 26,
    additif: true,
    etire: false,
    scintille: true,
  },
  // Cendres : flocons gris chauds qui retombent en dérivant (monde cendre/glacial).
  cendres: {
    couleurs: [0xcfc8c0, 0x9a938c, 0xe8e2da],
    taille: [0.05, 0.16],
    vx: [-26, 6],
    vy: [18, 55],
    vie: [7, 13],
    ondulation: 20,
    additif: false,
    etire: false,
    scintille: false,
  },
};

// Plafond dur d'ambiance : ≤120 particules par champ, quel que soit le preset.
const PLAFOND_AMBIANCE = 120;

class ChampParticules extends Container {
  tex: Texture;
  type: string;
  largeur: number;
  hauteur: number;
  conteneur: ParticleContainer;
  liste: ParticuleAmbiante[] = [];
  flux: Flux;
  regles: ReglesParticules;
  constructor(tex: Texture, type: string, largeur: number, hauteur: number, nombre: number) {
    super();
    this.tex = tex;
    this.type = type;
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.regles = presetsParticules[type];
    this.flux = new Flux(`decor|particules|${type}`);
    this.conteneur = new ParticleContainer({
      dynamicProperties: {
        position: true,
        color: true,
        vertex: true,
        rotation: true,
      },
    });
    if (this.regles.additif) this.conteneur.blendMode = `add`;
    this.addChild(this.conteneur);
    const total = Math.min(nombre, PLAFOND_AMBIANCE);
    for (let i = 0; i < total; i++) {
      const particule = this.nouvelle();
      particule.vie = this.flux.randf() * particule.duree;
      particule.p.x = this.flux.randf() * this.largeur;
      particule.p.y = this.flux.randf() * this.hauteur;
      this.liste.push(particule);
      this.conteneur.addParticle(particule.p);
    }
  }
  nouvelle(existante?: ParticuleAmbiante): ParticuleAmbiante {
    const flux = this.flux;
    const regles = this.regles;
    const p = existante?.p ?? new Particle({ texture: this.tex, anchorX: 0.5, anchorY: 0.5 });
    const taille = flux.randfRange(regles.taille[0], regles.taille[1]);
    p.scaleX = taille;
    p.scaleY = regles.etire ? taille * 9 : taille;
    p.tint = flux.choisir(regles.couleurs);
    const vx = flux.randfRange(regles.vx[0], regles.vx[1]);
    const vy = flux.randfRange(regles.vy[0], regles.vy[1]);
    p.x = flux.randf() * (this.largeur + 200) - 100;
    p.y = vy < 0 ? this.hauteur + 20 : vy > 0 ? -20 : flux.randf() * this.hauteur;
    if (regles.etire) p.rotation = Math.atan2(vy, vx) - Math.PI / 2;
    const particule = existante ?? { p, vx, vy, vie: 0, duree: 1, phase: 0 };
    particule.vx = vx;
    particule.vy = vy;
    particule.vie = 0;
    particule.duree = flux.randfRange(regles.vie[0], regles.vie[1]);
    particule.phase = flux.randf() * Math.PI * 2;
    return particule;
  }
  mettreAJour(dt: number) {
    const regles = this.regles;
    // Boucle indexée : zéro itérateur/closure alloué par frame.
    for (let i = 0; i < this.liste.length; i++) {
      const particule = this.liste[i];
      particule.vie += dt;
      const p = particule.p;
      if (
        particule.vie >= particule.duree ||
        p.y < -40 ||
        p.y > this.hauteur + 40 ||
        p.x < -150 ||
        p.x > this.largeur + 150
      ) {
        this.nouvelle(particule);
        continue;
      }
      const progression = particule.vie / particule.duree;
      p.x += (particule.vx + Math.sin(particule.vie * 1.7 + particule.phase) * regles.ondulation) * dt;
      p.y += particule.vy * dt;
      if (!regles.etire && (this.type === `petales` || this.type === `neige` || this.type === `cendres`)) {
        p.rotation += dt * (particule.phase - Math.PI);
      }
      const fondu = Math.min(1, progression * 6) * Math.min(1, (1 - progression) * 4);
      p.alpha = regles.scintille
        ? fondu * (0.6 + 0.4 * Math.sin(particule.vie * 9 + particule.phase))
        : fondu * (regles.etire ? 0.55 : 0.9);
    }
  }
}

function nombreFr(valeur: number, decimales: number): string {
  return valeur.toFixed(decimales).replace(`.`, `,`);
}

const POLICE_TITRE = `"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif`;
const POLICE_TEXTE = `"Segoe UI", "Trebuchet MS", sans-serif`;
const OR = 15255672;
const BRONZE = 9071150;
const CREME = 15983280;

function styleTitre(taille: number, couleur = CREME): TextStyle {
  return new TextStyle({
    fontFamily: POLICE_TITRE,
    fontSize: taille,
    fontWeight: `600`,
    fill: couleur,
    letterSpacing: taille * 0.12,
    // Pas de dropShadow : le filtre d'ombre de Pixi se rend en bandes noires
    // au-dessus des glyphes avec letterSpacing sur fond clair (bug isolé par ui,
    // contourné dans fin.ts/hudStage.ts). Le contour sombre épaissi suffit au
    // contraste sur ciel clair comme sur fond noir — aucun usage ne bave.
    stroke: { color: 1707782, width: Math.max(3, taille / 9) },
  });
}

function styleTexte(taille: number, couleur = 16052196): TextStyle {
  return new TextStyle({
    fontFamily: POLICE_TEXTE,
    fontSize: taille,
    fill: couleur,
    fontWeight: `500`,
    stroke: { color: 0, width: 3 },
    dropShadow: {
      color: 0,
      alpha: 0.6,
      blur: 3,
      distance: 2,
      angle: Math.PI / 2,
    },
  });
}

function dessinerPanneau(
  graphics: Graphics,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  alpha = 0.82,
): Graphics {
  graphics.roundRect(x, y, largeur, hauteur, 14).fill({ color: 723216, alpha });
  graphics.roundRect(x, y, largeur, hauteur, 14).stroke({ color: OR, width: 2.5, alpha: 0.95 });
  graphics
    .roundRect(x + 7, y + 7, largeur - 14, hauteur - 14, 9)
    .stroke({ color: BRONZE, width: 1.2, alpha: 0.9 });
  for (const [coinX, coinY] of [
    [x, y],
    [x + largeur, y],
    [x, y + hauteur],
    [x + largeur, y + hauteur],
  ]) {
    graphics
      .poly([coinX - 9, coinY, coinX, coinY - 9, coinX + 9, coinY, coinX, coinY + 9])
      .fill(BRONZE)
      .stroke({ color: OR, width: 1.5 });
  }
  return graphics;
}

class Bouton extends Container {
  largeur: number;
  hauteur: number;
  action: () => void;
  fond = new Graphics();
  texte: Text;
  selectionne = false;
  actif = true;
  constructor(libelle: string, largeur = 460, hauteur = 64, action: () => void = () => void 0) {
    super();
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.action = action;
    this.texte = new Text({ text: libelle, style: styleTitre(30) });
    this.texte.anchor.set(0.5);
    this.texte.position.set(largeur / 2, hauteur / 2);
    this.addChild(this.fond, this.texte);
    this.eventMode = `static`;
    this.cursor = `pointer`;
    this.dessiner();
  }
  set libelle(valeur: string) {
    this.texte.text = valeur;
  }
  dessiner() {
    const fond = this.fond;
    fond.clear();
    const estSelectionne = this.selectionne && this.actif;
    fond
      .roundRect(0, 0, this.largeur, this.hauteur, 10)
      .fill({ color: estSelectionne ? 3811858 : 920338, alpha: estSelectionne ? 0.92 : 0.7 });
    fond
      .roundRect(0, 0, this.largeur, this.hauteur, 10)
      .stroke({ color: estSelectionne ? 16770720 : BRONZE, width: estSelectionne ? 3 : 1.5 });
    if (estSelectionne) {
      fond.roundRect(-4, -4, this.largeur + 8, this.hauteur + 8, 13).stroke({
        color: OR,
        width: 1,
        alpha: 0.5,
      });
      for (const cote of [-1, 1]) {
        const x = cote < 0 ? -26 : this.largeur + 26;
        const y = this.hauteur / 2;
        fond.poly([x, y, x - cote * 14, y - 10, x - cote * 14, y + 10]).fill(OR);
      }
    }
    this.texte.style.fill = this.actif ? (estSelectionne ? 16773836 : CREME) : 6971496;
    this.texte.scale.set(estSelectionne ? 1.04 : 1);
  }
}

export {
  dessinerPanneau as a,
  ChampParticules as c,
  nombreFr as i,
  OR as n,
  styleTexte as o,
  BRONZE as r,
  styleTitre as s,
  Bouton as t,
};