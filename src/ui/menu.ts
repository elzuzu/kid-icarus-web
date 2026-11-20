import { Container } from "pixi.js";
import "../core";

const delaiInitial = 0.35;
const delaiRepeat = 0.11;

type Bouton = Container & {
  actif: boolean;
  selectionne: boolean;
  dessiner(): void;
  action(): void;
};

interface EntreeMenu {
  deplacementX: number;
  deplacementY: number;
  sautPresse: boolean;
  interagirPresse: boolean;
  dashPresse: boolean;
  pausePresse: boolean;
}

export class Menu extends Container {
  boutons: Bouton[];
  index = 0;
  retour: (() => void) | null = null;
  lateral: ((sens: number) => void) | null = null;
  attente = 0;
  sensTenu = 0;
  sensLateral = 0;
  attenteLat = 0;

  constructor(boutons: Bouton[]) {
    super();
    this.boutons = boutons;
    boutons.forEach((bouton, i) => {
      this.addChild(bouton);
      bouton.on("pointerover", () => {
        if (bouton.actif) this.selectionner(i);
      });
      bouton.on("pointertap", () => {
        if (bouton.actif) {
          this.selectionner(i);
          bouton.action();
        }
      });
    });
    this.index = Math.max(
      0,
      boutons.findIndex((bouton) => bouton.actif),
    );
    this.rafraichir();
  }

  selectionner(index: number) {
    this.index = index;
    this.rafraichir();
  }

  rafraichir() {
    this.boutons.forEach((bouton, i) => {
      bouton.selectionne = i === this.index;
      bouton.dessiner();
    });
  }

  deplacer(sens: number) {
    const total = this.boutons.length;
    for (let n = 1; n <= total; n++) {
      const cible = (this.index + sens * n + total * n) % total;
      if (this.boutons[cible]?.actif) {
        this.selectionner(cible);
        return;
      }
    }
  }

  pas(dt: number, entree: EntreeMenu) {
    const sens =
      entree.deplacementY > 0.5 ? 1 : entree.deplacementY < -0.5 ? -1 : 0;
    if (sens === this.sensTenu) {
      if (sens) {
        this.attente -= dt;
        if (this.attente <= 0) {
          this.attente = delaiRepeat;
          this.deplacer(sens);
        }
      }
    } else {
      this.sensTenu = sens;
      this.attente = delaiInitial;
      if (sens) this.deplacer(sens);
    }
    const lateral =
      entree.deplacementX > 0.5 ? 1 : entree.deplacementX < -0.5 ? -1 : 0;
    if (lateral === this.sensLateral) {
      if (lateral) {
        this.attenteLat -= dt;
        if (this.attenteLat <= 0) {
          this.attenteLat = delaiRepeat;
          this.lateral?.(lateral);
        }
      }
    } else {
      this.sensLateral = lateral;
      this.attenteLat = delaiInitial;
      if (lateral) this.lateral?.(lateral);
    }
    if (entree.sautPresse || entree.interagirPresse) {
      const bouton = this.boutons[this.index];
      if (bouton?.actif) bouton.action();
    } else if (entree.dashPresse || entree.pausePresse) {
      this.retour?.();
    }
  }
}

export { Menu as t };