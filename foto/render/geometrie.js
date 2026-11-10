/* Foto-vizuál: geometrie pro fotku. Rozměry, řezy a zámky dává jádro konfigurátoru – tady se jen
 * stejné díly vykreslí „jako z továrny“: jekl se zaoblenými hranami (vnější R ≈ 2 × stěna), plech se sraženou
 * hranou, svar jako housenka. UV jsou v milimetrech.
 * Vše v souřadnicích jádra (mm, Z nahoru). */
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const V = { add, sub, mul, dot, cross, len, unit };

/* vnější poloměr hrany jeklu podle stěny (EN 10219: 1,6–2,4 t pro t ≤ 6 mm); pásovina má jen sraženou hranu */
export const polomerJeklu = (t, h1, h2) => Math.min(t > 0 ? 2 * t : 0.8, Math.min(h1, h2) * 0.45);

/* zaoblený obdélník: body proti směru hodin, každý s normálou a délkou po obvodu */
function profil(h1, h2, R, seg) {
  const out = []; let s = 0, prev = null;
  [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]].forEach(([sa, sb, q]) => {
    for (let k = 0; k <= seg; k++) {
      const ang = (q + k / seg) * Math.PI / 2, ca = Math.cos(ang), sn = Math.sin(ang);
      const p = { a: sa * (h1 - R) + R * ca, b: sb * (h2 - R) + R * sn, na: ca, nb: sn };
      if (prev) s += Math.hypot(p.a - prev.a, p.b - prev.b);
      p.s = s; out.push(p); prev = p;
    }
  });
  const f = out[0]; out.push({ a: f.a, b: f.b, na: f.na, nb: f.nb, s: s + Math.hypot(f.a - prev.a, f.b - prev.b) });
  return out;
}

/* hranol (jekl, pásovina, madlo) mezi dvěma řezy. m = { p0, d, e1, e2, h1, h2, t, cut0:{p,n}, cut1:{p,n} } – popis dílu z jádra.
   `konce(a, b)` může řezy nahradit (díly, které popis rovinami nemají). Vrací geometrii a obrysy konců (pro svary). */
export function hranol(m, o = {}) {
  const R = o.R != null ? o.R : polomerJeklu(m.t, m.h1, m.h2), seg = o.seg || (R > 2.5 ? 5 : R > 1 ? 3 : 2);
  const P = profil(m.h1, m.h2, Math.max(0.05, R), seg), n = P.length;
  const tAt = o.konce || ((a, b) => {
    const p = add(add(m.p0, mul(m.e1, a)), mul(m.e2, b));
    return [dot(m.cut0.n, sub(m.cut0.p, p)) / dot(m.d, m.cut0.n), dot(m.cut1.n, sub(m.cut1.p, p)) / dot(m.d, m.cut1.n)];
  });
  const pos = [], nor = [], uv = [], idx = [], l0 = [], l1 = [];
  P.forEach((q) => {
    const base = add(add(m.p0, mul(m.e1, q.a)), mul(m.e2, q.b)), nn = add(mul(m.e1, q.na), mul(m.e2, q.nb));
    let [t0, t1] = tAt(q.a, q.b); if (t0 > t1) { const x = t0; t0 = t1; t1 = x; }
    const a = add(base, mul(m.d, t0)), b = add(base, mul(m.d, t1));
    pos.push(...a, ...b); nor.push(...nn, ...nn); uv.push(q.s, t0, q.s, t1); l0.push(a); l1.push(b);
  });
  const ruka = dot(cross(m.e1, m.e2), m.d) > 0;                         // levotočivá soustava dílu = obrácené pořadí vrcholů
  for (let i = 0; i < n - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (ruka) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
  /* čela (řezné plochy) – vějíř ze středu, normála roviny řezu */
  [[l0, -1], [l1, 1]].forEach(([loop, sg]) => {
    const c = mul(loop.slice(0, n - 1).reduce((s, p) => add(s, p), [0, 0, 0]), 1 / (n - 1));
    let nn = [0, 0, 0]; for (let i = 0; i < n - 1; i++) nn = add(nn, cross(sub(loop[i], c), sub(loop[i + 1], c)));
    nn = unit(nn); if (dot(nn, m.d) * sg < 0) nn = mul(nn, -1);
    const b0 = pos.length / 3; pos.push(...c); nor.push(...nn); uv.push(0, 0);
    loop.forEach((p) => { pos.push(...p); nor.push(...nn); uv.push(dot(sub(p, c), m.e1), dot(sub(p, c), m.e2)); });
    for (let i = 0; i < n - 1; i++) { if ((sg > 0) === ruka) idx.push(b0, b0 + 1 + i, b0 + 2 + i); else idx.push(b0, b0 + 2 + i, b0 + 1 + i); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return { geometry: g, konce: [l0.slice(0, n - 1), l1.slice(0, n - 1)], R };
}

/* řezy dílu, který má jen těleso (plochy) a osu: paprsek podél osy protne čelní plochy tělesa */
export function konceZTelesa(solid, m) {
  const F = solid.faces.map((f) => {
    const n = unit(f.n), ad = dot(n, m.d);
    if (Math.abs(ad) < 0.03) return null;
    const P0 = solid.verts[f.outer[0]], ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = unit(cross(n, ax)), v = cross(n, u);
    const to2 = (i) => { const q = sub(solid.verts[i], P0); return [dot(q, u), dot(q, v)]; };
    return { n, ad, P0, u, v, outer: f.outer.map(to2), inner: f.inner.map((l) => l.map(to2)) };
  }).filter(Boolean);
  const uvnitr = (poly, p) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  let lo = Infinity, hi = -Infinity;
  solid.verts.forEach((p) => { const t = dot(sub(p, m.p0), m.d); lo = Math.min(lo, t); hi = Math.max(hi, t); });
  const posun = m.t > 0 ? m.t / 2 : Math.min(m.h1, m.h2) * 0.3;
  return (a, b) => {
    const aa = Math.sign(a) * Math.max(0, Math.min(Math.abs(a), m.h1 - posun)), bb = Math.sign(b) * Math.max(0, Math.min(Math.abs(b), m.h2 - posun));
    const o = add(add(m.p0, mul(m.e1, aa)), mul(m.e2, bb)); let t0 = Infinity, t1 = -Infinity;
    F.forEach((f) => {
      const t = dot(f.n, sub(f.P0, o)) / f.ad, q = sub(add(o, mul(m.d, t)), f.P0), p = [dot(q, f.u), dot(q, f.v)];
      if (!uvnitr(f.outer, p) || f.inner.some((l) => uvnitr(l, p))) return;
      t0 = Math.min(t0, t); t1 = Math.max(t1, t);
    });
    if (!isFinite(t0) || t1 - t0 < 1e-6) return [lo, hi];
    return [t0, t1];
  };
}

/* obecné těleso z rovinných ploch (i s otvory) – ostré hrany, UV z největší složky normály */
export function teleso(solid) {
  const pos = [], nor = [], uv = [], P = solid.verts;
  solid.faces.forEach((f) => {
    const nw = (lp) => { const n = [0, 0, 0]; lp.forEach((a, i) => { const A = P[a], B = P[lp[(i + 1) % lp.length]]; n[0] += (A[1] - B[1]) * (A[2] + B[2]); n[1] += (A[2] - B[2]) * (A[0] + B[0]); n[2] += (A[0] - B[0]) * (A[1] + B[1]); }); return n; };
    const n = unit(f.n); let outer = f.outer.slice(); if (dot(nw(outer), n) < 0) outer.reverse();
    const inner = f.inner.map((lp) => { lp = lp.slice(); if (dot(nw(lp), n) > 0) lp.reverse(); return lp; });
    const ax = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = unit(cross(n, ax)), e2 = cross(n, e1);
    const to2 = (i) => new THREE.Vector2(dot(P[i], e1), dot(P[i], e2)), ids = outer.concat(...inner);
    THREE.ShapeUtils.triangulateShape(outer.map(to2), inner.map((lp) => lp.map(to2))).forEach((tr) => {
      let [a, b, c] = tr.map((k) => P[ids[k]]);
      if (dot(cross(sub(b, a), sub(c, a)), n) < 0) { const t = b; b = c; c = t; }
      [a, b, c].forEach((p) => { pos.push(...p); nor.push(...n); uv.push(dot(p, e1), dot(p, e2)); });
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/* plech: obrys + otvory (2D, mm) vytažený na tloušťku t, sražená hrana. Skupiny: 0 = plochy, 1 = hrana řezu.
   Umístění: počátek o a osy ex, ey, ez (ez = směr tloušťky). */
export function plech(outline, holes, t, o = {}) {
  const ccw = (pts) => { let v = pts.map((p) => new THREE.Vector2(p[0], p[1])); if (THREE.ShapeUtils.isClockWise(v)) v = v.reverse(); return v; };
  const sh = new THREE.Shape(ccw(outline));
  (holes || []).forEach((h) => { if (h.length >= 3) sh.holes.push(new THREE.Path(ccw(h).reverse())); });
  const bv = o.zkos == null ? Math.min(0.4, t * 0.12) : o.zkos;
  let g = new THREE.ExtrudeGeometry(sh, bv > 0 ? { depth: t - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelOffset: -bv, bevelSegments: o.segmenty || 1, curveSegments: 8 }
    : { depth: t, bevelEnabled: false, curveSegments: 8 });
  if (bv > 0) g.translate(0, 0, bv);
  if (o.hladke) {                                                       // křivky motivu jsou lomené čáry – vyhladit stínování hrany
    const sk = g.groups.map((x) => ({ start: x.start, count: x.count, materialIndex: x.materialIndex }));
    const h = toCreasedNormals(g, Math.PI / 4.5); g.dispose(); g = h; g.clearGroups(); sk.forEach((x) => g.addGroup(x.start, x.count, x.materialIndex));
  }
  if (o.o) {
    const ez = o.ez || cross(o.ex, o.ey), M = new THREE.Matrix4().set(o.ex[0], o.ey[0], ez[0], o.o[0], o.ex[1], o.ey[1], ez[1], o.o[1], o.ex[2], o.ey[2], ez[2], o.o[2], 0, 0, 0, 1);
    g.applyMatrix4(M);
    if (M.determinant() < 0) {                                           // levotočivé osy dílu = zrcadlo → obrátit pořadí vrcholů, jinak je plech naruby
      Object.values(g.attributes).forEach((at) => { const n = at.itemSize, ar = at.array; for (let i = 0; i < at.count; i += 3) for (let k = 0; k < n; k++) { const x = ar[(i + 1) * n + k]; ar[(i + 1) * n + k] = ar[(i + 2) * n + k]; ar[(i + 2) * n + k] = x; } });
    }
  }
  return g;
}
export const kruh = (cx, cy, r, n = 32) => Array.from({ length: n }, (_, k) => { const a = 2 * Math.PI * k / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

/* trojúhelníková síť z CADu (STEP → preview.json): ostré hrany zůstanou, oblé se vyhladí; plochy a hrana řezu zvlášť */
export function sit(positions, indices, osaTloustky) {
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(Array.from(indices));
  g = g.toNonIndexed();
  const p = g.attributes.position, nT = p.count / 3, plochy = [], hrany = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < nT; i++) {
    a.fromBufferAttribute(p, i * 3); b.fromBufferAttribute(p, i * 3 + 1); c.fromBufferAttribute(p, i * 3 + 2);
    n.subVectors(b, a).cross(c.sub(a)).normalize();
    (Math.abs(n.getComponent(osaTloustky)) > 0.7 ? plochy : hrany).push(i);
  }
  const poradi = plochy.concat(hrany), np = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2), u1 = (osaTloustky + 1) % 3, u2 = (osaTloustky + 2) % 3;
  poradi.forEach((tr, k) => {
    for (let j = 0; j < 3; j++) {
      const s = (tr * 3 + j) * 3, d = (k * 3 + j) * 3; np[d] = p.array[s]; np[d + 1] = p.array[s + 1]; np[d + 2] = p.array[s + 2];
      const jeHrana = k >= plochy.length;
      uv[(k * 3 + j) * 2] = jeHrana ? p.array[s + u1] + p.array[s + u2] : p.array[s + u1];
      uv[(k * 3 + j) * 2 + 1] = jeHrana ? p.array[s + osaTloustky] : p.array[s + u2];
    }
  });
  g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(np, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g = toCreasedNormals(g, Math.PI / 5);
  g.addGroup(0, plochy.length * 3, 0); g.addGroup(plochy.length * 3, hrany.length * 3, 1);
  return g;
}

/* housenka svaru po uzavřeném obrysu (body 3D), poloměr r; šupiny dělá normálová mapa */
export function housenka(loop, r = 2.2, uzavrena = true, sirka = 0) {
  const w = sirka || r * 1.7;                                           // napříč spojem širší, do výšky jen r
  const n = loop.length, K = 8, pos = [], nor = [], uv = [], idx = []; let s = 0;
  const pts = uzavrena ? loop.concat([loop[0]]) : loop;
  let stred = [0, 0, 0]; loop.forEach((p) => { stred = add(stred, p); }); stred = mul(stred, 1 / n);
  let rovina = [0, 0, 0]; for (let i = 0; i < n; i++) rovina = add(rovina, cross(sub(loop[i], stred), sub(loop[(i + 1) % n], stred))); rovina = unit(rovina);
  pts.forEach((p, i) => {
    const pr = pts[i === 0 ? (uzavrena ? n - 1 : 0) : i - 1], nx = pts[i === pts.length - 1 ? (uzavrena ? 1 : i) : i + 1];
    const tg = unit(sub(nx, pr)); let ven = unit(cross(tg, rovina)); if (len(ven) < 0.5) ven = unit(sub(p, stred));
    if (i > 0) s += len(sub(p, pts[i - 1]));
    for (let k = 0; k <= K; k++) {
      const a = k / K * Math.PI * 2, d = add(mul(ven, Math.cos(a)), mul(rovina, Math.sin(a)));
      const q = add(mul(ven, Math.cos(a) * r), mul(rovina, Math.sin(a) * w)), nn = unit(add(mul(ven, Math.cos(a) / r), mul(rovina, Math.sin(a) / w)));
      pos.push(...add(p, q)); nor.push(...nn); uv.push(s, k / K * 36);
    }
  });
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < K; k++) { const a = i * (K + 1) + k, b = a + K + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

/* je bod uvnitř hranolu dílu (s vůlí)? – k rozhodnutí, který konec je přivařený k sousedovi */
export function vHranolu(m, p, vule = 1.5) {
  const q = sub(p, m.p0), a = dot(q, m.e1), b = dot(q, m.e2);
  if (Math.abs(a) > m.h1 + vule || Math.abs(b) > m.h2 + vule) return false;
  const base = add(add(m.p0, mul(m.e1, a)), mul(m.e2, b));
  const t0 = dot(m.cut0.n, sub(m.cut0.p, base)) / dot(m.d, m.cut0.n), t1 = dot(m.cut1.n, sub(m.cut1.p, base)) / dot(m.d, m.cut1.n), t = dot(q, m.d);
  return t > Math.min(t0, t1) - vule && t < Math.max(t0, t1) + vule;
}

/* matice M (šestihran) s podložkou – pro instancování na závitových tyčích */
export function maticeGeo(r = 6) {
  const m = new THREE.CylinderGeometry(r * 1.65, r * 1.65, r * 1.6, 6); m.translate(0, r * 0.8 + 2.5, 0);
  const p = new THREE.CylinderGeometry(r * 2, r * 2, 2.5, 24); p.translate(0, 1.25, 0);
  const g = mergeGeometries([m.toNonIndexed(), p.toNonIndexed()]); g.rotateX(Math.PI / 2); return g;       // osa Z
}
export function slouc(list) {
  const l = list.filter(Boolean); if (!l.length) return null; if (l.length === 1) return l[0];
  const smes = l.some((x) => x.index) && l.some((x) => !x.index), vse = smes ? l.map((x) => (x.index ? x.toNonIndexed() : x)) : l;
  vse.forEach((x) => { x.clearGroups(); });
  const g = mergeGeometries(vse, false); l.forEach((x) => x.dispose()); return g;
}

/* průnik mnohoúhelníku s konvexním (Sutherland–Hodgman) – na rozdělení desky řekou epoxidu */
export function orizni(subj, konvex) {
  let out = subj; const K = konvex.length;
  let ar = 0; konvex.forEach((a, i) => { const b = konvex[(i + 1) % K]; ar += a[0] * b[1] - b[0] * a[1]; });
  const sg = ar > 0 ? 1 : -1;
  for (let i = 0; i < K && out.length; i++) {
    const a = konvex[i], b = konvex[(i + 1) % K], inp = out; out = [];
    const strana = (p) => sg * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length], sp = strana(p), sq = strana(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
  }
  return out;
}

/* je bod uvnitř tělesa z rovinných ploch? (paprsek, lichý počet průchodů) */
export function vTelese(solid, p) {
  const d = [0.5377, 0.3331, 0.7743]; let n = 0;
  const uvnitr = (poly, q) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  solid.faces.forEach((f) => {
    const nn = unit(f.n), ad = dot(nn, d); if (Math.abs(ad) < 1e-6) return;
    const P0 = solid.verts[f.outer[0]], t = dot(nn, sub(P0, p)) / ad; if (t <= 0) return;
    const ax = Math.abs(nn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = unit(cross(nn, ax)), v = cross(nn, u);
    const to2 = (x) => { const w = sub(x, P0); return [dot(w, u), dot(w, v)]; }, q = to2(add(p, mul(d, t)));
    if (uvnitr(f.outer.map((i) => to2(solid.verts[i])), q) && !f.inner.some((l) => uvnitr(l.map((i) => to2(solid.verts[i])), q))) n++;
  });
  return n % 2 === 1;
}

/* popis hranolu pro díl, který má jen těleso a osu (m = { p1, u, v, w } z jádra podnoží): průřez se změří na tělese */
export function ramZTelesa(solid, m, stena) {
  let h1 = 0, h2 = 0;
  solid.verts.forEach((p) => { const q = sub(p, m.p1); h1 = Math.max(h1, Math.abs(dot(q, m.v))); h2 = Math.max(h2, Math.abs(dot(q, m.w))); });
  return { p0: m.p1, d: m.u, e1: m.v, e2: m.w, h1, h2, t: stena };
}
