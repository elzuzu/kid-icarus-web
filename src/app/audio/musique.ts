import { ChargeurAudio, Rampe, urlRessource } from "./base";

const FONDU_ARRET = 0.6;
const GAIN_RYTHME_MIN = 0.2;
const DUREE_FONDU_MAX = 0.7 * 0.8;
const DELAI_DEMARRAGE = 0.05;

const borner01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

function couchesDe(def: any) {
  return def.couches
    ? Object.entries(def.couches).map(([couche, chemin]) => ({ couche, chemin }))
    : [{ couche: "mix", chemin: def.fichier }];
}

function pointsBoucle(def: any, duree: number) {
  let fin = def.duree > 0 ? Math.min(def.duree, duree) : duree,
    debut = def.debut_boucle >= 0 && def.debut_boucle < fin ? def.debut_boucle : 0;
  return { boucle: def.boucle, debut, fin };
}

function tempsBoucle(t: number, points: any) {
  if (t <= 0) return 0;
  if (t < points.fin || !points.boucle) return Math.min(t, points.fin);
  let periode = points.fin - points.debut;
  return periode <= 0 ? points.fin : points.debut + ((t - points.fin) % periode);
}

function attenteCalage(t: number, bpm: number, cale: string, points: any) {
  if (cale === "aucun" || !(bpm > 0)) return 0;
  let pas = (60 / bpm) * (cale === "mesure" ? 4 : 1),
    attente = Math.ceil(t / pas - 1e-9) * pas - t;
  if (points.boucle && t + attente > points.fin) attente = points.fin - t;
  return Math.max(0, attente);
}

export function gainRythme(intensite: number) {
  return GAIN_RYTHME_MIN + 0.8 * borner01(intensite);
}

function dureeFondu(de: number, vers: number) {
  return Math.abs(vers - de) / DUREE_FONDU_MAX;
}

function marquerRecente(recentes: string[], id: string, max = 4) {
  let i = recentes.indexOf(id);
  if (i >= 0) recentes.splice(i, 1);
  recentes.unshift(id);
  return recentes.splice(max);
}

export class LecteurMusique {
  ctx: AudioContext;
  sortie: GainNode;
  chargeur: ChargeurAudio;
  table: Map<string, any>;
  base: string;
  pisteCourante = "";
  actuelle: any = null;
  sortantes = new Set<any>();
  couches = new Map<string, Rampe>([
    ["base", new Rampe(1)],
    ["rythme", new Rampe(GAIN_RYTHME_MIN)],
  ]);
  absentes = new Set<string>();
  recentes: string[] = [];
  generation = 0;

  constructor(ctx: AudioContext, sortie: GainNode, chargeur: ChargeurAudio, table: Map<string, any>, base = "/") {
    this.ctx = ctx;
    this.sortie = sortie;
    this.chargeur = chargeur;
    this.table = table;
    this.base = base;
  }

  existe(id: string) {
    return this.table.has(id);
  }

  async precharger(id: string) {
    let def = this.table.get(id);
    if (def) {
      await Promise.all(
        couchesDe(def).map((c) => this.chargeur.charger(urlRessource(c.chemin, this.base))),
      );
      for (let ancienne of marquerRecente(this.recentes, id)) this.liberer(ancienne);
    }
  }

  jouer(id: string, options: any = {}) {
    if (id === this.pisteCourante) return;
    this.pisteCourante = id;
    let def = this.table.get(id);
    if (!def) {
      this.signalerAbsente(id);
      return;
    }
    let generation = ++this.generation,
      couches = couchesDe(def);
    Promise.all(
      couches.map((c) => this.chargeur.charger(urlRessource(c.chemin, this.base))),
    ).then((buffers) => {
      if (generation !== this.generation) return;
      let prets = buffers.filter((b) => b !== null);
      if (prets.length !== couches.length) {
        this.signalerAbsente(id);
        return;
      }
      this.lancer(def, couches, prets, options.fondu ?? 1.2, options.cale ?? "temps");
    });
  }

  arreter(fondu = FONDU_ARRET) {
    this.pisteCourante = "";
    this.generation++;
    if (!this.actuelle) return;
    let maintenant = this.ctx.currentTime;
    this.congedier(this.actuelle, maintenant, maintenant, fondu);
    this.actuelle = null;
  }

  couche(couche: string, cible: number, duree?: number) {
    let rampe = this.rampeCouche(couche),
      valeur = borner01(cible);
    if (Math.abs(rampe.cible - valeur) < 0.001) return;
    let maintenant = this.ctx.currentTime;
    rampe.viser(valeur, maintenant, duree ?? dureeFondu(rampe.valeur(maintenant), valeur));
    for (let piste of this.pistes()) {
      let gain = piste.couches.get(couche);
      if (gain) rampe.appliquer(gain.gain, maintenant);
    }
  }

  intensite(intensite: number) {
    this.couche("rythme", gainRythme(intensite));
  }

  lancer(def: any, couches: any[], buffers: AudioBuffer[], fondu: number, cale: string) {
    let maintenant = this.ctx.currentTime,
      depart = maintenant + DELAI_DEMARRAGE,
      sortante = this.actuelle;
    if (sortante && !sortante.finie && sortante.points.boucle)
      depart += attenteCalage(
        tempsBoucle(depart - sortante.t0, sortante.points),
        sortante.def.bpm,
        cale,
        sortante.points,
      );
    let points = pointsBoucle(def, Math.min(...buffers.map((b) => b.duration))),
      gain = new GainNode(this.ctx, { gain: 0 });
    gain.connect(this.sortie);
    let piste = {
      def,
      points,
      t0: depart,
      sources: [] as AudioBufferSourceNode[],
      gain,
      rampe: new Rampe(0),
      couches: new Map<string, GainNode>(),
      finie: false,
    };
    couches.forEach((couche, i) => {
      let source = new AudioBufferSourceNode(this.ctx, {
        buffer: buffers[i] ?? null,
        loop: points.boucle,
      });
      if (points.boucle) {
        source.loopStart = points.debut;
        source.loopEnd = points.fin;
      }
      let entree = gain;
      if (couche.couche !== "mix") {
        let rampe = this.rampeCouche(couche.couche),
          noeud = new GainNode(this.ctx, { gain: rampe.valeur(maintenant) });
        rampe.appliquer(noeud.gain, maintenant);
        noeud.connect(gain);
        piste.couches.set(couche.couche, noeud);
        entree = noeud;
      }
      source.connect(entree);
      source.start(depart);
      piste.sources.push(source);
    });
    let premiere = piste.sources[0];
    if (premiere) premiere.onended = () => this.finir(piste);
    piste.rampe.viser(1, maintenant, fondu, "puissance", depart);
    piste.rampe.appliquer(gain.gain, maintenant);
    if (sortante) this.congedier(sortante, maintenant, depart, fondu);
    this.actuelle = piste;
    for (let ancienne of marquerRecente(this.recentes, def.id)) this.liberer(ancienne);
  }

  congedier(piste: any, maintenant: number, depart: number, fondu: number) {
    if (!piste.finie) {
      piste.rampe.viser(0, maintenant, fondu, "puissance", depart);
      piste.rampe.appliquer(piste.gain.gain, maintenant);
      for (let source of piste.sources)
        try {
          source.stop(piste.rampe.fin + 0.05);
        } catch {}
      this.sortantes.add(piste);
    }
  }

  finir(piste: any) {
    piste.finie = true;
    this.sortantes.delete(piste);
    piste.gain.disconnect();
    for (let gain of piste.couches.values()) gain.disconnect();
    for (let source of piste.sources) source.disconnect();
  }

  liberer(id: string) {
    if (id === this.pisteCourante) return;
    for (let piste of this.pistes()) if (piste.def.id === id) return;
    let def = this.table.get(id);
    if (def)
      for (let couche of couchesDe(def))
        this.chargeur.oublier(urlRessource(couche.chemin, this.base));
  }

  *pistes() {
    if (this.actuelle) yield this.actuelle;
    yield* this.sortantes;
  }

  sourcesActives() {
    let nombre = 0;
    for (let piste of this.pistes()) if (!piste.finie) nombre += piste.sources.length;
    return nombre;
  }

  rampeCouche(couche: string) {
    let rampe = this.couches.get(couche);
    if (!rampe) {
      rampe = new Rampe(1);
      this.couches.set(couche, rampe);
    }
    return rampe;
  }

  signalerAbsente(id: string) {
    if (!this.absentes.has(id)) {
      this.absentes.add(id);
      console.warn(`Musique absente : ${id}`);
    }
  }
}