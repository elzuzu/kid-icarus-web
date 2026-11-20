import { Signal } from "../signal";
import { ChargeurAudio, urlRessource } from "./base";

const DELAIS: Record<string, number> = {
  pv_bas: 45,
  niveau: 25,
  elite: 40,
  sirene: 30,
  arme_rare: 30,
  boss_phase: 8,
  mort: 20,
  plume: 10,
  boss_vaincu: 5,
};
const SANS_DELAI = [
  "intro",
  "fin",
  "centurion",
  "sorcier",
  "aubergine",
  "fin_heroique",
  "fin_sobre",
  "ng_plus",
];
const DUREE_MIN = 0.4;
const COULEUR_DEFAUT = [1, 0.85, 0.4];

function dureeLecture(texte: string) {
  return 1.2 + texte.length * 0.055;
}

function aDelai(declencheur: string) {
  return !declencheur.includes(":") && !SANS_DELAI.includes(declencheur);
}

function cheminVoix(id: string) {
  return `assets/voix/${id}.ogg`;
}

// Le répertoire voix peut être absent : un seul 404 suffit à couper les fetch suivants.
let voixAbsentes = false;

const priorite = (replique: any) => replique.priorite ?? 1;

export class FileDialogues {
  voix: any;
  flux: any;
  vues: string[];
  commencee = new Signal();
  finie = new Signal();
  fileVide = new Signal();
  entrees: any[];
  file: any[] = [];
  derniers = new Map<string, number>();
  courante: any = null;
  fin = 0;
  attente: any = null;

  constructor(entrees: any[], voix: any, flux: any, vues: string[] = []) {
    this.voix = voix;
    this.flux = flux;
    this.vues = vues;
    this.entrees = [...entrees];
  }

  get parle() {
    return this.courante !== null;
  }

  get replique() {
    return this.courante;
  }

  get enFile() {
    return this.file;
  }

  declencher(declencheur: string, temps: number) {
    let candidates = this.entrees.filter(
      (r) =>
        r.declencheur === declencheur &&
        !(r.une_fois && (this.vues.includes(r.id) || this.prevue(r.id))),
    );
    if (candidates.length === 0) return 0;
    if (aDelai(declencheur)) {
      let delai = DELAIS[declencheur] ?? 15;
      if (temps - (this.derniers.get(declencheur) ?? -1 / 0) < delai) return 0;
      candidates = [this.flux.choisir(candidates)];
    }
    this.derniers.set(declencheur, temps);
    for (let replique of candidates) this.mettreEnFile(replique);
    return candidates.length;
  }

  taire() {
    this.file.length = 0;
    this.attente = null;
    this.finir();
  }

  mettreAJour(temps: number, dureeVoix: (id: string) => number | null | undefined = () => null) {
    if (this.courante) {
      if (temps >= this.fin) this.finir();
      return;
    }
    let replique = this.file[0];
    if (!replique) return;
    let duree = replique.sans_voix ? null : dureeVoix(replique.id);
    if (duree === undefined) {
      if (this.attente?.id !== replique.id)
        this.attente = { id: replique.id, depuis: temps };
      if (temps - this.attente.depuis < 1.5) return;
      duree = null;
    }
    this.attente = null;
    this.file.shift();
    this.commencer(replique, temps, duree);
  }

  commencer(replique: any, temps: number, duree: number | null) {
    this.courante = replique;
    if (replique.une_fois && !this.vues.includes(replique.id))
      this.vues.push(replique.id);
    let lecture = duree === null ? dureeLecture(replique.texte) : Math.max(DUREE_MIN, duree);
    this.fin = temps + lecture;
    let voix = this.voix[replique.perso];
    this.commencee.emettre({
      id: replique.id,
      perso: replique.perso,
      nom: voix?.nom ?? replique.perso.charAt(0).toUpperCase() + replique.perso.slice(1),
      couleur: voix?.couleur ?? COULEUR_DEFAUT,
      texte: replique.texte,
      duree: lecture,
      voix: duree !== null,
      priorite: priorite(replique),
    });
  }

  finir() {
    let id = this.courante?.id;
    this.courante = null;
    if (id !== undefined) this.finie.emettre(id);
    if (this.file.length === 0) this.fileVide.emettre();
  }

  mettreEnFile(replique: any) {
    let p = priorite(replique),
      i = this.file.length;
    while (i > 0 && priorite(this.file[i - 1]) < p) i--;
    this.file.splice(i, 0, replique);
    if (this.courante && p >= 3 && priorite(this.courante) < p) this.finir();
  }

  prevue(id: string) {
    return this.courante?.id === id || this.file.some((r) => r.id === id);
  }
}

export class LecteurDialogues {
  ctx: AudioContext;
  sortie: GainNode;
  chargeur: ChargeurAudio;
  file: FileDialogues;
  base: string;
  surVoix: (active: boolean) => void;
  source: AudioBufferSourceNode | null = null;
  debranchements: (() => void)[];

  constructor(
    ctx: AudioContext,
    sortie: GainNode,
    chargeur: ChargeurAudio,
    file: FileDialogues,
    base = "/",
    surVoix: (active: boolean) => void = () => void 0,
  ) {
    this.ctx = ctx;
    this.sortie = sortie;
    this.chargeur = chargeur;
    this.file = file;
    this.base = base;
    this.surVoix = surVoix;
    this.debranchements = [
      file.commencee.connecter((sousTitre: any) => this.commencer(sousTitre)),
      file.finie.connecter((id: string) => this.finir(id)),
    ];
  }

  detacher() {
    this.couper();
    for (let debrancher of this.debranchements) debrancher();
  }

  mettreAJour() {
    this.file.mettreAJour(this.ctx.currentTime, (id) => this.etatVoix(id));
  }

  prechargerFile() {
    for (let replique of this.file.enFile)
      if (!replique.sans_voix && !voixAbsentes)
        this.chargeur.charger(this.url(replique.id))?.then((buffer) => {
          if (!buffer) voixAbsentes = true;
        });
  }

  url(id: string) {
    return urlRessource(cheminVoix(id), this.base);
  }

  etatVoix(id: string) {
    let url = this.url(id),
      buffer = this.chargeur.pret(url);
    if (buffer === undefined) {
      this.chargeur.charger(url);
      return;
    }
    return buffer ? buffer.duration : null;
  }

  commencer(sousTitre: any) {
    this.couper();
    // Ducking dès le sous-titre, même sans voix enregistrée : le dialogue prime.
    this.surVoix(true);
    let buffer = sousTitre.voix ? this.chargeur.pret(this.url(sousTitre.id)) : null;
    if (!buffer) return;
    let source = new AudioBufferSourceNode(this.ctx, { buffer });
    source.connect(this.sortie);
    source.start();
    this.source = source;
  }

  finir(id: string) {
    this.couper();
    this.chargeur.oublier(this.url(id));
    if (this.file.enFile.length === 0) this.surVoix(false);
  }

  couper() {
    let source = this.source;
    if (source) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
      this.source = null;
    }
  }
}