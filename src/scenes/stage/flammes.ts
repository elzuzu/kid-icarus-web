import { Assets, Container, Sprite } from "pixi.js";
import { n as largeurEcran, t as hauteurEcran } from "../../core";
import { s as SpriteTuile } from "../../ui/hud";
import { t as textureDegrade } from "../../render/textures";
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
  }

  mettreAJour(dt: number, visible: boolean) {
    this.t += dt;
    this.niveau += (+!!visible - this.niveau) * Math.min(1, dt * 2.5);
    this.visible = this.niveau > 0.01;
    if (!this.visible) return;
    this.alpha = this.niveau * (0.78 + 0.08 * Math.sin(this.t * 7.3));
    this.bandes.forEach((bande, i) => {
      const image = Math.floor(this.t * imagesParSeconde * (i ? 0.85 : 1) + i * 3) % nombreImages;
      bande.texture = this.images[image];
      bande.tilePosition.x += dt * (i ? -9 : 6);
    });
    this.lueur.alpha = 0.8 + 0.2 * Math.sin(this.t * 3.1);
  }
}