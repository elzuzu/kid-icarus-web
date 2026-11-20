import { Container, Graphics, Sprite, TextStyle } from "pixi.js";
import type { Texture } from "pixi.js";
import { n as largeurEcran } from "../core";
import { o as Text } from "../render/textures";
import { n as OR, o as styleTexte, r as BRONZE, a as dessinerPanneau } from "../render/theme";
// Le bundle hud importe le chunk index pour effet de bord (ordre d'exécution).
import "../app";
import { TypeTuile, construireNiveau, chargerNiveau } from "./niveau";
import { construireSol } from "./terrain";
import { AdvancedBloomFilter } from "./filtres";

const police = `"Segoe UI", "Trebuchet MS", sans-serif`;

interface IconesHud {
  coeur: Texture;
  coeurVide: Texture;
  aile?: Texture;
  etoile: Texture;
  fiole: Texture;
  fleche?: Texture;
  pouvoirs?: Record<string, Texture>;
}

interface EtatHud {
  pv: number;
  pvMax: number;
  vol: number;
  monnaie: number;
  pouvoirs: { id: string; charge: number; reste: number }[];
  manette: boolean;
  fioles: number;
}

// Couleurs des dieux : teintes saturées distinctes, lisibles sur le parchemin sombre.
const COULEURS_DIEUX: Record<string, number> = {
  palutena: 16773296,
  zeus: 16766016,
  poseidon: 5227511,
  athena: 12632256,
  hades: 12098303,
};

interface EntreeLoot {
  genre: "relique" | "set" | "talent";
  nom: string;
  couleur: number;
}

// Panneau des bénédictions actives (reliques portées, bonus de set, talents).
// Icônes vectorielles + libellés ; reconstruit uniquement quand la signature change.
export class PanneauLoot extends Container {
  fond = new Graphics();
  rangee = new Container();
  source: { profil: any; contenu: any } | null = null;
  signature = "";

  constructor() {
    super();
    this.addChild(this.fond, this.rangee);
    this.visible = false;
  }

  brancher(profil: any, contenu: any) {
    this.source = { profil, contenu };
    this.signature = "";
    this.maj();
  }

  private entrees(): EntreeLoot[] {
    if (!this.source) return [];
    const { profil, contenu } = this.source;
    const liste: EntreeLoot[] = [];
    const parDieu = new Map<string, number>();
    for (const id of profil.reliques_portees ?? []) {
      try {
        const relique = contenu.entree("reliques", id);
        liste.push({
          genre: "relique",
          nom: relique.nom,
          couleur: COULEURS_DIEUX[relique.dieu] ?? OR,
        });
        parDieu.set(relique.dieu, (parDieu.get(relique.dieu) ?? 0) + 1);
      } catch {
        // Relique inconnue du contenu : on l'ignore plutôt que de casser le HUD.
      }
    }
    for (const [dieu, nombre] of parDieu) {
      if (nombre < 2) continue;
      try {
        const set = contenu.entree("sets", dieu);
        liste.push({
          genre: "set",
          nom: `${set.nom} ×${nombre >= 4 ? 4 : 2}`,
          couleur: COULEURS_DIEUX[dieu] ?? OR,
        });
      } catch {
        // Set absent : ignoré.
      }
    }
    const talents = Object.entries(profil.talents ?? {}).filter(([, rang]) => (rang as number) > 0);
    if (talents.length) {
      const rangs = talents.reduce((somme, [, rang]) => somme + (rang as number), 0);
      liste.push({
        genre: "talent",
        nom: `Talents éveillés · ${rangs} rang${rangs > 1 ? "s" : ""}`,
        couleur: OR,
      });
    }
    return liste;
  }

  private icone(g: Graphics, genre: EntreeLoot["genre"], x: number, y: number, couleur: number) {
    if (genre === "relique") {
      g.poly([x, y - 10, x + 8, y, x, y + 10, x - 8, y])
        .fill(couleur)
        .stroke({ color: OR, width: 1.5 });
      g.moveTo(x - 4, y - 3).lineTo(x + 4, y - 3).stroke({ color: 0xffffff, width: 1, alpha: 0.7 });
    } else if (genre === "set") {
      g.poly([x - 8, y - 9, x + 8, y - 9, x + 8, y + 2, x, y + 10, x - 8, y + 2])
        .fill(couleur)
        .stroke({ color: OR, width: 1.5 });
    } else {
      g.poly([x, y - 10, x + 3, y - 3, x + 10, y, x + 3, y + 3, x, y + 10, x - 3, y + 3, x - 10, y, x - 3, y - 3])
        .fill(couleur)
        .stroke({ color: OR, width: 1.2 });
    }
  }

  maj() {
    if (!this.source) return;
    const entrees = this.entrees();
    const signature = JSON.stringify(entrees);
    if (signature === this.signature) return;
    this.signature = signature;
    for (const enfant of this.rangee.removeChildren()) enfant.destroy({ children: true });
    this.fond.clear();
    this.visible = entrees.length > 0;
    if (!entrees.length) return;
    const pas = 32;
    const hauteur = 40 + entrees.length * pas + 10;
    let largeurMax = 0;
    entrees.forEach((entree, i) => {
      const y = 46 + i * pas;
      const icone = new Graphics();
      this.icone(icone, entree.genre, 26, y, entree.couleur);
      const texte = new Text({ text: entree.nom, style: styleTexte(19, 16052196) });
      texte.anchor.set(0, 0.5);
      texte.position.set(46, y);
      largeurMax = Math.max(largeurMax, texte.width);
      this.rangee.addChild(icone, texte);
    });
    const entete = new Text({
      text: "BÉNÉDICTIONS",
      style: styleTexte(18, BRONZE),
    });
    entete.anchor.set(0, 0.5);
    entete.position.set(20, 22);
    entete.style.letterSpacing = 3;
    this.rangee.addChild(entete);
    const largeur = Math.min(400, Math.max(largeurMax + 66, entete.width + 40));
    dessinerPanneau(this.fond, 0, 0, largeur, hauteur, 0.62);
  }
}

export class Hud extends Container {
  icones: IconesHud;
  coeurs: Sprite[] = [];
  echellesCoeurs: number[] = [];
  jauge = new Graphics();
  texteFleches: any;
  comptes: any[] = [];
  iconesCases: Sprite[] = [];
  voiles: Graphics[] = [];
  touches: any[] = [];
  loot = new PanneauLoot();
  manette: boolean | null = null;
  t = 0;
  styleChiffres = new TextStyle({
    fontFamily: police,
    fontSize: 30,
    fontWeight: "600",
    fill: 16052196,
    dropShadow: {
      color: 0,
      alpha: 0.85,
      blur: 3,
      distance: 2,
      angle: Math.PI / 2,
    },
  });

  constructor(icones: IconesHud, nbCoeurs = 6) {
    super();
    this.icones = icones;
    for (let i = 0; i < nbCoeurs; i++) {
      const coeur = new Sprite(icones.coeur);
      coeur.anchor.set(0.5);
      coeur.height = 40;
      coeur.scale.x = coeur.scale.y;
      coeur.position.set(58 + i * 44, 56);
      this.coeurs.push(coeur);
      // Échelle de base mémorisée : la pulsation PV bas doit rester relative, pas cumulative.
      this.echellesCoeurs.push(coeur.scale.x);
      this.addChild(coeur);
    }
    this.addChild(this.jauge);
    const labelVol = new Text({ text: "VOL", style: styleTexte(15, BRONZE) });
    labelVol.anchor.set(0, 0.5);
    labelVol.alpha = 0.85;
    labelVol.position.set(302, 96);
    this.addChild(labelVol);
    const coeurMonnaie = new Sprite(icones.coeur);
    coeurMonnaie.anchor.set(0.5);
    coeurMonnaie.height = 38;
    coeurMonnaie.scale.x = coeurMonnaie.scale.y;
    coeurMonnaie.position.set(80, 140);
    this.addChild(coeurMonnaie);
    this.texteFleches = new Text({ text: "", style: this.styleChiffres });
    this.texteFleches.anchor.set(0, 0.5);
    this.texteFleches.position.set(132, 142);
    this.addChild(this.texteFleches);
    (
      [
        [icones.etoile, "LB"],
        [icones.etoile, "Y"],
        [icones.fiole, "RB"],
      ] as [Texture, string][]
    ).forEach(([texture, touche], i) =>
      this.emplacement(largeurEcran - 320 + i * 108, 58, texture, touche, i),
    );
    // Bénédictions actives sous la monnaie, côté gauche : libre de tout overlap
    // (barre boss centrée, pouvoirs à droite, sous-titres en bas).
    this.loot.position.set(30, 186);
    this.addChild(this.loot);
    // Hook debug (même esprit que window.__sim) : permet de câbler/tester le loot
    // sans toucher à stage/index.ts : __hud.brancherLoot(profil, contenu).
    (window as any).__hud = this;
  }

  // Câblage optionnel (stage) : lecture en direct du profil + contenu.
  brancherLoot(profil: any, contenu: any) {
    this.loot.brancher(profil, contenu);
  }

  emplacement(
    x: number,
    y: number,
    texture: Texture,
    touche: string,
    index: number,
  ) {
    const groupe = new Container();
    const cadre = new Graphics();
    cadre.roundRect(-36, -36, 72, 72, 10).fill({ color: 789780, alpha: 0.82 });
    cadre
      .roundRect(-36, -36, 72, 72, 10)
      .stroke({ color: 13225174, width: 2.5, alpha: 0.95 });
    cadre
      .roundRect(-31, -31, 62, 62, 7)
      .stroke({ color: 7172997, width: 1.2, alpha: 0.8 });
    groupe.addChild(cadre);
    const icone = new Sprite(texture);
    icone.anchor.set(0.5);
    const echelle = 54 / Math.max(texture.width, texture.height);
    icone.scale.set(echelle);
    groupe.addChild(icone);
    this.iconesCases[index] = icone;
    const voile = new Graphics();
    groupe.addChild(voile);
    this.voiles[index] = voile;
    const compte = new Text({ text: "", style: this.styleChiffres.clone() });
    compte.style.fontSize = 24;
    compte.anchor.set(1, 1);
    compte.position.set(33, 36);
    groupe.addChild(compte);
    this.comptes[index] = compte;
    const badge = new Graphics();
    badge
      .roundRect(-18, 46, 36, 22, 11)
      .fill({ color: 1316383, alpha: 0.9 })
      .stroke({ color: 11449282, width: 1.5 });
    groupe.addChild(badge);
    const label = new Text({
      text: touche,
      style: new TextStyle({
        fontFamily: police,
        fontSize: 14,
        fontWeight: "700",
        fill: 15263982,
      }),
    });
    label.anchor.set(0.5);
    label.position.set(0, 57);
    groupe.addChild(label);
    this.touches[index] = label;
    groupe.position.set(x, y);
    this.addChild(groupe);
  }

  afficher(etat: EtatHud) {
    this.loot.maj();
    const part = etat.pvMax / this.coeurs.length;
    // Pulsation douce à PV critiques : signal d'urgence lisible sans toucher au gameplay.
    const critique = etat.pv > 0 && etat.pv <= etat.pvMax * 0.25;
    const pulsation = critique ? 1 + 0.07 * Math.sin(this.t * 6) : 1;
    this.coeurs.forEach((coeur, i) => {
      const plein = etat.pv >= (i + 1) * part - 1e-6;
      const partiel = !plein && etat.pv > i * part + 1e-6;
      coeur.texture = plein || partiel ? this.icones.coeur : this.icones.coeurVide;
      coeur.alpha = partiel ? 0.45 + 0.4 * ((etat.pv - i * part) / part) : 1;
      const echelle = this.echellesCoeurs[i] * (critique && (plein || partiel) ? pulsation : 1);
      coeur.scale.set(echelle);
    });
    const jauge = this.jauge;
    jauge.clear();
    jauge
      .roundRect(34, 84, 258, 24, 6)
      .fill({ color: 658194, alpha: 0.85 })
      .stroke({ color: 12172745, width: 2 });
    const largeurVol = Math.max(0, Math.min(1, etat.vol)) * 250;
    if (largeurVol > 0) {
      jauge.roundRect(38, 88, largeurVol, 16, 4).fill(3116287);
      jauge.roundRect(38, 88, largeurVol, 7.2, 3).fill({
        color: 12575487,
        alpha: 0.55,
      });
    }
    this.texteFleches.text = String(etat.monnaie);
    const compteFioles = this.comptes[2];
    this.t += 1 / 60;
    for (let i = 0; i < 2; i++) {
      const icone = this.iconesCases[i];
      const voile = this.voiles[i];
      const compte = this.comptes[i];
      const pouvoir = etat.pouvoirs[i] ?? { id: "", charge: -1, reste: 0 };
      if (!icone || !voile || !compte) continue;
      const texture = this.icones.pouvoirs?.[pouvoir.id] ?? this.icones.etoile;
      if (icone.texture !== texture) {
        icone.texture = texture;
        icone.scale.set(54 / Math.max(texture.width, texture.height));
      }
      voile.clear();
      if (pouvoir.charge < 0) icone.alpha = 0.18;
      else if (pouvoir.charge < 1) {
        icone.alpha = 0.45;
        // Voile radial sur la part encore en recharge + arc or de progression :
        // lecture immédiate du cooldown, le compte chiffré reste en complément.
        const finRecharge = -Math.PI / 2 + Math.PI * 2 * pouvoir.charge;
        voile
          .moveTo(0, 0)
          .arc(0, 0, 33, finRecharge, Math.PI * 1.5)
          .closePath()
          .fill({ color: 329226, alpha: 0.72 });
        voile.arc(0, 0, 36, -Math.PI / 2, finRecharge).stroke({ color: OR, width: 3, alpha: 0.9 });
      } else icone.alpha = 0.85 + 0.15 * Math.sin(this.t * 4 + i);
      compte.text =
        pouvoir.charge >= 0 && pouvoir.charge < 1
          ? String(Math.ceil(pouvoir.reste))
          : "";
    }
    if (this.manette !== etat.manette) {
      this.manette = etat.manette;
      const labels = etat.manette ? ["LB", "Y", "RB"] : ["1", "2", "F"];
      this.touches.forEach((touche, i) => {
        touche.text = labels[i] ?? "";
      });
    }
    if (compteFioles) compteFioles.text = etat.fioles > 0 ? String(etat.fioles) : "";
    const iconeFiole = this.iconesCases[2];
    if (iconeFiole) iconeFiole.alpha = etat.fioles > 0 ? 1 : 0.28;
  }
}

export { TypeTuile as a };
export { AnimatedSprite as c, TilingSprite as s } from "pixi.js";
export { construireNiveau as i, chargerNiveau as r } from "./niveau";
export { construireSol as n } from "./terrain";
export { AdvancedBloomFilter as o } from "./filtres";
export { Hud as t };