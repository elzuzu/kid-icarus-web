import { Assets, Container, Graphics, Sprite, TextStyle } from "pixi.js";
import type { Texture } from "pixi.js";
import { n as largeurEcran, t as hauteurEcran } from "../../core";
import { o as Texte } from "../../render/textures";
import {
  a as panneau,
  n as OR,
  o as styleTexte,
  s as styleTitre,
  t as Bouton,
} from "../../render/theme";
import { t as Menu } from "../../ui/menu";
import { PanneauOptions } from "../../ui/options";
import { base } from "./base";

const largeurBarre = 700,
  hauteurJauge = 18,
  yJauge = 62;

export class BarreBoss extends Container {
  cadre = new Graphics();
  jauge = new Graphics();
  nom: Texte;
  ratio = 1;
  traine = 1;
  seuils: number[] = [];
  apparition = 0;
  t = 0;

  constructor() {
    super();
    this.nom = new Texte({
      text: "",
      style: new TextStyle({
        fontFamily: `"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif`,
        fontSize: 30,
        fill: 15983280,
        letterSpacing: 4,
        fontWeight: "600",
        stroke: { color: 1707782, width: 4 },
        dropShadow: {
          color: 0,
          alpha: 0.8,
          blur: 4,
          distance: 2,
          angle: Math.PI / 2,
        },
      }),
    });
    this.nom.anchor.set(0.5, 1);
    this.nom.position.set(largeurEcran / 2, 54);
    this.addChild(this.cadre, this.jauge, this.nom);
    this.visible = false;
  }

  montrer(nom: string, seuils: number[]) {
    this.nom.text = nom.toUpperCase();
    this.seuils = seuils;
    this.ratio = this.traine = 1;
    this.apparition = 0;
    this.t = 0;
    this.visible = true;
    this.dessinerCadre();
  }

  masquer() {
    this.visible = false;
  }

  dessinerCadre() {
    const g = this.cadre,
      x = largeurEcran / 2 - largeurBarre / 2;
    g.clear();
    g.roundRect(x - 6, 56, 712, 30, 4).fill({ color: 788232, alpha: 0.88 });
    g.roundRect(x - 6, 56, 712, 30, 4).stroke({ color: 13214810, width: 2.5 });
    g.roundRect(x - 2, 60, 704, 22, 2).stroke({ color: 6178080, width: 1.2 });
    for (const sens of [-1, 1]) {
      const cx = largeurEcran / 2 + sens * 370;
      g.poly([cx - 14, 71, cx, 59, cx + 14, 71, cx, 83])
        .fill(9071150)
        .stroke({ color: 15255672, width: 2 });
      g.circle(cx, 71, 3.5).fill(16773312);
      g.moveTo(cx - sens * 14, 71)
        .lineTo(cx - sens * 34, 71)
        .stroke({ color: 13214810, width: 2 });
    }
    for (const seuil of this.seuils) {
      const sx = x + largeurBarre * seuil;
      g.moveTo(sx, 58).lineTo(sx, 84).stroke({ color: 15255672, width: 2, alpha: 0.9 });
    }
  }

  afficher(dt: number, pv: number, pvMax: number) {
    if (!this.visible) return;
    this.t += dt;
    this.apparition = Math.min(1, this.apparition + dt * 1.5);
    this.alpha = this.apparition;
    this.ratio = Math.max(0, Math.min(1, pv / Math.max(1, pvMax)));
    this.traine =
      this.traine > this.ratio
        ? Math.max(this.ratio, this.traine - dt * 0.35)
        : this.ratio;
    const g = this.jauge,
      x = largeurEcran / 2 - largeurBarre / 2;
    g.clear();
    // Basse vie : la jauge vire au rouge vif et pouls — lisibilité de l'urgence sans
    // toucher à la géométrie (zéro overlap avec le HUD joueur, grappes gauche/droite).
    const bas = this.ratio > 0 && this.ratio <= 0.3;
    const pouls = bas ? 0.5 + 0.5 * Math.sin(this.t * 5) : 0;
    const k = bas ? 0.35 + 0.45 * pouls : 0;
    const couleur = melangeCouleur(11735580, 0xff3820, k);
    const largeur = largeurBarre * Math.min(this.ratio, this.apparition);
    g.rect(x, yJauge, largeurBarre * this.traine * this.apparition, hauteurJauge).fill({
      color: 16765088,
      alpha: 0.55,
    });
    g.rect(x, yJauge, largeur, hauteurJauge).fill(couleur);
    g.rect(x, yJauge, largeur, hauteurJauge * 0.4).fill({
      color: 16738906,
      alpha: 0.55 + (bas ? 0.2 * pouls : 0),
    });
    g.rect(x, 77, largeur, 3).fill({ color: 5899528, alpha: 0.8 });
    // Jalons de phase : losange or tant que le palier n'est pas franchi, bronze éteint
    // ensuite — les seuils viennent de boss.seuils (phases réelles, pas décoratives).
    // Sous le cadre (y 88-98) : le nom du boss occupe le dessus, zéro collision.
    for (const seuil of this.seuils) {
      const sx = x + largeurBarre * seuil;
      const actif = this.ratio > seuil;
      g.poly([sx - 5, 93, sx, 87, sx + 5, 93, sx, 99])
        .fill(actif ? 16773312 : 4865066)
        .stroke({ color: actif ? 15255672 : 9071150, width: 1.5, alpha: actif ? 1 : 0.55 });
    }
  }
}

// Mélange de couleurs sans allocation (canaux entiers), pour le pouls basse vie.
function melangeCouleur(a: number, b: number, k: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * k) << 16) |
    (Math.round(ag + (bg - ag) * k) << 8) |
    Math.round(ab + (bb - ab) * k)
  );
}

const largeurSousTitre = 1100;

export class SousTitres extends Container {
  fond = new Graphics();
  portrait = new Sprite();
  portraits = new Map<string, Texture>();
  nom: Texte;
  texte: Texte;
  courant: string | null = null;
  opacite = 0;

  constructor(audio: any) {
    super();
    this.nom = new Texte({ text: "", style: styleTitre(26, OR) });
    const styleReplique = styleTexte(28);
    styleReplique.wordWrap = true;
    styleReplique.wordWrapWidth = largeurSousTitre;
    styleReplique.align = "center";
    styleReplique.lineHeight = 36;
    this.texte = new Texte({ text: "", style: styleReplique });
    this.nom.anchor.set(0.5, 1);
    this.texte.anchor.set(0.5, 0);
    this.portrait.anchor.set(0, 0.5);
    this.portrait.visible = false;
    this.addChild(this.fond, this.portrait, this.nom, this.texte);
    this.alpha = 0;
    // Portrait optionnel : seul Pit en possède un dans les assets ; absence = panneau seul, sans erreur.
    Assets.load(`${base}assets/art/pit/pit_profil.webp`)
      .then((texture: Texture) => this.portraits.set("pit", texture))
      .catch(() => void 0);
    audio.sousTitre.connecter((ligne: any) => this.montrer(ligne));
    audio.sousTitreFini.connecter((id: string) => {
      if (id === this.courant) this.courant = null;
    });
  }

  montrer(ligne: any) {
    this.courant = ligne.id;
    this.nom.text = ligne.nom;
    this.texte.text = ligne.texte;
    const y = hauteurEcran - 128;
    const hauteur = this.texte.height + this.nom.height + 36;
    const texturePortrait = this.portraits.get(ligne.perso) ?? null;
    this.portrait.visible = texturePortrait !== null;
    let margePortrait = 0;
    if (texturePortrait) {
      this.portrait.texture = texturePortrait;
      this.portrait.height = Math.min(150, hauteur - 22);
      this.portrait.scale.x = this.portrait.scale.y;
      margePortrait = this.portrait.width + 26;
    }
    const largeur = Math.max(this.texte.width, this.nom.width) + margePortrait + 80;
    const x = largeurEcran / 2 - largeur / 2;
    const yHaut = y - this.nom.height - 14;
    this.fond.clear();
    // Panneau antique (parchemin sombre semi-opaque, bord bronze/or) à la place du rectangle noir plat.
    panneau(this.fond, x, yHaut, largeur, hauteur, 0.82);
    // Le texte reste centré dans la zone hors portrait : même largeur de wrap, donc même mise en page.
    const centreTexte = largeurEcran / 2 + margePortrait / 2;
    this.nom.position.set(centreTexte, y);
    this.texte.position.set(centreTexte, y + 6);
    if (texturePortrait) this.portrait.position.set(x + 24, yHaut + hauteur / 2);
  }

  get affiche(): boolean {
    return this.opacite > 0.05;
  }

  mettreAJour(dt: number) {
    const cible = +!!this.courant;
    this.opacite +=
      Math.sign(cible - this.opacite) * Math.min(Math.abs(cible - this.opacite), dt * 5);
    this.alpha = this.opacite;
  }
}

export class Annonces extends Container {
  fond = new Graphics();
  texte = new Texte({ text: "", style: styleTitre(34, 16770984) });
  invite = new Texte({ text: "", style: styleTexte(24, 16773836) });
  fondInvite = new Graphics();
  yInvite = hauteurEcran - 90;
  file: { t: string; d: number }[] = [];
  reste = 0;

  constructor() {
    super();
    // Ombre portée coupée : sur le bandeau semi-opaque posé sur le ciel clair,
    // le dropShadow de styleTitre se rend en bandes noires au-dessus des glyphes.
    this.texte.style.dropShadow = false;
    this.texte.anchor.set(0.5);
    this.texte.position.set(largeurEcran / 2, 300);
    this.invite.anchor.set(0.5);
    this.invite.position.set(largeurEcran / 2, hauteurEcran - 90);
    this.addChild(this.fond, this.texte, this.fondInvite, this.invite);
  }

  annoncer(texte: string, duree = 2.2) {
    this.file.push({ t: texte, d: duree });
  }

  montrerInvite(texte: string, sousTitres = false) {
    if (this.invite.text !== texte) this.invite.text = texte;
    this.invite.visible = this.fondInvite.visible = texte !== "";
    this.yInvite = sousTitres ? hauteurEcran - 240 : hauteurEcran - 90;
    if (!this.invite.visible) return;
    this.invite.y += (this.yInvite - this.invite.y) * 0.25;
    const largeur = this.invite.width + 48;
    this.fondInvite.clear();
    this.fondInvite
      .roundRect(largeurEcran / 2 - largeur / 2, this.invite.y - 20, largeur, 40, 20)
      .fill({ color: 460298, alpha: 0.55 });
  }

  mettreAJour(dt: number) {
    this.reste -= dt;
    if (this.reste <= 0 && this.file.length) {
      const annonce = this.file.shift()!;
      this.texte.text = annonce.t;
      this.reste = annonce.d;
      const largeur = this.texte.width + 120;
      this.fond.clear();
      this.fond
        .rect(largeurEcran / 2 - largeur / 2, 272, largeur, 56)
        .fill({ color: 460298, alpha: 0.6 });
      this.fond
        .rect(largeurEcran / 2 - largeur / 2, 272, largeur, 2)
        .fill({ color: 15255672, alpha: 0.9 });
      this.fond
        .rect(largeurEcran / 2 - largeur / 2, 326, largeur, 2)
        .fill({ color: 15255672, alpha: 0.9 });
    }
    const alpha = this.reste > 0 ? Math.min(1, this.reste * 3, 1) : 0;
    this.texte.alpha = this.fond.alpha = alpha;
  }
}

export class MenuPause extends Container {
  menu: Menu;
  panneauOptions: PanneauOptions;
  titre: Texte;
  aidePause: Texte;
  aideOptions: Texte;
  ouvert = false;

  constructor(reprendre: () => void, abandonner: () => void, audio: any = null) {
    super();
    const son = (id: string) => audio?.sfx(id);
    const voile = new Graphics().rect(0, 0, largeurEcran, hauteurEcran).fill({ color: 0x050308, alpha: 0.62 }),
      boite = panneau(new Graphics(), largeurEcran / 2 - 420, 145, 840, 790, 0.94);
    voile.eventMode = "static";
    this.titre = new Texte({ text: "PAUSE", style: styleTitre(54) });
    this.titre.anchor.set(0.5);
    this.titre.position.set(largeurEcran / 2, 218);
    const boutonReprendre = new Bouton("Reprendre", 500, 64, () => {
        son("menu_valider");
        this.fermer();
        reprendre();
      }),
      boutonOptions = new Bouton("Options", 500, 64, () => {
        son("menu_ouvrir");
        this.ouvrirOptions();
      }),
      boutonAbandonner = new Bouton("Abandonner le stage", 500, 64, () => {
        son("menu_retour");
        this.fermer();
        abandonner();
      });
    [boutonReprendre, boutonOptions, boutonAbandonner].forEach((bouton, i) =>
      bouton.position.set(largeurEcran / 2 - 250, 330 + i * 92),
    );
    this.menu = new Menu([boutonReprendre, boutonOptions, boutonAbandonner]);
    this.menu.retour = () => {
      son("menu_retour");
      this.fermer();
      reprendre();
    };
    this.menu.surNavigation = () => son("menu_deplacer");
    this.panneauOptions = new PanneauOptions({
      retour: () => this.fermerOptions(),
      audio,
      largeur: 740,
    });
    this.panneauOptions.position.set(largeurEcran / 2 - 370, 272);
    this.panneauOptions.visible = false;
    this.aidePause = new Texte({
      text: "↑ ↓ choisir   ·   Entrée / Espace valider   ·   Échap reprendre",
      style: styleTexte(20, 14208184),
    });
    this.aideOptions = new Texte({
      text: "↑ ↓ choisir   ·   ← → régler   ·   Échap retour",
      style: styleTexte(20, 14208184),
    });
    for (const aide of [this.aidePause, this.aideOptions]) {
      aide.anchor.set(0.5);
      aide.position.set(largeurEcran / 2, 888);
      aide.alpha = 0.85;
    }
    this.aideOptions.visible = false;
    this.addChild(voile, boite, this.titre, this.menu, this.panneauOptions, this.aidePause, this.aideOptions);
    this.visible = false;
  }

  ouvrirOptions() {
    this.panneauOptions.rafraichir();
    this.menu.visible = false;
    this.panneauOptions.visible = true;
    this.titre.text = "OPTIONS";
    this.aidePause.visible = false;
    this.aideOptions.visible = true;
    this.panneauOptions.menu.selectionner(0);
  }

  fermerOptions() {
    this.panneauOptions.visible = false;
    this.menu.visible = true;
    this.titre.text = "PAUSE";
    this.aidePause.visible = true;
    this.aideOptions.visible = false;
    // On rend la main sur l'entrée « Options » pour un aller-retour naturel.
    this.menu.selectionner(1);
  }

  ouvrir() {
    this.ouvert = true;
    this.visible = true;
    this.panneauOptions.visible = false;
    this.menu.visible = true;
    this.titre.text = "PAUSE";
    this.aidePause.visible = true;
    this.aideOptions.visible = false;
    this.menu.selectionner(0);
  }

  fermer() {
    this.ouvert = false;
    this.visible = false;
  }

  pas(dt: number, intention: any) {
    if (!this.ouvert) return;
    // Échap ferme d'abord les Options (retour du sous-menu), puis la pause.
    if (this.panneauOptions.visible) this.panneauOptions.menu.pas(dt, intention);
    else this.menu.pas(dt, intention);
  }
}