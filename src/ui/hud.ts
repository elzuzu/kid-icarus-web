import { Container, Graphics, Rectangle, Sprite, TextStyle } from "pixi.js";
import type { Texture } from "pixi.js";
import { n as largeurEcran } from "../core";
import { o as Text } from "../render/textures";
import { n as OR, o as styleTexte, r as BRONZE, a as dessinerPanneau } from "../render/theme";
import { options } from "../app/options";
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

interface StatutHud {
  id: string;
  duree: number;
  dureeMax?: number;
  puissance?: number;
}

interface EtatHud {
  pv: number;
  pvMax: number;
  vol: number;
  monnaie: number;
  pouvoirs: { id: string; charge: number; reste: number }[];
  manette: boolean;
  fioles: number;
  // Champs de progression optionnels : repli sur brancherSim(sim) / brancherLoot(profil)
  // tant que l'orchestrateur ne les passe pas explicitement.
  xp?: number;
  xpRequis?: number;
  niveau?: number;
  intensite?: number;
  difficulte?: "normal" | "expert";
  statuts?: StatutHud[];
}

// Couleurs des dieux : teintes saturées distinctes, lisibles sur le parchemin sombre.
const COULEURS_DIEUX: Record<string, number> = {
  palutena: 16773296,
  zeus: 16766016,
  poseidon: 5227511,
  athena: 12632256,
  hades: 12098303,
};

// Palette progression : or XP, rouge vie, vert soin — même langage que le parchemin sombre.
const OR_XP = 0xf0c040;
const OR_XP_CLAIR = 0xffe9a0;
const ROUGE_PV = 0xe8433f;
const ROUGE_PV_CLAIR = 0xff8a70;
const TEINTE_DEGAT = 0xff5040;
const TEINTE_SOIN = 0x60ff90;
const CREME = 15983280;

// Mélange de teintes sans allocation (canaux entiers).
function melangeTeinte(a: number, b: number, k: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * k) << 16) |
    (Math.round(ag + (bg - ag) * k) << 8) |
    Math.round(ab + (bb - ab) * k)
  );
}

interface EntreeLoot {
  genre: "relique" | "set" | "talent" | "suite";
  nom: string;
  couleur: number;
}

// Panneau des bénédictions actives (reliques portées, bonus de set, talents).
// Icônes vectorielles + libellés ; reconstruit uniquement quand la signature change.
// Ordre stable (reliques portées → sets → talents), plafonné à 6 lignes sans clipping.
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
        // Progression de set lisible « n/4 » : le palier actif (×2/×4) reste devinable,
        // mais le compte exact montre la marche vers le palier suivant.
        liste.push({
          genre: "set",
          nom: `${set.nom} · ${Math.min(nombre, 4)}/4`,
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
    } else if (genre === "suite") {
      for (const dx of [-8, 0, 8]) g.circle(x + dx, y, 2.5).fill(couleur);
    } else {
      g.poly([x, y - 10, x + 3, y - 3, x + 10, y, x + 3, y + 3, x, y + 10, x - 3, y + 3, x - 10, y, x - 3, y - 3])
        .fill(couleur)
        .stroke({ color: OR, width: 1.2 });
    }
  }

  maj() {
    if (!this.source) return;
    let entrees = this.entrees();
    // Plafond dur : 6 lignes max. Au-delà, la 6e devient un résumé « +N autres ».
    if (entrees.length > 6) {
      const reste = entrees.length - 5;
      entrees = entrees.slice(0, 5);
      entrees.push({ genre: "suite", nom: `+${reste} autre${reste > 1 ? "s" : ""}…`, couleur: BRONZE });
    }
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

// Emplacement de statut actif : icône vectorielle + anneau radial de durée restante.
// Pool fixe de 4 slots créés au constructeur — zéro allocation par frame.
class SlotStatut extends Container {
  fond = new Graphics();
  icone = new Graphics();
  anneau = new Graphics();
  lettre: Text;
  id = "";
  dureeMax = 0;
  alphaCible = 0;

  constructor() {
    super();
    this.fond
      .roundRect(-21, -21, 42, 42, 8)
      .fill({ color: 723216, alpha: 0.85 })
      .stroke({ color: BRONZE, width: 1.5, alpha: 0.9 });
    this.lettre = new Text({ text: "", style: styleTexte(18, CREME) });
    this.lettre.anchor.set(0.5);
    this.lettre.visible = false;
    this.addChild(this.fond, this.icone, this.anneau, this.lettre);
    this.visible = false;
    this.alpha = 0;
  }

  private dessinerIcone(id: string) {
    const g = this.icone;
    g.clear();
    this.lettre.visible = false;
    if (id === "brulure") {
      g.poly([0, -13, 6, -4, 9, 3, 5, 10, -5, 10, -9, 3, -6, -4])
        .fill(0xff8c30)
        .stroke({ color: 0x8a2010, width: 1.5 });
      g.poly([0, -4, 4, 3, 0, 9, -4, 3]).fill(0xffe080);
    } else if (id === "poison") {
      g.poly([0, -12, 7, 0, 7, 6, 0, 12, -7, 6, -7, 0])
        .fill(0x7ce850)
        .stroke({ color: 0x1e5a18, width: 1.5 });
      g.circle(-2.5, 2, 2).fill(0x1e5a18);
      g.circle(3, 4, 1.5).fill(0x1e5a18);
      g.circle(1, -3, 1.5).fill(0xd8ffc0);
    } else if (id === "aubergine") {
      g.poly([0, -6, 6, -2, 7, 6, 3, 12, -3, 12, -7, 6, -6, -2])
        .fill(0x9a4fd0)
        .stroke({ color: 0x3a1860, width: 1.5 });
      g.poly([-4, -6, 0, -10, 4, -6, 0, -3]).fill(0x60c040);
      g.moveTo(0, -10).lineTo(0, -13).stroke({ color: 0x60c040, width: 2 });
      g.circle(-2, 3, 1.6).fill({ color: 0xd8b0ff, alpha: 0.8 });
    } else if (id === "gel") {
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI / 3) * i;
        const dx = Math.cos(a) * 11, dy = Math.sin(a) * 11;
        g.moveTo(-dx, -dy).lineTo(dx, dy).stroke({ color: 0x7fd8ff, width: 2.5 });
        for (const sens of [-1, 1]) {
          g.moveTo(dx * 0.6 * sens, dy * 0.6 * sens)
            .lineTo(dx * 0.6 * sens - dy * 0.28, dy * 0.6 * sens + dx * 0.28)
            .stroke({ color: 0x7fd8ff, width: 1.5 });
        }
      }
      g.circle(0, 0, 2.5).fill(0xe8f8ff);
    } else {
      g.poly([0, -11, 9, 0, 0, 11, -9, 0])
        .fill({ color: CREME, alpha: 0.25 })
        .stroke({ color: CREME, width: 1.5 });
      this.lettre.text = (id[0] ?? "?").toUpperCase();
      this.lettre.visible = true;
    }
  }

  maj(statut: StatutHud | null, dt: number, maxParId: Map<string, number>) {
    this.alphaCible = statut && statut.duree > 0 ? 1 : 0;
    this.alpha += (this.alphaCible - this.alpha) * Math.min(1, dt * 12);
    this.visible = this.alpha > 0.02;
    if (!this.visible) {
      if (this.alphaCible === 0) this.id = "";
      return;
    }
    if (!statut) return;
    if (statut.id !== this.id) {
      this.id = statut.id;
      this.dessinerIcone(statut.id);
      this.dureeMax = 0;
    }
    // durée max : fournie explicitement, sinon plus grande durée observée pour cet id
    // (le statut ne fait que décroître ; une réapplication remonte le max).
    const fourni = statut.dureeMax ?? 0;
    const connu = maxParId.get(statut.id) ?? 0;
    if (statut.duree > connu) maxParId.set(statut.id, statut.duree);
    this.dureeMax = Math.max(fourni, connu, statut.duree, 0.001);
    const fraction = Math.max(0, Math.min(1, statut.duree / this.dureeMax));
    const couleur =
      statut.id === "brulure" ? 0xff8c30 : statut.id === "poison" ? 0x7ce850 : statut.id === "gel" ? 0x7fd8ff : statut.id === "aubergine" ? 0x9a4fd0 : CREME;
    const a = this.anneau;
    a.clear();
    a.circle(0, 0, 25).stroke({ color: 0x0a0806, width: 3, alpha: 0.6 });
    if (fraction > 0.003)
      a.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction).stroke({
        color: couleur,
        width: 3,
        alpha: 0.95,
      });
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
  vides: Graphics[] = [];
  textesVide: any[] = [];
  loot = new PanneauLoot();
  manette: boolean | null = null;
  t = 0;
  // Vie : barre segmentée exacte + numérique discret + flashs dégât/soin par cœur.
  barrePv = new Graphics();
  flashRangee = new Graphics();
  flashRangeeDessine = false;
  textePv: Text;
  pvPrec = -1;
  pvMaxPrec = -1;
  fracPrec: number[] = [];
  flashsCoeurs: number[] = [];
  teintesCoeurs: number[] = [];
  textePvCache = "";
  // XP : médaillon niveau + barre segmentée à remplissage lerp, pop au level-up.
  conteneurXp = new Container();
  medaillon = new Container();
  fondMedaillon = new Graphics();
  flashMedaillon = new Graphics();
  texteNiveau: Text;
  barreXp = new Graphics();
  flashXp = new Graphics();
  texteXp: Text;
  xpAffiche = 0;
  xpDessine = -1;
  niveauPrec = 0;
  popNiveau = 0;
  survolXp = false;
  alphaInfoXp = 0;
  texteXpCache = "";
  // Monnaie : pop scale + teinte au ramassage, sans recomposition par frame.
  coeurMonnaie: Sprite;
  echelleMonnaie = 1;
  popMonnaie = 0;
  monnaiePrec = -1;
  // Statuts + contexte (intensité / difficulté).
  slotsStatuts: SlotStatut[] = [];
  maxParId = new Map<string, number>();
  statutsLus: StatutHud[] = [0, 1, 2, 3].map(() => ({ id: "", duree: 0 }));
  nbStatutsLus = 0;
  texteContexte: Text;
  contexteCache = "";
  // Sources live (câblage optionnel, cf. demandes d'intégration index.ts).
  sim: any = null;
  etatDebug: Partial<EtatHud> | null = null;
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
    // Halo de flash derrière la rangée de cœurs : le tint seul multi les textures
    // (un cœur déjà rouge ne « rougit » pas) — le halo rend le dégât/soin immanquable.
    this.addChild(this.flashRangee);
    for (let i = 0; i < nbCoeurs; i++) {
      const coeur = new Sprite(icones.coeur);
      coeur.anchor.set(0.5);
      coeur.height = 40;
      coeur.scale.x = coeur.scale.y;
      coeur.position.set(58 + i * 44, 56);
      this.coeurs.push(coeur);
      // Échelle de base mémorisée : la pulsation PV bas doit rester relative, pas cumulative.
      this.echellesCoeurs.push(coeur.scale.x);
      this.fracPrec.push(1);
      this.flashsCoeurs.push(0);
      this.teintesCoeurs.push(0xffffff);
      this.addChild(coeur);
    }
    // Lecture exacte de la vie : fine barre segmentée (1 segment par cœur) sous la rangée,
    // numérique pv/pvMax à droite des cœurs (contour noir → contraste ≥4.5:1 sur tout fond).
    this.addChild(this.barrePv);
    this.textePv = new Text({ text: "", style: styleTexte(18, CREME) });
    this.textePv.anchor.set(0, 0.5);
    this.textePv.position.set(306, 56);
    this.textePv.alpha = 0.92;
    this.addChild(this.textePv);
    this.addChild(this.jauge);
    const labelVol = new Text({ text: "VOL", style: styleTexte(15, BRONZE) });
    labelVol.anchor.set(0, 0.5);
    labelVol.alpha = 0.85;
    labelVol.position.set(302, 106);
    this.addChild(labelVol);
    this.coeurMonnaie = new Sprite(icones.coeur);
    this.coeurMonnaie.anchor.set(0.5);
    this.coeurMonnaie.height = 38;
    this.coeurMonnaie.scale.x = this.coeurMonnaie.scale.y;
    this.coeurMonnaie.position.set(80, 150);
    this.echelleMonnaie = this.coeurMonnaie.scale.x;
    this.addChild(this.coeurMonnaie);
    this.texteFleches = new Text({ text: "", style: this.styleChiffres });
    this.texteFleches.anchor.set(0, 0.5);
    this.texteFleches.position.set(132, 152);
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
    // Widget XP/niveau : sous la monnaie, dans la grappe gauche (vie → vol → cœurs →
    // progression). Justifié : le centre-haut est réservé à la barre boss, la droite aux
    // pouvoirs, le bas aux sous-titres — la colonne gauche ne masque jamais le gameplay.
    this.construireXp();
    this.addChild(this.conteneurXp);
    // Bénédictions actives sous le widget XP, côté gauche : libre de tout overlap.
    this.loot.position.set(30, 246);
    this.addChild(this.loot);
    // Statuts actifs du joueur : rangée d'icônes à droite, sous les pouvoirs.
    for (let i = 0; i < 4; i++) {
      const slot = new SlotStatut();
      slot.position.set(largeurEcran - 54 - i * 52, 190);
      this.slotsStatuts.push(slot);
      this.addChild(slot);
    }
    // Badge discret intensité + difficulté, au-dessus de la rangée de statuts.
    this.texteContexte = new Text({ text: "", style: styleTexte(15, CREME) });
    this.texteContexte.anchor.set(1, 0.5);
    this.texteContexte.position.set(largeurEcran - 30, 142);
    this.texteContexte.alpha = 0.78;
    this.texteContexte.style.letterSpacing = 1;
    this.addChild(this.texteContexte);
    // Hook debug (même esprit que window.__sim) : permet de câbler/tester le loot
    // sans toucher à stage/index.ts : __hud.brancherLoot(profil, contenu).
    (window as any).__hud = this;
  }

  // Câblage optionnel (stage) : lecture en direct du profil + contenu.
  brancherLoot(profil: any, contenu: any) {
    this.loot.brancher(profil, contenu);
  }

  // Câblage optionnel (stage) : statuts / intensité lus en direct sur la simulation.
  // Demande d'intégration : une ligne `hud.brancherSim(sim);` après brancherLoot.
  brancherSim(sim: any) {
    this.sim = sim;
  }

  private construireXp() {
    const c = this.conteneurXp;
    c.visible = false;
    // Médaillon niveau : disque parchemin sombre, double anneau or/bronze, encoches.
    this.fondMedaillon
      .circle(0, 0, 24)
      .fill({ color: 723216, alpha: 0.92 })
      .stroke({ color: OR, width: 2.5 });
    this.fondMedaillon.circle(0, 0, 19).stroke({ color: BRONZE, width: 1.2, alpha: 0.9 });
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + Math.PI / 4;
      this.fondMedaillon
        .circle(Math.cos(a) * 24, Math.sin(a) * 24, 2.6)
        .fill(BRONZE)
        .stroke({ color: OR, width: 1 });
    }
    this.flashMedaillon.circle(0, 0, 27).stroke({ color: OR_XP_CLAIR, width: 3, alpha: 1 });
    this.flashMedaillon.alpha = 0;
    const labelNiv = new Text({ text: "NIV", style: styleTexte(9, BRONZE) });
    labelNiv.anchor.set(0.5);
    labelNiv.position.set(0, -11);
    labelNiv.style.letterSpacing = 1.5;
    this.texteNiveau = new Text({
      text: "1",
      style: new TextStyle({
        fontFamily: police,
        fontSize: 21,
        fontWeight: "700",
        fill: CREME,
        stroke: { color: 0, width: 3 },
      }),
    });
    this.texteNiveau.anchor.set(0.5);
    this.texteNiveau.position.set(0, 5);
    this.medaillon.addChild(this.fondMedaillon, this.flashMedaillon, labelNiv, this.texteNiveau);
    this.medaillon.position.set(58, 196);
    c.addChild(this.medaillon, this.barreXp, this.flashXp);
    // Info xp/xpRequis au survol (clavier non requis : la progression reste visible seule).
    this.texteXp = new Text({ text: "", style: styleTexte(14, CREME) });
    this.texteXp.anchor.set(0, 0);
    this.texteXp.position.set(92, 210);
    this.texteXp.alpha = 0;
    this.texteXp.visible = false;
    c.addChild(this.texteXp);
    c.eventMode = "static";
    c.hitArea = new Rectangle(28, 168, 336, 60);
    c.on("pointerover", () => (this.survolXp = true));
    c.on("pointerout", () => (this.survolXp = false));
  }

  private dessinerBarreXp(fraction: number) {
    const g = this.barreXp;
    g.clear();
    const x = 92, y = 190, largeur = 260, hauteur = 12, nb = 10;
    g.roundRect(x - 3, y - 3, largeur + 6, hauteur + 6, 4)
      .fill({ color: 658194, alpha: 0.85 })
      .stroke({ color: BRONZE, width: 1.5 });
    const pas = (largeur - (nb - 1) * 2) / nb;
    const rempli = fraction * nb;
    for (let i = 0; i < nb; i++) {
      const sx = x + i * (pas + 2);
      g.rect(sx, y, pas, hauteur).fill({ color: 0x0a0806, alpha: 0.8 });
      const part = Math.max(0, Math.min(1, rempli - i));
      if (part > 0.004) {
        g.rect(sx, y, pas * part, hauteur).fill(OR_XP);
        g.rect(sx, y, pas * part, hauteur * 0.4).fill({ color: OR_XP_CLAIR, alpha: 0.6 });
      }
    }
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
    // Emplacement vide : losange pointillé + libellé VIDE, sans icône fantôme.
    const vide = new Graphics();
    vide
      .poly([0, -18, 18, 0, 0, 18, -18, 0])
      .stroke({ color: BRONZE, width: 1.5, alpha: 0.55 });
    vide.poly([0, -10, 10, 0, 0, 10, -10, 0]).stroke({ color: BRONZE, width: 1, alpha: 0.35 });
    vide.visible = false;
    groupe.addChild(vide);
    this.vides[index] = vide;
    const texteVide = new Text({ text: "VIDE", style: styleTexte(11, BRONZE) });
    texteVide.anchor.set(0.5);
    texteVide.position.set(0, 26);
    texteVide.style.letterSpacing = 2;
    texteVide.visible = false;
    groupe.addChild(texteVide);
    this.textesVide[index] = texteVide;
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

  // Lit les statuts du joueur sans allouer : tableau préalloué rempli en place.
  private lireStatutsSim() {
    this.nbStatutsLus = 0;
    const map = this.sim?.combattant?.statuts;
    if (!map || !map.size) return;
    for (const [id, statut] of map) {
      if (this.nbStatutsLus >= 4) break;
      const lu = this.statutsLus[this.nbStatutsLus++];
      lu.id = id;
      lu.duree = statut.duree;
      lu.dureeMax = 0;
    }
  }

  afficher(etat: EtatHud) {
    const dt = 1 / 60;
    this.t += dt;
    const dbg = this.etatDebug;
    const flashes = options.flashes !== false;
    this.loot.maj();
    const part = etat.pvMax / this.coeurs.length;
    // Pulsation douce à PV critiques : signal d'urgence lisible sans toucher au gameplay.
    const critique = etat.pv > 0 && etat.pv <= etat.pvMax * 0.25;
    const pulsation = critique ? 1 + 0.07 * Math.sin(this.t * 6) : 1;
    // Flashs dégât (rouge) / soin (vert) sur les cœurs dont la fraction a changé.
    if (this.pvPrec >= 0 && etat.pv !== this.pvPrec) {
      const sens = etat.pv < this.pvPrec ? TEINTE_DEGAT : TEINTE_SOIN;
      for (let i = 0; i < this.coeurs.length; i++) {
        const frac = Math.max(0, Math.min(1, (etat.pv - i * part) / part));
        if (Math.abs(frac - this.fracPrec[i]) > 1e-4) {
          this.flashsCoeurs[i] = flashes ? 1 : 0.25;
          this.teintesCoeurs[i] = sens;
        }
        this.fracPrec[i] = frac;
      }
    } else if (etat.pvMax !== this.pvMaxPrec) {
      // pvMax a changé (level-up) sans dégât : recalage silencieux des fractions.
      for (let i = 0; i < this.coeurs.length; i++)
        this.fracPrec[i] = Math.max(0, Math.min(1, (etat.pv - i * part) / part));
    }
    this.pvPrec = etat.pv;
    this.pvMaxPrec = etat.pvMax;
    let flashMax = 0, teinteMax = 0xffffff;
    this.coeurs.forEach((coeur, i) => {
      const plein = etat.pv >= (i + 1) * part - 1e-6;
      const partiel = !plein && etat.pv > i * part + 1e-6;
      coeur.texture = plein || partiel ? this.icones.coeur : this.icones.coeurVide;
      coeur.alpha = partiel ? 0.45 + 0.4 * ((etat.pv - i * part) / part) : 1;
      const flash = this.flashsCoeurs[i];
      const echelle =
        this.echellesCoeurs[i] *
        (critique && (plein || partiel) ? pulsation : 1) *
        (1 + 0.1 * flash);
      coeur.scale.set(echelle);
      if (flash > 0) {
        this.flashsCoeurs[i] = Math.max(0, flash - dt / 0.3);
        coeur.tint = melangeTeinte(0xffffff, this.teintesCoeurs[i], flash * 0.85);
        if (flash > flashMax) {
          flashMax = flash;
          teinteMax = this.teintesCoeurs[i];
        }
      } else if (coeur.tint !== 0xffffff) coeur.tint = 0xffffff;
    });
    if (flashMax > 0) {
      this.flashRangee.clear();
      this.flashRangee
        .roundRect(30, 30, 280, 52, 12)
        .fill({ color: teinteMax, alpha: 0.3 * flashMax });
      this.flashRangeeDessine = true;
    } else if (this.flashRangeeDessine) {
      this.flashRangee.clear();
      this.flashRangeeDessine = false;
    }
    // Barre de vie exacte : segments alignés sur les cœurs, même fraction pv/pvMax.
    const bp = this.barrePv;
    bp.clear();
    const bx = 36, by = 78, bl = 260, bh = 8, nbSeg = this.coeurs.length;
    bp.roundRect(bx - 2, by - 2, bl + 4, bh + 4, 3)
      .fill({ color: 658194, alpha: 0.85 })
      .stroke({ color: BRONZE, width: 1.2 });
    const pasSeg = (bl - (nbSeg - 1) * 2) / nbSeg;
    const ratioPv = Math.max(0, Math.min(1, etat.pv / Math.max(1, etat.pvMax)));
    const rempliPv = ratioPv * nbSeg;
    const alphaPulse = critique ? 0.75 + 0.25 * Math.sin(this.t * 6) : 1;
    for (let i = 0; i < nbSeg; i++) {
      const sx = bx + i * (pasSeg + 2);
      bp.rect(sx, by, pasSeg, bh).fill({ color: 0x0a0806, alpha: 0.8 });
      const partSeg = Math.max(0, Math.min(1, rempliPv - i));
      if (partSeg > 0.004) {
        bp.rect(sx, by, pasSeg * partSeg, bh).fill({ color: ROUGE_PV, alpha: alphaPulse });
        bp.rect(sx, by, pasSeg * partSeg, bh * 0.4).fill({ color: ROUGE_PV_CLAIR, alpha: 0.5 * alphaPulse });
      }
    }
    const libellePv = `${Math.ceil(etat.pv)}/${Math.round(etat.pvMax)}`;
    if (libellePv !== this.textePvCache) {
      this.textePvCache = libellePv;
      this.textePv.text = libellePv;
    }
    const jauge = this.jauge;
    jauge.clear();
    jauge
      .roundRect(34, 94, 258, 24, 6)
      .fill({ color: 658194, alpha: 0.85 })
      .stroke({ color: 12172745, width: 2 });
    const largeurVol = Math.max(0, Math.min(1, etat.vol)) * 250;
    if (largeurVol > 0) {
      jauge.roundRect(38, 98, largeurVol, 16, 4).fill(3116287);
      jauge.roundRect(38, 98, largeurVol, 7.2, 3).fill({
        color: 12575487,
        alpha: 0.55,
      });
    }
    // Monnaie : pop scale + teinte or à chaque ramassage, texte recomposé seulement au changement.
    if (etat.monnaie !== this.monnaiePrec) {
      if (this.monnaiePrec >= 0 && etat.monnaie > this.monnaiePrec) this.popMonnaie = 1;
      this.monnaiePrec = etat.monnaie;
      this.texteFleches.text = String(etat.monnaie);
    }
    if (this.popMonnaie > 0) {
      this.popMonnaie = Math.max(0, this.popMonnaie - dt / 0.28);
      const onde = Math.sin(this.popMonnaie * Math.PI);
      this.coeurMonnaie.scale.set(this.echelleMonnaie * (1 + 0.28 * onde));
      this.coeurMonnaie.tint = melangeTeinte(0xffffff, OR_XP_CLAIR, onde * (flashes ? 0.9 : 0.35));
      this.texteFleches.scale.set(1 + 0.14 * onde);
      if (this.popMonnaie === 0) {
        this.coeurMonnaie.scale.set(this.echelleMonnaie);
        this.coeurMonnaie.tint = 0xffffff;
        this.texteFleches.scale.set(1);
      }
    }
    this.majXp(etat, dbg, dt, flashes);
    this.majStatuts(etat, dbg, dt);
    this.majContexte(etat, dbg);
    const compteFioles = this.comptes[2];
    for (let i = 0; i < 2; i++) {
      const icone = this.iconesCases[i];
      const voile = this.voiles[i];
      const compte = this.comptes[i];
      const pouvoir = etat.pouvoirs[i] ?? { id: "", charge: -1, reste: 0 };
      if (!icone || !voile || !compte) continue;
      const vide = pouvoir.charge < 0;
      this.vides[i].visible = vide;
      this.textesVide[i].visible = vide;
      const texture = this.icones.pouvoirs?.[pouvoir.id] ?? this.icones.etoile;
      if (icone.texture !== texture) {
        icone.texture = texture;
        icone.scale.set(54 / Math.max(texture.width, texture.height));
      }
      voile.clear();
      if (vide) icone.alpha = 0;
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
      const libelleCompte =
        pouvoir.charge >= 0 && pouvoir.charge < 1 ? String(Math.ceil(pouvoir.reste)) : "";
      if (compte.text !== libelleCompte) compte.text = libelleCompte;
    }
    if (this.manette !== etat.manette) {
      this.manette = etat.manette;
      const labels = etat.manette ? ["LB", "Y", "RB"] : ["1", "2", "F"];
      this.touches.forEach((touche, i) => {
        touche.text = labels[i] ?? "";
      });
    }
    if (compteFioles) {
      const libelleFioles = etat.fioles > 0 ? String(etat.fioles) : "";
      if (compteFioles.text !== libelleFioles) compteFioles.text = libelleFioles;
    }
    const iconeFiole = this.iconesCases[2];
    if (iconeFiole) iconeFiole.alpha = etat.fioles > 0 ? 1 : 0.28;
  }

  private majXp(etat: EtatHud, dbg: Partial<EtatHud> | null, dt: number, flashes: boolean) {
    const profil = this.loot.source?.profil;
    const niveau = etat.niveau ?? dbg?.niveau ?? profil?.niveau ?? 0;
    this.conteneurXp.visible = niveau > 0;
    if (niveau <= 0) return;
    // Courbe officielle app/progression.ts (xpRequise non exportée) : 60 × niveau^1.55.
    const xpRequis = etat.xpRequis ?? dbg?.xpRequis ?? Math.round(60 * niveau ** 1.55);
    const xp = etat.xp ?? dbg?.xp ?? profil?.xp ?? 0;
    const plafond = niveau >= 30;
    const cible = plafond ? 1 : Math.max(0, Math.min(1, xp / Math.max(1, xpRequis)));
    if (this.niveauPrec > 0 && niveau > this.niveauPrec) {
      // Level-up : flash doré + scale-pop du médaillon, remplissage reparti de zéro.
      this.popNiveau = 1;
      this.xpAffiche = 0;
    }
    if (String(niveau) !== this.texteNiveau.text) this.texteNiveau.text = String(niveau);
    this.niveauPrec = niveau;
    // Remplissage animé : lerp vers la cible, jamais de saut (sauf level-up volontaire).
    this.xpAffiche += (cible - this.xpAffiche) * Math.min(1, dt * 7);
    if (Math.abs(cible - this.xpAffiche) < 0.002) this.xpAffiche = cible;
    if (Math.abs(this.xpAffiche - this.xpDessine) > 0.0015 || this.popNiveau > 0) {
      this.dessinerBarreXp(this.xpAffiche);
      this.xpDessine = this.xpAffiche;
    }
    if (this.popNiveau > 0) {
      this.popNiveau = Math.max(0, this.popNiveau - dt / 0.3);
      const onde = Math.sin(this.popNiveau * Math.PI);
      this.medaillon.scale.set(1 + 0.22 * onde);
      this.flashMedaillon.alpha = onde * (flashes ? 0.95 : 0.3);
      this.flashXp.clear();
      this.flashXp
        .roundRect(89, 187, 266, 18, 4)
        .fill({ color: OR_XP_CLAIR, alpha: onde * (flashes ? 0.55 : 0.18) });
      if (this.popNiveau === 0) {
        this.medaillon.scale.set(1);
        this.flashMedaillon.alpha = 0;
        this.flashXp.clear();
      }
    }
    // Info chiffrée au survol : fondu court, texte recomposé seulement si changé.
    const cibleAlpha = this.survolXp ? 1 : 0;
    this.alphaInfoXp += (cibleAlpha - this.alphaInfoXp) * Math.min(1, dt * 12);
    this.texteXp.visible = this.alphaInfoXp > 0.02;
    this.texteXp.alpha = this.alphaInfoXp;
    if (this.texteXp.visible) {
      const libelle = plafond ? "Niveau max · XP " + Math.round(xp) : `${Math.round(xp)} / ${xpRequis} XP`;
      if (libelle !== this.texteXpCache) {
        this.texteXpCache = libelle;
        this.texteXp.text = libelle;
      }
    }
  }

  private majStatuts(etat: EtatHud, dbg: Partial<EtatHud> | null, dt: number) {
    let liste: StatutHud[] | null = etat.statuts ?? dbg?.statuts ?? null;
    let nb = liste ? Math.min(liste.length, 4) : 0;
    if (!liste) {
      this.lireStatutsSim();
      liste = this.statutsLus;
      nb = this.nbStatutsLus;
    }
    for (let i = 0; i < 4; i++) this.slotsStatuts[i].maj(i < nb ? liste[i] : null, dt, this.maxParId);
  }

  private majContexte(etat: EtatHud, dbg: Partial<EtatHud> | null) {
    const profil = this.loot.source?.profil;
    const intensite = Math.max(
      0,
      Math.min(12, Math.round(etat.intensite ?? dbg?.intensite ?? this.sim?.intensite ?? profil?.intensite ?? 0)),
    );
    const difficulte = etat.difficulte ?? dbg?.difficulte ?? options.difficulte ?? "normal";
    const libelle =
      (intensite > 0 ? `Intensité ${intensite} · ` : "") + (difficulte === "expert" ? "Expert" : "Normal");
    if (libelle !== this.contexteCache) {
      this.contexteCache = libelle;
      this.texteContexte.text = libelle;
      this.texteContexte.style.fill = difficulte === "expert" ? OR_XP : CREME;
    }
  }
}

export { TypeTuile as a };
export { AnimatedSprite as c, TilingSprite as s } from "pixi.js";
export { construireNiveau as i, chargerNiveau as r } from "./niveau";
export { construireSol as n } from "./terrain";
export { AdvancedBloomFilter as o } from "./filtres";
export { Hud as t };