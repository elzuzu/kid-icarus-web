import { Application, Container } from "pixi.js";
import { n as LARGEUR, t as HAUTEUR } from "../core";
import { Audio } from "./audio";
import { base } from "./base";
import { chargerContenuFetch } from "./contenu";
import { Entrees } from "./entrees";
import { Partie, stockageLocal } from "./sauvegarde";
import { chargeursScenes } from "./scenes";

async function demarrer() {
  let app = new Application();
  await app.init({
    width: LARGEUR,
    height: HAUTEUR,
    background: "#07060a",
    antialias: true,
    preference: "webgl",
    autoDensity: false,
  });
  let hote = document.getElementById("jeu");
  if (!hote) throw Error("#jeu absent");
  hote.appendChild(app.canvas);
  let ajuster = () => {
    let echelle = Math.min(window.innerWidth / LARGEUR, window.innerHeight / HAUTEUR);
    app.canvas.style.width = `${Math.floor(LARGEUR * echelle)}px`;
    app.canvas.style.height = `${Math.floor(HAUTEUR * echelle)}px`;
  };
  window.addEventListener("resize", ajuster);
  ajuster();
  let contenu = await chargerContenuFetch(base);
  contenu.exigerValide();
  let partie = new Partie(contenu, stockageLocal),
    audio = new Audio(contenu, {
      base,
      reglages:
        new URLSearchParams(location.search).get("muet") === "1"
          ? { general: 0 }
          : {},
    }),
    reveil = () => {
      audio.demarrer();
    };
  window.addEventListener("pointerdown", reveil);
  window.addEventListener("keydown", reveil);
  let racine = new Container();
  app.stage.addChild(racine);
  let nettoyer: any,
    chaine = Promise.resolve(),
    contexte = {
      app,
      contenu,
      audio,
      partie,
      racine,
      entrees: new Entrees(app.canvas),
      allerA(scene: string, options: any = {}) {
        chaine = chaine
          .then(async () => {
            nettoyer?.();
            audio.taireDialogues();
            for (let enfant of racine.removeChildren()) enfant.destroy({ children: true });
            nettoyer = await (await chargeursScenes[scene]()).lancer(contexte, options);
          })
          .catch((e) => {
            console.error(e);
            (window as any).__erreur = String(e);
          });
      },
    },
    params = Object.fromEntries(new URLSearchParams(location.search)),
    scene = params.scene ?? "titre";
  contexte.allerA(chargeursScenes[scene] ? scene : "titre", params);
}

demarrer().catch((e) => {
  console.error(e);
  (window as any).__erreur = String(e);
});