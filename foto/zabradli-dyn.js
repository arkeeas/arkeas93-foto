/* Foto zábradlí: dynamické části panelu přenesené ze starého konfigurátoru (zabradli.html).
 * Úseky a zatočení, „Podle stavby“ (měření po blocích), motiv Příroda po polích, typy kotvení a jejich rozmístění
 * (táhnutelné kotvy v rozvinutém pásu), konce ke zdi, služby a kontrola. Čísla počítá jádro `zabradli-core.js`;
 * tady se jen skládá ovládání. Vše se překresluje po každé změně (`dyn()`), zaostření na políčku se zachová. */
import { $, esc, nf, cipy, segment } from './render/ui.js';

export function dynPanel(ctx) {
  const { Zb, ui } = ctx;
  const cfg = () => ctx.cfg(), A = () => ctx.A(), zmen = (p, a, b) => ctx.zmen(p, a, b);

  /* ---------- zatočení: předvolby + vlastní úhel (vnitřní úhel rohu 60–179°) ---------- */
  const turnSel = (t, custom, last) => last ? '<option>konec</option>' :
    Zb.TURNS.map((x) => '<option value="' + x.v + '"' + (!custom && x.v === t ? ' selected' : '') + '>' + (x.v ? 'zatáčí ' + x.lab : 'rovně') + '</option>').join('') +
    '<option value="cL"' + (custom && t > 0 ? ' selected' : '') + '>vlevo – vlastní úhel</option><option value="cR"' + (custom && t < 0 ? ' selected' : '') + '>vpravo – vlastní úhel</option>';
  const inner = (t) => 180 - Math.abs(t);
  const turnFrom = (v, prev) => (v === 'cL' || v === 'cR') ? { turn: (v === 'cL' ? 1 : -1) * (Math.abs(prev.turn) || 90), custom: true } : { turn: Number(v), custom: false };
  const kopie = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- 1. tvar: rychle × podle stavby, úseky ---------- */
  function tvar() {
    const c = cfg(), stOn = !!(c.stavba && c.stavba.on), el = $('dTvar');
    el.innerHTML = '<div id="dMod"></div><div id="dSegs"></div><div id="dStav"></div><div class="radek-btn"><button type="button" class="tl" id="dAddSeg">+ Přidat úsek</button><div id="dSide" style="flex:1;min-width:190px"></div></div>';
    segment($('dMod'), [{ id: 'q', lab: 'Rychle' }, { id: 's', lab: 'Podle stavby' }], stOn ? 's' : 'q', (id) => {
      const on = id === 's', st = c.stavba ? Object.assign({}, c.stavba, { on }) : (on ? stDefault() : null);
      zmen({ stavba: st, kotvyPos: null }, true);
    });
    segment($('dSide'), [{ id: 'L', lab: 'Stavba vlevo' }, { id: 'R', lab: 'Stavba vpravo' }], c.side, (id) => zmen({ side: id }));
    $('dAddSeg').hidden = stOn;
    if (stOn) { $('dSegs').hidden = true; stavba(); return; }
    $('dStav').hidden = true;
    $('dSegs').innerHTML = '<p class="pozn" style="margin:0 0 8px">Úseky za sebou. Délka je vodorovná (v půdorysu), u schodiště zadejte i převýšení.</p>' + c.segs.map((s, i) => '<div class="usek"><span class="no">' + (i + 1) + '</span><div class="pole2">' +
      '<label>Délka [mm]<input id="sL' + i + '" data-i="' + i + '" data-k="L" type="number" inputmode="numeric" value="' + s.L + '"></label>' +
      '<label>Převýšení [mm]<input id="sR' + i + '" data-i="' + i + '" data-k="rise" type="number" inputmode="numeric" value="' + s.rise + '"></label>' +
      (s.rise ? '<label>Schodů<input id="sN' + i + '" data-i="' + i + '" data-k="steps" type="number" inputmode="numeric" min="2" max="40" placeholder="?" value="' + (s.steps || '') + '"' + (!s.steps && (c.anchor === 'patka' || c.anchor === 'celo') ? ' class="miss"' : '') + '></label>' : '') +
      '<label>Na konci<select id="sT' + i + '" data-i="' + i + '" data-k="turn"' + (i === c.segs.length - 1 ? ' disabled' : '') + '>' + turnSel(s.turn, s.custom, i === c.segs.length - 1) + '</select></label>' +
      (s.custom ? '<label>Úhel rohu [°]<input id="sA' + i + '" data-i="' + i + '" data-k="ang" type="number" min="60" max="179" step="0.5" value="' + inner(s.turn) + '"></label>' : '') +
      '</div><button type="button" class="del" data-del="' + i + '" aria-label="Odebrat úsek ' + (i + 1) + '"' + (c.segs.length < 2 ? ' disabled' : '') + '>×</button></div>').join('');
    $('dSegs').hidden = false;
    $('dSegs').querySelectorAll('input,select').forEach((x) => x.addEventListener('change', () => {
      const segs = cfg().segs.map((s) => Object.assign({}, s)), i = Number(x.dataset.i);
      if (x.dataset.k === 'turn') Object.assign(segs[i], turnFrom(x.value, segs[i]));
      else if (x.dataset.k === 'ang') segs[i].turn = Math.sign(segs[i].turn || 1) * (180 - Math.min(179, Math.max(60, Number(x.value) || 90)));
      else if (x.dataset.k === 'steps') { if (x.value.trim() === '') delete segs[i].steps; else segs[i].steps = Number(x.value); }
      else segs[i][x.dataset.k] = Number(x.value);
      zmen({ segs, kotvyPos: null }, true, true);
    }));
    $('dSegs').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { const segs = cfg().segs.slice(); segs.splice(Number(b.dataset.del), 1); zmen({ segs, kotvyPos: null }, true, true); }));
    $('dAddSeg').onclick = () => { const segs = cfg().segs.map((s) => Object.assign({}, s)); if (segs.length >= 8) return; segs[segs.length - 1].turn = 90; segs.push({ L: 2000, rise: 0, turn: 0 }); zmen({ segs, kotvyPos: null }, true, true); };
  }

  /* ---------- „Podle stavby“: měření po blocích, každá míra dvakrát jinou cestou ---------- */
  const HOW = {
    A: 'Svinovacím metrem po čele desky (hraně balkonu / podesty) tam, kde povede zábradlí – od rohu k rohu. U zdi měřte až ke zdi, mezeru 20 mm odečteme sami.',
    B: 'Stejnou hranu změřte ještě jednou, metr ale přiložte z druhého konce. Chytí to přehlédnutí na metru (např. 3 480 místo 3 840). Má vyjít stejně ±1 cm.',
    U: 'Vnitřní úhel rohu ve stupních (pravý roh = 90°, tupý např. 120°). Když úhel neznáte, nechte 90 a změřte úhlopříčku C – úhel z ní spočítáme.',
    C: 'Od rohu odměřte po každé hraně 1 m a udělejte značku. Změřte vzdálenost mezi značkami. U pravého rohu vyjde 1 414 mm, u rohu 45° 1 848 mm.',
    n: 'Spočítejte schody – kolikrát vystoupíte, než stojíte na podestě (počítá se i poslední krok na podestu).',
    h: 'Svisle od horní plochy jednoho schodu k horní ploše dalšího. Změřte u 3 schodů a zadejte průměr.',
    g: 'Vodorovně od hrany (nosu) jednoho schodu k hraně dalšího.',
    H: 'Celé převýšení od spodní podlahy po podestu, svisle – nejlépe s vodováhou nebo laserem. Kontrola počtu schodů: má vyjít n × h.',
    D: 'Vodorovně od hrany prvního schodu k hraně podesty. Nepovinné – zpřesní délku zábradlí.',
    deska: 'Tloušťka betonové desky na čele, bez zateplení. Najdete ji u okapnice, v ostění dveří nebo ve výkresu domu. Kotva potřebuje aspoň 150 mm betonu.'
  };
  const LAB = { U: 'Úhel rohu (vnitřní, °)', C: 'Úhlopříčka mezi značkami 1 m od rohu', A: 'Délka hrany', B: 'Kontrolní délka (z druhého konce)', n: 'Počet schodů', h: 'Výška schodu', g: 'Hloubka schodu', H: 'Celé převýšení', D: 'Vodorovná délka schodiště', deska: 'Tloušťka nosné desky' };
  const OPT = { H: 'doporučeno', D: 'nepovinné' };
  function stDefault() {
    return { on: true, start: 'volny', end: 'volny', deska: null,
      bloky: cfg().segs.map((sg) => (sg.rise ? { t: 'schody', n: null, h: null, g: null, H: null, D: null, dir: sg.rise < 0 ? 'dolu' : 'nahoru', turn: sg.turn } : { t: 'hrana', A: null, B: null, C: null, turn: sg.turn })) };
  }
  const stSet = (fn) => { const st = kopie(cfg().stavba); fn(st); zmen({ stavba: st, kotvyPos: null }, true); };
  const mrow = (id, k, v, extra) => '<div class="mrow"><span><b class="k">' + k + '</b> ' + LAB[k] + (OPT[k] ? ' <i>(' + OPT[k] + ')</i>' : '') + '</span>' +
    '<input id="' + id + '" type="number" inputmode="numeric" placeholder="' + (k === 'n' ? 'ks' : 'mm') + '" value="' + (v == null ? '' : v) + '" ' + extra + '>' +
    '<button type="button" class="help" data-how="' + id + '" data-k="' + k + '" aria-label="Jak měřit: ' + esc(LAB[k]) + '">?</button></div><div class="howto" id="how-' + id + '" hidden></div>';

  function stavba() {
    const c = cfg(), a = A(), st = c.stavba, bl = st.bloky, ms = a.meas || { missing: [], remeasure: [] }, el = $('dStav');
    el.hidden = false;
    let h = '<p class="pozn" style="margin:0 0 8px">Poskládejte, jak to u vás vypadá – od začátku zábradlí po konec. U každé míry je <b>?</b> s návodem. Každou míru chceme dvakrát jinou cestou, aby se chyba chytila hned teď.</p>' +
      '<div class="mrow"><span>Začátek zábradlí</span><select id="stStart"><option value="volny">volný konec</option><option value="zed">u zdi (−20 mm)</option></select><span></span></div>';
    h += bl.map((b, i) => {
      let x = '<div class="blk"><div class="blk-h"><span>' + (i + 1) + ' · ' + (b.t === 'schody' ? 'Schodiště' : 'Rovná hrana (balkon, podesta)') + '</span><button type="button" class="del" data-stdel="' + i + '" aria-label="Odebrat blok"' + (bl.length < 2 ? ' disabled' : '') + '>×</button></div>';
      if (b.t === 'hrana') x += mrow('st' + i + 'A', 'A', b.A, 'data-b="' + i + '" data-k="A"') + mrow('st' + i + 'B', 'B', b.B, 'data-b="' + i + '" data-k="B"');
      else {
        x += '<div class="mrow"><span>Schody od začátku vedou</span><select data-b="' + i + '" data-k="dir"><option value="nahoru"' + (b.dir !== 'dolu' ? ' selected' : '') + '>nahoru</option><option value="dolu"' + (b.dir === 'dolu' ? ' selected' : '') + '>dolů</option></select><span></span></div>';
        ['n', 'h', 'g', 'H', 'D'].forEach((k) => { x += mrow('st' + i + k, k, b[k], 'data-b="' + i + '" data-k="' + k + '"'); });
      }
      x += '</div>';
      if (i < bl.length - 1) {
        const cc = b.turn && b.t === 'hrana' && bl[i + 1].t === 'hrana';
        x += '<div class="blk koutek"><label class="mrow"><span>Potom zábradlí</span><select data-b="' + i + '" data-k="turn">' + turnSel(b.turn, b.custom, false) + '</select><span></span></label>' +
          (b.custom ? mrow('st' + i + 'U', 'U', inner(b.turn), 'data-b="' + i + '" data-k="ang" min="60" max="179" step="0.5"') : '') +
          (cc ? mrow('st' + i + 'C', 'C', b.C, 'data-b="' + i + '" data-k="C"') + '<div id="stApply' + i + '"></div>' : '') + '</div>';
      }
      return x;
    }).join('');
    h += '<div class="radek-btn"><button type="button" class="tl" id="stAddH">+ Rovná hrana</button><button type="button" class="tl" id="stAddS">+ Schodiště</button></div>' +
      '<div class="mrow"><span>Konec zábradlí</span><select id="stEnd"><option value="volny">volný konec</option><option value="zed">u zdi (−20 mm)</option></select><span></span></div>' +
      (c.anchor === 'bocni' || c.anchor === 'celo' ? mrow('stDeska', 'deska', st.deska, 'data-k="deska"') : '') +
      '<p class="pozn">Půdorys – takhle to chápeme (pohled shora, šedě stavba)</p><div class="plan" id="stPlan"></div><div id="stList"></div>';
    el.innerHTML = h;
    $('stStart').value = st.start; $('stEnd').value = st.end;
    ['start', 'end'].forEach((k) => $(k === 'start' ? 'stStart' : 'stEnd').addEventListener('change', (e) => {
      const s2 = kopie(cfg().stavba); s2[k] = e.target.value;
      zmen({ stavba: s2, zed: Object.assign({}, cfg().zed, { [k]: e.target.value === 'zed' }), kotvyPos: null }, true);
    }));
    el.querySelectorAll('[data-k]').forEach((x) => { if (x.tagName === 'BUTTON') return; x.addEventListener('change', () => stSet((s2) => {
      const v = x.value === '' ? null : (x.dataset.k === 'dir' ? x.value : Number(x.value)), bb = x.dataset.b == null ? null : s2.bloky[Number(x.dataset.b)];
      if (!bb) s2[x.dataset.k] = v;
      else if (x.dataset.k === 'turn') Object.assign(bb, turnFrom(x.value, bb));
      else if (x.dataset.k === 'ang') bb.turn = Math.sign(bb.turn || 1) * (180 - Math.min(179, Math.max(60, v || 90)));
      else bb[x.dataset.k] = v;
    })); });
    el.querySelectorAll('[data-how]').forEach((b) => b.addEventListener('click', () => { const w = $('how-' + b.dataset.how); w.hidden = !w.hidden; if (!w.hidden) w.textContent = HOW[b.dataset.k]; }));
    el.querySelectorAll('[data-stdel]').forEach((b) => b.addEventListener('click', () => stSet((s2) => { s2.bloky.splice(Number(b.dataset.stdel), 1); s2.bloky[s2.bloky.length - 1].turn = 0; })));
    $('stAddH').addEventListener('click', () => stSet((s2) => { const p = s2.bloky[s2.bloky.length - 1]; p.turn = p.turn || 90; s2.bloky.push({ t: 'hrana', A: null, B: null, C: null, turn: 0 }); }));
    $('stAddS').addEventListener('click', () => stSet((s2) => { s2.bloky.push({ t: 'schody', n: null, h: null, g: null, H: null, D: null, dir: 'nahoru', turn: 0 }); }));
    const missId = (m) => (m.i < 0 ? 'stDeska' : 'st' + m.i + m.k), miss = new Set(ms.missing.map(missId)), chk = new Set(ms.remeasure.filter((m) => m.lvl !== 'info').map(missId));
    el.querySelectorAll('input[id^="st"]').forEach((x) => { x.classList.toggle('miss', miss.has(x.id)); x.classList.toggle('chk', chk.has(x.id)); });
    const items = ms.missing.map((m) => ['bad', 'Změřte: ' + m.t, missId(m)]).concat(ms.remeasure.map((m) => [m.lvl === 'info' ? 'info' : m.lvl || 'warn', m.t, missId(m)]));
    $('stList').innerHTML = items.length ? items.map((it) => '<button type="button" class="vykaz w-' + it[0] + '" data-go="' + it[2] + '">' + esc(it[1]) + '</button>').join('')
      : '<p class="pozn ok"><b>Vše změřeno a sedí.</b> I tak doporučujeme zaměření – rozměry před výrobou potvrdíme.</p>';
    $('stList').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { const x = $(b.dataset.go); if (x) { x.scrollIntoView({ block: 'center', behavior: 'smooth' }); x.focus(); } }));
    bl.forEach((b, i) => {
      const w = $('stApply' + i); if (!w) return;
      const m = ms.remeasure.find((r) => r.i === i && r.k === 'C' && r.ang);
      w.innerHTML = m ? '<button type="button" class="tl" data-apply="' + i + '">Převzít změřený úhel ' + nf(m.ang, 1) + '°</button>' : '';
      if (m) w.querySelector('button').addEventListener('click', () => stSet((s2) => { const x = s2.bloky[i]; x.turn = Math.sign(x.turn || 1) * (180 - m.ang); x.custom = true; }));
    });
    plan();
  }
  function plan() {
    const c = cfg(), a = A(), P = a.build.pts.map((p) => [p[0], p[1]]), side = c.side === 'R' ? -1 : 1;
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), pad = 900;
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    const W = 600, sc = Math.min(W / (x1 - x0), 260 / (y1 - y0)), Hh = Math.round((y1 - y0) * sc);
    const T = (p) => [((p[0] - x0) * sc).toFixed(1), (Hh - (p[1] - y0) * sc).toFixed(1)];
    let g = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Půdorys zábradlí">';
    for (let i = 0; i < P.length - 1; i++) {
      const q0 = P[i], q1 = P[i + 1], dx = q1[0] - q0[0], dy = q1[1] - q0[1], l = Math.hypot(dx, dy) || 1, wx = -dy / l * side, wy = dx / l * side, o = 700;
      g += '<polygon points="' + [q0, q1, [q1[0] + wx * o, q1[1] + wy * o], [q0[0] + wx * o, q0[1] + wy * o]].map(T).map((t) => t.join(',')).join(' ') + '" fill="var(--line-soft)"></polygon>';
      const m = T([(q0[0] + q1[0]) / 2 - wx * 260, (q0[1] + q1[1]) / 2 - wy * 260]), sg = c.segs[i];
      g += '<text x="' + m[0] + '" y="' + m[1] + '" text-anchor="middle">' + (i + 1) + (sg.rise ? (sg.rise > 0 ? ' ↗ schody' : ' ↘ schody') : '') + ' · ' + nf(Math.round(sg.L)) + '</text>';
    }
    g += '<polyline points="' + P.map(T).map((t) => t.join(',')).join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linejoin="round"></polyline>';
    const s0 = T(P[0]); g += '<circle cx="' + s0[0] + '" cy="' + s0[1] + '" r="6" fill="var(--ink)"></circle><text x="' + (Number(s0[0]) + 8) + '" y="' + (Number(s0[1]) - 8) + '">začátek</text></svg>';
    $('stPlan').innerHTML = g;
  }

  /* ---------- 2. Příroda: motiv po polích (každé pole jiný styl) a posun výřezu ---------- */
  const MOTYL = ['motyl-a', 'motyl-b', 'motyl'], jeMotyl = (id) => MOTYL.indexOf(id) >= 0, MOT = () => window.ZabradliMotivy || {}, thumbs = {};
  function thumb(key, mirror) {
    const ck = key + (mirror ? '|z' : ''); if (thumbs[ck]) return thumbs[ck];
    const V = MOT()[key], t = V.slope ? Math.tan(V.slope * Math.PI / 180) : 0, W = 320, k = W / V.W, H = Math.round((V.H + t * V.W) * k), cv = document.createElement('canvas');
    cv.width = W; cv.height = H; const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.fillStyle = '#3a3d40'; g.beginPath();
    [[0, 0], [V.W, 0], [V.W, V.H], [0, V.H]].forEach((q, i) => { const x = (mirror ? V.W - q[0] : q[0]) * k, y = H - (q[1] + t * q[0]) * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill();
    g.fillStyle = '#eef0f2';
    V.holes.forEach((f) => { g.beginPath(); for (let i = 0; i < f.length; i += 3) { const x = (mirror ? V.W - f[i] : f[i]) * k, y = H - (f[i + 1] + t * f[i]) * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill(); });
    return (thumbs[ck] = cv);
  }
  function kresliPole(cv, id, info, p) {
    const c = info && info.crop, key = c && c.variant ? c.variant : id, V = MOT()[key]; if (!V) return;
    const mirror = !!(c && c.mirror), src = thumb(key, mirror), k = src.width / V.W, g = cv.getContext('2d');
    cv.width = src.width; cv.height = src.height; g.drawImage(src, 0, 0);
    if (!c || !c.win) return;
    const VA = mirror ? { W: V.W, anim: (V.anim || []).map((q) => [V.W - q[1], V.W - q[0], q[2]]) } : V, offs = Zb.cropOffsets(VA, Math.min(c.win, V.W)); if (!offs.length) return;
    const t = V.slope ? Math.tan(V.slope * Math.PI / 180) : 0, off = offs[Math.round(p * (offs.length - 1))], hh = Math.min(V.H, (info.h - 2 * Zb.PANEL.border * Math.hypot(1, t)) / c.s);
    const base = (x) => t * (mirror ? V.W - x : x), pt = (x, w) => [x * k, src.height - (base(x) + w) * k], poly = [pt(off, 0), pt(off + c.win, 0), pt(off + c.win, hh), pt(off, hh)];
    g.fillStyle = 'rgba(255,255,255,.72)'; g.beginPath(); g.rect(0, 0, src.width, src.height);
    poly.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill('evenodd');
    g.strokeStyle = '#c0392b'; g.lineWidth = 2; g.beginPath(); poly.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.stroke();
  }
  const WHY = { slope: 'Sklon tohoto pole je mimo rozsah motivů Příroda.', loading: 'Načítám motiv pro schodiště…', nostairs: 'Tento motiv je jen na rovinu – na schodiště vyberte Los nebo Smrkový les.', steep: 'Na schodišti s tímto sklonem se hlavní zvíře do pole celé nevejde – vyberte jiný motiv.', small: 'Pole je na plech moc malé.', wide: 'Pole je širší než scéna – zmenšete rozteč sloupků.', animal: 'Hlavní zvíře se do tohoto pole nevejde celé – vyberte jiný motiv nebo zvětšete rozteč sloupků.' };
  function pole() {
    const c = cfg(), a = A(), prir = c.vypln === 'laser' && c.rada === 'priroda', el = $('dPole');
    $('k3').hidden = !(c.vypln === 'laser'); if (!prir) { el.innerHTML = ''; return; }
    const pn = (a.lay && a.lay.panels) || [], ids = Zb.prirodaIds().filter((id) => !jeMotyl(id)), fl = Zb.fieldsOf(c).slice(0, pn.length);
    const NA_ROVINU = { jelen: 1, medved: 1, kachny: 1 }, mot = (id) => Object.assign({}, Zb.MOTIFS.find((m) => m.id === id), { schody: !NA_ROVINU[id] }), used = [...new Set(fl.map((f) => f.m))];
    const chip = (id, f) => { const m = mot(id), no = !!(f && f.slope) && m.schody === false; return { id, lab: m.lab, sub: no ? 'jen na rovinu' : '', img: ctx.nahledMotivu(id), dis: no && !(f && fl[pn.indexOf(f)].m === id) }; };
    const chipM = (akt) => ({ id: 'motyl', lab: 'Motýl', sub: 'varianta ' + (akt && jeMotyl(akt) ? 'ABC'[MOTYL.indexOf(akt)] : 'C'), img: ctx.nahledMotivu('motyl') });
    const varianty = (akt, pole) => '<div class="varianty" role="group" aria-label="Varianta motýla">' + MOTYL.map((id, i) => '<button type="button" data-var="' + id + '"' + (pole == null ? ' data-vse="1"' : ' data-pole="' + pole + '"') + ' aria-pressed="' + (akt === id) + '" title="Motýl ' + 'ABC'[i] + '">' + 'ABC'[i] + '</button>').join('') + '</div>';
    if (ui.poleOt != null && ui.poleOt >= pn.length) ui.poleOt = null;
    const ot = ui.poleOt;                                              // otevřené pole; ostatní jsou srolovaná na jeden řádek
    el.innerHTML = '<p class="pozn" style="margin:0 0 6px">Stejný motiv do všech polí</p><div id="prAll"></div><div id="prAllV"></div>' +
      '<p class="pozn" style="margin:14px 0 4px">Motiv v jednotlivých polích – u každého okna jiný styl</p><p class="pozn" style="margin:0 0 8px">Klepnutím pole rozbalíte. Posuvníkem posunete, která část scény bude v poli vidět. Hlavní zvíře zůstane vždy celé.</p>' +
      pn.map((f, i) => '<div class="pole-box' + (ot === i ? '' : ' sbalene') + '"><button type="button" class="pole-h" data-po="' + i + '" aria-expanded="' + (ot === i) + '"><strong>Pole ' + f.field + ' · ' + esc(jeMotyl(fl[i].m) ? 'Motýl ' + 'ABC'[MOTYL.indexOf(fl[i].m)] : mot(fl[i].m).lab || '') + '</strong><span>' + (f.slope ? 'schodiště ' + nf(f.slope, 1) + '° · ' : '') + 'plech ' + nf(f.w) + ' × ' + nf(f.h) + ' mm</span></button>' +
        (ot !== i ? '' : '<div id="pm' + i + '"></div><div id="pv' + i + '"></div>' +
        '<canvas class="nahled-pole" data-cv="' + i + '" aria-label="Náhled výřezu scény v poli ' + f.field + '"></canvas>' +
        (f.ok && f.crop && f.crop.n > 1 ? '<input type="range" data-pp="' + i + '" min="0" max="1000" step="1" value="' + Math.round(fl[i].p * 1000) + '" aria-label="Posun výřezu v poli ' + f.field + '" style="width:100%">' : f.ok ? '<p class="pozn" style="margin:4px 0 0">Poloha je daná – hlavní zvíře se do pole vejde jen takhle.</p>' : '')) +
        (!f.ok ? '<p class="pozn chyba">' + esc((f.steep ? WHY.steep : WHY[f.why]) || 'Pole nejde osadit.') + '</p>' : '') + '</div>').join('');
    const nastavVse = (id) => zmen({ motiv: id, pole: pn.map(() => ({ m: id, p: 0.5 })) }, true);
    cipy($('prAll'), [...ids.map((id) => chip(id)), chipM(used.length === 1 ? used[0] : null)], used.length === 1 ? (jeMotyl(used[0]) ? 'motyl' : used[0]) : '', (id) => nastavVse(id === 'motyl' ? 'motyl' : id));
    $('prAllV').innerHTML = varianty(used.length === 1 && jeMotyl(used[0]) ? used[0] : null, null);
    const setPole = (i, ch) => { const np = Zb.fieldsOf(cfg()).slice(0, pn.length).map((x) => Object.assign({}, x)); Object.assign(np[i], ch); zmen({ pole: np }, true); };
    el.querySelectorAll('[data-po]').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.po); ui.poleOt = ui.poleOt === i ? null : i; pole(); }));
    pn.forEach((f, i) => {
      if (i !== ot) return;
      cipy($('pm' + i), [...ids.map((id) => chip(id, f)), chipM(fl[i].m)], jeMotyl(fl[i].m) ? 'motyl' : fl[i].m, (id) => setPole(i, { m: id, p: 0.5 }));
      $('pv' + i).innerHTML = varianty(jeMotyl(fl[i].m) ? fl[i].m : null, i);
      kresliPole(el.querySelector('[data-cv="' + i + '"]'), fl[i].m, f, fl[i].p);
    });
    el.querySelectorAll('[data-var]').forEach((b) => b.addEventListener('click', () => b.dataset.vse ? nastavVse(b.dataset.var) : setPole(Number(b.dataset.pole), { m: b.dataset.var, p: 0.5 })));
    el.querySelectorAll('[data-pp]').forEach((r) => { const i = Number(r.dataset.pp);
      r.addEventListener('input', () => kresliPole(el.querySelector('[data-cv="' + i + '"]'), fl[i].m, pn[i], Number(r.value) / 1000));
      r.addEventListener('change', () => setPole(i, { p: Number(r.value) / 1000 })); });
  }

  /* ---------- 3. kotvení: typ, do čeho, konce ke zdi, plotny, fasáda, rozmístění kotev ---------- */
  function kotveni() {
    const c = cfg(), a = A(), el = $('dKot'), geo = c.vypln === 'geometricky', pOK = Zb.patkaAllowed(c), stairs = c.segs.some((s) => s.rise), bez = c.anchor === 'bez';
    el.innerHTML = '<div id="kA"></div><div id="kB"></div><div id="kZ"></div><div id="kZB"></div><div id="kP"></div><div id="kAr"></div><p class="pozn" id="kNote1"></p>';
    if (geo) { $('kNote1').textContent = 'Každý motiv má kotvicí plech 60×80×6 mm se dvěma otvory Ø11 mm. Poloha plechů sleduje délku a sklon trasy.'; $('dKotvy').hidden = true; return; }
    cipy($('kA'), Zb.ANCHOR.map((q) => { const dis = (q.id === 'patka' || q.id === 'celo') && !pOK; return { id: q.id, lab: q.lab, sub: q.sub, dis, title: dis ? 'Kotví se pod sloupky – zapněte sloupky. Bez sloupků se kotví z boku.' : '' }; }), c.anchor, (id) => zmen({ anchor: id, kotvyPos: null }, true));
    if (!bez) {
      $('kB').innerHTML = '<p class="pozn" style="margin:12px 0 6px">Do čeho se kotví</p><div id="kBc"></div>';
      cipy($('kBc'), Zb.BASE.map((q) => ({ id: q.id, lab: q.lab, sub: q.sub })), c.base, (id) => zmen({ base: id }, true));
      const stOn = !!(c.stavba && c.stavba.on), endOK = (k) => !stOn || c.stavba[k] === 'zed';
      $('kZ').innerHTML = '<p class="pozn" style="margin:12px 0 6px">Konec u zdi – přikotvit ke zdi plotnami na koncovém sloupku</p><div id="kZc"></div>';
      cipy($('kZc'), [{ id: 'start', l: 'Začátek ke zdi' }, { id: 'end', l: 'Konec ke zdi' }].map((o) => ({ id: o.id, lab: o.l, sub: c.zed[o.id] ? '2 plotny 120×100' : 'konec volně', dis: !endOK(o.id), title: !endOK(o.id) ? 'Ve stavbě je tento konec volný – nastavte ho na „u zdi“.' : '' })), '', (id) => zmen({ zed: Object.assign({}, cfg().zed, { [id]: !cfg().zed[id] }), kotvyPos: null }, true));
      $('kZc').querySelectorAll('.cip').forEach((b) => b.setAttribute('aria-pressed', String(!!c.zed[b.dataset.id])));
      if (c.zed.start || c.zed.end) { $('kZB').innerHTML = '<div id="kZBc" style="margin-top:8px"></div>'; cipy($('kZBc'), Zb.WALL_BASE.map((q) => ({ id: q.id, lab: q.lab, sub: q.sub })), c.zedBase, (id) => zmen({ zedBase: id }, true)); }
      if (Zb.padAllowed(c)) { $('kP').innerHTML = '<p class="pozn" style="margin:12px 0 6px">Plotny na čele a na zdi</p><div id="kPc"></div>'; cipy($('kPc'), [{ id: 'n', lab: 'Plotna přímo na stavbu', sub: 'bez podložky' }, { id: 'y', lab: 'S podložkou', sub: Zb.PAD_T + ' mm · omezí tepelný most' }], c.podlozka ? 'y' : 'n', (id) => zmen({ podlozka: id === 'y' }, true)); }
      if (c.anchor === 'bocni') {
        $('kAr').innerHTML = '<div class="pole2" style="margin-top:12px"><label>Tloušťka fasády [mm]<input id="fac" type="number" inputmode="numeric" value="' + c.facade + '"></label><label>Délka kotevního ramene [mm]<input id="arm" type="number" inputmode="numeric" value="' + c.arm + '"></label></div>';
        $('fac').addEventListener('change', (e) => { const f = Number(e.target.value) || 0; zmen({ facade: f, arm: Math.max(cfg().arm, f + 50) }, true); });
        $('arm').addEventListener('change', (e) => zmen({ arm: e.target.value }, true));
      }
    }
    const anyZed = c.zed.start || c.zed.end, nCelo = a.parts.filter((m) => m.role === 'celo').length;
    $('kNote1').textContent = (c.anchor === 'bocni' ? 'Rameno vede od rámu skrz zateplení k čelu nosné desky, tam se plotna 120×120 přikotví dvěma závitovými tyčemi M12. Rameno = fasáda + mezera k rámu (obvykle +50 mm).'
      : c.anchor === 'patka' ? 'Pod sloupky patky 100×120×8 mm se dvěma kotvami M12.' + (stairs ? ' Na schodišti stojí sloupky uprostřed stupňů a pod spodním rámem mají nožku k patce; u hrany podesty je patka 160 mm dlouhá.' + (Zb.stepsMissing(c).length ? ' Zadejte u schodiště počet schodů.' : '') : '')
      : c.anchor === 'celo' ? 'Sloupky jdou dolů přes hranu podlahy, na boku mají plotnu 120×100×10 do čela nosné desky (' + nCelo + '×, 2 kotvy M12). Jen bez zateplení – přes zateplení zvolte kotvení z boku.' + (stairs ? ' Na schodišti jde plotna pod stupně' + (Zb.stepsMissing(c).length ? ' – zadejte počet schodů.' : '.') : '')
      : 'Dodáme jen zábradlí, kotvení si navrhnete a provedete sami.') + (anyZed && !bez ? ' Konec u zdi: na koncovém sloupku 2 plotny 120×100×10, mezera ke zdi 20 mm se vyrovná podložkami.' : '');
    kotvy();
  }

  function kotvy() {
    const c = cfg(), a = A(), an = a.lay.anch, box = $('dKotvy');
    box.hidden = c.anchor === 'bez' || !an || c.vypln === 'geometricky'; if (box.hidden) return;
    box.innerHTML = '<p class="pozn" style="margin:0 0 6px">Rozmístění kotev – zábradlí rozvinuté do přímky, kotvy můžete táhnout</p><div class="kstrip" id="kStrip"></div>' +
      '<div class="kbar"><label>Rozteč kotev [mm]<input id="kRoz" type="number" inputmode="numeric" step="50" placeholder="podle vzoru"></label><label id="kSelLab"><span></span><input id="kSel" type="number" inputmode="numeric" step="10"></label></div>' +
      '<div class="radek-btn"><button type="button" class="tl" id="kAdd">+ Kotva</button><button type="button" class="tl" id="kDel">− Kotva</button><button type="button" class="tl" id="kReset">Rozmístit znovu</button></div><p class="pozn" id="kNote"></p>';
    const KW = Math.max(320, Math.round($('kStrip').clientWidth || 340)), KX0 = 18, KX1 = KW - 18;
    const k = a.kotvy, T = an.total, X = (sv) => KX0 + (KX1 - KX0) * sv / T, u = an.used, mov = an.movable;
    if (ui.ksel != null && ui.ksel >= u.length) ui.ksel = null;
    let g = '<svg viewBox="0 0 ' + KW + ' 96" role="img" aria-label="Rozmístění kotev podél zábradlí">';
    (an.groups || []).forEach((gr, i) => { g += '<text x="' + X((gr.s0 + gr.s1) / 2) + '" y="14" text-anchor="middle">pole ' + (i + 1) + '</text>'; });
    (an.verts || []).forEach((v) => { g += '<line class="vt" x1="' + X(v) + '" x2="' + X(v) + '" y1="20" y2="58"></line>'; });
    g += '<line class="rail" x1="' + KX0 + '" x2="' + KX1 + '" y1="40" y2="40"></line>';
    (an.posts || []).forEach((ps) => { g += '<rect x="' + (X(ps) - 2) + '" y="22" width="4" height="18" fill="var(--muted)"></rect>'; });
    (an.joints || []).forEach((j) => { g += '<line class="jt" x1="' + X(j) + '" x2="' + X(j) + '" y1="32" y2="48"></line>'; });
    if (mov) an.cand.forEach((q) => { g += '<circle class="cd" cx="' + X(q) + '" cy="40" r="1.6"></circle>'; });
    const lab = (x, y, t, cls) => '<text x="' + x + '" y="' + y + '" text-anchor="middle" class="' + cls + '">' + t + '</text>', kp = k.pts && k.pts.length ? k.pts : u;
    if (kp.length) {
      if (k.ends[0] > 0.5) g += lab((KX0 + X(kp[0])) / 2, 76, nf(Math.round(k.ends[0])), k.endLvl[0]);
      if (k.ends[1] > 0.5) g += lab((X(kp[kp.length - 1]) + KX1) / 2, 76, nf(Math.round(k.ends[1])), k.endLvl[1]);
      k.gaps.forEach((gp, i) => { if (X(kp[i + 1]) - X(kp[i]) > 30 || k.lvl[i] !== 'ok') g += lab((X(kp[i]) + X(kp[i + 1])) / 2, i % 2 && X(kp[i + 1]) - X(kp[i]) < 44 ? 88 : 76, nf(Math.round(gp)), k.lvl[i]); });
    }
    (an.fixed || []).forEach((fx) => { g += '<rect class="wall" x="' + (X(fx) - (fx > 0 ? 0 : 6)) + '" y="26" width="6" height="28"><title>přikotveno ke zdi</title></rect>'; });
    u.forEach((sv, i) => { g += '<circle class="an' + (mov ? '' : ' fix') + (i === ui.ksel ? ' sel' : '') + '" data-i="' + i + '" cx="' + X(sv) + '" cy="40" r="8"></circle>'; });
    g += '<text x="' + KX0 + '" y="62">0</text><text x="' + KX1 + '" y="62" text-anchor="end">' + nf(Math.round(T)) + ' mm</text></svg>';
    const el = $('kStrip'); el.innerHTML = g;
    $('kNote').textContent = mov ? 'Kotvu chyťte a táhněte – přichytí se do nejbližší mezery mezi špruše (tečky), nikdy do rohu, styku pole ani na špruši. Čísla pod pásem jsou mezery v mm: oranžová = nad doporučenou hodnotou, červená = nad maximem.'
      : (c.anchor === 'celo' ? 'Plotny přes čelo jsou pod sloupky (mimo rohy a zlomy)' : 'Patky jsou pod sloupky') + ' – posouvají se roztečí sloupků.' + ((an.fixed || []).length ? ' Tmavý pruh na konci = přikotveno ke zdi.' : '');
    ['kRoz', 'kAdd', 'kReset'].forEach((id) => { $(id).disabled = !mov; });
    $('kRoz').value = c.kotvyRoztec == null ? '' : c.kotvyRoztec;
    $('kSel').disabled = !mov || ui.ksel == null; $('kDel').disabled = !mov || ui.ksel == null || u.length < 2;
    $('kSel').value = ui.ksel == null ? '' : Math.round(u[ui.ksel]);
    $('kSelLab').firstChild.textContent = ui.ksel == null ? 'Vybraná kotva – klikněte na ni' : 'Kotva ' + (ui.ksel + 1) + ' – od začátku [mm]';
    const moveTo = (list, selS) => { const nu = list.slice().sort((p, q) => p - q); ui.ksel = selS == null ? null : nu.indexOf(selS); zmen({ kotvyPos: nu }, true); };
    const nejblizsi = (sv, skip) => an.cand.filter((q) => !u.some((x, j) => j !== skip && x === q)).reduce((b, q) => (b == null || Math.abs(q - sv) < Math.abs(b - sv) ? q : b), null);
    $('kRoz').addEventListener('change', (e) => { const v = e.target.value.trim(); ui.ksel = null; zmen({ kotvyRoztec: v === '' ? null : Number(v), kotvyPos: null }, true); });
    $('kReset').addEventListener('click', () => { ui.ksel = null; zmen({ kotvyPos: null }, true); });
    $('kSel').addEventListener('change', (e) => { const i = ui.ksel, want = Number(e.target.value); if (i == null || !isFinite(want)) return; const sn = nejblizsi(want, i); if (sn == null) return; const nu = u.slice(); nu[i] = sn; moveTo(nu, sn); });
    $('kAdd').addEventListener('click', () => {
      const pts = [0].concat(u, [T]); let bi = 0; for (let i = 1; i < pts.length - 1; i++) if (pts[i + 1] - pts[i] > pts[bi + 1] - pts[bi]) bi = i;
      const mid = (pts[bi] + pts[bi + 1]) / 2, free = an.cand.filter((q) => u.indexOf(q) < 0); if (!free.length) return;
      const sn = free.reduce((b, q) => (Math.abs(q - mid) < Math.abs(b - mid) ? q : b)); moveTo(u.concat([sn]), sn);
    });
    $('kDel').addEventListener('click', () => { if (ui.ksel == null || u.length < 2) return; const nu = u.slice(); nu.splice(ui.ksel, 1); ui.ksel = null; zmen({ kotvyPos: nu }, true); });
    if (!mov) return;
    const svgEl = el.querySelector('svg'), toS = (ev) => { const r = svgEl.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * KW; return Math.max(0, Math.min(T, (x - KX0) / (KX1 - KX0) * T)); };
    el.querySelectorAll('circle.an').forEach((cc) => cc.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); const i = Number(cc.dataset.i); ui.ksel = i; cc.setPointerCapture(ev.pointerId); cc.classList.add('sel'); let cur = u[i];
      const mv = (e) => { const sn = nejblizsi(toS(e), i); if (sn != null) { cur = sn; cc.setAttribute('cx', X(sn)); $('kSel').value = Math.round(sn); } };
      const up = () => { cc.removeEventListener('pointermove', mv); cc.removeEventListener('pointerup', up); cc.removeEventListener('pointercancel', up); const nu = u.slice(); nu[i] = cur; moveTo(nu, cur); };
      cc.addEventListener('pointermove', mv); cc.addEventListener('pointerup', up); cc.addEventListener('pointercancel', up);
    }));
  }


  /* ---------- profil rámu, špruše, spoj, přesah, rozteč geometrických motivů ---------- */
  function profil() {
    const c = cfg(), a = A(), el = $('dProfil'), jt = a.locks, geo = c.vypln === 'geometricky';
    el.innerHTML = '<p class="pozn" style="margin:0 0 6px">' + (geo ? 'Profil horního madla' : c.typ === 'A' ? 'Rám (madla a sloupky)' : 'Rám (horní a spodní, koncové sloupky)') + '</p><div id="pR"></div>' +
      (c.vypln === 'standard' ? '<p class="pozn" style="margin:12px 0 6px">Špruše – svislá pásovina</p><div id="pB"></div>' + (jt.choice ? '<p class="pozn" style="margin:12px 0 6px">Spoj špruše s rámem</p><div id="pJ"></div>' : '') +
        '<p class="pozn" style="margin:12px 0 6px">Délka špruší – přesah přes rám (0 = zarovnané s rámem)</p><div class="pole2"><label>Nahoře nad horním rámem [mm]<input id="ovT" type="number" inputmode="numeric" min="0" max="' + Zb.OVER_TOP_MAX + '" step="10"></label><label>Dole pod spodním rámem [mm]<input id="ovB" type="number" inputmode="numeric" min="0" max="' + Zb.OVER_MAX + '" step="10"></label></div><p class="pozn" id="ovNote"></p>' : '') +
      (geo ? '<div class="pole2" style="margin-top:12px"><label>Rozteč geometrických motivů [mm]<input id="mpn" type="number" inputmode="numeric" min="150" max="' + (Zb.GEO_FRAME_W + Zb.gapLimit(c.uziti, Zb.rates0())) + '" step="10" value="' + c.motifPitch + '"></label></div><p class="pozn">Rámy z jeklu 20×20×2 mm, všechny rohy na pokos 45°. Výchozí rozteč 250 mm.</p>' : '') +
      (geo ? '' : '<p class="pozn ' + (jt.ok ? 'ok' : '') + '"><b>' + ({ drazka: 'Drážky v rámu.', zamek: 'Zámečky.', tupo: 'Na tupo.', vlozeni: 'Tyče v otvorech madla.', panel: 'Plech v poli.' }[jt.mode] || '') + '</b> ' + esc(jt.why || '') + '</p>');
    cipy($('pR'), Zb.RAILS[c.typ].map((q) => ({ id: q.id, lab: 'Jekl ' + q.lab, sub: q.sub })), c.rail, (id) => zmen({ rail: id }, true));
    if (c.vypln === 'standard') {
      cipy($('pB'), Zb.BARS.map((b) => ({ id: b.id, lab: b.lab, sub: b.sub || (b.w > jt.rail.w ? 'širší než rám' : '') })), c.bar, (id) => zmen({ bar: id }, true));
      if (jt.choice) cipy($('pJ'), Zb.JOINS.map((j) => ({ id: j.id, lab: j.lab, sub: j.sub })), c.join, (id) => zmen({ join: id }, true));
      const ov = Zb.overAllowed(c); $('ovT').disabled = !ov.top; $('ovB').disabled = !ov.bot; $('ovT').value = c.overTop; $('ovB').value = c.overBot;
      $('ovT').addEventListener('change', (e) => zmen({ overTop: Number(e.target.value) || 0 }, true)); $('ovB').addEventListener('change', (e) => zmen({ overBot: Number(e.target.value) || 0 }, true));
      $('ovNote').textContent = [ov.whyTop, ov.whyBot].filter(Boolean).join(' ');
    }
    if (geo) $('mpn').addEventListener('change', (e) => zmen({ motifPitch: Number(e.target.value) }, true));
  }

  /* ---------- 4. služby a kontrola ---------- */
  function sluzby() {
    const c = cfg(), a = A(), R = a.R, cena = { zamereni: R.zamereni, kotveni: R.kotveni, montaz: Math.round((a.lenM * R.montazM + a.anchorsN * R.montazKotva) / 10) * 10 };
    $('dSluzby').innerHTML = Zb.SERVICES.map((s) => '<label class="radek sluzba"><span><b>' + s.lab + '</b><br><small>' + s.sub + '</small></span><span class="p">+ ' + nf(a.vatOf(cena[s.id])) + ' Kč</span><input type="checkbox" data-svc="' + s.id + '"' + (c.services[s.id] ? ' checked' : '') + '></label>').join('') +
      '<p class="pozn">Bez služeb vyrobíme zábradlí přesně podle zadaných rozměrů a pošleme ho i s kotvami, montáž si zajistíte sami. Se zaměřením rozměry před výrobou ověříme na místě.</p>';
    $('dSluzby').querySelectorAll('[data-svc]').forEach((b) => b.addEventListener('change', () => zmen({ services: Object.assign({}, cfg().services, { [b.dataset.svc]: b.checked }) })));
  }
  function kontrola() {
    const w = A().warns || [];
    $('dKontrola').innerHTML = w.length ? w.map((x) => '<p class="pozn ' + (x.lvl === 'bad' ? 'chyba' : x.lvl === 'warn' ? 'varuj' : '') + '">' + esc(x.t) + '</p>').join('') : '<p class="pozn ok">Bez připomínek.</p>';
  }

  /* zaostření: po překreslení se vrátí na políčko, ve kterém uživatel byl */
  function dyn() {
    const ae = document.activeElement, id = ae && ae.id, sel = ae && ae.selectionStart;
    tvar(); profil(); pole(); kotveni(); sluzby(); kontrola();
    if (id && $(id) && /^(sL|sR|sN|sA|sT|st|fac|arm|kRoz|kSel|ov|mpn)/.test(id)) { try { $(id).focus(); if (sel != null) $(id).setSelectionRange(sel, sel); } catch (e) { /* číselná pole nemají výběr */ } }
  }
  return { dyn };
}
