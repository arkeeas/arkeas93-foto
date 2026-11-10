/* Foto-vizuál: PBR materiály. Povrchové struktury (pomerančová kůra laku, květ zinku, broušení, housenka svaru)
 * se počítají v prohlížeči – nic se nestahuje. Dřevo, beton a omítka jsou fotografické textury z Poly Haven (CC0).
 * UV všech dílů jsou v milimetrech, `dlazdice` říká, kolik mm zabere jedno opakování textury. */
import * as THREE from 'three';

/* ---------- šum, který na sebe navazuje (dlaždicový) ---------- */
function rng(seed) { let s = seed >>> 0; return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }
function sum(N, bunek, seed) {
  const r = rng(seed), g = new Float32Array(bunek * bunek); for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(N * N), k = bunek / N, sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = x * k, fy = y * k, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const x1 = (x0 + 1) % bunek, y1 = (y0 + 1) % bunek;
    const a = g[y0 * bunek + x0], b = g[y0 * bunek + x1], c = g[y1 * bunek + x0], d = g[y1 * bunek + x1];
    out[y * N + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  return out;
}
function vrstvy(N, slozky, seed) {
  const out = new Float32Array(N * N); let w = 0;
  slozky.forEach(([bunek, vaha], i) => { const s = sum(N, bunek, seed + i * 977); for (let j = 0; j < out.length; j++) out[j] += s[j] * vaha; w += vaha; });
  for (let j = 0; j < out.length; j++) out[j] /= w;
  return out;
}
function platno(N, f) {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), im = x.createImageData(N, N); f(im.data); x.putImageData(im, 0, 0); return c;
}
function normalova(vyska, N, sila) {
  return platno(N, (d) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const l = vyska[y * N + (x + N - 1) % N], r = vyska[y * N + (x + 1) % N], u = vyska[((y + N - 1) % N) * N + x], dn = vyska[((y + 1) % N) * N + x];
      let nx = (l - r) * sila, ny = (dn - u) * sila; const il = 1 / Math.hypot(nx, ny, 1), i = (y * N + x) * 4;
      d[i] = (nx * il * 0.5 + 0.5) * 255; d[i + 1] = (ny * il * 0.5 + 0.5) * 255; d[i + 2] = (il * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  });
}

export function createMaterialy(studio) {
  const cache = new Map();
  const T = (key, make, dlazdice, srgb) => {
    if (!cache.has(key)) {
      const t = new THREE.CanvasTexture(make()); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = studio.maxAniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / dlazdice, 1 / dlazdice); cache.set(key, t);
    }
    return cache.get(key);
  };
  const N = studio.mobil ? 256 : 512;

  /* pomerančová kůra práškového laku: vlnky ~1,5 mm + jemné zrno; `hruba` = strukturní lak */
  const kura = (hruba) => T('kura' + hruba, () => normalova(vrstvy(N, hruba ? [[64, 1], [128, 0.8], [256, 0.5]] : [[28, 1], [56, 0.45], [200, 0.12]], 11), N, hruba ? 5.5 : 3.2), hruba ? 34 : 46);
  /* květ žárového zinku: zrna kolem 10 mm, každé o něco jinak světlé a drsné – jemně, bez ostrých hranic */
  function zinek() {
    const M = 256, r = rng(77), n = 120, pts = Array.from({ length: n }, () => [r() * M, r() * M, 0.9 + r() * 0.1, 0.34 + r() * 0.2]);
    const jemny = vrstvy(M, [[40, 1], [90, 0.7], [128, 0.4]], 5), barva = new Uint8ClampedArray(M * M * 4), drsnost = new Uint8ClampedArray(M * M * 4), vyska = new Float32Array(M * M);
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      let b1 = 1e9, b2 = 1e9, bi = 0, bj = 0;
      for (let k = 0; k < n; k++) {
        let dx = Math.abs(x - pts[k][0]), dy = Math.abs(y - pts[k][1]); if (dx > M / 2) dx = M - dx; if (dy > M / 2) dy = M - dy;
        const d = dx * dx + dy * dy; if (d < b1) { b2 = b1; bj = bi; b1 = d; bi = k; } else if (d < b2) { b2 = d; bj = k; }
      }
      /* u hranice zrna plynulý přechod do souseda */
      const w = Math.min(1, (Math.sqrt(b2) - Math.sqrt(b1)) / 2.2) * 0.5 + 0.5, j = jemny[y * M + x], i = (y * M + x) * 4;
      const jas = pts[bi][2] * w + pts[bj][2] * (1 - w), ro = pts[bi][3] * w + pts[bj][3] * (1 - w);
      const v = (jas + (j - 0.5) * 0.06) * 255;
      barva[i] = v * 0.97; barva[i + 1] = v * 0.985; barva[i + 2] = v; barva[i + 3] = 255;
      drsnost[i] = 255; drsnost[i + 1] = Math.min(1, ro + (j - 0.5) * 0.14) * 255; drsnost[i + 2] = 255; drsnost[i + 3] = 255;
      vyska[y * M + x] = j;
    }
    const mk = (arr) => () => platno(M, (d) => d.set(arr));
    return { map: T('znB', mk(barva), 130, true), roughnessMap: T('znR', mk(drsnost), 130), normalMap: T('znN', () => normalova(vyska, M, 1.3), 130) };
  }
  /* surová ocel pod bezbarvým lakem: tmavá okujená, jemné rýhy po délce profilu (UV: u = obvod, v = délka) */
  function brus() {
    const r = rng(31), sl = Array.from({ length: N }, () => r()), jemny = vrstvy(N, [[8, 1], [24, 0.7]], 9), v = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) v[y * N + x] = sl[x] * 0.6 + sl[(x * 7) % N] * 0.25 + (jemny[y * N + x] - 0.5) * 0.5;
    return {
      normalMap: T('brN', () => normalova(v, N, 0.9), 70),
      roughnessMap: T('brR', () => platno(N, (d) => { for (let i = 0; i < N * N; i++) { const q = (0.5 + v[i] * 0.4) * 255; d[i * 4] = 255; d[i * 4 + 1] = q; d[i * 4 + 2] = 255; d[i * 4 + 3] = 255; } }), 70),
      map: T('brB', () => platno(N, (d) => { const m = vrstvy(N, [[4, 1], [11, 0.7], [40, 0.35]], 3); for (let i = 0; i < N * N; i++) { const q = 78 + m[i] * 62 + v[i] * 16; d[i * 4] = q * 0.95; d[i * 4 + 1] = q * 0.98; d[i * 4 + 2] = q * 1.04; d[i * 4 + 3] = 255; } }), 260, true)
    };
  }
  /* housenka svaru (šupiny) a rýhování hrany po laseru */
  const housenka = () => T('svarN', () => {
    const v = new Float32Array(N * N), j = vrstvy(N, [[40, 1]], 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N * 16 + Math.pow(Math.abs(y / N - 0.5) * 2, 1.6) * 0.9; v[y * N + x] = (u - Math.floor(u)) * 0.85 + j[y * N + x] * 0.25; }
    return normalova(v, N, 6);
  }, 36);
  const ryhy = () => T('ryhyN', () => {
    const r = rng(8), sl = Array.from({ length: N }, () => r()), v = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) v[y * N + x] = sl[x] * 0.6 + sl[(x * 3) % N] * 0.4;
    return normalova(v, N, 2.2);
  }, 14);

  /* ---------- povrchy kovu ---------- */
  const RAL = {
    9005: ['Černá', '#17181a'], 7016: ['Antracit', '#383e42'], 7021: ['Černošedá', '#2f3234'], 9007: ['Šedý hliník', '#8f8f8c'], 7035: ['Světle šedá', '#c5c7c4'],
    9016: ['Bílá', '#f1f0ea'], 9010: ['Krémově bílá', '#f1ece1'], 1013: ['Perlová', '#e3d9c6'], 8017: ['Čokoládová', '#442f29'], 6005: ['Mechová zelená', '#114232'], 3004: ['Purpurová červená', '#6b1c23'], 5011: ['Ocelová modrá', '#1a2b3c']
  };
  const POVRCHY = {
    black: { typ: 'lak', ral: 9005 }, ral: { typ: 'lak', ral: 7016 }, anth: { typ: 'lak', ral: 7016 }, white: { typ: 'lak', ral: 9016 }, raw: { typ: 'surova' },
    zn: { typ: 'zinek' }, znpu: { typ: 'zinek', lak: true }, prasek: { typ: 'lak', ral: 7016 }, duplex: { typ: 'lak', ral: 7016, struktura: true }
  };
  function parametry(id, ral) {
    const P = Object.assign({}, POVRCHY[id] || POVRCHY.black); if (ral && P.typ === 'lak' && RAL[ral]) P.ral = Number(ral);
    if (P.typ === 'zinek') return Object.assign({ color: P.lak ? '#c9ced2' : '#d4d8db', metalness: 1, roughness: 1, clearcoat: P.lak ? 0.5 : 0, clearcoatRoughness: 0.3, normalScale: 0.4, envMapIntensity: 1 }, zinek());
    if (P.typ === 'surova') return Object.assign({ color: '#ffffff', metalness: 1, roughness: 1, clearcoat: 0.6, clearcoatRoughness: 0.2, normalScale: 0.3, envMapIntensity: 1 }, brus());
    const svetla = new THREE.Color(RAL[P.ral][1]).getHSL({}).l > 0.5;
    return { color: RAL[P.ral][1], metalness: 0, roughness: P.struktura ? 0.78 : svetla ? 0.52 : 0.6, clearcoat: 0, clearcoatRoughness: 0.4, specularIntensity: svetla ? 1 : 0.55,
      normalMap: kura(!!P.struktura), normalScale: P.struktura ? 0.6 : 0.35, map: null, roughnessMap: null, envMapIntensity: 1 };
  }
  function nastav(m, p) {
    m.color.set(p.color); m.metalness = p.metalness; m.roughness = p.roughness; m.clearcoat = p.clearcoat; m.clearcoatRoughness = p.clearcoatRoughness; m.specularIntensity = p.specularIntensity == null ? 1 : p.specularIntensity;
    m.map = p.map || null; m.roughnessMap = p.roughnessMap || null; m.normalMap = p.normalMap || null; m.normalScale.setScalar(p.normalScale); m.needsUpdate = true;
  }
  /* kov: jeden materiál se pak jen přelaďuje (plynulý přechod při změně povrchu) */
  function kov(id, ral, extra) {
    const m = new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.FrontSide }, extra || {})); nastav(m, parametry(id, ral)); m.userData.povrch = [id, ral]; return m;
  }
  let beh = 0;
  function prelad(mats, id, ral, ms = 380) {
    const p = parametry(id, ral), cil = new THREE.Color(p.color), moje = ++beh, z = performance.now();
    const start = mats.map((m) => ({ c: m.color.clone(), me: m.metalness, r: m.roughness, cc: m.clearcoat }));
    mats.forEach((m) => { m.specularIntensity = p.specularIntensity == null ? 1 : p.specularIntensity; m.map = p.map || null; m.roughnessMap = p.roughnessMap || null; m.normalMap = p.normalMap || null; m.normalScale.setScalar(p.normalScale); m.clearcoatRoughness = p.clearcoatRoughness; m.needsUpdate = true; m.userData.povrch = [id, ral]; });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = 0;
    (function krok() {
      if (moje !== beh) return;
      const k = ms ? Math.min(1, (performance.now() - z) / ms) : 1, e = k * k * (3 - 2 * k);
      mats.forEach((m, i) => { m.color.copy(start[i].c).lerp(cil, e); m.metalness = start[i].me + (p.metalness - start[i].me) * e; m.roughness = start[i].r + (p.roughness - start[i].r) * e; m.clearcoat = start[i].cc + (p.clearcoat - start[i].cc) * e; });
      studio.invalidate(); if (k < 1) requestAnimationFrame(krok);
    })();
  }
  /* hrana řezu laserem: na surové oceli tmavší okujená, s rýhováním; pod lakem jen rýhování */
  function hrana(id, ral) {
    const p = parametry(id, ral), m = new THREE.MeshPhysicalMaterial();
    nastav(m, Object.assign({}, p, { map: null, roughnessMap: null, normalMap: ryhy(), normalScale: 0.6 }));
    const P = POVRCHY[id] || POVRCHY.black;
    if (P.typ === 'surova') { m.color.set('#4b4f55'); m.roughness = 0.5; m.clearcoat = 0.6; }
    else if (P.typ === 'zinek') { m.color.set('#b9bec3'); m.roughness = 0.5; }
    else { m.color.copy(new THREE.Color(p.color).lerp(new THREE.Color('#ffffff'), 0.035)); m.roughness = Math.min(0.8, p.roughness + 0.1); }
    m.userData.hrana = true; return m;
  }
  function svar(id, ral) {
    const p = parametry(id, ral), m = new THREE.MeshPhysicalMaterial();
    nastav(m, Object.assign({}, p, { map: null, roughnessMap: null, normalMap: housenka(), normalScale: 1.6 }));
    const P = POVRCHY[id] || POVRCHY.black;
    if (P.typ === 'surova') { m.color.set('#6c6e78'); m.roughness = 0.45; } else if (P.typ === 'zinek') { m.color.set('#c3c8cc'); m.roughness = 0.5; } else m.roughness = Math.min(0.85, p.roughness + 0.08);
    return m;
  }

  /* ---------- dřevo, epoxid, sklo, spojovací materiál, stavba ---------- */
  const DREVO = { dub: ['oak_veneer_01', 420, '#ffffff', 0.5], jasan: ['oak_veneer_01', 420, '#ffe9c9', 0.55], madlo: ['oak_veneer_01', 300, '#e9cba6', 0.4], orech: ['wood_table_001', 520, '#ffffff', 0.45] };
  function drevo(druh, podel) {
    const D = DREVO[druh] || DREVO.dub, s = studio.pbrSet(D[0], D[1], null, podel ? Math.PI / 2 : 0);
    const m = new THREE.MeshPhysicalMaterial(Object.assign({}, s, { color: D[2], roughness: 1, metalness: 0, clearcoat: 0.22, clearcoatRoughness: D[3], normalScale: new THREE.Vector2(0.7, 0.7) }));
    m.aoMap = null;
    return m;
  }
  /* tloušťka je v jednotkách modelu (mm), útlum barvy ve světových (m) */
  const epoxid = (barva = '#0b7f8f') => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0, transmission: 1, thickness: 30, ior: 1.5,
    attenuationColor: new THREE.Color(barva), attenuationDistance: 0.012, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1 });
  const sklo = () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, transmission: 1, thickness: 10, ior: 1.52,
    attenuationColor: new THREE.Color('#8fcdb6'), attenuationDistance: 0.09, specularIntensity: 1 });
  const spojovaci = () => new THREE.MeshPhysicalMaterial({ color: '#c9cdd2', metalness: 1, roughness: 0.34 });
  const stavba = (druh) => {
    const s = druh === 'omitka' ? studio.pbrSet('plastered_wall_04', 1800) : studio.pbrSet('concrete_floor_worn_001', 2200);
    return new THREE.MeshStandardMaterial(Object.assign({}, s, { color: druh === 'omitka' ? '#fbf7f0' : '#ffffff', roughness: 1, metalness: 0 }));
  };

  /* náhled materiálu na kouli (pro čipy v panelu voleb): vykreslí se do rohu plátna a hned zkopíruje */
  function nahled(material, px = 56) {
    const r = studio.renderer, sc = new THREE.Scene(); sc.environment = studio.scene.environment; sc.environmentRotation.copy(studio.scene.environmentRotation); sc.background = new THREE.Color('#f3f2ef');
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10); cam.position.set(0, 0.015, 0.215); cam.lookAt(0, 0, 0);
    const g = new THREE.SphereGeometry(0.05, 48, 32), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 314, uv.getY(i) * 157);
    sc.add(new THREE.Mesh(g, material));
    const l = new THREE.DirectionalLight(0xffffff, 1.4); l.position.set(-0.4, 0.8, 0.6); sc.add(l);
    const cv = r.domElement, pr = r.getPixelRatio(), n = Math.min(px * 3, Math.floor(Math.min(cv.width, cv.height) / pr));
    const vp = r.getViewport(new THREE.Vector4()), rt = r.getRenderTarget();
    r.setRenderTarget(null); r.setViewport(0, 0, n, n); r.setScissor(0, 0, n, n); r.setScissorTest(true); r.render(sc, cam);
    const c = document.createElement('canvas'); c.width = c.height = px * 2;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, cv.height - n * pr, n * pr, n * pr, 0, 0, px * 2, px * 2);
    r.setScissorTest(false); r.setViewport(vp); r.setRenderTarget(rt); g.dispose(); studio.invalidate();
    return c.toDataURL('image/png');
  }

  /* průhledné materiály se na kouli bez pozadí neukážou – náhled je lesklá koule v barvě materiálu */
  const nahledLesku = (barva) => { const m = new THREE.MeshPhysicalMaterial({ color: barva, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 }), u = nahled(m); m.dispose(); return u; };
  return { RAL, POVRCHY, kov, prelad, hrana, svar, drevo, epoxid, sklo, spojovaci, stavba, nahled, nahledLesku, parametry };
}
