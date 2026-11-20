import { n as largeur, t as hauteur } from "../core";
import { Assets, Container, Graphics, Sprite, type Ticker } from "pixi.js";
import {
  n as textureTache,
  o as Text,
  r as textureVignette,
} from "../render/textures";
import {
  i as coutIntensite,
  n as multiplicateurDegats,
  o as multiplicateurPV,
  r as gainIntensite,
  t as probabiliteElites,
} from "../app";
import {
  a as dessinerPanneau,
  c as CoucheParticules,
  i as formatNombre,
  n as couleurOr,
  o as styleTexte,
  r as couleurBronze,
  s as styleTitre,
} from "../render/theme";

const base = import.meta.env.BASE_URL;

interface ContexteScene {
  app: any;
  partie: any;
  audio: any;
  racine: Container;
  contenu: any;
  entrees: any;
  allerA: (scene: string, params?: any) => void;
}

const positionsNoeuds: [number, number][] = [
  [285, 855],
  [440, 800],
  [575, 762],
  [660, 712],
  [800, 598],
  [770, 245],
  [862, 196],
  [905, 118],
  [1150, 458],
  [1300, 335],
  [1450, 265],
  [1570, 212],
  [1660, 178],
  [1740, 122],
];

const etapesChemins: ([number, number][] | null)[] = [
  [[360, 832]],
  [[505, 780]],
  [[630, 740]],
  [
    [710, 690],
    [762, 655],
    [752, 622],
  ],
  [
    [870, 585],
    [935, 565],
    [985, 525],
    [1000, 490],
    [960, 440],
    [880, 410],
    [800, 370],
    [745, 315],
    [725, 285],
  ],
  [[820, 225]],
  [[890, 170]],
  null,
  [
    [1240, 420],
    [1262, 365],
  ],
  [[1380, 300]],
  [[1505, 235]],
  [[1620, 196]],
  [[1710, 150]],
];

const couleursMondes = [16738874, 8048752, 9095423, 16767088];

const lancer = async (ctx: ContexteScene) => {
  const { app, partie, audio } = ctx;
  const racine = ctx.racine;
  audio.musique(`carte`, { fondu: 1 });
  if (partie.introAJouer) {
    audio.declencherDialogue(`intro`);
    partie.introAJouer = false;
  }
  const texFond = await Assets.load(`${base}assets/art/ui/carte_monde.webp`).catch(
    () => Assets.load(`${base}assets/art/decors/profondeurs/fond_lointain.webp`),
  );
  const fond = new Sprite(texFond);
  fond.scale.set(Math.max(largeur / texFond.width, hauteur / texFond.height));
  racine.addChild(fond);
  const lumieres = new CoucheParticules(
    textureTache(32),
    `lumieres`,
    largeur,
    hauteur,
    50,
  );
  const vignette = new Sprite(textureVignette(0.55));
  vignette.width = largeur;
  vignette.height = hauteur;
  racine.addChild(lumieres, vignette);
  const ordreStages: string[] = partie.ordreStages();
  const mondes: any[] = ctx.contenu.liste(`mondes`);
  const indexMonde = (id: string) =>
    Math.max(
      0,
      mondes.findIndex((m) => m.stages.some((s: any) => s.id === id)),
    );
  const chemins = new Graphics();
  racine.addChild(chemins);
  for (let i = 1; i < ordreStages.length; i++) {
    const etapes = etapesChemins[i - 1];
    if (etapes === null) continue;
    const points = [
      positionsNoeuds[i - 1] ?? [0, 0],
      ...(etapes ?? []),
      positionsNoeuds[i] ?? [0, 0],
    ];
    const debloque = partie.stageDebloque(ordreStages[i] ?? ``);
    for (let j = 1; j < points.length; j++) {
      const [x0, y0] = points[j - 1];
      const [x1, y1] = points[j];
      if (debloque)
        chemins
          .moveTo(x0, y0)
          .lineTo(x1, y1)
          .stroke({ color: 16770720, width: 5, alpha: 0.85, cap: `round` });
      else {
        const troncons = Math.max(
          2,
          Math.round(Math.hypot(x1 - x0, y1 - y0) / 14),
        );
        for (let n = 0; n < troncons; n += 2)
          chemins
            .moveTo(x0 + ((x1 - x0) * n) / troncons, y0 + ((y1 - y0) * n) / troncons)
            .lineTo(
              x0 + ((x1 - x0) * (n + 1)) / troncons,
              y0 + ((y1 - y0) * (n + 1)) / troncons,
            )
            .stroke({ color: 13154464, width: 3, alpha: 0.45 });
      }
    }
  }
  const noeuds = ordreStages.map((id, index) => {
    const noeud = new Container();
    const disque = new Graphics();
    const debloque = partie.stageDebloque(id);
    const entree = partie.profil.stages[id];
    const couleur = couleursMondes[indexMonde(id)] ?? 15255672;
    disque
      .circle(0, 0, 30)
      .fill({ color: 723216, alpha: 0.9 })
      .stroke({ color: debloque ? couleurOr : 6971496, width: 3 });
    disque
      .circle(0, 0, 22)
      .fill({ color: debloque ? couleur : 3814464, alpha: debloque ? 0.85 : 0.6 });
    if (entree?.termine)
      disque.circle(0, 0, 22).stroke({ color: 16777215, width: 2, alpha: 0.9 });
    const libelle = new Text({
      text: id.split(`/`).pop() ?? ``,
      style: styleTexte(18, debloque ? 1707782 : 10129560),
    });
    libelle.style.stroke = { color: 16777215, width: 0 };
    libelle.anchor.set(0.5);
    noeud.addChild(disque, libelle);
    if (entree?.rang) {
      const rang = new Text({ text: entree.rang, style: styleTitre(24, 16770984) });
      rang.anchor.set(0.5);
      rang.position.set(26, -26);
      noeud.addChild(rang);
    }
    const [x, y] = positionsNoeuds[index] ?? [0, 0];
    noeud.position.set(x, y);
    noeud.eventMode = `static`;
    noeud.cursor = debloque ? `pointer` : `not-allowed`;
    noeud.on(`pointertap`, () => {
      if (debloque) {
        selectionner(index);
        ouvrirChaudron();
      }
    });
    noeud.on(`pointerover`, () => {
      if (debloque) selectionner(index);
    });
    racine.addChild(noeud);
    return noeud;
  });
  const halo = new Sprite(textureTache(128));
  halo.anchor.set(0.5);
  halo.blendMode = `add`;
  halo.tint = 16769184;
  halo.scale.set(1.8);
  racine.addChildAt(halo, racine.getChildIndex(chemins) + 1);
  const panneauInfos = new Container();
  const fondPanneau = dessinerPanneau(new Graphics(), 0, 0, 620, 150);
  const texteNom = new Text({ text: ``, style: styleTitre(36) });
  const texteDetails = new Text({ text: ``, style: styleTexte(22, 15260872) });
  texteNom.position.set(30, 22);
  texteDetails.position.set(30, 84);
  panneauInfos.addChild(fondPanneau, texteNom, texteDetails);
  panneauInfos.position.set(40, 40);
  const texteCoeurs = new Text({ text: ``, style: styleTitre(32, 16761032) });
  texteCoeurs.anchor.set(1, 0);
  texteCoeurs.position.set(largeur - 50, 44);
  const texteNiveau = new Text({ text: ``, style: styleTexte(22, 15260872) });
  texteNiveau.anchor.set(1, 0);
  texteNiveau.position.set(largeur - 50, 92);
  racine.addChild(panneauInfos, texteCoeurs, texteNiveau);
  let selection = Math.max(
    0,
    ordreStages
      .map((id) => partie.stageDebloque(id) && !partie.stageTermine(id))
      .lastIndexOf(true),
  );
  if (!partie.stageDebloque(ordreStages[selection] ?? ``)) selection = 0;
  function selectionner(index: number) {
    selection = index;
    const id = ordreStages[index] ?? ``;
    const infos = partie.infosStage(id);
    const entree = partie.profil.stages[id];
    const monde = mondes[indexMonde(id)];
    texteNom.text = `${id.split(`/`).pop()}  ${infos?.nom ?? ``}`;
    const meilleurTemps =
      entree?.meilleur_temps && Number.isFinite(entree.meilleur_temps)
        ? `${Math.floor(entree.meilleur_temps / 60)}:${String(Math.floor(entree.meilleur_temps % 60)).padStart(2, `0`)}`
        : `—`;
    texteDetails.text = `${monde?.nom ?? ``}   ·   rang ${entree?.rang ?? `—`}   ·   meilleur temps ${meilleurTemps}`;
    const [x, y] = positionsNoeuds[index] ?? [0, 0];
    halo.position.set(x, y);
  }
  selectionner(selection);
  texteCoeurs.text = `♥ ${partie.coeurs}`;
  texteNiveau.text = `Niveau ${partie.profil.niveau}`;
  const chaudron = new Container();
  chaudron.visible = false;
  const voile = new Graphics().rect(0, 0, largeur, hauteur).fill({ color: 0, alpha: 0.55 });
  const cadre = dessinerPanneau(new Graphics(), largeur / 2 - 460, 190, 920, 700, 0.92);
  chaudron.addChild(voile, cadre);
  const texChaudron = await Assets.load(`${base}assets/art/ui/chaudron.webp`).catch(
    () => null,
  );
  if (texChaudron) {
    const image = new Sprite(texChaudron);
    image.anchor.set(0.5);
    image.height = 300;
    image.scale.x = image.scale.y;
    image.position.set(largeur / 2, 420);
    chaudron.addChild(image);
  }
  const titreChaudron = new Text({
    text: `CHAUDRON DE L’INTENSITÉ`,
    style: styleTitre(38),
  });
  titreChaudron.anchor.set(0.5);
  titreChaudron.position.set(largeur / 2, 240);
  const texteIntensite = new Text({ text: ``, style: styleTitre(84, 16765562) });
  texteIntensite.anchor.set(0.5);
  texteIntensite.position.set(largeur / 2, 620);
  const jauge = new Graphics();
  const texteMise = new Text({ text: ``, style: styleTexte(24, 15260872) });
  texteMise.anchor.set(0.5, 0);
  texteMise.position.set(largeur / 2, 700);
  const texteAide = new Text({
    text: `← →  régler   ·   Espace / A  partir   ·   Échap / B  retour`,
    style: styleTexte(20, 13155496),
  });
  texteAide.anchor.set(0.5);
  texteAide.position.set(largeur / 2, 850);
  chaudron.addChild(titreChaudron, jauge, texteIntensite, texteMise, texteAide);
  racine.addChild(chaudron);
  let intensite = Math.min(9, partie.profil.intensite || 0);
  function rafraichirChaudron() {
    const mise = coutIntensite(intensite);
    const payable = mise <= partie.coeurs;
    texteIntensite.text = formatNombre(intensite, 1);
    texteIntensite.style.fill = payable ? 16765562 : 16738906;
    texteMise.text = `Mise : ♥ ${mise}   ·   Gain en cas de réussite : ♥ ${gainIntensite(intensite)}\nEnnemis : PV ×${formatNombre(multiplicateurPV(intensite), 2)}, dégâts ×${formatNombre(multiplicateurDegats(intensite), 2)}   ·   Élites : ${Math.round(probabiliteElites(intensite) * 100)} %`;
    const x = largeur / 2 - 300;
    jauge
      .clear()
      .roundRect(x, 668, 600, 12, 6)
      .fill({ color: 1708568 })
      .stroke({ color: couleurBronze, width: 1.5 });
    const fraction = intensite / 9;
    jauge
      .roundRect(x, 668, 600 * fraction, 12, 6)
      .fill(fraction < 0.34 ? 8048752 : fraction < 0.67 ? 16756800 : 16730682);
  }
  function ouvrirChaudron() {
    chaudron.visible = true;
    audio.sfx(`menu_ouvrir`);
    rafraichirChaudron();
  }
  function partir() {
    if (coutIntensite(intensite) > partie.coeurs) {
      audio.sfx(`refus`);
      return;
    }
    audio.sfx(`menu_valider`);
    partie.lancerStage(ordreStages[selection] ?? ``, intensite);
    ctx.allerA(`stage`);
  }
  let attente = 0;
  let sensTenu = 0;
  let temps = 0;
  const pas = (tick: Ticker) => {
    const dt = Math.min(0.1, tick.deltaMS / 1000);
    temps += dt;
    lumieres.mettreAJour(dt);
    halo.alpha = 0.6 + 0.3 * Math.sin(temps * 3);
    noeuds.forEach((noeud, i) =>
      noeud.scale.set(i === selection ? 1.12 + 0.04 * Math.sin(temps * 4) : 1),
    );
    const entrees = ctx.entrees.lire();
    const sens =
      entrees.deplacementX > 0.5 || entrees.deplacementY < -0.5
        ? 1
        : entrees.deplacementX < -0.5 || entrees.deplacementY > 0.5
          ? -1
          : 0;
    if (sens !== sensTenu) {
      sensTenu = sens;
      attente = 0;
    }
    attente -= dt;
    if (sens && attente <= 0) {
      attente = sensTenu === sens && attente < 0 ? 0.14 : 0.35;
      if (chaudron.visible) {
        intensite = Math.max(0, Math.min(9, intensite + sens * 0.5));
        audio.sfx(`menu_deplacer`);
        rafraichirChaudron();
      } else {
        const cible = selection + sens;
        if (
          cible >= 0 &&
          cible < ordreStages.length &&
          partie.stageDebloque(ordreStages[cible] ?? ``)
        ) {
          selectionner(cible);
          audio.sfx(`menu_deplacer`);
        }
      }
    }
    if (entrees.sautPresse || entrees.interagirPresse) {
      if (chaudron.visible) partir();
      else ouvrirChaudron();
    } else if (entrees.dashPresse || entrees.pausePresse) {
      if (chaudron.visible) chaudron.visible = false;
      else ctx.allerA(`titre`);
    }
  };
  app.ticker.add(pas);
  return () => {
    app.ticker.remove(pas);
  };
};

export { lancer };