const POINTS_COURBE = 32;

export class Rampe {
  de: number;
  a: number;
  t0 = 0;
  t1 = 0;
  forme = "lineaire";

  constructor(de: number) {
    this.de = de;
    this.a = de;
  }

  get cible() {
    return this.a;
  }

  get fin() {
    return this.t1;
  }

  valeur(t: number) {
    if (t >= this.t1 || this.t1 <= this.t0)
      return t < this.t0 ? this.de : this.a;
    if (t <= this.t0) return this.de;
    let p = (t - this.t0) / (this.t1 - this.t0);
    return this.forme === "lineaire"
      ? this.de + (this.a - this.de) * p
      : this.a >= this.de
        ? this.de + (this.a - this.de) * Math.sin((p * Math.PI) / 2)
        : this.a + (this.de - this.a) * Math.cos((p * Math.PI) / 2);
  }

  viser(cible: number, maintenant: number, duree: number, forme = "lineaire", debut = maintenant) {
    this.de = this.valeur(maintenant);
    this.a = cible;
    this.t0 = Math.max(debut, maintenant);
    this.t1 = this.t0 + Math.max(0, duree);
    this.forme = forme;
  }

  courbe(depuis: number, points = POINTS_COURBE) {
    let courbe = new Float32Array(Math.max(2, points));
    let pas = (this.t1 - depuis) / (courbe.length - 1);
    for (let i = 0; i < courbe.length; i++) courbe[i] = this.valeur(depuis + i * pas);
    return courbe;
  }

  appliquer(param: AudioParam, maintenant: number) {
    param.cancelScheduledValues(0);
    let debut = Math.max(maintenant, this.t0);
    if (debut > maintenant) param.setValueAtTime(this.valeur(maintenant), maintenant);
    if (this.t1 - debut <= 1e-4) {
      param.setValueAtTime(this.a, debut);
      return;
    }
    param.setValueCurveAtTime(this.courbe(debut), debut, this.t1 - debut);
  }
}

export const VOLUMES_DEFAUT = { general: 0.9, musique: 0.7, sfx: 0.9, voix: 1 };
const ATTENUATION_VOIX = 0.4;
const FONDU_ATTENUATION = 0.15;
const FONDU_RETOUR = 0.8;
const FONDU_VOLUME = 0.03;

const borner01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function dbVersGain(db: number) {
  return 10 ** (db / 20);
}

function gainsParBus(reglages: any) {
  let g = (v: number) => (borner01(v) <= 0.001 ? 0 : borner01(v));
  return {
    master: g(reglages.general),
    musique: g(reglages.musique),
    sfx: g(reglages.sfx),
    interface: g(reglages.sfx),
    voix: g(reglages.voix),
  };
}

export class BusAudio {
  ctx: AudioContext;
  entrees: Record<string, GainNode>;
  gains: Record<string, GainNode>;
  rampes: Record<string, Rampe>;
  sousVoix: GainNode;
  rampeSousVoix = new Rampe(1);

  constructor(ctx: AudioContext, reglages: any = VOLUMES_DEFAUT) {
    this.ctx = ctx;
    let g = gainsParBus(reglages),
      noeud = (bus: string) => new GainNode(ctx, { gain: (g as any)[bus] });
    this.gains = {
      master: noeud("master"),
      musique: noeud("musique"),
      sfx: noeud("sfx"),
      interface: noeud("interface"),
      voix: noeud("voix"),
    };
    this.rampes = {
      master: new Rampe(g.master),
      musique: new Rampe(g.musique),
      sfx: new Rampe(g.sfx),
      interface: new Rampe(g.interface),
      voix: new Rampe(g.voix),
    };
    this.sousVoix = new GainNode(ctx, { gain: 1 });
    this.gains.master.connect(ctx.destination);
    this.gains.musique.connect(this.sousVoix).connect(this.gains.master);
    this.gains.sfx.connect(this.gains.master);
    this.gains.interface.connect(this.gains.master);
    this.gains.voix.connect(this.gains.master);
    this.entrees = {
      musique: this.gains.musique,
      sfx: this.gains.sfx,
      interface: this.gains.interface,
      voix: this.gains.voix,
    };
  }

  regler(reglages: any) {
    let cibles = gainsParBus(reglages),
      maintenant = this.ctx.currentTime;
    for (let bus of Object.keys(cibles)) {
      let rampe = this.rampes[bus];
      if (Math.abs(rampe.cible - (cibles as any)[bus]) < 1e-4) continue;
      rampe.viser((cibles as any)[bus], maintenant, FONDU_VOLUME);
      rampe.appliquer(this.gains[bus].gain, maintenant);
    }
  }

  attenuerMusique(attenuer: boolean) {
    let cible = attenuer ? ATTENUATION_VOIX : 1;
    if (this.rampeSousVoix.cible === cible) return;
    let maintenant = this.ctx.currentTime;
    this.rampeSousVoix.viser(cible, maintenant, attenuer ? FONDU_ATTENUATION : FONDU_RETOUR);
    this.rampeSousVoix.appliquer(this.sousVoix.gain, maintenant);
  }
}

export function urlRessource(chemin: string, base = "/") {
  let nu = chemin.replace(/^res:\/\//, "").replace(/^\/+/, "");
  return (base.endsWith("/") ? base : base + "/") + nu;
}

export const lireAudio = async (url: string): Promise<ArrayBuffer | null> => {
  let reponse: Response;
  try {
    reponse = await fetch(url);
  } catch {
    return null;
  }
  let type = reponse.headers.get("content-type") ?? "";
  return !reponse.ok || type.includes("html") ? null : reponse.arrayBuffer();
};

export class ChargeurAudio {
  ctx: AudioContext;
  lire: (url: string) => Promise<ArrayBuffer | null>;
  enCours = new Map<string, Promise<AudioBuffer | null>>();
  prets = new Map<string, AudioBuffer | null>();

  constructor(ctx: AudioContext, lire = lireAudio) {
    this.ctx = ctx;
    this.lire = lire;
  }

  charger(url: string) {
    let enCours = this.enCours.get(url);
    if (enCours) return enCours;
    let promesse = this.telecharger(url).then((buffer) => {
      if (this.enCours.get(url) === promesse) this.prets.set(url, buffer);
      return buffer;
    });
    this.enCours.set(url, promesse);
    return promesse;
  }

  pret(url: string) {
    return this.prets.get(url);
  }

  oublier(url: string) {
    this.enCours.delete(url);
    this.prets.delete(url);
  }

  async telecharger(url: string) {
    let brut = await this.lire(url);
    if (brut === null) return null;
    try {
      return await this.ctx.decodeAudioData(brut);
    } catch (e) {
      console.warn(`Audio illisible : ${url}`, e);
      return null;
    }
  }
}