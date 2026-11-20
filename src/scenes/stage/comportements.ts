export class Comportement {
  params: any = {};
  etat = "";
  minuterie = 0;

  demarrer(_ennemi: any) {}

  surCoup(_ennemi: any, _coup: any) {}

  param(cle: string, defaut: any) {
    const v = this.params[cle];
    return v === void 0 ? defaut : v;
  }

  static tuiles(n: number): number {
    return n * 16;
  }
}

export const vecteurNul = { x: 0, y: 0 };
export const tau = Math.PI * 2;
export const tuiles = (n: number) => Comportement.tuiles(n);
export const rad = (deg: number) => (deg * Math.PI) / 180;
export const borner = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const norme = (v: any) => Math.hypot(v.x, v.y);
export const ajouter = (a: any, b: any) => ({ x: a.x + b.x, y: a.y + b.y });
export const multiplier = (v: any, k: number) => ({ x: v.x * k, y: v.y * k });
export const vecteurAngle = (a: number) => ({ x: Math.cos(a), y: Math.sin(a) });
export const angleDe = (v: any) => Math.atan2(v.y, v.x);
export const lerpVecteur = (a: any, b: any, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const normaliser = (v: any) => {
  const n = norme(v);
  return n > 0 ? { x: v.x / n, y: v.y / n } : { x: 0, y: 0 };
};
export const limiter = (v: any, max: number) => {
  const n = norme(v);
  return n > 0 && max < n ? { x: (v.x / n) * max, y: (v.y / n) * max } : { x: v.x, y: v.y };
};
export const pivoter = (v: any, angle: number) => {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};
export const approcherScalaire = (v: number, cible: number, pas: number) =>
  Math.abs(cible - v) <= pas ? cible : v + Math.sign(cible - v) * pas;
export const approcherAngle = (angle: number, cible: number, pas: number) => {
  const r = (cible - angle) % tau,
    delta = ((2 * r) % tau) - r,
    absolu = Math.abs(delta);
  return angle + borner(pas, absolu - Math.PI, absolu) * (delta >= 0 ? 1 : -1);
};
export const velocite = (e: any) => ({ x: e.vx, y: e.vy });
export const fixerVelocite = (e: any, v: any) => {
  e.vx = v.x;
  e.vy = v.y;
};
export const signeStrict = (v: number) => (v > 0 ? 1 : -1);
export const signe = (v: number) => (v >= 0 ? 1 : -1);

let economie: any = null;

export function brancherEconomie(hook: any) {
  economie = hook;
}

export class Marcheur extends Comportement {
  demarrer(e: any) {
    if (this.param("bouclier_frontal", false)) {
      e.combattant.meta.bouclier_frontal = 1;
      e.meta.bouclier_frontal = true;
    }
  }

  simuler(e: any, _dt: number) {
    const vers = e.versCible();
    if (this.param("poursuit", false) && e.cibleVivante() && Math.abs(vers.y) < tuiles(2) && Math.abs(vers.x) > 4)
      e.face = signeStrict(vers.x);
    if (e.estAuSol() && (!e.solDevant() || e.murDevant())) e.face = -e.face;
    e.vx = e.face * e.vitesse();
    e.etatVisuel = "marche";
  }
}

export const comportements: Record<string, any> = {
  marcheur: Marcheur,
  plongeur: class extends Comportement {
    dirPlongee = { x: 0, y: 0 };
    demarrer(_e: any) {
      this.etat = "approche";
    }
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      const vers = e.versCible();
      switch (this.etat) {
        case "approche": {
          const cible = ajouter(vers, {
            x: Math.sin(e.age * 1.7) * tuiles(3),
            y: -tuiles(this.param("hauteur_attente", 4.5)),
          });
          fixerVelocite(e, lerpVecteur(velocite(e), limiter(cible, e.vitesse()), 0.08));
          if (this.minuterie > this.param("attente", 1.2) && norme(vers) < tuiles(9)) {
            this.etat = "plongee";
            this.minuterie = 0;
            this.dirPlongee = normaliser(vers);
          }
          break;
        }
        case "plongee":
          fixerVelocite(e, multiplier(this.dirPlongee, tuiles(this.param("vitesse_plongee", 11)) * e.vitesseMult));
          if (this.minuterie > 0.7) {
            this.etat = "remonte";
            this.minuterie = 0;
          }
          break;
        case "remonte":
          fixerVelocite(e, lerpVecteur(velocite(e), { x: 0, y: -e.vitesse() }, 0.1));
          if (this.minuterie > 0.9) {
            this.etat = "approche";
            this.minuterie = 0;
          }
      }
      e.face = signe(e.vx);
      e.etatVisuel = this.etat === "plongee" ? "attaque" : "vol";
    }
  },
  sauteur: class extends Comportement {
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      if (e.estAuSol()) {
        e.vx = approcherScalaire(e.vx, 0, tuiles(20) * dt);
        e.etatVisuel = "idle";
        if (this.minuterie >= this.param("intervalle", 1.4)) {
          this.minuterie = 0;
          e.face = signeStrict(e.versCible().x);
          e.vx = e.face * e.vitesse();
          e.vy = -tuiles(this.param("impulsion", 9));
        }
      } else e.etatVisuel = "attaque";
    }
  },
  emergeant: class extends Comportement {
    demarrer(e: any) {
      this.etat = "cache";
      this.minuterie = e.rng.randfRange(0, 1);
      e.combattant.sensibiliteRecul = 0;
    }
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      const cycle = this.param("cycle", 3);
      e.vx = 0;
      switch (this.etat) {
        case "cache":
          e.combattant.invulnerable = 1;
          e.etatVisuel = "dort";
          if (this.minuterie > cycle * 0.5) {
            this.etat = "sort";
            this.minuterie = 0;
          }
          break;
        case "sort":
          e.combattant.invulnerable = 0;
          e.etatVisuel = "prepare";
          if (this.minuterie > 0.5) {
            e.face = signeStrict(e.versCible().x);
            const dir = pivoter({ x: e.face, y: 0 }, -e.face * rad(35));
            e.tirer(dir.x, dir.y, this.param("tir", {}));
            this.etat = "attaque";
            this.minuterie = 0;
          }
          break;
        case "attaque":
          e.etatVisuel = "attaque";
          if (this.minuterie > cycle * 0.4) {
            this.etat = "cache";
            this.minuterie = 0;
          }
      }
    }
  },
  patrouilleur: class extends Comportement {
    derniereInvocation = -99;
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      if (e.estAuSol() && (!e.solDevant() || e.murDevant())) e.face = -e.face;
      const vers = e.versCible();
      if (
        e.cibleVivante() &&
        Math.abs(vers.y) < tuiles(2) &&
        Math.abs(vers.x) < tuiles(this.param("vue", 9)) &&
        Math.sign(vers.x) === e.face &&
        this.etat !== "panique"
      ) {
        this.etat = "panique";
        this.minuterie = 0;
        if (e.age - this.derniereInvocation > 6) {
          this.derniereInvocation = e.age;
          const c = e.centre(),
            nombre = Math.trunc(this.param("nombre", 3));
          for (let i = 0; i < nombre; i++)
            e.invocation.emettre(
              String(this.param("invoque", "reapette")),
              c.x + (i - 1) * tuiles(2),
              c.y - tuiles(4 + i),
            );
        }
      }
      if (this.etat === "panique" && this.minuterie > this.param("panique", 6)) this.etat = "";
      e.vx = e.face * e.vitesse() * (this.etat === "panique" ? 2.2 : 1);
      e.etatVisuel = this.etat === "panique" ? "alerte" : "marche";
    }
  },
  chasseur: class extends Comportement {
    demarrer(e: any) {
      fixerVelocite(e, { x: 0, y: e.vitesse() });
    }
    simuler(e: any, dt: number) {
      const vers = e.versCible();
      fixerVelocite(
        e,
        multiplier(
          vecteurAngle(approcherAngle(angleDe(velocite(e)), angleDe(vers), this.param("virage", 2.5) * dt)),
          e.vitesse(),
        ),
      );
      e.face = signe(e.vx);
      e.etatVisuel = "vol";
    }
  },
  erratique: class extends Comportement {
    dir = { x: 1, y: 0 };
    simuler(e: any, dt: number) {
      this.minuterie -= dt;
      if (this.minuterie <= 0) {
        this.minuterie = this.param("changement", 0.7) * e.rng.randfRange(0.6, 1.4);
        const aleatoire = vecteurAngle(e.rng.randfRange(-Math.PI, Math.PI));
        this.dir = normaliser(ajouter(aleatoire, multiplier(normaliser(e.versCible()), 0.8)));
      }
      fixerVelocite(e, lerpVecteur(velocite(e), multiplier(this.dir, e.vitesse()), 0.12));
      e.face = signe(e.vx);
      e.etatVisuel = "vol";
    }
  },
  onduleur: class extends Comportement {
    simuler(e: any, _dt: number) {
      const vers = e.versCible();
      if (Math.abs(vers.x) > tuiles(1)) e.face = signeStrict(vers.x);
      const frequence = this.param("frequence", 2.2),
        onde = Math.cos(e.age * frequence * tau) * tuiles(this.param("amplitude", 1.5)) * frequence * tau;
      e.vx = e.face * e.vitesse();
      e.vy = borner(vers.y, -tuiles(2), tuiles(2)) + onde * 0.35;
      e.etatVisuel = "vol";
    }
  },
  tombeur: class extends Comportement {
    ancre = { x: 0, y: 0 };
    demarrer(e: any) {
      this.ancre = { x: e.x, y: e.y };
      this.etat = "guet";
    }
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      const vers = e.versCible();
      switch (this.etat) {
        case "guet":
          fixerVelocite(e, vecteurNul);
          e.etatVisuel = "idle";
          if (vers.y > 0 && Math.abs(vers.x) < tuiles(this.param("detection", 2.5))) {
            this.etat = "chute";
            this.minuterie = 0;
          }
          break;
        case "chute": {
          fixerVelocite(e, { x: 0, y: e.vitesse() });
          e.etatVisuel = "attaque";
          const col = Math.floor(e.x / 16),
            ligne = Math.floor((e.y + 2) / 16);
          if (this.minuterie > 2 || e.niveau.estBloquant(col, ligne)) {
            this.etat = "remonte";
            this.minuterie = 0;
          }
          break;
        }
        case "remonte": {
          const versAncre = { x: this.ancre.x - e.x, y: this.ancre.y - e.y };
          fixerVelocite(e, limiter(versAncre, tuiles(this.param("remontee", 3))));
          e.etatVisuel = "idle";
          if (norme(versAncre) < 2) this.etat = "guet";
          break;
        }
      }
    }
  },
  dormeur: class extends Comportement {
    demarrer(e: any) {
      this.etat = "dort";
      e.combattant.invulnerable = 999;
      e.combattant.sensibiliteRecul = 0;
    }
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      switch (this.etat) {
        case "dort":
          fixerVelocite(e, vecteurNul);
          e.etatVisuel = "dort";
          if (norme(e.versCible()) < tuiles(this.param("reveil", 4))) {
            this.etat = "reveil";
            this.minuterie = 0;
          }
          break;
        case "reveil":
          e.etatVisuel = "prepare";
          if (this.minuterie > 0.6) {
            this.etat = "chasse";
            e.combattant.invulnerable = 0;
            e.combattant.sensibiliteRecul = 0.6;
            fixerVelocite(e, multiplier(normaliser(e.versCible()), e.vitesse() * 0.3));
          }
          break;
        case "chasse": {
          const vers = e.versCible();
          fixerVelocite(
            e,
            multiplier(
              vecteurAngle(approcherAngle(angleDe(velocite(e)), angleDe(vers), this.param("virage", 1.6) * dt)),
              e.vitesse(),
            ),
          );
          e.face = signe(e.vx);
          e.etatVisuel = "vol";
          break;
        }
      }
    }
  },
  tourelle: class extends Comportement {
    demarrer(e: any) {
      e.combattant.sensibiliteRecul = 0;
      this.minuterie = e.rng.randfRange(0, 1);
    }
    simuler(e: any, dt: number) {
      fixerVelocite(e, vecteurNul);
      this.minuterie += dt;
      const vers = e.versCible();
      e.face = signeStrict(vers.x);
      const cadence = this.param("cadence", 2.2);
      e.etatVisuel = this.minuterie > cadence - 0.4 ? "prepare" : "idle";
      if (this.minuterie >= cadence && norme(vers) < tuiles(14)) {
        this.minuterie = 0;
        e.tirer(e.face, 0, this.param("tir", {}));
        e.etatVisuel = "attaque";
      }
    }
  },
  chargeur: class extends Comportement {
    demarrer(_e: any) {
      this.etat = "marche";
    }
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      const vers = e.versCible();
      switch (this.etat) {
        case "marche":
          if (e.cibleVivante() && Math.abs(vers.x) > 4) e.face = signeStrict(vers.x);
          if (!e.solDevant() || e.murDevant()) e.face = -e.face;
          e.vx = e.face * e.vitesse();
          e.etatVisuel = "marche";
          if (
            e.cibleVivante() &&
            Math.abs(vers.x) < tuiles(this.param("portee", 8)) &&
            Math.abs(vers.y) < tuiles(1.5)
          ) {
            this.etat = "prepare";
            this.minuterie = 0;
          }
          break;
        case "prepare":
          e.vx = 0;
          e.etatVisuel = "prepare";
          if (this.minuterie > this.param("preparation", 0.6)) {
            this.etat = "charge";
            this.minuterie = 0;
          }
          break;
        case "charge":
          e.vx = e.face * tuiles(this.param("vitesse_charge", 12)) * e.vitesseMult;
          e.etatVisuel = "attaque";
          if (this.minuterie > 1.2 || e.murDevant() || !e.solDevant()) {
            this.etat = "repos";
            this.minuterie = 0;
          }
          break;
        case "repos":
          e.vx = 0;
          e.etatVisuel = "idle";
          if (this.minuterie > this.param("repos", 1.5)) {
            this.etat = "marche";
            this.minuterie = 0;
          }
      }
    }
  },
  spectre: class extends Comportement {
    contact: any = null;
    demarrer(e: any) {
      this.contact = e.combattant.degatsContact;
      this.etat = "visible";
      this.minuterie = e.rng.randfRange(0, 1);
    }
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      const vers = e.versCible();
      switch (this.etat) {
        case "visible": {
          e.fondu = approcherScalaire(e.fondu, 0, dt * 3);
          const flottement = { x: 0, y: Math.sin(e.age * 2.4) * tuiles(1.2) };
          fixerVelocite(
            e,
            lerpVecteur(velocite(e), ajouter(multiplier(normaliser(vers), e.vitesse()), flottement), 0.05),
          );
          e.face = signeStrict(vers.x);
          e.etatVisuel = "vol";
          if (this.minuterie > this.param("visible", 2.6)) {
            this.etat = "fondu";
            this.minuterie = 0;
            e.combattant.degatsContact = null;
            e.combattant.invulnerable = 99;
          }
          break;
        }
        case "fondu":
          e.fondu = approcherScalaire(e.fondu, 0.85, dt * 3);
          fixerVelocite(e, lerpVecteur(velocite(e), multiplier(normaliser(vers), e.vitesse() * 1.8), 0.05));
          if (this.minuterie > this.param("fondu", 1.4)) {
            this.etat = "visible";
            this.minuterie = 0;
            e.combattant.degatsContact = this.contact;
            e.combattant.invulnerable = 0;
          }
      }
    }
  },
  lanceur: class extends Comportement {
    demarrer(_e: any) {
      this.etat = "marche";
      this.minuterie = 1;
    }
    simuler(e: any, dt: number) {
      this.minuterie -= dt;
      const vers = e.versCible();
      switch (this.etat) {
        case "marche":
          if (e.estAuSol() && (!e.solDevant() || e.murDevant())) e.face = -e.face;
          e.vx = e.face * e.vitesse();
          e.etatVisuel = "marche";
          if (
            this.minuterie <= 0 &&
            e.cibleVivante() &&
            Math.abs(vers.x) < tuiles(this.param("portee", 9)) &&
            Math.abs(vers.y) < tuiles(5)
          ) {
            this.etat = "prepare";
            this.minuterie = this.param("preparation", 0.6);
            e.face = signeStrict(vers.x);
          }
          break;
        case "prepare":
          e.vx = 0;
          e.etatVisuel = "prepare";
          if (this.minuterie <= 0) {
            this.lancer(e, vers);
            this.etat = "recup";
            this.minuterie = 0.5;
          }
          break;
        case "recup":
          e.vx = 0;
          e.etatVisuel = "attaque";
          if (this.minuterie <= 0) {
            this.etat = "marche";
            this.minuterie = this.param("recharge", 2.8);
          }
      }
    }
    lancer(e: any, vers: any) {
      const tir = structuredClone(this.param("tir", {})),
        gravite = tuiles(tir.gravite ?? 18),
        duree = borner(Math.abs(vers.x) / tuiles(7), 0.5, 1.2),
        visee = { x: vers.x / duree, y: (vers.y - 0.5 * gravite * duree * duree) / duree };
      tir.vitesse = norme(visee) / 16;
      const dir = normaliser(visee);
      e.tirer(dir.x, dir.y, tir);
    }
  },
  voleur: class extends Comportement {
    butin = 0;
    demarrer(_e: any) {
      this.etat = "chasse";
    }
    simuler(e: any, dt: number) {
      const vers = e.versCible();
      switch (this.etat) {
        case "chasse":
          if (e.cibleVivante()) e.face = signeStrict(vers.x);
          if (e.estAuSol() && e.murDevant()) e.vy = -tuiles(9);
          e.vx = e.face * e.vitesse();
          e.etatVisuel = "marche";
          if (e.cibleVivante() && norme(vers) < tuiles(0.9)) {
            const coeurs = economie?.coeurs() ?? 0;
            this.butin = Math.max(
              Math.trunc(this.param("vol_min", 15)),
              Math.round(coeurs * this.param("vol_pct", 0.15)),
            );
            this.butin = Math.min(this.butin, coeurs);
            economie?.ajouter(-this.butin);
            e.meta.butin = this.butin;
            e.combattant.degatsContact = null;
            this.etat = "fuite";
            this.minuterie = this.param("fuite", 7);
          }
          break;
        case "fuite":
          this.minuterie -= dt;
          e.face = vers.x > 0 ? -1 : 1;
          if (e.estAuSol() && (e.murDevant() || !e.solDevant())) e.vy = -tuiles(10);
          e.vx = e.face * e.vitesse() * 1.5;
          e.etatVisuel = "attaque";
          if (this.minuterie <= 0) {
            e.combattant.vivant = false;
            e.mortDepuis = 0;
          }
      }
    }
  },
  piqueur: class extends Comportement {
    dir = { x: 0, y: 0 };
    demarrer(_e: any) {
      this.etat = "place";
    }
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      const vers = e.versCible();
      switch (this.etat) {
        case "place": {
          const cible = ajouter(vers, {
            x: (vers.x === 0 ? 1 : -Math.sign(vers.x)) * tuiles(this.param("distance", 6)),
            y: -tuiles(2),
          });
          fixerVelocite(e, lerpVecteur(velocite(e), limiter(cible, e.vitesse()), 0.08));
          e.etatVisuel = "vol";
          if (this.minuterie > this.param("attente", 1.6) && norme(vers) < tuiles(11)) {
            this.etat = "prepare";
            this.minuterie = 0;
          }
          break;
        }
        case "prepare":
          fixerVelocite(e, lerpVecteur(velocite(e), multiplier(normaliser(vers), -tuiles(1.5)), 0.2));
          e.etatVisuel = "prepare";
          if (this.minuterie > this.param("preparation", 0.55)) {
            this.etat = "fonce";
            this.minuterie = 0;
            this.dir = normaliser(e.versCible());
          }
          break;
        case "fonce":
          fixerVelocite(e, multiplier(this.dir, tuiles(this.param("vitesse_charge", 14)) * e.vitesseMult));
          e.etatVisuel = "attaque";
          if (this.minuterie > this.param("duree", 0.8)) {
            this.etat = "place";
            this.minuterie = 0;
          }
      }
      e.face = signe(this.etat === "fonce" ? e.vx : vers.x);
    }
  },
  tireur_volant: class extends Comportement {
    demarrer(e: any) {
      this.minuterie = e.rng.randfRange(0, 1.2);
    }
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      const vers = e.versCible(),
        distance = tuiles(this.param("distance", 6.5)),
        cible = ajouter(
          ajouter(vers, {
            x: (vers.x === 0 ? 1 : -Math.sign(vers.x)) * distance,
            y: -tuiles(this.param("hauteur", 2.5)),
          }),
          {
            x: Math.sin(e.age * 1.3) * tuiles(1),
            y: Math.cos(e.age * 1.9) * tuiles(0.7),
          },
        );
      fixerVelocite(e, lerpVecteur(velocite(e), limiter(cible, e.vitesse()), 0.06));
      e.face = signeStrict(vers.x);
      const cadence = this.param("cadence", 2.4);
      e.etatVisuel = this.minuterie > cadence - 0.45 ? "prepare" : "vol";
      if (this.minuterie >= cadence && norme(vers) < tuiles(13)) {
        this.minuterie = 0;
        const nombre = Math.trunc(this.param("nombre", 1)),
          ecart = this.param("ecart", 14),
          dir = normaliser(vers);
        for (let i = 0; i < nombre; i++) {
          const tournee = pivoter(dir, rad((i - (nombre - 1) / 2) * ecart));
          e.tirer(tournee.x, tournee.y, this.param("tir", {}));
        }
        e.etatVisuel = "attaque";
      }
    }
  },
  orage: class extends Comportement {
    demarrer(e: any) {
      this.etat = "suit";
      this.minuterie = e.rng.randfRange(0, 1);
      e.combattant.sensibiliteRecul = 0.3;
    }
    simuler(e: any, dt: number) {
      this.minuterie += dt;
      const vers = e.versCible();
      switch (this.etat) {
        case "suit": {
          const cible = ajouter(vers, { x: 0, y: -tuiles(this.param("hauteur", 5)) });
          fixerVelocite(e, lerpVecteur(velocite(e), limiter(cible, e.vitesse()), 0.05));
          e.etatVisuel = "idle";
          if (
            this.minuterie > this.param("cadence", 3) &&
            Math.abs(vers.x) < tuiles(3) &&
            norme(vers) < tuiles(9)
          ) {
            this.etat = "gronde";
            this.minuterie = 0;
          }
          break;
        }
        case "gronde":
          fixerVelocite(e, lerpVecteur(velocite(e), vecteurNul, 0.2));
          e.etatVisuel = "prepare";
          if (this.minuterie > this.param("preparation", 0.8)) {
            e.tirer(0, 1, this.param("tir", {}));
            e.etatVisuel = "attaque";
            this.etat = "suit";
            this.minuterie = 0;
          }
      }
    }
  },
};

export const creerComportement = (nom: string, params: any) => {
  const Classe = Object.hasOwn(comportements, nom) ? comportements[nom] : void 0;
  let instance;
  if (Classe) instance = new Classe();
  else {
    console.error(`Comportement inconnu : ${nom}`);
    instance = new Marcheur();
  }
  instance.params = params;
  return instance;
};