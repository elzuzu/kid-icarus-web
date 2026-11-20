import { Container, Graphics } from "pixi.js";
import { c as SpriteAnime } from "../../ui/hud";

const dureeFlash = 0.12;

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
    this.sprite.scale.x = this.echelle * (e.face >= 0 ? 1 : -1) * this.facePeinte;
    this.position.set(x * 4, (y - (this.auxPieds ? 0 : e.taille.y / 2)) * 4);
    this.sprite.tint = this.flash > 0 ? 16771288 : 16777215;
    this.alpha = e.etatVisuel === "mort" ? Math.max(0, 1 - e.mortDepuis / 0.7) : 1 - e.fondu;
    const c = e.combattant;
    this.barre.clear();
    if (c.vivant && c.pv < c.pvMax && !this.sansBarre) {
      const haut = -(this.auxPieds ? e.taille.y : e.taille.y / 2) * 4 - 22;
      this.barre.rect(-29, haut - 1, 58, 9).fill({ color: 722440, alpha: 0.85 });
      this.barre.rect(-28, haut, 56 * (c.pv / c.pvMax), 7).fill(14164010);
      this.barre.rect(-28, haut, 56 * (c.pv / c.pvMax), 2).fill({ color: 16744576, alpha: 0.6 });
    }
  }
}