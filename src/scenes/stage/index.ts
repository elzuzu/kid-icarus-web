import { Assets, Container, Graphics, Sprite } from "pixi.js";
import {
  o as multPvIntensite,
  n as multDegatsIntensite,
  T as fusionnerIntention,
  E as intentionSansPresse,
} from "../../app";
import { n as largeurEcran, t as hauteurEcran, r as Flux } from "../../core";
import { r as chargerNiveau, n as renduTuiles, o as FiltreBloom, t as Hud } from "../../ui/hud";
import { n as textureHalo } from "../../render/textures";
import { base } from "./base";
import { chargerDecor, Monde } from "./monde";
import { Simulation } from "./simulation";
import { ReglagesJoueur } from "./joueur";
import { creerComportement } from "./comportements";
import { creerProgression } from "./progression";
import { creerGestionChambres } from "./chambres";
import { creerPouvoirs } from "./pouvoirs";
import { chargerTexturesObjets, VisuelObjets } from "./objets";
import { VisuelJoueur } from "./visuelJoueur";
import { VisuelEnnemi } from "./visuelEnnemi";
import { VisuelsProjectiles } from "./visuelProjectile";
import { EffetsCombat } from "./effets";
import { Camp } from "./combat";
import { chargerFlammes, Flammes } from "./flammes";
import { BarreBoss, SousTitres, Annonces, MenuPause } from "./hudStage";
import { brancherAudio } from "./audio";

const pasSimulation = 1 / 60,
  baseArt = `${base}assets/art/`;

export const lancer = async (ctx: any, params: any) => {
  const app = ctx.app,
    racine = ctx.racine,
    idStage = params.stage ?? (ctx.partie.stageDemande || "w1/1-1"),
    [niveau, reglagesJson, planchePit, texCoeur, texCoeurVide, texAile, texEtoile, texFiole, texFleche] =
      await Promise.all([
        chargerNiveau(`${base}levels/${idStage}/stage.json`, async (url: string) => (await fetch(url)).text()),
        fetch(`${base}data/reglages/joueur.json`).then((r) => r.json()),
        Assets.load(baseArt + "pit/pit.json"),
        ...["coeur", "coeur_vide", "aile", "etoile", "fiole", "fleche"].map((nom) =>
          Assets.load(`${baseArt}hud/${nom}.webp`),
        ),
      ]),
    kit = await chargerDecor(String(niveau.definition.ambiance ?? "")),
    sim = new Simulation(niveau, ReglagesJoueur.depuis(reglagesJson)),
    ennemisJson = await fetch(`${base}data/ennemis.json`).then((r) => r.json()),
    apparitions = sim.activerEnnemis(
      new Map(ennemisJson.entrees.map((e: any) => [e.id, e])),
      creerComportement,
    ),
    bossJson = await fetch(`${base}data/boss.json`).then((r) => r.json()),
    idBoss = String(niveau.definition.boss ?? "");
  sim.activerBoss(bossJson.entrees.find((e: any) => e.id === idBoss) ?? null);
  const partie = ctx.partie,
    intensite = Math.min(12, partie.profil.intensite + partie.bonusIntensite());
  sim.intensite = intensite;
  sim.multBoss = { pv: multPvIntensite(intensite), degats: multDegatsIntensite(intensite) };
  const progression = creerProgression(sim, ctx.contenu, partie.profil, intensite, {
    defi: partie.defi?.modificateurs ?? [],
  });
  progression.appliquerProgression();
  const chambres = creerGestionChambres(sim, ctx.contenu, progression),
    pouvoirs = creerPouvoirs(progression),
    sonsPouvoirs: Record<string, string> = {
      soin: "soin",
      super_saut: "double_saut",
      autoguidage: "benediction",
      pluie_fleches: "tir_charge",
      bouclier: "bouclier",
      vitesse: "vent_rafale",
      eclair: "eclair",
      invisibilite: "spectre",
    };
  (sim as any).chambres = chambres;
  pouvoirs.utilise.connecter((id: string) => ctx.audio.sfx(sonsPouvoirs[id] ?? "benediction"));
  const rngJarres = new Flux(`${sim.graine}|jarres|${niveau.id}`);
  apparitions.jarreBrisee.connecter((x: number, y: number) => {
    ctx.audio.sfx("jarre_brise", { position: { x, y } });
    progression.recompenses.lacher(x, y, rngJarres.randiRange(4, 9), rngJarres);
  });
  const largeurMonde = niveau.largeur * 64,
    vertical = niveau.type === "vertical",
    monde = new Monde(kit, niveau.boucle ? largeurMonde : largeurEcran, vertical);
  racine.addChild(monde.arriere);
  const plan = new Container();
  racine.addChild(plan);
  plan.addChild(renduTuiles(niveau, kit.tuiles, 0, niveau.hauteur));
  for (const marqueur of [niveau.depart, ...niveau.checkpoints]) {
    monde.accessoire(plan, (marqueur.c - 1.5) * 64, (marqueur.l + 1) * 64);
    monde.accessoire(plan, (marqueur.c + 2.5) * 64, (marqueur.l + 1) * 64);
  }
  const visuelObjets = new VisuelObjets(
    await chargerTexturesObjets(),
    sim,
    niveau,
    progression.recompenses,
    apparitions,
    chambres,
    kit.tuiles,
  );
  plan.addChild(visuelObjets);
  const visuelJoueur = new VisuelJoueur(planchePit, sim.joueur),
    conteneurEnnemis = new Container();
  plan.addChild(conteneurEnnemis, visuelJoueur);
  const planches = new Map<string, Promise<any>>(),
    visuelsEnnemis = new Map<any, VisuelEnnemi>(),
    precedents = new Map<any, { x: number; y: number }>();
  apparitions.apparu.connecter((ennemi: any) => {
    const id = ennemi.def.id;
    if (!planches.has(id))
      planches.set(id, Assets.load(`${baseArt}ennemis/${id}/${id}.json`).catch(() => null));
    planches.get(id)?.then((planche) => {
      if (!planche?.animations || ennemi.disparu) return;
      const visuel = new VisuelEnnemi(ennemi, planche);
      visuelsEnnemis.set(ennemi, visuel);
      conteneurEnnemis.addChild(visuel);
    });
    ennemi.aDisparu.connecter(() => {
      const visuel = visuelsEnnemis.get(ennemi);
      if (visuel) {
        conteneurEnnemis.removeChild(visuel);
        visuel.destroy();
      }
      visuelsEnnemis.delete(ennemi);
      precedents.delete(ennemi);
    });
  });
  const visuelsProjectiles = new VisuelsProjectiles(sim.combat),
    effetsCombat = new EffetsCombat(sim.combat);
  effetsCombat.brancherJoueur(sim.joueur);
  effetsCombat.brancherProgression(progression);
  plan.addChild(visuelsProjectiles, effetsCombat);
  visuelJoueur.aGlisse.connecter((biais: number) =>
    effetsCombat.bouffiere(sim.joueur.x, sim.joueur.y, biais),
  );
  apparitions.apparu.connecter((ennemi: any) =>
    ennemi.combattant.touche.connecter(() => {
      const b = ennemi.combattant.boiteToucheMonde();
      effetsCombat.etincelles(b.x + b.l / 2, b.y + b.h / 2, 16766826, 6, 260, 0, 0);
    }),
  );
  const haloBouclier = new Sprite(textureHalo(128));
  haloBouclier.anchor.set(0.5);
  haloBouclier.blendMode = "add";
  haloBouclier.tint = 16765040;
  haloBouclier.scale.set(2.2);
  haloBouclier.visible = false;
  plan.addChild(haloBouclier);
  sim.arme.aTire.connecter((charge: boolean, dx: number, dy: number) => visuelJoueur.signalerTir(dx, dy));
  // melee() vit dans arme.ts (hors lot) : le feel (lunge + arc visuel) est relayé ici.
  sim.arme.aFrappe.connecter((combo: number) => sim.joueur.frapperMelee(combo));
  sim.combat.combattantMort.connecter((cible: any) => {
    if (cible.camp === Camp.ENNEMI) sim.camera.secouer(0.25);
  });
  sim.combat.explosionSignal.connecter(() => sim.camera.secouer(0.3));
  visuelsProjectiles.origineVisuelle = (projectile: any) =>
    projectile.auteur === sim.combattant ? visuelJoueur.douilleEcran() : null;
  sim.combattant.touche.connecter(() => visuelJoueur.signalerCoup());
  sim.combattant.touche.connecter(() => {
    const b = sim.combattant.boiteToucheMonde();
    effetsCombat.etincelles(b.x + b.l / 2, b.y + b.h / 2, 16737860, 5, 220, 0, 0);
  });
  const debug = params.debug ? new Graphics() : null;
  if (debug) plan.addChild(debug);
  const flammes = vertical
    ? await chargerFlammes()
        .then((images) => new Flammes(images))
        .catch(() => null)
    : null;
  if (flammes) racine.addChild(flammes);
  racine.addChild(monde.avant);
  plan.filters = [
    new FiltreBloom({
      threshold: 0.72,
      bloomScale: 0.9,
      brightness: 1,
      blur: 6,
      quality: 5,
    }),
  ];
  const texturesPouvoirs = Object.fromEntries(
      (
        await Promise.all(
          [
            "soin",
            "super_saut",
            "autoguidage",
            "pluie_fleches",
            "bouclier",
            "vitesse",
            "eclair",
            "invisibilite",
          ].map((id) =>
            Assets.load(`${baseArt}hud/pouvoir_${id}.webp`)
              .then((texture) => [id, texture])
              .catch(() => null),
          ),
        )
      ).filter((e) => e !== null),
    ),
    hud = new Hud({
      coeur: texCoeur,
      coeurVide: texCoeurVide,
      aile: texAile,
      etoile: texEtoile,
      fiole: texFiole,
      fleche: texFleche,
      pouvoirs: texturesPouvoirs,
    }),
    barreBoss = new BarreBoss(),
    sousTitres = new SousTitres(ctx.audio),
    annonces = new Annonces(),
    menuPause = new MenuPause(
      () => void 0,
      () => {
        partie.finirStage(niveau.id, false, sim.pv / sim.pvMax, {
          duree_s: sim.temps,
          morts: sim.morts,
          chutes: sim.chutes,
          degats_subis: 0,
          ennemis_tues: 0,
        });
        ctx.allerA("resultats");
      },
      ctx.audio,
    );
  hud.brancherLoot(partie.profil, ctx.contenu);
  hud.brancherSim(sim);
  racine.addChild(hud, barreBoss, sousTitres, annonces, menuPause);
  progression.annonce.connecter((message: string, duree: number) => annonces.annoncer(message, duree));
  progression.son.connecter((nom: string) => ctx.audio.sfx(nom));
  progression.niveauGagne.connecter((niveauJoueur: number) => {
    annonces.annoncer(`Niveau ${niveauJoueur} !`, 2.5);
    ctx.audio.sfx("niveau");
  });
  chambres.annonce.connecter((message: string, duree: number) => annonces.annoncer(message, duree));
  chambres.son.connecter((nom: string) => ctx.audio.sfx(nom));
  chambres.entree.connecter((chambre: any) => {
    ctx.audio.declencherDialogue(`chambre:${chambre.def.id}`);
    if (chambre.def.id === "source_chaude") ctx.audio.musique("source_chaude", { fondu: 0.8 });
    chambre.annonce.connecter((message: string, duree: number) => annonces.annoncer(message, duree));
    chambre.son.connecter((nom: string) => ctx.audio.sfx(nom));
    chambre.jarreBrisee.connecter((jarre: any) =>
      ctx.audio.sfx("jarre_brise", { position: { x: jarre.x, y: jarre.y } }),
    );
  });
  chambres.sortie.connecter(() => {
    if (niveau.musique) ctx.audio.musique(niveau.musique, { fondu: 0.8 });
  });
  sim.bossApparu.connecter((boss: any) => {
    barreBoss.montrer(String(boss.definition.nom ?? boss.titre), boss.seuils);
    boss.cerveau?.aPunition?.connecter((e: any) => {
      const b = e.combattant.boiteToucheMonde();
      effetsCombat.etincelles(b.x + b.l / 2, b.y + b.h / 2, 16773312, 10, 300, 0, -1);
    });
    boss.combattant.touche.connecter(() => {
      const b = boss.combattant.boiteToucheMonde();
      effetsCombat.etincelles(b.x + b.l / 2, b.y + b.h / 2, 16766826, 8, 300, 0, 0);
    });
    Assets.load(`${baseArt}boss/${boss.def.id}/${boss.def.id}.json`)
      .then((planche) => {
        const visuel = new VisuelEnnemi(boss, planche);
        visuel.sansBarre = true;
        visuelsEnnemis.set(boss, visuel);
        conteneurEnnemis.addChild(visuel);
        boss.aDisparu.connecter(() => {
          conteneurEnnemis.removeChild(visuel);
          visuelsEnnemis.delete(boss);
        });
      })
      .catch((erreur) => console.error("planche du boss", boss.def.id, erreur));
  });
  sim.bossVaincuSignal.connecter(() => {
    sim.combat.geler(0.12);
    sim.camera.secouer(0.5);
    setTimeout(() => barreBoss.masquer(), 2500);
  });
  const entrees = ctx.entrees;
  entrees.directionSouris = (x: number, y: number) => {
    const centre = sim.joueur.centre(),
      mondeX = (x - plan.x) / 4,
      mondeY = (y - plan.y) / 4;
    return { x: mondeX - centre.x, y: mondeY - centre.y };
  };
  let accumulateur = 0;
  const precJoueur = { x: sim.joueur.x, y: sim.joueur.y };
  (window as any).__sim = sim;
  const majAudio = brancherAudio(ctx.audio, sim);
  sim.termine.connecter(() => {
    setTimeout(() => {
      ctx.partie.finirStage(niveau.id, true, sim.pv / sim.pvMax, {
        duree_s: sim.temps,
        morts: sim.morts,
        chutes: sim.chutes,
        degats_subis: 0,
        ennemis_tues: 0,
      });
      ctx.allerA("resultats");
    }, 3500);
  });
  let intentionFusee: any = null;
  // Horloge propre à la secousse : elle doit continuer de vibrer pendant le hitstop
  // (sim.temps y est gelé, ce qui figerait l'offset en une pose statique).
  let horlogeSecousse = 0;
  const surFrame = (ticker: any) => {
    const dt = Math.min(0.1, ticker.deltaMS / 1000);
    horlogeSecousse += dt;
    accumulateur += dt;
    const intention = entrees.lire();
    intentionFusee = intentionFusee ? fusionnerIntention(intentionFusee, intention) : intention;
    if (menuPause.ouvert) {
      menuPause.pas(dt, intention);
      accumulateur = 0;
      intentionFusee = null;
    } else if (intention.pausePresse) {
      menuPause.ouvrir();
      ctx.audio.sfx("menu_ouvrir");
      accumulateur = 0;
      intentionFusee = null;
    }
    if (sim.combat.gelGlobal > 0) {
      // Hitstop : on saute la simulation mais tout le rendu ci-dessous continue ;
      // l'accumulateur est purgé pour éviter une rafale de ticks de rattrapage.
      sim.combat.gelGlobal = Math.max(0, sim.combat.gelGlobal - dt);
      accumulateur = 0;
    } else
      while (accumulateur >= pasSimulation) {
        precJoueur.x = sim.joueur.x;
        precJoueur.y = sim.joueur.y;
        for (const ennemi of apparitions.vivants) precedents.set(ennemi, { x: ennemi.x, y: ennemi.y });
        if (sim.boss) precedents.set(sim.boss, { x: sim.boss.x, y: sim.boss.y });
        const tickIntention = intentionFusee ?? intentionSansPresse(intention);
        intentionFusee = null;
        sim.tick(tickIntention, pasSimulation);
        accumulateur -= pasSimulation;
      }
    const alpha = accumulateur / pasSimulation,
      camera = sim.camera,
      cx = camera.precedentX + (camera.cx - camera.precedentX) * alpha,
      cy = camera.precedentY + (camera.cy - camera.precedentY) * alpha,
      secousse = camera.trauma * camera.trauma * 14;
    plan.position.set(
      Math.round(largeurEcran / 2 - cx * 4 + (secousse ? Math.sin(horlogeSecousse * 91) * secousse : 0)),
      Math.round(hauteurEcran / 2 - cy * 4 + (secousse ? Math.cos(horlogeSecousse * 77) * secousse : 0)),
    );
    const joueurX =
        Math.abs(sim.joueur.x - precJoueur.x) > 64
          ? sim.joueur.x
          : precJoueur.x + (sim.joueur.x - precJoueur.x) * alpha,
      joueurY = precJoueur.y + (sim.joueur.y - precJoueur.y) * alpha;
    visuelJoueur.mettreAJour(dt, joueurX, joueurY);
    if (sim.invisible) visuelJoueur.alpha = 0.3;
    haloBouclier.visible = pouvoirs.actifs.has("bouclier");
    if (haloBouclier.visible) {
      haloBouclier.position.set(joueurX * 4, (joueurY - sim.joueur.corps.hauteur / 2) * 4);
      haloBouclier.alpha = 0.55 + 0.2 * Math.sin(sim.temps * 12);
    }
    visuelObjets.mettreAJour(dt);
    annonces.mettreAJour(dt);
    const invite = chambres.invite;
    annonces.montrerInvite(invite && chambres.inviteAction ? `↑  ${invite}` : invite, sousTitres.affiche);
    for (const [ennemi, visuel] of visuelsEnnemis) {
      const prec = precedents.get(ennemi) ?? { x: ennemi.x, y: ennemi.y },
        saut = Math.abs(ennemi.x - prec.x) > 64;
      visuel.mettreAJour(
        dt,
        saut ? ennemi.x : prec.x + (ennemi.x - prec.x) * alpha,
        prec.y + (ennemi.y - prec.y) * alpha,
      );
    }
    visuelsProjectiles.mettreAJour(alpha, dt);
    effetsCombat.mettreAJour(dt);
    monde.mettreAJour(dt, -plan.x, -plan.y);
    flammes?.mettreAJour(dt, sim.feuVisible());
    if (sim.boss) barreBoss.afficher(dt, sim.boss.combattant.pv, sim.boss.combattant.pvMax);
    hud.afficher({
      pv: sim.pv,
      pvMax: sim.pvMax,
      vol: sim.joueur.jaugeVol,
      monnaie: partie.coeurs,
      pouvoirs: [0, 1].map((i) => ({
        id: pouvoirs.emplacements[i] ?? "",
        charge: pouvoirs.emplacements[i] ? pouvoirs.charge(i) : -1,
        reste: pouvoirs.recharges.get(pouvoirs.emplacements[i] ?? "") ?? 0,
      })),
      manette: entrees.manette,
      fioles: sim.flacons,
    });
    sousTitres.mettreAJour(dt);
    majAudio(dt);
    if (debug) {
      const corps = sim.joueur.corps;
      debug.clear();
      debug
        .rect(
          (corps.x - corps.largeur / 2) * 4,
          (corps.y - corps.hauteur) * 4,
          corps.largeur * 4,
          corps.hauteur * 4,
        )
        .stroke({ color: corps.auSol ? 4259712 : 16728128, width: 2 });
      for (const ennemi of [
        ...apparitions.vivants,
        ...(sim.boss?.combattant.vivant ? [sim.boss] : []),
      ]) {
        const boite = ennemi.combattant.boiteToucheMonde();
        debug.rect(boite.x * 4, boite.y * 4, boite.l * 4, boite.h * 4).stroke({
          color: 16752688,
          width: 2,
        });
      }
    }
  };
  app.ticker.add(surFrame);
  return () => {
    app.ticker.remove(surFrame);
  };
};