/* Kontrola foto stránek: načtou se bez chyb, cena a hmotnost sedí s jádrem konfigurátoru a uloží se snímky hlavních pohledů.
 *
 *   npm i -D playwright && npx playwright install chromium      (jednou)
 *   node foto/testy/kontrola-foto.mjs [--snimky]                 (z kořene repozitáře)
 *
 * Snímky jdou do foto/testy/vystup/ (není v gitu) – porovnávají se okem nebo proti minulému běhu. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const koren = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = await import(process.env.PLAYWRIGHT || 'playwright')); } catch (e) { console.log('Chybí Playwright: npm i -D playwright && npx playwright install chromium'); process.exit(2); }
const snimky = process.argv.includes('--snimky'), ven = path.join(koren, 'foto/testy/vystup'); if (snimky) fs.mkdirSync(ven, { recursive: true });

/* jádra konfigurátoru v Node – stejné soubory, které načítá web */
globalThis.window = globalThis;
const S = require(path.join(koren, 'stolecky-core.js'));
require(path.join(koren, 'core.js')); require(path.join(koren, 'vyvoj.js'));
['strom', 'bunky', 'jelen', 'medved', 'smrky', 'los', 'motyl', 'motyl-a', 'motyl-b', 'kachny'].forEach((m) => require(path.join(koren, 'assets/zabradli/motiv-' + m + '.js')));
require(path.join(koren, 'zabradli-core.js'));
const Zb = globalThis.Zabradli, K = globalThis.Vyvoj;

const typy = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => {
  const f = path.join(koren, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(koren) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typy[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const zaklad = 'http://127.0.0.1:' + server.address().port + '/foto/';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
let chyb = 0; const chyba = (kde, t) => { chyb++; console.log('CHYBA ' + kde + ': ' + t); };
const cislo = (t) => Number(String(t).replace(/[^\d,]/g, '').replace(',', '.'));

const STRANKY = [
  { soubor: 'stolecky-foto.html', kroky: [{}, { zmen: { model: 'retez', fin: 'anth' } }, { zmen: { model: 'motylek', motylekTop: 'vlastni', topD: 700 } }],
    cena: (c) => S.price(S.build(c), S.DEFAULT_RATES).vat, kg: (c) => S.build(c).kg },
  { soubor: 'zabradli-foto.html', kroky: [{}, { zmen: { vypln: 'standard', sloupky: false, anchor: 'bocni', fin: 'zn', segs: [{ L: 2380, rise: 2000 }, { L: 4500, rise: 0, turn: 90 }, { L: 3000, rise: 0 }] } }],
    cena: (c) => Zb.analyze(c).total, kg: (c) => Zb.analyze(c).kg },
  { soubor: 'umelecke-foto.html', kroky: [{}, { zmen: { model: 'KS' } }, { zmen: { model: 'PZ', L: 1800 } }],
    cena: (c) => K.analyze(c, K.DEFAULT_RATES).vat, kg: (c) => K.analyze(c, K.DEFAULT_RATES).kg }
];
for (const st of STRANKY) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.on('pageerror', (e) => chyba(st.soubor, 'chyba skriptu: ' + String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|CONTEXT_LOST/.test(m.text())) chyba(st.soubor, 'konzole: ' + m.text().slice(0, 200)); });
  await p.goto(zaklad + st.soubor, { waitUntil: 'load' });
  try { await p.waitForFunction(() => window.__foto && window.__foto.hotovo, null, { timeout: 60000 }); } catch (e) { chyba(st.soubor, 'stránka nenaběhla'); continue; }
  let n = 0;
  for (const k of st.kroky) {
    if (k.zmen) await p.evaluate((z) => window.__foto.zmen(z, true, true), k.zmen);
    await p.waitForTimeout(1200);
    try { await p.waitForFunction(() => window.__foto.studio.ostre, null, { timeout: 60000 }); } catch (e) { chyba(st.soubor, 'obraz se nedoostřil'); }
    const { cfg, cena, popis, troj } = await p.evaluate(() => ({ cfg: window.__foto.cfg(), cena: document.getElementById('cena').textContent, popis: document.getElementById('popis').textContent, troj: window.__foto.studio.info().trojuhelniku }));
    const ma = st.cena(cfg), je = cislo(cena);
    if (Math.abs(ma - je) > 0.5) chyba(st.soubor, 'cena na stránce ' + je + ' Kč ≠ jádro ' + ma + ' Kč (' + JSON.stringify(k.zmen || {}) + ')');
    const kg = st.kg(cfg), m = /([\d\s ,]+) kg/.exec(popis);
    if (!m || Math.abs(cislo(m[1]) - kg) > Math.max(0.06, kg * 0.006)) chyba(st.soubor, 'hmotnost na stránce „' + (m && m[1]) + '“ ≠ jádro ' + kg.toFixed(1) + ' kg');
    if (!(troj > 500)) chyba(st.soubor, 'scéna je prázdná (' + troj + ' trojúhelníků)');
    console.log('ok  ' + st.soubor + ' ' + JSON.stringify(k.zmen || 'výchozí').slice(0, 60) + ' → ' + je + ' Kč, ' + kg.toFixed(1) + ' kg, ' + Math.round(troj / 1000) + ' tis. trojúhelníků');
    if (snimky) await p.screenshot({ path: path.join(ven, st.soubor.replace('.html', '') + '-' + (++n) + '.png') });
  }
  await p.close();
}
await b.close(); server.close();
console.log(chyb ? '\n' + chyb + ' chyb' : '\nVše v pořádku: stránky běží a čísla sedí s jádrem.');
process.exit(chyb ? 1 : 0);
