import { D as sfxProjectile } from "../../app";
import { Camp } from "./combat";

export function brancherAudio(audio: any, sim: any): (dt: number) => void {
  const niveau = sim.niveau,
    joueur = sim.joueur,
    point = (x: number, y: number) => ({ x, y });
  if (niveau.musique) audio.musique(niveau.musique, { fondu: 1 });
  audio.declencherDialogue(`stage:${niveau.id.split("/").pop() ?? niveau.id}`);
  joueur.aSaute.connecter((double: boolean) => audio.sfx(double ? "double_saut" : "saut"));
  joueur.aDashe.connecter(() => audio.sfx("dash"));
  joueur.aAtterri.connecter((vitesse: number) => {
    if (vitesse > 180) audio.sfx("atterrissage");
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
    if (combattant.camp === Camp.JOUEUR) audio.sfx("mort_joueur");
    else if (sim.boss && combattant === sim.boss.combattant) audio.sfx("boss_mort");
    else audio.sfx("ennemi_mort", { position: point(centre.x, centre.y) });
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
    audio.declencherDialogue("mort");
  });
  sim.bossApparu.connecter((boss: any) => {
    audio.musique("boss_stage", { fondu: 0.8, cale: "mesure" });
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
  });
  sim.termine.connecter(() => audio.musique("victoire", { fondu: 0.4 }));
  sim.apparitions?.apparu.connecter((ennemi: any) => {
    if (ennemi.elites.length) audio.sfx("elite_apparition");
    if (ennemi.def.id === "monoeye") audio.sfx("monoeye_cri", { position: point(ennemi.x, ennemi.y) });
  });
  return () => {
    audio.ecoute(joueur.centre());
    if (sim.boss && !sim.bossVaincu) {
      audio.intensite(1);
      return;
    }
    const centre = joueur.centre(),
      proches =
        sim.apparitions?.vivants.filter(
          (e: any) => e.combattant.vivant && Math.hypot(e.x - centre.x, e.y - centre.y) < 192,
        ).length ?? 0;
    audio.intensite(Math.min(1, proches / 3));
  };
}