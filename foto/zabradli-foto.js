/* Foto náhled zábradlí.
 * Trasu, díly, zámky, kotvy, meze i cenu počítá beze změny `zabradli-core.js`. Tady se z popisu dílů (osa, průřez,
 * roviny řezů) kreslí jekly se zaoblenými hranami, špruše, madlo, plechy s motivem vypáleným skrz a svary.
 * Motivy se stahují, až když jsou potřeba. Konfigurace je uložená pod stejným klíčem jako na zabradli.html. */
import * as THREE from 'three';
import { zaloz } from './render/stranka.js';
import { hranol, plech, kruh, teleso, housenka, slouc, vHranolu, maticeGeo, V } from './render/geometrie.js';
import { $, cipy, segment, posuvnik, sekce, rychle, nf, pamet, zOdkazu, ulozOdkaz, cenik } from './render/ui.js';
import { dynPanel } from './zabradli-dyn.js';

const Zb = window.Zabradli, KOREN = new URL('../', import.meta.url).href, VERZE = '20261110a';
const sdil = zOdkazu();
/* cfgVer = konfigurace ze stránky zákazníka: platí pro ni nové meze jádra (přesah nahoru, rozteč motivů) */
let cfg = Zb.normalize(Object.assign({}, (sdil && sdil.c) || pamet.cti('zabradli-cfg') || { vypln: 'laser', rada: 'priroda', motiv: 'jelen', sloupky: true, anchor: 'patka', fin: 'prasek', segs: [{ L: 3000, rise: 0 }] }, { cfgVer: Zb.CFG_VER }));
const ui = Object.assign({ prostredi: 'zahrada', koty: false, dof: false, svary: true, ral: null, dilna: false, ksel: null }, pamet.cti('foto-zabradli-ui') || {}, (sdil && sdil.u) || {});
let rates = Zb.rates0 ? Zb.rates0() : undefined, A = null;
/* odstín RAL je v konfiguraci (cfg.ral / cfg.ralJiny) stejně jako na zabradli.html; ui.ral je jen barva náhledu */
const ralKod = () => (window.Ral ? window.Ral.code(cfg.ral, cfg.ralJiny) : '7016');
const ralDoCfg = (r) => (window.Ral && window.Ral.LIST.some((x) => x.id === String(r)) ? { ral: String(r), ralJiny: '' } : { ral: 'jiny', ralJiny: String(r) });

/* ---------- motivy: stahují se až na vyžádání ---------- */
const stahuje = {};
function nactiSkript(soubor) {
  if (!stahuje[soubor]) stahuje[soubor] = new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = KOREN + soubor + '?v=' + VERZE; s.onload = ok; s.onerror = () => { delete stahuje[soubor]; chyba(new Error(soubor)); }; document.head.appendChild(s); });
  return stahuje[soubor];
}
const maMotiv = (id) => !!(window.ZabradliMotivy && window.ZabradliMotivy[id]);
function potrebneMotivy() {
  if (cfg.vypln !== 'laser') return [];
  const ids = new Set([cfg.motiv]);
  if (cfg.rada === 'priroda') (cfg.pole || []).forEach((p) => p && p.m && ids.add(p.m));
  return [...ids].filter((id) => id && !maMotiv(id));
}
let prekresli = () => {};
window.ZabradliNacti = (id, a) => { nactiSkript('assets/zabradli/schody/motiv-' + id + '-' + Math.round(a * 10) + '.js').then(() => prekresli(), () => {}); };

const X = zaloz({ ui, studio: { kontakt: false, podlaha: false, fov: 34, celek: [0.6, 0.2, 0.9] }, zmenaUi: uloz, poProstredi: () => { if (window.__stavba) window.__stavba.visible = true; }, nazev: () => 'Zábradlí', nazevFotky: () => 'zabradli-' + Math.round(A ? A.lenM * 1000 : 0) + 'mm',
  dilna: (zap) => technicky(zap) });
let technicky = () => {};
if (X) start();

function uloz() { pamet.zapis('zabradli-cfg', cfg); pamet.zapis('foto-zabradli-ui', ui); ulozOdkaz({ c: cfg, u: { prostredi: ui.prostredi, ral: ui.ral, svary: ui.svary } }); }

function start() {
  const { studio, mat } = X;
  if (!ui.ral && mat.RAL[ralKod()] && ralKod() !== '7016') ui.ral = Number(ralKod());   // odstín uložený na zabradli.html
  const M = { ocel: mat.kov(cfg.fin, ui.ral), hrana: mat.hrana(cfg.fin, ui.ral), svar: mat.svar(cfg.fin, ui.ral), kotva: mat.kov(cfg.fin, ui.ral), madlo: mat.drevo('madlo'), spoj: mat.spojovaci(),
    beton: mat.stavba('beton'), omitka: mat.stavba('omitka'), podlozka: new THREE.MeshStandardMaterial({ color: '#5c5248', roughness: 0.9 }) };
  const tech = { ocel: new THREE.MeshStandardMaterial({ color: '#9aa3ab', roughness: 0.8, metalness: 0.1 }), svar: new THREE.MeshBasicMaterial({ color: '#e0541c' }), panel: new THREE.MeshStandardMaterial({ color: '#c7ccd1', roughness: 0.8 }) };
  const skupina = new THREE.Group(); studio.content.add(skupina);
  const stavba = new THREE.Group(); studio.okoli.add(stavba); window.__stavba = stavba;
  const uklid = (g) => { while (g.children.length) { const o = g.children.pop(); o.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); } };
  const pridej = (g, m, kam = skupina, o = {}) => { if (!g) return null; const mesh = new THREE.Mesh(g, m); mesh.castShadow = o.stin !== false; mesh.receiveShadow = true; kam.add(mesh); return mesh; };
  const maticeG = maticeGeo(6);

  function postav() {
    A = rates ? Zb.analyze(cfg, rates) : Zb.analyze(cfg);
    uklid(skupina); uklid(stavba);
    const cleny = A.lay.members, hranoly = cleny.filter((m) => (m.kind === 'tube' || m.kind === 'bar') && !m.connectorPair && m.cut0 && m.cut1);
    const ocel = [], drevo = [], desky = [], podlozky = [], svary = [], klice = new Set(), tyce = [];
    cleny.forEach((m) => {
      if (m.connectorPair) { ocel.push(teleso(m.solid)); return; }
      if (m.kind === 'tube' || m.kind === 'bar') {
        if (!m.cut0 || !m.cut1) { ocel.push(teleso(m.solid)); return; }
        const h = hranol(m); ocel.push(h.geometry);
        /* svar tam, kde konec dílu dosedá na jiný díl (ne na volném konci přesahu) */
        h.konce.forEach((loop, e) => {
          const st = loop.reduce((s, p) => V.add(s, p), [0, 0, 0]).map((v) => v / loop.length), ven = V.add(st, V.mul(m.d, e ? 2.5 : -2.5));
          if (!hranoly.some((o) => o !== m && vHranolu(o, ven, 1))) return;
          const key = st.map((v) => Math.round(v / 2)).join(); if (klice.has(key)) return; klice.add(key);
          svary.push(housenka(loop, m.kind === 'bar' ? 0.8 : 1.0, true, m.kind === 'bar' ? 2.0 : 2.8));
        });
      } else if (m.kind === 'wood') drevo.push(hranol(m, { R: 9, seg: 6 }).geometry);
      else if (m.kind === 'plate' || m.kind === 'pad') (m.kind === 'pad' ? podlozky : desky).push(plech([[-m.w / 2, -m.l / 2], [m.w / 2, -m.l / 2], [m.w / 2, m.l / 2], [-m.w / 2, m.l / 2]], m.holes.map((h) => kruh(h[0], h[1], h[2], 20)), m.t, { o: m.o, ex: m.ex, ey: m.ey, ez: m.ez, zkos: 0.6 }));
      else if (m.kind === 'panel') {
        const p = pridej(plech(m.outline, Zb.panelHoles(m, studio.mobil ? 1.2 : Zb.PANEL.tol3d), m.t, { o: m.o, ex: m.ex, ey: m.ey, ez: m.ez, zkos: 0.3, hladke: true }), ui.dilna ? tech.panel : [M.ocel, M.hrana]);
        p.userData.panel = m;
      } else if (m.kind === 'rod') tyce.push(m);
      else if (m.solid) ocel.push(teleso(m.solid));
    });
    pridej(slouc(ocel), ui.dilna ? tech.ocel : M.ocel);
    pridej(slouc(drevo), M.madlo);
    pridej(slouc(desky), ui.dilna ? tech.ocel : M.kotva);
    pridej(slouc(podlozky), M.podlozka);
    const sv = pridej(slouc(svary), ui.dilna ? tech.svar : M.svar, skupina, { stin: false }); if (sv) { sv.name = 'svary'; sv.visible = ui.svary || ui.dilna; }
    /* závitové tyče s maticí a podložkou (instancovaně) */
    if (tyce.length) {
      const tg = new THREE.CylinderGeometry(1, 1, 1, 14); tg.rotateX(Math.PI / 2); tg.translate(0, 0, 0.5);
      const it = new THREE.InstancedMesh(tg, M.spoj, tyce.length), im = new THREE.InstancedMesh(maticeG, M.spoj, tyce.length), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1);
      const plotny = cleny.filter((m) => m.kind === 'plate');
      tyce.forEach((r, i) => {
        const d = new THREE.Vector3(...r.dir).normalize(); q.setFromUnitVectors(z, d);
        mm.compose(new THREE.Vector3(...r.o), q, new THREE.Vector3(r.r, r.r, r.L)); it.setMatrixAt(i, mm);
        /* matice sedí na volné straně plotny, kterou tyč prochází (proti směru tyče) */
        let pos = new THREE.Vector3(...r.o).addScaledVector(d, 18), smer = d.clone().negate();
        const pl = plotny.find((p) => { const w = V.sub(r.o, p.o); return Math.abs(V.dot(w, p.ex)) < p.w / 2 && Math.abs(V.dot(w, p.ey)) < p.l / 2 && Math.abs(Math.abs(V.dot(p.ez, r.dir)) - 1) < 0.01; });
        if (pl) { const sgn = V.dot(pl.ez, r.dir) > 0 ? 0 : pl.t, pruchod = V.dot(V.sub(pl.o, r.o), pl.ez) / V.dot(pl.ez, r.dir); pos = new THREE.Vector3(...r.o).addScaledVector(d, pruchod).addScaledVector(new THREE.Vector3(...pl.ez), sgn); }
        q.setFromUnitVectors(z, smer); mm.compose(pos, q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, mm);
      });
      [it, im].forEach((o) => { o.castShadow = true; o.receiveShadow = true; skupina.add(o); });
    }
    /* stavba: deska / schody betonové, fasáda omítka (ve foto režimu plná, v technickém průhledná jako dosud) */
    A.build.context.forEach((c) => {
      const fas = c.tag === 'fasada', m = pridej(teleso(c.solid), fas ? M.omitka : M.beton, stavba);
      if (fas && ui.dilna) { m.material = new THREE.MeshStandardMaterial({ color: c.color, transparent: true, opacity: c.alpha, depthWrite: false }); m.castShadow = false; }
    });
    let zMin = Infinity; A.build.context.forEach((c) => c.solid.verts.forEach((v) => { zMin = Math.min(zMin, v[2]); }));
    studio.obsahZmenen({ podlahaZ: (isFinite(zMin) ? zMin : 0) - 2500, kontakt: false });
    /* kóty: délky úseků a výška */
    const pts = A.build.pts, k = [];
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], dl = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); k.push({ a: [a[0], a[1], a[2] + cfg.vyska + 120], b: [b[0], b[1], b[2] + cfg.vyska + 120], text: nf(dl) + ' mm' }); }
    k.push({ a: [pts[0][0], pts[0][1], pts[0][2]], b: [pts[0][0], pts[0][1], pts[0][2] + cfg.vyska], text: nf(cfg.vyska) + ' mm' });
    X.koty.nastav(k);
  }
  technicky = () => { studio.nastav({ ao: true }); postav(); };

  /* ---------- panel voleb ---------- */
  const volby = $('volby');
  /* pořadí: nejdřív co to bude (výplň, profil, motiv), pak tvar a rozměry; čísla sekcí zůstávají kvůli zabradli-dyn.js.
     Barva (6) a prostředí (9) nejsou v panelu, ale jako rychlé volby u nadpisu scény. */
  sekce(volby, [[2, 'Výplň a profil'], [3, 'Motiv'], [0, 'Tvar a úseky'], [1, 'Rozměry'], [4, 'Madlo a kotvení'], [5, 'Rozmístění kotev'], [7, 'Služby'], [8, 'Detaily'], [10, 'Kontrola zadání']], ui,
    { vychozi: { 4: true, 5: true, 7: true, 8: true }, zmena: (i, z) => { uloz(); if (!z && A) D.dyn(); } });
  const R = rychle($('rychle'), [{ id: 'prostredi', lab: 'Prostředí', html: '<div id="s9"></div><div id="x9"></div>' }, { id: 'barva', lab: 'Barva', html: '<div id="s6"></div><div id="x6"></div>' }]);
  const nahledy = {}; let pos = {};
  const D = dynPanel({ Zb, ui, cfg: () => cfg, A: () => A, zmen: (...a) => zmen(...a), nahledMotivu: (id) => nahledMotivu(id) });
  const tvarId = () => { const s = JSON.stringify(cfg.segs.map((q) => [q.turn || 0, !!q.rise])); const p = Zb.PRESETS.find((q) => JSON.stringify(q.segs.map((w) => [w.turn || 0, !!w.rise])) === s); return p ? p.id : ''; };
  const vypln = () => (cfg.vypln === 'laser' ? (cfg.rada === 'priroda' ? 'P' : 'L') : cfg.vypln === 'geometricky' ? 'G' : cfg.sloupky ? 'A' : 'B');
  const nahledMotivu = (id) => KOREN + (id === 'strom' ? 'assets/zabradli/motiv-strom/zabradli_motiv_950x950x5_nahled.png' : id === 'bunky' ? 'assets/zabradli/motiv-bunky/zabradli_motiv_bunky_950x950x5_nahled.png' : 'assets/zabradli/priroda/' + id + '_nahled.png');

  function panel() {
    cipy($('s0'), Zb.PRESETS.map((p) => ({ id: p.id, lab: p.lab, svg: p.icon })), tvarId(), (id) => { const p = Zb.PRESETS.find((q) => q.id === id); zmen({ segs: p.segs.map((s) => Object.assign({}, s)), stavba: null, pole: [], kotvyPos: null }, true, true); });
    $('x0').innerHTML = '<div id="dTvar"></div>'; $('x2').innerHTML = '<div id="dProfil"></div>';
    const minV = Zb.minHeight(cfg.hloubka, rates || Zb.rates0());
    $('s1').innerHTML = '<p class="pozn" style="margin:0 0 6px">Kde zábradlí bude</p><div id="pU"></div><p class="pozn" style="margin:12px 0 6px">Hloubka volného prostoru pod zábradlím</p><div id="pH"></div><div id="pV" style="margin-top:12px"></div><p class="pozn">Nejmenší výška pro tuto hloubku je ' + nf(minV) + ' mm (orientační posouzení).</p><div id="pP"></div>';
    cipy($('pU'), Zb.UZITI.map((u) => ({ id: u.id, lab: u.lab, sub: u.sub })), cfg.uziti, (id) => zmen({ uziti: id, kotvyPos: null }, true));
    segment($('pH'), Zb.HLOUBKA.map((h) => ({ id: h.id, lab: h.lab })), cfg.hloubka, (id) => zmen({ hloubka: id, vyska: Math.max(cfg.vyska, Zb.minHeight(id, rates || Zb.rates0())) }, true));
    pos = { vyska: posuvnik($('pV'), { lab: 'Výška zábradlí', min: 900, max: 1300, step: 10, value: cfg.vyska }, (v) => zmen({ vyska: v })) };
    if (cfg.sloupky && cfg.vypln !== 'geometricky') pos.postPitch = posuvnik($('pP'), { lab: 'Rozteč sloupků (nejvýš)', min: cfg.vypln === 'laser' ? Zb.PANEL.postMin : Zb.POST_MIN, max: cfg.vypln === 'laser' ? Zb.PANEL.postMax : Zb.POST_MAX, step: 50, value: cfg.postPitch }, (v) => zmen({ postPitch: v, kotvyPos: null }));
    $('x1').innerHTML = '<p class="pozn">Délky úseků, schodiště a zatáčení nastavíte v kroku Tvar a úseky.</p>';
    cipy($('s2'), [{ id: 'A', lab: 'Špruše', sub: 'se sloupky', svg: Zb.TYPES[0].icon }, { id: 'B', lab: 'Špruše', sub: 'bez sloupků', svg: Zb.TYPES[1].icon }, { id: 'L', lab: 'Motiv', sub: 'stromy, buňky' }, { id: 'P', lab: 'Příroda', sub: 'zvířata, les' }], vypln(), (id) => {
      zmen(id === 'L' ? { vypln: 'laser', rada: 'abstrakt', sloupky: true, motiv: 'strom', pole: [] } : id === 'P' ? { vypln: 'laser', rada: 'priroda', sloupky: true, motiv: 'jelen', pole: [] } : { vypln: 'standard', sloupky: id === 'A' }, true);
    }, { velke: true });
    const laser = cfg.vypln === 'laser', prir = laser && cfg.rada === 'priroda'; $('k3').hidden = !laser;
    $('s3').hidden = prir; $('x3').innerHTML = '<div id="dPole"></div>';
    if (laser) {
      const sklon = cfg.segs.some((s) => s.rise);
      cipy($('s3'), Zb.MOTIFS.filter((m) => (cfg.rada === 'priroda') === (m.rada === 'priroda')).map((m) => ({ id: m.id, lab: m.lab, sub: m.sub, img: nahledMotivu(m.id) })), cfg.motiv, (id) => zmen({ motiv: id, pole: [] }, true), { velke: true });
      $('x3').insertAdjacentHTML('afterbegin', '<div id="pT"></div>');
      $('x3').insertAdjacentHTML('beforeend', '<p class="pozn">Plech se vypálí laserem. Nejužší můstek ' + Zb.PANEL.webTarget + ' mm a otvor do 110 mm hlídá konfigurátor.' + (cfg.rada === 'priroda' ? ' Motiv se volí pro každé pole zvlášť.' : '') + (sklon && cfg.rada === 'priroda' ? ' Na schodiště jde jen Los, Smrkový les a Motýli.' : '') + '</p>');
      const tl = Zb.plechRange([...new Set([cfg.motiv].concat((cfg.pole || []).map((q) => q && q.m).filter(Boolean)))]);
      pos.plech = posuvnik($('pT'), { lab: 'Tloušťka plechu', min: (tl && tl.min) || 3, max: (tl && tl.max) || 6, step: 1, value: cfg.plech }, (v) => zmen({ plech: v }));
    }
    $('s4').innerHTML = '<label class="radek">Dřevěné madlo<input type="checkbox" id="cMadlo"' + (cfg.madlo ? ' checked' : '') + '></label><div id="dKot" style="margin-top:10px"></div>';
    $('cMadlo').addEventListener('change', (e) => zmen({ madlo: e.target.checked }, true));
    const lak = (mat.POVRCHY[cfg.fin] || {}).typ === 'lak';
    cipy($('s6'), Zb.FIN.map((f) => ({ id: f.id, lab: f.lab, sub: f.sub, img: nahledy['fin:' + f.id] })), ui.ral && lak ? '' : cfg.fin, (id) => { ui.ral = null; zmen(Object.assign({ fin: id }, ralDoCfg(7016)), true); });
    $('x6').innerHTML = '<p class="pozn" style="margin:0 0 6px">Umístění</p><div id="umist"></div><p class="pozn" style="margin:12px 0 8px">Odstín práškové barvy (stejná cena):</p><div id="ral"></div><p class="pozn">Žárový zinek má květ a odstín podle šarže – každý kus vypadá trochu jinak. Barva na monitoru je orientační.</p>';
    cipy($('ral'), Object.keys(mat.RAL).map((r) => ({ id: r, lab: 'RAL ' + r, sub: mat.RAL[r][0], img: nahledy['ral:' + r] })), ui.ral && lak ? String(ui.ral) : lak ? '7016' : '', (r) => { ui.ral = Number(r); zmen(Object.assign({ fin: lak ? cfg.fin : 'prasek' }, ralDoCfg(r)), true); });
    segment($('umist'), Zb.UMISTENI.map((u) => ({ id: u.id, lab: u.lab })), cfg.umisteni, (id) => zmen({ umisteni: id }, true));
    $('s8').innerHTML = '<label class="radek">Viditelné svary<input type="checkbox" id="cSvary"' + (ui.svary ? ' checked' : '') + '></label><p class="pozn">Vypnuto = svary zabroušené do roviny.</p>';
    $('cSvary').addEventListener('change', (e) => { ui.svary = e.target.checked; const s = skupina.getObjectByName('svary'); if (s) s.visible = ui.svary || ui.dilna; studio.invalidate(); uloz(); });
    X.kresliProstredi($('s9'), ['zahrada', 'terasa', 'studio', 'teple'], (t, b) => R.popis('prostredi', t, b));
    { const f = Zb.FIN.find((q) => q.id === cfg.fin) || {}, r = mat.RAL[ui.ral || 7016]; R.popis('barva', lak && r ? 'RAL ' + (ui.ral || 7016) + ' ' + r[0] : f.lab || '', lak && r ? r[1] : '#aab0b5'); }
    $('s5').innerHTML = '<div id="dKotvy"></div>'; $('s7').innerHTML = '<div id="dSluzby"></div>'; $('s10').innerHTML = '<div id="dKontrola"></div>';
    X.mojeFotka($('x9'), () => { stavba.visible = false; studio.invalidate(); });
    if (A) D.dyn();
  }
  const stredDilu = (m) => { const b = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]]; m.solid.verts.forEach((v) => { for (let i = 0; i < 3; i++) { b[0][i] = Math.min(b[0][i], v[i]); b[1][i] = Math.max(b[1][i], v[i]); } }); return b[0].map((v, i) => (v + b[1][i]) / 2); };
  function pohledy() {
    const cl = A.lay.members, pn = cl.find((m) => m.kind === 'panel'), sl = cl.find((m) => m.role === 'post') || cl.find((m) => m.role === 'end_post'), ko = cl.find((m) => m.kind === 'plate'), bar = cl.find((m) => m.kind === 'bar');
    const ven = (m) => { const d = A.build.pts[1] ? V.unit(V.sub(A.build.pts[1], A.build.pts[0])) : [1, 0, 0]; const s = cfg.side === 'R' ? -1 : 1; return [d[1] * s, -d[0] * s, 0]; };
    const n = ven(), sm = (k, z) => [n[0] + k * -n[1], n[1] + k * n[0], z];
    const L = [{ id: 'celek', lab: 'Celek' }, { lab: 'Zvenku', detail: () => ({ bod: stredVse(), smer: sm(0, 0.12), vzd: studio.vzdalenostCelku() * 1000 }) }, { lab: 'Zevnitř', detail: () => ({ bod: stredVse(), smer: sm(0, 0.12).map((v, i) => (i < 2 ? -v : v)), vzd: studio.vzdalenostCelku() * 1000 }) }, { id: 'shora', lab: 'Shora' }];
    if (pn) L.push({ lab: 'Detail motivu', detail: () => ({ bod: stredDilu(pn), smer: sm(0.35, 0.1), vzd: 900 }) }, { lab: 'Hrana řezu', detail: () => ({ bod: V.add(stredDilu(pn), [0, 0, pn.l * 0.2]), smer: sm(0.9, 0.2), vzd: 170 }) });
    else if (bar) L.push({ lab: 'Detail špruší', detail: () => ({ bod: [bar.cut1.p[0], bar.cut1.p[1], bar.cut1.p[2] - 40], smer: sm(0.7, 0.25), vzd: 320 }) });
    if (sl) L.push({ lab: 'Detail svaru', detail: () => ({ bod: [sl.cut1.p[0] + sl.p0[0] * (sl.cut1.p[0] ? 0 : 1), sl.cut1.p[1] + sl.p0[1] * (sl.cut1.p[1] ? 0 : 1), sl.cut1.p[2] - 15], smer: sm(0.8, 0.3), vzd: 230 }) });
    if (ko) L.push({ lab: 'Detail kotvy', detail: () => ({ bod: ko.o, smer: sm(0.7, 0.55), vzd: 420 }) });
    X.kresliPohledy(L);
  }
  const stredVse = () => { const c = studio.bounds.getCenter(new THREE.Vector3()); return [c.x * 1000, -c.z * 1000, c.y * 1000]; };

  function cena() {
    $('nazev').textContent = cfg.vypln === 'laser' ? (cfg.rada === 'priroda' ? 'Zábradlí Příroda' : 'Zábradlí s motivem') : 'Zábradlí se špruší';
    $('popis').textContent = nf(A.lenM, 1) + ' m · výška ' + nf(cfg.vyska) + ' mm · ' + nf(A.kg) + ' kg oceli';
    /* souhrn v nadpisu sekce – je vidět i po srolování */
    const lm = (id) => (Zb.MOTIFS.find((m) => m.id === id) || { lab: 'Motýl' }).lab, pr = cfg.vypln === 'laser' && cfg.rada === 'priroda';
    const mp = pr ? [...new Set(Zb.fieldsOf(cfg).slice(0, (A.lay.panels || []).length).map((f) => f.m))] : [cfg.motiv];
    const tv = Zb.PRESETS.find((p) => p.id === tvarId()), kot = Zb.ANCHOR.find((q) => q.id === cfg.anchor), sl = Zb.SERVICES.filter((s) => cfg.services && cfg.services[s.id]).length, wn = (A.warns || []).length;
    const sh = { 2: { A: 'Špruše se sloupky', B: 'Špruše bez sloupků', L: 'Motiv', P: 'Příroda', G: 'Geometrický' }[vypln()], 3: mp.length === 1 ? lm(mp[0]) : 'různé v polích', 0: tv ? tv.lab : 'Vlastní tvar',
      1: nf(A.lenM, 1) + ' m · výška ' + nf(cfg.vyska) + ' mm', 4: (kot ? kot.lab : '') + (cfg.madlo ? ' · dřevěné madlo' : ''), 5: A.lay.anch && cfg.anchor !== 'bez' ? 'kotvy: ' + A.lay.anch.used.length : '',
      7: sl ? 'vybráno ' + sl : 'bez služeb', 8: ui.svary ? 'svary viditelné' : 'svary zabroušené', 10: wn ? 'připomínek: ' + wn : 'v pořádku' };
    Object.keys(sh).forEach((i) => { $('h' + i).textContent = sh[i] || ''; });
    $('cena').textContent = nf(A.total) + ' Kč';
    $('cenaPod').textContent = 'orientačně s DPH · ' + nf(Math.round(A.total / A.lenM / 10) * 10) + ' Kč / m · ' + nf(A.kg) + ' kg';
    /* výrobní pravda: co dílna nevyrobí, to se nesmí tvářit jako hotové */
    const chyby = (A.problems || []).map((p) => (typeof p === 'string' ? p : p.t || p.text || '')).filter(Boolean);
    const pole = (A.lay.panels || []).filter((p) => p && p.ok === false);
    const v = $('varovani'), txt = chyby[0] || (pole.length ? 'V ' + pole.length + '. poli nejde plech s tímto motivem vyrobit – zvolte jiný motiv nebo rozměr.' : '');
    v.hidden = !txt; v.textContent = txt;
  }

  let cekam = 0, poprve = true, chciCelek = false, chciPanel = false;
  async function prekresliVse(panelTez, prizpusob) {
    panelTez = panelTez || chciPanel; prizpusob = prizpusob || chciCelek; chciPanel = chciCelek = false;
    const chybi = potrebneMotivy();
    if (chybi.length) { $('stav').classList.remove('ok'); $('stav').textContent = 'Stahuji motiv…'; try { await Promise.all(chybi.map((id) => nactiSkript('assets/zabradli/motiv-' + id + '.js'))); } catch (e) { $('stav').textContent = 'Motiv se nepodařilo stáhnout.'; return; } }
    postav(); cena(); pohledy(); if (panelTez) panel(); else D.dyn();
    if (prizpusob || poprve) { studio.pohled('celek', poprve ? 0 : 600); poprve = false; }
  }
  prekresli = () => { cancelAnimationFrame(cekam); cekam = requestAnimationFrame(() => prekresliVse(false, false)); };
  function zmen(p, panelTez, prizpusob) {
    const pred = [cfg.fin, M.ocel.userData.povrch[1]];
    if (('segs' in p || 'sloupky' in p) && !('kotvyPos' in p)) { p = Object.assign({ kotvyPos: null }, p); ui.ksel = null; }
    cfg = Zb.normalize(Object.assign({}, cfg, p));
    if (cfg.fin !== pred[0] || ui.ral !== pred[1]) { mat.prelad([M.ocel, M.kotva], cfg.fin, ui.ral); const h = mat.hrana(cfg.fin, ui.ral), s = mat.svar(cfg.fin, ui.ral); M.hrana.copy(h); M.svar.copy(s); h.dispose(); s.dispose(); }
    chciPanel = chciPanel || !!panelTez; chciCelek = chciCelek || !!prizpusob;
    cancelAnimationFrame(cekam); cekam = requestAnimationFrame(() => prekresliVse());
    if (!panelTez) Object.keys(pos).forEach((k) => { if (cfg[k] != null) pos[k].set(cfg[k]); });
    uloz();
  }
  function udelejNahledy() {
    Zb.FIN.forEach((f) => { const m = mat.kov(f.id); nahledy['fin:' + f.id] = mat.nahled(m); m.dispose(); });
    Object.keys(mat.RAL).forEach((r) => { const m = mat.kov('prasek', r); nahledy['ral:' + r] = mat.nahled(m); m.dispose(); });
    panel();
  }

  cenik('nastaveni/cenik-zabradli', (d) => { rates = Zb.rates0(d); if (A) { A = Zb.analyze(cfg, rates); cena(); panel(); } });
  panel();
  studio.prostredi(ui.prostredi).then(() => prekresliVse(true, true)).then(() => {
    udelejNahledy(); studio.na('obnova', udelejNahledy);
    if (ui.dilna) $('tDilna').setAttribute('aria-pressed', 'true');
    window.__foto = { studio, cfg: () => cfg, zmen, hotovo: true, A: () => A };
  }).catch((e) => { console.error(e); $('stav').textContent = 'Nepodařilo se načíst podklady.'; });
}
