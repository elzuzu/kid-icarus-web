import { Flux } from "./alea";

export class Graines {
  graine = `partie`;

  flux(nom: string, extra: any[] = []): Flux {
    return new Flux([this.graine, nom, ...extra].join(`|`));
  }

  static graineDuJour(date: Date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }
}

new Graines();