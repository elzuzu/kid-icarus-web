import { ChargeurAudio, dbVersGain, Rampe, urlRessource } from "./base";

// Boucles d'ambiance par monde : vent (surface/ciel), braises (enfers),
// orage (tempête), lit (calme : palais, crépuscule, source chaude).
// Niveau discret : -18 dB sous le bus SFX, fondu croisé sans clic au changement.
const GAIN_AMBIANCE = dbVersGain(-18);
const FONDU_AMBIANCE = 1.6;
const DELAI_DEMARRAGE = 0.03;

export const FAMILLES_AMBIANCE = ["vent", "braises", "orage", "lit"] as const;
export type FamilleAmbiance = (typeof FAMILLES_AMBIANCE)[number];

// Ambiance visuelle du stage (niveau.definition.ambiance, kit de décor) -> famille sonore.
export const AMBIANCE_PAR_VISUEL: Record<string, FamilleAmbiance> = {
  profondeurs: "braises",
  fosses: "braises",
  puits: "braises",
  forteresse: "braises",
  arcadie: "vent",
  col_gele: "vent",
  crepuscule: "lit",
  forteresse_surface: "vent",
  mer_nuages: "vent",
  tempete: "orage",
  temple_vents: "vent",
  forteresse_celeste: "vent",
  vol_celeste: "vent",
  palais: "lit",
};

// Piste musicale -> ambiance : undefined = fondu sortie (menus, résultats),
// "garde" = conserve l'ambiance du stage (boss, épreuve en cours de stage).
export const AMBIANCE_PAR_PISTE: Record<string, FamilleAmbiance | "garde"> = {
  enfers_1: "braises",
  enfers_2: "braises",
  enfers_3: "braises",
  forteresse_enfers: "braises",
  surface_1: "vent",
  surface_2: "vent",
  surface_3: "vent",
  forteresse_surface: "vent",
  ciel_1: "vent",
  ciel_2: "orage",
  ciel_3: "vent",
  forteresse_ciel: "vent",
  vol_celeste: "vent",
  palais: "lit",
  source_chaude: "lit",
  boss_stage: "garde",
  boss_hewdraw: "garde",
  boss_medusa: "garde",
  boss_pandora: "garde",
  boss_tanatos: "garde",
  epreuve: "garde",
};

export class LecteurAmbiances {
  ctx: AudioContext;
  sortie: GainNode;
  chargeur: ChargeurAudio;
  base: string;
  famille = "";
  actuelle: any = null;
  sortantes = new Set<any>();
  generation = 0;

  constructor(ctx: AudioContext, sortie: GainNode, chargeur: ChargeurAudio, base = "/") {
    this.ctx = ctx;
    this.sortie = sortie;
    this.chargeur = chargeur;
    this.base = base;
  }

  jouer(famille: string) {
    if (!famille) {
      this.arreter();
      return;
    }
    if (famille === this.famille && this.actuelle && !this.actuelle.congediee) return;
    this.famille = famille;
    let generation = ++this.generation;
    this.chargeur
      .charger(urlRessource(`assets/sfx/ambiance_${famille}.wav`, this.base))
      .then((buffer) => {
        if (generation !== this.generation || !buffer) return;
        this.lancer(famille, buffer);
      });
  }

  arreter(fondu = FONDU_AMBIANCE) {
    if (!this.famille && !this.actuelle) return;
    this.famille = "";
    this.generation++;
    if (this.actuelle) {
      this.congedier(this.actuelle, this.ctx.currentTime, fondu);
      this.actuelle = null;
    }
  }

  private lancer(famille: string, buffer: AudioBuffer) {
    let maintenant = this.ctx.currentTime,
      depart = maintenant + DELAI_DEMARRAGE,
      gain = new GainNode(this.ctx, { gain: 0 }),
      source = new AudioBufferSourceNode(this.ctx, { buffer, loop: true });
    gain.connect(this.sortie);
    source.connect(gain);
    let piste = {
      famille,
      gain,
      source,
      rampe: new Rampe(0),
      congediee: false,
      finie: false,
    };
    source.onended = () => this.finir(piste);
    source.start(depart);
    piste.rampe.viser(GAIN_AMBIANCE, maintenant, FONDU_AMBIANCE, "puissance", depart);
    piste.rampe.appliquer(gain.gain, maintenant);
    if (this.actuelle) this.congedier(this.actuelle, maintenant, FONDU_AMBIANCE);
    this.actuelle = piste;
  }

  private congedier(piste: any, maintenant: number, fondu: number) {
    if (piste.finie || piste.congediee) return;
    piste.congediee = true;
    piste.rampe.viser(0, maintenant, fondu, "puissance");
    piste.rampe.appliquer(piste.gain.gain, maintenant);
    try {
      piste.source.stop(piste.rampe.fin + 0.05);
    } catch {}
    this.sortantes.add(piste);
  }

  private finir(piste: any) {
    if (piste.finie) return;
    piste.finie = true;
    this.sortantes.delete(piste);
    if (this.actuelle === piste) this.actuelle = null;
    piste.source.disconnect();
    piste.gain.disconnect();
  }

  sourcesActives() {
    let nombre = 0;
    if (this.actuelle && !this.actuelle.finie) nombre++;
    for (let piste of this.sortantes) if (!piste.finie) nombre++;
    return nombre;
  }

  detacher() {
    this.generation++;
    this.famille = "";
    for (let piste of [this.actuelle, ...this.sortantes]) {
      if (!piste || piste.finie) continue;
      try {
        piste.source.stop();
      } catch {}
      this.finir(piste);
    }
    this.actuelle = null;
    this.sortantes.clear();
  }
}