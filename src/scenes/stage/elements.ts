import { O as Signal } from "../../app";
import { a as Tuile } from "../../ui/hud";
import { Element } from "./combat";

const degatsPics = { base: 15, chance_critique: 0, recul: 0 };
const degatsLave = {
  base: 25,
  chance_critique: 0,
  recul: 0,
  element: Element.FEU,
  statuts: [{ id: "brulure", duree: 2, puissance: 2 }],
};
const degatsGeyser = {
  base: 18,
  chance_critique: 0,
  recul: 0,
  element: Element.FEU,
  statuts: [{ id: "brulure", duree: 2, puissance: 2 }],
};

export const dureeChargeFriable = 0.45;

export class ElementsStage {
  stage: any;
  friables: any[] = [];
  geysers: any[] = [];
  temps = 0;
  friableTremble = new Signal();
  friableTombe = new Signal();
  friableRevient = new Signal();
  geyserPhase = new Signal();

  constructor(stage: any) {
    this.stage = stage;
    const niveau = stage.niveau;
    for (let ligne = 0; ligne < niveau.hauteur; ligne++)
      for (let col = 0; col < niveau.largeur; col++)
        if (niveau.tuile(col, ligne) === Tuile.FRIABLE)
          this.friables.push({ c: col, l: ligne, charge: 0, absent: 0 });
    for (const marqueur of niveau.marqueurs)
      if (marqueur.def.element === "geyser")
        this.geysers.push({
          x: (marqueur.pos.c + 0.5) * 16,
          y: (marqueur.pos.l + 1) * 16,
          periode: Number(marqueur.def.periode ?? 3.2),
          decalage: Number(marqueur.def.decalage ?? 0),
          hauteur: Number(marqueur.def.hauteur ?? 6) * 16,
          phase: 0,
          jet: 0,
        });
  }

  get niveau() {
    return this.stage.niveau;
  }

  pas(_alpha: number, dt: number) {
    if (this.stage.combat.estGele()) return;
    this.temps += dt;
    this.mettreAJourGeysers();
    this.mettreAJourFriables(dt);
    if (this.stage.combattant.vivant && !this.stage.enChambre) this.dangers();
  }

  dangers() {
    const stage = this.stage,
      boite = stage.combattant.boiteMonde(),
      gauche = Math.floor((boite.x + 2) / 16),
      droite = Math.floor((boite.x + boite.l - 2) / 16),
      haut = Math.floor((boite.y + 2) / 16),
      bas = Math.floor((boite.y + boite.h - 2) / 16);
    for (let ligne = haut; ligne <= bas; ligne++)
      for (let col = gauche; col <= droite; col++) {
        const tuile = this.niveau.tuile(col, ligne);
        if (tuile !== Tuile.PICS && tuile !== Tuile.LAVE) continue;
        if (stage.combattant.peutEtreTouche())
          stage.combat.appliquer(
            stage.combattant,
            tuile === Tuile.PICS ? degatsPics : degatsLave,
            false,
            0,
            -1,
            null,
            tuile === Tuile.PICS ? "pics" : "lave",
          );
        const corps = stage.joueur.corps;
        if (corps.vy >= 0) {
          corps.vx *= 0.3;
          corps.vy = -208;
          corps.auSol = false;
        }
        return;
      }
  }

  sousLesPieds(friable: any): boolean {
    const joueur = this.stage.joueur;
    if (
      !joueur.corps.auSol ||
      !this.stage.combattant.vivant ||
      Math.floor((joueur.y + 2) / 16) !== friable.l
    )
      return false;
    const demi = joueur.reglages.largeur / 2,
      largeur = this.niveau.largeur,
      gauche = Math.floor((joueur.x - demi) / 16),
      droite = Math.floor((joueur.x + demi - 1) / 16);
    for (let col = gauche; col <= droite; col++)
      if ((this.niveau.boucle ? ((col % largeur) + largeur) % largeur : col) === friable.c) return true;
    return false;
  }

  occupee(friable: any): boolean {
    const boite = this.stage.combattant.boiteMonde(),
      x = friable.c * 16,
      y = friable.l * 16,
      largeurPx = this.niveau.largeurPx(),
      dx = this.niveau.boucle
        ? ((((boite.x - x) % largeurPx) + largeurPx + largeurPx / 2) % largeurPx) - largeurPx / 2
        : boite.x - x;
    return dx < 16 && dx + boite.l > 0 && boite.y < y + 16 && boite.y + boite.h > y;
  }

  mettreAJourFriables(dt: number) {
    for (const friable of this.friables) {
      if (friable.absent > 0) {
        friable.absent -= dt;
        if (friable.absent <= 0) {
          if (this.occupee(friable)) {
            friable.absent = 0.25;
            continue;
          }
          this.niveau.poser(friable.c, friable.l, Tuile.FRIABLE);
          this.friableRevient.emettre((friable.c + 0.5) * 16, (friable.l + 0.5) * 16);
        }
        continue;
      }
      const dessous = this.sousLesPieds(friable);
      if (dessous && friable.charge === 0)
        this.friableTremble.emettre((friable.c + 0.5) * 16, (friable.l + 0.5) * 16);
      if (dessous || friable.charge > 0) {
        friable.charge += dt;
        if (friable.charge >= dureeChargeFriable) {
          friable.charge = 0;
          friable.absent = 4;
          this.niveau.poser(friable.c, friable.l, Tuile.VIDE);
          this.friableTombe.emettre((friable.c + 0.5) * 16, (friable.l + 0.5) * 16);
        }
      }
    }
  }

  phaseGeyser(geyser: any): [number, number] {
    const t =
        (((this.temps + geyser.decalage * geyser.periode) % geyser.periode) + geyser.periode) %
        geyser.periode,
      debut = geyser.periode - 1;
    if (t >= debut) {
      const e = t - debut;
      return [2, Math.min(1, Math.max(0, Math.min(e / 0.12, (1 - e) / 0.2)))];
    }
    return [+(t >= debut - 0.9), 0];
  }

  mettreAJourGeysers() {
    for (const geyser of this.geysers) {
      const [phase, jet] = this.phaseGeyser(geyser);
      if (phase !== geyser.phase && phase > 0) this.geyserPhase.emettre(geyser.x, geyser.y, phase);
      geyser.phase = phase;
      geyser.jet = jet;
      if (phase === 2) this.toucherGeyser(geyser, geyser.hauteur * jet);
    }
  }

  toucherGeyser(geyser: any, hauteur: number) {
    const stage = this.stage;
    if (hauteur <= 1 || !stage.combattant.vivant || stage.enChambre || !stage.combattant.peutEtreTouche())
      return;
    const boite = stage.combattant.boiteMonde();
    let x = geyser.x;
    if (this.niveau.boucle) {
      const largeurPx = this.niveau.largeurPx(),
        centre = boite.x + boite.l / 2;
      x = centre + ((((x - centre) % largeurPx) + largeurPx + largeurPx / 2) % largeurPx) - largeurPx / 2;
    }
    const demiLargeur = 8.8;
    if (
      boite.x < x + demiLargeur &&
      boite.x + boite.l > x - demiLargeur &&
      boite.y < geyser.y &&
      boite.y + boite.h > geyser.y - hauteur
    ) {
      stage.combat.appliquer(stage.combattant, degatsGeyser, false, 0, -1, null, "geyser");
      stage.joueur.corps.vy = -240;
      stage.joueur.corps.vx *= 0.5;
      stage.joueur.corps.auSol = false;
    }
  }
}