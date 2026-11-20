import { ChargeurAudio, dbVersGain, urlRessource } from "./base";

const PORTEE_PAN = 240;
const PAN_MAX = 0.7;
const SFX_PROJECTILE: Record<string, string> = {
  foudre: "eclair",
  onde: "onde_choc",
  glace: "glace",
  boule_neige: "glace",
  pierre: "pierre",
  eau: "eau",
  venin: "eau",
  eclat: "tir_fleche",
  lumiere: "tir_charge",
};

export function sfxProjectile(element: string) {
  return SFX_PROJECTILE[element] ?? "boule_feu";
}

function attenuationDistance(position: any, ecoute: any) {
  if (!position || !ecoute) return 0;
  let distance = Math.hypot(position.x - ecoute.x, position.y - ecoute.y) / 16;
  return distance <= 13 ? 0 : distance >= 30 ? -60 : (-18 * (distance - 13)) / 17;
}

function panPosition(position: any, ecoute: any) {
  if (!position || !ecoute) return 0;
  let ratio = (position.x - ecoute.x) / PORTEE_PAN;
  return Math.max(-1, Math.min(1, ratio)) * PAN_MAX;
}

export class ReglesSfx {
  flux: any;
  ecoute: any = null;
  defs = new Map<string, any>();
  variantes = new Map<string, number>();
  derniere = new Map<string, number>();
  voies: any[];
  inconnus = new Set<string>();
  jetons = 0;

  constructor(defs: any[], flux: any, nbVoix = 28) {
    this.flux = flux;
    for (let def of defs) this.defs.set(def.id, def);
    this.voies = Array(Math.max(1, nbVoix)).fill(null);
  }

  existe(id: string) {
    return this.defs.has(id);
  }

  ids() {
    return [...this.defs.keys()];
  }

  definirVariantes(id: string, nombre: number) {
    this.variantes.set(id, Math.max(0, Math.floor(nombre)));
  }

  enCours(id?: string) {
    return this.voies.filter((v) => v !== null && (id === undefined || v.id === id)).length;
  }

  demander(id: string, temps: number, options: any = {}) {
    let def = this.defs.get(id);
    if (!def) {
      if (!this.inconnus.has(id)) {
        this.inconnus.add(id);
        console.warn(`Son inconnu : ${id}`);
      }
      return null;
    }
    let variantes = this.variantes.get(id) ?? 0;
    if (
      variantes <= 0 ||
      temps - (this.derniere.get(id) ?? -1 / 0) < def.delai ||
      this.enCours(id) >= def.voix
    )
      return null;
    let spatiale = def.bus === "SFX",
      attenuation = spatiale ? attenuationDistance(options.position, this.ecoute) : 0;
    if (attenuation <= -40) return null;
    let voie = this.voieLibre(),
      volee = this.voies[voie]?.jeton ?? null,
      variante = this.flux.randiRange(0, variantes - 1),
      [basse, haute] = def.hauteur,
      aleatoire = haute > basse,
      vitesse = aleatoire ? this.flux.randfRange(basse, haute) : basse,
      jitter = aleatoire ? this.flux.randfRange(-1, 1) : 0,
      jeton = ++this.jetons;
    this.voies[voie] = { id, debut: temps, jeton };
    this.derniere.set(id, temps);
    return {
      id,
      bus: def.bus,
      voie,
      jeton,
      variante,
      vitesse,
      gain: dbVersGain(def.volume + attenuation + (options.volumeDb ?? 0) + jitter),
      pan: spatiale ? panPosition(options.position, this.ecoute) : 0,
      volee,
    };
  }

  liberer(voie: number, jeton: number) {
    if (this.voies[voie]?.jeton === jeton) this.voies[voie] = null;
  }

  libererTout() {
    this.voies.fill(null);
  }

  voieLibre() {
    let plusAncienne = 0;
    for (let i = 0; i < this.voies.length; i++) {
      let voie = this.voies[i];
      if (!voie) return i;
      if (voie.debut < (this.voies[plusAncienne]?.debut ?? 1 / 0)) plusAncienne = i;
    }
    return plusAncienne;
  }
}

export class LecteurSfx {
  ctx: AudioContext;
  sorties: Record<string, GainNode>;
  chargeur: ChargeurAudio;
  base: string;
  regles: ReglesSfx;
  voies: any[];
  tampons = new Map<string, AudioBuffer[]>();
  chargements = new Map<string, Promise<void>>();
  nbVariantes = new Map<string, number>();

  constructor(
    ctx: AudioContext,
    sorties: Record<string, GainNode>,
    chargeur: ChargeurAudio,
    defs: any[],
    flux: any,
    base = "/",
  ) {
    this.ctx = ctx;
    this.sorties = sorties;
    this.chargeur = chargeur;
    this.base = base;
    let copie = [...defs];
    for (let def of copie)
      if (def.variantes !== undefined) this.nbVariantes.set(def.id, def.variantes);
    this.regles = new ReglesSfx(copie, flux);
    this.voies = Array.from({ length: 28 }, () => {
      let gain = new GainNode(ctx, { gain: 0 }),
        pan = new StereoPannerNode(ctx, { pan: 0 });
      gain.connect(pan);
      return { gain, pan, bus: null, source: null };
    });
  }

  async precharger(ids = this.regles.ids()) {
    await Promise.all(ids.map((id) => this.chargerSon(id)));
  }

  jouer(id: string, options: any = {}) {
    if (this.regles.existe(id) && !this.tampons.has(id)) this.chargerSon(id);
    let demande = this.regles.demander(id, this.ctx.currentTime, options);
    if (!demande) return;
    let buffer = this.tampons.get(id)?.[demande.variante],
      voie = this.voies[demande.voie];
    if (!buffer || !voie) {
      this.regles.liberer(demande.voie, demande.jeton);
      return;
    }
    this.couper(voie);
    if (voie.bus !== demande.bus) {
      voie.pan.disconnect();
      voie.pan.connect(this.sorties[demande.bus]);
      voie.bus = demande.bus;
    }
    voie.gain.gain.value = demande.gain;
    voie.pan.pan.value = demande.pan;
    let source = new AudioBufferSourceNode(this.ctx, {
      buffer,
      playbackRate: demande.vitesse,
    });
    source.connect(voie.gain);
    source.onended = () => {
      source.disconnect();
      if (voie.source === source) voie.source = null;
      this.regles.liberer(demande.voie, demande.jeton);
    };
    voie.source = source;
    source.start();
  }

  arreterTout() {
    for (let voie of this.voies) this.couper(voie);
    this.regles.libererTout();
  }

  couper(voie: any) {
    let source = voie.source;
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source.disconnect();
      voie.source = null;
    }
  }

  chargerSon(id: string) {
    let chargement = this.chargements.get(id);
    if (!chargement) {
      chargement = (async () => {
        let buffers: AudioBuffer[] = [],
          nombre = this.nbVariantes.get(id);
        if (nombre !== undefined) {
          let chargees = await Promise.all(
            Array.from({ length: nombre }, (_, i) =>
              this.chargeur.charger(urlRessource(`assets/sfx/${id}_${i + 1}.wav`, this.base)),
            ),
          );
          for (let buffer of chargees) if (buffer) buffers.push(buffer);
        } else
          for (let i = 1; i <= 8; i++) {
            let buffer = await this.chargeur.charger(
              urlRessource(`assets/sfx/${id}_${i}.wav`, this.base),
            );
            if (!buffer) break;
            buffers.push(buffer);
          }
        if (buffers.length === 0) console.warn(`Son sans fichier : ${id}`);
        this.tampons.set(id, buffers);
        this.regles.definirVariantes(id, buffers.length);
      })();
      this.chargements.set(id, chargement);
    }
    return chargement;
  }
}