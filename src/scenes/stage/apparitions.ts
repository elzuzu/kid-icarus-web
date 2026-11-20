import { O as Signal } from "../../app";
import { r as Flux } from "../../core";
import { Camera } from "./camera";
import { Camp, Combattant } from "./combat";
import { Ennemi } from "./ennemi";

const margeHaut = 4;
const margeBas = 1;
const intervalleJarre = 8;
const intervalleVague = 7;
const totalVague = 6;
const pvJarre = 24;

export class Apparitions {
  niveau: any;
  combat: any;
  cible: any;
  camera: Camera;
  defs: Map<string, any>;
  fabrique: any;
  graine: string;
  vivants: Ennemi[] = [];
  modificateur: ((e: Ennemi, marqueur: number) => void) | null = null;
  apparu = new Signal();
  jarreBrisee = new Signal();
  etats: any[];
  temps = 0;
  numero = 0;
  marqueurDe = new Map<Ennemi, number>();

  constructor(niveau: any, combat: any, cible: any, camera: Camera, defs: Map<string, any>, fabrique: any, graine = "partie") {
    this.niveau = niveau;
    this.combat = combat;
    this.cible = cible;
    this.camera = camera;
    this.defs = defs;
    this.fabrique = fabrique;
    this.graine = graine;
    this.etats = niveau.marqueurs.map(() => ({
      utilise: false,
      prochain: 0,
      vivants: 0,
      apparus: 0,
      jarre: null,
      brisee: false,
    }));
  }

  pas(dt: number) {
    this.temps += dt;
    const demi = Camera.demi(),
      camera = this.camera,
      haut = camera.cy - demi.y - margeHaut * 16,
      bas = camera.cy + demi.y + margeBas * 16,
      gauche = camera.cx - demi.x - 48,
      droite = camera.cx + demi.x + 48;
    this.niveau.marqueurs.forEach((marqueur: any, index: number) => {
      const def = marqueur.def,
        id = def.ennemi;
      if (typeof id != "string") return;
      const x = marqueur.pos.c * 16,
        y = marqueur.pos.l * 16;
      let visible = y >= haut && y <= bas;
      if (!this.niveau.boucle) visible &&= x >= gauche && x <= droite;
      if (!visible) return;
      const etat = this.etats[index];
      if (!etat) return;
      const mode = String(def.mode ?? "unique"),
        px = x + 8,
        py = mode === "jarre" ? this.solSous(marqueur.pos.c, marqueur.pos.l) : y + 16;
      if (mode === "unique") {
        if (!etat.utilise) {
          etat.utilise = true;
          this.creerInterne(id, px, py, def, index);
        }
      } else {
        if (mode === "jarre") {
          if (etat.brisee) return;
          if (!etat.jarre) {
            this.poserJarre(etat, px, py);
            etat.prochain = this.temps + 2 + (index % 3) * 2.5;
          }
        } else if (mode === "vague" && etat.apparus >= Number(def.total ?? totalVague)) return;
        if (this.temps < etat.prochain || etat.vivants >= Number(def.max ?? 3)) return;
        const plancher = mode === "jarre" ? intervalleJarre : mode === "vague" ? intervalleVague : 0;
        etat.prochain = this.temps + Math.max(plancher, Number(def.intervalle ?? 4) * 1.5);
        etat.apparus += 1;
        let spawnY = py;
        if (mode === "vague" && def.depuis_le_haut !== false) spawnY = camera.cy - demi.y - 16;
        const ennemi = this.creerInterne(id, px, spawnY, def, index);
        if (ennemi) {
          etat.vivants += 1;
          ennemi.aDisparu.connecter(() => {
            --etat.vivants;
            etat.prochain = Math.max(etat.prochain, this.temps + plancher + (index % 3) * 1.5);
          });
        }
      }
    });
    for (const e of [...this.vivants]) e.pas(dt);
  }

  jarres() {
    const liste: any[] = [];
    this.etats.forEach((etat) => {
      if (etat.jarre && etat.jarre.vivant)
        liste.push({
          x: etat.jarre.corps.x,
          y: etat.jarre.corps.y,
          combattant: etat.jarre,
        });
    });
    return liste;
  }

  poserJarre(etat: any, x: number, y: number) {
    const jarre = new Combattant({ x, y }, Camp.NEUTRE, pvJarre, "jarre");
    jarre.boite = { x: -9, y: -24, l: 18, h: 24 };
    jarre.mort.connecter(() => {
      etat.brisee = true;
      this.combat.retirer(jarre);
      this.jarreBrisee.emettre(x, y - 12);
    });
    this.combat.enregistrer(jarre);
    etat.jarre = jarre;
  }

  vider() {
    for (const e of [...this.vivants]) {
      const marqueur = this.marqueurDe.get(e),
        etat = marqueur === void 0 ? void 0 : this.etats[marqueur];
      if (etat) etat.utilise = false;
      e.retirer();
    }
    this.vivants.length = 0;
    this.marqueurDe.clear();
  }

  solSous(col: number, ligne: number): number {
    for (let i = 0; i <= 6; i++)
      if (this.niveau.estAppui(col, ligne + 1 + i) && !this.niveau.estBloquant(col, ligne + i))
        return (ligne + 1 + i) * 16;
    return (ligne + 1) * 16;
  }

  creer(id: string, x: number, y: number): Ennemi | null {
    return this.creerInterne(id, x, y, {}, -1);
  }

  creerInterne(id: string, x: number, y: number, def: any, marqueur: number): Ennemi | null {
    if (this.vivants.length >= 40) return null;
    const definition = this.defs.get(id);
    if (!definition) {
      console.error(`Ennemi inconnu : ${id}`);
      return null;
    }
    this.numero += 1;
    const ennemi = new Ennemi(
      definition,
      this.combat,
      this.niveau,
      this.cible,
      new Flux(`${this.graine}|ennemi|${this.niveau.id}|${marqueur}|${this.numero}`),
      this.fabrique,
    );
    ennemi.placer(x, y);
    if (marqueur >= 0 && String(def.mode ?? "unique") === "unique") this.marqueurDe.set(ennemi, marqueur);
    for (const affixe of def.elite ?? []) ennemi.elites.push(affixe);
    this.modificateur?.(ennemi, marqueur);
    this.combat.enregistrer(ennemi.combattant);
    this.vivants.push(ennemi);
    ennemi.invocation.connecter((idInvoc: string, ix: number, iy: number) => {
      this.creerInterne(idInvoc, ix, iy, {}, marqueur);
    });
    ennemi.aDisparu.connecter((e: Ennemi) => {
      const i = this.vivants.indexOf(e);
      if (i >= 0) this.vivants.splice(i, 1);
      this.marqueurDe.delete(e);
      this.combat.retirer(e.combattant);
    });
    ennemi.demarrer();
    this.apparu.emettre(ennemi);
    return ennemi;
  }
}