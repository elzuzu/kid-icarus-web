import { n as largeur, t as hauteur } from "../core";
import { Assets, Container, Graphics, Sprite, type Ticker } from "pixi.js";
import { n as textureTache, o as Text, r as textureVignette } from "../render/textures";
import {
  a as dessinerPanneau,
  c as CoucheParticules,
  n as OR,
  o as styleTexte,
  r as BRONZE,
  s as styleTitre,
} from "../render/theme";

const base = import.meta.env.BASE_URL;

interface ContexteScene {
  app: any;
  partie: any;
  audio: any;
  racine: any;
  entrees: any;
  allerA: (scene: string, params?: any) => void;
}

const textesFin: Record<string, [string, string]> = {
  heroique: [
    `FIN HÉROÏQUE`,
    `Médusa est vaincue et la lumière de Palutena baigne de nouveau Skyworld.
Pit, héros couronné de lauriers, veille désormais aux côtés de sa déesse.`,
  ],
  lumineuse: [
    `FIN LUMINEUSE`,
    `Les ténèbres se dissipent sur la Surface et le Ciel.
Pit reprend son envol, léger, au-dessus d’un monde rendu à la lumière.`,
  ],
  sobre: [
    `FIN`,
    `Médusa est tombée, mais la route fut longue.
À l’aube, Pit contemple les nuages… et songe qu’il peut encore mieux faire.`,
  ],
};

const CREDITS: [string, string][] = [
  [`GAME DESIGN & FEEL`, `l’équipe Balance`],
  [`LEVEL DESIGN & CAMPAGNE`, `l’équipe Level`],
  [`SOUND DESIGN & MUSIQUES`, `l’équipe Audio`],
  [`TECHNICAL ART & LUMIÈRE`, `l’équipe Techart`],
  [`INTERFACE & CONFORT`, `l’équipe UI`],
  [`MOTEUR & PERFORMANCE`, `l’équipe QA`],
  [`D’APRÈS KID ICARUS`, `Nintendo, 1986`],
];

const couleursRang: Record<string, number> = {
  S: 16767050,
  A: 16751178,
  B: 9095423,
  C: 13156560,
};

function formatTemps(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = Math.floor(secondes % 60);
  return `${m}:${String(s).padStart(2, `0`)}`;
}

// Le dropShadow de styleTitre se rend en bandes noires au-dessus des glyphes
// sur fond clair (bug Pixi letterSpacing + ombre). Le contour noir suffit au
// contraste : on coupe l'ombre pour tout texte posé sur l'illustration.
function styleTitreNet(taille: number, couleur: number): ReturnType<typeof styleTitre> {
  const style = styleTitre(taille, couleur);
  style.dropShadow = false;
  return style;
}

const lancer = async (ctx: ContexteScene) => {
  const { app, partie, audio } = ctx;
  const racine = ctx.racine;
  const variante = partie.varianteFin();
  audio.musique(`fin`, { fondu: 2 });
  audio.declencherDialogue(`fin_${variante}`);
  const texFond = await Assets.load(`${base}assets/art/ui/fin_${variante}.webp`).catch(() =>
    Assets.load(`${base}assets/art/decors/profondeurs/fond_lointain.webp`),
  );
  const fond = new Sprite(texFond);
  fond.anchor.set(0.5);
  fond.scale.set(Math.max(largeur / texFond.width, hauteur / texFond.height) * 1.1);
  fond.position.set(largeur / 2, hauteur / 2);
  fond.alpha = 0;
  const lumieres = new CoucheParticules(textureTache(32), `lumieres`, largeur, hauteur, 80);
  const vignette = new Sprite(textureVignette(0.7));
  vignette.width = largeur;
  vignette.height = hauteur;
  const [titre, sousTitre] = textesFin[variante] ?? textesFin.sobre ?? [``, ``];
  const texteTitre = new Text({ text: titre, style: styleTitreNet(72, 16770984) });
  texteTitre.anchor.set(0.5);
  texteTitre.position.set(largeur / 2, 120);
  const texteSousTitre = new Text({ text: sousTitre, style: styleTexte(28, 16051420) });
  texteSousTitre.style.align = `center`;
  texteSousTitre.style.wordWrap = true;
  texteSousTitre.style.wordWrapWidth = 1200;
  texteSousTitre.anchor.set(0.5);
  texteSousTitre.position.set(largeur / 2, 205);
  texteTitre.alpha = texteSousTitre.alpha = 0;
  racine.addChild(fond, lumieres, vignette, texteTitre, texteSousTitre);
  // ---- Crédits défilants lents ----
  const credits = new Container();
  let yCurseur = 0;
  const ajouterLigne = (texte: string, style: any, espacement: number) => {
    const ligne = new Text({ text: texte, style });
    ligne.anchor.set(0.5, 0);
    ligne.position.set(0, yCurseur);
    credits.addChild(ligne);
    yCurseur += espacement;
  };
  ajouterLigne(`L’ASCENSION`, styleTitreNet(36, OR), 70);
  for (const [role, nom] of CREDITS) {
    ajouterLigne(role, styleTexte(20, BRONZE), 30);
    ajouterLigne(nom, styleTitreNet(27, 15983280), 62);
  }
  ajouterLigne(`Merci d’avoir joué.`, styleTitreNet(30, 16770984), 60);
  const hauteurCredits = yCurseur;
  credits.x = largeur / 2;
  credits.y = hauteur + 40;
  const yFinalCredits = -hauteurCredits - 60;
  racine.addChild(credits);
  // ---- Bilan de campagne ----
  const bilan = new Container();
  const panneauBilan = dessinerPanneau(new Graphics(), largeur / 2 - 460, 320, 920, 430, 0.9);
  bilan.addChild(panneauBilan);
  const titreBilan = new Text({ text: `BILAN DE LA CAMPAGNE`, style: styleTitre(32, OR) });
  titreBilan.anchor.set(0.5);
  titreBilan.position.set(largeur / 2, 372);
  bilan.addChild(titreBilan);
  const ordre: string[] = partie.ordreStages();
  const termines = ordre.filter((id) => partie.stageTermine(id));
  const rangs: Record<string, number> = { S: 0, A: 0, B: 0, C: 0 };
  let tempsCumule = 0;
  for (const id of termines) {
    const etat = partie.profil.stages[id];
    rangs[etat?.rang ?? `C`] = (rangs[etat?.rang ?? `C`] ?? 0) + 1;
    tempsCumule += etat?.meilleur_temps ?? 0;
  }
  const xGauche = largeur / 2 - 400;
  const xDroite = largeur / 2 + 400;
  const ligneBilan = (libelle: string, valeur: string, y: number, couleur = 16770984) => {
    const gauche = new Text({ text: libelle, style: styleTexte(25, 14208184) });
    gauche.anchor.set(0, 0.5);
    gauche.position.set(xGauche, y);
    const droite = new Text({ text: valeur, style: styleTexte(27, couleur) });
    droite.anchor.set(1, 0.5);
    droite.position.set(xDroite, y);
    bilan.addChild(gauche, droite);
  };
  ligneBilan(`Stages terminés`, `${termines.length} / ${ordre.length}`, 435);
  ligneBilan(`Temps cumulé (records)`, formatTemps(tempsCumule), 490);
  ligneBilan(`Cœurs`, `♥ ${partie.coeurs}`, 545);
  ligneBilan(
    `Épilogue`,
    variante === `heroique` ? `Héroïque` : variante === `lumineuse` ? `Lumineuse` : `Sobre`,
    600,
  );
  if ((partie.profil.ng_plus ?? 0) > 0)
    ligneBilan(`Nouvelle partie +`, `${partie.profil.ng_plus}`, 655);
  // Rangs obtenus : lettres colorées directement lisibles.
  const libelleRangs = new Text({ text: `Rangs obtenus`, style: styleTexte(25, 14208184) });
  libelleRangs.anchor.set(0, 0.5);
  libelleRangs.position.set(xGauche, 710);
  bilan.addChild(libelleRangs);
  let xRang = xDroite;
  for (const lettre of [`C`, `B`, `A`, `S`]) {
    const nombre = rangs[lettre] ?? 0;
    const texte = new Text({
      text: `${lettre}×${nombre}`,
      style: styleTexte(27, nombre > 0 ? couleursRang[lettre] : 0x6c6478),
    });
    texte.anchor.set(1, 0.5);
    texte.position.set(xRang, 710);
    bilan.addChild(texte);
    xRang -= texte.width + 34;
  }
  bilan.alpha = 0;
  bilan.visible = false;
  racine.addChild(bilan);
  const aide = new Text({ text: `Entrée : passer`, style: styleTexte(22, 14208184) });
  aide.anchor.set(0.5);
  aide.position.set(largeur / 2, hauteur - 46);
  // Pastille sombre : le générique défile derrière l'aide, elle reste lisible.
  const fondAide = new Graphics();
  const majFondAide = () => {
    fondAide.clear();
    fondAide
      .roundRect(largeur / 2 - aide.width / 2 - 24, hauteur - 66, aide.width + 48, 40, 20)
      .fill({ color: 460298, alpha: 0.55 });
  };
  majFondAide();
  racine.addChild(fondAide, aide);
  let temps = 0;
  let phase: `credits` | `bilan` = `credits`;
  let tempsBilan = 0;
  const passerAuBilan = () => {
    if (phase === `bilan`) return;
    phase = `bilan`;
    credits.y = yFinalCredits;
    credits.visible = false;
    bilan.visible = true;
    aide.text = `Entrée : retour au titre`;
    majFondAide();
  };
  const pas = (tick: Ticker) => {
    const dt = Math.min(0.1, tick.deltaMS / 1000);
    temps += dt;
    lumieres.mettreAJour(dt);
    fond.alpha = Math.min(1, temps / 3);
    fond.scale.set(
      Math.max(largeur / texFond.width, hauteur / texFond.height) *
        (1.1 - Math.min(0.08, temps * 0.004)),
    );
    texteTitre.alpha = Math.min(1, Math.max(0, (temps - 1.2) / 1.5));
    texteSousTitre.alpha = Math.min(1, Math.max(0, (temps - 2.2) / 1.5));
    if (phase === `credits`) {
      if (temps > 4.5) credits.y -= 48 * dt;
      // Fondu en haut : les lignes s'effacent avant la zone titre/sous-titre,
      // jamais de collision entre le générique et l'en-tête fixe.
      for (const ligne of credits.children) {
        const yHaut = credits.y + ligne.y;
        ligne.alpha = Math.max(0, Math.min(1, (yHaut - 270) / 90));
      }
      if (credits.y <= yFinalCredits) passerAuBilan();
    } else {
      tempsBilan += dt;
      bilan.alpha = Math.min(1, tempsBilan / 0.9);
    }
    aide.alpha = temps > 1.5 ? 0.55 + 0.35 * Math.sin(temps * 2.8) : 0;
    fondAide.alpha = aide.alpha;
    const entrees = ctx.entrees.lire();
    if (
      temps > 1.5 &&
      (entrees.sautPresse || entrees.interagirPresse || entrees.pausePresse)
    ) {
      if (phase === `credits`) {
        audio.sfx(`menu_valider`);
        passerAuBilan();
      } else if (tempsBilan > 0.6) {
        audio.sfx(`menu_valider`);
        ctx.allerA(`titre`);
      }
    }
  };
  app.ticker.add(pas);
  return () => {
    app.ticker.remove(pas);
  };
};

export { lancer };