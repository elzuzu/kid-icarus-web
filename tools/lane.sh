#!/bin/zsh
# Lane QA (port 8656) — build isolé + symlinks + serveur.
# Usage : zsh tools/lane.sh [--serve]   (--serve lance http.server en avant-plan)
set -e
REPO=/Users/alex/Developer/kid-icarus-src
OUT=/tmp/kiw-lane-qa
SERVE=/tmp/kiw-serve-qa
cd "$REPO"
npx vite build --config tools/vite.lane.config.ts --outDir "$OUT" --emptyOutDir
for d in assets data levels; do
  rm -rf "$OUT/$d"
  ln -s "$REPO/public/$d" "$OUT/$d"
done
node "$REPO/tools/gen-manifeste.mjs" "$OUT/manifeste.json"
mkdir -p "$SERVE"
ln -sfn "$OUT" "$SERVE/kid-icarus-web"
if [[ "$1" == "--serve" ]]; then
  exec python3 -m http.server 8656 --directory "$SERVE"
fi
echo "lane prête : http://127.0.0.1:8656/kid-icarus-web/"