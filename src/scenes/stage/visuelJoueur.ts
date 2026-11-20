import { Container, Sprite } from "pixi.js";
import { c as SpriteAnime } from "../../ui/hud";
import { n as textureHalo } from "../../render/textures";
import { directionCardinale } from "./arme";
import { EtatJoueur } from "./joueur";

const echelle = 0.56;
const animsTir = [
  "visee",
  "tir",
  "visee_sol",
  "tir_debout",
  "course_tir",
  "accroupi_tir",
  "tir_haut_debout",
  "tir_haut_air",
  "tir_haut_accroupi",
  "tir_bas",
];
const fenetreRecul = 0.05;
const fenetrePose = 0.11;

export class VisuelJoueur extends Container {
  planche: any;
  joueur: any;
  sprite: SpriteAnime;
  anim: string | null = null;
  animations: any;
  atterrissage = 0;
  touche = 0;
  tirRecent = 0;
  dirTir = { x: 1, y: 0 };
  imageCourante = "";
  accroupiDepuis = 0;
  depuisTir = 1 / 0;
  eclair = new Sprite(textureHalo(64));

  constructor(planche: any, joueur: any) {
    super();
    this.planche = planche;
    this.joueur = joueur;
    this.animations = planche.animations;
    this.sprite = new SpriteAnime(this.animations.repos ?? []);
    this.sprite.updateAnchor = true;
    this.sprite.scale.set(echelle);
    this.eclair.anchor.set(0.5);
    this.eclair.blendMode = "add";
    this.eclair.tint = 16770720;
    this.eclair.visible = false;
    this.addChild(this.sprite, this.eclair);
    joueur.aAtterri.connecter(() => {
      this.atterrissage = 0.1;
    });
  }

  signalerCoup() {
    this.touche = 0.35;
  }

  signalerTir(dx: number, dy: number) {
    this.tirRecent = 0.35;
    this.depuisTir = 0;
    this.dirTir = { x: dx, y: dy };
  }

  jouer(nom: string, anim: string, vitesse: number, indices?: number[], boucle = true) {
    const frames = this.animations[anim] ?? [],
      textures = indices ? indices.map((i) => frames[i]).filter((t) => !!t) : frames;
    if (this.anim !== nom) {
      this.anim = nom;
      this.sprite.textures = textures;
      this.sprite.loop = boucle;
      this.sprite.gotoAndPlay(0);
    }
    this.sprite.animationSpeed = vitesse / 60;
    const image = indices ? (indices[this.sprite.currentFrame] ?? 0) : this.sprite.currentFrame;
    this.imageCourante = this.nomImage(anim, image);
  }

  image(nom: string, anim: string, indice: number) {
    const frame = this.animations[anim]?.[indice];
    if (frame) {
      this.anim = nom;
      this.sprite.textures = [frame];
      this.sprite.gotoAndStop(0);
      this.imageCourante = this.nomImage(anim, indice);
    }
  }

  nomImage(anim: string, indice: number): string {
    return this.planche.data.animations?.[anim]?.[indice] ?? "";
  }

  directionVisee() {
    const j = this.joueur,
      intention = j.intention;
    let x = this.tirRecent > 0 ? this.dirTir.x : intention.viseeX,
      y = this.tirRecent > 0 ? this.dirTir.y : intention.viseeY;
    if (x === 0 && y === 0) {
      x = j.face;
      y = 0;
    }
    if (Math.abs(x) > 0.2) j.face = x > 0 ? 1 : -1;
    const [dx, dy] = directionCardinale(x, y, j.face);
    return { x: dx, y: dy };
  }

  poseDeTir(indiceTir: number) {
    const j = this.joueur,
      corps = j.corps,
      anims = this.animations,
      haut = this.directionVisee().y < -0.5,
      recent = +(this.depuisTir < fenetrePose);
    if (j.accroupi) {
      if (haut && anims.tir_haut_accroupi) this.image("tir_haut_accroupi", "tir_haut_accroupi", recent);
      else if (anims.tir_bas)
        this.image(
          "tir_bas",
          "tir_bas",
          this.depuisTir < fenetreRecul ? 1 : this.depuisTir < fenetrePose ? 2 : 0,
        );
      else this.image("accroupi_tir", "accroupi_tir", recent);
    } else if (corps.auSol) {
      if (haut && anims.tir_haut_debout) this.image("tir_haut_debout", "tir_haut_debout", recent);
      else if (!haut && Math.abs(corps.vx) > 20 && anims.course_tir)
        this.jouer("course_tir", "course_tir", 14);
      else if (!haut && anims.tir_debout) this.image("tir_debout", "tir_debout", indiceTir);
      else this.image("visee_sol", "visee_sol", haut ? 0 : 2);
    } else {
      if (haut && anims.tir_haut_air) this.image("tir_haut_air", "tir_haut_air", recent);
      else if (!haut && anims.tir) this.image("tir", "tir", indiceTir);
      else this.image("visee", "visee", haut ? 0 : 2);
    }
  }

  mettreAJour(dt: number, x: number, y: number) {
    const j = this.joueur,
      corps = j.corps,
      intention = j.intention;
    this.atterrissage = Math.max(0, this.atterrissage - dt);
    this.touche = Math.max(0, this.touche - dt);
    this.tirRecent = Math.max(0, this.tirRecent - dt);
    const enTir = this.tirRecent > 0 || intention.tir;
    this.accroupiDepuis = j.accroupi ? this.accroupiDepuis + dt : 0;
    this.depuisTir += dt;
    const indiceTir = this.depuisTir < fenetreRecul ? 3 : this.depuisTir < fenetrePose ? 4 : 2;
    if (this.touche > 0) this.jouer("touche", "dash_degats", 10, [2, 3]);
    else if (j.etat === EtatJoueur.DASH) this.jouer("dash", "dash_degats", 14, [0, 1]);
    else if (enTir) this.poseDeTir(indiceTir);
    else if (j.accroupi && this.animations.accroupi) {
      if (this.accroupiDepuis < 0.08) this.image("accroupi_descente", "accroupi_descente", 0);
      else this.jouer("accroupi", "accroupi", 5);
    } else if (j.planant || j.volLibre) this.jouer("vol", "vol", 12);
    else if (corps.auSol) {
      if (this.atterrissage > 0) this.image("saut", "saut", 5);
      else if (Math.abs(corps.vx) > 20) {
        this.jouer("course", "course", 14);
        this.sprite.animationSpeed =
          (14 / 60) *
          Math.min(1.3, Math.max(0.5, Math.abs(corps.vx) / j.reglages.vitesseCourse));
      } else this.jouer("repos", "repos", 8);
    } else {
      const indice = corps.vy < -90 ? 2 : corps.vy < 60 ? 3 : 4;
      this.image("saut", "saut", indice);
    }
    this.sprite.scale.x = echelle * j.face;
    const decalage =
      this.anim === "visee" ||
      this.anim === "tir" ||
      this.anim === "tir_haut_air" ||
      this.anim === "vol" ||
      this.anim === "dash" ||
      this.anim === "touche"
        ? corps.hauteur / 2
        : 0;
    this.position.set(x * 4, (y - decalage) * 4);
    this.sprite.position.set(0, 0);
    this.sprite.rotation = 0;
    const animTir = this.anim !== null && animsTir.includes(this.anim),
      recul = animTir ? Math.max(0, 1 - this.depuisTir / 0.12) : 0;
    if (recul > 0) {
      const norme = Math.hypot(this.dirTir.x, this.dirTir.y) || 1;
      this.sprite.x -= (this.dirTir.x / norme) * 7 * recul;
      this.sprite.y -= (this.dirTir.y / norme) * 7 * recul;
      this.sprite.rotation = -j.face * 0.04 * recul;
    }
    const douille = animTir && this.depuisTir < 0.08 ? this.douilleEcran() : null;
    this.eclair.visible = !!douille;
    if (douille) {
      const reste = 1 - this.depuisTir / 0.08;
      this.eclair.position.set(douille.x - this.x, douille.y - this.y);
      this.eclair.scale.set(0.9 + 0.8 * reste);
      this.eclair.alpha = reste;
    }
    this.alpha =
      j.invulnerable > 0 && j.etat !== EtatJoueur.DASH && Math.floor(j.invulnerable * 20) % 2 == 0
        ? 0.45
        : 1;
  }

  douilleEcran(): { x: number; y: number } | null {
    const frame = this.planche.data.frames[this.imageCourante];
    if (!frame?.douille) return null;
    const ancreX = frame.anchor?.x ?? 0.5,
      ancreY = frame.anchor?.y ?? 0.5;
    return {
      x: this.x + this.sprite.x + (frame.douille.x - ancreX) * frame.frame.w * this.sprite.scale.x,
      y: this.y + this.sprite.y + (frame.douille.y - ancreY) * frame.frame.h * this.sprite.scale.y,
    };
  }
}