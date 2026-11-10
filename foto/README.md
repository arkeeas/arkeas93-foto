# Foto náhled (fotorealistický vizuál)

Tři nové stránky nad stávajícím konfigurátorem. Produkční stránky v kořeni repozitáře se **nezměnily**; celé to jde vrátit smazáním složky `foto/`.

| Stránka | Co ukazuje | Jádro (beze změny) |
|---|---|---|
| `stolecky-foto.html` | Motýlek, Řetěz | `../stolecky-core.js` |
| `zabradli-foto.html` | špruše, laserový motiv, Příroda, schodiště, kotvy | `../zabradli-core.js`, `../assets/zabradli/motiv-*.js` |
| `umelecke-foto.html` | Kosočtverec, Pavouk, Pohozenec, Motýlí podnož | `../core.js`, `../vyvoj.js`, `../motyli-podnoz*.js` |
| `index.html` | rozcestník | |

Rozměry, díly, zámky, meze, cena i hmotnost se počítají ve stejných souborech jako dnes. Tady se mění jen obraz, kamera, prostředí a panel voleb. Konfigurace se ukládá pod stejnými klíči jako na produkčních stránkách (`stolecky-retez`, `zabradli-cfg`, `podnoz-cfg-wip`), takže **Nezávazně poptat** otevře podrobný konfigurátor se stejným nastavením a poptávka jde stejnou cestou jako dnes.

## Spuštění
Bez buildu. Stačí statický server z kořene repozitáře (kvůli ES modulům nejde otevřít z disku přes `file://`):
```bash
python3 -m http.server 8000
```
a otevřít `http://localhost:8000/foto/`. Na GitHub Pages bude adresa `…/arkeas93/foto/`.

`?ladeni=1` ukáže FPS, počet trojúhelníků a volání; `?cisto=1` schová ovládání (jen scéna, pro snímky).

## Soubory
| Soubor | Co dělá |
|---|---|
| `render/studio.js` | renderer, světlo z HDRI, stíny, kontaktní stín, AO, kamera, doostření, export fotky |
| `render/materialy.js` | PBR materiály: práškový lak (RAL), zinek, surová ocel, dřevo, epoxid, sklo, svar, hrana řezu |
| `render/geometrie.js` | jekl se zaoblenými hranami, plech se sraženou hranou, housenka svaru, tělesa z jádra |
| `render/stranka.js`, `render/ui.js` | společná kostra stránky, panel voleb, kóty, odkaz na konfiguraci, AR |
| `*-foto.js` | stránka: z výstupu jádra postaví scénu |
| `assets/` | HDRI a textury (CC0), viz `assets/LICENCE.md` |
| `testy/kontrola-foto.mjs` | kontrola: stránky běží, cena a hmotnost sedí s jádrem, snímky pohledů |

## Jak to dělá „fotku“
- **three.js 0.187** jako ES moduly přes `importmap` (jsDelivr, pevná verze).
- **Světlo:** HDRI (PMREM) + jedno směrové světlo se stínem. Slunce se v HDRI ořízne, aby nesvítilo dvakrát. Jas každého HDRI se srovná na stejnou hodnotu. Tónování Khronos Neutral (věrné barvy RAL).
- **Doostření:** při pohybu jeden snímek s MSAA; po zastavení se skládá 40 snímků (mobil 16) s posunem o zlomek pixelu, s rozptylem slunce (měkký polostín) a volitelně s rozptylem objektivu (hloubka ostrosti). Šum AO se mezi snímky mění, takže se vyhladí.
- **Stíny:** stínová mapa 4096 (mobil 2048), při přiblížení se soustředí na to, co je vidět. Pod stolky zapečený kontaktní stín, všude GTAO.
- **Jekly:** z popisu dílu v jádru (osa, průřez, roviny řezů) se vytáhne zaoblený profil, vnější R = 2 × stěna. Pokosy zůstávají přesně. Zámky a drážky schované ve spoji se nekreslí.
- **Plechy s motivem:** obrys a výřezy z `panelHoles()` vytažené na tloušťku, sražená hrana 0,3 mm, hrana řezu má vlastní materiál. Skrz otvory je vidět pozadí.
- **Svary:** housenka kolem konce dílu tam, kde dosedá na jiný díl. Přepínač „Viditelné svary“.
- **Kamera:** zoom na kurzor až na 50 mm, pohledy s plynulým přeletem, dvojklik = přiblížit na místo, dvojité klepnutí = celek, šipky / + − / Home.

## Co je navíc
Sdílení konfigurace odkazem (`#cfg=…`), kóty jako vrstva, fotka PNG 2×, „V místnosti“ (GLB + `<model-viewer>`, stolečky a umělecké), vlastní fotka jako pozadí u zábradlí, technický pohled u zábradlí, obnova po ztrátě WebGL kontextu, motivy se stahují až při použití, vzorník RAL s náhledem materiálu na kouli.

## Co hotové není
- **Poptávky do firmy:** foto stránky poptávku neposílají, předají ji podrobnému konfigurátoru. Ten ji na GitHub Pages ukládá jen do prohlížeče (`lokal.js`).
- **Odstín RAL mimo ceník** se do poptávky nepřenáší (zákazník ho píše do poznámky).
- **PDF nabídka, galerie realizací, stránka „jak to vzniká“** nejsou.
- **AR** je jen základ: na Androidu WebXR, na iOS Quick Look; neověřeno na telefonu.
- **Vlastní fotka na pozadí** nemá ladění perspektivy, model se k fotce natáčí ručně.
- **Zámky a drážky** v jeklech se ve foto režimu nekreslí (jsou schované ve spoji); na kontrolu výroby je dál stránka Testing.
- **Motýlí podnož, pásoviny a plotny uměleckých modelů** mají ostré hrany (kreslí se přímo z těles jádra).
- **Výkon** je změřený jen na stolním PC (viz níže), na notebooku s integrovanou grafikou a na telefonu ne.

## Výkon (2026-11-10, RTX 5060 Ti, Chromium, 1440 × 900, bez omezení snímkové frekvence)
| Stránka | Otáčení | Náběh z localhostu |
|---|---|---|
| stolečky (Motýlek) | ~510 FPS | 0,6 s |
| zábradlí (3 pole Příroda) | ~350 FPS | 0,75 s |
| umělecké (Pavouk) | ~380 FPS | 0,6 s |

Když snímek trvá déle než 26 ms, vypne se AO za pohybu a pak se snižuje rozlišení (až na ×0,75).

## Kontrola
```bash
npm i -D playwright && npx playwright install chromium     # jednou
node foto/testy/kontrola-foto.mjs --snimky
```
Projde všechny tři stránky v několika konfiguracích, porovná cenu a hmotnost na stránce s jádrem v Node a uloží snímky do `foto/testy/vystup/`. Původní `node tests/kontrola-*.js` se foto stránek netýkají (jádra se neměnila).

## Vzor: configux epoxy-table demo
Běží na Google `<model-viewer>` (three.js uvnitř) s hotovým GLB modelem a fotografickými texturami: tónování AgX, prostředí „neutral“, FOV 34°, měkký stín (intenzita 0,8), AR. Volby jsou velké karty s obrázkem. Převzato: velký viewport s panelem vpravo (na mobilu dole), čipy s náhledem materiálu, úzké FOV, měkký stín, AR. Jinak než oni: model se nestaví předem v Blenderu, ale počítá se z výrobních dat při každé změně.
