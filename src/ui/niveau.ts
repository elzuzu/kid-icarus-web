export enum TypeTuile {
  VIDE = 0,
  SOLIDE = 1,
  PLATEFORME = 2,
  PENTE_MONTANTE = 3,
  PENTE_DESCENDANTE = 4,
  PICS = 5,
  LAVE = 6,
  FRIABLE = 7,
  GRILLE = 8,
}

const caracteres: Record<string, number> = {
  ".": 0,
  "#": 1,
  "=": 2,
  "/": 3,
  "\\": 4,
  "^": 5,
  "~": 6,
  "%": 7,
  "|": 8,
};

export class Niveau {
  id = "";
  nom = "";
  type = "vertical";
  largeur = 0;
  hauteur = 0;
  boucle = false;
  kit = "";
  musique = "";
  grille = new Uint8Array();
  depart = { c: -1, l: -1 };
  arrivees: { c: number; l: number }[] = [];
  checkpoints: { c: number; l: number }[] = [];
  portes: any[] = [];
  boss = { c: -1, l: -1 };
  marqueurs: any[] = [];
  definition: any = {};
  annexe: Niveau | null = null;
  annexeLigne = 0;

  dimensionner(largeur: number, hauteur: number) {
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.grille = new Uint8Array(largeur * hauteur);
  }

  dansGrille(c: number, l: number) {
    return (
      l >= 0 &&
      l < this.hauteur &&
      (this.boucle || (c >= 0 && c < this.largeur))
    );
  }

  tuile(c: number, l: number): number {
    if (l < 0 && this.annexe) {
      const decalée = l - this.annexeLigne;
      return decalée >= 0 && decalée < this.annexe.hauteur
        ? this.annexe.tuile(c, decalée)
        : 0;
    }
    if (l < 0 || l >= this.hauteur) return 0;
    if (this.boucle) c = ((c % this.largeur) + this.largeur) % this.largeur;
    else if (c < 0 || c >= this.largeur) return 1;
    return this.grille[l * this.largeur + c];
  }

  poser(c: number, l: number, tuile: number) {
    this.grille[l * this.largeur + c] = tuile;
  }

  estBloquant(c: number, l: number) {
    const tuile = this.tuile(c, l);
    return tuile === 1 || tuile === 7 || tuile === 8;
  }

  estAppui(c: number, l: number) {
    const tuile = this.tuile(c, l);
    return tuile === 1 || tuile === 7 || tuile === 2 || tuile === 3 || tuile === 4;
  }

  estDanger(c: number, l: number) {
    const tuile = this.tuile(c, l);
    return tuile === 5 || tuile === 6;
  }

  tailleSalle() {
    const salle = this.definition.salle ?? [0, 0];
    return { c: Number(salle[0] ?? 0), l: Number(salle[1] ?? 0) };
  }

  salleDe(pos: { c: number; l: number }) {
    const taille = this.tailleSalle();
    return taille.c <= 0
      ? { c: -1, l: -1 }
      : { c: Math.floor(pos.c / taille.c), l: Math.floor(pos.l / taille.l) };
  }

  largeurPx() {
    return this.largeur * 16;
  }

  hauteurPx() {
    return this.hauteur * 16;
  }
}

export function lignesChunk(texte: string): string[] {
  const lignes = texte
    .replace(/\r/g, "")
    .split("\n")
    .map((ligne) => ligne.replace(/\s+$/, ""));
  while (lignes.length && lignes[0] === "") lignes.shift();
  while (lignes.length && lignes[lignes.length - 1] === "") lignes.pop();
  return lignes;
}

export function construireNiveau(
  definition: any,
  chunks: string[][],
): { niveau: Niveau; erreurs: string[] } {
  const erreurs: string[] = [];
  const niveau = new Niveau();
  niveau.definition = definition;
  niveau.id = String(definition.id ?? "");
  niveau.nom = String(definition.nom ?? niveau.id);
  niveau.type = definition.type ?? "vertical";
  niveau.boucle = !!(definition.boucle ?? niveau.type === "vertical");
  niveau.kit = String(definition.kit ?? "");
  niveau.musique = String(definition.musique ?? "");
  if (chunks.length === 0) return { niveau, erreurs: ["aucun chunk"] };
  let lignes: string[];
  if (niveau.type === "horizontal" || niveau.type === "shmup")
    lignes = assemblerHorizontal(chunks, erreurs);
  else
    lignes = assemblerVertical(
      chunks,
      Number(definition.largeur ?? chunks[0]?.[0]?.length ?? 0),
      erreurs,
    );
  if (erreurs.length) return { niveau, erreurs };
  niveau.dimensionner(lignes[0]?.length ?? 0, lignes.length);
  const marqueurs = definition.marqueurs ?? {};
  const portes = definition.portes ?? [];
  let nbPortes = 0;
  for (let l = niveau.hauteur - 1; l >= 0; l--) {
    const ligne = lignes[l] ?? "";
    for (let c = 0; c < niveau.largeur; c++) {
      const car = ligne[c] ?? ".";
      const pos = { c, l };
      const tuile = caracteres[car];
      if (tuile !== undefined) niveau.poser(c, l, tuile);
      else if (car === "S") {
        if (niveau.depart.c !== -1)
          erreurs.push(
            `départ multiple (${niveau.depart.c},${niveau.depart.l} et ${c},${l})`,
          );
        niveau.depart = pos;
      } else if (car === "G") niveau.arrivees.push(pos);
      else if (car === "C") niveau.checkpoints.push(pos);
      else if (car === "B") niveau.boss = pos;
      else if (car === "D") {
        niveau.portes.push({ pos, chambre: portes[nbPortes] ?? "hasard" });
        nbPortes++;
      } else if (car >= "a" && car <= "z") {
        const def = marqueurs[car];
        if (def) niveau.marqueurs.push({ car, pos, def });
        else
          erreurs.push(
            `marqueur '${car}' non défini (ligne ${l}, colonne ${c})`,
          );
      } else
        erreurs.push(`caractère inconnu '${car}' (ligne ${l}, colonne ${c})`);
    }
  }
  if (niveau.depart.c === -1) erreurs.push("aucun départ 'S'");
  const sansArrivee = niveau.type === "forteresse" || !!definition.sans_arrivee;
  if (!niveau.arrivees.length && niveau.boss.c === -1 && !sansArrivee)
    erreurs.push("ni arrivée 'G' ni boss 'B'");
  if (nbPortes < portes.length)
    erreurs.push(
      `${portes.length - nbPortes} porte(s) décrite(s) dans stage.json mais absente(s) de la carte`,
    );
  return { niveau, erreurs };
}

function assemblerVertical(
  chunks: string[][],
  largeur: number,
  erreurs: string[],
): string[] {
  const lignes: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i] ?? [];
    chunk.forEach((ligne, l) => {
      if (ligne.length !== largeur)
        erreurs.push(
          `chunk ${i} ligne ${l} : ${ligne.length} colonnes au lieu de ${largeur}`,
        );
    });
    lignes.push(...chunk);
  }
  return lignes;
}

function assemblerHorizontal(chunks: string[][], erreurs: string[]): string[] {
  const hauteur = chunks[0]?.length ?? 0;
  const lignes: string[] = Array(hauteur).fill("");
  chunks.forEach((chunk, i) => {
    if (chunk.length !== hauteur) {
      erreurs.push(`chunk ${i} : ${chunk.length} lignes au lieu de ${hauteur}`);
      return;
    }
    const largeur = chunk[0]?.length ?? 0;
    chunk.forEach((ligne, l) => {
      if (ligne.length !== largeur)
        erreurs.push(`chunk ${i} ligne ${l} : largeur irrégulière`);
      lignes[l] += ligne;
    });
  });
  return lignes;
}

export async function chargerNiveau(
  chemin: string,
  lireTexte: (url: string) => Promise<string>,
): Promise<Niveau> {
  const definition = JSON.parse(await lireTexte(chemin));
  const base = chemin.replace(/[^/]+$/, "") + "chunks/";
  const noms: string[] = definition.chunks ?? [];
  const { niveau, erreurs } = construireNiveau(
    definition,
    await Promise.all(
      noms.map(async (nom) => lignesChunk(await lireTexte(`${base}${nom}.txt`))),
    ),
  );
  if (erreurs.length) throw new Error(`${chemin} : ${erreurs.join(" ; ")}`);
  return niveau;
}