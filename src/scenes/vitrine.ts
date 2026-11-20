import { Rectangle, Texture, Container, Sprite, Assets } from "pixi.js";
import { n as largeur, r as Flux, t as hauteur } from "../core";
import {
  c as AnimatedSprite,
  n as construireTuiles,
  o as FiltreBloom,
  r as chargerNiveau,
  s as TilingSprite,
  t as HUD,
} from "../ui/hud";
import {
  a as Particle,
  i as ParticleContainer,
  n as textureTache,
  r as textureVignette,
  t as textureDegrade,
} from "../render/textures";

const base = import.meta.env.BASE_URL;

interface ContexteScene {
  app: any;
  racine: Container;
}

interface Braise {
  p: Particle;
  vx: number;
  vy: number;
  vie: number;
  duree: number;
  phase: number;
  taille: number;
}

class Braises extends Container {
  tex: Texture;
  largeur: number;
  hauteur: number;
  couleurs: number[];
  conteneur: ParticleContainer;
  braises: Braise[] = [];
  flux = new Flux(`decor|braises`);
  constructor(
    tex: Texture,
    largeur: number,
    hauteur: number,
    nombre: number,
    couleurs = [16752704, 16738848, 16765056],
  ) {
    super();
    this.tex = tex;
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.couleurs = couleurs;
    this.conteneur = new ParticleContainer({
      dynamicProperties: { position: true, color: true, vertex: true },
    });
    this.conteneur.blendMode = `add`;
    this.addChild(this.conteneur);
    for (let i = 0; i < nombre; i++) {
      const braise = this.nouvelle();
      braise.vie = this.flux.randf() * braise.duree;
      braise.p.y = this.flux.randf() * this.hauteur;
      this.braises.push(braise);
      this.conteneur.addParticle(braise.p);
    }
  }
  nouvelle(existante?: Braise): Braise {
    const flux = this.flux;
    const taille = flux.randfRange(0.05, 0.22);
    const p =
      existante?.p ?? new Particle({ texture: this.tex, anchorX: 0.5, anchorY: 0.5 });
    p.x = flux.randf() * this.largeur;
    p.y = this.hauteur + 20;
    p.scaleX = p.scaleY = taille;
    p.tint = flux.choisir(this.couleurs);
    const braise = existante ?? {
      p,
      vx: 0,
      vy: 0,
      vie: 0,
      duree: 1,
      phase: 0,
      taille,
    };
    braise.vx = flux.randfRange(-18, 18);
    braise.vy = -flux.randfRange(25, 90);
    braise.vie = 0;
    braise.duree = flux.randfRange(4, 11);
    braise.phase = flux.randf() * Math.PI * 2;
    braise.taille = taille;
    return braise;
  }
  mettreAJour(dt: number) {
    for (const braise of this.braises) {
      braise.vie += dt;
      if (braise.vie >= braise.duree || braise.p.y < -20) {
        this.nouvelle(braise);
        continue;
      }
      const fraction = braise.vie / braise.duree;
      braise.p.x += (braise.vx + Math.sin(braise.vie * 1.7 + braise.phase) * 22) * dt;
      braise.p.y += braise.vy * dt;
      braise.p.alpha =
        Math.min(1, fraction * 6) *
        (1 - fraction) *
        (0.6 + 0.4 * Math.sin(braise.vie * 9 + braise.phase));
    }
  }
}

function douillePour(sprite: AnimatedSprite, atlas: any, animation: string) {
  const cle = `${animation}_${String(sprite.currentFrame).padStart(2, `0`)}`;
  const frame = atlas.data.frames[cle];
  if (!frame?.douille) return null;
  const ancreX = frame.anchor?.x ?? 0.5;
  const ancreY = frame.anchor?.y ?? 0.5;
  const decalX = (frame.douille.x - ancreX) * frame.frame.w;
  const decalY = (frame.douille.y - ancreY) * frame.frame.h;
  const [dirX, dirY] = frame.douille.dir;
  const norme = Math.hypot(dirX, dirY) || 1;
  const sens = Math.sign(sprite.scale.x) || 1;
  return {
    x: sprite.x + decalX * sprite.scale.x,
    y: sprite.y + decalY * Math.abs(sprite.scale.y),
    dx: (dirX / norme) * sens,
    dy: dirY / norme,
  };
}

let texFlecheCache: Texture | null = null;
function textureFleche(): Texture {
  if (texFlecheCache) return texFlecheCache;
  const canvas = document.createElement(`canvas`);
  canvas.width = 256;
  canvas.height = 48;
  const contexte = canvas.getContext(`2d`);
  if (!contexte) throw Error(`canvas 2d indisponible`);
  const degrade = contexte.createLinearGradient(0, 0, 256, 0);
  degrade.addColorStop(0, `rgba(255,190,60,0)`);
  degrade.addColorStop(0.7, `rgba(255,200,80,0.55)`);
  degrade.addColorStop(1, `rgba(255,230,150,0.9)`);
  contexte.fillStyle = degrade;
  contexte.fillRect(0, 16, 230, 16);
  contexte.fillStyle = `rgba(255,248,220,1)`;
  contexte.fillRect(20, 22, 210, 4);
  contexte.beginPath();
  contexte.moveTo(256, 24);
  contexte.lineTo(222, 10);
  contexte.lineTo(230, 24);
  contexte.lineTo(222, 38);
  contexte.closePath();
  contexte.fillStyle = `rgba(255,236,170,1)`;
  contexte.fill();
  texFlecheCache = Texture.from(canvas);
  return texFlecheCache;
}

interface Etincelle {
  s: Sprite;
  vx: number;
  vy: number;
  vie: number;
  duree: number;
}

class Fleche extends Container {
  corps = new Sprite(textureFleche());
  traine: Sprite[] = [];
  positions: { x: number; y: number }[] = [];
  etincelles: Etincelle[] = [];
  anneau = new Sprite(textureTache(128));
  flux = new Flux(`decor|fleche`);
  x0 = 0;
  y0 = 0;
  x1 = 0;
  y1 = 0;
  t = 0;
  duree = 0.32;
  pause = 1e9;
  constructor() {
    super();
    this.blendMode = `add`;
    for (let i = 0; i < 24; i++) {
      const segment = new Sprite(textureTache(64));
      segment.anchor.set(0.5);
      segment.tint = i < 4 ? 16773824 : 16756784;
      this.traine.push(segment);
      this.addChild(segment);
    }
    this.corps.anchor.set(0.9, 0.5);
    this.corps.scale.set(0.62, 0.42);
    this.addChild(this.corps);
    this.anneau.anchor.set(0.5);
    this.anneau.tint = 16765040;
    this.anneau.alpha = 0;
    this.addChild(this.anneau);
    for (let i = 0; i < 26; i++) {
      const sprite = new Sprite(textureTache(32));
      sprite.anchor.set(0.5);
      sprite.tint = this.flux.choisir([16769162, 16756800, 16777215]);
      sprite.visible = false;
      this.etincelles.push({ s: sprite, vx: 0, vy: 0, vie: 0, duree: 1 });
      this.addChild(sprite);
    }
  }
  viser(x0: number, y0: number, x1: number, y1: number) {
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
    this.t = 0;
    this.pause = 0;
    this.positions.length = 0;
  }
  impact() {
    this.anneau.position.set(this.x1, this.y1);
    this.anneau.alpha = 1;
    this.anneau.scale.set(0.4);
    for (const etincelle of this.etincelles) {
      const angle = this.flux.randf() * Math.PI * 2;
      const vitesse = this.flux.randfRange(180, 620);
      etincelle.s.position.set(this.x1, this.y1);
      etincelle.vx = Math.cos(angle) * vitesse;
      etincelle.vy = Math.sin(angle) * vitesse;
      etincelle.vie = 0;
      etincelle.duree = this.flux.randfRange(0.25, 0.6);
      etincelle.s.visible = true;
    }
  }
  mettreAJour(dt: number) {
    if (this.pause > 0) this.corps.visible = false;
    else {
      this.t += dt;
      const fraction = Math.min(1, this.t / this.duree);
      const x = this.x0 + (this.x1 - this.x0) * fraction;
      const y = this.y0 + (this.y1 - this.y0) * fraction;
      this.corps.position.set(x, y);
      this.corps.rotation = Math.atan2(this.y1 - this.y0, this.x1 - this.x0);
      this.corps.visible = true;
      this.positions.unshift({ x, y });
      if (this.positions.length > this.traine.length) this.positions.pop();
      if (fraction >= 1) {
        this.impact();
        this.pause = 1e9;
        this.corps.visible = false;
      }
    }
    this.traine.forEach((segment, i) => {
      const position = this.positions[i];
      segment.visible = !!position && this.pause <= 0;
      if (!position) return;
      segment.position.set(position.x, position.y);
      const recul = 1 - i / this.traine.length;
      segment.scale.set(0.9 + 0.6 * recul, 0.06 + 0.1 * recul);
      segment.rotation = this.corps.rotation;
      segment.alpha = 0.9 * recul;
    });
    this.anneau.alpha = Math.max(0, this.anneau.alpha - dt * 3.5);
    this.anneau.scale.set(this.anneau.scale.x + dt * 9);
    for (const etincelle of this.etincelles) {
      if (!etincelle.s.visible) continue;
      etincelle.vie += dt;
      if (etincelle.vie >= etincelle.duree) {
        etincelle.s.visible = false;
        continue;
      }
      etincelle.vx *= 1 - dt * 3;
      etincelle.vy = etincelle.vy * (1 - dt * 3) + 400 * dt;
      etincelle.s.x += etincelle.vx * dt;
      etincelle.s.y += etincelle.vy * dt;
      const restant = 1 - etincelle.vie / etincelle.duree;
      etincelle.s.alpha = restant;
      etincelle.s.scale.set(0.12 + 0.3 * restant, 0.1 + 0.12 * restant);
      etincelle.s.rotation = Math.atan2(etincelle.vy, etincelle.vx);
    }
  }
}

const baseAssets = `${base}assets/art/`;
async function chargerImage(chemin: string) {
  return Assets.load(baseAssets + chemin);
}

const lancer = async (ctx: ContexteScene) => {
  const app = ctx.app;
  const imageParam = new URLSearchParams(location.search).get(`image`);
  if (imageParam) {
    const image = new Sprite(await chargerImage(imageParam));
    const echelle = Math.min(largeur / image.width, hauteur / image.height);
    image.scale.set(echelle);
    image.anchor.set(0.5);
    image.position.set(largeur / 2, hauteur / 2);
    ctx.racine.addChild(image);
    return;
  }
  const niveau: any = await chargerNiveau(
    `${base}levels/w1/1-1/stage.json`,
    async (url: string) => (await fetch(url)).text(),
  );
  const [
    fondLointain,
    fondMilieu,
    tuileBloc,
    tuileBordHaut,
    tuilePlateformeGauche,
    tuilePlateformeMilieu,
    tuilePlateformeDroite,
    texPitProfil,
    texMonoeye,
    texBrasero,
    iconeCoeur,
    iconeCoeurVide,
    iconeAile,
    iconeEtoile,
    iconeFiole,
    iconeFleche,
  ] = await Promise.all([
    chargerImage(`1-1/fond_lointain.webp`),
    chargerImage(`1-1/fond_milieu.webp`),
    chargerImage(`1-1/bloc.webp`),
    chargerImage(`1-1/bord_haut.webp`),
    chargerImage(`1-1/plateforme_gauche.webp`),
    chargerImage(`1-1/plateforme_milieu.webp`),
    chargerImage(`1-1/plateforme_droite.webp`),
    chargerImage(`pit/pit_profil.webp`),
    chargerImage(`ennemis/monoeye.webp`),
    chargerImage(`1-1/brasero.webp`),
    chargerImage(`hud/coeur.webp`),
    chargerImage(`hud/coeur_vide.webp`),
    chargerImage(`hud/aile.webp`),
    chargerImage(`hud/etoile.webp`),
    chargerImage(`hud/fiole.webp`),
    chargerImage(`hud/fleche.webp`),
  ]);
  const largeurNiveauPx = niveau.largeur * 64;
  const decalX = (largeur - largeurNiveauPx) / 2;
  const lignesVisibles = Math.ceil(hauteur / 64) + 1;
  const hauteurNiveau = niveau.hauteur;
  const premiereLigne = hauteurNiveau - lignesVisibles;
  const decalY = hauteurNiveau * 64 - hauteur + 38.4;
  const fond = new Sprite(fondLointain);
  const echelleFond =
    Math.max(largeur / fondLointain.width, hauteur / fondLointain.height) * 1.08;
  fond.scale.set(echelleFond);
  fond.anchor.set(0.5);
  fond.position.set(largeur / 2, hauteur / 2);
  ctx.racine.addChild(fond);
  const hauteurMilieu = hauteur * 0.78;
  const milieu = new TilingSprite({
    texture: fondMilieu,
    width: largeur,
    height: hauteurMilieu,
  });
  milieu.tileScale.set(hauteurMilieu / fondMilieu.height);
  milieu.y = hauteur - hauteurMilieu + 40;
  milieu.tint = 9273240;
  milieu.alpha = 0.9;
  ctx.racine.addChild(milieu);
  const voileHaut = new Sprite(
    textureDegrade(`rgba(34,24,44,0.25)`, `rgba(70,30,30,0.35)`, 256),
  );
  voileHaut.width = largeur;
  voileHaut.height = hauteur;
  ctx.racine.addChild(voileHaut);
  const voileBas = new Sprite(
    textureDegrade(`rgba(40,26,48,0)`, `rgba(70,32,40,0.55)`, 256),
  );
  voileBas.width = largeur;
  voileBas.height = hauteur * 0.6;
  voileBas.y = hauteur * 0.4;
  ctx.racine.addChild(voileBas);
  const monde = new Container();
  monde.position.set(decalX, -decalY);
  ctx.racine.addChild(monde);
  const configTuiles = {
    bloc: tuileBloc,
    blocEchelle: 0.5,
    bordHaut: tuileBordHaut,
    bordHautHauteur: 64,
    bordHautSurface: 0.3,
    plateformeGauche: tuilePlateformeGauche,
    plateformeMilieu: tuilePlateformeMilieu,
    plateformeDroite: tuilePlateformeDroite,
    plateformeHauteur: 92,
    plateformeSurface: 0.16,
    ombre: 328458,
  };
  monde.addChild(construireTuiles(niveau, configTuiles, premiereLigne, hauteurNiveau));
  for (const [colonne, ligne] of [
    [3, hauteurNiveau - 2],
    [20, hauteurNiveau - 2],
  ]) {
    const brasero = new Sprite(texBrasero);
    brasero.anchor.set(0.5, 1);
    brasero.height = 120;
    brasero.scale.x = brasero.scale.y;
    brasero.position.set((colonne + 0.5) * 64, ligne * 64);
    monde.addChild(brasero);
    const lueur = new Sprite(textureTache(128));
    lueur.anchor.set(0.5);
    lueur.tint = 16747056;
    lueur.alpha = 0.55;
    lueur.blendMode = `add`;
    lueur.scale.set(3.2);
    lueur.position.set(brasero.x, brasero.y - 95);
    monde.addChild(lueur);
  }
  const depart = niveau.depart;
  const atlasPit: any = await Assets.load(baseAssets + `pit/pit.json`);
  const creerAnimation = (animation: string, fps: number) => {
    const sprite = new AnimatedSprite(atlasPit.animations[animation] ?? []);
    sprite.updateAnchor = true;
    sprite.animationSpeed = fps / 60;
    sprite.scale.set(0.56);
    sprite.play();
    return sprite;
  };
  const pitRepos = creerAnimation(`repos`, 8);
  pitRepos.position.set((depart.c + 0.5) * 64, (depart.l + 1) * 64);
  monde.addChild(pitRepos);
  const marqueurMonoeye = niveau.marqueurs.find(
    (m: any) => m.def.ennemi === `monoeye` && m.pos.l >= premiereLigne,
  );
  const monoeye = new Sprite(texMonoeye);
  monoeye.anchor.set(0.5);
  monoeye.height = 124;
  monoeye.scale.x = monoeye.scale.y;
  monoeye.position.set(
    ((marqueurMonoeye?.pos.c ?? 18) + 0.5) * 64,
    ((marqueurMonoeye?.pos.l ?? hauteurNiveau - 8) + 0.5) * 64,
  );
  monde.addChild(monoeye);
  const pitTir = creerAnimation(`tir`, 9);
  pitTir.position.set(544, monoeye.y + 40);
  monde.addChild(pitTir);
  const fleche = new Fleche();
  monde.addChild(fleche);
  const tirerFleche = () => {
    const douille = douillePour(pitTir, atlasPit, `tir`);
    if (douille)
      fleche.viser(
        douille.x,
        douille.y,
        monoeye.x - 40,
        douille.y + douille.dy * (monoeye.x - douille.x),
      );
  };
  pitTir.onFrameChange = (frame: number) => {
    if (frame === 3) tirerFleche();
  };
  const braises = new Braises(textureTache(32), largeur, hauteur, 90);
  ctx.racine.addChild(braises);
  ctx.racine.filters = [
    new FiltreBloom({
      threshold: 0.72,
      bloomScale: 0.9,
      brightness: 1,
      blur: 6,
      quality: 5,
    }),
  ];
  const [texColonne, texChaines] = await Promise.all([
    chargerImage(`1-1/cadre_colonne.webp`).catch(() => null),
    chargerImage(`1-1/avant_plan_chaines.webp`).catch(() => null),
  ]);
  if (texColonne)
    for (const sens of [-1, 1]) {
      const colonne = new Sprite(texColonne);
      colonne.anchor.set(0.5, 1);
      colonne.height = hauteur * 1.12;
      colonne.scale.x = colonne.scale.y * sens;
      colonne.position.set(
        sens < 0 ? decalX * 0.62 : largeur - decalX * 0.62,
        hauteur + 30,
      );
      colonne.tint = 12101808;
      ctx.racine.addChild(colonne);
    }
  if (texChaines) {
    const textureHaut = new Texture({
      source: texChaines.source,
      frame: new Rectangle(0, 0, texChaines.width, Math.round(texChaines.height * 0.42)),
    });
    const chaines = new Sprite(textureHaut);
    chaines.width = largeur * 1.02;
    chaines.scale.y = chaines.scale.x;
    chaines.position.set(-20, -30);
    const masque = new Sprite(
      textureDegrade(`rgba(255,255,255,1)`, `rgba(255,255,255,0)`, 256, 0.5),
    );
    masque.position.set(chaines.x, chaines.y);
    masque.width = chaines.width;
    masque.height = chaines.height;
    ctx.racine.addChild(masque);
    chaines.mask = masque;
    chaines.tint = 5917784;
    ctx.racine.addChild(chaines);
  }
  const vignette = new Sprite(textureVignette(0.6));
  vignette.width = largeur;
  vignette.height = hauteur;
  ctx.racine.addChild(vignette);
  const hud = new HUD({
    coeur: iconeCoeur,
    coeurVide: iconeCoeurVide,
    aile: iconeAile,
    etoile: iconeEtoile,
    fiole: iconeFiole,
    fleche: iconeFleche,
  });
  hud.afficher({
    pv: 83,
    pvMax: 100,
    vol: 0.92,
    monnaie: 124,
    pouvoirs: [
      { id: `soin`, charge: 1, reste: 0 },
      { id: `eclair`, charge: 0.6, reste: 12 },
    ],
    manette: true,
    fioles: 1,
  });
  ctx.racine.addChild(hud);
  let temps = 0;
  const yMonoeye = monoeye.y;
  app.ticker.add((tick: any) => {
    const dt = tick.deltaMS / 1000;
    temps += dt;
    braises.mettreAJour(dt);
    monoeye.y = yMonoeye + Math.sin(temps * 2.1) * 6;
    fleche.mettreAJour(dt);
    milieu.tilePosition.x = Math.sin(temps * 0.05) * 30;
  });
};

export { lancer };