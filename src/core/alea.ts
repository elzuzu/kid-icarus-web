export function hacherGraine(graine: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < graine.length; i++) {
    const k = graine.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Flux {
  a: number;
  b: number;
  c: number;
  d: number;

  constructor(graine: string) {
    [this.a, this.b, this.c, this.d] = hacherGraine(graine);
    for (let i = 0; i < 12; i++) this.randi();
  }

  randi(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  randf(): number {
    return this.randi() / 4294967296;
  }

  randiRange(min: number, max: number): number {
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(this.randf() * (max - min + 1));
  }

  randfRange(min: number, max: number): number {
    return min + this.randf() * (max - min);
  }

  randfn(moyenne = 0, ecartType = 1): number {
    const u = Math.max(this.randf(), 1e-12);
    const v = this.randf();
    return moyenne + ecartType * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  choisir<T>(liste: T[]): T {
    if (liste.length === 0) throw Error(`Flux.choisir : liste vide`);
    return liste[Math.floor(this.randf() * liste.length)];
  }

  indicePondere(poids: number[]): number {
    const total = poids.reduce((somme, p) => somme + Math.max(0, p), 0);
    if (total <= 0) return 0;
    let tirage = this.randf() * total;
    for (let i = 0; i < poids.length; i++) {
      tirage -= Math.max(0, poids[i] ?? 0);
      if (tirage < 0) return i;
    }
    return poids.length - 1;
  }

  melanger<T>(liste: T[]): T[] {
    for (let i = liste.length - 1; i > 0; i--) {
      const j = Math.floor(this.randf() * (i + 1));
      [liste[i], liste[j]] = [liste[j], liste[i]];
    }
    return liste;
  }
}