const MODES_EFFET = [
  "add",
  "pct",
  "pct_negatif",
  "add_pct",
  "flag",
  "statut",
  "joueur_add",
  "joueur_pct",
  "joueur_pct_negatif",
];
export const TABLES = [
  "affixes",
  "armes",
  "boss",
  "chambres",
  "dialogues",
  "elites",
  "ennemis",
  "mondes",
  "musiques",
  "pouvoirs",
  "raretes",
  "reliques",
  "sets",
  "sons",
  "talents",
];

const chaine = (o: any = {}) => ({ t: "chaine", ...o }),
  nombre = (o: any = {}) => ({ t: "nombre", ...o }),
  entier = (min?: number) => ({ t: "nombre", entier: true, min }),
  booleen = { t: "booleen" },
  libre = { t: "libre" },
  liste = (de: any, min?: number) =>
    min === undefined ? { t: "liste", de } : { t: "liste", de, min },
  tuple = (...de: any[]) => ({ t: "tuple", de }),
  objet = (requis: any, options: any = {}) => ({ t: "objet", requis, options }),
  dico = (valeur: any, motif?: RegExp) => ({ t: "dico", valeur, motif }),
  avecId = (requis: any, options: any = {}) => objet({ id: chaine(), ...requis }, options),
  couleur = tuple(nombre(), nombre(), nombre()),
  taille = tuple(nombre({ min: 0 }), nombre({ min: 0 })),
  zoneTouche = tuple(nombre(), nombre(), nombre({ min: 0 }), nombre({ min: 0 })),
  coeurs = tuple(entier(0), entier(0)),
  effet = objet(
    { stat: chaine(), v: nombre(), mode: chaine({ parmi: MODES_EFFET }) },
    { statut: chaine(), element: entier(0), duree: nombre({ min: 0 }) },
  ),
  effets = liste(effet, 1),
  statut = objet({ id: chaine(), duree: nombre({ min: 0 }), puissance: nombre() }),
  contact = objet({ base: nombre({ min: 0 }) }, { element: entier(0), statuts: liste(statut) }),
  resistances = dico(nombre(), /^[0-9]+$/),
  statsArme = objet(
    {
      base: nombre({ min: 0 }),
      cadence: nombre({ min: 0 }),
      vitesse: nombre({ min: 0 }),
      portee: nombre({ min: 0 }),
      temps_charge: nombre({ min: 0 }),
      mult_charge: nombre({ min: 0 }),
      melee_base: nombre({ min: 0 }),
    },
    {
      perce_charge: entier(0),
      melee_portee: nombre({ min: 0 }),
      guidage: nombre(),
      chance_critique: nombre({ min: 0, max: 1 }),
      mult_critique: nombre({ min: 1 }),
      recul: nombre(),
      element: entier(0),
      statuts: liste(statut),
      tir_en_dash: booleen,
      multi: entier(1),
      dispersion: nombre(),
      ecart: nombre(),
      explosion: nombre({ min: 0 }),
      gravite: nombre(),
      visuel: chaine(),
      tourbillon: booleen,
      rebonds: entier(0),
      perce: entier(0),
      eventail_charge: booleen,
      renvoi: booleen,
      vol_de_vie: nombre({ min: 0 }),
    },
  );

function verifierMinMax(chemin: string, bornes: number[], erreur: (msg: string) => void) {
  if (bornes[0] > bornes[1]) erreur(`${chemin} : minimum ${bornes[0]} > maximum ${bornes[1]}`);
}

const TABLES_DECLENCHEUR: Record<string, string> = {
  stage: "stage",
  boss: "boss",
  boss_phase: "boss",
  boss_vaincu: "boss",
  chambre: "chambres",
};

const SCHEMAS: Record<string, any> = {
  affixes: {
    entree: avecId(
      {
        nom: chaine(),
        type: chaine({ parmi: ["normal", "unique", "maudit"] }),
        stat: chaine(),
        mode: chaine({ parmi: MODES_EFFET }),
        paliers: tuple(tuple(entier(), entier()), tuple(entier(), entier()), tuple(entier(), entier())),
      },
      {
        poids: nombre({ min: 0 }),
        groupe: chaine(),
        classes: liste(chaine({ ref: "classe_arme" }), 1),
        statut: chaine(),
        element: entier(0),
        duree: nombre({ min: 0 }),
        malus: effet,
      },
    ),
    coherence(entree: any, ctx: any, erreur: (msg: string) => void) {
      entree.paliers.forEach((p: number[], i: number) => verifierMinMax(`paliers[${i}]`, p, erreur));
      if (entree.mode === "statut" && entree.statut === undefined)
        erreur(`mode "statut" sans clé "statut"`);
    },
  },
  armes: { entree: avecId({ nom: chaine(), classe: chaine(), niveau: entier(1), stats: statsArme }) },
  boss: {
    entree: avecId(
      {
        nom: chaine(),
        titre: chaine(),
        monde: entier(1),
        comportement: chaine(),
        pv: nombre({ min: 1 }),
        taille,
        volant: booleen,
        xp: entier(0),
        coeurs,
        rarete_min: chaine({ ref: "raretes" }),
        phases: liste(nombre({ min: 0, max: 1 }), 1),
        contact,
        defense: nombre({ min: 0 }),
        couleur,
      },
      { degats: nombre({ min: 0 }), resistances, zone_touche: zoneTouche, feminin: booleen },
    ),
    coherence(entree: any, ctx: any, erreur: (msg: string) => void) {
      verifierMinMax("coeurs", entree.coeurs, erreur);
    },
  },
  chambres: {
    entree: avecId(
      {
        nom: chaine(),
        hasard: entier(0),
        accueil: chaine(),
        marqueurs: dico(objet({ role: chaine() }), /^[a-z]$/),
        gabarit: liste(chaine(), 1),
      },
      {
        prix: objet({
          eau_de_vie: entier(0),
          plume: entier(0),
          relique: entier(0),
          pouvoir: entier(0),
          arme_base: entier(0),
        }),
        mult_prix: tuple(nombre({ min: 0 }), nombre({ min: 0 })),
        contenu: liste(chaine(), 1),
        soin_par_s: nombre({ min: 0 }),
        benediction: effet,
        vagues: liste(entier(1), 1),
        objectif: entier(1),
        duree: nombre({ min: 0 }),
        simultanes: entier(1),
        prix_fusion: entier(0),
      },
    ),
    coherence(entree: any, ctx: any, erreur: (msg: string) => void) {
      if (entree.mult_prix) verifierMinMax("mult_prix", entree.mult_prix, erreur);
    },
  },
  dialogues: {
    entree: avecId(
      { perso: chaine({ ref: "voix" }), texte: chaine(), declencheur: chaine() },
      { une_fois: booleen, ton: chaine(), priorite: nombre(), sans_voix: booleen },
    ),
    racine: {
      voix: dico(objet({ speaker: chaine(), nom: chaine(), couleur, consigne: chaine() })),
    },
    coherence(entree: any, ctx: any, erreur: (msg: string) => void) {
      let separateur = entree.declencheur.indexOf(":");
      if (separateur < 0) return;
      let table = TABLES_DECLENCHEUR[entree.declencheur.slice(0, separateur)],
        id = entree.declencheur.slice(separateur + 1);
      if (table !== undefined && !referenceExiste(ctx, table, id))
        erreur(`declencheur : référence cassée vers ${table} : « ${id} »`);
    },
  },
  elites: {
    entree: avecId(
      { nom: chaine(), teinte: couleur },
      {
        degats_mult: nombre({ min: 0 }),
        vitesse_mult: nombre({ min: 0 }),
        pv_mult: nombre({ min: 0 }),
        defense: nombre(),
        vol_de_vie: nombre({ min: 0 }),
        explosion_mort: nombre({ min: 0 }),
        invocation: chaine({ ref: "ennemis" }),
        intervalle: nombre({ min: 0 }),
        reflet: nombre({ min: 0, max: 1 }),
        teleportation: nombre({ min: 0 }),
      },
    ),
  },
  ennemis: {
    entree: avecId(
      {
        nom: chaine(),
        monde: entier(1),
        origine: chaine({ parmi: ["nes", "nouveau"] }),
        comportement: chaine(),
        pv: nombre({ min: 1 }),
        taille,
        vitesse: nombre({ min: 0 }),
        volant: booleen,
        xp: entier(0),
        coeurs,
        contact,
      },
      {
        params: dico(libre),
        couleur,
        resistances,
        defense: nombre({ min: 0 }),
        zone_touche: zoneTouche,
      },
    ),
    coherence(entree: any, ctx: any, erreur: (msg: string) => void) {
      verifierMinMax("coeurs", entree.coeurs, erreur);
      let invoque = entree.params?.invoque;
      if (invoque !== undefined && (typeof invoque != "string" || !referenceExiste(ctx, "ennemis", invoque)))
        erreur(`params.invoque : référence cassée vers ennemis : « ${String(invoque)} »`);
    },
  },
  mondes: {
    entree: avecId({
      nom: chaine(),
      couleur,
      stages: liste(
        objet(
          { id: chaine(), nom: chaine(), temps_ref: nombre({ min: 0 }) },
          { forteresse: booleen, fin: booleen },
        ),
        1,
      ),
    }),
  },
  musiques: {
    entree: avecId(
      {
        source: chaine(),
        bpm: nombre({ min: 1 }),
        boucle: booleen,
        debut_boucle: nombre({ min: 0 }),
        duree: nombre({ min: 0 }),
        fichier: chaine(),
      },
      { ressemblance: nombre({ min: 0 }), couches: objet({ base: chaine(), rythme: chaine() }) },
    ),
    coherence(entree: any, ctx: any, erreur: (msg: string) => void) {
      if (entree.debut_boucle > entree.duree)
        erreur(`debut_boucle ${entree.debut_boucle} après la fin (${entree.duree} s)`);
    },
  },
  pouvoirs: {
    entree: avecId(
      { nom: chaine(), actif: booleen, forme: liste(tuple(entier(0), entier(0)), 1) },
      { recharge: nombre({ min: 0 }), effet: dico(nombre()), effets },
    ),
    coherence(entree: any, ctx: any, erreur: (msg: string) => void) {
      if (entree.actif && (entree.recharge === undefined || entree.effet === undefined))
        erreur(`pouvoir actif sans "recharge" ou "effet"`);
      if (!entree.actif && entree.effets === undefined) erreur(`pouvoir passif sans "effets"`);
      if (new Set(entree.forme.map(([x, y]: number[]) => `${x},${y}`)).size !== entree.forme.length)
        erreur(`forme : cellule en double`);
    },
  },
  raretes: {
    entree: avecId(
      {
        nom: chaine(),
        rang: entier(0),
        poids: nombre({ min: 0 }),
        affixes: entier(0),
        couleur,
      },
      {
        bonus_intensite: nombre(),
        mult_base: nombre({ min: 0 }),
        unique: booleen,
        maudit: booleen,
      },
    ),
    coherence(entree: any, ctx: any, erreur: (msg: string) => void, position: number) {
      if (entree.rang !== position) erreur(`rang ${entree.rang} mais position ${position} dans le fichier`);
    },
  },
  reliques: { entree: avecId({ nom: chaine(), dieu: chaine({ ref: "sets" }), effets }) },
  sets: { entree: avecId({ nom: chaine(), 2: effets, 4: effets }) },
  sons: {
    entree: avecId(
      {
        volume: nombre(),
        hauteur: tuple(nombre({ min: 0 }), nombre({ min: 0 })),
        delai: nombre({ min: 0 }),
        voix: entier(1),
        bus: chaine({ parmi: ["SFX", "Interface"] }),
      },
      { variantes: entier(0) },
    ),
    coherence(entree: any, ctx: any, erreur: (msg: string) => void) {
      verifierMinMax("hauteur", entree.hauteur, erreur);
    },
  },
  talents: {
    entree: avecId(
      { nom: chaine(), arbre: chaine(), rangs: entier(1), effets },
      { requis: tuple(chaine({ ref: "talents" }), entier(1)) },
    ),
    coherence(entree: any, ctx: any, erreur: (msg: string) => void) {
      if (!entree.requis) return;
      let [requis, rang] = entree.requis;
      if (requis === entree.id) erreur(`requis : un talent ne peut pas se requérir lui-même`);
      let talent = ctx.index.get("talents")?.get(requis);
      if (
        estObjet(talent) &&
        typeof talent.rangs == "number" &&
        rang > talent.rangs
      )
        erreur(`requis : rang ${rang} demandé mais ${requis} n'a que ${talent.rangs} rangs`);
    },
  },
};

function estObjet(v: any) {
  return typeof v == "object" && !!v && !Array.isArray(v);
}

function estTableConnue(nom: string) {
  return TABLES.includes(nom);
}

function decrireValeur(v: any) {
  return Array.isArray(v)
    ? "un tableau"
    : v === null
      ? "null"
      : typeof v == "object"
        ? "un objet"
        : `${typeof v} ${JSON.stringify(v)}`;
}

function referenceExiste(ctx: any, table: string, id: string) {
  switch (table) {
    case "classe_arme":
      return ctx.classesArmes.has(id);
    case "voix":
      return ctx.voix.has(id);
    case "stage":
      return ctx.stages.has(id);
    default:
      return ctx.index.get(table)?.has(id) ?? false;
  }
}

function valider(valeur: any, schema: any, chemin: string, ctx: any, erreur: (msg: string) => void) {
  switch (schema.t) {
    case "chaine":
      if (typeof valeur != "string")
        return erreur(`${chemin} : chaîne attendue, trouvé ${decrireValeur(valeur)}`);
      if (schema.parmi && !schema.parmi.includes(valeur))
        erreur(`${chemin} : « ${valeur} » n'est pas parmi ${schema.parmi.join(", ")}`);
      if (schema.ref && !referenceExiste(ctx, schema.ref, valeur))
        erreur(`${chemin} : référence cassée vers ${schema.ref} : « ${valeur} »`);
      return;
    case "nombre":
      if (typeof valeur != "number" || !Number.isFinite(valeur))
        return erreur(`${chemin} : nombre attendu, trouvé ${decrireValeur(valeur)}`);
      if (schema.entier && !Number.isInteger(valeur))
        erreur(`${chemin} : entier attendu, trouvé ${valeur}`);
      if (schema.min !== undefined && valeur < schema.min)
        erreur(`${chemin} : ${valeur} < minimum ${schema.min}`);
      if (schema.max !== undefined && valeur > schema.max)
        erreur(`${chemin} : ${valeur} > maximum ${schema.max}`);
      return;
    case "booleen":
      if (typeof valeur != "boolean")
        erreur(`${chemin} : booléen attendu, trouvé ${decrireValeur(valeur)}`);
      return;
    case "liste":
      if (!Array.isArray(valeur))
        return erreur(`${chemin} : tableau attendu, trouvé ${decrireValeur(valeur)}`);
      if (schema.min !== undefined && valeur.length < schema.min)
        erreur(`${chemin} : au moins ${schema.min} élément(s) attendu(s)`);
      valeur.forEach((element, i) => valider(element, schema.de, `${chemin}[${i}]`, ctx, erreur));
      return;
    case "tuple":
      if (!Array.isArray(valeur) || valeur.length !== schema.de.length)
        return erreur(
          `${chemin} : tableau de ${schema.de.length} valeurs attendu, trouvé ${decrireValeur(valeur)}`,
        );
      schema.de.forEach((sousSchema: any, i: number) =>
        valider(valeur[i], sousSchema, `${chemin}[${i}]`, ctx, erreur),
      );
      return;
    case "objet":
      if (!estObjet(valeur))
        return erreur(`${chemin} : objet attendu, trouvé ${decrireValeur(valeur)}`);
      for (let [cle, sousSchema] of Object.entries(schema.requis))
        if (Object.hasOwn(valeur, cle))
          valider(valeur[cle], sousSchema, `${chemin}.${cle}`, ctx, erreur);
        else erreur(`${chemin} : clé « ${cle} » manquante`);
      for (let [cle, sousValeur] of Object.entries(valeur)) {
        if (Object.hasOwn(schema.requis, cle)) continue;
        let sousSchema = Object.hasOwn(schema.options, cle) ? schema.options[cle] : undefined;
        if (sousSchema === undefined) erreur(`${chemin} : clé inconnue « ${cle} »`);
        else valider(sousValeur, sousSchema, `${chemin}.${cle}`, ctx, erreur);
      }
      return;
    case "dico":
      if (!estObjet(valeur))
        return erreur(`${chemin} : objet attendu, trouvé ${decrireValeur(valeur)}`);
      for (let [cle, sousValeur] of Object.entries(valeur)) {
        if (schema.motif && !schema.motif.test(cle)) erreur(`${chemin} : clé « ${cle} » invalide`);
        valider(sousValeur, schema.valeur, `${chemin}.${cle}`, ctx, erreur);
      }
      return;
    case "libre":
      return;
  }
}

function indexerTable(table: string, brut: any, erreur: (msg: string) => void) {
  let index = new Map<string, any>(),
    fichier = `${table}.json`;
  if (!estObjet(brut)) {
    erreur(`${fichier} : un objet est attendu à la racine`);
    return index;
  }
  let racine = SCHEMAS[table].racine ?? {};
  for (let cle of Object.keys(brut))
    if (cle !== "_doc" && cle !== "entrees" && !Object.hasOwn(racine, cle))
      erreur(`${fichier} : clé racine inconnue « ${cle} »`);
  if (Object.hasOwn(brut, "_doc") && typeof brut._doc != "string")
    erreur(`${fichier} : "_doc" doit être une chaîne`);
  let entrees = brut.entrees;
  if (!Array.isArray(entrees)) {
    erreur(`${fichier} : clé "entrees" (tableau) manquante`);
    return index;
  }
  entrees.forEach((entree, i) => {
    if (!estObjet(entree) || typeof entree.id != "string" || entree.id === "") {
      erreur(`${fichier} : entrée ${i} sans "id" (chaîne)`);
      return;
    }
    let id = entree.id;
    if (index.has(id)) erreur(`${fichier} : identifiant en double : ${id}`);
    index.set(id, entree);
  });
  return index;
}

export class Contenu {
  erreurs: string[] = [];
  voix: any = {};
  index = new Map<string, Map<string, any>>();

  constructor() {}

  static depuis(brut: any, erreursInitiales: string[] = []) {
    let contenu = new Contenu(),
      erreur = (msg: string) => {
        contenu.erreurs.push(msg);
      };
    contenu.erreurs.push(...erreursInitiales);
    for (let table of Object.keys(brut).sort())
      if (!estTableConnue(table))
        erreur(`${table}.json : table sans schéma (à déclarer dans src/core/contenu.ts)`);
    for (let table of TABLES)
      if (Object.hasOwn(brut, table)) contenu.index.set(table, indexerTable(table, brut[table], erreur));
      else {
        erreur(`${table}.json : table absente`);
        contenu.index.set(table, new Map());
      }
    let classesArmes = new Set<string>();
    for (let arme of contenu.index.get("armes")?.values() ?? [])
      if (estObjet(arme) && typeof arme.classe == "string") classesArmes.add(arme.classe);
    let stages = new Set<string>();
    for (let monde of contenu.index.get("mondes")?.values() ?? []) {
      let listeStages = estObjet(monde) ? monde.stages : undefined;
      if (Array.isArray(listeStages))
        for (let stage of listeStages)
          if (estObjet(stage) && typeof stage.id == "string") stages.add(stage.id);
    }
    let dialogues = brut.dialogues,
      voix = estObjet(dialogues) && estObjet(dialogues.voix) ? dialogues.voix : {},
      ctx = {
        index: contenu.index,
        classesArmes,
        voix: new Set(Object.keys(voix)),
        stages,
      };
    for (let table of TABLES) {
      let schema = SCHEMAS[table],
        racine = brut[table];
      if (schema.racine && estObjet(racine))
        for (let [cle, sousSchema] of Object.entries(schema.racine))
          if (Object.hasOwn(racine, cle))
            valider(racine[cle], sousSchema, `${table}.json : ${cle}`, ctx, erreur);
          else erreur(`${table}.json : clé racine « ${cle} » manquante`);
      let position = 0;
      for (let [id, entree] of contenu.index.get(table) ?? []) {
        let avant = contenu.erreurs.length;
        valider(entree, schema.entree, `${table}.json : ${id}`, ctx, erreur);
        if (contenu.erreurs.length === avant)
          schema.coherence?.(entree, ctx, (msg: string) => erreur(`${table}.json : ${id} : ${msg}`), position);
        position++;
      }
    }
    contenu.voix = voix;
    return contenu;
  }

  exigerValide() {
    if (this.erreurs.length)
      throw Error(`Contenu invalide :\n- ${this.erreurs.join("\n- ")}`);
    return this;
  }

  table(nom: string) {
    return this.index.get(nom) ?? new Map<string, any>();
  }

  liste(nom: string) {
    return [...this.table(nom).values()];
  }

  ids(nom: string) {
    return [...this.table(nom).keys()];
  }

  contient(nom: string, id: string) {
    return this.table(nom).has(id);
  }

  chercher(nom: string, id: string) {
    return this.table(nom).get(id);
  }

  entree(nom: string, id: string) {
    let entree = this.chercher(nom, id);
    if (entree === undefined) throw Error(`Identifiant inconnu dans ${nom} : ${id}`);
    return entree;
  }
}

export async function chargerContenu(lire: (chemin: string) => Promise<string>, tables = TABLES) {
  let chargees = await Promise.all(
      tables.map(async (table) => {
        let chemin = `data/${table}.json`;
        try {
          return { nom: table, brut: JSON.parse(await lire(chemin)), erreur: "" };
        } catch (e) {
          return {
            nom: table,
            brut: undefined,
            erreur: `${chemin} : ${e instanceof Error ? e.message : String(e)}`,
          };
        }
      }),
    ),
    brut: any = {},
    erreurs: string[] = [];
  for (let chargee of chargees)
    if (chargee.erreur) erreurs.push(chargee.erreur);
    else brut[chargee.nom] = chargee.brut;
  return Contenu.depuis(brut, erreurs);
}

export function chargerContenuFetch(base = "/") {
  return chargerContenu(async (chemin) => {
    let reponse = await fetch(base + chemin);
    if (!reponse.ok) throw Error(`HTTP ${reponse.status}`);
    return reponse.text();
  });
}