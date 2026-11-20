// Panneau d'options partagé (pause en jeu + écran titre).
// Sliders volume (pas 0.05, valeur en %), bascules, select difficulté.
// Clavier : ↑↓ naviguer, ←→ régler (Menu.pas), Entrée/Espace valider.
// Souris : survol = focus, clic = action, glisser sur la piste = réglage continu.
// Chaque mutation passe par app/options (persistance localStorage immédiate,
// lecture en direct par audio/techart/balance — les noms de clés ne changent pas).
import { Container, Graphics, Rectangle } from "pixi.js";
import { o as Texte } from "../render/textures";
import {
  n as OR,
  o as styleTexte,
  r as BRONZE,
  t as Bouton,
} from "../render/theme";
import {
  options,
  reglerOption,
  basculerOption,
  type CleOption,
} from "../app/options";
import { t as Menu } from "./menu";

const CREME = 15983280;
const ENCRE = 0x0d0a05;
const ATTENUÉ = 0x9c8c6c;
const VERT = 0x8fd14f;
const AMBRE = 0xe8a33d;

type Son = (id: string) => void;

abstract class LigneOption extends Container {
  actif = true;
  selectionne = false;
  largeur: number;
  hauteur = 60;
  cadre = new Graphics();
  contenu = new Graphics();
  libelle: Texte;
  son: Son | null;

  constructor(libelle: string, largeur: number, son: Son | null) {
    super();
    this.largeur = largeur;
    this.son = son;
    this.libelle = new Texte({ text: libelle, style: styleTexte(22, CREME) });
    this.libelle.anchor.set(0, 0.5);
    this.libelle.position.set(26, this.hauteur / 2);
    this.addChild(this.cadre, this.contenu, this.libelle);
    this.eventMode = "static";
    this.cursor = "pointer";
    this.hitArea = new Rectangle(-8, -4, largeur + 16, this.hauteur + 8);
    // Pas de dessiner() ici : les sous-classes appellent dessiner() une fois leurs
    // champs (textes de valeur, puces) créés — dessinerContenu en dépend.
  }

  dessiner() {
    const g = this.cadre;
    g.clear();
    g.roundRect(0, 0, this.largeur, this.hauteur, 10).fill({
      color: this.selectionne ? 0x241a08 : ENCRE,
      alpha: this.selectionne ? 0.85 : 0.6,
    });
    g.roundRect(0, 0, this.largeur, this.hauteur, 10).stroke({
      color: this.selectionne ? OR : BRONZE,
      width: this.selectionne ? 2.5 : 1,
      alpha: this.selectionne ? 1 : 0.55,
    });
    if (this.selectionne) {
      for (const cote of [-1, 1]) {
        const x = cote < 0 ? -20 : this.largeur + 20;
        const y = this.hauteur / 2;
        g.poly([x, y, x - cote * 12, y - 9, x - cote * 12, y + 9]).fill(OR);
      }
    }
    this.libelle.style.fill = this.selectionne ? 16773836 : CREME;
    this.dessinerContenu();
  }

  protected abstract dessinerContenu(): void;
  abstract action(): void;
  abstract lateral(sens: number): void;
}

class LigneSlider extends LigneOption {
  cle: "volumeMusique" | "volumeSfx" | "volumeDialogues";
  valeurTexte: Texte;
  glisse = false;
  pisteX = 390;
  pisteLargeur = 230;

  constructor(
    libelle: string,
    cle: "volumeMusique" | "volumeSfx" | "volumeDialogues",
    largeur: number,
    son: Son | null,
  ) {
    super(libelle, largeur, son);
    this.cle = cle;
    this.valeurTexte = new Texte({ text: "", style: styleTexte(24, OR) });
    this.valeurTexte.anchor.set(0, 0.5);
    this.valeurTexte.position.set(648, this.hauteur / 2);
    this.addChild(this.valeurTexte);
    // Glisser-déposer sur la piste : pointerdown arme, globalpointermove suit, up désarme.
    this.on("pointerdown", (e: any) => {
      const local = this.toLocal(e.global);
      if (local.x >= this.pisteX - 16 && local.x <= this.pisteX + this.pisteLargeur + 16) {
        this.glisse = true;
        this.appliquerPointeur(local.x);
      }
    });
    this.on("globalpointermove", (e: any) => {
      if (this.glisse) this.appliquerPointeur(this.toLocal(e.global).x);
    });
    const lacher = () => {
      this.glisse = false;
    };
    this.on("pointerup", lacher);
    this.on("pointerupoutside", lacher);
    this.dessiner();
  }

  private appliquerPointeur(x: number) {
    const fraction = (x - this.pisteX) / this.pisteLargeur;
    this.regler(fraction);
  }

  private regler(fraction: number) {
    const avant = options[this.cle];
    reglerOption(this.cle, Math.max(0, Math.min(1, fraction)));
    if (options[this.cle] !== avant) {
      this.dessiner();
      this.son?.("menu_deplacer");
    }
  }

  action() {
    // Un clic hors piste ne fait rien ; la piste est réglée au pointerdown.
  }

  lateral(sens: number) {
    this.regler(options[this.cle] + sens * 0.05);
  }

  protected dessinerContenu() {
    const g = this.contenu;
    g.clear();
    const cy = this.hauteur / 2;
    const valeur = options[this.cle];
    // Piste : fond sombre, graduations tous les 25 %, rempli or, reflet clair.
    g.roundRect(this.pisteX, cy - 7, this.pisteLargeur, 14, 7)
      .fill({ color: 0x14100a, alpha: 0.95 })
      .stroke({ color: BRONZE, width: 1.5, alpha: 0.9 });
    for (let i = 1; i < 4; i++) {
      const x = this.pisteX + (this.pisteLargeur * i) / 4;
      g.moveTo(x, cy - 4).lineTo(x, cy + 4).stroke({ color: BRONZE, width: 1, alpha: 0.5 });
    }
    const rempli = Math.max(0, Math.min(1, valeur)) * this.pisteLargeur;
    if (rempli > 2) {
      g.roundRect(this.pisteX + 2, cy - 5, rempli - 4, 10, 5).fill(0xc99b3f);
      g.roundRect(this.pisteX + 2, cy - 5, rempli - 4, 4, 2).fill({ color: 16773296, alpha: 0.6 });
    }
    // Curseur losange (langage visuel des panneaux antiques).
    const cx = this.pisteX + rempli;
    if (this.selectionne) g.circle(cx, cy, 15).fill({ color: OR, alpha: 0.22 });
    g.poly([cx, cy - 12, cx + 9, cy, cx, cy + 12, cx - 9, cy])
      .fill(this.selectionne ? 16773836 : CREME)
      .stroke({ color: this.selectionne ? OR : BRONZE, width: 2 });
    this.valeurTexte.text = `${Math.round(valeur * 100)} %`;
    this.valeurTexte.style.fill = this.selectionne ? 16773836 : OR;
  }
}

class LigneBascule extends LigneOption {
  cle: CleOption;
  oui: Texte;
  non: Texte;

  constructor(libelle: string, cle: CleOption, largeur: number, son: Son | null) {
    super(libelle, largeur, son);
    this.cle = cle;
    this.oui = new Texte({ text: "OUI", style: styleTexte(21, CREME) });
    this.non = new Texte({ text: "NON", style: styleTexte(21, ATTENUÉ) });
    this.oui.anchor.set(0.5);
    this.non.anchor.set(0.5);
    this.oui.position.set(largeur - 175, this.hauteur / 2);
    this.non.position.set(largeur - 65, this.hauteur / 2);
    this.addChild(this.oui, this.non);
    this.dessiner();
  }

  private changer(valeur: boolean) {
    if (!!(options as any)[this.cle] === valeur) return;
    reglerOption(this.cle, valeur);
    this.dessiner();
    this.son?.("menu_deplacer");
  }

  action() {
    basculerOption(this.cle);
    this.dessiner();
    this.son?.("menu_valider");
  }

  lateral(sens: number) {
    this.changer(sens > 0);
  }

  protected dessinerContenu() {
    const g = this.contenu;
    g.clear();
    const actif = !!(options as any)[this.cle];
    const x0 = this.largeur - 230;
    const cy = this.hauteur / 2;
    g.roundRect(x0, cy - 21, 220, 42, 21)
      .fill({ color: 0x14100a, alpha: 0.95 })
      .stroke({ color: BRONZE, width: 1.5, alpha: 0.9 });
    const moitie = actif ? x0 : x0 + 110;
    g.roundRect(moitie + 3, cy - 18, 104, 36, 18).fill({
      color: actif ? 0x3d5a1e : 0x4a2c14,
      alpha: 0.95,
    });
    g.roundRect(moitie + 3, cy - 18, 104, 36, 18).stroke({
      color: actif ? VERT : AMBRE,
      width: 2,
    });
    this.oui.style.fill = actif ? 0xd6f5b0 : ATTENUÉ;
    this.non.style.fill = actif ? ATTENUÉ : 0xf5d6b0;
    this.oui.style.fontWeight = actif ? "700" : "500";
    this.non.style.fontWeight = actif ? "500" : "700";
  }
}

class LigneDifficulte extends LigneOption {
  normal: Texte;
  expert: Texte;

  constructor(largeur: number, son: Son | null) {
    super("Difficulté", largeur, son);
    this.normal = new Texte({ text: "NORMAL", style: styleTexte(20, CREME) });
    this.expert = new Texte({ text: "EXPERT", style: styleTexte(20, ATTENUÉ) });
    this.normal.anchor.set(0.5);
    this.expert.anchor.set(0.5);
    this.normal.position.set(largeur - 175, this.hauteur / 2);
    this.expert.position.set(largeur - 65, this.hauteur / 2);
    this.addChild(this.normal, this.expert);
    this.dessiner();
  }

  private changer(valeur: "normal" | "expert") {
    if (options.difficulte === valeur) return;
    reglerOption("difficulte", valeur);
    this.dessiner();
    this.son?.("menu_deplacer");
  }

  action() {
    this.changer(options.difficulte === "normal" ? "expert" : "normal");
  }

  lateral(sens: number) {
    this.changer(sens > 0 ? "expert" : "normal");
  }

  protected dessinerContenu() {
    const g = this.contenu;
    g.clear();
    const expert = options.difficulte === "expert";
    const x0 = this.largeur - 230;
    const cy = this.hauteur / 2;
    g.roundRect(x0, cy - 21, 220, 42, 21)
      .fill({ color: 0x14100a, alpha: 0.95 })
      .stroke({ color: BRONZE, width: 1.5, alpha: 0.9 });
    const moitie = expert ? x0 + 110 : x0;
    g.roundRect(moitie + 3, cy - 18, 104, 36, 18).fill({
      color: expert ? 0x5a2c10 : 0x2c3a5a,
      alpha: 0.95,
    });
    g.roundRect(moitie + 3, cy - 18, 104, 36, 18).stroke({
      color: expert ? AMBRE : 0x7fa8e8,
      width: 2,
    });
    this.normal.style.fill = expert ? ATTENUÉ : 0xcfe0f5;
    this.expert.style.fill = expert ? 0xf5d6b0 : ATTENUÉ;
    this.normal.style.fontWeight = expert ? "500" : "700";
    this.expert.style.fontWeight = expert ? "700" : "500";
  }
}

export class PanneauOptions extends Container {
  menu: Menu;
  lignes: LigneOption[];
  largeur: number;

  constructor(opts: { retour: () => void; audio?: any; largeur?: number }) {
    super();
    const largeur = opts.largeur ?? 740;
    this.largeur = largeur;
    const son: Son | null = opts.audio ? (id: string) => opts.audio.sfx(id) : null;
    this.lignes = [
      new LigneSlider("Musique", "volumeMusique", largeur, son),
      new LigneSlider("Effets sonores", "volumeSfx", largeur, son),
      new LigneSlider("Voix et dialogues", "volumeDialogues", largeur, son),
      new LigneBascule("Secousses d'écran", "secousses", largeur, son),
      new LigneBascule("Flashs lumineux", "flashes", largeur, son),
      new LigneBascule("Arrêts sur impact", "hitstop", largeur, son),
      new LigneDifficulte(largeur, son),
    ];
    const boutonRetour = new Bouton("Retour", 460, 64, () => {
      son?.("menu_retour");
      opts.retour();
    });
    this.lignes.forEach((ligne, i) => ligne.position.set(0, i * 68));
    boutonRetour.position.set((largeur - 460) / 2, this.lignes.length * 68 + 10);
    this.menu = new Menu([...this.lignes, boutonRetour]);
    this.menu.retour = () => {
      son?.("menu_retour");
      opts.retour();
    };
    if (son) {
      this.menu.surNavigation = () => son("menu_deplacer");
      this.menu.surValidation = () => son("menu_valider");
    }
    this.addChild(this.menu);
  }

  get hauteur(): number {
    return this.lignes.length * 68 + 10 + 64;
  }

  rafraichir() {
    this.lignes.forEach((ligne) => ligne.dessiner());
  }
}