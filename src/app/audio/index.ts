import { r as Flux } from "../../core";
import { options } from "../options";
import { AMBIANCE_PAR_PISTE, LecteurAmbiances } from "./ambiances";
import { BusAudio, ChargeurAudio, VOLUMES_DEFAUT } from "./base";
import { FileDialogues, LecteurDialogues } from "./dialogues";
import { gainRythme, LecteurMusique } from "./musique";
import { LecteurSfx } from "./sfx";

const INTERVALLE_DIALOGUES = 50;

export class Audio {
  contenu: any;
  options: any;
  dialogues: FileDialogues;
  sousTitre: any;
  sousTitreFini: any;
  ctx: AudioContext | null = null;
  bus: BusAudio | null = null;
  lecteurMusique: LecteurMusique | null = null;
  lecteurSfx: LecteurSfx | null = null;
  lecteurDialogues: LecteurDialogues | null = null;
  lecteurAmbiances: LecteurAmbiances | null = null;
  minuterie: any = null;
  reglages: any;
  enPause = false;
  musiqueDemandee: any = null;
  couchesDemandees = new Map<string, number>();
  ecouteDemandee: any = null;
  ambianceDemandee: string | null = null;

  constructor(contenu: any, options: any = {}) {
    this.contenu = contenu;
    this.options = options;
    this.reglages = { ...VOLUMES_DEFAUT, ...options.reglages };
    this.dialogues = new FileDialogues(
      contenu.liste("dialogues"),
      contenu.voix,
      new Flux("audio|dialogues"),
      options.vues ?? [],
    );
    this.sousTitre = this.dialogues.commencee;
    this.sousTitreFini = this.dialogues.finie;
  }

  get demarre() {
    return this.ctx !== null;
  }

  get pisteCourante() {
    return this.lecteurMusique?.pisteCourante ?? this.musiqueDemandee?.id ?? "";
  }

  get volumes() {
    return this.reglages;
  }

  // Objet options partagé (src/app/options.ts) : ui y mute volumeMusique/volumeSfx/volumeDialogues,
  // audio les relit à 20 Hz. Exposé aussi pour les assertions de playtest.
  get optionsPartagees() {
    return options;
  }

  async demarrer() {
    if (!this.ctx) {
      if (typeof AudioContext === "undefined") {
        console.warn("Web Audio indisponible : le jeu sera muet");
        return;
      }
      let ctx = new AudioContext({ latencyHint: "interactive" }),
        base = this.options.base ?? "/",
        chargeur = new ChargeurAudio(ctx),
        bus = new BusAudio(ctx, this.reglages);
      this.ctx = ctx;
      this.bus = bus;
      this.lecteurMusique = new LecteurMusique(
        ctx,
        bus.entrees.musique,
        chargeur,
        this.contenu.table("musiques"),
        base,
      );
      this.lecteurSfx = new LecteurSfx(
        ctx,
        { SFX: bus.entrees.sfx, Interface: bus.entrees.interface },
        chargeur,
        this.contenu.liste("sons"),
        new Flux("audio|sfx"),
        base,
      );
      this.lecteurDialogues = new LecteurDialogues(
        ctx,
        bus.entrees.voix,
        chargeur,
        this.dialogues,
        base,
        (active) => bus.attenuerMusique(active),
      );
      this.lecteurAmbiances = new LecteurAmbiances(ctx, bus.entrees.sfx, chargeur, base);
      this.lecteurSfx.regles.ecoute = this.ecouteDemandee;
      for (let [couche, cible] of this.couchesDemandees)
        this.lecteurMusique.couche(couche, cible, 0);
      if (this.musiqueDemandee)
        this.lecteurMusique.jouer(this.musiqueDemandee.id, {
          ...this.musiqueDemandee.options,
          fondu: 0.3,
        });
      if (this.ambianceDemandee) this.lecteurAmbiances.jouer(this.ambianceDemandee);
      this.lecteurDialogues.prechargerFile();
      this.minuterie = setInterval(() => {
        this.lecteurDialogues?.mettreAJour();
        this.bus?.mettreAJour();
        this.lireOptions();
      }, INTERVALLE_DIALOGUES);
      this.lecteurSfx.precharger();
      this.lireOptions();
      // Sonde de playtest : état du graphe audio observable sans écoute (evals __audio).
      (window as any).__audio = this;
    }
    if (this.ctx.state === "suspended" && !this.enPause) await this.ctx.resume();
  }

  musique(id: string, options: any = {}) {
    if (this.lecteurMusique) this.lecteurMusique.jouer(id, options);
    else this.musiqueDemandee = { id, options };
    // L'ambiance suit la piste : stage -> famille du monde, boss/épreuve -> garde,
    // menus/résultats (piste sans entrée) -> fondu sortie. Aucun redémarrage si identique.
    let famille = AMBIANCE_PAR_PISTE[id];
    if (famille !== "garde") this.ambiance(famille ?? null);
  }

  ambiance(famille: string | null) {
    if (this.lecteurAmbiances) {
      if (famille) this.lecteurAmbiances.jouer(famille);
      else this.lecteurAmbiances.arreter();
    } else this.ambianceDemandee = famille;
  }

  musiqueConnue(id: string) {
    return this.contenu.table("musiques").has(id);
  }

  // Ducking événementiel ~3 dB (mort joueur, explosion de boss), retour rampé.
  duck(maintien = 1.2) {
    this.bus?.duckEvenement(maintien);
  }

  arreterMusique(fondu?: number) {
    if (this.lecteurMusique) this.lecteurMusique.arreter(fondu);
    else this.musiqueDemandee = null;
  }

  prechargerMusique(id: string) {
    this.lecteurMusique?.precharger(id);
  }

  couche(couche: string, cible: number, duree?: number) {
    if (this.lecteurMusique) this.lecteurMusique.couche(couche, cible, duree);
    else this.couchesDemandees.set(couche, cible);
  }

  intensite(intensite: number, duree?: number) {
    if (this.lecteurMusique) this.lecteurMusique.couche("rythme", gainRythme(intensite), duree);
    else this.couchesDemandees.set("rythme", gainRythme(intensite));
  }

  sfx(id: string, options: any = {}) {
    this.lecteurSfx?.jouer(id, options);
  }

  ecoute(position: any) {
    this.ecouteDemandee = position ? { x: position.x, y: position.y } : null;
    if (this.lecteurSfx) this.lecteurSfx.regles.ecoute = this.ecouteDemandee;
  }

  declencherDialogue(declencheur: string, repli?: string) {
    let temps = this.ctx?.currentTime ?? 0,
      nombre = this.dialogues.declencher(declencheur, temps);
    if (nombre === 0 && repli !== undefined)
      nombre = this.dialogues.declencher(repli, temps);
    if (nombre > 0) this.lecteurDialogues?.prechargerFile();
    return nombre;
  }

  taireDialogues() {
    this.dialogues.taire();
  }

  reglerVolumes(reglages: any) {
    this.reglages = { ...this.reglages, ...reglages };
    this.bus?.regler(this.reglages);
  }

  // API publique stable pour ui : setVolumes({ musique, sfx, dialogues, general }).
  // Valeurs 0..1 ; 0 = bus muet. Appliqué en live (ramps 30 ms, sans clic).
  setVolumes(v: { musique?: number; sfx?: number; dialogues?: number; general?: number }) {
    let reglages: any = {};
    if (v.musique !== undefined) reglages.musique = v.musique;
    if (v.sfx !== undefined) reglages.sfx = v.sfx;
    if (v.dialogues !== undefined) reglages.voix = v.dialogues;
    if (v.general !== undefined) reglages.general = v.general;
    this.reglerVolumes(reglages);
  }

  // Relecture live des clés options partagées (volumeMusique/volumeSfx/volumeDialogues).
  // ui mute l'objet options en place ; sondé à 20 Hz, les ramps du bus lissent la transition.
  lireOptions() {
    let partagees = options as any,
      reglages: any = {};
    if (typeof partagees.volumeMusique === "number") reglages.musique = partagees.volumeMusique;
    if (typeof partagees.volumeSfx === "number") reglages.sfx = partagees.volumeSfx;
    if (typeof partagees.volumeDialogues === "number") reglages.voix = partagees.volumeDialogues;
    if (Object.keys(reglages).length) this.reglerVolumes(reglages);
  }

  // Instantané du graphe audio pour les assertions de playtest (pas de son en capture).
  etatAudio() {
    let bus = this.bus;
    return {
      ctx: this.ctx?.state ?? "absent",
      temps: this.ctx?.currentTime ?? 0,
      volumes: { ...this.reglages },
      gains: bus
        ? Object.fromEntries(Object.entries(bus.gains).map(([nom, noeud]) => [nom, noeud.gain.value]))
        : null,
      duck: bus
        ? { sousVoix: bus.sousVoix.gain.value, dialogue: bus.dialogueActif, evenementFin: bus.evenementFin }
        : null,
      musique: {
        piste: this.pisteCourante,
        sources: this.lecteurMusique?.sourcesActives() ?? 0,
        couches: this.lecteurMusique
          ? Object.fromEntries([...this.lecteurMusique.couches].map(([nom, rampe]) => [nom, rampe.cible]))
          : null,
      },
      ambiance: {
        famille: this.lecteurAmbiances?.famille ?? this.ambianceDemandee ?? "",
        sources: this.lecteurAmbiances?.sourcesActives() ?? 0,
      },
      sfx: {
        voixActives: this.lecteurSfx?.regles.enCours() ?? 0,
        sources: this.lecteurSfx?.sourcesActives() ?? 0,
        lectures: this.lecteurSfx ? Object.fromEntries(this.lecteurSfx.lectures) : null,
      },
      dialogue: {
        parle: this.dialogues.parle,
        enFile: this.dialogues.enFile.length,
        source: !!this.lecteurDialogues?.source,
      },
    };
  }

  pause() {
    this.enPause = true;
    this.ctx?.suspend();
  }

  reprise() {
    this.enPause = false;
    this.ctx?.resume();
  }

  arreterTout() {
    this.lecteurSfx?.arreterTout();
    this.dialogues.taire();
  }

  async fermer() {
    if (this.minuterie !== null) clearInterval(this.minuterie);
    this.minuterie = null;
    this.lecteurDialogues?.detacher();
    this.lecteurAmbiances?.detacher();
    if ((window as any).__audio === this) delete (window as any).__audio;
    let ctx = this.ctx;
    this.ctx = null;
    this.bus = null;
    this.lecteurMusique = null;
    this.lecteurSfx = null;
    this.lecteurDialogues = null;
    this.lecteurAmbiances = null;
    await ctx?.close();
  }
}