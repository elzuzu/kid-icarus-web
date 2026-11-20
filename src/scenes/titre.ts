import { n as largeur, t as hauteur } from "../core";
import { Assets, Container, Graphics, Sprite, type Ticker } from "pixi.js";
import {
  n as textureTache,
  o as Text,
  r as textureVignette,
} from "../render/textures";
import {
  a as dessinerPanneau,
  c as CoucheParticules,
  n as OR,
  o as styleTexte,
  s as styleTitre,
  t as Bouton,
} from "../render/theme";
import { t as Menu } from "../ui/menu";
import { PanneauOptions } from "../ui/options";

const base = import.meta.env.BASE_URL;

interface ContexteScene {
  app: any;
  partie: any;
  audio: any;
  racine: Container;
  entrees: any;
  allerA: (scene: string, params?: any) => void;
}

async function chargerFond() {
  return Assets.load(`${base}assets/art/ui/titre.webp`).catch(() =>
    Assets.load(`${base}assets/art/decors/profondeurs/fond_lointain.webp`),
  );
}

const lancer = async (ctx: ContexteScene) => {
  const { app, partie, audio } = ctx;
  const racine = ctx.racine;
  audio.musique(`titre`, { fondu: 1.5 });
  const texFond = await chargerFond();
  const fond = new Sprite(texFond);
  fond.anchor.set(0.5);
  fond.scale.set(Math.max(largeur / texFond.width, hauteur / texFond.height) * 1.08);
  fond.position.set(largeur / 2, hauteur / 2);
  racine.addChild(fond);
  // Fond vivant mais sobre : particules poolées (ChampParticules), dérive lente du fond.
  const lumieres = new CoucheParticules(textureTache(32), `lumieres`, largeur, hauteur, 70);
  const vignette = new Sprite(textureVignette(0.65));
  vignette.width = largeur;
  vignette.height = hauteur;
  racine.addChild(lumieres, vignette);
  const logo = new Container();
  const haloLogo = new Sprite(textureTache(256));
  haloLogo.anchor.set(0.5);
  haloLogo.tint = 16765040;
  haloLogo.blendMode = `add`;
  haloLogo.scale.set(6, 1.6);
  const titreJeu = new Text({ text: `KID ICARUS`, style: styleTitre(118, 16770984) });
  titreJeu.anchor.set(0.5);
  const sousTitre = new Text({ text: `L’ASCENSION`, style: styleTitre(40, 15983280) });
  sousTitre.anchor.set(0.5);
  sousTitre.y = 92;
  logo.addChild(haloLogo, titreJeu, sousTitre);
  logo.position.set(largeur / 2, 205);
  racine.addChild(logo);
  // Invite pulsée : le premier geste attendu est visible immédiatement.
  const invite = new Text({ text: `— APPUIE SUR ENTRÉE —`, style: styleTitre(26, OR) });
  invite.anchor.set(0.5);
  invite.position.set(largeur / 2, 415);
  const boutons: Bouton[] = [];
  const ajouterBouton = (libelle: string, action: () => void, actif = true) => {
    const bouton = new Bouton(libelle, 460, 62, () => {
      audio.sfx(`menu_valider`);
      action();
    });
    bouton.actif = actif;
    boutons.push(bouton);
  };
  if (partie.aUneSauvegarde()) ajouterBouton(`Continuer`, () => ctx.allerA(`carte`));
  ajouterBouton(`Nouvelle partie`, () => {
    partie.nouvellePartie();
    ctx.allerA(`carte`);
  });
  if (partie.ordreStages().every((id: string) => partie.stageTermine(id)))
    ajouterBouton(`Nouvelle partie + ${(partie.profil.ng_plus ?? 0) + 1}`, () => {
      partie.nouvellePartiePlus();
      ctx.allerA(`carte`);
    });
  ajouterBouton(
    `Défi du jour`,
    () => {
      if (partie.lancerDefi()) ctx.allerA(`stage`);
      else audio.sfx(`refus`);
    },
    partie.defiDuJour() !== null,
  );
  let optionsOuvert = false;
  const voileOptions = new Graphics()
    .rect(0, 0, largeur, hauteur)
    .fill({ color: 0x050308, alpha: 0.66 });
  voileOptions.eventMode = `static`;
  voileOptions.on(`pointertap`, () => {
    audio.sfx(`menu_retour`);
    fermerOptions();
  });
  const boiteOptions = dessinerPanneau(new Graphics(), largeur / 2 - 420, 145, 840, 790, 0.94);
  const titreOptions = new Text({ text: `OPTIONS`, style: styleTitre(54) });
  titreOptions.anchor.set(0.5);
  titreOptions.position.set(largeur / 2, 218);
  const panneauOptions = new PanneauOptions({
    retour: () => fermerOptions(),
    audio,
    largeur: 740,
  });
  panneauOptions.position.set(largeur / 2 - 370, 272);
  const aideOptions = new Text({
    text: `↑ ↓ choisir   ·   ← → régler   ·   Échap retour`,
    style: styleTexte(20, 14208184),
  });
  aideOptions.anchor.set(0.5);
  aideOptions.position.set(largeur / 2, 888);
  const coucheOptions = new Container();
  coucheOptions.addChild(voileOptions, boiteOptions, titreOptions, panneauOptions, aideOptions);
  coucheOptions.visible = false;
  function fermerOptions() {
    if (!optionsOuvert) return;
    optionsOuvert = false;
    coucheOptions.visible = false;
  }
  ajouterBouton(`Options`, () => {
    optionsOuvert = true;
    panneauOptions.rafraichir();
    coucheOptions.visible = true;
    panneauOptions.menu.selectionner(0);
    audio.sfx(`menu_ouvrir`);
  });
  ajouterBouton(`Vitrine`, () => ctx.allerA(`vitrine`));
  const menu = new Menu(boutons);
  menu.surNavigation = () => audio.sfx(`menu_deplacer`);
  // Voile antique derrière la colonne de menu : l'art reste visible mais le
  // contraste texte/fond est garanti (≥ 4.5:1) quelle que soit la luminosité du fond.
  const hautBoite = 378;
  const basBoite = 465 + (boutons.length - 1) * 76 + 62 + 24;
  const boiteMenu = dessinerPanneau(new Graphics(), largeur / 2 - 290, hautBoite, 580, basBoite - hautBoite, 0.62);
  const positionsX: number[] = [];
  boutons.forEach((bouton, i) => {
    const x = largeur / 2 - bouton.largeur / 2;
    positionsX.push(x);
    bouton.position.set(x, 465 + i * 76);
  });
  racine.addChild(boiteMenu, invite, menu, coucheOptions);
  const texteAide = new Text({
    text: `↑ ↓ choisir   ·   Entrée / Espace valider   ·   souris : cliquer`,
    style: styleTexte(20, 14208184),
  });
  texteAide.anchor.set(0.5);
  texteAide.position.set(largeur / 2, 965);
  texteAide.alpha = 0.8;
  const signature = new Text({
    text: `Remake web · PixiJS 8 · hommage au classique Nintendo`,
    style: styleTexte(18, 12101808),
  });
  signature.anchor.set(0.5);
  signature.position.set(largeur / 2, 1030);
  signature.alpha = 0.55;
  racine.addChild(texteAide, signature);
  let temps = 0;
  const pas = (tick: Ticker) => {
    const dt = Math.min(0.1, tick.deltaMS / 1000);
    temps += dt;
    fond.x = largeur / 2 + Math.sin(temps * 0.07) * 24;
    fond.y = hauteur / 2 + Math.cos(temps * 0.05) * 14;
    haloLogo.alpha = 0.35 + 0.15 * Math.sin(temps * 1.3);
    // Entrée en scène étagée : logo, invite, puis boutons en cascade.
    const entreeLogo = Math.min(1, temps / 0.9);
    const easeLogo = 1 - (1 - entreeLogo) * (1 - entreeLogo);
    logo.alpha = easeLogo;
    boiteMenu.alpha = easeLogo;
    logo.scale.set(1.06 - 0.06 * easeLogo);
    logo.y = 205 - 18 * (1 - easeLogo) + Math.sin(temps * 0.8) * 5 * easeLogo;
    invite.alpha = easeLogo * (0.55 + 0.4 * Math.sin(temps * 2.6));
    boutons.forEach((bouton, i) => {
      const alpha = Math.min(1, Math.max(0, (temps - 0.45 - i * 0.09) * 3));
      bouton.alpha = alpha;
      bouton.x = positionsX[i] - 34 * (1 - alpha);
    });
    lumieres.mettreAJour(dt);
    const entrees = ctx.entrees.lire();
    if (optionsOuvert) panneauOptions.menu.pas(dt, entrees);
    else menu.pas(dt, entrees);
  };
  app.ticker.add(pas);
  return () => {
    app.ticker.remove(pas);
  };
};

export { lancer };