import { Container, Sprite } from "pixi.js";
import { O as Signal } from "../../app";
import { c as SpriteAnime } from "../../ui/hud";
import { n as textureHalo } from "../../render/textures";
import { flashesActifs } from "../../render/ambiance";
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
const dureeSwing = 0.18;
const dureeTourbillon = 0.25;
const dureeEcrasement = 0.12;
const dureeEtirement = 0.1;
const dureeFantome = 0.25;
const intervalleFantomes = 0.03;
const maxFantomes = 3;
const dureeGlisse = 0.18;
const dureeFlashCoup = 0.08;

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
  fantomes = new Container();
  // Pool de fantômes de dash : 3 sprites réutilisés en anneau, zéro create/destroy.
  poolFantomes: Sprite[] = [];
  indiceFantome = 0;
  swingRestant = 0;
  swingDuree = dureeSwing;
  swingCombo = 0;
  ecrasement = 0;
  etirement = 0;
  fenetreFantomes = 0;
  ticFantome = 0;
  frappeAbonnee = false;
  glisse = 0;
  vxPrecedent = 0;
  aGlisse = new Signal();
  // Flash de coup : copie additive du sprite (tint multiplicatif ne peut pas
  // blanchir) — 1 sprite poolé, actif ≤0.08 s, gaté options.flashes. Distinct du
  // clignotement d'invulnérabilité (alpha), qui reste intact.
  flashCoup = 0;
  flashSprite = new Sprite();

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
    this.flashSprite.blendMode = "add";
    this.flashSprite.visible = false;
    this.addChild(this.sprite, this.eclair, this.flashSprite);
    for (let i = 0; i < maxFantomes; i++) {
      const fantome = new Sprite();
      fantome.visible = false;
      fantome.tint = 0xcfe8ff;
      this.poolFantomes.push(fantome);
      this.fantomes.addChild(fantome);
    }
    joueur.aAtterri.connecter(() => {
      this.atterrissage = 0.1;
      this.ecrasement = dureeEcrasement;
    });
    joueur.aSaute.connecter(() => {
      this.etirement = dureeEtirement;
    });
    joueur.aDashe.connecter(() => {
      this.fenetreFantomes = 0.18;
      this.ticFantome = 0;
    });
    // Hook debug (même esprit que window.__sim / __hud) : inspection QA du flash
    // de coup et des poses, sans toucher à stage/index.ts.
    (window as any).__visuelJoueur = this;
  }

  // WHY: aFrappe vit sur l'arme, pas sur le joueur, et index.ts ne passe que le joueur ;
  // on préfère le relais joueur.aFrappeVisuel s'il existe, sinon abonnement lecture seule
  // via __sim (exposé avant la première frame), vérifié par identité.
  brancherFrappe() {
    if (this.frappeAbonnee) return;
    const sim = (window as any).__sim,
      source =
        this.joueur.aFrappeVisuel ??
        (sim && sim.joueur === this.joueur ? sim.arme?.aFrappe : null);
    if (!source) return;
    this.frappeAbonnee = true;
    source.connecter((combo: number) => {
      this.swingCombo = combo;
      this.swingDuree = combo === 3 ? dureeTourbillon : dureeSwing;
      this.swingRestant = this.swingDuree;
    });
  }

  signalerCoup() {
    this.touche = 0.35;
    this.flashCoup = dureeFlashCoup;
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
    this.swingRestant = Math.max(0, this.swingRestant - dt);
    this.ecrasement = Math.max(0, this.ecrasement - dt);
    this.etirement = Math.max(0, this.etirement - dt);
    this.fenetreFantomes = Math.max(0, this.fenetreFantomes - dt);
    this.glisse = Math.max(0, this.glisse - dt);
    const vx = corps.vx;
    if (
      corps.auSol &&
      Math.abs(this.vxPrecedent) > 90 &&
      Math.abs(vx) > 20 &&
      Math.sign(vx) !== Math.sign(this.vxPrecedent)
    ) {
      this.glisse = dureeGlisse;
      this.aGlisse.emettre(-j.face);
    }
    this.vxPrecedent = vx;
    this.brancherFrappe();
    const enTir = this.tirRecent > 0 || intention.tir;
    this.accroupiDepuis = j.accroupi ? this.accroupiDepuis + dt : 0;
    this.depuisTir += dt;
    const indiceTir = this.depuisTir < fenetreRecul ? 3 : this.depuisTir < fenetrePose ? 4 : 2;
    if (this.touche > 0) this.jouer("touche", "dash_degats", 10, [2, 3]);
    else if (this.swingRestant > 0) {
      // WHY: override par une frame d'armes existante sous le nom d'anim standard,
      // pour que la branche normale reprenne proprement la main après le swing.
      if (corps.auSol && Math.abs(corps.vx) > 20 && this.animations.course_tir)
        this.jouer("course_tir", "course_tir", 14);
      else if (this.animations.tir_debout) this.image("tir_debout", "tir_debout", 3);
      else this.image("tir", "tir", 3);
    } else if (j.etat === EtatJoueur.DASH) this.jouer("dash", "dash_degats", 14, [0, 1]);
    else if (enTir) this.poseDeTir(indiceTir);
    else if (j.accroupi && this.animations.accroupi) {
      if (this.accroupiDepuis < 0.08) this.image("accroupi_descente", "accroupi_descente", 0);
      else this.jouer("accroupi", "accroupi", 5);
    } else if (j.planant || j.volLibre) {
      this.jouer("vol", "vol", 12);
      this.sprite.animationSpeed = (corps.vy < -40 ? 19 : 12) / 60;
    } else if (corps.auSol) {
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
    // WHY: poses 100 % additives recalculées chaque frame — aucun état à restaurer,
    // les anims par frames et les ancres existantes restent intactes.
    let poseX = 1,
      poseY = 1,
      poseRot = 0;
    if (this.swingRestant > 0) {
      const p = 1 - this.swingRestant / this.swingDuree,
        reste = 1 - p;
      poseRot =
        this.swingCombo === 3 ? j.face * Math.PI * 2 * p : j.face * 0.35 * Math.sin(Math.PI * p);
      poseX *= 1 + 0.1 * reste * reste;
      poseY *= 1 - 0.1 * reste * reste;
    }
    if (this.ecrasement > 0) {
      const r = this.ecrasement / dureeEcrasement;
      poseX *= 1 + 0.25 * r * r;
      poseY *= 1 - 0.25 * r * r;
    }
    if (this.etirement > 0) {
      const r = this.etirement / dureeEtirement;
      poseX *= 1 - 0.2 * r * r;
      poseY *= 1 + 0.2 * r * r;
    }
    // WHY: inclinaison additive vers l'avant en course, contre-penchant au
    // demi-tour (glisse), étirement horizontal en dash, assiette en vol.
    if (this.anim === "course" || this.anim === "course_tir")
      poseRot += j.face * 0.05 * Math.min(1, Math.abs(vx) / j.reglages.vitesseCourse);
    if (this.glisse > 0) {
      const r = this.glisse / dureeGlisse;
      poseRot -= j.face * 0.14 * r;
      poseX *= 1 + 0.06 * r;
      poseY *= 1 - 0.06 * r;
    }
    if (j.etat === EtatJoueur.DASH) {
      poseX *= 1.12;
      poseY *= 0.94;
    }
    if (this.anim === "vol") poseRot += Math.max(-0.16, Math.min(0.16, corps.vy / 900));
    this.sprite.scale.x = echelle * j.face * poseX;
    this.sprite.scale.y = echelle * poseY;
    this.sprite.rotation += poseRot;
    // WHY: compense le squash via l'ancre de la frame pour garder les pieds au sol.
    if (poseY !== 1) {
      const tex: any = this.sprite.texture;
      this.sprite.y += (1 - poseY) * (1 - this.sprite.anchor.y) * (tex?.height ?? 0) * echelle;
    }
    const douille = animTir && this.depuisTir < 0.08 ? this.douilleEcran() : null;
    this.eclair.visible = !!douille;
    if (douille) {
      const reste = 1 - this.depuisTir / 0.08;
      this.eclair.position.set(douille.x - this.x, douille.y - this.y);
      this.eclair.scale.set(0.9 + 0.8 * reste);
      this.eclair.alpha = reste * (flashesActifs() ? 1 : 0.5);
    }
    this.alpha =
      j.invulnerable > 0 && j.etat !== EtatJoueur.DASH && Math.floor(j.invulnerable * 20) % 2 == 0
        ? 0.45
        : 1;
    // Flash blanc court à l'impact : recalé sur la pose finale du sprite (recul,
    // squash, ancre de frame inclus). Zéro allocation : un seul sprite réutilisé.
    this.flashCoup = Math.max(0, this.flashCoup - dt);
    const flashActif = this.flashCoup > 0 && flashesActifs();
    this.flashSprite.visible = flashActif;
    if (flashActif) {
      const f = this.flashSprite;
      f.texture = this.sprite.texture;
      f.anchor.copyFrom(this.sprite.anchor);
      f.scale.copyFrom(this.sprite.scale);
      f.rotation = this.sprite.rotation;
      f.position.set(this.sprite.x, this.sprite.y);
      f.alpha = 0.9 * (this.flashCoup / dureeFlashCoup);
    }
    this.majFantomes(dt);
  }

  majFantomes(dt: number) {
    // WHY: les fantômes doivent rester en place dans le monde pendant que le joueur avance ;
    // conteneur dédié inséré sous le joueur dans le même parent (z-order inférieur).
    if (this.parent && this.fantomes.parent !== this.parent)
      this.parent.addChildAt(this.fantomes, this.parent.getChildIndex(this));
    const enDash = this.joueur.etat === EtatJoueur.DASH || this.fenetreFantomes > 0;
    this.ticFantome -= dt;
    if (enDash && this.ticFantome <= 0) {
      this.ticFantome = intervalleFantomes;
      // Anneau sur le pool : le plus vieux fantôme est réécrit, jamais détruit.
      const fantome = this.poolFantomes[this.indiceFantome] as any;
      this.indiceFantome = (this.indiceFantome + 1) % this.poolFantomes.length;
      fantome.texture = this.sprite.texture;
      fantome.anchor.copyFrom(this.sprite.anchor);
      fantome.scale.copyFrom(this.sprite.scale);
      fantome.rotation = this.sprite.rotation;
      fantome.position.set(this.x + this.sprite.x, this.y + this.sprite.y);
      fantome.alpha = 0.35;
      fantome.visible = true;
      fantome.ageFantome = 0;
    }
    for (let i = 0; i < this.poolFantomes.length; i++) {
      const fantome = this.poolFantomes[i] as any;
      if (!fantome.visible) continue;
      fantome.ageFantome += dt;
      fantome.alpha = Math.max(0, 0.35 * (1 - fantome.ageFantome / dureeFantome));
      if (fantome.ageFantome >= dureeFantome) fantome.visible = false;
    }
  }

  destroy(options?: any) {
    // WHY: le conteneur de fantômes est un frère, pas un enfant — nettoyage explicite.
    if (!this.fantomes.destroyed) this.fantomes.destroy({ children: true });
    super.destroy(options);
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