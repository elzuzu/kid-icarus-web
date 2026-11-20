import { O as Signal } from "../../app";
import { Element } from "./combat";
import { Ennemi } from "./ennemi";
import {
  Comportement,
  approcherScalaire,
  borner,
  lerpVecteur,
  normaliser,
  pivoter,
  rad,
  tuiles,
} from "./comportements";

const tauBoss = Math.PI * 2;
const quotient = (a: number, b: number) => Math.trunc(a / b);
const geler = (o: any) => Object.freeze(o);

const tirFeu = geler({
  base: 12,
  element: Element.FEU,
  vitesse: 8.5,
  gravite: 0,
  visuel: "boule_feu",
});
const tirOnde = geler({ base: 16, vitesse: 10.5, visuel: "onde", vie: 2.2, rayon: 0.45 });
const tirPierre = geler({ base: 15, vitesse: 9, gravite: 16, visuel: "pierre", rayon: 0.4 });
const tirGlace = geler({
  base: 13,
  element: Element.GLACE,
  vitesse: 10,
  visuel: "glace",
  statuts: [{ id: "gel", duree: 1.4, puissance: 1 }],
});
Object.freeze({ base: 14, element: Element.GLACE, vitesse: 8, visuel: "eau", rayon: 0.35 });
const tirVenin = geler({
  base: 12,
  element: Element.POISON,
  vitesse: 10,
  gravite: 16,
  visuel: "venin",
  rayon: 0.3,
  statuts: [{ id: "poison", duree: 3, puissance: 2 }],
});
const tirEclat = geler({ base: 16, vitesse: 13, visuel: "eclat", rayon: 0.25 });
const tirOrbe = geler({ base: 15, vitesse: 7, visuel: "orbe", rayon: 0.35 });
const tirOrbeLourd = geler({ base: 18, vitesse: 2, gravite: 10, visuel: "orbe", rayon: 0.3 });
const tirRegard = geler({
  base: 16,
  vitesse: 24,
  visuel: "venin",
  vie: 1.2,
  rayon: 0.3,
  statuts: [{ id: "gel", duree: 1.2, puissance: 1 }],
});

const fusionner = (base: any, extra: any) => ({ ...base, ...extra });
const estBoss = (e: any) => "demanderVent" in e && "phaseChangee" in e;
const cibleDe = (e: any) => (e.cibleVivante() ? e.cible : null);

export class CerveauBoss extends Comportement {
  repertoire: string[][] = [[]];
  attaque = "";
  attenteMin = 1.1;
  attenteMax = 1.9;
  preparation = 0.6;
  dureeAttaque = 0;
  boiteNormale = { x: 0, y: 0, l: 0, h: 0 };
  // Fenêtre de punition générique : après chaque attaque, le boss reste
  // immobile et vulnérable (dégâts ×1.6) pendant ~1.3 s, rétrécie par phase.
  // Les sous-classes peuvent forcer une fenêtre plus généreuse après un
  // engagement lourd (punitionForcee) — c'est le rythme lecture → esquive →
  // punition qui empêche le boss d'être une éponge à dégâts.
  punitionRestante = 0;
  punitionMult = 1.6;
  punitionDuree = 1.3;
  punitionForcee: { duree: number; mult: number } | null = null;
  aPunition = new Signal();

  demarrer(e: any) {
    this.etat = "entree";
    this.minuterie = 0;
    this.boiteNormale = { ...e.combattant.boite };
    e.combattant.sensibiliteRecul = 0;
  }

  changerPhase(e: any, _phase: number) {
    if (this.etat === "attaque") this.interrompre(e, this.attaque);
    this.fermerPunition(e);
    if (e.volant) e.vy = 0;
    this.etat = "rugit";
    this.minuterie = 0;
    e.combattant.invulnerable = 1.2;
    this.attenteMin *= 0.8;
    this.attenteMax *= 0.8;
  }

  phase(e: any): number {
    return estBoss(e) ? e.phase : 0;
  }

  simuler(e: any, dt: number) {
    this.minuterie += dt;
    switch (this.etat) {
      case "entree":
        e.etatVisuel = "idle";
        if (this.minuterie > 1.5) this.attendre(e, false);
        break;
      case "rugit":
        e.etatVisuel = "prepare";
        e.vx = 0;
        if (this.minuterie > 1.2) this.attendre(e, false);
        break;
      case "attente":
        e.etatVisuel = "idle";
        if (this.punitionRestante > 0) {
          this.punitionRestante -= dt;
          e.vx = 0;
          if (e.volant) e.vy = 0;
          if (this.punitionRestante <= 0) e.combattant.multDegatsRecus = 1;
        } else this.deriver(e, dt);
        if (this.minuterie > this.dureeAttaque) {
          const liste = this.repertoire[Math.min(this.phase(e), this.repertoire.length - 1)] ?? [];
          this.attaque = liste[e.rng.randiRange(0, liste.length - 1)] ?? "";
          this.etat = "prepare";
          this.minuterie = 0;
          this.fermerPunition(e);
          this.preparer(e, this.attaque);
        }
        break;
      case "prepare":
        e.etatVisuel = "prepare";
        if (this.minuterie > this.preparation) {
          this.etat = "attaque";
          this.minuterie = 0;
          this.dureeAttaque = this.lancer(e, this.attaque);
        }
        break;
      case "attaque":
        e.etatVisuel = "attaque";
        this.pendant(e, this.attaque, dt);
        if (this.minuterie > this.dureeAttaque) {
          this.finir(e, this.attaque);
          e.combattant.boite = { ...this.boiteNormale };
          this.attendre(e);
        }
    }
  }

  attendre(e: any, punir = true) {
    this.etat = "attente";
    this.minuterie = 0;
    this.dureeAttaque = e.rng.randfRange(this.attenteMin, this.attenteMax);
    if (punir) this.ouvrirPunition(e);
  }

  ouvrirPunition(e: any) {
    const spec = this.punitionForcee;
    this.punitionForcee = null;
    const duree = spec?.duree ?? Math.max(0.7, this.punitionDuree - 0.15 * this.phase(e));
    const mult = spec?.mult ?? this.punitionMult;
    this.punitionRestante = duree;
    // Le repos couvre la fenêtre entière : la punition n'est pas tronquée
    // par l'attaque suivante (sinon elle disparaîtrait aux phases rapides).
    this.dureeAttaque = Math.max(this.dureeAttaque, duree + 0.1);
    e.combattant.multDegatsRecus = Math.max(e.combattant.multDegatsRecus, mult);
    this.aPunition.emettre(e, duree, mult);
  }

  fermerPunition(e: any) {
    this.punitionRestante = 0;
    this.punitionForcee = null;
    e.combattant.multDegatsRecus = 1;
  }

  deriver(_e: any, _dt: number) {}

  preparer(e: any, _attaque: string) {
    e.face = e.versCible().x > 0 ? 1 : -1;
  }

  lancer(_e: any, _attaque: string): number {
    return 0.5;
  }

  pendant(_e: any, _attaque: string, _dt: number) {}

  finir(_e: any, _attaque: string) {}

  interrompre(e: any, _attaque: string) {
    this.fermerPunition(e);
    e.combattant.boite = { ...this.boiteNormale };
    this.demanderVent(e, 0);
  }

  eventail(e: any, nombre: number, ecart: number, tir: any) {
    const dir = normaliser(e.versCible());
    for (let i = 0; i < nombre; i++) {
      const tournee = pivoter(dir, rad((i - (nombre - 1) / 2) * ecart));
      e.tirer(tournee.x, tournee.y, tir);
    }
  }

  anneau(e: any, nombre: number, dephasage: number, tir: any) {
    for (let i = 0; i < nombre; i++) {
      const angle = rad(dephasage + (i * 360) / nombre);
      e.tirer(Math.cos(angle), Math.sin(angle), tir);
    }
  }

  invoquer(e: any, id: string, nombre: number, rayon = 3) {
    for (let i = 0; i < nombre; i++) {
      const angle = (tauBoss * i) / nombre + e.rng.randf() * 0.5,
        centre = e.centre(),
        portee = tuiles(rayon);
      e.invocation.emettre(
        id,
        centre.x + Math.cos(angle) * portee,
        centre.y - Math.abs(Math.sin(angle)) * portee,
      );
    }
  }

  ondesAuSol(e: any, tir: any = tirOnde) {
    for (const sens of [-1, 1])
      e.tirer(sens, 0, {
        ...tir,
        origine: { x: e.x + sens * e.taille.x * 0.5, y: e.y - tuiles(0.45) },
      });
  }

  chuteDuCiel(e: any, x: number, nombre: number, ecart: number, tir: any) {
    const haut = (cibleDe(e)?.y ?? e.y) - tuiles(8.5);
    for (let i = 0; i < nombre; i++) {
      const origine = {
        x: x + ((i - (nombre - 1) / 2) * tuiles(ecart) + e.rng.randfRange(-6, 6)),
        y: haut - e.rng.randfRange(0, tuiles(2)),
      };
      e.tirer(0, 1, { ...tir, origine, vie: 4 });
    }
  }

  demanderVent(e: any, vent: number) {
    if (estBoss(e)) e.demanderVent(vent);
  }
}

class MereDesJarres extends CerveauBoss {
  constructor() {
    super();
    this.repertoire = [
      ["morsure", "crachat", "portee", "morsure"],
      ["morsure", "crachat", "bond", "portee", "crachat"],
      ["morsure", "crachat", "bond", "pluie", "portee", "morsure"],
    ];
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "morsure": {
        const boite = e.combattant.boite,
          extension = tuiles(3.5);
        e.combattant.boite = {
          x: boite.x - (e.face < 0 ? extension : 0),
          y: boite.y + boite.h * 0.35,
          l: boite.l + extension,
          h: boite.h * 0.4,
        };
        return 0.5;
      }
      case "crachat":
        this.eventail(e, this.phase(e) === 0 ? 3 : 5, 14, tirFeu);
        return 0.6;
      case "portee":
        this.invoquer(e, "shemum", this.phase(e) < 2 ? 2 : 3, 2.5);
        return 0.8;
      case "bond":
        e.vx = e.face * tuiles(9);
        e.vy = -tuiles(14);
        return 1.1;
      case "pluie":
        for (let i = 0; i < 8; i++) {
          const vitesse = e.rng.randfRange(5, 9),
            dir = pivoter({ x: 0, y: -1 }, e.rng.randfRange(-0.9, 0.9));
          e.tirer(dir.x, dir.y, fusionner(tirFeu, { gravite: 14, vitesse }));
        }
        return 1;
    }
    return 0.5;
  }

  finir(e: any, attaque: string) {
    if (attaque === "bond") {
      const tir = {
        base: 14,
        element: Element.FEU,
        vitesse: 10,
        visuel: "boule_feu",
        vie: 2.5,
      };
      for (const sens of [-1, 1]) e.tirer(sens, 0, tir);
      e.vx = 0;
    }
  }
}

class FaucheurAncien extends CerveauBoss {
  ancre = { x: 0, y: 0 };
  hauteurFauchage = 0;

  constructor() {
    super();
    this.repertoire = [
      ["fauchage", "ames", "lanterne"],
      ["fauchage", "ames", "fauchage", "lanterne"],
      ["fauchage", "ames", "fauchage", "lanterne", "ames"],
    ];
  }

  demarrer(e: any) {
    super.demarrer(e);
    this.ancre = { x: e.x, y: e.y };
  }

  deriver(e: any, _dt: number) {
    const x = this.ancre.x + Math.sin(e.age * 0.8) * tuiles(5),
      y = this.ancre.y + Math.cos(e.age * 1.3) * tuiles(1);
    e.vx = (x - e.x) * 2.5;
    e.vy = (y - e.y) * 2.5;
  }

  preparer(e: any, attaque: string) {
    super.preparer(e, attaque);
    this.hauteurFauchage = cibleDe(e)?.y ?? e.y;
    e.vx = 0;
    e.vy = 0;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "fauchage":
        e.corps.y = this.hauteurFauchage;
        e.vx = e.face * tuiles(16);
        e.vy = 0;
        return 1.3;
      case "ames": {
        const nombre = 4 + this.phase(e) * 2;
        for (let i = 0; i < nombre; i++) {
          const angle = (tauBoss * i) / (4 + this.phase(e) * 2);
          e.tirer(Math.cos(angle), Math.sin(angle), {
            base: 10,
            vitesse: 4.5,
            visuel: "boule_feu",
            vie: 5,
          });
        }
        return 0.8;
      }
      case "lanterne":
        this.invoquer(e, "reapette", 2 + this.phase(e), 3);
        return 0.8;
    }
    return 0.5;
  }

  finir(e: any, _attaque: string) {
    e.vx = 0;
    e.vy = 0;
  }
}

class OeilRuche extends CerveauBoss {
  ancre = { x: 0, y: 0 };
  visee = { x: 0, y: 0 };
  dephasage = 0;

  constructor() {
    super();
    this.repertoire = [
      ["laser", "essaim", "regard"],
      ["laser", "regard", "essaim", "laser"],
      ["spirale", "laser", "regard", "essaim", "spirale"],
    ];
    this.preparation = 0.8;
  }

  demarrer(e: any) {
    super.demarrer(e);
    this.ancre = { x: e.x, y: e.y };
  }

  deriver(e: any, _dt: number) {
    const x = this.ancre.x + Math.sin(e.age * 0.6) * tuiles(3),
      y = this.ancre.y + Math.sin(e.age * 1.1) * tuiles(1.5);
    e.vx = (x - e.x) * 2;
    e.vy = (y - e.y) * 2;
  }

  preparer(e: any, attaque: string) {
    super.preparer(e, attaque);
    this.visee = normaliser(e.versCible());
    e.vx = 0;
    e.vy = 0;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "laser":
        return 0.9;
      case "essaim":
        this.invoquer(e, "monoeye", 3 + this.phase(e), 3.5);
        return 0.7;
      case "regard":
        this.anneau(e, 12 + this.phase(e) * 4, e.rng.randf() * 30, {
          base: 11,
          vitesse: 7,
          visuel: "boule_feu",
        });
        return 0.6;
      case "spirale":
        return 2.4;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, dt: number) {
    if (attaque === "laser" && quotient(this.minuterie, dt) % 3 == 0)
      e.tirer(this.visee.x, this.visee.y, {
        base: 9,
        vitesse: 20,
        visuel: "boule_feu",
        vie: 1.2,
      });
    else if (attaque === "spirale" && quotient(this.minuterie, dt) % 5 == 0) {
      this.dephasage += 17;
      this.anneau(e, 4, this.dephasage, {
        base: 9,
        vitesse: 6.5,
        visuel: "boule_feu",
      });
    }
  }
}

class Twinbellows extends CerveauBoss {
  angle = 0;

  constructor() {
    super();
    this.repertoire = [
      ["charge", "souffle", "charge", "bond"],
      ["souffle", "charge", "bond", "pluie", "souffle"],
      ["charge", "balayage", "bond", "pluie", "charge", "souffle"],
    ];
    this.preparation = 0.7;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "charge":
        e.vx = e.face * tuiles(12 + 2 * this.phase(e));
        return 1.3;
      case "souffle": {
        this.eventail(e, 5 + this.phase(e), 11, tirFeu);
        const arriere = normaliser({ x: -e.face, y: -0.15 });
        for (let i = 0; i < 3; i++) {
          const dir = pivoter(arriere, rad((i - 1) * 14));
          e.tirer(dir.x, dir.y, tirFeu);
        }
        return 0.7;
      }
      case "bond":
        e.vx = borner(e.versCible().x * 1.2, -tuiles(10), tuiles(10));
        e.vy = -tuiles(16);
        return 1.2;
      case "pluie": {
        const nombre = 10 + 2 * this.phase(e);
        for (let i = 0; i < nombre; i++) {
          const vitesse = e.rng.randfRange(6, 11),
            dir = pivoter({ x: 0, y: -1 }, e.rng.randfRange(-1, 1));
          e.tirer(dir.x, dir.y, fusionner(tirFeu, { gravite: 15, vitesse }));
        }
        return 1;
      }
      case "balayage":
        this.angle = -40;
        return 1.6;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, dt: number) {
    if (attaque === "charge" && e.murDevant()) e.vx = 0;
    else if (attaque === "balayage" && quotient(this.minuterie, dt) % 4 == 0) {
      this.angle += 9;
      const dir = pivoter({ x: e.face, y: 0 }, rad(this.angle * e.face)),
        tir = {
          base: 11,
          element: Element.FEU,
          vitesse: 12,
          visuel: "boule_feu",
          vie: 1.2,
        };
      e.tirer(dir.x, dir.y, tir);
      e.tirer(-dir.x, dir.y, tir);
    }
  }

  finir(e: any, attaque: string) {
    e.vx = 0;
    if (attaque === "bond") {
      const tir = {
        base: 14,
        element: Element.FEU,
        vitesse: 10,
        visuel: "boule_feu",
        vie: 2.2,
      };
      for (const sens of [-1, 1]) e.tirer(sens, 0, tir);
    }
  }
}

class MinotaureAirain extends CerveauBoss {
  heurte = false;

  constructor() {
    super();
    this.repertoire = [
      ["charge", "hache", "charge", "hache"],
      ["charge", "hache", "tourbillon", "bond", "charge"],
      ["charge", "tourbillon", "hache", "bond", "charge", "hache"],
    ];
    this.preparation = 0.65;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "charge":
        this.heurte = false;
        e.vx = e.face * tuiles(13 + 2 * this.phase(e));
        return 1.8;
      case "hache":
        return 0.3;
      case "tourbillon": {
        const boite = e.combattant.boite,
          extension = tuiles(1.3);
        e.combattant.boite = {
          x: boite.x - extension,
          y: boite.y,
          l: boite.l + 2 * extension,
          h: boite.h,
        };
        return 1.9;
      }
      case "bond":
        e.vx = borner(e.versCible().x * 1.3, -tuiles(11), tuiles(11));
        e.vy = -tuiles(15);
        return 1.2;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, _dt: number) {
    if (
      attaque === "charge" &&
      !this.heurte &&
      this.minuterie > 0.1 &&
      (e.murDevant() || Math.abs(e.vx) < 1)
    ) {
      this.heurte = true;
      e.vx = 0;
      this.ondesAuSol(e);
      e.combattant.multDegatsRecus = 1.5;
    } else if (attaque === "tourbillon") {
      const vers = e.versCible();
      e.vx = Math.sign(vers.x) * tuiles(5.5 + this.phase(e));
    }
  }

  finir(e: any, attaque: string) {
    e.vx = 0;
    e.combattant.multDegatsRecus = 1;
    if (attaque === "hache" || attaque === "bond") {
      this.ondesAuSol(e);
      const cible = cibleDe(e);
      if (this.phase(e) >= 2 && cible) this.chuteDuCiel(e, cible.x, 5, 2.4, tirPierre);
    }
  }

  interrompre(e: any, attaque: string) {
    super.interrompre(e, attaque);
    e.combattant.multDegatsRecus = 1;
  }
}

class ReineGivre extends CerveauBoss {
  ancre = { x: 0, y: 0 };
  dephasage = 0;

  constructor() {
    super();
    this.repertoire = [
      ["stalactites", "rayon", "glissade", "rayon"],
      ["stalactites", "glissade", "gardes", "rayon", "stalactites"],
      ["tempete", "stalactites", "glissade", "rayon", "gardes", "tempete"],
    ];
    this.preparation = 0.7;
  }

  demarrer(e: any) {
    super.demarrer(e);
    this.ancre = { x: e.x, y: e.y };
  }

  deriver(e: any, _dt: number) {
    e.vx = (this.ancre.x + Math.sin(e.age * 0.6) * tuiles(5) - e.x) * 1.5;
  }

  preparer(e: any, attaque: string) {
    super.preparer(e, attaque);
    e.vx = 0;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "stalactites": {
        const x = cibleDe(e)?.x ?? this.ancre.x;
        this.chuteDuCiel(
          e,
          x,
          3 + this.phase(e) * 2,
          2,
          fusionner(tirGlace, { vitesse: 2, gravite: 22, rayon: 0.3 }),
        );
        return 0.8;
      }
      case "rayon":
        return 0.9;
      case "glissade":
        e.vx = e.face * tuiles(12 + this.phase(e));
        return 1.5;
      case "gardes":
        this.invoquer(e, "snowman", 2, 4);
        return 0.8;
      case "tempete":
        return 2.2;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, dt: number) {
    const tic = quotient(this.minuterie, dt);
    switch (attaque) {
      case "rayon":
        if (tic % 3 == 0) {
          const dir = pivoter({ x: e.face, y: 0 }, rad(-6 * e.face));
          e.tirer(dir.x, dir.y, fusionner(tirGlace, { vitesse: 20, vie: 1.1 }));
        }
        break;
      case "glissade":
        if (e.murDevant() || Math.abs(e.vx) < 1) e.vx = 0;
        else if (this.phase(e) >= 1 && tic % 10 == 0) {
          const tir: any = fusionner(tirGlace, { vitesse: 0.5, vie: 2, rayon: 0.35 });
          tir.origine = { x: e.x, y: e.y - tuiles(0.35) };
          e.tirer(-e.face, 0, tir);
        }
        break;
      case "tempete":
        if (tic % 9 == 0) {
          this.dephasage += 14;
          this.anneau(e, 8, this.dephasage, fusionner(tirGlace, { vitesse: 6 }));
        }
    }
  }

  finir(e: any, _attaque: string) {
    e.vx = 0;
  }
}

class CyclopeRoi extends CerveauBoss {
  angle = 0;

  constructor() {
    super();
    this.repertoire = [
      ["massue", "rocher", "pietinement", "rocher"],
      ["massue", "regard", "rocher", "pietinement", "massue"],
      ["regard", "massue", "appel", "rocher", "pietinement", "massue"],
    ];
    this.preparation = 0.8;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "massue":
        return 0.35;
      case "rocher": {
        const vers = e.versCible(),
          dir = {
            x: Math.sign(vers.x),
            y: -0.55 - borner(Math.abs(vers.x) / tuiles(30), 0, 0.5),
          },
          nombre = 1 + this.phase(e);
        for (let i = 0; i < nombre; i++) {
          const tournee = pivoter(dir, rad(-6 * i * Math.sign(vers.x)));
          e.tirer(
            tournee.x,
            tournee.y,
            fusionner(tirPierre, { base: 22, vitesse: 12 + 1.5 * i, rayon: 0.7 }),
          );
        }
        return 0.7;
      }
      case "regard":
        this.angle = 70;
        return 1.6;
      case "pietinement": {
        const nombre = 4 + this.phase(e) * 2;
        for (let i = 0; i < nombre; i++) {
          const x = e.x + e.rng.randfRange(-tuiles(9), tuiles(9));
          this.chuteDuCiel(e, x, 1, 0, tirPierre);
        }
        return 0.9;
      }
      case "appel":
        this.invoquer(e, "mick", 2, 3.5);
        return 0.8;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, dt: number) {
    if (attaque === "regard" && quotient(this.minuterie, dt) % 3 == 0) {
      this.angle = Math.max(this.angle - 3.2, 4);
      const dir = pivoter({ x: e.face, y: 0 }, rad(this.angle * e.face));
      e.tirer(dir.x, dir.y, {
        base: 12,
        element: Element.FEU,
        vitesse: 22,
        visuel: "lumiere",
        vie: 0.9,
      });
    }
  }

  finir(e: any, attaque: string) {
    if (attaque === "massue") {
      this.ondesAuSol(e, fusionner(tirOnde, { base: 20, vitesse: 11.5 }));
      const cible = cibleDe(e);
      if (this.phase(e) >= 1 && cible)
        this.chuteDuCiel(e, cible.x, 3 + this.phase(e), 2.6, tirPierre);
    }
  }
}

class Hewdraw extends CerveauBoss {
  constructor() {
    super();
    this.repertoire = [
      ["cascade", "morsure", "ruee", "queue"],
      ["cascade", "venin", "morsure", "ruee", "queue", "cascade"],
      ["cascade", "venin", "mue", "morsure", "ruee", "cascade"],
    ];
    this.preparation = 0.7;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "cascade":
        return 1.2;
      case "morsure": {
        const boite = e.combattant.boite,
          extension = tuiles(3.2);
        e.combattant.boite = {
          x: boite.x - (e.face < 0 ? extension : 0),
          y: boite.y,
          l: boite.l + extension,
          h: boite.h * 0.55,
        };
        return 0.45;
      }
      case "queue": {
        const boite = e.combattant.boite,
          extension = tuiles(2.8);
        e.combattant.boite = {
          x: boite.x - (e.face > 0 ? extension : 0),
          y: boite.y + boite.h * 0.5,
          l: boite.l + extension,
          h: boite.h * 0.5,
        };
        const tir: any = fusionner(tirOnde, {});
        tir.origine = {
          x: e.x - e.face * e.taille.x * 0.5,
          y: e.y - tuiles(0.45),
        };
        e.tirer(-e.face, 0, tir);
        return 0.5;
      }
      case "ruee":
        e.vx = e.face * tuiles(10 + this.phase(e));
        return 1.2;
      case "venin": {
        const nombre = 5 + this.phase(e);
        for (let i = 0; i < nombre; i++) {
          const dx = e.face * e.rng.randfRange(0.2, 1);
          e.tirer(dx, -1, fusionner(tirVenin, { vitesse: e.rng.randfRange(8, 13) }));
        }
        return 0.9;
      }
      case "mue":
        this.invoquer(e, "keron", 2, 2.5);
        return 0.7;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, dt: number) {
    const tic = quotient(this.minuterie, dt);
    if (attaque === "cascade") {
      if (tic === 1) this.eventail(e, 3 + this.phase(e), 12, fusionner(tirFeu, { base: 16 }));
      else if (tic === quotient(0.4, dt)) {
        const vers = e.versCible(),
          tir = fusionner(tirGlace, { vitesse: 16 });
        e.tirer(vers.x, vers.y, tir);
        const decalee = pivoter(e.versCible(), 0.08);
        e.tirer(decalee.x, decalee.y, tir);
      } else if (tic === quotient(0.8, dt)) {
        const vers = e.versCible();
        e.tirer(Math.sign(vers.x) * 0.7, -1, tirVenin);
      }
    } else if (attaque === "ruee" && (e.murDevant() || Math.abs(e.vx) < 1)) e.vx = 0;
  }

  finir(e: any, _attaque: string) {
    e.vx = 0;
  }
}

class ReineStymphale extends CerveauBoss {
  ancre = { x: 0, y: 0 };
  dir = { x: 0, y: 0 };

  constructor() {
    super();
    this.repertoire = [
      ["plumes", "pique", "plumes", "rafale"],
      ["plumes", "pique", "nichee", "rafale", "pique"],
      ["pique", "plumes", "rafale", "nichee", "pique", "plumes"],
    ];
    this.preparation = 0.65;
  }

  demarrer(e: any) {
    super.demarrer(e);
    this.ancre = { x: e.x, y: e.y };
  }

  deriver(e: any, _dt: number) {
    const x = this.ancre.x + Math.sin(e.age * 0.7) * tuiles(6),
      y = this.ancre.y + Math.sin(e.age * 1.4) * tuiles(1.2);
    e.vx = (x - e.x) * 2.2;
    e.vy = (y - e.y) * 2.2;
    e.face = e.versCible().x >= 0 ? 1 : -1;
  }

  preparer(e: any, attaque: string) {
    super.preparer(e, attaque);
    e.vx = 0;
    e.vy = 0;
    this.dir = normaliser(e.versCible());
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "plumes":
        this.eventail(e, 5 + this.phase(e) * 2, 11, tirEclat);
        return 0.6;
      case "pique": {
        const vitesse = tuiles(15 + this.phase(e) * 1.5);
        e.vx = this.dir.x * vitesse;
        e.vy = this.dir.y * vitesse;
        return 0.9;
      }
      case "rafale":
        return 1.2;
      case "nichee":
        this.invoquer(e, "oiseau_stymphale", 2, 3);
        return 0.7;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, _dt: number) {
    const cible = cibleDe(e);
    if (attaque === "pique" && this.minuterie > 0.55) {
      const v = lerpVecteur(
        { x: e.vx, y: e.vy },
        { x: (this.ancre.x - e.x) * 2, y: (this.ancre.y - e.y) * 2 },
        0.1,
      );
      e.vx = v.x;
      e.vy = v.y;
    } else if (attaque === "rafale" && cible)
      this.demanderVent(e, Math.sign(cible.x - e.x) * tuiles(7));
  }

  finir(e: any, attaque: string) {
    e.vx = 0;
    e.vy = 0;
    if (attaque === "rafale") this.demanderVent(e, 0);
  }
}

class Eole extends CerveauBoss {
  ancre = { x: 0, y: 0 };
  sens = 1;

  constructor() {
    super();
    this.repertoire = [
      ["souffle", "tornades", "souffle"],
      ["souffle", "vortex", "tornades", "souffle"],
      ["vortex", "eclairs", "souffle", "tornades", "eclairs"],
    ];
    this.preparation = 0.8;
  }

  demarrer(e: any) {
    super.demarrer(e);
    this.ancre = { x: e.x, y: e.y };
  }

  deriver(e: any, _dt: number) {
    const x = this.ancre.x + Math.sin(e.age * 0.5) * tuiles(5),
      y = this.ancre.y + Math.sin(e.age * 1.2) * tuiles(1);
    e.vx = (x - e.x) * 2;
    e.vy = (y - e.y) * 2;
    e.face = e.versCible().x >= 0 ? 1 : -1;
  }

  preparer(e: any, attaque: string) {
    super.preparer(e, attaque);
    e.vx = 0;
    e.vy = 0;
    this.sens = e.face;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "souffle":
        return 1.6;
      case "tornades": {
        const cible = cibleDe(e);
        for (let i = 0; i < 3; i++) {
          const tir: any = fusionner(tirOrbe, {
            vitesse: 6 + i * 1.5,
            vie: 4,
            rayon: 0.55,
            visuel: "onde",
          });
          tir.origine = cible ? { x: e.x, y: cible.y - tuiles(0.6) } : e.centre();
          e.tirer(this.sens, 0, tir);
        }
        return 0.8;
      }
      case "vortex":
        return 1.5;
      case "eclairs": {
        const cible = cibleDe(e);
        if (cible)
          for (let i = 0; i < 3; i++) {
            const x = cible.x + (i - 1) * tuiles(3);
            this.chuteDuCiel(e, x, 1, 0, {
              base: 22,
              element: Element.FOUDRE,
              vitesse: 24,
              visuel: "foudre",
              rayon: 0.4,
            });
          }
        return 0.9;
      }
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, dt: number) {
    const cible = cibleDe(e);
    if (!cible) return;
    const tic = quotient(this.minuterie, dt);
    switch (attaque) {
      case "souffle":
        this.demanderVent(e, this.sens * tuiles(6 + this.phase(e)));
        if (tic % 12 == 0) e.tirer(this.sens, e.rng.randfRange(-0.25, 0.25), tirOrbe);
        break;
      case "vortex":
        if (this.minuterie < 1.1) this.demanderVent(e, Math.sign(e.x - cible.x) * tuiles(5));
        else if (tic === quotient(1.1, dt)) {
          this.demanderVent(e, 0);
          this.anneau(e, 12 + this.phase(e) * 2, e.rng.randf() * 30, tirOrbe);
        }
    }
  }

  finir(e: any, _attaque: string) {
    e.vx = 0;
    e.vy = 0;
    this.demanderVent(e, 0);
  }
}

class Talos extends CerveauBoss {
  pas = 0;

  constructor() {
    super();
    this.repertoire = [
      ["poing", "rocher", "marche", "poing"],
      ["poing", "ichor", "rocher", "marche", "poing"],
      ["ichor", "poing", "marche", "rocher", "poing", "ichor"],
    ];
    this.preparation = 0.85;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "poing":
        return 0.3;
      case "rocher": {
        const vers = e.versCible(),
          dx = Math.sign(vers.x),
          dy = -0.6 - borner(Math.abs(vers.x) / tuiles(30), 0, 0.5);
        e.tirer(dx, dy, fusionner(tirPierre, { base: 26, vitesse: 13, rayon: 0.8 }));
        return 0.7;
      }
      case "ichor": {
        const cible = cibleDe(e);
        if (cible) {
          const nombre = 4 + this.phase(e);
          for (let i = 0; i < nombre; i++) {
            const x = cible.x + (i - (3 + this.phase(e)) / 2) * tuiles(2.2);
            this.chuteDuCiel(
              e,
              x,
              1,
              0,
              fusionner(tirFeu, { base: 18, vitesse: 1, gravite: 18, rayon: 0.35 }),
            );
          }
        }
        return 0.9;
      }
      case "marche":
        this.pas = 0;
        return 1.8;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, _dt: number) {
    if (attaque !== "marche") return;
    const vers = e.versCible();
    e.vx = Math.sign(vers.x) * tuiles(2.5);
    const tic = Math.trunc(this.minuterie / 0.6);
    if (tic > this.pas) {
      this.pas = tic;
      const cible = cibleDe(e);
      if (cible) this.chuteDuCiel(e, cible.x + e.rng.randfRange(-1, 1) * tuiles(4), 2, 3, tirPierre);
    }
  }

  finir(e: any, attaque: string) {
    e.vx = 0;
    if (attaque === "poing") {
      this.ondesAuSol(e, fusionner(tirOnde, { base: 22, vitesse: 11 }));
      if (this.phase(e) >= 2) this.ondesAuSol(e, fusionner(tirOnde, { base: 18, vitesse: 7 }));
    }
  }
}

class Pandora extends CerveauBoss {
  ancre = { x: 0, y: 0 };
  visee = { x: 0, y: 0 };
  dephasage = 0;

  constructor() {
    super();
    this.repertoire = [
      ["rayon", "runes", "fouet", "runes"],
      ["rayon", "aureole", "fouet", "runes", "rayon"],
      ["aureole", "rayon", "runes", "fouet", "aureole", "rayon"],
    ];
    this.preparation = 0.75;
  }

  demarrer(e: any) {
    super.demarrer(e);
    this.ancre = { x: e.x, y: e.y };
  }

  deriver(e: any, _dt: number) {
    const x = this.ancre.x + Math.sin(e.age * 0.8) * tuiles(7),
      y = this.ancre.y + Math.sin(e.age * 1.6) * tuiles(2);
    e.vx = (x - e.x) * 2.2;
    e.vy = (y - e.y) * 2.2;
    e.face = e.versCible().x >= 0 ? 1 : -1;
    e.fondu = approcherScalaire(e.fondu, this.phase(e) >= 2 ? 0.8 : 0, 0.05);
    if (this.phase(e) >= 2)
      e.combattant.invulnerable = Math.max(e.combattant.invulnerable, 0.1);
  }

  preparer(e: any, attaque: string) {
    super.preparer(e, attaque);
    e.fondu = 0;
    e.vx = 0;
    e.vy = 0;
    this.visee = normaliser(e.versCible());
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "rayon":
        return 1.2;
      case "fouet": {
        const boite = e.combattant.boite,
          extension = tuiles(3);
        e.combattant.boite = {
          x: boite.x - (e.face < 0 ? extension : 0),
          y: boite.y + boite.h * 0.2,
          l: boite.l + extension,
          h: boite.h * 0.6,
        };
        return 0.5;
      }
      case "runes":
        this.anneau(e, 8 + this.phase(e) * 2, e.rng.randf() * 45, {
          base: 16,
          vitesse: 9,
          visuel: "lumiere",
          vie: 2.5,
        });
        return 0.6;
      case "aureole":
        return 2;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, dt: number) {
    const tic = quotient(this.minuterie, dt);
    if (attaque === "rayon" && tic % 3 == 0) {
      const dir = pivoter(this.visee, rad((this.minuterie / 1.2 - 0.5) * 50 * e.face));
      e.tirer(dir.x, dir.y, { base: 11, vitesse: 22, visuel: "lumiere", vie: 1 });
    } else if (attaque === "aureole" && tic % 8 == 0) {
      this.dephasage += 19;
      this.anneau(e, 5, this.dephasage, {
        base: 13,
        vitesse: 6.5,
        visuel: "orbe",
      });
    }
  }

  finir(e: any, _attaque: string) {
    e.vx = 0;
    e.vy = 0;
  }
}

class Tanatos extends CerveauBoss {
  ancre = { x: 0, y: 0 };
  dir = { x: 0, y: 0 };
  hauteur = 0;

  constructor() {
    super();
    this.repertoire = [
      ["croissant", "boomerang", "ruee", "boomerang"],
      ["croissant", "ames", "ruee", "boomerang", "croissant"],
      ["ruee", "ames", "ombres", "croissant", "boomerang", "ruee"],
    ];
    this.preparation = 0.65;
  }

  demarrer(e: any) {
    super.demarrer(e);
    this.ancre = { x: e.x, y: e.y };
  }

  deriver(e: any, _dt: number) {
    const x = this.ancre.x + Math.sin(e.age * 0.6) * tuiles(3),
      y = this.ancre.y + Math.sin(e.age * 1.3) * tuiles(3.5);
    e.vx = (x - e.x) * 2.2;
    e.vy = (y - e.y) * 2.2;
    e.face = e.versCible().x >= 0 ? 1 : -1;
  }

  preparer(e: any, attaque: string) {
    super.preparer(e, attaque);
    e.vx = 0;
    e.vy = 0;
    this.dir = normaliser(e.versCible());
    const cible = cibleDe(e);
    this.hauteur = cible ? cible.y - tuiles(0.7) : e.y;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "croissant": {
        const boite = e.combattant.boite,
          extension = tuiles(2.6);
        e.combattant.boite = {
          x: boite.x - (e.face < 0 ? extension : 0),
          y: boite.y,
          l: boite.l + extension,
          h: boite.h,
        };
        this.eventail(e, 3 + this.phase(e), 16, {
          base: 18,
          vitesse: 12,
          visuel: "onde",
          vie: 1,
          rayon: 0.4,
        });
        return 0.5;
      }
      case "boomerang":
        e.tirer(this.dir.x, this.dir.y, {
          base: 20,
          vitesse: 15,
          visuel: "onde",
          vie: 0.8,
          rayon: 0.5,
        });
        return 1.7;
      case "ruee":
        e.corps.y = this.hauteur;
        e.vx = e.face * tuiles(18);
        e.vy = 0;
        return 1.1;
      case "ames": {
        const cible = cibleDe(e);
        if (cible) this.chuteDuCiel(e, cible.x, 5 + this.phase(e), 2.2, tirOrbeLourd);
        return 0.8;
      }
      case "ombres":
        this.invoquer(e, "minos", 2, 3);
        return 0.7;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, dt: number) {
    if (attaque === "boomerang" && quotient(this.minuterie, dt) === quotient(0.85, dt)) {
      const centre = e.centre(),
        portee = tuiles(12);
      e.tirer(-this.dir.x, -this.dir.y, {
        base: 20,
        vitesse: 15,
        visuel: "onde",
        vie: 0.8,
        rayon: 0.5,
        origine: { x: centre.x + this.dir.x * portee, y: centre.y + this.dir.y * portee },
      });
    } else if (attaque === "ruee" && this.minuterie > 0.7) {
      const v = lerpVecteur(
        { x: e.vx, y: e.vy },
        { x: (this.ancre.x - e.x) * 2, y: (this.ancre.y - e.y) * 2 },
        0.12,
      );
      e.vx = v.x;
      e.vy = v.y;
    }
  }

  finir(e: any, _attaque: string) {
    e.vx = 0;
    e.vy = 0;
  }
}

class Medusa extends CerveauBoss {
  ancre = { x: 0, y: 0 };
  hauteurYeux = 0;
  rueeHeurte = false;

  constructor() {
    super();
    this.repertoire = [
      ["regard", "serpents", "anneau", "serpents"],
      ["regard", "pluie", "serpents", "anneau", "regard"],
      ["couvee", "regard", "pluie", "ruee", "anneau", "serpents", "regard"],
      ["fureur", "anneau", "couvee", "ruee", "fureur", "serpents", "pluie", "ruee"],
    ];
    this.preparation = 0.85;
  }

  demarrer(e: any) {
    super.demarrer(e);
    this.ancre = { x: e.x, y: e.y + tuiles(4) };
  }

  deriver(e: any, _dt: number) {
    const x = this.ancre.x + Math.sin(e.age * 0.5) * tuiles(4),
      y = this.ancre.y + Math.sin(e.age * 1.1) * tuiles(0.6);
    e.vx = (x - e.x) * 1.8;
    e.vy = (y - e.y) * 1.8;
    e.face = e.versCible().x >= 0 ? 1 : -1;
  }

  changerPhase(e: any, phase: number) {
    super.changerPhase(e, phase);
    this.preparation = Math.max(0.55, this.preparation - 0.08);
  }

  preparer(e: any, attaque: string) {
    super.preparer(e, attaque);
    e.vx = 0;
    e.vy = 0;
    const cible = cibleDe(e);
    this.hauteurYeux = cible ? cible.y - tuiles(0.7) : e.y;
  }

  lancer(e: any, attaque: string): number {
    switch (attaque) {
      case "regard":
      case "fureur":
        if (attaque === "fureur") this.pluie(e);
        return 1.2;
      case "serpents":
        this.eventail(e, 5 + this.phase(e), 10, fusionner(tirVenin, { vitesse: 12, gravite: 0 }));
        return 0.6;
      case "anneau":
        this.ondesAuSol(e, fusionner(tirOnde, { base: 22, vitesse: 10, visuel: "venin" }));
        return 0.9;
      case "pluie":
        this.pluie(e);
        return 1;
      case "couvee":
        this.invoquer(e, "serpent_medusa", 2, 3);
        return 0.7;
      case "ruee":
        // Ruée horizontale : télégraphe court (prepare), traversal rapide,
        // choc contre le bord de l'arène → grand étourdissement punissable.
        this.rueeHeurte = false;
        e.vy = 0;
        e.vx = e.face * tuiles(15 + 2 * this.phase(e));
        return 1.0;
    }
    return 0.5;
  }

  pendant(e: any, attaque: string, dt: number) {
    const tic = quotient(this.minuterie, dt);
    if (attaque === "ruee") {
      if (!this.rueeHeurte && this.minuterie > 0.1 && (e.murDevant() || Math.abs(e.vx) < 1)) {
        this.rueeHeurte = true;
        e.vx = 0;
        this.ondesAuSol(e, fusionner(tirOnde, { base: 18, vitesse: 9, visuel: "venin" }));
        this.punitionForcee = { duree: 2.2, mult: 2.0 };
      }
      return;
    }
    if ((attaque === "regard" || attaque === "fureur") && this.minuterie > 0.3 && tic % 3 == 0) {
      e.tirer(e.face, 0, fusionner(tirRegard, { origine: { x: e.x, y: this.hauteurYeux } }));
      if (attaque === "fureur")
        e.tirer(-e.face, 0, fusionner(tirRegard, { origine: { x: e.x, y: e.y - tuiles(0.5) } }));
    } else if (
      attaque === "anneau" &&
      tic === quotient(0.45, dt) &&
      this.phase(e) >= 2
    )
      this.ondesAuSol(e, fusionner(tirOnde, { base: 18, vitesse: 7, visuel: "venin" }));
  }

  pluie(e: any) {
    const nombre = 8 + this.phase(e) * 2;
    for (let i = 0; i < nombre; i++) {
      const dx = e.rng.randfRange(-0.9, 0.9);
      e.tirer(dx, -1, fusionner(tirVenin, { vitesse: e.rng.randfRange(8, 13) }));
    }
  }

  finir(e: any, attaque: string) {
    e.vx = 0;
    e.vy = 0;
    // Épuisement après les engagements lourds : fenêtres de punition
    // généreuses et lisibles (le boss s'arrête, étincelles dorées via
    // aPunition côté visuel).
    if (attaque === "regard" || attaque === "fureur")
      this.punitionForcee = { duree: 1.8, mult: 1.75 };
    else if (attaque === "ruee" && !this.rueeHeurte)
      this.punitionForcee = { duree: 1.5, mult: 1.7 };
  }
}

const cerveaux: Record<string, () => CerveauBoss> = {
  mere_des_jarres: () => new MereDesJarres(),
  faucheur_ancien: () => new FaucheurAncien(),
  oeil_ruche: () => new OeilRuche(),
  twinbellows: () => new Twinbellows(),
  minotaure_airain: () => new MinotaureAirain(),
  reine_givre: () => new ReineGivre(),
  cyclope_roi: () => new CyclopeRoi(),
  hewdraw: () => new Hewdraw(),
  reine_stymphale: () => new ReineStymphale(),
  eole: () => new Eole(),
  talos: () => new Talos(),
  pandora: () => new Pandora(),
  tanatos: () => new Tanatos(),
  medusa: () => new Medusa(),
};

export function creerCerveau(id: string): CerveauBoss {
  const fabrique = Object.hasOwn(cerveaux, id) ? cerveaux[id] : void 0;
  if (fabrique) return fabrique();
  console.error(`Boss inconnu : ${id}`);
  return new MereDesJarres();
}

export class Boss extends Ennemi {
  definition: any;
  phase = 0;
  seuils: number[];
  titre: string;
  vent = 0;
  phaseChangee = new Signal();
  ventDemande = new Signal();

  constructor(def: any, combat: any, niveau: any, cible: any, rng: any, multPv = 1, multDegats = 1) {
    super(def, combat, niveau, cible, rng, (id: string) => creerCerveau(id));
    this.definition = def;
    this.seuils = [...(def.phases ?? [])];
    this.titre = def.titre ?? "";
    const c = this.combattant;
    c.sensibiliteRecul = 0;
    c.elite = true;
    c.pvMax = Math.round(c.pvMax * multPv);
    c.pv = c.pvMax;
    const degats = def.degats ?? 1;
    this.meta.mult_degats_intensite = multDegats;
    this.meta.degats_mult = degats;
    if (c.degatsContact && c.degatsContact.base !== void 0) c.degatsContact.base *= degats;
    c.touche.connecter(() => this.verifierPhase());
    c.mort.connecter(() => this.demanderVent(0));
  }

  get cerveau(): CerveauBoss | null {
    return this.comportement instanceof CerveauBoss ? this.comportement : null;
  }

  demanderVent(vent: number) {
    if (vent !== this.vent) {
      this.vent = vent;
      this.ventDemande.emettre(vent);
    }
  }

  verifierPhase() {
    const ratio = this.combattant.pv / Math.max(1, this.combattant.pvMax);
    while (this.phase < this.seuils.length && ratio <= (this.seuils[this.phase] ?? 0)) {
      this.phase += 1;
      this.phaseChangee.emettre(this.phase);
      this.cerveau?.changerPhase(this, this.phase);
    }
  }
}