// Serveur statique de lane QA avec comptage d'octets PAR REQUÊTE (y compris
// fetch des workers pixi, invisibles dans performance.getEntriesByType).
// Usage : node tools/serve.mjs [port] [racine]
// Endpoints QA : /__qa/reset (vide le journal), /__qa/stats (journal JSON).
import { createServer } from "node:http";
import { statSync, createReadStream, readFileSync, existsSync } from "node:fs";
import { join, normalize, extname } from "node:path";

const PORT = Number(process.argv[2] ?? 8656);
const RACINE = process.argv[3] ?? "/tmp/kiw-serve-qa";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
};
let journal = [];
const debut = Date.now();

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (url === "/__qa/reset") {
    journal = [];
    res.writeHead(200, { "content-type": "application/json" });
    res.end("{}");
    return;
  }
  if (url === "/__qa/stats") {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ depuis_ms: Date.now() - debut, requetes: journal }));
    return;
  }
  let fichier = normalize(join(RACINE, url));
  if (existsSync(fichier) && statSync(fichier).isDirectory()) fichier = join(fichier, "index.html");
  if (!fichier.startsWith(RACINE) || !existsSync(fichier) || !statSync(fichier).isFile()) {
    journal.push({ url, octets: 0, status: 404, ms: Date.now() - debut });
    // Corps HTML comme un vrai serveur statique : un body "404" (text/plain)
    // est du JSON valide et pixi loadJson (sans check response.ok) le
    // parserait en nombre → fausse planche "valide" → crash VisuelEnnemi.
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("<!doctype html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>");
    return;
  }
  const taille = statSync(fichier).size;
  const t0 = Date.now();
  res.writeHead(200, {
    "content-type": MIME[extname(fichier)] ?? "application/octet-stream",
    "content-length": taille,
    "cache-control": "no-store",
  });
  const flux = createReadStream(fichier);
  flux.pipe(res);
  flux.on("end", () => journal.push({ url, octets: taille, status: 200, ms: Date.now() - debut }));
  flux.on("error", () => {
    journal.push({ url, octets: 0, status: 500, ms: Date.now() - debut });
    res.end();
  });
}).listen(PORT, "127.0.0.1", () => console.log(`serveur QA : http://127.0.0.1:${PORT}/ (racine ${RACINE})`));