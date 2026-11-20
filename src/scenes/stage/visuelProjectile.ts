import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { n as textureHalo } from "../../render/textures";
import { Camp } from "./combat";

const couleursProjectiles: Record<string, [number, number]> = {
  boule_feu: [16756800, 16730640],
  glace: [14218495, 4892927],
  pierre: [13680808, 6969928],
  venin: [13172592, 4235296],
  eau: [12644607, 3178720],
  foudre: [15791359, 8031487],
  plume: [16773328, 12623968],
  ame: [14731519, 9064703],
  onde: [16769184, 16744496],
  regard: [16771232, 16732192],
};

let textureFlecheCache: Texture | null = null;

function textureFleche(): Texture {
  if (textureFlecheCache) return textureFlecheCache;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 24;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("canvas 2d indisponible");
  const degrade = ctx.createLinearGradient(0, 0, 128, 0);
  degrade.addColorStop(0, "rgba(255,190,60,0)");
  degrade.addColorStop(0.6, "rgba(255,205,90,0.7)");
  degrade.addColorStop(1, "rgba(255,245,210,1)");
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 8, 116, 8);
  ctx.fillStyle = "rgba(255,252,235,1)";
  ctx.fillRect(24, 11, 94, 2);
  ctx.beginPath();
  ctx.moveTo(128, 12);
  ctx.lineTo(110, 4);
  ctx.lineTo(115, 12);
  ctx.lineTo(110, 20);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,240,180,1)";
  ctx.fill();
  textureFlecheCache = Texture.from(canvas);
  return textureFlecheCache;
}

export class VisuelProjectile extends Container {
  ecartX = 0;
  ecartY = 0;
  age = 0;
  corps = new Sprite();
  halo = new Sprite(textureHalo(64));
  pointe = new Graphics();
  traine: Sprite[] = [];
  historique: { x: number; y: number }[] = [];
  fleche = false;

  constructor() {
    super();
    this.blendMode = "add";
    for (let i = 0; i < 4; i++) {
      const s = new Sprite(textureHalo(64));
      s.anchor.set(0.5);
      this.traine.push(s);
      this.addChild(s);
    }
    this.halo.anchor.set(0.5);
    this.corps.anchor.set(0.9, 0.5);
    // Pointe non additive : une tête pleine et lisible plutôt qu'un trait laser.
    this.pointe
      .poly([10, 0, -6, -5, -3, 0, -6, 5], true)
      .fill({ color: 16775399 });
    this.pointe.blendMode = "normal";
    this.pointe.visible = false;
    this.addChild(this.halo, this.corps, this.pointe);
  }

  configurer(p: any) {
    this.historique.length = 0;
    this.ecartX = this.ecartY = 0;
    this.age = 0;
    const fleche = p.camp === Camp.JOUEUR && p.visuel.startsWith("fleche"),
      [principal, secondaire] =
        couleursProjectiles[p.visuel] ??
        (p.camp === Camp.JOUEUR ? [16773824, 16756784] : [16756800, 16730640]);
    if (fleche) {
      this.corps.texture = textureFleche();
      this.corps.anchor.set(0.9, 0.5);
      const taille = p.charge ? 0.9 : 0.62;
      this.corps.scale.set(taille, p.charge ? 0.8 : 0.5);
      this.corps.tint = 16777215;
      this.halo.tint = secondaire;
      this.halo.scale.set(p.charge ? 1.6 : 0.9, p.charge ? 1 : 0.55);
      this.halo.alpha = p.charge ? 0.9 : 0.55;
    } else {
      this.corps.texture = textureHalo(64);
      this.corps.anchor.set(0.5);
      const taille = Math.max(0.35, (p.rayon * 4) / 32);
      this.corps.scale.set(taille);
      this.corps.tint = principal;
      this.halo.tint = secondaire;
      this.halo.scale.set(taille * 2.4);
      this.halo.alpha = 0.7;
    }
    this.traine.forEach((s, i) => {
      s.tint = i < 2 ? principal : secondaire;
      s.visible = false;
    });
    this.pointe.visible = false;
    this.fleche = fleche;
  }

  mettreAJour(p: any, x: number, y: number, dt: number) {
    this.age += dt;
    const px = x * 4 + this.ecartX,
      py = y * 4 + this.ecartY,
      angle = Math.atan2(p.vy, p.vx);
    this.corps.position.set(px, py);
    this.halo.position.set(px, py);
    if (this.fleche) this.corps.rotation = angle;
    this.pointe.visible = this.fleche;
    if (this.fleche) {
      const avance = 12 * this.corps.scale.x;
      this.pointe.position.set(px + Math.cos(angle) * avance, py + Math.sin(angle) * avance);
      this.pointe.rotation = angle;
      this.pointe.scale.set(p.charge ? 1.3 : 0.9);
    }
    this.historique.unshift({ x: px, y: py });
    if (this.historique.length > this.traine.length) this.historique.pop();
    const fleche = this.fleche;
    this.traine.forEach((s, i) => {
      const point = this.historique[i];
      s.visible = !!point;
      if (!point) return;
      s.position.set(point.x, point.y);
      const reste = 1 - i / this.traine.length;
      if (fleche) {
        s.rotation = angle;
        s.scale.set(
          (p.charge ? 1.3 : 0.9) * (0.6 + 0.6 * reste),
          (p.charge ? 0.14 : 0.07) * (0.5 + reste),
        );
        s.alpha = 0.4 * reste;
      } else {
        s.scale.set(this.corps.scale.x * (0.4 + 0.8 * reste));
        s.alpha = 0.25 * reste;
      }
    });
  }
}

export class VisuelsProjectiles extends Container {
  combat: any;
  origineVisuelle: ((p: any) => { x: number; y: number } | null) | null = null;
  actifs = new Map<any, VisuelProjectile>();
  libres: VisuelProjectile[] = [];

  constructor(combat: any) {
    super();
    this.combat = combat;
  }

  mettreAJour(alpha: number, dt: number) {
    const vivants = new Set<any>();
    for (const p of this.combat.projectiles) {
      if (!p.actif) continue;
      vivants.add(p);
      let visuel = this.actifs.get(p);
      if (!visuel) {
        visuel = this.libres.pop() ?? new VisuelProjectile();
        visuel.configurer(p);
        const origine = this.origineVisuelle?.(p);
        if (origine) {
          visuel.ecartX = origine.x - p.precX * 4;
          visuel.ecartY = origine.y - p.precY * 4;
        }
        visuel.visible = true;
        this.addChild(visuel);
        this.actifs.set(p, visuel);
      }
      const saut = Math.abs(p.x - p.precX) > 64;
      visuel.mettreAJour(
        p,
        saut ? p.x : p.precX + (p.x - p.precX) * alpha,
        saut ? p.y : p.precY + (p.y - p.precY) * alpha,
        dt,
      );
    }
    for (const [p, visuel] of this.actifs)
      if (!vivants.has(p)) {
        this.actifs.delete(p);
        visuel.visible = false;
        this.removeChild(visuel);
        this.libres.push(visuel);
      }
  }
}