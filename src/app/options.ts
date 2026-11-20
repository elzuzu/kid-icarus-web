// Options de confort/accessibilité, persistées par le menu pause (lot C).
// Lues par la caméra (secousses), les effets (flashs) et la boucle (hitstop).
import { stockageLocal } from "./sauvegarde";

// Clé dédiée, séparée de la sauvegarde de partie : les options survivent à un changement de slot.
const CLE_OPTIONS = "kid-icarus-options";

export const options = {
  secousses: true,
  flashs: true,
  hitstop: true,
};

export type CleOption = keyof typeof options;

export function chargerOptions() {
  const brut = stockageLocal.lire(CLE_OPTIONS);
  if (!brut) return;
  try {
    const donnees = JSON.parse(brut);
    // On ne copie que des booléens connus : un stockage corrompu ne doit pas casser les lecteurs.
    for (const cle of Object.keys(options) as CleOption[])
      if (typeof donnees?.[cle] === "boolean") options[cle] = donnees[cle];
  } catch {
    // Stockage illisible : on garde les valeurs par défaut.
  }
}

export function sauvegarderOptions() {
  stockageLocal.ecrire(CLE_OPTIONS, JSON.stringify(options));
}

export function basculerOption(cle: CleOption): boolean {
  // Mutation en place : les autres modules lisent l'objet partagé en continu, effet immédiat.
  options[cle] = !options[cle];
  sauvegarderOptions();
  return options[cle];
}

// Chargement à l'import : caméra/effets/boucle doivent voir les valeurs persistées dès la première frame.
chargerOptions();