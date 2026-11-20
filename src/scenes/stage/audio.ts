import { D as sfxProjectile } from "../../app";
import { AMBIANCE_PAR_VISUEL } from "../../app/audio/ambiances";
import { Camp } from "./combat";

// Cadence des pas liée à la vitesse réelle : une foulée tous les 30 px parcourus
// au sol (~4 pas/s à vitesse de course 120 px/s), muette accroupi / en dash / en l'air.
const FOULEE_PX = 30;
const VITESSE_PAS_MIN = 25;
const VITESSE_PAS_MAX = 260; // au-delà : dash (whoosh déjà couvert par aDashe)

export function brancherAudio(audio: any, sim: any): (dt: number) => void {
  const niveau = sim.niveau,
    joueur = sim.joueur,
    point = (x: number, y: number) => ({ x, y });
  if (niveau.musique) audio.musique(niveau.musique, { fondu: 1 });
  // Ambiance du monde : le kit visuel du stage prime sur le mapping par piste.
  const familleVisuelle = AMBIANCE_PAR_VISUEL[String(niveau.definition?.ambiance ?? "")];
  if (familleVisuelle) audio.ambiance(familleVisuelle);
  audio.declencherDialogue(`stage:${niveau.id.split("/").pop() ?? niveau.id}`);
  joueur.aSaute.connecter((double: boolean) => audio.sfx(double ? "double_saut" : "saut"));
  joueur.aDashe.connecter(() => audio.sfx("dash"));
  joueur.aAtterri.connecter((vitesse: number) => {
    if (vitesse > 180) audio.sfx("atterrissage");
    else if (vitesse > 70) audio.sfx("atterrissage", { volumeDb: -7 }); // thud léger
  });
  sim.arme.aTire.connecter((charge: boolean) => audio.sfx(charge ? "tir_charge" : "tir_fleche"));
  sim.arme.aFrappe.connecter((combo: number) => audio.sfx(`melee_${Math.min(3, combo)}`));
  const combat = sim.combat;
  combat.coupPorte.connecter((cible: any, coup: any, position: any) => {
    if (cible.camp === Camp.JOUEUR) {
      audio.sfx(coup.source === "lave" || coup.source === "geyser" ? "lave_brule" : "touche_joueur");
      if (sim.pv > 0 && sim.pv / sim.pvMax < 0.25) audio.declencherDialogue("pv_bas");
      return;
    }
    audio.sfx(coup.critique ? "impact_critique" : "impact_fleche", {
      position: point(position.x, position.y),
    });
    audio.sfx("ennemi_touche", { position: point(position.x, position.y) });
  });
  combat.combattantMort.connecter((combattant: any) => {
    const centre = combattant.centre();
    if (combattant.camp === Camp.JOUEUR) {
      audio.sfx("mort_joueur");
      audio.duck(1.6);
    } else if (sim.boss && combattant === sim.boss.combattant) {
      audio.sfx("boss_mort");
      audio.duck(2.2); // l'explosion du boss laisse la place au dialogue de victoire
    } else audio.sfx("ennemi_mort", { position: point(centre.x, centre.y) });
  });
  combat.coupBloque.connecter((coup: any, position: any) =>
    audio.sfx("bouclier", { position: point(position.x, position.y) }),
  );
  combat.explosionSignal.connecter((position: any) =>
    audio.sfx("explosion", { position: point(position.x, position.y) }),
  );
  combat.projectileFini.connecter((projectile: any, position: any, mur: boolean) => {
    if (mur && projectile.camp === Camp.JOUEUR)
      audio.sfx("impact_mur", { position: point(position.x, position.y) });
  });
  combat.projectileTire.connecter((projectile: any) => {
    if (projectile.camp === Camp.ENNEMI)
      audio.sfx(sfxProjectile(projectile.visuel), { position: point(projectile.x, projectile.y) });
  });
  sim.checkpointTouche.connecter(() => audio.sfx("checkpoint"));
  const elements = sim.elements;
  elements.friableTremble.connecter((x: number, y: number) =>
    audio.sfx("friable_craque", { position: point(x, y) }),
  );
  elements.friableTombe.connecter((x: number, y: number) =>
    audio.sfx("friable_chute", { position: point(x, y) }),
  );
  elements.geyserPhase.connecter((x: number, y: number, phase: number) =>
    audio.sfx(phase === 1 ? "geyser_bouillonne" : "geyser_jet", { position: point(x, y) }),
  );
  sim.aChute.connecter(() => audio.sfx("touche_joueur"));
  sim.joueurMort.connecter(() => {
    audio.duck(1.6);
    audio.declencherDialogue("mort");
  });
  sim.bossApparu.connecter((boss: any) => {
    // Piste dédiée au boss quand elle existe (hewdraw, medusa, pandora, tanatos),
    // sinon le thème boss générique ; calage à la mesure, fondu sans clic.
    const pisteBoss = `boss_${boss.def.id}`;
    audio.musique(audio.musiqueConnue(pisteBoss) ? pisteBoss : "boss_stage", {
      fondu: 0.8,
      cale: "mesure",
    });
    audio.sfx("boss_rugit");
    audio.declencherDialogue(`boss:${boss.def.id}`);
    boss.phaseChangee.connecter(() => {
      if (boss.combattant.vivant) {
        audio.sfx("boss_phase");
        audio.declencherDialogue(
          `boss_phase:${boss.def.id}`,
          boss.def.feminin === true ? "boss_phase_f" : "boss_phase",
        );
      }
    });
  });
  sim.bossVaincuSignal.connecter((boss: any) => {
    audio.taireDialogues();
    if (audio.declencherDialogue(`boss_vaincu:${boss.def.id}`) === 0)
      audio.declencherDialogue("boss_vaincu");
    // Retour à l'exploration : le thème du stage reprend en fondu (pas de restart brutal).
    if (niveau.musique) audio.musique(niveau.musique, { fondu: 1.6 });
  });
  sim.termine.connecter(() => audio.musique("victoire", { fondu: 0.4 }));
  sim.apparitions?.apparu.connecter((ennemi: any) => {
    if (ennemi.elites.length) audio.sfx("elite_apparition");
    if (ennemi.def.id === "monoeye") audio.sfx("monoeye_cri", { position: point(ennemi.x, ennemi.y) });
  });
  let distancePas = 0,
    intensiteEnvoyee = -1;
  return (dt: number) => {
    audio.ecoute(joueur.centre());
    const corps = joueur.corps,
      vitesse = Math.abs(corps.vx);
    if (corps.auSol && vitesse > VITESSE_PAS_MIN && vitesse < VITESSE_PAS_MAX && !joueur.accroupi) {
      distancePas += vitesse * dt;
      if (distancePas >= FOULEE_PX) {
        distancePas %= FOULEE_PX;
        audio.sfx("pas", { volumeDb: vitesse < 90 ? -5 : 0 });
      }
    } else distancePas = corps.auSol ? 0 : FOULEE_PX * 0.5;
    // Musique adaptative : quantifiée en pas de 5 % + hystérésis (pas de micro-ramps par frame),
    // montée rapide en combat (0.5 s), redescente lente vers l'exploration (2.2 s).
    let cible: number, duree: number;
    if (sim.boss && !sim.bossVaincu) {
      cible = 1;
      duree = 0.6;
    } else {
      const centre = joueur.centre(),
        proches =
          sim.apparitions?.vivants.filter(
            (e: any) => e.combattant.vivant && Math.hypot(e.x - centre.x, e.y - centre.y) < 192,
          ).length ?? 0;
      cible = Math.min(1, proches / 3);
      duree = 2.2;
    }
    const quantifiee = Math.round(cible * 20) / 20;
    if (quantifiee !== intensiteEnvoyee) {
      audio.intensite(quantifiee, quantifiee > intensiteEnvoyee ? Math.min(duree, 0.5) : duree);
      intensiteEnvoyee = quantifiee;
    }
  };
}