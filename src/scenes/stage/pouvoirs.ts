import { O as Signal, m as pouvoirsEquipes } from "../../app";
import { r as Flux } from "../../core";
import { Camp, Element, Projectile } from "./combat";
import { EtatJoueur } from "./joueur";

export class Pouvoirs {
  stage: any;
  contenu: any;
  emplacements = ["", ""];
  recharges = new Map<string, number>();
  actifs = new Map<string, number>();
  multRecharge = 1;
  flux: any;
  utilise = new Signal();
  effetTermine = new Signal();

  constructor(stage: any, contenu: any, equipes: string[]) {
    this.stage = stage;
    this.contenu = contenu;
    equipes.slice(0, 2).forEach((id, i) => {
      this.emplacements[i] = id;
    });
    this.flux = new Flux(`${stage.graine}|pouvoirs|${stage.niveau.id}`);
  }

  appliquerMods(mods: any) {
    this.multRecharge = Math.max(0.3, 1 + (mods.joueurPct.get("recharge_pouvoirs") ?? 0) / 100);
  }

  rechargeTotale(id: string): number {
    return (this.contenu.entree("pouvoirs", id).recharge ?? 30) * this.multRecharge;
  }

  pret(id: string): boolean {
    return id !== "" && (this.recharges.get(id) ?? 0) <= 0;
  }

  charge(index: number): number {
    const id = this.emplacements[index] ?? "";
    return id ? 1 - (this.recharges.get(id) ?? 0) / this.rechargeTotale(id) : 0;
  }

  pas(intention: any, dt: number) {
    const stage = this.stage;
    if (stage.combat.estGele() || !stage.combattant.vivant) return;
    for (const [id, reste] of this.recharges) this.recharges.set(id, Math.max(0, reste - dt));
    for (const [id, reste] of [...this.actifs]) {
      if (id === "bouclier") this.bouclier();
      if (reste - dt <= 0) {
        this.actifs.delete(id);
        this.terminer(id);
      } else this.actifs.set(id, reste - dt);
    }
    if (!stage.enChambre) {
      if (intention.pouvoir1Presse) this.declencher(this.emplacements[0]);
      if (intention.pouvoir2Presse) this.declencher(this.emplacements[1]);
    }
  }

  declencher(id: string): boolean {
    if (!this.pret(id)) return false;
    const stage = this.stage,
      joueur = stage.joueur,
      effet = this.contenu.entree("pouvoirs", id).effet ?? {},
      val = (cle: string, defaut: number) => effet[cle] ?? defaut;
    switch (id) {
      case "soin":
        stage.combattant.soigner(Math.round((stage.pvMax * val("soin_pct", 35)) / 100));
        break;
      case "super_saut":
        joueur.corps.vy = -joueur.reglages.vitesseSaut * val("impulsion", 1.9);
        joueur.corps.auSol = false;
        joueur.etat = EtatJoueur.AIR;
        break;
      case "autoguidage":
        stage.arme.bonus.guidage = val("guidage", 3);
        this.actifs.set(id, val("duree", 10));
        break;
      case "pluie_fleches":
        this.pluie(Math.trunc(val("fleches", 24)), val("base", 14));
        break;
      case "bouclier":
        this.actifs.set(id, val("duree", 4));
        break;
      case "vitesse":
        joueur.multVitesse = 1 + val("vitesse_pct", 40) / 100;
        this.actifs.set(id, val("duree", 8));
        break;
      case "eclair":
        this.eclair(Math.trunc(val("cibles", 5)), val("base", 30));
        break;
      case "invisibilite":
        stage.invisible = true;
        this.actifs.set(id, val("duree", 5));
        break;
      default:
        console.warn(`Pouvoir sans effet : ${id}`);
    }
    this.recharges.set(id, this.rechargeTotale(id));
    this.utilise.emettre(id);
    return true;
  }

  terminer(id: string) {
    const stage = this.stage;
    if (id === "autoguidage") delete stage.arme.bonus.guidage;
    else if (id === "vitesse") stage.joueur.multVitesse = 1;
    else if (id === "invisibilite") stage.invisible = false;
    this.effetTermine.emettre(id);
  }

  pluie(nombre: number, base: number) {
    const stage = this.stage,
      centre = stage.joueur.centre();
    for (let i = 0; i < nombre; i++) {
      const projectile = new Projectile();
      projectile.x = projectile.precX = centre.x + this.flux.randfRange(-144, 144);
      projectile.y = projectile.precY = centre.y - 144 - this.flux.randfRange(0, 80);
      projectile.vx = this.flux.randfRange(-20, 20);
      projectile.vy = 352;
      projectile.camp = Camp.JOUEUR;
      projectile.attaque = { base, chance_critique: 0.05, recul: 60 };
      projectile.vie = 1.4;
      projectile.perce = 1;
      projectile.rayon = 5;
      projectile.visuel = "fleche_chargee";
      projectile.source = "pluie_fleches";
      projectile.auteur = stage.combattant;
      stage.combat.tirer(projectile);
    }
  }

  eclair(cibles: number, base: number) {
    const stage = this.stage,
      centre = stage.joueur.centre(),
      distance = (combattant: any) => {
        const e = stage.combat.ecart(centre.x, centre.y, combattant.centre().x, combattant.centre().y);
        return Math.hypot(e.x, e.y);
      },
      tries = stage.combat.combattants
        .filter((c: any) => c.camp === Camp.ENNEMI && c.vivant)
        .sort((a: any, b: any) => distance(a) - distance(b));
    // Moins de cibles que d'éclairs : les éclairs restants retombent sur la cible
    // la plus proche à demi-puissance — le pouvoir reste viable contre un boss seul.
    for (let i = 0; i < cibles && tries.length > 0; i++) {
      const cible = tries[Math.min(i, tries.length - 1)];
      stage.combat.appliquer(
        cible,
        {
          base: i < tries.length ? base : Math.max(1, Math.round(base * 0.5)),
          chance_critique: 0.1,
          element: Element.FOUDRE,
          statuts: [{ id: "gel", duree: 0.6, puissance: 1 }],
        },
        false,
        0,
        1,
        stage.combattant,
        "eclair",
      );
    }
  }

  bouclier() {
    const stage = this.stage;
    stage.joueur.invulnerable = Math.max(stage.joueur.invulnerable, 0.05);
    const boite = stage.combattant.boiteMonde();
    for (const projectile of stage.combat.projectiles)
      if (
        projectile.actif &&
        projectile.camp === Camp.ENNEMI &&
        !(
          projectile.x < boite.x - 10 ||
          projectile.x > boite.x + boite.l + 10 ||
          projectile.y < boite.y - 10 ||
          projectile.y > boite.y + boite.h + 10
        )
      ) {
        projectile.vx = -projectile.vx;
        projectile.vy = -projectile.vy;
        projectile.camp = Camp.JOUEUR;
        projectile.dejaTouches.clear();
        projectile.auteur = stage.combattant;
      }
  }
}

export function creerPouvoirs(progression: any): Pouvoirs {
  const pouvoirs = new Pouvoirs(
    progression.stage,
    progression.contenu,
    pouvoirsEquipes(progression.contenu, progression.profil),
  );
  pouvoirs.appliquerMods(progression.mods);
  progression.progressionAppliquee.connecter((mods: any) => {
    pouvoirs.appliquerMods(mods);
    const equipes = pouvoirsEquipes(progression.contenu, progression.profil);
    pouvoirs.emplacements[0] = equipes[0] ?? "";
    pouvoirs.emplacements[1] = equipes[1] ?? "";
  });
  progression.stage.modules.push(pouvoirs);
  return pouvoirs;
}