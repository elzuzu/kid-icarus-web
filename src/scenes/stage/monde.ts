import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";
import { n as largeurEcran, t as hauteurEcran, r as Flux } from "../../core";
import { s as SpriteTuile } from "../../ui/hud";
import { n as textureHalo, r as textureVignette, t as textureDegrade, g as textureGrain, e as textureEclair } from "../../render/textures";
import { c as ParticulesAmbiance } from "../../render/theme";
import { gradeDe, techart, bruit1, flashesActifs } from "../../render/ambiance";
import { base } from "./base";

const baseDecors = `${base}assets/art/decors/`;

const ambiances: Record<string, any> = {
  profondeurs: {
    teinteMilieu: 9273240,
    voile: ["rgba(34,24,44,0.25)", "rgba(70,30,30,0.35)"],
    particules: "braises",
    nombre: 90,
    halo: 16747056,
  },
  fosses: {
    teinteMilieu: 10518640,
    voile: ["rgba(60,20,10,0.2)", "rgba(120,40,10,0.35)"],
    particules: "braises",
    nombre: 120,
    halo: 16740384,
  },
  puits: {
    teinteMilieu: 8024208,
    voile: ["rgba(20,16,40,0.35)", "rgba(40,20,60,0.45)"],
    particules: "spores",
    nombre: 70,
    halo: 10514687,
  },
  forteresse: {
    teinteMilieu: 9075346,
    voile: ["rgba(24,16,36,0.3)", "rgba(40,18,40,0.4)"],
    particules: "poussiere",
    nombre: 60,
    halo: 11567359,
  },
  arcadie: {
    teinteMilieu: 14998736,
    voile: ["rgba(255,244,220,0.0)", "rgba(255,230,190,0.18)"],
    particules: "petales",
    nombre: 40,
    halo: 16760928,
  },
  col_gele: {
    teinteMilieu: 13162732,
    voile: ["rgba(220,236,255,0.05)", "rgba(170,200,240,0.25)"],
    particules: "neige",
    nombre: 120,
    halo: 8440063,
  },
  crepuscule: {
    teinteMilieu: 12098208,
    voile: ["rgba(60,30,60,0.15)", "rgba(120,60,40,0.3)"],
    particules: "cendres",
    nombre: 90,
    halo: 16748608,
  },
  forteresse_surface: {
    teinteMilieu: 10133674,
    voile: ["rgba(30,34,44,0.25)", "rgba(50,40,40,0.35)"],
    particules: "pluie",
    nombre: 70,
    halo: 16752720,
  },
  mer_nuages: {
    teinteMilieu: 15265526,
    voile: ["rgba(255,255,255,0.0)", "rgba(210,230,255,0.2)"],
    particules: "lumieres",
    nombre: 50,
    halo: 16765040,
  },
  tempete: {
    teinteMilieu: 10134720,
    voile: ["rgba(30,34,60,0.2)", "rgba(50,50,90,0.35)"],
    particules: "pluie",
    nombre: 120,
    halo: 10139903,
  },
  temple_vents: {
    teinteMilieu: 14733496,
    voile: ["rgba(255,230,190,0.0)", "rgba(255,200,150,0.2)"],
    particules: "lumieres",
    nombre: 60,
    halo: 16765056,
  },
  forteresse_celeste: {
    teinteMilieu: 15656140,
    voile: ["rgba(255,250,235,0.0)", "rgba(255,230,180,0.18)"],
    particules: "lumieres",
    nombre: 70,
    halo: 16769168,
  },
  vol_celeste: {
    teinteMilieu: 15659770,
    voile: ["rgba(255,255,255,0.0)", "rgba(220,235,255,0.2)"],
    particules: "lumieres",
    nombre: 50,
    halo: 16769168,
  },
  palais: {
    teinteMilieu: 15391936,
    voile: ["rgba(255,245,220,0.0)", "rgba(230,200,150,0.2)"],
    particules: "lumieres",
    nombre: 70,
    halo: 16765040,
  },
};

export async function chargerDecor(nom: string): Promise<any> {
  const kit = ambiances[nom] ? nom : "profondeurs",
    charger = (fichier: string) => Assets.load(`${baseDecors}${kit}/${fichier}.webp`),
    optionnel = (fichier: string) => charger(fichier).catch(() => null);
  try {
    const [lointain, milieu, bloc, bordHaut, plateformeGauche, plateformeMilieu, plateformeDroite, cadre, avantPlan, accessoire] =
      await Promise.all([
        charger("fond_lointain"),
        charger("fond_milieu"),
        charger("bloc"),
        charger("bord_haut"),
        charger("plateforme_gauche"),
        charger("plateforme_milieu"),
        charger("plateforme_droite"),
        optionnel("cadre_colonne"),
        optionnel("avant_plan"),
        optionnel("accessoire"),
      ]);
    return {
      ambiance: kit,
      reglage: ambiances[kit],
      lointain,
      milieu,
      cadre,
      avantPlan,
      accessoire,
      tuiles: {
        bloc,
        blocEchelle: 0.5,
        bordHaut,
        bordHautHauteur: 64,
        bordHautSurface: 0.3,
        plateformeGauche,
        plateformeMilieu,
        plateformeDroite,
        plateformeHauteur: 92,
        plateformeSurface: 0.16,
        ombre: 328458,
      },
    };
  } catch (e) {
    if (kit === "profondeurs") throw e;
    console.warn(`Décor « ${kit} » incomplet, repli sur les Profondeurs`, e);
    return chargerDecor("profondeurs");
  }
}

export class Monde {
  kit: any;
  ascension: boolean;
  arriere = new Container();
  avant = new Container();
  fond: Sprite;
  plan: SpriteTuile;
  avantPlan: SpriteTuile | null = null;
  particules: ParticulesAmbiance;
  tempsFond = 0;
  // Halos de torche poolés : créés une fois par stage, flicker bruité par frame.
  halos: { s: Sprite; base: number; echelle: number; phase: number }[] = [];
  // Orage lointain : un sprite éclair + un voile de flash, tous deux réutilisés.
  eclair: Sprite | null = null;
  eclairFlash: Sprite | null = null;
  eclairVie = -1;
  prochainEclair = 6;
  fluxOrage: Flux;

  constructor(kit: any, largeurJeu: number, ascension: boolean) {
    this.kit = kit;
    this.ascension = ascension;
    this.fluxOrage = new Flux(`decor|orage|${kit.ambiance}`);
    this.prochainEclair = this.fluxOrage.randfRange(3, 8);
    const grade = gradeDe(String(kit.ambiance));
    // Grade 1/3 : teinte multiplicative de tout l'arrière-plan (zéro filtre).
    this.arriere.tint = grade.teinte;
    this.fond = new Sprite(kit.lointain);
    this.fond.scale.set(
      Math.max(largeurEcran / kit.lointain.width, hauteurEcran / kit.lointain.height) * 1.15,
    );
    this.fond.anchor.set(0.5);
    this.fond.position.set(largeurEcran / 2, hauteurEcran / 2);
    this.arriere.addChild(this.fond);
    const hauteurPlan = hauteurEcran * 0.78;
    this.plan = new SpriteTuile({ texture: kit.milieu, width: largeurEcran, height: hauteurEcran });
    this.plan.tileScale.set(hauteurPlan / kit.milieu.height);
    this.plan.tint = kit.reglage.teinteMilieu;
    this.plan.alpha = 0.9;
    this.arriere.addChild(this.plan);
    const voile = new Sprite(textureDegrade(kit.reglage.voile[0], kit.reglage.voile[1], 256));
    voile.width = largeurEcran;
    voile.height = hauteurEcran;
    this.arriere.addChild(voile);
    if (grade.orage) {
      // Éclairs lointains : derrière le gameplay, texture pré-générée, alpha piloté.
      this.eclairFlash = new Sprite(textureDegrade("rgba(200,215,255,0.5)", "rgba(200,215,255,0)", 256));
      this.eclairFlash.width = largeurEcran;
      this.eclairFlash.height = hauteurEcran;
      this.eclairFlash.blendMode = "add";
      this.eclairFlash.alpha = 0;
      this.eclair = new Sprite(textureEclair());
      this.eclair.anchor.set(0.5, 0);
      this.eclair.blendMode = "add";
      this.eclair.alpha = 0;
      this.arriere.addChild(this.eclairFlash, this.eclair);
    }
    const marge = (largeurEcran - largeurJeu) / 2;
    if (kit.cadre && ascension && marge > 40)
      for (const sens of [-1, 1]) {
        const colonne = new Sprite(kit.cadre);
        colonne.anchor.set(0, 1);
        colonne.height = hauteurEcran * 1.12;
        colonne.scale.x = colonne.scale.y * sens;
        colonne.position.set(sens < 0 ? marge + 4 : largeurEcran - marge - 4, hauteurEcran + 30);
        colonne.tint = 12101808;
        this.avant.addChild(colonne);
      }
    if (kit.avantPlan) {
      const texture = kit.avantPlan;
      if (ascension) {
        const rideau = new Sprite(
          new Texture({
            source: texture.source,
            frame: new Rectangle(0, 0, texture.width, Math.round(texture.height * 0.42)),
          }),
        );
        rideau.width = largeurEcran * 1.02;
        rideau.scale.y = rideau.scale.x;
        rideau.position.set(-20, -30);
        rideau.tint = 5917784;
        const masque = new Sprite(
          textureDegrade("rgba(255,255,255,1)", "rgba(255,255,255,0)", 256, 0.5),
        );
        masque.position.set(rideau.x, rideau.y);
        masque.width = rideau.width;
        masque.height = rideau.height;
        this.avant.addChild(rideau, masque);
        rideau.mask = masque;
      } else {
        const hauteur = hauteurEcran * 0.34;
        this.avantPlan = new SpriteTuile({ texture, width: largeurEcran, height: hauteur });
        this.avantPlan.tileScale.set(hauteur / texture.height);
        this.avantPlan.y = hauteurEcran - hauteur + 30;
        this.avantPlan.tint = 6971496;
        this.avant.addChild(this.avantPlan);
      }
    }
    // Grade 2/3 : voile coloré au-dessus du gameplay (normal, alpha baked) +
    // lueur additive directionnelle. Deux quads plein écran, aucun filtre par frame.
    const voileGrade = new Sprite(textureDegrade(grade.voile[0], grade.voile[1], 256));
    voileGrade.width = largeurEcran;
    voileGrade.height = hauteurEcran;
    this.avant.addChild(voileGrade);
    if (grade.lueur) {
      const lueur = new Sprite(textureDegrade(grade.lueur[0], grade.lueur[1], 256));
      lueur.width = largeurEcran;
      lueur.height = hauteurEcran;
      lueur.blendMode = "add";
      this.avant.addChild(lueur);
    }
    this.particules = new ParticulesAmbiance(
      textureHalo(32),
      kit.reglage.particules,
      largeurEcran,
      hauteurEcran,
      kit.reglage.nombre,
    );
    this.avant.addChild(this.particules);
    const vignette = new Sprite(textureVignette(0.6));
    vignette.width = largeurEcran;
    vignette.height = hauteurEcran;
    this.avant.addChild(vignette);
    // Grain filmique statique : texture pré-générée, tuilée, jamais recalculée.
    const grain = new SpriteTuile({ texture: textureGrain(256), width: largeurEcran, height: hauteurEcran });
    grain.alpha = 0.55;
    this.avant.addChild(grain);
    techart.monde = this;
  }

  compterAmbiance(): number {
    return this.particules.liste.length;
  }

  mettreAJour(dt: number, x: number, y: number) {
    this.particules.mettreAJour(dt);
    // Parallaxe d'ambiance bornée : le champ dérive contre la caméra sans exposer
    // ses bords (marges de spawn ±100 px, cull ±150 px).
    this.particules.position.x = Math.max(-48, Math.min(48, -x * 0.05));
    this.particules.position.y = Math.max(-36, Math.min(36, -y * 0.035));
    // Dérive lente additive réservée au fond lointain : périodes 24 s / 31 s sans multiple
    // commun court, la boucle combinée (~12 min) est imperceptible ; le scale 1.15 absorbe les ±6 px.
    this.tempsFond += dt;
    const deriveX = Math.sin((this.tempsFond * Math.PI * 2) / 24) * 6;
    const deriveY = Math.sin((this.tempsFond * Math.PI * 2) / 31) * 4;
    if (this.ascension) {
      this.fond.x = largeurEcran / 2 + deriveX;
      this.fond.y = hauteurEcran / 2 + Math.max(-120, Math.min(120, -y * 0.01)) + deriveY;
      this.plan.tilePosition.y = -y * 0.3 + hauteurEcran * 0.22;
    } else {
      this.fond.x = largeurEcran / 2 + Math.max(-140, Math.min(140, -x * 0.02)) + deriveX;
      this.fond.y = hauteurEcran / 2 + deriveY;
      this.plan.tilePosition.x = -x * 0.3;
      this.plan.tilePosition.y = hauteurEcran * 0.22 - y * 0.1;
      if (this.avantPlan) this.avantPlan.tilePosition.x = -x * 1.35;
    }
    // Flicker bruité des halos de torche (pool fixe, aucune allocation).
    const amp = flashesActifs() ? 0.24 : 0.1;
    for (let i = 0; i < this.halos.length; i++) {
      const h = this.halos[i];
      const n = bruit1(this.tempsFond * 1.6 + h.phase);
      h.s.alpha = h.base * (1 - amp + amp * (0.5 + 0.5 * n));
      h.s.scale.set(h.echelle * (1 + 0.05 * n));
    }
    if (this.eclair && this.eclairFlash) this.majOrage(dt);
  }

  majOrage(dt: number) {
    const eclair = this.eclair!, flash = this.eclairFlash!;
    if (this.eclairVie >= 0) {
      this.eclairVie += dt;
      const t = this.eclairVie;
      // Double strobe : pic franc, creux, réplique, extinction douce (0.45 s).
      const pic = t < 0.07 ? 1 : t < 0.14 ? 0.25 : t < 0.22 ? 0.8 : Math.max(0, 1 - (t - 0.22) / 0.23);
      const intensite = flashesActifs() ? 1 : 0.35;
      eclair.alpha = pic * 0.9 * intensite;
      flash.alpha = pic * 0.16 * intensite;
      if (t >= 0.45) {
        this.eclairVie = -1;
        eclair.alpha = 0;
        flash.alpha = 0;
        this.prochainEclair = this.fluxOrage.randfRange(5, 13);
      }
    } else {
      this.prochainEclair -= dt;
      if (this.prochainEclair <= 0) {
        this.eclairVie = 0;
        eclair.x = this.fluxOrage.randfRange(0.12, 0.88) * largeurEcran;
        eclair.y = -10;
        const echelle = this.fluxOrage.randfRange(1.1, 1.9);
        eclair.scale.set(this.fluxOrage.randf() < 0.5 ? -echelle : echelle, echelle);
      }
    }
  }

  accessoire(conteneur: Container, x: number, y: number) {
    const texture = this.kit.accessoire;
    if (!texture) return;
    const s = new Sprite(texture);
    s.anchor.set(0.5, 1);
    s.height = 120;
    s.scale.x = s.scale.y;
    s.position.set(x, y);
    conteneur.addChild(s);
    if (!this.kit.reglage.halo) return;
    const halo = new Sprite(textureHalo(128));
    halo.anchor.set(0.5);
    halo.tint = this.kit.reglage.halo;
    halo.alpha = 0.5;
    halo.blendMode = "add";
    // Zone additive réduite + culling : le fillrate des halos est le seul
    // coût mesurable du grade (8 torches ≈ 3,6 fps à 410 px, ≈ 1 fps à 269 px).
    halo.cullable = true;
    halo.scale.set(2.1);
    halo.position.set(x, y - 95);
    conteneur.addChild(halo);
    // Pool de flicker : phase déterministe (angle d'or), aucun état par frame.
    this.halos.push({ s: halo, base: 0.55, echelle: 2.1, phase: this.halos.length * 2.399 });
  }
}