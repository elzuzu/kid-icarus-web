import { n as largeur, t as hauteur } from "../core";
import { Assets, Container, Graphics, Sprite, type Ticker } from "pixi.js";
import { n as textureTache, o as Text } from "../render/textures";
import {
  a as dessinerPanneau,
  c as CoucheParticules,
  n as OR,
  o as styleTexte,
  r as BRONZE,
  s as styleTitre,
} from "../render/theme";
import { options } from "../app/options";

const base = import.meta.env.BASE_URL;

interface ContexteScene {
  app: any;
  partie: any;
  audio: any;
  racine: Container;
  entrees: any;
  allerA: (scene: string, params?: any) => void;
}

const couleursRang: Record<string, number> = {
  S: 16767050,
  A: 16751178,
  B: 9095423,
  C: 13156560,
  "-": 13156560,
};

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const avancement = (temps: number, debut: number, duree: number) =>
  easeOut(Math.max(0, Math.min(1, (temps - debut) / duree)));

function formatTemps(secondes: number): string {
  return `${Math.floor(secondes / 60)}:${String(Math.floor(secondes % 60)).padStart(2, `0`)}`;
}

const lancer = async (ctx: ContexteScene) => {
  const { app, partie, audio } = ctx;
  const resultat = partie.resultat;
  const racine = ctx.racine;
  const reussi = !!resultat?.reussi;
  const rang = String(resultat?.rang ?? `-`);
  // Échec : le rang calculé est C (sauvegarde stocke "-") ; on affiche C grisé,
  // un tiret géant en Palatino 220 px se lisant comme une tache.
  const lettreRang = reussi ? rang : `C`;
  const couleurRang = reussi ? couleursRang[rang] ?? 16777215 : 0x9c8c6c;
  const fond = new Graphics().rect(0, 0, largeur, hauteur).fill(591629);
  const lumieres = new CoucheParticules(textureTache(32), `lumieres`, largeur, hauteur, 60);
  racine.addChild(fond, lumieres);
  audio.musique(reussi ? `victoire` : `game_over`, { fondu: 0.4 });
  const texCoeur = await Assets.load(`${base}assets/art/hud/coeur.webp`).catch(() => null);
  // Tout le contenu tient dans un plateau : la secousse d'impact le déplace sans toucher au fond.
  const plateau = new Container();
  racine.addChild(plateau);
  const panneau = dessinerPanneau(new Graphics(), largeur / 2 - 560, 140, 1120, 800, 0.92);
  plateau.addChild(panneau);
  const nomStage = partie.infosStage(resultat?.id ?? ``)?.nom ?? ``;
  const texteTitre = new Text({
    text: `${nomStage.toUpperCase()} — ${reussi ? `RÉUSSI` : `ÉCHEC`}`,
    style: styleTitre(42, reussi ? 16770984 : 15983280),
  });
  texteTitre.anchor.set(0.5);
  texteTitre.position.set(largeur / 2, 212);
  plateau.addChild(texteTitre);
  // ---- Rang : halo, couronne de lauriers, lettre tamponnée ----
  const blocRang = new Container();
  const haloRang = new Sprite(textureTache(256));
  haloRang.anchor.set(0.5);
  haloRang.blendMode = `add`;
  haloRang.tint = couleurRang;
  haloRang.scale.set(2.4);
  const couronne = new Graphics();
  couronne.circle(0, 0, 152).stroke({ color: OR, width: 3, alpha: 0.95 });
  couronne.circle(0, 0, 132).stroke({ color: BRONZE, width: 1.5, alpha: 0.9 });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const x = Math.cos(angle) * 152;
    const y = Math.sin(angle) * 152;
    couronne
      .poly([x, y - 9, x + 6, y, x, y + 9, x - 6, y])
      .fill(i % 3 === 0 ? OR : BRONZE)
      .stroke({ color: 0x1a1206, width: 1 });
  }
  const texteRang = new Text({ text: lettreRang, style: styleTitre(220, couleurRang) });
  texteRang.anchor.set(0.5);
  texteRang.y = 8;
  blocRang.addChild(haloRang, couronne, texteRang);
  blocRang.position.set(largeur / 2 - 320, 515);
  blocRang.alpha = 0;
  plateau.addChild(blocRang);
  // Onde de choc + étincelles du tampon (poolées, une seule salve).
  const onde = new Sprite(textureTache(256));
  onde.anchor.set(0.5);
  onde.blendMode = `add`;
  onde.tint = couleurRang;
  onde.position.copyFrom(blocRang.position);
  onde.alpha = 0;
  plateau.addChild(onde);
  const etincelles: { s: Sprite; vx: number; vy: number; vie: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const s = new Sprite(textureTache(32));
    s.anchor.set(0.5);
    s.blendMode = `add`;
    s.tint = i % 2 ? couleurRang : 16773836;
    s.alpha = 0;
    plateau.addChild(s);
    etincelles.push({ s, vx: 0, vy: 0, vie: 1 });
  }
  const voileFlash = new Graphics().rect(0, 0, largeur, hauteur).fill({ color: 0xfff6dc, alpha: 1 });
  voileFlash.alpha = 0;
  racine.addChild(voileFlash);
  // ---- Lignes de stats (compteurs animés, libellé à gauche, valeur à droite) ----
  const xLibelle = largeur / 2 - 90;
  const xValeur = largeur / 2 + 510;
  interface Ligne {
    libelle: Text;
    valeur: Text;
    separateur: Graphics;
    cible: number;
    debut: number;
    formater: (v: number) => string;
  }
  const lignes: Ligne[] = [];
  const definirLignes = (defs: { libelle: string; cible: number; formater?: (v: number) => string }[]) => {
    defs.forEach((def, i) => {
      const y = 330 + i * 62;
      const libelle = new Text({ text: def.libelle, style: styleTexte(26, 14208184) });
      libelle.anchor.set(0, 0.5);
      libelle.position.set(xLibelle, y);
      const valeur = new Text({ text: `0`, style: styleTexte(30, OR) });
      valeur.anchor.set(1, 0.5);
      valeur.position.set(xValeur, y);
      const separateur = new Graphics();
      separateur
        .moveTo(xLibelle, y + 30)
        .lineTo(xValeur, y + 30)
        .stroke({ color: BRONZE, width: 1, alpha: 0.35 });
      libelle.alpha = valeur.alpha = separateur.alpha = 0;
      plateau.addChild(separateur, libelle, valeur);
      lignes.push({
        libelle,
        valeur,
        separateur,
        cible: def.cible,
        debut: 0.95 + i * 0.13,
        formater: def.formater ?? ((v) => String(Math.round(v))),
      });
    });
  };
  if (resultat?.defi) {
    definirLignes([
      { libelle: `Temps`, cible: resultat.duree_s, formater: formatTemps },
      { libelle: `Morts`, cible: resultat.morts ?? 0 },
      { libelle: `Chutes`, cible: resultat.chutes ?? 0 },
    ]);
  } else {
    definirLignes([
      { libelle: `Temps`, cible: resultat?.duree_s ?? 0, formater: formatTemps },
      { libelle: `Morts`, cible: resultat?.morts ?? 0 },
      { libelle: `Chutes`, cible: resultat?.chutes ?? 0 },
      { libelle: `Dégâts subis`, cible: resultat?.degats_subis ?? 0 },
      { libelle: `Ennemis vaincus`, cible: resultat?.ennemis_tues ?? 0 },
    ]);
  }
  // ---- Bandeau mise / gain / cœurs ----
  const bandeau = new Container();
  bandeau.position.set(0, 0);
  plateau.addChild(bandeau);
  const cellules: { titreCellule: Text; valeur: Text; cible: number; debut: number; coeur: Sprite | null }[] = [];
  const cellule = (cx: number, libelle: string, cible: number, couleur: number, debut: number) => {
    const titreCellule = new Text({ text: libelle, style: styleTexte(20, BRONZE) });
    titreCellule.anchor.set(0.5);
    titreCellule.position.set(cx, 712);
    titreCellule.style.letterSpacing = 3;
    const valeur = new Text({ text: `0`, style: styleTitre(40, couleur) });
    valeur.anchor.set(0, 0.5);
    valeur.position.set(cx - 34, 762);
    let coeur: Sprite | null = null;
    if (texCoeur) {
      coeur = new Sprite(texCoeur);
      coeur.anchor.set(0.5);
      coeur.height = 36;
      coeur.scale.x = coeur.scale.y;
      coeur.position.set(cx - 62, 762);
      bandeau.addChild(coeur);
    }
    titreCellule.alpha = valeur.alpha = 0;
    if (coeur) coeur.alpha = 0;
    bandeau.addChild(titreCellule, valeur);
    cellules.push({ titreCellule, valeur, cible, debut, coeur });
  };
  let badgeRecord: Text | null = null;
  if (resultat?.defi) {
    const titreDefi = new Text({ text: `DÉFI DU JOUR`, style: styleTitre(38, 15983280) });
    titreDefi.anchor.set(0.5);
    titreDefi.position.set(largeur / 2, 730);
    titreDefi.alpha = 0;
    bandeau.addChild(titreDefi);
    cellules.push({ titreCellule: titreDefi, valeur: titreDefi, cible: 0, debut: 1.7, coeur: null });
    badgeRecord = new Text({
      text: resultat.record ? `★ NOUVEAU RECORD DU JOUR ★` : `Record du jour non battu`,
      style: styleTexte(26, resultat.record ? 16767050 : 14208184),
    });
    badgeRecord.anchor.set(0.5);
    badgeRecord.position.set(largeur / 2, 800);
    badgeRecord.alpha = 0;
    bandeau.addChild(badgeRecord);
  } else {
    cellule(largeur / 2 - 330, `MISE`, resultat?.mise ?? 0, 15983280, 1.7);
    cellule(largeur / 2, `GAIN`, resultat?.gain ?? 0, (resultat?.gain ?? 0) > 0 ? 0x8fd14f : 15983280, 1.85);
    cellule(largeur / 2 + 330, `CŒURS`, partie.coeurs, 16770984, 2.0);
  }
  const texteContinuer = new Text({
    text: `Espace / Entrée : continuer`,
    style: styleTexte(24, 14208184),
  });
  texteContinuer.anchor.set(0.5);
  texteContinuer.position.set(largeur / 2, 900);
  plateau.addChild(texteContinuer);
  let temps = 0;
  let impactJoue = false;
  let secousse = 0;
  const tampon = 0.55;
  const pas = (tick: Ticker) => {
    const dt = Math.min(0.1, tick.deltaMS / 1000);
    temps += dt;
    lumieres.mettreAJour(dt);
    const entreeScene = Math.min(1, temps / 0.4);
    panneau.alpha = texteTitre.alpha = entreeScene;
    // Tampon de rang : chute depuis grand, atterrissage avec rebond amorti.
    const p = Math.max(0, Math.min(1, (temps - tampon) / 0.4));
    blocRang.alpha = Math.min(1, p * 2);
    let echelle = 1 + 2.2 * Math.pow(1 - p, 2.2);
    if (p >= 1) {
      const depuis = temps - tampon - 0.4;
      echelle = 1 + Math.sin(depuis * 16) * Math.exp(-depuis * 6) * 0.06;
      if (!impactJoue) {
        impactJoue = true;
        audio.sfx(reussi ? `impact_critique` : `menu_retour`);
        onde.alpha = reussi ? 0.85 : 0.35;
        onde.scale.set(0.6);
        if (reussi) {
          // Flash et secousse respectent les options d'accessibilité.
          if (options.flashes) voileFlash.alpha = 0.4;
          if (options.secousses) secousse = 1;
          etincelles.forEach((e, i) => {
            const angle = (i / etincelles.length) * Math.PI * 2 + 0.2;
            const vitesse = 320 + (i % 4) * 90;
            e.s.position.copyFrom(blocRang.position);
            e.vx = Math.cos(angle) * vitesse;
            e.vy = Math.sin(angle) * vitesse;
            e.vie = 0;
            e.s.alpha = 1;
            e.s.scale.set(0.3);
          });
        }
      }
    }
    blocRang.scale.set(echelle);
    haloRang.alpha = 0.3 + 0.18 * Math.sin(temps * 2);
    couronne.rotation = Math.sin(temps * 0.4) * 0.03;
    // Onde de choc et étincelles.
    if (onde.alpha > 0) {
      onde.alpha = Math.max(0, onde.alpha - dt * 2.2);
      onde.scale.set(onde.scale.x + dt * 7);
    }
    for (const e of etincelles) {
      if (e.vie >= 1) continue;
      e.vie += dt * 1.6;
      e.s.x += e.vx * dt;
      e.s.y += e.vy * dt;
      e.vy += 260 * dt;
      e.s.alpha = Math.max(0, 1 - e.vie);
      e.s.scale.set(0.3 * (1 - e.vie * 0.6));
    }
    if (voileFlash.alpha > 0) voileFlash.alpha = Math.max(0, voileFlash.alpha - dt * 1.8);
    if (secousse > 0) {
      secousse = Math.max(0, secousse - dt * 2.4);
      plateau.position.set(
        Math.sin(temps * 87) * 7 * secousse,
        Math.cos(temps * 73) * 5 * secousse,
      );
    } else plateau.position.set(0, 0);
    // Compteurs qui montent, ligne par ligne.
    for (const ligne of lignes) {
      const a = avancement(temps, ligne.debut, 0.7);
      ligne.libelle.alpha = ligne.separateur.alpha = Math.min(1, a * 2);
      ligne.valeur.alpha = Math.min(1, a * 2);
      ligne.valeur.text = ligne.formater(ligne.cible * a);
    }
    for (const c of cellules) {
      const a = avancement(temps, c.debut, 0.8);
      c.titreCellule.alpha = Math.min(1, a * 2);
      c.valeur.alpha = Math.min(1, a * 2);
      if (c.coeur) c.coeur.alpha = Math.min(1, a * 2);
      if (c.valeur !== c.titreCellule) c.valeur.text = String(Math.round(c.cible * a));
    }
    if (badgeRecord) badgeRecord.alpha = avancement(temps, 2.2, 0.6);
    texteContinuer.alpha = temps > 1.2 ? 0.6 + 0.4 * Math.sin(temps * 3) : 0;
    const entrees = ctx.entrees.lire();
    if (
      temps > 1.2 &&
      (entrees.sautPresse || entrees.interagirPresse || entrees.pausePresse)
    ) {
      audio.sfx(`menu_valider`);
      ctx.allerA(resultat?.fin ? `fin` : `carte`);
    }
  };
  app.ticker.add(pas);
  return () => {
    app.ticker.remove(pas);
  };
};

export { lancer };