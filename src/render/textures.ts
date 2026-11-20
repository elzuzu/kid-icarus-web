import { Particle, ParticleContainer, Text, Texture } from "pixi.js";
import { r as Flux } from "../core";

// Text / Particle / ParticleContainer du bundle = code pixi inliné par Vite (~8.21, voir REPORT.md) :
// ré-export de l'API publique, aucune réimplémentation.

const cacheTextures = new Map<string, Texture>();

function textureTache(taille = 64): Texture {
  const cle = `tache:${taille}`;
  const existante = cacheTextures.get(cle);
  if (existante) return existante;
  const canvas = document.createElement(`canvas`);
  canvas.width = canvas.height = taille;
  const ctx = canvas.getContext(`2d`);
  if (!ctx) throw Error(`canvas 2d indisponible`);
  const centre = taille / 2;
  const degrade = ctx.createRadialGradient(centre, centre, 0, centre, centre, centre);
  degrade.addColorStop(0, `rgba(255,255,255,1)`);
  degrade.addColorStop(0.25, `rgba(255,255,255,0.55)`);
  degrade.addColorStop(1, `rgba(255,255,255,0)`);
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, taille, taille);
  const texture = Texture.from(canvas);
  cacheTextures.set(cle, texture);
  return texture;
}

function textureVignette(opacite = 0.55): Texture {
  const cle = `vig:${opacite}`;
  const existante = cacheTextures.get(cle);
  if (existante) return existante;
  const canvas = document.createElement(`canvas`);
  canvas.width = 480;
  canvas.height = 270;
  const ctx = canvas.getContext(`2d`);
  if (!ctx) throw Error(`canvas 2d indisponible`);
  ctx.translate(240, 135);
  ctx.scale(1, 270 / 480);
  const degrade = ctx.createRadialGradient(0, 0, 120, 0, 0, 300);
  degrade.addColorStop(0, `rgba(0,0,0,0)`);
  degrade.addColorStop(1, `rgba(4,2,8,${opacite})`);
  ctx.fillStyle = degrade;
  ctx.fillRect(-300, -300, 600, 600);
  const texture = Texture.from(canvas);
  cacheTextures.set(cle, texture);
  return texture;
}

function textureDegrade(haut: string, bas: string, hauteur = 128, palier = 0): Texture {
  const cle = `deg:${haut}:${bas}:${hauteur}:${palier}`;
  const existante = cacheTextures.get(cle);
  if (existante) return existante;
  const canvas = document.createElement(`canvas`);
  canvas.width = 4;
  canvas.height = hauteur;
  const ctx = canvas.getContext(`2d`);
  if (!ctx) throw Error(`canvas 2d indisponible`);
  const degrade = ctx.createLinearGradient(0, 0, 0, hauteur);
  degrade.addColorStop(0, haut);
  if (palier > 0) degrade.addColorStop(palier, haut);
  degrade.addColorStop(1, bas);
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, 4, hauteur);
  const texture = Texture.from(canvas);
  cacheTextures.set(cle, texture);
  return texture;
}

// Grain filmique statique : bruit pré-généré une seule fois (seedé), tuilé à
// l'écran en alpha faible. Aucun recalcul de bruit par frame.
function textureGrain(taille = 256): Texture {
  const cle = `grain:${taille}`;
  const existante = cacheTextures.get(cle);
  if (existante) return existante;
  const canvas = document.createElement(`canvas`);
  canvas.width = canvas.height = taille;
  const ctx = canvas.getContext(`2d`);
  if (!ctx) throw Error(`canvas 2d indisponible`);
  const image = ctx.createImageData(taille, taille);
  const flux = new Flux(`render|grain|${taille}`);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = flux.randf() < 0.5 ? 0 : 255;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = Math.floor(flux.randf() * 22);
  }
  ctx.putImageData(image, 0, 0);
  const texture = Texture.from(canvas);
  cacheTextures.set(cle, texture);
  return texture;
}

// Éclair lointain pré-généré : trait dentelé + halo, une seule texture réutilisée
// par le sprite d'orage (alpha piloté par frame, jamais de redraw).
function textureEclair(): Texture {
  const cle = `eclair`;
  const existante = cacheTextures.get(cle);
  if (existante) return existante;
  const canvas = document.createElement(`canvas`);
  canvas.width = 160;
  canvas.height = 420;
  const ctx = canvas.getContext(`2d`);
  if (!ctx) throw Error(`canvas 2d indisponible`);
  const flux = new Flux(`render|eclair`);
  const points: [number, number][] = [];
  let x = 80;
  for (let i = 0; i <= 10; i++) {
    points.push([x, (i / 10) * 400 + 10]);
    x += flux.randfRange(-26, 26);
    x = Math.max(24, Math.min(136, x));
  }
  const tracer = (largeur: number, couleur: string) => {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [px, py] of points) ctx.lineTo(px, py);
    ctx.strokeStyle = couleur;
    ctx.lineWidth = largeur;
    ctx.lineJoin = `round`;
    ctx.lineCap = `round`;
    ctx.stroke();
  };
  tracer(16, `rgba(120,160,255,0.18)`);
  tracer(7, `rgba(170,200,255,0.5)`);
  tracer(2.5, `rgba(240,248,255,0.95)`);
  // Deux branches courtes.
  for (const depart of [3, 6]) {
    const [bx, by] = points[depart];
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + flux.randfRange(-40, 40), by + flux.randfRange(24, 60));
    ctx.strokeStyle = `rgba(190,215,255,0.55)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const texture = Texture.from(canvas);
  cacheTextures.set(cle, texture);
  return texture;
}

export {
  Particle as a,
  ParticleContainer as i,
  textureTache as n,
  Text as o,
  textureVignette as r,
  textureDegrade as t,
  textureGrain as g,
  textureEclair as e,
};