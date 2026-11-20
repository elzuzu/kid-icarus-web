import { O as Signal, w as Intention } from "../../app";
import { r as Flux } from "../../core";
import { a as Tuile } from "../../ui/hud";
import { PhysiqueJoueur, EtatJoueur } from "./joueur";
import { Camera, ModeCamera } from "./camera";
import { Combat, Combattant, Camp, Coup } from "./combat";
import { ArmeJoueur } from "./arme";
import { ElementsStage } from "./elements";
import { Apparitions } from "./apparitions";
import { Boss } from "./boss";

const degatsChuteRatio = 0.2,
  margeChuteTuiles = 1,
  soinFlaconRatio = 0.5,
  rayonCheckpointTuiles = 2.5,
  dureeMortTicks = 150,
  dureeVictoireTicks = 200;

export class Simulation {
  niveau: any;
  graine: string;
  joueur: PhysiqueJoueur;
  camera: Camera;
  combat: Combat;
  combattant: Combattant;
  arme: ArmeJoueur;
  elements: ElementsStage;
  apparitions: Apparitions | null = null;
  boss: Boss | null = null;
  bossVaincu = false;
  multBoss = { pv: 1, degats: 1 };
  defBoss: any = null;
  victoireTicks = -1;
  flacons = 1;
  flaconsMax = 1;
  intensite = 0;
  plumeDisponible = false;
  chutes = 0;
  morts = 0;
  temps = 0;
  fini = false;
  invisible = false;
  dernierSolSur = { x: 0, y: 0 };
  reprise = { x: 0, y: 0 };
  checkpointsTouches = new Set<number>();
  modules: any[] = [];
  enChambre = false;
  mortTicks = -1;
  solDepartY = 0;
  graceBoss = 0;
  aChute = new Signal();
  checkpointTouche = new Signal();
  termine = new Signal();
  joueurMort = new Signal();
  reapparu = new Signal();
  bossApparu = new Signal();
  bossVaincuSignal = new Signal();

  constructor(niveau: any, reglages: any, graine = "partie") {
    this.niveau = niveau;
    this.graine = graine;
    const joueur = new PhysiqueJoueur(reglages, niveau);
    this.joueur = joueur;
    joueur.placerSurTuile(niveau.depart.c, niveau.depart.l);
    this.dernierSolSur = { x: joueur.x, y: joueur.y };
    this.reprise = { ...this.dernierSolSur };
    this.solDepartY = joueur.y;
    this.camera = new Camera(niveau, {
      get face() {
        return joueur.face;
      },
      centre: () => joueur.centre(),
      hauteurCorps: reglages.hauteur,
    });
    this.camera.solReference = () => this.dernierSolSur.y;
    const mode =
      niveau.type === "vertical"
        ? ModeCamera.RAIL
        : niveau.type === "forteresse"
          ? ModeCamera.SALLE
          : niveau.type === "shmup"
            ? ModeCamera.DEFILEMENT
            : ModeCamera.SUIVI;
    this.camera.salleAuto = mode === ModeCamera.SALLE;
    this.camera.configurer(mode);
    this.combat = new Combat(niveau, graine);
    this.combattant = new Combattant(
      {
        get x() {
          return joueur.x;
        },
        get y() {
          return joueur.y;
        },
        get face() {
          return joueur.face;
        },
      },
      Camp.JOUEUR,
      100,
      "pit",
    );
    this.combattant.proprietaire = joueur;
    this.combattant.bouclier = () => joueur.invulnerable > 0 || this.graceBoss > 0;
    this.combattant.touche.connecter((coup: any) => {
      joueur.recevoirCoup(coup.reculX);
      this.camera.secouer(0.35);
    });
    this.combattant.mort.connecter(() => this.mourir());
    this.combat.enregistrer(this.combattant);
    this.arme = new ArmeJoueur(joueur, this.combattant, this.combat, graine, niveau.id);
    this.elements = new ElementsStage(this);
    this.modules.push(this.elements);
  }

  get pv(): number {
    return this.combattant.pv;
  }

  get pvMax(): number {
    return this.combattant.pvMax;
  }

  cible() {
    const self = this;
    return {
      get x() {
        return self.joueur.x;
      },
      get y() {
        return self.joueur.y;
      },
      centre: () => self.joueur.centre(),
      get vivant() {
        return self.combattant.vivant;
      },
      get invisible() {
        return self.invisible;
      },
    };
  }

  activerEnnemis(defs: Map<string, any>, fabrique: any): Apparitions {
    this.apparitions = new Apparitions(
      this.niveau,
      this.combat,
      this.cible(),
      this.camera,
      defs,
      fabrique,
      this.graine,
    );
    return this.apparitions;
  }

  activerBoss(def: any) {
    this.defBoss = def;
  }

  tick(intention: any, dt = 1 / 60) {
    if (this.fini) return;
    this.temps += dt;
    this.graceBoss = Math.max(0, this.graceBoss - dt);
    const joueur = this.joueur;
    if (this.mortTicks >= 0) {
      this.mortTicks += 1;
      this.camera.pas(dt);
      if (this.mortTicks >= dureeMortTicks) this.reapparaitre();
      return;
    }
    joueur.intention = this.combattant.vivant ? intention : new Intention();
    joueur.aubergine = this.combattant.aStatut("aubergine");
    if (intention.soinPresse && this.flacons > 0 && this.pv < this.pvMax) {
      --this.flacons;
      this.combattant.soigner(Math.round(this.pvMax * soinFlaconRatio));
    }
    if (!this.combat.estGele()) {
      joueur.simuler(dt);
      this.apparitions?.pas(dt);
      this.boss?.pas(dt);
      this.arme.pas(dt);
    }
    for (const module of this.modules) module.pas(intention, dt);
    this.combat.pas(dt);
    this.camera.pas(dt);
    if (this.enChambre) return;
    const bas =
      this.camera.mode === ModeCamera.RAIL
        ? this.camera.basVisible()
        : this.niveau.hauteurPx();
    if (
      joueur.corps.auSol &&
      joueur.etat === EtatJoueur.SOL &&
      joueur.y < bas - 32 &&
      this.appuiComplet(joueur.x, joueur.y)
    )
      this.dernierSolSur = { x: joueur.x, y: joueur.y };
    this.verifierCheckpoints();
    this.verifierArrivee();
    this.verifierBoss();
    joueur.traverseeInterdite = !!this.boss;
    if (this.boss && !this.bossVaincu && this.niveau.type === "horizontal")
      this.bornerArene();
    if (this.victoireTicks >= 0 && ++this.victoireTicks > dureeVictoireTicks) {
      this.victoireTicks = -1;
      this.terminer();
    }
    if (this.estTombe()) this.chute();
  }

  appuiComplet(x: number, y: number): boolean {
    const demi = this.joueur.reglages.largeur / 2 + 2;
    for (const dx of [-demi, 0, demi]) {
      const col = Math.floor((x + dx) / 16),
        ligne = Math.floor((y + 3) / 16);
      if (!this.niveau.estAppui(col, ligne) || this.niveau.tuile(col, ligne) === Tuile.FRIABLE)
        return false;
    }
    return true;
  }

  feuVisible(): boolean {
    return (
      this.camera.mode === ModeCamera.RAIL &&
      !this.enChambre &&
      !this.boss &&
      this.camera.basVisible() < this.solDepartY - 1
    );
  }

  sousLArene(): boolean {
    const boss = this.niveau.boss;
    return this.niveau.type === "vertical" && !!this.boss && this.joueur.y > (boss.l + 9) * 16;
  }

  estTombe(): boolean {
    const marge = margeChuteTuiles * 16,
      haut = this.joueur.y - this.joueur.corps.hauteur;
    return (this.feuVisible() && this.joueur.y > this.camera.basVisible() - 12) ||
      this.sousLArene() ||
      (this.camera.mode === ModeCamera.RAIL && haut > this.camera.basVisible() + marge)
      ? true
      : haut > this.niveau.hauteurPx() + marge;
  }

  chute() {
    this.chutes += 1;
    let degats = 0;
    if (this.plumeDisponible) this.plumeDisponible = false;
    else if (this.intensite >= 6) {
      this.combattant.pv = 0;
      this.combattant.vivant = false;
      this.mourir();
      return;
    } else {
      degats = Math.max(1, Math.round(this.pvMax * degatsChuteRatio));
      this.combattant.pv = Math.max(1, this.combattant.pv - degats);
      this.combat.joueurBlesse.emettre(degats, "chute");
    }
    this.replacer(this.boss ? this.pointDeReprise() : this.dernierSolSur);
    this.joueur.invulnerable = 1;
    this.aChute.emettre(degats);
  }

  replacer(point: { x: number; y: number }) {
    const corps = this.joueur.corps;
    corps.x = point.x;
    corps.y = point.y;
    corps.vx = corps.vy = 0;
    this.camera.recaler();
  }

  mourir() {
    if (this.mortTicks >= 0) return;
    this.morts += 1;
    this.mortTicks = 0;
    this.joueurMort.emettre();
  }

  reapparaitre() {
    this.mortTicks = -1;
    this.combattant.vivant = true;
    this.combattant.pv = this.combattant.pvMax;
    this.combattant.statuts.clear();
    this.flacons = this.flaconsMax;
    this.apparitions?.vider();
    this.combat.viderProjectiles(Camp.ENNEMI);
    const point = this.pointDeReprise();
    this.dernierSolSur = { ...point };
    this.replacer(point);
    this.joueur.invulnerable = 1.5;
    this.reapparu.emettre();
  }

  pointDeReprise(): { x: number; y: number } {
    const base = this.reprise,
      boss = this.boss && !this.bossVaincu ? this.boss : null,
      largeur = this.niveau.largeurPx(),
      distanceBoss = (x: number) => {
        if (!boss) return Infinity;
        const d = x - boss.x;
        return Math.abs(this.niveau.boucle ? ((((d + largeur / 2) % largeur) + largeur) % largeur) - largeur / 2 : d);
      },
      ligne = Math.floor((base.y - 1) / 16),
      emplacementLibre = (x: number) => {
        const col = Math.floor(x / 16);
        return (
          !this.niveau.estBloquant(col, ligne) &&
          !this.niveau.estBloquant(col, ligne - 1) &&
          this.niveau.estAppui(col, ligne + 1)
        );
      };
    for (const decalage of [1.25, -1.25, 3, -3, 5, -5, 7, -7, 9, -9]) {
      let x = base.x + decalage * 16;
      if (this.niveau.boucle) x = ((x % largeur) + largeur) % largeur;
      if (emplacementLibre(x) && distanceBoss(x) >= 80) return { x, y: base.y };
    }
    return { ...base };
  }

  activerCheckpointArene() {
    const boss = this.niveau.boss;
    this.niveau.checkpoints.forEach((marqueur: any, index: number) => {
      if (this.checkpointsTouches.has(index) || Math.abs(marqueur.l - boss.l) > 8) return;
      this.checkpointsTouches.add(index);
      this.reprise = { x: (marqueur.c + 0.5) * 16, y: (marqueur.l + 1) * 16 };
      this.checkpointTouche.emettre(index);
    });
  }

  verifierCheckpoints() {
    const centre = this.joueur.centre();
    this.niveau.checkpoints.forEach((marqueur: any, index: number) => {
      if (this.checkpointsTouches.has(index)) return;
      const dx = (marqueur.c + 0.5) * 16 - centre.x,
        dy = (marqueur.l + 0.5) * 16 - centre.y;
      if (Math.hypot(dx, dy) > rayonCheckpointTuiles * 16) return;
      this.checkpointsTouches.add(index);
      this.reprise = { x: (marqueur.c + 0.5) * 16, y: (marqueur.l + 1) * 16 };
      this.flacons = this.flaconsMax;
      this.checkpointTouche.emettre(index);
    });
  }

  verifierBoss() {
    const def = this.defBoss,
      marqueur = this.niveau.boss;
    if (this.boss || this.bossVaincu || !def || marqueur.c < 0) return;
    const centre = this.joueur.centre(),
      tuileJoueur = { c: Math.floor(centre.x / 16), l: Math.floor(centre.y / 16) };
    if (this.niveau.type === "forteresse") {
      const salleJoueur = this.niveau.salleDe(tuileJoueur),
        salleBoss = this.niveau.salleDe(marqueur);
      if (salleJoueur.c !== salleBoss.c || salleJoueur.l !== salleBoss.l) return;
    } else if (this.niveau.type === "horizontal") {
      if (tuileJoueur.c < marqueur.c - 9) return;
    } else if (this.niveau.type === "shmup") {
      if (this.camera.cx < marqueur.c * 16) return;
    } else if (!this.joueur.corps.auSol || this.joueur.y > (marqueur.l + 7) * 16 + 0.5) return;
    // Courbe PV boss sous intensité : les trash suivent multPvIntensite
    // (×2.92 à i12), mais un boss ×2.92 devient une éponge (Medusa i12 :
    // ~8 min mesurées). On atténue la part intensity des PV boss à 45 %
    // (i12 → ×1.86) ; les dégâts boss restent ×2.32 plein pot : le combat
    // reste exigeant par la pression, pas par la durée.
    const pvBoss = 1 + (this.multBoss.pv - 1) * 0.45;
    const boss = new Boss(
      def,
      this.combat,
      this.niveau,
      this.cible(),
      new Flux(`${this.graine}|boss|${this.niveau.id}`),
      pvBoss,
      this.multBoss.degats,
    );
    boss.placer((marqueur.c + 0.5) * 16, (marqueur.l + 1) * 16);
    this.combat.enregistrer(boss.combattant);
    boss.demarrer();
    boss.invocation.connecter((id: string, x: number, y: number) => {
      this.apparitions?.creer(id, x, y);
    });
    boss.ventDemande.connecter((vent: number) => {
      this.joueur.vent = vent;
    });
    boss.aDisparu.connecter(() => this.combat.retirer(boss.combattant));
    boss.tue.connecter(() => {
      for (const ennemi of [...(this.apparitions?.vivants ?? [])])
        if (ennemi.combattant.vivant)
          ennemi.combattant.recevoir(Coup.simple(ennemi.combattant.pv + 1, "victoire"));
      this.bossVaincu = true;
      this.joueur.vent = 0;
      this.victoireTicks = 0;
      this.bossVaincuSignal.emettre(boss);
    });
    this.boss = boss;
    this.graceBoss = 1.6;
    if (this.niveau.type === "vertical") this.activerCheckpointArene();
    const x = marqueur.c * 16,
      y = marqueur.l * 16;
    if (this.niveau.type === "shmup") this.camera.cadrerArene(this.camera.cx, this.camera.cy, true);
    else if (this.niveau.type === "horizontal") this.camera.cadrerArene(x, y + 40, true);
    else this.camera.cadrerArene(x, y + 24);
    this.bossApparu.emettre(boss);
  }

  bornerArene() {
    const demi = Camera.demi().x,
      centre = this.camera.pointFixeX,
      borner = (corps: any, marge: number) => {
        const x = Math.min(Math.max(corps.x, centre - demi + marge), centre + demi - marge);
        if (x !== corps.x) {
          corps.x = x;
          corps.vx = 0;
        }
      };
    borner(this.joueur.corps, 9.6);
    if (this.boss) borner(this.boss.corps, 25.6);
  }

  terminer() {
    if (this.fini) return;
    this.fini = true;
    this.termine.emettre();
  }

  verifierArrivee() {
    const centre = this.joueur.centre();
    for (const arrivee of this.niveau.arrivees)
      if (
        Math.abs((arrivee.c + 0.5) * 16 - centre.x) < 16 &&
        Math.abs((arrivee.l + 0.5) * 16 - centre.y) < 24
      ) {
        this.terminer();
        return;
      }
  }
}