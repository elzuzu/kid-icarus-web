import { r as Flux } from "../../core";
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
  minuterie: any = null;
  reglages: any;
  enPause = false;
  musiqueDemandee: any = null;
  couchesDemandees = new Map<string, number>();
  ecouteDemandee: any = null;

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
      this.lecteurSfx.regles.ecoute = this.ecouteDemandee;
      for (let [couche, cible] of this.couchesDemandees)
        this.lecteurMusique.couche(couche, cible, 0);
      if (this.musiqueDemandee)
        this.lecteurMusique.jouer(this.musiqueDemandee.id, {
          ...this.musiqueDemandee.options,
          fondu: 0.3,
        });
      this.lecteurDialogues.prechargerFile();
      this.minuterie = setInterval(
        () => this.lecteurDialogues?.mettreAJour(),
        INTERVALLE_DIALOGUES,
      );
      this.lecteurSfx.precharger();
    }
    if (this.ctx.state === "suspended" && !this.enPause) await this.ctx.resume();
  }

  musique(id: string, options: any = {}) {
    if (this.lecteurMusique) this.lecteurMusique.jouer(id, options);
    else this.musiqueDemandee = { id, options };
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

  intensite(intensite: number) {
    if (this.lecteurMusique) this.lecteurMusique.intensite(intensite);
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
    let ctx = this.ctx;
    this.ctx = null;
    this.bus = null;
    this.lecteurMusique = null;
    this.lecteurSfx = null;
    this.lecteurDialogues = null;
    await ctx?.close();
  }
}