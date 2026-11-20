import { Particle, ParticleContainer, Text, Texture } from "pixi.js";

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

export {
  Particle as a,
  ParticleContainer as i,
  textureTache as n,
  Text as o,
  textureVignette as r,
  textureDegrade as t,
};