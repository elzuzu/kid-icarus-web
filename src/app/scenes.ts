export const chargeursScenes: Record<string, () => Promise<{ lancer: (contexte: any, options: any) => any }>> = {
  titre: () => import("../scenes/titre"),
  carte: () => import("../scenes/carte"),
  stage: () => import("../scenes/stage"),
  resultats: () => import("../scenes/resultats"),
  fin: () => import("../scenes/fin"),
  vitrine: () => import("../scenes/vitrine"),
};