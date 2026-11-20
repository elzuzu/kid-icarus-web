import { n as largeur, t as hauteur } from "../core";
import { Assets, Container, Sprite, type Ticker } from "pixi.js";
import {
  n as textureTache,
  o as Text,
  r as textureVignette,
} from "../render/textures";
import {
  c as CoucheParticules,
  o as styleTexte,
  s as styleTitre,
  t as Bouton,
} from "../render/theme";
import { t as Menu } from "../ui/menu";

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
  const lumieres = new CoucheParticules(
    textureTache(32),
    `lumieres`,
    largeur,
    hauteur,
    70,
  );
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
  logo.position.set(largeur / 2, 230);
  racine.addChild(logo);
  const boutons: Bouton[] = [];
  const ajouterBouton = (libelle: string, action: () => void, actif = true) => {
    const bouton = new Bouton(libelle, 460, 64, action);
    bouton.actif = actif;
    boutons.push(bouton);
  };
  if (partie.aUneSauvegarde())
    ajouterBouton(`Continuer`, () => ctx.allerA(`carte`));
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
    },
    partie.defiDuJour() !== null,
  );
  const menu = new Menu(boutons);
  boutons.forEach((bouton, i) =>
    bouton.position.set(largeur / 2 - bouton.largeur / 2, 560 + i * 84),
  );
  racine.addChild(menu);
  const texteAide = new Text({
    text: `Espace / A : valider   ·   ↑ ↓ : choisir`,
    style: styleTexte(20, 14208184),
  });
  texteAide.anchor.set(0.5);
  texteAide.position.set(largeur / 2, hauteur - 50);
  texteAide.alpha = 0.8;
  racine.addChild(texteAide);
  let temps = 0;
  const pas = (tick: Ticker) => {
    const dt = Math.min(0.1, tick.deltaMS / 1000);
    temps += dt;
    fond.x = largeur / 2 + Math.sin(temps * 0.07) * 24;
    fond.y = hauteur / 2 + Math.cos(temps * 0.05) * 14;
    haloLogo.alpha = 0.35 + 0.15 * Math.sin(temps * 1.3);
    lumieres.mettreAJour(dt);
    menu.pas(dt, ctx.entrees.lire());
  };
  app.ticker.add(pas);
  return () => {
    app.ticker.remove(pas);
  };
};

export { lancer };