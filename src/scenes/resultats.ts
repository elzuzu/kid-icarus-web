import { n as largeur, t as hauteur } from "../core";
import { Container, Graphics, Sprite, type Ticker } from "pixi.js";
import { n as textureTache, o as Text } from "../render/textures";
import {
  a as dessinerPanneau,
  c as CoucheParticules,
  i as formatNombre,
  o as styleTexte,
  s as styleTitre,
} from "../render/theme";

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

const lancer = async (ctx: ContexteScene) => {
  const { app, partie, audio } = ctx;
  const resultat = partie.resultat;
  const racine = ctx.racine;
  const fond = new Graphics().rect(0, 0, largeur, hauteur).fill(591629);
  const lumieres = new CoucheParticules(
    textureTache(32),
    `lumieres`,
    largeur,
    hauteur,
    60,
  );
  racine.addChild(
    fond,
    lumieres,
    dessinerPanneau(new Graphics(), largeur / 2 - 520, 150, 1040, 780),
  );
  audio.musique(resultat?.reussi ? `victoire` : `game_over`, { fondu: 0.4 });
  const nomStage = partie.infosStage(resultat?.id ?? ``)?.nom ?? ``;
  const texteTitre = new Text({
    text: resultat?.reussi
      ? `${nomStage.toUpperCase()} — RÉUSSI`
      : `${nomStage.toUpperCase()} — ÉCHEC`,
    style: styleTitre(44),
  });
  texteTitre.anchor.set(0.5);
  texteTitre.position.set(largeur / 2, 225);
  racine.addChild(texteTitre);
  const blocRang = new Container();
  const texteRang = new Text({
    text: resultat?.rang ?? `-`,
    style: styleTitre(260, couleursRang[resultat?.rang ?? `-`] ?? 16777215),
  });
  texteRang.anchor.set(0.5);
  const haloRang = new Sprite(textureTache(256));
  haloRang.anchor.set(0.5);
  haloRang.blendMode = `add`;
  haloRang.tint = couleursRang[resultat?.rang ?? `-`] ?? 16777215;
  haloRang.scale.set(2.4);
  blocRang.addChild(haloRang, texteRang);
  blocRang.position.set(largeur / 2 - 250, 520);
  racine.addChild(blocRang);
  const tempsFormate = resultat
    ? `${Math.floor(resultat.duree_s / 60)}:${String(Math.floor(resultat.duree_s % 60)).padStart(2, `0`)}`
    : `—`;
  const lignes = resultat?.defi
    ? [
        `Temps : ${tempsFormate}${resultat.record ? `   ★ record du jour` : ``}`,
        `Morts : ${resultat.morts}`,
        `Chutes : ${resultat.chutes}`,
      ]
    : [
        `Temps : ${tempsFormate}`,
        `Morts : ${resultat?.morts ?? 0}   ·   Chutes : ${resultat?.chutes ?? 0}`,
        `Intensité : ${formatNombre(resultat?.intensite ?? 0, 1)}`,
        `Mise : ♥ ${resultat?.mise ?? 0}`,
        `Gain : ♥ ${resultat?.gain ?? 0}`,
        `Cœurs : ♥ ${partie.coeurs}`,
      ];
  lignes.forEach((ligne, i) => {
    const texte = new Text({ text: ligne, style: styleTexte(32, 15787732) });
    texte.position.set(largeur / 2 - 20, 350 + i * 62);
    texte.alpha = 0;
    racine.addChild(texte);
  });
  const texteContinuer = new Text({
    text: `Espace / A : continuer`,
    style: styleTexte(24, 14208184),
  });
  texteContinuer.anchor.set(0.5);
  texteContinuer.position.set(largeur / 2, 880);
  racine.addChild(texteContinuer);
  let temps = 0;
  const pas = (tick: Ticker) => {
    const dt = Math.min(0.1, tick.deltaMS / 1000);
    temps += dt;
    lumieres.mettreAJour(dt);
    const apparition = Math.min(1, temps / 0.5);
    blocRang.scale.set(
      2.2 -
        1.2 * (1 - (1 - apparition) * (1 - apparition)) +
        (apparition >= 1
          ? Math.sin((temps - 0.5) * 14) * Math.exp(-(temps - 0.5) * 5) * 0.08
          : 0),
    );
    blocRang.alpha = apparition;
    haloRang.alpha = 0.35 + 0.2 * Math.sin(temps * 2);
    racine.children.forEach((enfant, i) => {
      if (
        enfant instanceof Text &&
        enfant !== texteTitre &&
        enfant !== texteContinuer &&
        enfant !== texteRang
      )
        enfant.alpha = Math.min(1, Math.max(0, (temps - 0.6 - i * 0.02) * 3));
    });
    texteContinuer.alpha = 0.6 + 0.4 * Math.sin(temps * 3);
    const entrees = ctx.entrees.lire();
    if (
      temps > 0.8 &&
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