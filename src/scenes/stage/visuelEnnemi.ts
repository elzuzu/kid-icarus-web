import { Container, Graphics, Sprite } from "pixi.js";
import { c as SpriteAnime } from "../../ui/hud";
import { n as textureHalo } from "../../render/textures";
import { flashesActifs } from "../../render/ambiance";
import { r as Flux } from "../../core";

const dureeFlash = 0.12;
const particulesDissolution = 14;

export class VisuelEnnemi extends Container {
  ennemi: any;
  planche: any;
  sprite: SpriteAnime;
  barre = new Graphics();
  anim = "";
  flash = 0;
  echelle: number;
  facePeinte: number;
  auxPieds: boolean;
  sansBarre = false;
  etatPrecedent = "";
  prepareDepuis = 0;
  attaqueDepuis = 0;
  // Dissolution de mort : pool fixe créé une seule fois (première frame de mort),
  // piloté par e.mortDepuis — aucun timer, aucune allocation par frame.
  dissolution: Sprite[] | null = null;

  constructor(ennemi: any, planche: any) {
    super();
    this.ennemi = ennemi;
    this.planche = planche;
    const anims = planche.animations;
    this.sprite = new SpriteAnime(anims.boucle ?? Object.values(anims)[0] ?? []);
    this.sprite.updateAnchor = true;
    this.sprite.animationSpeed = 10 / 60;
    this.sprite.play();
    const premiere = anims.boucle?.[0],
      hauteur = ennemi.taille.y * 4,
      facteur = Number(planche.data.meta.face_peinte ?? 1) < 0 ? 1.75 : 1.35;
    this.echelle = premiere ? (hauteur * facteur) / premiere.height : 1;
    this.sprite.scale.set(this.echelle);
    const meta = planche.data.meta;
    this.facePeinte = Number(meta.face_peinte ?? 1);
    this.auxPieds = meta.infos?.boucle?.ancre === "pieds";
    this.addChild(this.sprite, this.barre);
    ennemi.combattant.touche.connecter(() => {
      this.flash = dureeFlash;
    });
  }

  jouer(nom: string, vitesse: number, boucle = true) {
    if (this.anim === nom) return;
    const frames = this.planche.animations[nom];
    if (frames?.length) {
      this.anim = nom;
      this.sprite.textures = frames;
      this.sprite.loop = boucle;
      this.sprite.animationSpeed = vitesse / 60;
      this.sprite.gotoAndPlay(0);
    }
  }

  mettreAJour(dt: number, x: number, y: number) {
    const e = this.ennemi;
    this.flash = Math.max(0, this.flash - dt);
    // WHY: horodatage local des transitions pour piloter les poses procédurales
    // sans toucher aux minuteries de la simulation.
    if (e.etatVisuel !== this.etatPrecedent) {
      if (e.etatVisuel === "prepare") this.prepareDepuis = 0;
      if (e.etatVisuel === "attaque") this.attaqueDepuis = 0;
      this.etatPrecedent = e.etatVisuel;
    }
    this.prepareDepuis += dt;
    this.attaqueDepuis += dt;
    switch (e.etatVisuel) {
      case "prepare":
        this.jouer("prepare", 8);
        break;
      case "attaque":
        this.jouer("attaque", 8);
        break;
      case "mort":
        this.jouer("mort", 8, false);
        break;
      default:
        this.jouer(this.flash > 0 ? "touche" : "boucle", 10);
    }
    if (this.flash > 0 && e.etatVisuel !== "mort") this.jouer("touche", 10);
    const face = e.face >= 0 ? 1 : -1;
    let poseX = 1,
      poseY = 1,
      poseRot = 0,
      posePx = 0,
      tint = this.flash > 0 ? (flashesActifs() ? 16771288 : 0xffd8c8) : 16777215;
    if (e.etatVisuel === "prepare") {
      const k = Math.min(1, this.prepareDepuis / 0.1);
      poseX = 1 + 0.12 * k;
      poseY = 1 - 0.12 * k;
      if (this.flash <= 0) {
        // WHY: pulse blanc/or 8 Hz (amplitude 0.25) pour rendre le coup à venir lisible.
        const p = (flashesActifs() ? 0.25 : 0.12) * (0.5 + 0.5 * Math.sin(this.prepareDepuis * Math.PI * 16));
        tint = (255 << 16) | (Math.round(255 - 55 * p) << 8) | Math.round(255 - 191 * p);
      }
    } else if (e.etatVisuel === "attaque") {
      // WHY: windup→strike puis retour en 0.15 s ; la frame attaque reste affichée.
      const r = Math.max(0, 1 - this.attaqueDepuis / 0.15),
        k = r * r,
        vers = typeof e.versCible === "function" ? e.versCible() : null,
        sens = vers && Math.abs(vers.x) > 1 ? Math.sign(vers.x) : face;
      poseX = 1 - 0.1 * k;
      poseY = 1 + 0.15 * k;
      poseRot = sens * 0.2 * k;
    } else if (e.etatVisuel === "mort") {
      // WHY: sursaut → affaissement → fade ; le fade chevauche la fin de l'affaissement
      // pour rester dans les 0.7 s du despawn simulation (ennemi.ts, non modifié).
      const t = e.mortDepuis;
      if (t < 0.06) {
        poseX = poseY = 1 + 0.2 * (t / 0.06);
      } else {
        const p = Math.min(1, (t - 0.06) / 0.35),
          k = 1 - (1 - p) * (1 - p);
        poseX = 1.2 - 0.1 * k;
        poseY = 1.2 - 0.6 * k;
        poseRot = face * 0.4 * k;
        posePx = 8 * k;
      }
      this.majDissolution(t);
    }
    this.sprite.scale.x = this.echelle * face * this.facePeinte * poseX;
    this.sprite.scale.y = this.echelle * poseY;
    this.sprite.rotation = poseRot;
    this.position.set(x * 4, (y - (this.auxPieds ? 0 : e.taille.y / 2)) * 4 + posePx);
    this.sprite.tint = tint;
    this.alpha =
      e.etatVisuel === "mort"
        ? Math.max(0, 1 - Math.max(0, e.mortDepuis - 0.35) / 0.35)
        : 1 - e.fondu;
    const c = e.combattant;
    this.barre.clear();
    if (c.vivant && c.pv < c.pvMax && !this.sansBarre) {
      const haut = -(this.auxPieds ? e.taille.y : e.taille.y / 2) * 4 - 22;
      this.barre.rect(-29, haut - 1, 58, 9).fill({ color: 722440, alpha: 0.85 });
      this.barre.rect(-28, haut, 56 * (c.pv / c.pvMax), 7).fill(14164010);
      this.barre.rect(-28, haut, 56 * (c.pv / c.pvMax), 2).fill({ color: 16744576, alpha: 0.6 });
    }
  }

  // Dissolution en particules pendant l'affaissement : pool fixe de 14 sprites
  // additifs créé à la première frame de mort, trajectoires déterministes (Flux
  // seedé par la position de mort), lecture seule de e.mortDepuis — aucun timer.
  majDissolution(t: number) {
    const e = this.ennemi;
    if (!this.dissolution) {
      const flux = new Flux(`mort|${e.def?.id ?? "boss"}|${Math.round(e.x)}|${Math.round(e.y)}`);
      this.dissolution = [];
      const teintes = [0xffc070, 0xff8040, 0xbfe8ff];
      for (let i = 0; i < particulesDissolution; i++) {
        const s = new Sprite(textureHalo(32)) as any;
        s.anchor.set(0.5);
        s.blendMode = "add";
        s.tint = flux.choisir(teintes);
        const a = flux.randf() * Math.PI * 2;
        s.vx = Math.cos(a) * flux.randfRange(10, 46);
        s.vy = -flux.randfRange(14, 60);
        s.ox = flux.randfRange(-e.taille.x * 2, e.taille.x * 2);
        s.oy = flux.randfRange(-e.taille.y * 2, e.taille.y * 2);
        s.phase = flux.randf() * Math.PI * 2;
        s.taille = flux.randfRange(0.14, 0.3);
        this.dissolution.push(s);
        this.addChild(s);
      }
    }
    const p = Math.min(1, t / 0.7),
      cy0 = this.auxPieds ? -e.taille.y * 2 : 0,
      entree = Math.min(1, t / 0.08);
    for (let i = 0; i < this.dissolution.length; i++) {
      const s = this.dissolution[i] as any;
      if (p >= 1) {
        s.visible = false;
        continue;
      }
      s.visible = true;
      s.x = s.ox + s.vx * t * 4 + Math.sin(t * 6 + s.phase) * 8 * p;
      s.y = cy0 + s.oy + s.vy * t * 4 + 30 * t * t * 4;
      s.alpha = (1 - p) * 0.95 * entree;
      s.scale.set(s.taille * (1 + p * 0.8));
    }
  }
}