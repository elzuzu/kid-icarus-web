import { arrondi, nombreDe } from "./nombres";

const DRAPEAUX_ARME = ["perce", "perce_charge", "rebonds", "multi"];

export class Effets {
  armeAdd = new Map<string, number>();
  armePct = new Map<string, number>();
  armeFlags = new Map<string, number>();
  statuts: any[] = [];
  element = -1;
  joueurAdd = new Map<string, number>();
  joueurPct = new Map<string, number>();
  sources: string[] = [];

  ajouter(effet: any, source = "") {
    let stat = effet.stat ?? "",
      v = effet.v ?? 0,
      ajouter = (table: Map<string, number>, montant: number) => {
        table.set(stat, (table.get(stat) ?? 0) + montant);
      },
      mode = effet.mode ?? "add";
    switch (mode) {
      case "add":
        ajouter(this.armeAdd, v);
        break;
      case "pct":
        if (stat === "bonus_degats") ajouter(this.armeAdd, v / 100);
        else ajouter(this.armePct, v);
        break;
      case "pct_negatif":
        ajouter(this.armePct, -v);
        break;
      case "add_pct":
        ajouter(this.armeAdd, v / 100);
        break;
      case "flag":
        this.armeFlags.set(stat, v === 0 ? 1 : v);
        break;
      case "statut":
        this.statuts.push({
          id: effet.statut ?? "",
          duree: effet.duree ?? 2,
          puissance: v,
        });
        if (effet.element !== undefined) this.element = effet.element;
        break;
      case "joueur_add":
        ajouter(this.joueurAdd, v);
        break;
      case "joueur_pct":
        ajouter(this.joueurPct, v);
        break;
      case "joueur_pct_negatif":
        ajouter(this.joueurPct, -v);
        break;
      default:
        throw Error(`Mode d'effet inconnu : ${String(mode)} (${source})`);
    }
    if (source !== "" && !this.sources.includes(source)) this.sources.push(source);
  }

  appliquerArme(stats: any) {
    let copie = structuredClone(stats);
    for (let [stat, v] of this.armeAdd) copie[stat] = nombreDe(copie, stat) + v;
    for (let [stat, v] of this.armePct)
      if (copie[stat] !== undefined)
        copie[stat] = nombreDe(copie, stat) * Math.max(0.2, 1 + v / 100);
    for (let [stat, v] of this.armeFlags) copie[stat] = v;
    if (this.statuts.length) {
      let existants = copie.statuts;
      copie.statuts = [
        ...(Array.isArray(existants) ? existants : []),
        ...this.statuts.map((s) => ({ ...s })),
      ];
    }
    if (this.element >= 0) copie.element = this.element;
    for (let drapeau of DRAPEAUX_ARME)
      if (copie[drapeau] !== undefined) copie[drapeau] = arrondi(nombreDe(copie, drapeau));
    return copie;
  }

  joueur(stat: string, base = 0) {
    return (
      (base + (this.joueurAdd.get(stat) ?? 0)) *
      Math.max(0.1, 1 + (this.joueurPct.get(stat) ?? 0) / 100)
    );
  }

  drapeau(stat: string) {
    return this.armeFlags.has(stat);
  }
}