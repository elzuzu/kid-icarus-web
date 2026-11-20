export function arrondi(v: number) {
  return (v < 0 ? -Math.round(-v) : Math.round(v)) + 0;
}

export function borner(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function nombreDe(obj: any, cle: string, defaut = 0) {
  let v = obj[cle];
  return v === undefined
    ? defaut
    : typeof v == "number"
      ? v
      : typeof v == "boolean"
        ? +!!v
        : 0;
}