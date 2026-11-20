export class EtatEntrees {
  deplacementX = 0;
  deplacementY = 0;
  viseeX = 0;
  viseeY = 0;
  saut = false;
  sautPresse = false;
  dashPresse = false;
  tir = false;
  meleePresse = false;
  competencePresse = false;
  pouvoir1Presse = false;
  pouvoir2Presse = false;
  soinPresse = false;
  interagirPresse = false;
  pausePresse = false;

  copier() {
    return Object.assign(new EtatEntrees(), this);
  }

  static DRAPEAUX = [
    "saut",
    "sautPresse",
    "dashPresse",
    "tir",
    "meleePresse",
    "competencePresse",
    "pouvoir1Presse",
    "pouvoir2Presse",
    "soinPresse",
    "interagirPresse",
    "pausePresse",
  ];

  versTableau() {
    let drapeaux = 0;
    EtatEntrees.DRAPEAUX.forEach((drapeau, i) => {
      if ((this as any)[drapeau]) drapeaux |= 1 << i;
    });
    let arr = (v: number) => Math.round(v * 1e3) / 1e3;
    return [
      arr(this.deplacementX),
      arr(this.deplacementY),
      arr(this.viseeX),
      arr(this.viseeY),
      drapeaux,
    ];
  }

  static depuisTableau(tableau: number[]) {
    let etat = new EtatEntrees();
    etat.deplacementX = tableau[0] ?? 0;
    etat.deplacementY = tableau[1] ?? 0;
    etat.viseeX = tableau[2] ?? 0;
    etat.viseeY = tableau[3] ?? 0;
    let drapeaux = tableau[4] ?? 0;
    EtatEntrees.DRAPEAUX.forEach((drapeau, i) => {
      (etat as any)[drapeau] = !!(drapeaux & (1 << i));
    });
    return etat;
  }
}

export function fusionnerEntrees(source: EtatEntrees, etat: EtatEntrees) {
  let fusion = etat.copier();
  fusion.sautPresse ||= source.sautPresse;
  fusion.dashPresse ||= source.dashPresse;
  fusion.meleePresse ||= source.meleePresse;
  fusion.competencePresse ||= source.competencePresse;
  fusion.pouvoir1Presse ||= source.pouvoir1Presse;
  fusion.pouvoir2Presse ||= source.pouvoir2Presse;
  fusion.soinPresse ||= source.soinPresse;
  fusion.interagirPresse ||= source.interagirPresse;
  fusion.pausePresse ||= source.pausePresse;
  return fusion;
}

export function effacerPresses(etat: EtatEntrees) {
  let copie = etat.copier();
  copie.sautPresse = copie.dashPresse = copie.meleePresse = copie.competencePresse = false;
  copie.pouvoir1Presse =
    copie.pouvoir2Presse =
    copie.soinPresse =
    copie.interagirPresse =
    copie.pausePresse =
      false;
  return copie;
}

const ZONE_MORTE = 0.25;

export class Entrees {
  touches = new Set<string>();
  souris = { x: 0, y: 0, gauche: false, droite: false, bouge: false };
  precedent = {
    saut: false,
    dash: false,
    melee: false,
    competence: false,
    p1: false,
    p2: false,
    soin: false,
    interagir: false,
    pause: false,
  };
  directionSouris: ((x: number, y: number) => { x: number; y: number }) | null = null;
  manetteActive = false;

  get manette() {
    return this.manetteActive;
  }

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.touches.add(e.code);
      this.manetteActive = false;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code))
        e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.touches.delete(e.code));
    window.addEventListener("blur", () => this.touches.clear());
    canvas.addEventListener("mousemove", (e) => {
      let boite = canvas.getBoundingClientRect();
      this.souris.x = ((e.clientX - boite.left) / boite.width) * 1920;
      this.souris.y = ((e.clientY - boite.top) / boite.height) * 1080;
      this.souris.bouge = true;
      this.manetteActive = false;
    });
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.souris.gauche = true;
      if (e.button === 2) this.souris.droite = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.souris.gauche = false;
      if (e.button === 2) this.souris.droite = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  touche(...codes: string[]) {
    return codes.some((code) => this.touches.has(code));
  }

  lire() {
    let etat = new EtatEntrees(),
      dx = +!!this.touche("KeyD", "ArrowRight") - +!!this.touche("KeyA", "ArrowLeft"),
      dy = +!!this.touche("KeyS", "ArrowDown") - +!!this.touche("KeyW", "ArrowUp"),
      actions = {
        saut: this.touche("Space", "KeyK"),
        dash: this.touche("ShiftLeft", "ShiftRight", "KeyL"),
        melee: this.touche("KeyE") || this.souris.droite,
        competence: this.touche("KeyR"),
        p1: this.touche("Digit1", "KeyQ"),
        p2: this.touche("Digit2"),
        soin: this.touche("KeyF", "Digit3"),
        interagir: this.touche("KeyC", "Enter"),
        pause: this.touche("Escape", "KeyP"),
      },
      tir = this.touche("KeyJ") || this.souris.gauche,
      viseeX = 0,
      viseeY = 0,
      manette = navigator.getGamepads?.().find((g) => g && g.connected) ?? null;
    if (manette) {
      let axe = (i: number) => {
          let v = manette.axes[i] ?? 0;
          return Math.abs(v) > ZONE_MORTE ? v : 0;
        },
        bouton = (i: number) => (manette.buttons[i]?.value ?? 0) > 0.5,
        mx = axe(0) + +!!bouton(15) - +!!bouton(14),
        my = axe(1) + +!!bouton(13) - +!!bouton(12);
      if (mx !== 0 || my !== 0 || manette.buttons.some((b) => b.pressed))
        this.manetteActive = true;
      if (mx !== 0) dx = mx;
      if (my !== 0) dy = my;
      actions.saut ||= bouton(0);
      actions.dash ||= bouton(1);
      actions.melee ||= bouton(2);
      actions.p2 ||= bouton(3);
      actions.p1 ||= bouton(4);
      actions.soin ||= bouton(5);
      actions.competence ||= bouton(6);
      actions.pause ||= bouton(9);
      tir ||= bouton(7);
      let rx = axe(2),
        ry = axe(3);
      if (rx !== 0 || ry !== 0) {
        viseeX = rx;
        viseeY = ry;
        tir = true;
      }
    }
    if (
      tir &&
      this.souris.gauche &&
      dy > -0.5 &&
      viseeX === 0 &&
      viseeY === 0 &&
      !this.manetteActive &&
      this.directionSouris &&
      this.souris.bouge
    ) {
      let direction = this.directionSouris(this.souris.x, this.souris.y),
        norme = Math.hypot(direction.x, direction.y);
      if (norme > 1) {
        viseeX = direction.x / norme;
        viseeY = direction.y / norme;
      }
    }
    etat.deplacementX = Math.max(-1, Math.min(1, dx));
    etat.deplacementY = Math.max(-1, Math.min(1, dy));
    etat.viseeX = viseeX;
    etat.viseeY = viseeY;
    etat.tir = tir;
    etat.saut = actions.saut;
    etat.sautPresse = actions.saut && !this.precedent.saut;
    etat.dashPresse = actions.dash && !this.precedent.dash;
    etat.meleePresse = actions.melee && !this.precedent.melee;
    etat.competencePresse = actions.competence && !this.precedent.competence;
    etat.pouvoir1Presse = actions.p1 && !this.precedent.p1;
    etat.pouvoir2Presse = actions.p2 && !this.precedent.p2;
    etat.soinPresse = actions.soin && !this.precedent.soin;
    etat.interagirPresse = actions.interagir && !this.precedent.interagir;
    etat.pausePresse = actions.pause && !this.precedent.pause;
    this.precedent = actions;
    return etat;
  }
}