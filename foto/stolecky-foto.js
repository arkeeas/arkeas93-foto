/* Foto náhled konferenčních stolečků (Motýlek, Řetěz).
 * Rozměry, díly, cenu i hmotnost počítá beze změny `stolecky-core.js`; tahle stránka dělá jen obraz a volby okolo.
 */
import * as THREE from 'three';
import { zaloz } from './render/stranka.js';
import { hranol, plech, kruh, sit, housenka, slouc, orizni } from './render/geometrie.js';
import { $, cipy, segment, posuvnik, sekce, rychle, nf, esc, pamet, zOdkazu, ulozOdkaz, cenik } from './render/ui.js';

const S = window.Stolecky, KOREN = new URL('../', import.meta.url).href;
const sdil = zOdkazu();
let cfg = S.normalize((sdil && sdil.c) || pamet.cti('stolecky-retez') || Object.assign({}, S.DEFAULT_CFG, { model: 'motylek', H: 500, topD: 600 }));
const ui = Object.assign({ prostredi: 'studio', koty: false, dof: false, svary: true, deska: null, ral: null }, pamet.cti('foto-stolecky-ui') || {}, (sdil && sdil.u) || {});
if (cfg.fin === 'ral') ui.ral = Number(cfg.ralJiny) || ui.ral;   // odstín zadaný v konfigurátoru
if (!ui.deska) ui.deska = { ash: 'jasan', oak: 'dub', epoxy: 'epoxid' }[localStorage.getItem('skovo-board-material-v1')] || 'dub';
let rates = S.DEFAULT_RATES, B = null, sitMotylek = null;

const X = zaloz({ ui, ar: true, zmenaUi: uloz, nazev: () => (cfg.model === 'motylek' ? 'Stolek Motýlek' : 'Stolek Řetěz'), nazevFotky: () => 'stolek-' + cfg.model + '-' + cfg.topD + 'x' + cfg.H });
if (X) start();

function uloz() {
  pamet.zapis('stolecky-retez', cfg); pamet.zapis('foto-stolecky-ui', ui);
  try { localStorage.setItem('skovo-board-material-v1', { jasan: 'ash', dub: 'oak', epoxid: 'epoxy' }[ui.deska] || 'oak'); } catch (e) { /* bez úložiště */ }
  ulozOdkaz({ c: cfg, u: { prostredi: ui.prostredi, deska: ui.deska, ral: ui.ral, svary: ui.svary } });
}

function start() {
  const { studio, mat } = X;
  /* materiály žijí po celou dobu – při změně povrchu se jen přeladí */
  const M = {
    ocel: mat.kov(cfg.fin, ui.ral), hrana: mat.hrana(cfg.fin, ui.ral), svar: mat.svar(cfg.fin, ui.ral),
    dub: mat.drevo('dub'), jasan: mat.drevo('jasan'), epoxid: mat.epoxid(), sklo: mat.sklo(), spoj: mat.spojovaci()
  };
  const skupina = new THREE.Group(); studio.content.add(skupina);
  const uklid = () => { while (skupina.children.length) { const o = skupina.children.pop(); o.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); } };
  const pridej = (g, m, o = {}) => { if (!g) return null; const mesh = new THREE.Mesh(g, m); mesh.castShadow = o.stin !== false; mesh.receiveShadow = true; skupina.add(mesh); return mesh; };

  /* deska: dřevo / epoxid (dřevo s řekou) / sklo – kruh se sraženou hranou, horní plocha ve výšce z1 */
  function deska(D, T, z1, druh) {
    const R = D / 2, um = { o: [0, 0, z1 - T], ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1] }, obvod = kruh(0, 0, R, 144);
    if (druh === 'sklo') { M.sklo.thickness = T; pridej(plech(obvod, [], T, Object.assign({ zkos: Math.min(2, T * 0.2), segmenty: 3 }, um)), M.sklo, { stin: false }); return; }
    const drevo = druh === 'jasan' ? M.jasan : M.dub;
    if (druh !== 'epoxid') { pridej(plech(obvod, [], T, Object.assign({ zkos: Math.min(2.5, T * 0.12), segmenty: 3 }, um)), drevo); return; }
    const k = R / 300, x1 = (y) => (-34 + 24 * Math.sin(y * 0.0105 / k + 0.4) + 8 * Math.sin(y * 0.031 / k)) * k, x2 = (y) => (30 + 20 * Math.sin(y * 0.0118 / k + 2.0) + 9 * Math.sin(y * 0.027 / k + 1.1)) * k;
    const ys = Array.from({ length: 121 }, (_, i) => -R * 1.05 + i * R * 2.1 / 120);
    const leva = ys.map((y) => [x1(y), y]), prava = ys.map((y) => [x2(y), y]);
    const dily = [[[-2 * R, -2 * R], ...leva.map((p) => p), [-2 * R, 2 * R]], [...leva, ...prava.slice().reverse()], [[2 * R, -2 * R], [2 * R, 2 * R], ...prava.slice().reverse()]].map((p) => orizni(p, obvod));
    M.epoxid.thickness = T;
    dily.forEach((p, i) => { if (p.length >= 3) pridej(plech(p, [], T, Object.assign({ zkos: 0.6, segmenty: 1 }, um)), i === 1 ? M.epoxid : drevo); });
  }

  function stavMotylek() {
    if (!sitMotylek) return;
    const vlastni = cfg.motylekTop === 'vlastni';
    sitMotylek.forEach((src) => {
      const jeDeska = /deska/i.test(src.name);
      if (vlastni && jeDeska) return;
      const dil = S.transformMotylekMesh(src, src.name, cfg);
      const osa = jeDeska ? 2 : /\bA\b|podnoz.?a/i.test(src.name) ? 1 : 0;
      pridej(sit(dil.positions, dil.indices, osa), [M.ocel, M.hrana]);
    });
    if (vlastni) {
      deska(cfg.topD, cfg.motylekTopT, cfg.H, ui.deska);
      const obrys = [[-22, -22], [22, -22], [22, 22], [-22, 22]], drazka = [];
      for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 - Math.PI * i / 8; drazka.push([6.25 + 2.75 * Math.cos(a), 2.75 * Math.sin(a)]); }
      for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 - Math.PI * i / 8; drazka.push([-6.25 + 2.75 * Math.cos(a), 2.75 * Math.sin(a)]); }
      B.mountTabs.forEach((p) => { const c = Math.cos(p.rotation), s = Math.sin(p.rotation); pridej(plech(obrys, [drazka], 4, { o: [p.x, p.y, p.z], ex: [c, s, 0], ey: [-s, c, 0], ez: [0, 0, 1] }), [M.ocel, M.hrana]); });
    }
  }

  /* Řetěz: jekly jako zaoblené hranoly mezi pokosy (osa a řezy z obrysu dílu v jádru), plotny s otvory, svary v rozích */
  function stavRetez() {
    const G = B.G, P = G.P, tyce = [], svary = [], klice = new Set();
    const do3 = (rovina, zc) => (q) => (rovina === 'xz' ? [q[0], 0, q[1] + zc] : [0, q[0], q[1] + zc]);
    [['lam', 'xz', G.zl], ['mid', 'yz', G.zm], ['vee', 'xz', G.zu]].forEach(([k, rovina, zc]) => {
      const F = B.frames[k], T3 = do3(rovina, zc), kolmo = rovina === 'xz' ? [0, 1, 0] : [1, 0, 0];
      F.polys.forEach((q, i) => {
        const a = T3(q[0]), b = T3(q[1]), c = T3(q[2]), d0 = T3(q[3]);
        const dl = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), osa = [(b[0] - a[0]) / dl, (b[1] - a[1]) / dl, (b[2] - a[2]) / dl];
        let n = [osa[1] * kolmo[2] - osa[2] * kolmo[1], osa[2] * kolmo[0] - osa[0] * kolmo[2], osa[0] * kolmo[1] - osa[1] * kolmo[0]];
        let w = (d0[0] - a[0]) * n[0] + (d0[1] - a[1]) * n[1] + (d0[2] - a[2]) * n[2]; if (w < 0) { n = n.map((v) => -v); w = -w; }
        const kol = (u, v) => { const e = [v[0] - u[0], v[1] - u[1], v[2] - u[2]]; return [e[1] * kolmo[2] - e[2] * kolmo[1], e[2] * kolmo[0] - e[0] * kolmo[2], e[0] * kolmo[1] - e[1] * kolmo[0]]; };
        const m = { p0: [a[0] + n[0] * w / 2, a[1] + n[1] * w / 2, a[2] + n[2] * w / 2], d: osa, e1: n, e2: kolmo, h1: w / 2, h2: G.hd / 2, t: P.wall, cut0: { p: a, n: kol(a, d0) }, cut1: { p: b, n: kol(b, c) } };
        const h = hranol(m); tyce.push(h.geometry);
        /* svar jen na pokosu v rohu článku (ne na noze zasunuté do plechu) */
        h.konce.forEach((loop, e) => {
          const roh = e === 0 ? F.corner[i] : F.corner[F.endK(i)]; if (!roh) return;
          const st = loop.reduce((s2, p) => [s2[0] + p[0], s2[1] + p[1], s2[2] + p[2]], [0, 0, 0]).map((v) => Math.round(v / loop.length)), key = st.join();
          if (klice.has(key)) return; klice.add(key); svary.push(housenka(loop, 1.3, true, 3.2));
        });
      });
    });
    pridej(slouc(tyce), M.ocel);
    const sv = pridej(slouc(svary), M.svar); if (sv) { sv.visible = ui.svary; sv.name = 'svary'; }
    const plotna = (pl, z) => pridej(plech(pl.outline, pl.holes.concat(pl.circles.map((c) => kruh(c[0], c[1], c[2], 24))), pl.t, { o: [0, 0, z], ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1], zkos: 0.5 }), [M.ocel, M.hrana]);
    plotna(B.plates.base, 0);
    const zt = cfg.H - cfg.topT - cfg.plT; plotna(B.plates.top, zt);
    (B.plates.top.studs || []).forEach((p) => { const g = new THREE.CylinderGeometry(4, 4, 20, 20); g.rotateX(Math.PI / 2); g.translate(p[0], p[1], zt + cfg.plT + 10); pridej(g, M.spoj); });
    deska(cfg.topD, cfg.topT, cfg.H, ui.deska);
  }

  function postav() {
    B = S.build(cfg); uklid();
    if (B.model === 'motylek') stavMotylek(); else stavRetez();
    studio.obsahZmenen({ podlahaZ: 0 });
    const R = cfg.topD / 2;
    X.koty.nastav([{ a: [R + 60, 0, 0], b: [R + 60, 0, cfg.H], text: nf(cfg.H) + ' mm' }, { a: [-R, -R - 40, cfg.H], b: [R, -R - 40, cfg.H], text: 'Ø ' + nf(cfg.topD) + ' mm' }]);
  }

  /* ---------- panel voleb ---------- */
  const volby = $('volby');
  /* barva (3) a prostředí (5) jsou rychlé volby u nadpisu scény */
  sekce(volby, [[0, 'Model'], [1, 'Rozměry'], [2, 'Deska'], [4, 'Detaily']], ui, { zmena: uloz });
  const R = rychle($('rychle'), [{ id: 'prostredi', lab: 'Prostředí', html: '<div id="s5"></div>' }, { id: 'barva', lab: 'Barva', html: '<div id="s3"></div><div id="x3"></div>' }]);
  const nahledy = {};
  const DESKY = [{ id: 'ocel', lab: 'Ocel 4 mm', sub: 'v ceně' }, { id: 'dub', lab: 'Dub', sub: 'vlastní deska' }, { id: 'jasan', lab: 'Jasan', sub: 'vlastní deska' }, { id: 'epoxid', lab: 'Epoxid', sub: 'vlastní deska' }, { id: 'sklo', lab: 'Sklo', sub: 'vlastní deska' }];
  let pos = {};

  function panel() {
    const mot = cfg.model === 'motylek';
    segment($('s0'), S.MODELS.map((m) => ({ id: m.id, lab: m.lab })).reverse(), cfg.model, (id) => { zmen(id === 'retez' && cfg.topT < 18 ? { model: id, topT: 30 } : { model: id }, true); studio.pohled('celek'); });
    $('x0').innerHTML = '<p class="pozn">' + (mot ? 'Dva plechy 4 mm zasazené do sebe, motiv motýlů vypálený laserem.' : 'Tři články z jeklu zavěšené do sebe jako řetěz.') + '</p>';
    /* rozměry – meze drží jádro (normalize) */
    $('s1').innerHTML = '<div id="pH"></div><div id="pD"></div>' + (mot ? '' : '<div id="pS"></div>') + '<div id="pT"></div>';
    pos = {
      H: posuvnik($('pH'), { lab: 'Výška', min: mot ? 400 : 300, max: mot ? 650 : 800, step: 10, value: cfg.H }, (v) => zmen({ H: v })),
      topD: posuvnik($('pD'), { lab: 'Průměr desky', min: mot ? 500 : 400, max: mot ? 800 : 1400, step: 50, value: cfg.topD }, (v) => zmen({ topD: v }))
    };
    if (!mot) pos.spread = posuvnik($('pS'), { lab: 'Rozteč noh', min: 60, max: 500, step: 10, value: cfg.spread }, (v) => zmen({ spread: v }));
    const vlastni = mot ? cfg.motylekTop === 'vlastni' : true;
    if (vlastni) pos.T = posuvnik($('pT'), { lab: 'Tloušťka desky', min: 10, max: 60, step: 1, value: mot ? cfg.motylekTopT : cfg.topT }, (v) => zmen(mot ? { motylekTopT: v } : { topT: v })); else $('pT').innerHTML = '';
    /* deska */
    const aktDeska = mot && cfg.motylekTop !== 'vlastni' ? 'ocel' : ui.deska;
    cipy($('s2'), DESKY.filter((d) => (mot ? d.id !== 'sklo' : d.id !== 'ocel')).map((d) => Object.assign({ img: nahledy[d.id] }, d)), aktDeska, (id) => {
      if (id === 'ocel') { zmen({ motylekTop: 'plech' }, true); return; }
      ui.deska = id; const p = mot ? { motylekTop: 'vlastni' } : {};
      if (!mot && id === 'sklo') { p.mount = 'lepeni'; if (cfg.topT > 19) p.topT = 12; }
      zmen(p, true);
    });
    $('x2').innerHTML = '<p class="pozn">' + (aktDeska === 'ocel' ? 'Ocelová deska je součást stolku a je v ceně.' : aktDeska === 'sklo' ? 'Sklo se na podnož lepí. Desku si zajišťujete sami, cena je bez ní.' : 'Dřevěnou nebo epoxidovou desku si zajišťujete sami, cena je bez ní. Rozměry pro truhláře dostanete s nabídkou.') + '</p>';
    /* barva a povrch: 4 povrchy z ceníku + odstíny RAL na přání */
    const lak = (mat.POVRCHY[cfg.fin] || {}).typ === 'lak';
    cipy($('s3'), S.FIN.filter((f) => !f.other).map((f) => ({ id: f.id, lab: f.lab, sub: f.ral, img: nahledy['fin:' + f.id] })), ui.ral && lak ? '' : cfg.fin, (id) => { ui.ral = null; zmen({ fin: id, ralJiny: '' }, true); });
    const ralEl = $('x3'); ralEl.innerHTML = '<p class="pozn" style="margin-bottom:8px">Jiný odstín RAL (prášková barva, stejná cena):</p><div id="ral"></div><p class="pozn">Barva na monitoru je orientační, rozhoduje vzorník RAL.</p>';
    cipy($('ral'), Object.keys(mat.RAL).filter((r) => ![9005, 7016, 9016].includes(Number(r))).map((r) => ({ id: r, lab: 'RAL ' + r, sub: mat.RAL[r][0], img: nahledy['ral:' + r] })), ui.ral && lak ? String(ui.ral) : '', (r) => {
      ui.ral = Number(r); zmen({ fin: 'ral', ralJiny: String(r) }, true);
    });
    /* detaily */
    $('s4').innerHTML = (mot ? '' : '<label class="radek">Viditelné svary<input type="checkbox" id="cSvary"' + (ui.svary ? ' checked' : '') + '></label><p class="pozn">Vypnuto = svary zabroušené do roviny.</p>') ;
    if (!mot) $('cSvary').addEventListener('change', (e) => { ui.svary = e.target.checked; const s = skupina.getObjectByName('svary'); if (s) s.visible = ui.svary; studio.invalidate(); uloz(); });
    X.kresliProstredi($('s5'), ['studio', 'teple', 'zahrada', 'terasa'], (t, b) => R.popis('prostredi', t, b));
    { const f = S.FIN.find((q) => q.id === cfg.fin) || {}, kod = ui.ral || (mat.POVRCHY[cfg.fin] || {}).ral, r = mat.RAL[kod]; R.popis('barva', ui.ral && lak && r ? 'RAL ' + kod + ' ' + r[0] : f.lab || '', lak && r ? r[1] : '#8d9093'); }
    X.kresliPohledy([{ id: 'celek', lab: 'Celek' }, { id: 'zepredu', lab: 'Zepředu' }, { id: 'zboku', lab: 'Zboku' }, { id: 'shora', lab: 'Shora' },
      { lab: mot ? 'Detail zámku' : 'Detail svaru', detail: () => (mot ? { bod: [0, 0, cfg.H * 0.62], smer: [-0.7, -1, 0.25], vzd: 300 } : { bod: rohClanku(), smer: [-1, -0.75, 0.3], vzd: 210 }) },
      { lab: mot ? 'Detail motivu' : 'Detail plotny', detail: () => (mot ? { bod: [cfg.topD * 0.2, -2, cfg.H * 0.45], smer: [0.25, -1, 0.12], vzd: 330 } : { bod: [0, -40, 12], smer: [-0.5, -1, 0.55], vzd: 380 }) },
      { lab: 'Hrana desky', detail: () => ({ bod: [cfg.topD * 0.35, -cfg.topD * 0.35, cfg.H - 4], smer: [0.6, -1, 0.28], vzd: 240 }) }]);
  }

  /* boční roh prostředního článku (pokos se svarem) – bod pro pohled „Detail svaru“ */
  function rohClanku() {
    let nej = [0, 0, cfg.H / 2]; if (!B.frames) return nej;
    B.frames.mid.polys.forEach((q) => q.forEach((p) => { if (-p[0] > -nej[1] || (nej[1] === 0 && p[0] < 0)) nej = [0, p[0], p[1] + B.G.zm]; }));
    return [0, nej[1] + B.G.hp * 0.5, nej[2]];
  }

  function cena() {
    const Xp = S.price(B, rates), mot = B.model === 'motylek';
    $('nazev').textContent = mot ? 'Stolek Motýlek' : 'Stolek Řetěz';
    $('popis').textContent = 'Ø ' + nf(cfg.topD) + ' × ' + nf(cfg.H) + ' mm · ' + nf(B.kg, 1) + ' kg oceli';
    $('h1').textContent = 'Ø ' + nf(cfg.topD) + ' × ' + nf(cfg.H) + ' mm';
    $('cena').textContent = nf(Xp.vat) + ' Kč';
    $('cenaPod').textContent = 'orientačně s DPH · ' + nf(Xp.price) + ' Kč bez DPH · ' + nf(B.kg, 1) + ' kg' + (mot && cfg.motylekTop !== 'vlastni' ? '' : ' · bez desky');
    const w = B.warn || [], v = $('varovani'); v.hidden = !w.length; v.textContent = w[0] || '';
  }

  let cekam = 0;
  function zmen(p, prekreslitPanel) {
    const predFin = cfg.fin, predRal = M.ocel.userData.povrch[1];
    cfg = S.normalize(Object.assign({}, cfg, p));
    if (cfg.fin !== predFin || ui.ral !== predRal) { mat.prelad([M.ocel], cfg.fin, ui.ral); const h = mat.hrana(cfg.fin, ui.ral), s = mat.svar(cfg.fin, ui.ral); M.hrana.copy(h); M.svar.copy(s); h.dispose(); s.dispose(); }
    cancelAnimationFrame(cekam);
    if (prekreslitPanel) { postav(); cena(); panel(); }                 // volba v panelu: hned, ať pohledy pracují s novým modelem
    else cekam = requestAnimationFrame(() => { postav(); cena(); });
    if (!prekreslitPanel) Object.keys(pos).forEach((k) => pos[k].set(k === 'T' ? (cfg.model === 'motylek' ? cfg.motylekTopT : cfg.topT) : cfg[k]));
    uloz();
  }

  /* náhledy materiálů na koulích – až je načtené světlo (a znovu po obnově grafického kontextu) */
  function udelejNahledy() {
    S.FIN.forEach((f) => { const m = mat.kov(f.id); nahledy['fin:' + f.id] = mat.nahled(m); m.dispose(); });
    Object.keys(mat.RAL).forEach((r) => { const m = mat.kov('black', r); nahledy['ral:' + r] = mat.nahled(m); m.dispose(); });
    nahledy.ocel = nahledy['fin:' + cfg.fin]; panel();
    setTimeout(() => { ['dub', 'jasan'].forEach((d) => { nahledy[d] = mat.nahled(M[d]); }); nahledy.sklo = mat.nahledLesku('#bfe0d6'); nahledy.epoxid = mat.nahledLesku('#0b7f8f'); nahledy.ocel = nahledy['fin:' + cfg.fin]; panel(); }, 1200);
  }

  /* ---------- start ---------- */
  cenik('nastaveni/cenik', (d) => { rates = Object.assign({}, S.DEFAULT_RATES, d); if (B) cena(); });
  panel();
  const nacti = fetch(KOREN + 'assets/stolecky/motyli_stolek/preview.json').then((r) => r.json()).then((a) => { sitMotylek = a.meshes; });
  Promise.all([studio.prostredi(ui.prostredi), cfg.model === 'motylek' ? nacti : null]).then(() => {
    postav(); cena(); studio.pohled('celek', 0);
    udelejNahledy(); studio.na('obnova', udelejNahledy);
    panel(); window.__foto = { studio, cfg: () => cfg, zmen, hotovo: true };
  }).catch((e) => { console.error(e); $('stav').textContent = 'Nepodařilo se načíst podklady.'; });
  nacti.then(() => { if (cfg.model === 'motylek' && B) { postav(); cena(); } });
}
