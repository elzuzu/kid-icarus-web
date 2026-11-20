import { Assets, Container, Sprite } from "pixi.js";
import { a as Tuile, n as renduTuiles } from "../../ui/hud";
import { n as textureHalo, o as Texte } from "../../render/textures";
import { o as styleTexte } from "../../render/theme";
import { base } from "./base";
import { dureeChargeFriable } from "./elements";

const baseObjets = `${base}assets/art/objets/`,
  texturesObjets = [
    "porte",
    "statue_palutena",
    "jarre",
    "marchand",
    "piedestal",
    "source",
    "autel",
    "coffre",
    "bloc_friable",
    "grille",
    "arme_sol",
    "plume",
  ],
  texturesHud = [
    "coeur",
    "fiole",
    "etoile",
    "aile",
    "pouvoir_soin",
    "pouvoir_super_saut",
    "pouvoir_autoguidage",
    "pouvoir_pluie_fleches",
    "pouvoir_bouclier",
    "pouvoir_vitesse",
    "pouvoir_eclair",
    "pouvoir_invisibilite",
  ];

export async function chargerTexturesObjets(): Promise<Record<string, any>> {
  const tex: Record<string, any> = {};
  await Promise.all([
    ...texturesObjets.map(async (nom) => {
      tex[nom] = await Assets.load(`${baseObjets}${nom}.webp`).catch(() => void 0);
    }),
    ...texturesHud.map(async (nom) => {
      tex[nom] = await Assets.load(`${base}assets/art/hud/${nom}.webp`).catch(() => void 0);
    }),
  ]);
  return tex;
}

function spriteAncre(texture: any, x: number, y: number, hauteur: number): Sprite | null {
  if (!texture) return null;
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 1);
  sprite.height = hauteur;
  sprite.scale.x = sprite.scale.y;
  sprite.position.set(x * 4, y * 4);
  return sprite;
}

export class VisuelObjets extends Container {
  tex: Record<string, any>;
  sim: any;
  niveau: any;
  recompenses: any;
  apparitions: any;
  kit: any;
  fixes = new Container();
  coeurs = new Map<any, Sprite>();
  armes = new Map<any, Sprite>();
  jarres = new Map<any, Sprite>();
  jarresChambre = new Map<any, Sprite>();
  statues: any[] = [];
  friables: any[] = [];
  chambre: Container | null = null;
  t = 0;

  constructor(
    tex: Record<string, any>,
    sim: any,
    niveau: any,
    recompenses: any,
    apparitions: any,
    chambres: any,
    kit: any,
  ) {
    super();
    this.tex = tex;
    this.sim = sim;
    this.niveau = niveau;
    this.recompenses = recompenses;
    this.apparitions = apparitions;
    this.kit = kit;
    this.addChild(this.fixes);
    niveau.portes.forEach((porte: any) => {
      const sprite = spriteAncre(tex.porte, (porte.pos.c + 0.5) * 16, (porte.pos.l + 1) * 16, 150);
      if (sprite) this.fixes.addChild(sprite);
    });
    niveau.checkpoints.forEach((marqueur: any, index: number) => {
      const halo = new Sprite(textureHalo(128));
      halo.anchor.set(0.5);
      halo.blendMode = "add";
      halo.tint = 16769184;
      halo.position.set((marqueur.c + 0.5) * 16 * 4, (marqueur.l - 0.6) * 16 * 4);
      halo.scale.set(2.2);
      halo.alpha = 0.2;
      const statue = spriteAncre(tex.statue_palutena, (marqueur.c + 0.5) * 16, (marqueur.l + 1) * 16, 170);
      if (statue) {
        this.fixes.addChild(halo, statue);
        this.statues.push({ s: statue, halo, i: index });
      }
    });
    for (let ligne = 0; ligne < niveau.hauteur; ligne++)
      for (let col = 0; col < niveau.largeur; col++) {
        const tuile = niveau.tuile(col, ligne);
        if (tuile === Tuile.GRILLE) {
          const sprite = spriteAncre(tex.grille, (col + 0.5) * 16, (ligne + 1) * 16, 67.2);
          if (sprite) {
            sprite.width = 64;
            this.fixes.addChild(sprite);
          }
        } else if (tuile === Tuile.FRIABLE && tex.bloc_friable) {
          const sprite = new Sprite(tex.bloc_friable);
          sprite.width = sprite.height = 64;
          sprite.position.set(col * 64, ligne * 64);
          this.fixes.addChild(sprite);
          this.friables.push({
            s: sprite,
            c: col,
            l: ligne,
            f: sim.elements.friables.find((f: any) => f.c === col && f.l === ligne),
          });
        }
      }
    chambres?.entree.connecter((chambre: any) => this.ouvrirChambre(chambre));
    chambres?.sortie.connecter(() => {
      this.jarresChambre.clear();
      if (this.chambre) {
        this.removeChild(this.chambre);
        this.chambre.destroy({ children: true });
        this.chambre = null;
      }
    });
  }

  ouvrirChambre(chambre: any) {
    const conteneur = new Container(),
      tuiles = renduTuiles(chambre.salle, this.kit, 0, chambre.salle.hauteur);
    tuiles.y = chambre.origineY * 4;
    conteneur.addChild(tuiles);
    const porte = spriteAncre(this.tex.porte, chambre.sortie.x, chambre.sortie.y, 150);
    if (porte) conteneur.addChild(porte);
    if (chambre.source && this.tex.source) {
      const source = chambre.source,
        sprite = spriteAncre(
          this.tex.source,
          source.x + source.l / 2,
          source.y + source.h,
          source.h * 4 * 2.2,
        );
      if (sprite) conteneur.addChild(sprite);
    }
    for (const pnj of chambre.pnj) {
      const sprite = spriteAncre(this.tex.marchand, pnj.x, pnj.y, 190);
      if (sprite) conteneur.addChild(sprite);
    }
    for (const entree of chambre.offres) {
      const socle = spriteAncre(
        entree.socle === "autel" ? this.tex.autel : this.tex.piedestal,
        entree.x,
        entree.y,
        entree.socle === "autel" ? 150 : 110,
      );
      if (socle) conteneur.addChild(socle);
      const type = entree.offre.type,
        texPouvoir = entree.offre.type === "pouvoir" ? this.tex[`pouvoir_${entree.offre.id}`] : undefined,
        item = spriteAncre(
          type === "eau_de_vie"
            ? this.tex.fiole
            : type === "plume"
              ? this.tex.plume
              : type === "arme"
                ? this.tex.arme_sol
                : type === "coeurs"
                  ? this.tex.coeur
                  : type === "pouvoir"
                    ? (texPouvoir ?? this.tex.etoile)
                    : type === "benediction"
                      ? (this.tex.aile ?? this.tex.etoile)
                      : this.tex.etoile,
          entree.x,
          entree.y - (entree.socle === "autel" ? 34 : 26),
          58,
        );
      if (item) {
        item.label = "offre";
        conteneur.addChild(item);
      }
      const texte = new Texte({
        text: entree.payant ? `${entree.offre.nom}\n♥ ${entree.offre.prix}` : entree.offre.nom,
        style: styleTexte(18, 16773836),
      });
      texte.style.align = "center";
      texte.anchor.set(0.5, 1);
      texte.position.set(entree.x * 4, (entree.y - 50) * 4);
      conteneur.addChild(texte);
      (texte as any).__offre = entree;
      if (item) (item as any).__offre = entree;
    }
    for (const coffre of chambre.coffres) {
      const sprite = spriteAncre(this.tex.coffre, coffre.x, coffre.y, 90);
      if (sprite) conteneur.addChild(sprite);
    }
    for (const jarre of chambre.jarres) {
      const sprite = spriteAncre(this.tex.jarre, jarre.x, jarre.y, 100);
      if (sprite) {
        sprite.tint = 15259840;
        conteneur.addChild(sprite);
        this.jarresChambre.set(jarre, sprite);
      }
    }
    this.chambre = conteneur;
    this.addChild(conteneur);
  }

  mettreAJour(dt: number) {
    this.t += dt;
    for (const statue of this.statues) {
      const touche = this.sim.checkpointsTouches.has(statue.i);
      statue.halo.alpha +=
        ((touche ? 0.75 + 0.15 * Math.sin(this.t * 2.5) : 0.18) - statue.halo.alpha) *
        Math.min(1, dt * 4);
    }
    for (const friable of this.friables) {
      friable.s.visible = this.niveau.tuile(friable.c, friable.l) === Tuile.FRIABLE;
      const charge = friable.f?.charge ?? 0,
        ratio = charge / dureeChargeFriable;
      friable.s.x = friable.c * 64 + (charge > 0 ? Math.sin(charge * 60) * 7 * ratio : 0);
      friable.s.tint = charge > 0 ? 16767152 : 16777215;
    }
    if (this.chambre)
      for (const enfant of this.chambre.children) {
        const offre = (enfant as any).__offre;
        if (offre) enfant.visible = !offre.prise && offre.disponible;
      }
    const recompenses = this.recompenses;
    if (recompenses) {
      this.synchroniser(
        this.coeurs,
        recompenses.coeurs,
        (coeur: any) => {
          const valeur = coeur.valeur ?? 1,
            sprite = new Sprite(this.tex.coeur);
          sprite.anchor.set(0.5);
          sprite.height = valeur >= 10 ? 46 : valeur >= 5 ? 36 : 26;
          sprite.scale.x = sprite.scale.y;
          return sprite;
        },
        (coeur: any, sprite: Sprite) => {
          sprite.position.set(
            coeur.x * 4,
            (coeur.y - 5 + Math.sin(this.t * 5 + coeur.x) * 1.5) * 4,
          );
          sprite.visible = coeur.vie > 3 || Math.floor(coeur.vie * 8) % 2 == 0;
        },
      );
      this.synchroniser(
        this.armes,
        recompenses.armes,
        () => {
          const sprite = new Sprite(this.tex.arme_sol);
          sprite.anchor.set(0.5, 1);
          sprite.height = 70;
          sprite.scale.x = sprite.scale.y;
          return sprite;
        },
        (arme: any, sprite: Sprite) => {
          sprite.position.set(arme.x * 4, (arme.y + 6 + Math.sin(this.t * 3) * 1.5 - 1.5) * 4);
        },
      );
    }
    for (const [jarre, sprite] of this.jarresChambre) sprite.visible = jarre.actif;
    const jarres = this.apparitions?.jarres() ?? [];
    this.synchroniser(
      this.jarres,
      jarres.map((j: any) => j.combattant),
      () => {
        const sprite = new Sprite(this.tex.jarre);
        sprite.anchor.set(0.5, 1);
        sprite.height = 100;
        sprite.scale.x = sprite.scale.y;
        return sprite;
      },
      (combattant: any, sprite: Sprite) => {
        sprite.position.set(combattant.corps.x * 4, combattant.corps.y * 4);
        sprite.tint =
          combattant.pv < combattant.pvMax && Math.floor(this.t * 30) % 2 == 0
            ? 16765120
            : 16777215;
      },
    );
  }

  synchroniser(map: Map<any, Sprite>, liste: any[], creer: (item: any) => Sprite, maj: (item: any, sprite: Sprite) => void) {
    const vivants = new Set(liste);
    for (const item of liste) {
      let sprite = map.get(item);
      if (!sprite) {
        sprite = creer(item);
        map.set(item, sprite);
        this.addChild(sprite);
      }
      maj(item, sprite);
    }
    for (const [item, sprite] of map)
      if (!vivants.has(item)) {
        map.delete(item);
        this.removeChild(sprite);
        sprite.destroy();
      }
  }
}