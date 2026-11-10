#!/usr/bin/env bash
# Obnoví kopie jader a dat z produkčního konfigurátoru. Spusť z kořene tohoto repa.
# Použití: ./sync.sh [cesta_k_produkci]   (výchozí ../arkeas93)
set -euo pipefail
P="${1:-../arkeas93}"
[ -d "$P" ] || { echo "Produkce nenalezena: $P"; exit 1; }
for f in lokal.js core.js vyvoj.js motyli-podnoz.js motyli-podnoz-kridla.js motyli-podnoz-mesh.js stolecky-core.js zabradli-core.js; do cp "$P/$f" .; done
cp "$P"/assets/zabradli/motiv-*.js assets/zabradli/
cp -r "$P/assets/zabradli/schody" "$P/assets/zabradli/priroda" assets/zabradli/
cp "$P/assets/zabradli/motiv-strom/zabradli_motiv_950x950x5_nahled.png" assets/zabradli/motiv-strom/
cp "$P/assets/zabradli/motiv-bunky/zabradli_motiv_bunky_950x950x5_nahled.png" assets/zabradli/motiv-bunky/
cp -r "$P/assets/stolecky/motyli_stolek" assets/stolecky/
git status --short; git diff --stat | tail -5
echo "Dál: spusť foto/testy/kontrola-foto.mjs (viz CLAUDE.md), pak commit. Verze ?v= v foto/*.html případně zvyš podle produkce."
