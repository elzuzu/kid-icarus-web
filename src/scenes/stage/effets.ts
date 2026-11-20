import { Container, Sprite, Graphics, TextStyle, Texture } from "pixi.js";
import { r as Flux, n as largeurEcran, t as hauteurEcran } from "../../core";
import { o as Texte } from "../../render/textures";
import { n as textureHalo } from "../../render/textures";
import { flashesActifs, techart } from "../../render/ambiance";
import { Camp, Element } from "./combat";
import { EtatJoueur } from "./joueur";

const styleChiffre = new TextStyle({
  fontFamily: `"Segoe UI", "Trebuchet MS", sans-serif`,
  fontSize: 30,
  fontWeight: "800",
  fill: 16777215,
  stroke: { color: 1707014, width: 5 },
  align: "center",
  dropShadow: {
    color: 0,
    alpha: 0.6,
    blur: 2,
    distance: 2,
    angle: Math.PI / 2,
  },
});

// Plafonds durs des pools : aucune croissance non bornée en combat prolongé.
const MAX_PARTICULES = 240,
  MAX_POUSSIERES = 64,
  MAX_ANNEAUX = 24,
  MAX_CHIFFRES = 16,
  MAX_ARCS = 8,
  MAX_FOUDRES = 4,
  MAX_ONDES = 6;

// Palette feedback vie/progression — une teinte par nature d'événement.
const COULEURS_ELEMENT: Record<number, number> = {
  [Element.FEU]: 0xff8a3d,
  [Element.GLACE]: 0x7fe7ff,
  [Element.POISON]: 0xa8e05f,
  [Element.FOUDRE]: 0xffe14d,
  [Element.LUMIERE]: 0xfff3b0,
};
const CREME = 0xfff2d8,
  OR = 0xffd24a,
  OR_PALE = 0xfff3b0,
  GRIS_RESISTE = 0xb9b9c2,
  ROUGE_JOUEUR = 0xff5a4a,
  EMERAUDE = 0x3ce88a,
  VIOLET_XP = 0xb98cff;

// Cible écran de la traînée de ramassage : icône cœurs (monnaie) du HUD (hud.ts:216).
const HUD_COEUR_X = 80,
  HUD_COEUR_Y = 140;

// Vignette PV bas : texture blanche bord d'écran générée UNE fois (cache module,
// partagée entre les rechargements de scène — aucune croissance, aucun redraw).
let cacheVignetteRouge: Texture | null = null;
function textureVignetteRouge(): Texture {
  if (cacheVignetteRouge) return cacheVignetteRouge;
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 270;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("canvas 2d indisponible");
  ctx.translate(240, 135);
  ctx.scale(1, 270 / 480);
  const degrade = ctx.createRadialGradient(0, 0, 118, 0, 0, 300);
  degrade.addColorStop(0, "rgba(255,255,255,0)");
  degrade.addColorStop(0.62, "rgba(255,255,255,0.34)");
  degrade.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = degrade;
  ctx.fillRect(-300, -300, 600, 600);
  cacheVignetteRouge = Texture.from(canvas);
  return cacheVignetteRouge;
}

export class EffetsCombat extends Container {
  additif = new Container();
  poussiere = new Container();
  textes = new Container();
  particules: any[] = [];
  poussieres: any[] = [];
  chiffres: any[] = [];
  anneaux: any[] = [];
  foudres: any[] = [];
  arcs: any[] = [];
  ondes: any[] = [];
  joueur: any = null;
  combat: any = null;
  ticCourse = 0;
  flux = new Flux("decor|effets_combat");
  // Suivi vie/progression (lecture seule, zéro nouveau signal requis).
  combattantJoueur: any = null;
  progressionBranchee: any = null;
  profil: any = null;
  branche = false;
  xpPrec = -1;
  niveauPrec = -1;
  niveauRecent = 0;
  pvPrec = -1;
  pvMaxPrec = -1;
  soinAttente = 0;
  ticSoin = 0;
  // Vignette PV bas : sœur du plan (espace écran), insérée juste au-dessus du monde.
  vignette = new Sprite(textureVignetteRouge());
  tempsVignette = 0;
  ampVignette = 0;
  // Interrupteur A/B QA (perf) : coupe la couche feedback vie/progression sans
  // toucher aux effets combat existants. true = comportement nominal.
  modeFeedback = true;

  constructor(combat: any) {
    super();
    this.combat = combat;
    this.additif.blendMode = "add";
    this.addChild(this.poussiere, this.additif, this.textes);
    this.vignette.tint = 0xff2a38;
    this.vignette.scale.set(largeurEcran / 480, hauteurEcran / 270);
    this.vignette.visible = false;
    this.vignette.alpha = 0;
    // Le combattant joueur est enregistré par Simulation avant notre construction ;
    // il survit aux respawns (même instance) → polling PV stable.
    for (let i = 0; i < combat.combattants.length; i++)
      if (combat.combattants[i].camp === Camp.JOUEUR) {
        this.combattantJoueur = combat.combattants[i];
        break;
      }
    combat.coupPorte.connecter((cible: any, coup: any, point: any) => {
      const joueur = cible.camp === Camp.JOUEUR,
        ampleur = coup.critique ? 1.6 : 1;
      this.etincelles(
        point.x,
        point.y,
        joueur ? 16732224 : 16765562,
        Math.round(10 * ampleur),
        260 * ampleur,
        -coup.reculX,
        -coup.reculY,
      );
      this.anneau(point.x, point.y, joueur ? 16736336 : 16773312, coup.critique ? 1.8 : 1.1);
      if (coup.montant > 0)
        this.chiffre(
          point.x,
          point.y - 10,
          coup.montant,
          coup.critique,
          joueur,
          coup.element ?? 0,
          cible.resistances?.[coup.element ?? 0] ?? 0,
        );
      if (coup.source === "eclair") this.foudre(cible.centre().x, cible.centre().y);
    });
    combat.combattantMort.connecter((cible: any) => {
      const c = cible.centre();
      if (cible.camp === Camp.JOUEUR) {
        // Mort du joueur : dissolution ascendante poolée (le respawn est instantané
        // côté sim, le burst visuel porte la lecture de la mort).
        this.dissolution(c.x, c.y, 0x9fd8ff);
        this.anneau(c.x, c.y, 0x9fd8ff, 2.6);
      } else {
        this.etincelles(c.x, c.y, 16747056, 26, 220, 0, -1);
        this.etincelles(c.x, c.y, 10119935, 10, 120, 0, -1);
        this.anneau(c.x, c.y, 16760944, 2.4);
      }
    });
    combat.coupBloque.connecter((_cible: any, point: any) => {
      this.etincelles(point.x, point.y, 11065599, 12, 300, 0, 0);
      this.anneau(point.x, point.y, 12642559, 1.2);
    });
    combat.explosionSignal.connecter((point: any, rayon: number) => {
      this.anneau(point.x, point.y, 16752704, (rayon * 4) / 40);
      this.etincelles(point.x, point.y, 16756816, 30, 360, 0, -0.5);
    });
    combat.projectileFini.connecter((p: any, point: any, mur: boolean) => {
      if (mur)
        this.etincelles(
          point.x,
          point.y,
          p.camp === Camp.JOUEUR ? 16769184 : 16748640,
          6,
          140,
          -p.vx,
          -p.vy,
        );
    });
    // Tics de statut subis (brûlure/poison) : chaque chiffre se voit, teinté.
    combat.joueurBlesse?.connecter((montant: number, source: string) => {
      if (source !== "statut" || !this.combattantJoueur || montant <= 0) return;
      const c = this.combattantJoueur.centre(),
        brulure = this.combattantJoueur.aStatut("brulure");
      this.flotteur(
        c.x + this.flux.randfRange(-8, 8),
        c.y - 14,
        String(montant),
        brulure ? COULEURS_ELEMENT[Element.FEU] : COULEURS_ELEMENT[Element.POISON],
        22,
        "statut",
        0.6,
      );
    });
    techart.effets = this;
  }

  brancherJoueur(joueur: any) {
    this.joueur = joueur;
    joueur.aFrappeVisuel.connecter((combo: number, face: number) => {
      const c = joueur.centre();
      this.arcMelee(c.x + face * 6, c.y, face, combo);
    });
    joueur.aAtterri.connecter(() => this.bouffiere(joueur.x, joueur.y, 0));
    joueur.aDashe.connecter((dir: number) => this.bouffiere(joueur.x, joueur.y, -dir));
  }

  // Câblage progression (ramassage cœurs + suivi xp). Appelé par l'orchestrateur
  // (demande d'intégration) ou auto-branché via __sim.modules (identité vérifiée).
  brancherProgression(progression: any) {
    if (!progression || this.progressionBranchee === progression) return;
    this.progressionBranchee = progression;
    this.profil = progression.profil ?? null;
    progression.recompenses?.ramasse?.connecter((_gain: number, x: number, y: number) =>
      this.ramassage(x, y),
    );
  }

  private brancherAuto() {
    const sim = (window as any).__sim;
    if (!sim || sim.combat !== this.combat) return;
    this.branche = true;
    if (!this.combattantJoueur) this.combattantJoueur = sim.combattant ?? null;
    const modules = sim.modules ?? [];
    for (let i = 0; i < modules.length; i++)
      if (modules[i]?.profil && modules[i]?.recompenses?.ramasse) {
        this.brancherProgression(modules[i]);
        break;
      }
  }

  // Suivi XP/level-up SANS nouveau signal : deltas détectés en interne.
  // Appelé par frame (orchestrateur ou auto via profil) ; idempotent par valeurs.
  suivreXp(xp: number, niveau: number) {
    if (!this.modeFeedback) {
      this.xpPrec = xp;
      this.niveauPrec = niveau;
      return;
    }
    if (this.xpPrec < 0) {
      this.xpPrec = xp;
      this.niveauPrec = niveau;
      return;
    }
    const gain = xp - this.xpPrec;
    if (niveau > this.niveauPrec) {
      const c = this.combattantJoueur?.centre();
      if (c) this.niveauSup(c.x, c.y);
      // Le level-up soigne à fond : pas de popup heal parasite.
      this.niveauRecent = 0.35;
      this.soinAttente = 0;
      this.ticSoin = 0;
    } else if (gain > 0 && this.combattantJoueur) {
      const c = this.combattantJoueur.centre();
      this.gainXp(c.x + this.flux.randfRange(-10, 10), c.y - 20, gain);
    }
    this.xpPrec = xp;
    this.niveauPrec = niveau;
  }

  // Slot libre d'un pool (vie >= duree) ; si plein et plafonné, réécrit le plus
  // vieux. Retourne null seulement quand le pool peut encore grandir.
  private libre(liste: any[], max: number): any | null {
    for (let i = 0; i < liste.length; i++) if (liste[i].vie >= liste[i].duree) return liste[i];
    if (liste.length < max) return null;
    let vieux = liste[0];
    for (let i = 1; i < liste.length; i++) if (liste[i].vie > vieux.vie) vieux = liste[i];
    return vieux;
  }

  arcMelee(x: number, y: number, face: number, combo: number) {
    let arc = this.libre(this.arcs, MAX_ARCS);
    if (!arc) {
      arc = { g: new Graphics(), vie: 0, duree: 0.15, intensite: 1 };
      this.arcs.push(arc);
      this.additif.addChild(arc.g);
    }
    const g = arc.g as Graphics,
      rayon = 1.6 * 16 * 4,
      couleur = 16765562;
    g.clear();
    if (combo === 3) {
      g.circle(0, 0, rayon).stroke({ color: couleur, width: 12, alpha: 0.55 });
      g.circle(0, 0, rayon).stroke({ color: 16774102, width: 4, alpha: 0.9 });
      g.rotation = 0;
    } else {
      g.arc(0, 0, rayon * 0.85, -1.05, 1.05).stroke({ color: couleur, width: 14, alpha: 0.55 });
      g.arc(0, 0, rayon * 0.85, -0.95, 0.95).stroke({ color: 16774102, width: 5, alpha: 0.9 });
      g.rotation = face > 0 ? 0 : Math.PI;
    }
    g.position.set(x * 4, y * 4);
    g.visible = true;
    arc.vie = 0;
    arc.intensite = flashesActifs() ? 1 : 0.6;
  }

  bouffiere(x: number, y: number, biaisX: number) {
    const nombre = 4 + Math.floor(this.flux.randf() * 3);
    for (let i = 0; i < nombre; i++) {
      let part = this.libre(this.poussieres, MAX_POUSSIERES);
      if (!part) {
        const s = new Sprite(textureHalo(32));
        s.anchor.set(0.5);
        this.poussiere.addChild(s);
        part = { s, vx: 0, vy: 0, vie: 0, duree: 0.3 };
        this.poussieres.push(part);
      }
      part.vx = (this.flux.randfRange(-14, 14) + biaisX * 12) * 4;
      part.vy = this.flux.randfRange(-22, -6) * 4;
      part.vie = 0;
      part.duree = 0.3;
      part.s.visible = true;
      part.s.tint = 14277074;
      part.s.position.set(x * 4 + this.flux.randfRange(-12, 12), y * 4 - 2);
      part.s.scale.set(0.16);
      part.s.alpha = 0.4;
    }
  }

  etincelles(x: number, y: number, couleur: number, nombre: number, vitesse: number, dirX: number, dirY: number) {
    const px = x * 4,
      py = y * 4,
      oriente = Math.hypot(dirX, dirY) > 0.01,
      angle = oriente ? Math.atan2(dirY, dirX) : 0;
    for (let i = 0; i < nombre; i++) {
      const a = oriente ? angle + this.flux.randfRange(-1.1, 1.1) : this.flux.randf() * Math.PI * 2,
        v = this.flux.randfRange(0.35, 1) * vitesse * 4 * 0.45;
      let part = this.libre(this.particules, MAX_PARTICULES);
      if (!part) {
        const s = new Sprite(textureHalo(32));
        s.anchor.set(0.5);
        this.additif.addChild(s);
        part = { s, vx: 0, vy: 0, vie: 0, duree: 1, gravite: 0, etire: true, hud: false };
        this.particules.push(part);
      }
      const s = part.s;
      part.vx = Math.cos(a) * v;
      part.vy = Math.sin(a) * v;
      part.vie = 0;
      part.duree = this.flux.randfRange(0.18, 0.45);
      part.gravite = 900;
      part.etire = true;
      part.hud = false;
      s.visible = true;
      s.tint = couleur;
      s.position.set(px, py);
    }
  }

  // Dissolution : particules poolées qui montent et s'éteignent (mort joueur).
  dissolution(x: number, y: number, couleur: number) {
    const px = x * 4,
      py = y * 4;
    for (let i = 0; i < 18; i++) {
      let part = this.libre(this.particules, MAX_PARTICULES);
      if (!part) {
        const s = new Sprite(textureHalo(32));
        s.anchor.set(0.5);
        this.additif.addChild(s);
        part = { s, vx: 0, vy: 0, vie: 0, duree: 1, gravite: 0, etire: true, hud: false };
        this.particules.push(part);
      }
      const a = this.flux.randf() * Math.PI * 2,
        v = this.flux.randfRange(20, 110) * 4;
      part.vx = Math.cos(a) * v * 0.5;
      part.vy = -Math.abs(Math.sin(a) * v) - 60;
      part.vie = 0;
      part.duree = this.flux.randfRange(0.5, 0.9);
      part.gravite = -140;
      part.etire = false;
      part.hud = false;
      part.s.visible = true;
      part.s.tint = i % 3 === 0 ? 0xffffff : couleur;
      part.s.position.set(px + this.flux.randfRange(-16, 16), py + this.flux.randfRange(-24, 8));
      part.s.scale.set(0.16);
    }
  }

  foudre(x: number, y: number) {
    let f = this.libre(this.foudres, MAX_FOUDRES);
    if (!f) {
      f = { g: new Graphics(), vie: 0, duree: 0.3, points: [] as number[] };
      this.foudres.push(f);
      this.additif.addChild(f.g);
    }
    const g = f.g as Graphics,
      px = x * 4,
      py = y * 4,
      points = f.points as number[];
    points.length = 0;
    for (let i = 0; i <= 9; i++) {
      const t = i / 9;
      points.push(px + (i === 9 ? 0 : this.flux.randfRange(-38, 38)), py - 760 * (1 - t));
    }
    g.clear();
    g.poly(points, false).stroke({ color: 7317759, width: 18, alpha: 0.45 });
    g.poly(points, false).stroke({ color: 15923455, width: 5 });
    g.visible = true;
    f.vie = 0;
    this.anneau(x, y, 11063551, 2);
  }

  anneau(x: number, y: number, couleur: number, taille: number, intensite = 1) {
    let an = this.libre(this.anneaux, MAX_ANNEAUX);
    if (!an) {
      const s = new Sprite(textureHalo(128));
      s.anchor.set(0.5);
      this.additif.addChild(s);
      an = { s, vie: 0, duree: 0.22, taille, intensite: 1 };
      this.anneaux.push(an);
    }
    an.vie = 0;
    an.taille = taille;
    // Gate flashes : les pics additifs sont réduits, pas supprimés (lisibilité).
    an.intensite = intensite * (flashesActifs() ? 1 : 0.45);
    an.s.visible = true;
    an.s.tint = couleur;
    an.s.position.set(x * 4, y * 4);
  }

  // Onde expansive (level-up, événements majeurs) : anneau tracé poolé, zéro redraw.
  onde(x: number, y: number, couleur: number, rayon: number) {
    if (!this.modeFeedback) return;
    let o = this.libre(this.ondes, MAX_ONDES);
    if (!o) {
      const g = new Graphics();
      g.circle(0, 0, 16).stroke({ color: 0xffffff, width: 5 });
      this.additif.addChild(g);
      o = { g, vie: 0, duree: 0.45, rayon: 100, intensite: 1 };
      this.ondes.push(o);
    }
    // La couleur est portée par la teinte du Graphics (pas de redrawing par spawn).
    o.g.tint = couleur;
    o.g.position.set(x * 4, y * 4);
    o.g.visible = true;
    o.vie = 0;
    o.rayon = rayon;
    o.intensite = flashesActifs() ? 1 : 0.6;
  }

  // Chiffre de dégât : styling par nature (crème / or critique / élément / résisté).
  chiffre(x: number, y: number, montant: number, critique: boolean, joueur: boolean, element = 0, resistance = 0) {
    const resiste = resistance >= 0.25,
      immunise = resistance >= 0.85;
    let couleur = joueur ? ROUGE_JOUEUR : CREME;
    if (element > 0 && COULEURS_ELEMENT[element] !== undefined) couleur = COULEURS_ELEMENT[element];
    if (critique && !resiste) couleur = element > 0 ? couleur : OR;
    if (resiste) couleur = GRIS_RESISTE;
    const texte = resiste
      ? `${montant}\n${immunise ? "immunisé" : "résisté"}`
      : critique
        ? `${montant}!`
        : String(montant);
    const ch = this.nouveauChiffre(
      x,
      y,
      texte,
      couleur,
      resiste ? 24 : critique ? 46 : joueur ? 32 : 30,
      resiste ? "resiste" : critique ? "critique" : "degat",
      resiste ? 0.7 : critique ? 0.8 : 0.75,
    );
    ch.echelle = critique && !resiste ? 1.25 : 1;
    ch.popDepart = critique && !resiste ? 2 : 1.4;
    // Critique : léger arc (gravité douce) ; le reste monte amorti, sans retombée.
    ch.gravite = critique && !resiste ? 420 : 0;
    ch.vy = critique && !resiste ? -330 : -260;
    ch.vx = this.flux.randfRange(-60, 60) * (critique ? 1.5 : 1);
    ch.t.style.lineHeight = resiste ? 26 : 0;
    ch.t.style.stroke = { color: 1707014, width: resiste ? 4 : 5 };
  }

  // Popup heal : « +N » émeraude montant + étincelles vertes poolées sur le joueur.
  soin(x: number, y: number, montant: number) {
    if (!this.modeFeedback) return;
    const ch = this.nouveauChiffre(x, y, `+${montant}`, EMERAUDE, 30, "soin", 0.8);
    ch.vy = -150;
    ch.vx = this.flux.randfRange(-16, 16);
    this.etincelles(x, y + 8, EMERAUDE, 6, 120, 0, -1);
  }

  // Floater XP : discret, violet, montant — chaque gain se voit sans saturer.
  gainXp(x: number, y: number, montant: number) {
    if (!this.modeFeedback) return;
    const ch = this.nouveauChiffre(x, y, `+${montant} xp`, VIOLET_XP, 22, "xp", 0.8);
    ch.vy = -115;
    ch.vx = this.flux.randfRange(-10, 10);
    ch.alphaMax = 0.85;
    ch.t.style.stroke = { color: 1707014, width: 4 };
  }

  // Level-up : burst anneaux + étincelles dorées + flash court (gaté) + onde.
  niveauSup(x: number, y: number) {
    if (!this.modeFeedback) return;
    this.onde(x, y, OR, 120);
    this.anneau(x, y, OR, 2.2, 1);
    this.anneau(x, y, OR_PALE, 3.4, 0.8);
    this.etincelles(x, y, OR, 22, 240, 0, -1);
    this.etincelles(x, y, OR_PALE, 8, 140, 0, -1);
    if (flashesActifs()) this.anneau(x, y, 0xffffff, 4.5, 0.9);
  }

  // Ramassage cœurs : micro-étincelle dorée + traînée vers le HUD (≤6 particules).
  ramassage(x: number, y: number) {
    if (!this.modeFeedback) return;
    this.etincelles(x, y, OR, 3, 130, 0, -1);
    const px = x * 4,
      py = y * 4;
    for (let i = 0; i < 3; i++) {
      let part = this.libre(this.particules, MAX_PARTICULES);
      if (!part) {
        const s = new Sprite(textureHalo(32));
        s.anchor.set(0.5);
        this.additif.addChild(s);
        part = { s, vx: 0, vy: 0, vie: 0, duree: 1, gravite: 0, etire: true, hud: false };
        this.particules.push(part);
      }
      part.vx = this.flux.randfRange(-60, 60);
      part.vy = this.flux.randfRange(-160, -80);
      part.vie = 0;
      part.duree = 0.55;
      part.gravite = 0;
      part.etire = false;
      part.hud = true;
      part.s.visible = true;
      part.s.tint = i === 0 ? OR_PALE : OR;
      part.s.position.set(px + this.flux.randfRange(-8, 8), py + this.flux.randfRange(-8, 8));
      part.s.scale.set(0.14);
    }
  }

  private nouveauChiffre(
    x: number,
    y: number,
    texte: string,
    couleur: number,
    taille: number,
    genre: string,
    duree: number,
  ): any {
    let ch = this.libre(this.chiffres, MAX_CHIFFRES);
    if (!ch) {
      const t = new Texte({ text: "", style: styleChiffre.clone() });
      t.anchor.set(0.5);
      this.textes.addChild(t);
      ch = {
        t,
        vx: 0,
        vy: 0,
        vie: 0,
        duree: 0.75,
        echelle: 1,
        popDepart: 1.4,
        gravite: 0,
        genre: "degat",
        alphaMax: 1,
      };
      this.chiffres.push(ch);
    }
    ch.t.text = texte;
    ch.t.style.fill = couleur;
    ch.t.style.fontSize = taille;
    ch.t.style.lineHeight = 0;
    ch.t.style.stroke = { color: 1707014, width: 5 };
    ch.genre = genre;
    ch.duree = duree;
    ch.echelle = 1;
    ch.popDepart = 1.4;
    ch.gravite = 0;
    ch.alphaMax = 1;
    ch.t.scale.set(ch.popDepart);
    ch.t.visible = true;
    const px = x * 4,
      py = y * 4;
    // Anti-chevauchement : décale les popups voisins encore jeunes.
    let voisins = 0;
    for (let i = 0; i < this.chiffres.length; i++) {
      const c = this.chiffres[i];
      if (
        c !== ch &&
        c.vie < c.duree * 0.6 &&
        Math.abs(c.t.x - px) < 90 &&
        c.t.y < py + 40 &&
        c.t.y > py - 200
      )
        voisins++;
    }
    ch.t.position.set(px + (voisins % 2 ? 26 : -26) * Math.min(1, voisins), py - voisins * 34);
    ch.vx = this.flux.randfRange(-40, 40);
    ch.vy = -200;
    ch.vie = 0;
    return ch;
  }

  // Floater générique (tics de statut, petits événements).
  private flotteur(
    x: number,
    y: number,
    texte: string,
    couleur: number,
    taille: number,
    genre: string,
    duree: number,
  ) {
    if (!this.modeFeedback) return;
    const ch = this.nouveauChiffre(x, y, texte, couleur, taille, genre, duree);
    ch.vy = -140;
    ch.alphaMax = 0.9;
    ch.t.style.stroke = { color: 1707014, width: 4 };
  }

  // Inspection QA : comptes actifs + tailles bornées + état du suivi vie/xp.
  compterActifs() {
    const compter = (liste: any[]) => {
      let n = 0;
      for (let i = 0; i < liste.length; i++) if (liste[i].vie < liste[i].duree) n++;
      return n;
    };
    const tailles = {
      particules: this.particules.length,
      poussieres: this.poussieres.length,
      anneaux: this.anneaux.length,
      chiffres: this.chiffres.length,
      arcs: this.arcs.length,
      foudres: this.foudres.length,
      ondes: this.ondes.length,
    };
    return {
      particules: compter(this.particules),
      poussieres: compter(this.poussieres),
      anneaux: compter(this.anneaux),
      chiffres: compter(this.chiffres),
      arcs: compter(this.arcs),
      foudres: compter(this.foudres),
      ondes: compter(this.ondes),
      tailles,
      plafonds: {
        particules: MAX_PARTICULES,
        poussieres: MAX_POUSSIERES,
        anneaux: MAX_ANNEAUX,
        chiffres: MAX_CHIFFRES,
        arcs: MAX_ARCS,
        foudres: MAX_FOUDRES,
        ondes: MAX_ONDES,
      },
      poolsOK:
        tailles.particules <= MAX_PARTICULES &&
        tailles.poussieres <= MAX_POUSSIERES &&
        tailles.anneaux <= MAX_ANNEAUX &&
        tailles.chiffres <= MAX_CHIFFRES &&
        tailles.arcs <= MAX_ARCS &&
        tailles.foudres <= MAX_FOUDRES &&
        tailles.ondes <= MAX_ONDES,
      vignetteAlpha: +this.vignette.alpha.toFixed(3),
      suivi: {
        xp: this.xpPrec,
        niveau: this.niveauPrec,
        soinAttente: this.soinAttente,
        branche: this.branche,
      },
    };
  }

  private majVignette(dt: number) {
    this.tempsVignette += dt;
    const c = this.combattantJoueur,
      bas = !!c && c.vivant && c.pvMax > 0 && c.pv / c.pvMax <= 0.25;
    this.ampVignette += ((bas ? 1 : 0) - this.ampVignette) * Math.min(1, dt * 4);
    if (this.ampVignette < 0.01) {
      this.vignette.visible = false;
      return;
    }
    // Espace écran : sœur du plan, insérée juste au-dessus (sous le HUD, jamais
    // au-dessus du gameplay). Ré-insérée seulement si le parent change (reload).
    const plan = this.parent,
      racine = plan?.parent;
    if (racine && this.vignette.parent !== racine) {
      if (!this.vignette.destroyed)
        racine.addChildAt(this.vignette, racine.getChildIndex(plan) + 1);
    }
    this.vignette.visible = true;
    // Pouls ~1.2 Hz, amplitude ≤0.15 ; flashes OFF → voile statique discret.
    this.vignette.alpha = flashesActifs()
      ? this.ampVignette * (0.085 + 0.065 * (0.5 + 0.5 * Math.sin(this.tempsVignette * 7.5398)))
      : this.ampVignette * 0.05;
  }

  private majSuivi(dt: number) {
    if (!this.modeFeedback) {
      // A/B OFF : aucun suivi, aucune écoute progression, baselines purgées pour
      // qu'un retour ON ne déclenche pas de delta fantôme.
      this.pvPrec = -1;
      this.xpPrec = -1;
      this.soinAttente = 0;
      this.ticSoin = 0;
      this.ampVignette = 0;
      this.vignette.visible = false;
      return;
    }
    if (!this.branche) this.brancherAuto();
    if (this.profil) this.suivreXp(this.profil.xp, this.profil.niveau);
    this.niveauRecent = Math.max(0, this.niveauRecent - dt);
    const c = this.combattantJoueur;
    if (!c) return;
    const pv = c.pv,
      pvMax = c.pvMax;
    // Heal sans signal : delta PV positif hors respawn (pvPrec>0), hors changement
    // de pvMax (progression) et hors fenêtre level-up. Accumulation 0.3 s : la
    // régénération continue (source chaude) ne spamme pas un popup par tick.
    if (
      this.pvPrec >= 0 &&
      pv > this.pvPrec &&
      c.vivant &&
      this.pvPrec > 0 &&
      pvMax === this.pvMaxPrec &&
      this.niveauRecent <= 0
    ) {
      this.soinAttente += pv - this.pvPrec;
      this.ticSoin = 0.3;
    }
    this.pvPrec = pv;
    this.pvMaxPrec = pvMax;
    if (this.ticSoin > 0) {
      this.ticSoin -= dt;
      if (this.ticSoin <= 0 && this.soinAttente > 0) {
        const ctr = c.centre();
        this.soin(ctr.x, ctr.y - 12, this.soinAttente);
        this.soinAttente = 0;
      }
    }
  }

  mettreAJour(dt: number) {
    this.majSuivi(dt);
    this.majVignette(dt);
    if (this.joueur) {
      const j = this.joueur;
      this.ticCourse -= dt;
      if (j.corps.auSol && j.etat === EtatJoueur.SOL && Math.abs(j.corps.vx) > 4) {
        if (this.ticCourse <= 0) {
          this.ticCourse = 0.18;
          this.bouffiere(j.x, j.y, -Math.sign(j.corps.vx));
        }
      } else this.ticCourse = 0;
    }
    // Boucles indexées, pools fixes : ni spread, ni splice, ni destroy par frame.
    for (let i = 0; i < this.arcs.length; i++) {
      const a = this.arcs[i];
      if (a.vie >= a.duree) continue;
      a.vie += dt;
      const t = Math.min(1, a.vie / a.duree);
      a.g.scale.set(0.8 + 0.35 * t);
      a.g.alpha = (1 - t) * a.intensite;
      if (a.vie >= a.duree) a.g.visible = false;
    }
    for (let i = 0; i < this.ondes.length; i++) {
      const o = this.ondes[i];
      if (o.vie >= o.duree) continue;
      o.vie += dt;
      const t = Math.min(1, o.vie / o.duree),
        ease = 1 - (1 - t) * (1 - t);
      o.g.scale.set((o.rayon / 16) * (0.15 + 0.85 * ease));
      o.g.alpha = (1 - t) * 0.9 * o.intensite;
      if (o.vie >= o.duree) o.g.visible = false;
    }
    for (let i = 0; i < this.poussieres.length; i++) {
      const p = this.poussieres[i];
      if (p.vie >= p.duree) continue;
      p.vie += dt;
      if (p.vie >= p.duree) {
        p.s.visible = false;
        continue;
      }
      p.vx *= 1 - dt * 3;
      p.vy *= 1 - dt * 3;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      const reste = 1 - p.vie / p.duree;
      p.s.alpha = 0.4 * reste;
      p.s.scale.set(0.16 + 0.22 * (1 - reste));
    }
    const ampFoudre = flashesActifs() ? 1 : 0.5;
    for (let i = 0; i < this.foudres.length; i++) {
      const f = this.foudres[i];
      if (f.vie >= f.duree) continue;
      f.vie += dt;
      f.g.alpha = Math.max(0, 1 - f.vie / f.duree) * (Math.floor(f.vie * 40) % 2 ? 0.6 : 1) * ampFoudre;
      if (f.vie >= f.duree) f.g.visible = false;
    }
    const plan = this.parent;
    for (let i = 0; i < this.particules.length; i++) {
      const p = this.particules[i];
      if (p.vie >= p.duree) continue;
      p.vie += dt;
      if (p.vie >= p.duree) {
        p.s.visible = false;
        continue;
      }
      if (p.hud && plan) {
        // Traînée de ramassage : guidage vers l'icône cœurs du HUD (espace écran
        // reconverti chaque frame — la caméra bouge, la cible reste le HUD).
        const tx = HUD_COEUR_X - plan.x,
          ty = HUD_COEUR_Y - plan.y,
          dx = tx - p.s.x,
          dy = ty - p.s.y,
          dist = Math.hypot(dx, dy);
        if (dist < 26) {
          p.vie = p.duree;
          p.s.visible = false;
          continue;
        }
        p.vx += (dx / dist) * 2600 * dt;
        p.vy += (dy / dist) * 2600 * dt;
        p.vx *= 1 - dt * 2.2;
        p.vy *= 1 - dt * 2.2;
        p.s.x += p.vx * dt;
        p.s.y += p.vy * dt;
        const reste = 1 - p.vie / p.duree;
        p.s.alpha = Math.min(1, reste * 1.6);
        p.s.scale.set(0.1 + 0.08 * reste);
        continue;
      }
      p.vx *= 1 - dt * 4;
      p.vy = p.vy * (1 - dt * 4) + p.gravite * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      const reste = 1 - p.vie / p.duree;
      p.s.alpha = reste;
      if (p.etire) {
        p.s.rotation = Math.atan2(p.vy, p.vx);
        p.s.scale.set(0.25 + Math.hypot(p.vx, p.vy) / 900, 0.08 + 0.1 * reste);
      } else {
        p.s.scale.set(0.16 + 0.14 * (1 - reste));
      }
    }
    for (let i = 0; i < this.anneaux.length; i++) {
      const a = this.anneaux[i];
      if (a.vie >= a.duree) continue;
      a.vie += dt;
      const t = Math.min(1, a.vie / a.duree);
      a.s.scale.set(a.taille * (0.4 + 1.4 * t));
      a.s.alpha = (1 - t) * a.intensite;
      if (a.vie >= a.duree) a.s.visible = false;
    }
    for (let i = 0; i < this.chiffres.length; i++) {
      const c = this.chiffres[i];
      if (c.vie >= c.duree) continue;
      c.vie += dt;
      // Montée amortie (dégâts/heal/xp) ou léger arc (critique).
      if (c.gravite > 0) c.vy += c.gravite * dt;
      else c.vy *= 1 - dt * 3.2;
      c.vx *= 1 - dt * 2;
      c.t.x += c.vx * dt;
      c.t.y += c.vy * dt;
      const t = c.vie / c.duree,
        pop = Math.min(1, c.vie / 0.12),
        easeOut = 1 - (1 - pop) * (1 - pop),
        base = c.genre === "critique" ? 1.12 : 1;
      c.t.scale.set((base + (c.popDepart - base) * (1 - easeOut)) * (c.echelle ?? 1));
      c.t.alpha = (t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35) * (c.alphaMax ?? 1);
      if (c.vie >= c.duree) c.t.visible = false;
    }
  }

  destroy(options?: any) {
    // La vignette est une sœur du plan (espace écran) — nettoyage explicite.
    if (!this.vignette.destroyed) this.vignette.destroy();
    super.destroy(options);
  }
}