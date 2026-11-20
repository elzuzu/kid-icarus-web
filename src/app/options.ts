// Options de jeu, persistées en localStorage et lues EN DIRECT par les autres équipes :
// audio (volumeMusique/volumeSfx/volumeDialogues), techart (secousses/flashes),
// balance (difficulte), combat (hitstop). Mutation en place de l'objet partagé :
// aucune copie, effet immédiat dès la frame suivante.
import { stockageLocal } from "./sauvegarde";
import { Signal } from "./signal";

// Clé dédiée, séparée de la sauvegarde de partie : les options survivent à un changement de slot.
const CLE_OPTIONS = "kid-icarus-options";

export type Difficulte = "normal" | "expert";

const baseOptions = {
  volumeMusique: 0.8,
  volumeSfx: 0.9,
  volumeDialogues: 0.9,
  secousses: true,
  flashs: true,
  hitstop: true,
  difficulte: "normal" as Difficulte,
};

// `flashes` est le nom canonique du contrat ; `flashs` est le nom historique lu par
// render/effets. Les deux restent synchronisés (accesseur énumérable → persisté aussi).
export const options = baseOptions as typeof baseOptions & { flashes: boolean };
Object.defineProperty(options, "flashes", {
  enumerable: true,
  get(): boolean {
    return options.flashs;
  },
  set(valeur: boolean) {
    options.flashs = !!valeur;
  },
});

export type CleOption = keyof typeof options | "flashes";

// Émis après chaque modification (clé, valeur) : les lecteurs qui préfèrent un signal
// à la relecture par frame peuvent s'y brancher. La mutation en place reste la source de vérité.
export const changementOptions = new Signal();

const PAS_VOLUME = 0.05;

function bornerVolume(valeur: number): number {
  const pas = Math.round(Math.max(0, Math.min(1, valeur)) / PAS_VOLUME);
  // Arrondi décimal : évite 0.9500000000000001 dans le stockage et l'affichage.
  return Math.round(pas * PAS_VOLUME * 100) / 100;
}

export function chargerOptions() {
  const brut = stockageLocal.lire(CLE_OPTIONS);
  if (!brut) return;
  try {
    const donnees = JSON.parse(brut);
    if (!donnees || typeof donnees !== "object") return;
    // Validation stricte par type : un stockage corrompu ne doit jamais casser les lecteurs.
    for (const cle of ["volumeMusique", "volumeSfx", "volumeDialogues"] as const)
      if (typeof donnees[cle] === "number" && Number.isFinite(donnees[cle]))
        options[cle] = bornerVolume(donnees[cle]);
    for (const cle of ["secousses", "flashs", "hitstop"] as const)
      if (typeof donnees[cle] === "boolean") options[cle] = donnees[cle];
    if (typeof donnees.flashes === "boolean" && typeof donnees.flashs !== "boolean")
      options.flashs = donnees.flashes;
    if (donnees.difficulte === "normal" || donnees.difficulte === "expert")
      options.difficulte = donnees.difficulte;
  } catch {
    // Stockage illisible : on garde les valeurs par défaut.
  }
}

export function sauvegarderOptions() {
  stockageLocal.ecrire(CLE_OPTIONS, JSON.stringify(options));
}

export function reglerOption(cle: CleOption, valeur: number | boolean | string) {
  if (cle === "volumeMusique" || cle === "volumeSfx" || cle === "volumeDialogues") {
    const nombre = Number(valeur);
    if (!Number.isFinite(nombre)) return;
    options[cle] = bornerVolume(nombre);
  } else if (cle === "difficulte") {
    if (valeur !== "normal" && valeur !== "expert") return;
    options.difficulte = valeur;
  } else {
    (options as any)[cle] = !!valeur;
  }
  sauvegarderOptions();
  changementOptions.emettre(cle, (options as any)[cle]);
}

export function basculerOption(cle: CleOption): boolean {
  // Mutation en place : les autres modules lisent l'objet partagé en continu, effet immédiat.
  const actuelle = !!(options as any)[cle];
  (options as any)[cle] = !actuelle;
  sauvegarderOptions();
  changementOptions.emettre(cle, (options as any)[cle]);
  return !actuelle;
}

// Chargement à l'import : caméra/effets/boucle/audio doivent voir les valeurs persistées dès la première frame.
chargerOptions();