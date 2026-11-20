const dejaVus: Record<string, boolean> = {};

function urlAsset(chemin: string): string {
  return import.meta.env.BASE_URL + chemin;
}

function toutRegler(promesses: Promise<any>[]): Promise<any[]> {
  return Promise.all(
    promesses.map((p) =>
      Promise.resolve(p).then(
        (valeur) => ({ status: `fulfilled`, value: valeur }),
        (raison) => ({ status: `rejected`, reason: raison }),
      ),
    ),
  );
}

function resoudreUrl(url: string): string {
  return (import.meta as any).resolve
    ? (import.meta as any).resolve(url)
    : new URL(url, import.meta.url).href;
}

// Helper de preload Vite régénéré au build : en source, les deps sont vides
// (les imports dynamiques sont préchargés par Vite lui-même).
export function prechargerModule<T>(
  importer: () => Promise<T>,
  deps?: string[],
): Promise<T> {
  let attente: Promise<any> = Promise.resolve();
  if (deps && deps.length > 0) {
    const liens = document.getElementsByTagName(`link`);
    const metaNonce = document.querySelector(
      `meta[property=csp-nonce]`,
    ) as HTMLMetaElement | null;
    const nonce = metaNonce?.nonce || metaNonce?.getAttribute(`nonce`);
    attente = toutRegler(
      deps
        .map((dep) => {
          dep = urlAsset(dep);
          dep = resoudreUrl(dep);
          if (dep in dejaVus) return;
          dejaVus[dep] = true;
          const estCss = dep.endsWith(`.css`);
          for (let i = liens.length - 1; i >= 0; i--) {
            const lien = liens[i];
            if (lien.href === dep && (!estCss || lien.rel === `stylesheet`))
              return;
          }
          const lien = document.createElement(`link`);
          lien.rel = estCss ? `stylesheet` : `modulepreload`;
          if (!estCss) lien.as = `script`;
          lien.crossOrigin = ``;
          lien.href = dep;
          if (nonce) lien.setAttribute(`nonce`, nonce);
          document.head.appendChild(lien);
          if (estCss)
            return new Promise((resolve, reject) => {
              lien.addEventListener(`load`, resolve);
              lien.addEventListener(`error`, () =>
                reject(Error(`Unable to preload CSS for ${dep}`)),
              );
            });
        })
        .filter((p) => p !== undefined),
    );
  }
  function signalerErreur(erreur: any) {
    const evenement = new Event(`vite:preloadError`, {
      cancelable: true,
    }) as any;
    evenement.payload = erreur;
    window.dispatchEvent(evenement);
    if (!evenement.defaultPrevented) throw erreur;
  }
  return attente.then((resultats) => {
    for (const resultat of resultats || [])
      resultat.status === `rejected` && signalerErreur(resultat.reason);
    return importer().catch(signalerErreur) as Promise<T>;
  });
}