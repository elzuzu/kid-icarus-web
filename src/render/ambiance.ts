// Direction artistique par ambiance : grades de couleur (teintes de conteneurs +
// voiles pré-générés, aucun post-process par frame), lecture des options de confort
// partagées, bruit de flicker déterministe et registre d'inspection __techart.
import { options } from "../app/options";

export interface GradeAmbiance {
  // Tinte multiplicative du conteneur arrière-plan (fond lointain + milieu + voile).
  teinte: number;
  // Voile normal au-dessus du gameplay : ombre colorée haut → bas.
  voile: [string, string];
  // Lueur additive optionnelle (bas = chaleur montante, haut = lumière descendante).
  lueur?: [string, string];
  // Éclairs lointains + pluie : kits d'orage.
  orage?: boolean;
}

// Une famille chromatique par kit de décor — impossible à coller sur un autre monde.
export const gradesAmbiance: Record<string, GradeAmbiance> = {
  // Profondeurs / fosses : braises, ombres violettes, chaleur orange montante.
  profondeurs: {
    teinte: 0xffdcb8,
    voile: ["rgba(26,10,34,0.20)", "rgba(64,16,8,0.16)"],
    lueur: ["rgba(255,96,24,0)", "rgba(255,120,40,0.15)"],
  },
  fosses: {
    teinte: 0xffd2a0,
    voile: ["rgba(30,8,26,0.22)", "rgba(96,24,6,0.18)"],
    lueur: ["rgba(255,80,16,0)", "rgba(255,110,32,0.20)"],
  },
  // Puits : nuit spores, vert luminescent sur fond bleu-noir.
  puits: {
    teinte: 0xc2d4d8,
    voile: ["rgba(8,14,26,0.26)", "rgba(14,32,22,0.18)"],
    lueur: ["rgba(80,255,140,0)", "rgba(90,255,150,0.10)"],
  },
  forteresse: {
    teinte: 0xe0ccc4,
    voile: ["rgba(14,10,22,0.24)", "rgba(44,16,24,0.18)"],
    lueur: ["rgba(255,110,50,0)", "rgba(255,120,60,0.10)"],
  },
  // Arcadie : jour doré, poussière de pollen.
  arcadie: {
    teinte: 0xfff2d8,
    voile: ["rgba(255,240,200,0.04)", "rgba(120,80,30,0.10)"],
    lueur: ["rgba(255,220,140,0.10)", "rgba(255,220,140,0)"],
  },
  // Col gelé : glacial bleu, lumière froide descendante.
  col_gele: {
    teinte: 0xd6e4ff,
    voile: ["rgba(150,180,230,0.10)", "rgba(24,40,70,0.20)"],
    lueur: ["rgba(160,200,255,0.10)", "rgba(160,200,255,0)"],
  },
  // Crépuscule : cendres chaudes, dusk violet-orange.
  crepuscule: {
    teinte: 0xe8c0a8,
    voile: ["rgba(40,20,50,0.22)", "rgba(90,40,20,0.16)"],
    lueur: ["rgba(255,120,60,0)", "rgba(255,130,70,0.10)"],
  },
  forteresse_surface: {
    teinte: 0xc4ccd8,
    voile: ["rgba(16,20,34,0.26)", "rgba(28,30,44,0.18)"],
    lueur: ["rgba(120,150,255,0.07)", "rgba(120,150,255,0)"],
    orage: true,
  },
  // Mer de nuages : ciel lumineux, or blanc.
  mer_nuages: {
    teinte: 0xfff6e8,
    voile: ["rgba(255,250,235,0)", "rgba(180,190,230,0.10)"],
    lueur: ["rgba(255,235,180,0.08)", "rgba(255,235,180,0)"],
  },
  // Tempête : acier bleu-violet, éclairs.
  tempete: {
    teinte: 0xb8c4dc,
    voile: ["rgba(12,16,36,0.30)", "rgba(20,26,50,0.22)"],
    lueur: ["rgba(110,140,255,0.08)", "rgba(110,140,255,0)"],
    orage: true,
  },
  temple_vents: {
    teinte: 0xffe8c8,
    voile: ["rgba(255,235,190,0)", "rgba(150,100,50,0.12)"],
    lueur: ["rgba(255,210,130,0.08)", "rgba(255,210,130,0)"],
  },
  forteresse_celeste: {
    teinte: 0xfff0d0,
    voile: ["rgba(255,248,225,0)", "rgba(170,130,70,0.12)"],
    lueur: ["rgba(255,225,150,0.10)", "rgba(255,225,150,0)"],
  },
  vol_celeste: {
    teinte: 0xf0f4ff,
    voile: ["rgba(240,245,255,0)", "rgba(140,160,210,0.12)"],
    lueur: ["rgba(220,235,255,0.08)", "rgba(220,235,255,0)"],
  },
  palais: {
    teinte: 0xffeccc,
    voile: ["rgba(255,244,214,0)", "rgba(150,100,40,0.14)"],
    lueur: ["rgba(255,215,130,0.10)", "rgba(255,215,130,0)"],
  },
};

export function gradeDe(nom: string): GradeAmbiance {
  return gradesAmbiance[nom] ?? gradesAmbiance.profondeurs;
}

// Clés options partagées (src/app/options.ts, possédé par ui). La clé historique du
// dépôt est `flashs` ; le contrat AAA nomme `flashes`. On lit les deux, défaut true.
export function flashesActifs(): boolean {
  const o = options as any;
  if (typeof o.flashes === "boolean") return o.flashes;
  return o.flashs !== false;
}

export function secoussesActives(): boolean {
  return (options as any).secousses !== false;
}

// Bruit lisse borné [-1,1] : trois sinusoïdes à périodes sans multiple commun court.
// Déterministe, sans allocation, remplace les flickers sinusoïdaux purs.
export function bruit1(t: number, graine = 0): number {
  return (
    0.55 * Math.sin(t * 7.3 + graine) +
    0.3 * Math.sin(t * 13.7 + graine * 1.7 + 1.3) +
    0.15 * Math.sin(t * 23.9 + graine * 2.3 + 4.1)
  );
}

// Registre d'inspection pour les gates QA (__techart) : comptes de pools, caméra,
// ambiance. Aucune écoute globale, simples références posées à la construction.
export const techart: {
  monde?: any;
  effets?: any;
  camera?: any;
  flammes?: any;
} = {};
if (typeof window !== "undefined") (window as any).__techart = techart;