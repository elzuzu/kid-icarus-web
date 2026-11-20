import { Assets, Container, Sprite } from "pixi.js";
import { n as largeurEcran, t as hauteurEcran } from "../../core";
import { s as SpriteTuile } from "../../ui/hud";
import { t as textureDegrade, n as textureHalo } from "../../render/textures";
import { bruit1, flashesActifs, techart } from "../../render/ambiance";
import { base } from "./base";

const nombreImages = 8,
  imagesParSeconde = 12,
  hauteurBande = 80;

export async function chargerFlammes(): Promise<any[]> {
  return Promise.all(
    Array.from({ length: nombreImages }, (_, i) =>
      Assets.load(`${base}assets/art/effets/flammes_${i}.webp`),
    ),
  );
}

export class Flammes extends Container {
  images: any[];
  bandes: any[] = [];
  lueur: Sprite;
  // Halos additifs poolés : trois foyers fixes le long de la bande, flicker bruité.
  foyers: { s: Sprite; phase: number }[] = [];
  t = 0;
  niveau = 0;

  constructor(images: any[]) {
    super();
    this.images = images;
    this.lueur = new Sprite(textureDegrade("rgba(255,40,0,0)", "rgba(255,40,0,0.32)", 256));
    this.lueur.width = largeurEcran;
    this.lueur.height = hauteurBande * 1.5;
    this.lueur.y = hauteurEcran - this.lueur.height;
    this.lueur.blendMode = "add";
    this.addChild(this.lueur);
    for (let i = 0; i < 3; i++) {
      const foyer = new Sprite(textureHalo(128));
      foyer.anchor.set(0.5);
      foyer.blendMode = "add";
      foyer.tint = 0xff7a28;
      foyer.position.set(largeurEcran * (0.2 + 0.3 * i), hauteurEcran - 24);
      foyer.cullable = true;
      foyer.scale.set(1.7);
      foyer.alpha = 0;
      this.foyers.push({ s: foyer, phase: i * 2.399 + 0.7 });
      this.addChild(foyer);
    }
    for (const [echelle, decalage] of [
      [1, 0],
      [0.8, 0.37],
    ]) {
      const texture = images[0],
        hauteur = hauteurBande * echelle,
        bande = new SpriteTuile({ texture, width: largeurEcran, height: hauteur });
      bande.tileScale.set(hauteur / texture.height);
      bande.tilePosition.x = decalage * texture.width;
      bande.y = hauteurEcran - hauteur + 8;
      bande.blendMode = "add";
      this.bandes.push(bande);
      this.addChild(bande);
    }
    this.alpha = 0;
    this.visible = false;
    techart.flammes = this;
  }

  mettreAJour(dt: number, visible: boolean) {
    this.t += dt;
    this.niveau += (+!!visible - this.niveau) * Math.min(1, dt * 2.5);
    this.visible = this.niveau > 0.01;
    if (!this.visible) return;
    // Flicker bruité (trois périodes non commensurables) plutôt qu'un sinus pur.
    const amp = flashesActifs() ? 1 : 0.5;
    this.alpha = this.niveau * (0.78 + 0.08 * amp * bruit1(this.t * 1.9));
    for (let i = 0; i < this.bandes.length; i++) {
      const bande = this.bandes[i];
      const image = Math.floor(this.t * imagesParSeconde * (i ? 0.85 : 1) + i * 3) % nombreImages;
      bande.texture = this.images[image];
      bande.tilePosition.x += dt * (i ? -9 : 6);
    }
    this.lueur.alpha = 0.8 + 0.2 * amp * bruit1(this.t * 1.3 + 2);
    for (let i = 0; i < this.foyers.length; i++) {
      const f = this.foyers[i];
      const n = bruit1(this.t * 2.2 + f.phase);
      f.s.alpha = this.niveau * (0.3 + 0.16 * amp * (0.5 + 0.5 * n));
      f.s.scale.set(1.7 * (1 + 0.07 * n));
    }
  }
}