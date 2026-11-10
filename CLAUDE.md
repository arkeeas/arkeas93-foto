# arkeas93-foto – pokyny pro AI (čti celé, je krátké)

**Co to je:** fotorealistický 3D náhled konfigurátoru metalické dílny (René). Samostatné statické GitHub Pages: https://arkeeas.github.io/arkeas93-foto/ (repo `arkeeas/arkeas93-foto`, veřejné, větev `main`, bez buildu). Česky, míry v mm.

## Architektura (3 vrstvy)
1. **Jádro = kopie z produkce, NEEDITOVAT:** `core.js`, `vyvoj.js`, `stolecky-core.js`, `zabradli-core.js`, `ral.js`, `lokal.js`, `motyli-podnoz*.js`, `assets/zabradli/*`, `assets/stolecky/*`. Počítá rozměry, díly, zámky, meze, cenu, kg. Změna čísel patří do produkce, ne sem.
2. **`foto/render/`** (společné, ~1000 řádků): `studio.js` (renderer, HDRI, stíny, AO, kamera, doostření, export fotky), `materialy.js` (PBR: lak/RAL, zinek, ocel, dřevo, epoxid, sklo, svar), `geometrie.js` (jekl se zaoblením, plech se sraženou hranou, svar, tělesa z jádra), `stranka.js` + `ui.js` (kostra stránky, panel, kóty, sdílení `#cfg=`, GLB/AR).
3. **Stránky** `foto/{stolecky,zabradli,umelecke}-foto.{html,js}`: z výstupu jádra postaví scénu. `foto/index.html` = rozcestník, `/index.html` = přesměrování na `foto/`.

Tok: panel voleb → config → jádro spočítá díly+cenu → `*-foto.js` vyrobí geometrii → `studio.js` vykreslí. Config se ukládá do `localStorage` (`stolecky-retez`, `zabradli-cfg`, `podnoz-cfg-wip`).

## Pravidla
- Měň jen vzhled, kameru, prostředí, UI. Čísla (cena, kg, kusovník) musí zůstat shodná s jádrem; hlídá to test.
- three.js 0.187 přes importmap (jsDelivr, pevná verze). Žádný bundler. HDRI a textury jsou CC0 (`foto/assets/LICENCE.md`).
- **Bez dotazu nepushovat** (push do `main` = hned živá stránka).
- Vestavěný prohlížeč Claude **nemá WebGL**. Snímky/testy jen headless Chromium (viz níže).

## Příkazy
- Server: `python3 -m http.server 8791` z kořene, `http://localhost:8791/foto/` (`?ladeni=1` FPS, `?cisto=1` bez UI).
- Test (po každé změně renderu/geometrie): 
  `PLAYWRIGHT=$(ls -d ~/.npm/_npx/*/node_modules/playwright-core|head -1)/index.mjs CHROME=~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome node foto/testy/kontrola-foto.mjs [--snimky]` → snímky do `foto/testy/vystup/` (v .gitignore). Chromium zapnout s `--use-angle=vulkan --enable-gpu` při vlastních skriptech.
- Obnova jader z produkce: `./sync.sh` (zkopíruje, ukáže `git diff --stat`; pak spustit test).

## Stav (aktualizuj při změně, jinak nic nepřidávej)
- Hotovo: tři stránky, HDRI/PBR/AO/doostření, zaoblené jekly, svary, motivy skrz, zoom na kurzor, sdílení odkazem, kóty, GLB/AR základ, test cen. Výkon měřen jen na stolním PC.
- Nehotovo: poptávka do firmy (jen `localStorage`), PDF nabídka, galerie, AR neověřeno na telefonu, ladění perspektivy vlastní fotky, zámky/drážky se nekreslí, motýlí podnož má ostré hrany, test na notebooku/telefonu. Detail: `foto/README.md`.
- Zábradlí foto má od 2026-11-10 všechna nastavení starého konfigurátoru: úseky/zatočení/schodiště, „Podle stavby“, typy kotvení + do čeho + konce ke zdi + plotny + rozmístění kotev tažením, motiv Příroda po polích (každé pole jiný styl, varianty motýla, posun výřezu), profil/špruše/přesah, služby, kontrola. Kód: `foto/zabradli-dyn.js` (+ panel v `zabradli-foto.js`). Pushnuto 2026-11-10.
- Jádra odpovídají produkci `main` po PR #60 (verze `20261110a`, nově i `ral.js`). Panely mají nové volby: zábradlí užití + hloubka pádu + umístění + RAL do konfigurace (`cfgVer` 2), umělecké „Pod nohy“, stolečky a umělecké RAL jako `fin: 'ral'`. Hotovo 2026-11-10.
- Poslední větší změna: 2026-11-10 vydáno jako samostatný repo (původně složka `foto/` v produkci, větev `foto-vizual`).

## Paměť (Obsidian)
Přehled projektu: `~/Documents/Obsidian Vault/Paměť/Projekty/Foto náhled.md`. Na konci práce 1 řádek do `Paměť/Deník změn.md` a commit vaultu (viz `~/.claude/CLAUDE.md`).
