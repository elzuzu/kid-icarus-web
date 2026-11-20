import { n as largeur, t as hauteur } from "../core";
import { Assets, Sprite, type Ticker } from "pixi.js";
import {
  n as textureTache,
  o as Text,
  r as textureVignette,
} from "../render/textures";
import {
  c as CoucheParticules,
  o as styleTexte,
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

const lancer = async (ctx: ContexteScene) => {
  const { app, partie, audio } = ctx;
  const racine = ctx.racine;
  const variante = partie.varianteFin();
  audio.musique(`fin`, { fondu: 2 });
  audio.declencherDialogue(`fin_${variante}`);
  const texFond = await Assets.load(
    `${base}assets/art/ui/fin_${variante}.webp`,
  ).catch(() =>
    Assets.load(`${base}assets/art/decors/profondeurs/fond_lointain.webp`),
  );
  const fond = new Sprite(texFond);
  fond.anchor.set(0.5);
  fond.scale.set(Math.max(largeur / texFond.width, hauteur / texFond.height) * 1.1);
  fond.position.set(largeur / 2, hauteur / 2);
  fond.alpha = 0;
  const lumieres = new CoucheParticules(
    textureTache(32),
    `lumieres`,
    largeur,
    hauteur,
    80,
  );
  const vignette = new Sprite(textureVignette(0.7));
  vignette.width = largeur;
  vignette.height = hauteur;
  const [titre, sousTitre] = textesFin[variante] ?? textesFin.sobre ?? [``, ``];
  const texteTitre = new Text({ text: titre, style: styleTitre(76, 16770984) });
  texteTitre.anchor.set(0.5);
  texteTitre.position.set(largeur / 2, hauteur - 250);
  const texteSousTitre = new Text({ text: sousTitre, style: styleTexte(30, 16051420) });
  texteSousTitre.style.align = `center`;
  texteSousTitre.anchor.set(0.5);
  texteSousTitre.position.set(largeur / 2, hauteur - 150);
  texteTitre.alpha = texteSousTitre.alpha = 0;
  racine.addChild(fond, lumieres, vignette, texteTitre, texteSousTitre);
  let temps = 0;
  const pas = (tick: Ticker) => {
    const dt = Math.min(0.1, tick.deltaMS / 1000);
    temps += dt;
    lumieres.mettreAJour(dt);
    fond.alpha = Math.min(1, temps / 3);
    fond.scale.set(
      Math.max(largeur / texFond.width, hauteur / texFond.height) *
        (1.1 - Math.min(0.08, temps * 0.004)),
    );
    texteTitre.alpha = Math.min(1, Math.max(0, (temps - 2.5) / 1.5));
    texteSousTitre.alpha = Math.min(1, Math.max(0, (temps - 4) / 1.5));
    const entrees = ctx.entrees.lire();
    if (
      temps > 6 &&
      (entrees.sautPresse || entrees.interagirPresse || entrees.pausePresse)
    )
      ctx.allerA(`titre`);
  };
  app.ticker.add(pas);
  return () => {
    app.ticker.remove(pas);
  };
};

export { lancer };