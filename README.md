# arkeas93-foto

Fotorealistický 3D náhled konfigurátoru (stolečky, zábradlí, umělecké podnože). Samostatná stránka, oddělená od produkčního konfigurátoru [arkeeas/arkeas93](https://github.com/arkeeas/arkeas93).

- Vstup: `foto/` (rozcestník), `foto/stolecky-foto.html`, `foto/zabradli-foto.html`, `foto/umelecke-foto.html`
- Popis, výkon a licence assetů: [foto/README.md](foto/README.md), [foto/assets/LICENCE.md](foto/assets/LICENCE.md)
- Jádra výpočtů (`core.js`, `vyvoj.js`, `stolecky-core.js`, `zabradli-core.js`, …) a datové soubory jsou **kopie ze stavu produkce k 2026-11-10**. Změny v produkci se sem musí přenést ručně.
- Tlačítka „Podrobný konfigurátor“ a „Nezávazně poptat“ vedou na produkční web (stejný původ `arkeeas.github.io`, takže se nastavení přenese přes `localStorage`).
- Bez buildu, statické soubory. Lokálně: `python3 -m http.server 8000` a `http://localhost:8000/foto/`.
