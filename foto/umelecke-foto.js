/* Foto náhled uměleckých podnoží (Kosočtverec, Pavouk, Pohozenec, Motýlí podnož).
 * Díly, zámky, pevnost, cenu i hmotnost počítá beze změny `core.js` + `vyvoj.js` (+ `motyli-podnoz.js`).
 * Jekly, které mají v jádru osu, se kreslí se zaoblenými hranami (konce se berou z přesného tělesa dílu);
 * pásoviny, plotny a díly Motýlí podnože se kreslí přímo z těles. Konfigurace je sdílená s vyvoj.html. */
import * as THREE from 'three';
import { zaloz } from './render/stranka.js';
import { hranol, plech, teleso, housenka, slouc, konceZTelesa, ramZTelesa, vTelese, V } from './render/geometrie.js';
import { $, cipy, segment, posuvnik, nf, esc, pamet, zOdkazu, ulozOdkaz, cenik } from './render/ui.js';

const K = window.Vyvoj, KOREN = new URL('../', import.meta.url).href;
const sdil = zOdkazu();
const ulozena = (sdil && sdil.c) || pamet.cti('podnoz-cfg-wip') || {};
const MODELY = [['KS', 'Kosočtverec'], ['PV', 'Pavouk'], ['PZ', 'Pohozenec'], ['MOT', 'Motýlí podnož']];
let cfg = K.normalize(MODELY.some((m) => m[0] === ulozena.model) && ulozena.model !== 'MOT' ? ulozena : Object.assign({}, ulozena, { model: 'PV' }));
const chceMot = ulozena.model === 'MOT';
const ui = Object.assign({ prostredi: 'studio', koty: false, dof: false, svary: true, deska: null, ral: null }, pamet.cti('foto-umelecke-ui') || {}, (sdil && sdil.u) || {});
if (!ui.deska) ui.deska = { ash: 'jasan', oak: 'dub', epoxy: 'epoxid' }[localStorage.getItem('skovo-board-material-v1')] || 'dub';
let rates = K.DEFAULT_RATES, A = null;

const stahuje = {};
const nactiSkript = (soubor) => (stahuje[soubor] = stahuje[soubor] || new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = KOREN + soubor; s.onload = ok; s.onerror = () => { delete stahuje[soubor]; chyba(new Error(soubor)); }; document.head.appendChild(s); }));
/* Motýlí podnož má 1,2 MB dat křídel – stahuje se až při výběru */
const nactiMot = () => nactiSkript('motyli-podnoz-kridla.js?v=20261012a').then(() => nactiSkript('motyli-podnoz.js?v=20261012e'));

const X = zaloz({ ui, ar: true, studio: { celek: [0.62, 0.24, 0.9] }, zmenaUi: uloz, nazev: () => 'Stůl ' + (MODELY.find((m) => m[0] === cfg.model) || ['', ''])[1], nazevFotky: () => 'podnoz-' + cfg.model + '-' + cfg.L + 'x' + cfg.W });
if (X) start();

function uloz() {
  pamet.zapis('podnoz-cfg-wip', cfg); pamet.zapis('foto-umelecke-ui', ui);
  try { localStorage.setItem('skovo-board-material-v1', { jasan: 'ash', dub: 'oak', epoxid: 'epoxy' }[ui.deska] || 'oak'); } catch (e) { /* bez úložiště */ }
  ulozOdkaz({ c: cfg, u: { prostredi: ui.prostredi, deska: ui.deska, ral: ui.ral, svary: ui.svary } });
}

function start() {
  const { studio, mat } = X;
  const M = { ocel: mat.kov(cfg.fin, ui.ral), svar: mat.svar(cfg.fin, ui.ral), dub: mat.drevo('dub'), jasan: mat.drevo('jasan'), orech: mat.drevo('orech'), epoxid: mat.epoxid(), sklo: mat.sklo(), spoj: mat.spojovaci() };
  const skupina = new THREE.Group(); studio.content.add(skupina);
  const uklid = () => { while (skupina.children.length) { const o = skupina.children.pop(); o.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); } };
  const pridej = (g, m, o = {}) => { if (!g) return null; const mesh = new THREE.Mesh(g, m); mesh.castShadow = o.stin !== false; mesh.receiveShadow = true; skupina.add(mesh); return mesh; };

  function postav() {
    A = K.analyze(cfg, rates); uklid();
    const B = A.build, ocel = [], svary = [], klice = new Set(), telesa = B.parts.map((p) => p.solid).concat(B.plateBoxes);
    B.parts.forEach((p) => {
      if (!p.m || !p.m.u) { ocel.push(teleso(p.solid)); return; }
      const st = Number((/×(\d+(?:[.,]\d+)?)\s*$/.exec(p.prof || '') || [0, cfg.t])[1].toString().replace(',', '.')) || cfg.t;
      const ram = ramZTelesa(p.solid, p.m, st), h = hranol(ram, { konce: konceZTelesa(p.solid, ram) });
      ocel.push(h.geometry);
      h.konce.forEach((loop, e) => {
        const c = loop.reduce((s, q) => V.add(s, q), [0, 0, 0]).map((v) => v / loop.length), ven = V.add(c, V.mul(ram.d, e ? 3 : -3));
        if (!telesa.some((t) => t !== p.solid && vTelese(t, ven))) return;
        const key = c.map((v) => Math.round(v / 2)).join(); if (klice.has(key)) return; klice.add(key);
        svary.push(housenka(loop, 1.1, true, 3));
      });
    });
    B.plateBoxes.forEach((b) => ocel.push(teleso(b)));
    pridej(slouc(ocel), M.ocel);
    const sv = pridej(slouc(svary), M.svar, { stin: false }); if (sv) { sv.name = 'svary'; sv.visible = ui.svary; }
    if (B.hwBodies && B.hwBodies.length) pridej(slouc(B.hwBodies.map((b) => teleso(b))), M.spoj);
    if (B.boltPts && B.boltPts.length) { const g = B.boltPts.map((p) => { const c = new THREE.CylinderGeometry(cfg.size * 0.2, cfg.size * 0.2, 6, 6); c.rotateX(Math.PI / 2); c.translate(p[0], p[1], p[2]); return c.toNonIndexed(); }); pridej(slouc(g), M.spoj); }
    /* deska stolu */
    const obrys = K.deskOutline(cfg.shape, A.DL, A.DW), sklo = !!B.glassTop || ui.deska === 'sklo', druh = sklo ? 'sklo' : ui.deska;
    const um = { o: [0, 0, B.dims.Hf], ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1] };
    if (druh === 'sklo') { M.sklo.thickness = cfg.td; pridej(plech(obrys, [], cfg.td, Object.assign({ zkos: Math.min(2, cfg.td * 0.2), segmenty: 3 }, um)), M.sklo, { stin: false }); }
    else if (druh === 'epoxid') {
      /* řeka epoxidu podél stolu: tři pásy oříznuté obrysem desky (obrys desky je konvexní) */
      const y1 = (x) => -A.DW * 0.07 + A.DW * 0.05 * Math.sin(x * 0.0042 + 0.4) + A.DW * 0.015 * Math.sin(x * 0.013), y2 = (x) => A.DW * 0.06 + A.DW * 0.045 * Math.sin(x * 0.0047 + 2) + A.DW * 0.018 * Math.sin(x * 0.011 + 1.1);
      const xs = Array.from({ length: 161 }, (_, i) => -A.DL * 0.55 + i * A.DL * 1.1 / 160), a = xs.map((x) => [x, y1(x)]), b = xs.map((x) => [x, y2(x)]), dal = A.DW * 2;
      M.epoxid.thickness = cfg.td;
      [[[...a, [A.DL, -dal], [-A.DL, -dal]], M.dub], [[...a, ...b.slice().reverse()], M.epoxid], [[...b, [A.DL, dal], [-A.DL, dal]], M.dub]].forEach(([poly, m]) => {
        const p = orizniObrysem(poly, obrys); if (p.length >= 3) pridej(plech(p, [], cfg.td, Object.assign({ zkos: 0.6 }, um)), m);
      });
    } else pridej(plech(obrys, [], cfg.td, Object.assign({ zkos: Math.min(2.5, cfg.td * 0.1), segmenty: 3 }, um)), M[druh] || M.dub);
    studio.obsahZmenen({ podlahaZ: 0 });
    X.koty.nastav([{ a: [-A.DL / 2, -A.DW / 2 - 60, cfg.H], b: [A.DL / 2, -A.DW / 2 - 60, cfg.H], text: nf(A.DL) + ' mm' }, { a: [A.DL / 2 + 60, -A.DW / 2, cfg.H], b: [A.DL / 2 + 60, A.DW / 2, cfg.H], text: nf(A.DW) + ' mm' }, { a: [A.DL / 2 + 60, A.DW / 2, 0], b: [A.DL / 2 + 60, A.DW / 2, cfg.H], text: nf(cfg.H) + ' mm' }]);
  }
  function orizniObrysem(poly, obrys) {                                 // Sutherland–Hodgman proti konvexnímu obrysu desky
    let out = poly; const n = obrys.length; let ar = 0; obrys.forEach((p, i) => { const q = obrys[(i + 1) % n]; ar += p[0] * q[1] - q[0] * p[1]; }); const sg = ar > 0 ? 1 : -1;
    for (let i = 0; i < n && out.length; i++) {
      const p = obrys[i], q = obrys[(i + 1) % n], inp = out; out = [];
      const s = (v) => sg * ((q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0]));
      for (let j = 0; j < inp.length; j++) { const u = inp[j], w = inp[(j + 1) % inp.length], su = s(u), sw = s(w); if (su >= 0) out.push(u); if ((su >= 0) !== (sw >= 0)) { const t = su / (su - sw); out.push([u[0] + (w[0] - u[0]) * t, u[1] + (w[1] - u[1]) * t]); } }
    }
    return out;
  }

  /* ---------- panel voleb ---------- */
  const volby = $('volby');
  volby.innerHTML = ['Model', 'Rozměry stolu', 'Provedení', 'Deska', 'Barva a povrch', 'Detaily', 'Prostředí'].map((t, i) => '<section class="sekce" id="k' + i + '"><h2>' + t + '<span id="h' + i + '"></span></h2><div id="s' + i + '"></div><div id="x' + i + '"></div></section>').join('');
  const nahledy = {}; let pos = {};
  const info = (id) => K.MODELS.find((m) => m.id === id) || {};
  const vyber = (id, lab, polozky, akt) => '<label class="radek" for="' + id + '">' + lab + '</label><select class="vyber" id="' + id + '">' + polozky.map((p) => '<option value="' + esc(p.id) + '"' + (p.id === akt ? ' selected' : '') + '>' + esc(p.lab) + '</option>').join('') + '</select>';

  function panel() {
    cipy($('s0'), MODELY.map(([id, lab]) => ({ id, lab, svg: info(id).icon || 'M8 40 L32 8 L56 40' })), cfg.model, (id) => { if (id === 'MOT') { $('stav').classList.remove('ok'); $('stav').textContent = 'Stahuji model…'; nactiMot().then(() => zmen({ model: id }, true, true)).catch(() => { $('stav').textContent = 'Model se nepodařilo stáhnout.'; }); } else zmen({ model: id }, true, true); }, { velke: true });
    $('x0').innerHTML = '<p class="pozn">' + esc(info(cfg.model).desc || '') + '</p>';
    const mot = cfg.model === 'MOT';
    if (mot) {
      $('s1').innerHTML = '<div id="vel"></div><p class="pozn">Motýlí podnož se vyrábí ve třech velikostech; rozměr desky se řídí velikostí.</p>';
      segment($('vel'), ['S', 'M', 'L'].map((v) => ({ id: v, lab: 'Velikost ' + v })), cfg.vel, (v) => zmen({ vel: v }, true, true)); pos = {};
    } else {
      $('s1').innerHTML = '<div id="pL"></div><div id="pW"></div><div id="pH"></div>';
      pos = { L: posuvnik($('pL'), { lab: 'Délka', min: 800, max: 2600, step: 50, value: cfg.L }, (v) => zmen({ L: v, dL: v })),
        W: posuvnik($('pW'), { lab: 'Šířka', min: 500, max: 1200, step: 50, value: cfg.W }, (v) => zmen({ W: v, dW: v })),
        H: posuvnik($('pH'), { lab: 'Výška', min: 400, max: 1100, step: 10, value: cfg.H }, (v) => zmen({ H: v })) };
    }
    /* provedení podle modelu – jen hlavní volby, zbytek v podrobném konfigurátoru */
    let h = '';
    if (cfg.model === 'PZ') h += vyber('vJoint', 'Spojení noh', K.JOINTS, cfg.joint);
    if (cfg.model === 'PV') h += vyber('vLay', 'Rozmístění noh', K.PV_LAYS, cfg.pvLay);
    if (cfg.model === 'PZ' || cfg.model === 'PV') h += vyber('vTop', 'Horní část pod deskou', K.topsFor ? K.topsFor(cfg) : K.TOPS, cfg.top);
    if (cfg.model === 'KS') h += vyber('vKs', 'Materiál boků', [{ id: 'pas', lab: 'Pásovina na hranu' }, { id: 'jekl', lab: 'Jekl' }], cfg.ksMat);
    if (mot) h += vyber('vSpoj', 'Spojení křídel', [{ id: 'srouby', lab: 'Šrouby (křídla zvlášť)' }, { id: 'svar', lab: 'Svar (jeden kus)' }], cfg.spoj);
    if (!mot && cfg.model !== 'KS') h += vyber('vSize', 'Jekl', K.SIZES.map((s) => ({ id: String(s), lab: s + ' × ' + s + ' mm' })), String(cfg.size));
    $('s2').innerHTML = h;
    [['vJoint', 'joint'], ['vLay', 'pvLay'], ['vTop', 'top'], ['vKs', 'ksMat'], ['vSpoj', 'spoj'], ['vSize', 'size']].forEach(([id, k]) => { const el = $(id); if (el) el.addEventListener('change', () => zmen({ [k]: k === 'size' ? Number(el.value) : el.value }, true)); });
    /* deska */
    cipy($('s3'), [{ id: 'dub', lab: 'Dub' }, { id: 'jasan', lab: 'Jasan' }, { id: 'orech', lab: 'Tmavé dřevo' }, { id: 'epoxid', lab: 'Epoxid' }, { id: 'sklo', lab: 'Sklo' }].map((d) => Object.assign({ img: nahledy[d.id] }, d)), ui.deska, (id) => { ui.deska = id; zmen({}, true); });
    $('x3').innerHTML = (mot ? '' : '<div id="tvar" style="margin-top:10px"></div>') + '<div id="pT"></div><p class="pozn">Deska není součást podnože – cena je bez ní. Otvory a postup pro truhláře dostanete s nabídkou.</p>';
    if (!mot) $('tvar').innerHTML = vyber('vTvar', 'Tvar desky', K.SHAPES, cfg.shape), $('vTvar').addEventListener('change', (e) => zmen({ shape: e.target.value }, true));
    pos.td = posuvnik($('pT'), { lab: 'Tloušťka desky', min: 10, max: 80, step: 1, value: cfg.td }, (v) => zmen({ td: v }));
    const lak = (mat.POVRCHY[cfg.fin] || {}).typ === 'lak';
    cipy($('s4'), K.FIN.map((f) => ({ id: f.id, lab: f.lab, sub: f.ral, img: nahledy['fin:' + f.id] })), ui.ral && lak ? '' : cfg.fin, (id) => { ui.ral = null; zmen({ fin: id }, true); });
    $('x4').innerHTML = '<p class="pozn" style="margin-bottom:8px">Jiný odstín RAL (prášková barva, stejná cena):</p><div id="ral"></div><p class="pozn">Odstín mimo černou, antracit a bílou napište do poznámky v poptávce. Barva na monitoru je orientační.</p>';
    cipy($('ral'), Object.keys(mat.RAL).filter((r) => ![9005, 7016, 9016].includes(Number(r))).map((r) => ({ id: r, lab: 'RAL ' + r, sub: mat.RAL[r][0], img: nahledy['ral:' + r] })), ui.ral && lak ? String(ui.ral) : '', (r) => { ui.ral = Number(r); zmen({ fin: new THREE.Color(mat.RAL[r][1]).getHSL({}).l > 0.6 ? 'white' : 'anth' }, true); });
    $('s5').innerHTML = '<label class="radek">Viditelné svary<input type="checkbox" id="cSvary"' + (ui.svary ? ' checked' : '') + '></label><p class="pozn">Vypnuto = svary zabroušené do roviny.</p><div class="drobne"><a href="https://arkeeas.github.io/arkeas93/vyvoj.html">Všechny volby (uchycení k desce, pásoviny, kusy)</a></div>';
    $('cSvary').addEventListener('change', (e) => { ui.svary = e.target.checked; const s = skupina.getObjectByName('svary'); if (s) s.visible = ui.svary; studio.invalidate(); uloz(); });
    X.kresliProstredi($('s6'), ['studio', 'teple', 'zahrada', 'terasa']);
    X.kresliPohledy([{ id: 'celek', lab: 'Celek' }, { id: 'zepredu', lab: 'Zepředu' }, { id: 'zboku', lab: 'Zboku' }, { id: 'shora', lab: 'Shora' },
      { lab: 'Detail spoje', detail: () => ({ bod: [0, 0, A.build.dims.Hf * 0.5], smer: [-0.75, -1, 0.2], vzd: 420 }) },
      { lab: 'Detail patky', detail: () => { let p = [0, 0, 0], nej = -1; A.build.parts.forEach((q) => q.solid.verts.forEach((v) => { if (v[2] < 2 && v[0] - v[1] > nej) { nej = v[0] - v[1]; p = v; } })); return { bod: [p[0], p[1], 25], smer: [0.7, -1, 0.5], vzd: 330 }; } },
      { lab: 'Pod deskou', detail: () => ({ bod: [A.DL * 0.2, -A.DW * 0.25, A.build.dims.Hf - 30], smer: [0.5, -1, -0.05], vzd: 520 }) }]);
  }

  function cena() {
    $('nazev').textContent = 'Stůl ' + (MODELY.find((m) => m[0] === cfg.model) || ['', ''])[1];
    $('popis').textContent = nf(A.DL) + ' × ' + nf(A.DW) + ' × ' + nf(cfg.H) + ' mm · ' + nf(A.kg, 1) + ' kg oceli';
    $('h1').textContent = nf(A.DL) + ' × ' + nf(A.DW) + ' × ' + nf(cfg.H) + ' mm';
    $('cena').textContent = nf(A.vat) + ' Kč';
    $('cenaPod').textContent = 'podnož orientačně s DPH · ' + nf(A.price) + ' Kč bez DPH · ' + nf(A.kg, 1) + ' kg · bez desky';
    const chyby = (A.problems || []).map((p) => (typeof p === 'string' ? p : p.t || p.text || '')).filter(Boolean), v = $('varovani');
    v.hidden = !chyby.length; v.textContent = chyby[0] || '';
    $('x1').innerHTML = (A.warns || []).slice(0, 2).map((w) => '<p class="pozn varuj">' + esc(typeof w === 'string' ? w : w.t || '') + '</p>').join('');
  }

  let cekam = 0, chciPanel = false, chciCelek = false;
  function zmen(p, panelTez, prizpusob) {
    const pred = [cfg.fin, M.ocel.userData.povrch[1]];
    cfg = K.normalize(Object.assign({}, cfg, p));
    if (cfg.fin !== pred[0] || ui.ral !== pred[1]) { mat.prelad([M.ocel], cfg.fin, ui.ral); const s = mat.svar(cfg.fin, ui.ral); M.svar.copy(s); s.dispose(); }
    chciPanel = chciPanel || !!panelTez; chciCelek = chciCelek || !!prizpusob;
    cancelAnimationFrame(cekam); cekam = requestAnimationFrame(() => { postav(); cena(); if (chciPanel) panel(); if (chciCelek) studio.pohled('celek'); chciPanel = chciCelek = false; });
    if (!panelTez) Object.keys(pos).forEach((k) => pos[k].set(cfg[k]));
    uloz();
  }
  function udelejNahledy() {
    K.FIN.forEach((f) => { const m = mat.kov(f.id); nahledy['fin:' + f.id] = mat.nahled(m); m.dispose(); });
    Object.keys(mat.RAL).forEach((r) => { const m = mat.kov('black', r); nahledy['ral:' + r] = mat.nahled(m); m.dispose(); });
    panel();
    setTimeout(() => { ['dub', 'jasan', 'orech'].forEach((d) => { nahledy[d] = mat.nahled(M[d]); }); nahledy.sklo = mat.nahledLesku('#bfe0d6'); nahledy.epoxid = mat.nahledLesku('#0b7f8f'); panel(); }, 1200);
  }

  cenik('nastaveni/cenik', (d) => { rates = K.rates0 ? K.rates0(d) : Object.assign({}, K.DEFAULT_RATES, d); if (A) { A = K.analyze(cfg, rates); cena(); } });
  panel();
  Promise.all([studio.prostredi(ui.prostredi), chceMot ? nactiMot().then(() => { cfg = K.normalize(ulozena); }).catch(() => {}) : null]).then(() => {
    postav(); cena(); panel(); studio.pohled('celek', 0);
    udelejNahledy(); studio.na('obnova', udelejNahledy);
    window.__foto = { studio, cfg: () => cfg, zmen, hotovo: true, A: () => A };
  }).catch((e) => { console.error(e); $('stav').textContent = 'Nepodařilo se načíst podklady.'; });
}
