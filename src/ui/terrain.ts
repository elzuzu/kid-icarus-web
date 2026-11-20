import { Container, Graphics, Sprite, TilingSprite } from "pixi.js";
import { Niveau, TypeTuile } from "./niveau";

interface Segment {
  l: number;
  c0: number;
  c1: number;
}

export function segmentsTuiles(
  niveau: Niveau,
  type: TypeTuile,
  ligneDebut: number,
  ligneFin: number,
): Segment[] {
  const segments: Segment[] = [];
  for (
    let l = Math.max(0, ligneDebut);
    l < Math.min(niveau.hauteur, ligneFin);
    l++
  ) {
    let c = 0;
    while (c < niveau.largeur) {
      if (niveau.tuile(c, l) !== type) {
        c++;
        continue;
      }
      const debut = c;
      while (c < niveau.largeur && niveau.tuile(c, l) === type) c++;
      segments.push({ l, c0: debut, c1: c });
    }
  }
  return segments;
}

const estPlein = (tuile: number) =>
  tuile === TypeTuile.SOLIDE || tuile === TypeTuile.FRIABLE;

export function construireSol(
  niveau: Niveau,
  kit: any,
  ligneDebut: number,
  ligneFin: number,
): Container {
  const conteneur = new Container();
  const masque = new Graphics();
  let present = false;
  for (
    let l = Math.max(0, ligneDebut);
    l < Math.min(niveau.hauteur, ligneFin);
    l++
  )
    for (let c = 0; c < niveau.largeur; c++)
      if (estPlein(niveau.tuile(c, l))) {
        masque.rect(c * 64, l * 64, 64, 64);
        present = true;
      }
  if (present) {
    masque.fill(16777215);
    const bornes = masque.getLocalBounds();
    const blocs = new TilingSprite({
      texture: kit.bloc,
      width: bornes.width,
      height: bornes.height,
    });
    blocs.position.set(bornes.x, bornes.y);
    blocs.tileScale.set(kit.blocEchelle);
    blocs.tilePosition.set(-bornes.x, -bornes.y);
    blocs.mask = masque;
    conteneur.addChild(masque, blocs);
    const ombres = new Graphics();
    for (const segment of segmentsTuiles(niveau, TypeTuile.SOLIDE, ligneDebut, ligneFin))
      for (let c = segment.c0; c < segment.c1; c++)
        if (!estPlein(niveau.tuile(c, segment.l + 1)))
          for (let k = 0; k < 4; k++)
            ombres
              .rect(c * 64, (segment.l + 1) * 64 - (k + 1) * 8, 64, 8)
              .fill({ color: kit.ombre, alpha: 0.12 });
    conteneur.addChild(ombres);
  }
  for (
    let l = Math.max(0, ligneDebut);
    l < Math.min(niveau.hauteur, ligneFin);
    l++
  ) {
    let c = 0;
    while (c < niveau.largeur) {
      if (!estPlein(niveau.tuile(c, l)) || estPlein(niveau.tuile(c, l - 1))) {
        c++;
        continue;
      }
      const debut = c;
      while (
        c < niveau.largeur &&
        estPlein(niveau.tuile(c, l)) &&
        !estPlein(niveau.tuile(c, l - 1))
      )
        c++;
      const bord = new TilingSprite({
        texture: kit.bordHaut,
        width: (c - debut) * 64,
        height: kit.bordHautHauteur,
      });
      const echelle = kit.bordHautHauteur / kit.bordHaut.height;
      bord.tileScale.set(echelle);
      bord.tilePosition.x = -debut * 64;
      bord.position.set(
        debut * 64,
        l * 64 - kit.bordHautSurface * kit.bordHautHauteur,
      );
      conteneur.addChild(bord);
    }
  }
  for (const segment of segmentsTuiles(niveau, TypeTuile.PLATEFORME, ligneDebut, ligneFin))
    conteneur.addChild(construirePlateforme(kit, segment));
  for (const segment of segmentsTuiles(niveau, TypeTuile.LAVE, ligneDebut, ligneFin))
    conteneur.addChild(construireLave(segment));
  for (const segment of segmentsTuiles(niveau, TypeTuile.PICS, ligneDebut, ligneFin))
    conteneur.addChild(construirePics(segment));
  return conteneur;
}

function construireLave(segment: Segment): Container {
  const g = new Graphics(),
    x = segment.c0 * 64,
    y = segment.l * 64,
    largeur = (segment.c1 - segment.c0) * 64;
  g.rect(x, y + 10, largeur, 54).fill(0x8c1a05);
  g.rect(x, y + 10, largeur, 16).fill(0xd84b0a);
  g.rect(x, y + 6, largeur, 6).fill(0xffa22e);
  g.rect(x, y + 4, largeur, 3).fill(0xffe07a);
  for (let bx = x + 10; bx < x + largeur - 6; bx += 26)
    g.circle(bx, y + 24 + ((bx / 26) % 3) * 10, 3).fill(0xffc247);
  const conteneur = new Container();
  conteneur.addChild(g);
  return conteneur;
}

function construirePics(segment: Segment): Container {
  const g = new Graphics(),
    base = (segment.l + 1) * 64;
  for (let c = segment.c0; c < segment.c1; c++) {
    const x = c * 64;
    g.rect(x, base - 6, 64, 6).fill(0x4a5158);
    for (let i = 0; i < 3; i++) {
      const px = x + 5 + i * 20;
      g.moveTo(px, base - 5).lineTo(px + 9, base - 42).lineTo(px + 18, base - 5).closePath().fill(0x9aa3ad);
      g.moveTo(px + 9, base - 42).lineTo(px + 13, base - 12).lineTo(px + 18, base - 5).closePath().fill(0x5c646d);
    }
  }
  const conteneur = new Container();
  conteneur.addChild(g);
  return conteneur;
}

function construirePlateforme(kit: any, segment: Segment): Container {
  const hauteur = kit.plateformeHauteur;
  const echelle = hauteur / kit.plateformeMilieu.height;
  const gauche = new Sprite(kit.plateformeGauche);
  const droite = new Sprite(kit.plateformeDroite);
  gauche.scale.set(hauteur / kit.plateformeGauche.height);
  droite.scale.set(hauteur / kit.plateformeDroite.height);
  const largeur = (segment.c1 - segment.c0) * 64;
  const marge = 11.52;
  const totale = largeur + 2 * marge;
  const lg = Math.min(gauche.width, totale * 0.45);
  const ld = Math.min(droite.width, totale * 0.45);
  gauche.width = lg;
  droite.width = ld;
  const milieu = new TilingSprite({
    texture: kit.plateformeMilieu,
    width: Math.max(0, totale - lg - ld + 4),
    height: hauteur,
  });
  milieu.tileScale.set(echelle);
  milieu.tilePosition.x = -segment.c0 * 64 * 0.73;
  const groupe = new Container();
  gauche.position.set(0, 0);
  milieu.position.set(lg - 2, 0);
  droite.position.set(totale - ld, 0);
  groupe.addChild(milieu, gauche, droite);
  groupe.position.set(
    segment.c0 * 64 - marge,
    segment.l * 64 - kit.plateformeSurface * hauteur,
  );
  return groupe;
}