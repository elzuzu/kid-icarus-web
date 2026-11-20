// Config de lane QA : le recipe du CONTRAT (rm -rf outDir/assets + symlink vers
// public/assets) supprimerait les chunks JS si assetsDir restait "assets".
// On isole donc le code dans "statique/" et on ne copie pas public/ (231 Mo) :
// assets/, data/, levels/ sont symlinkés par tools/lane.sh.
import { defineConfig } from "vite";

export default defineConfig({
  base: "/kid-icarus-web/",
  publicDir: false,
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    assetsDir: "statique",
  },
});