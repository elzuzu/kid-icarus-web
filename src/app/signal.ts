export class Signal {
  ecouteurs: ((...args: any[]) => void)[] = [];

  connecter(ecouteur: (...args: any[]) => void) {
    this.ecouteurs.push(ecouteur);
    return () => {
      let i = this.ecouteurs.indexOf(ecouteur);
      if (i >= 0) this.ecouteurs.splice(i, 1);
    };
  }

  emettre(...args: any[]) {
    for (let ecouteur of [...this.ecouteurs]) ecouteur(...args);
  }
}