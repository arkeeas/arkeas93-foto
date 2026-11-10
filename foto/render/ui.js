/* Foto-vizuál: drobné stavební kameny panelu voleb a společné chování stránek (odkaz na konfiguraci, kóty, AR, hlášky). */
import * as THREE from 'three';

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const nf = (n, d = 0) => Number(n).toLocaleString('cs-CZ', { maximumFractionDigits: d, minimumFractionDigits: d });

/* čipy: [{ id, lab, sub, img | barva | svg }] */
export function cipy(el, polozky, aktivni, vyber, o = {}) {
  el.className = 'mrizka' + (o.velke ? ' velke' : '');
  el.innerHTML = polozky.map((p) => '<button type="button" class="cip" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === aktivni) + '"' + (p.dis ? ' disabled' : '') + (p.title ? ' title="' + esc(p.title) + '"' : '') + '>' +
    (p.img ? '<img alt="" src="' + p.img + '">' : p.barva ? '<span class="koule" style="background:' + p.barva + '"></span>' : p.svg ? '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="' + p.svg + '"></path></svg>' : '') +
    '<span class="lab">' + esc(p.lab) + '</span>' + (p.sub ? '<span class="sub">' + esc(p.sub) + '</span>' : '') + '</button>').join('');
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => vyber(b.dataset.id)));
}
export function segment(el, polozky, aktivni, vyber) {
  el.className = 'segment'; el.setAttribute('role', 'group');
  el.innerHTML = polozky.map((p) => '<button type="button" data-id="' + esc(p.id) + '" aria-pressed="' + (String(p.id) === String(aktivni)) + '">' + esc(p.lab) + '</button>').join('');
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => vyber(b.dataset.id)));
}
/* posuvník s hodnotou v mm; při tažení volá `zmena` průběžně */
export function posuvnik(el, o, zmena) {
  const id = 'p' + Math.random().toString(36).slice(2, 8);
  el.className = 'posuv';
  el.innerHTML = '<label for="' + id + '">' + esc(o.lab) + '</label><output for="' + id + '">' + nf(o.value) + ' ' + (o.jednotka || 'mm') + '</output>' +
    '<input type="range" id="' + id + '" min="' + o.min + '" max="' + o.max + '" step="' + o.step + '" value="' + o.value + '">';
  const inp = el.querySelector('input'), out = el.querySelector('output');
  inp.addEventListener('input', () => { out.textContent = nf(inp.value) + ' ' + (o.jednotka || 'mm'); zmena(Number(inp.value)); });
  return { set(v) { if (document.activeElement !== inp) inp.value = v; out.textContent = nf(v) + ' ' + (o.jednotka || 'mm'); } };
}
let hlaskaT = 0;
export function hlaska(text, ms = 2600) {
  let el = document.querySelector('.hlaska'); if (!el) { el = document.createElement('div'); el.className = 'hlaska'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text; el.hidden = false; clearTimeout(hlaskaT); hlaskaT = setTimeout(() => { el.hidden = true; }, ms);
}

/* konfigurace v odkazu (#cfg=…) – jde poslat známému nebo si uložit */
export const doOdkazu = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function zOdkazu() {
  const m = /[#&]cfg=([A-Za-z0-9_-]+)/.exec(location.hash); if (!m) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; }
}
let odkazT = 0;
export function ulozOdkaz(obj) { clearTimeout(odkazT); odkazT = setTimeout(() => { try { history.replaceState(null, '', '#cfg=' + doOdkazu(obj)); } catch (e) { /* bez historie */ } }, 250); }
export async function sdilet(titul) {
  const url = location.href;
  try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: titul, url }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(url); hlaska('Odkaz na tuhle konfiguraci je zkopírovaný.'); } catch (e) { prompt('Odkaz na konfiguraci:', url); }
}
export const pamet = {
  cti(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  zapis(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bez úložiště */ } }
};
/* ceník z dílny (mimo Claude ho dodá lokal.js) */
export async function cenik(cesta, pouzij) {
  try { const db = window.claude && await window.claude.use('db'); if (db) db.doc(cesta).onSnapshot((s) => { if (s.exists) pouzij(s.data()); }, () => {}); } catch (e) { /* výchozí sazby */ }
}

/* kóty: úsečky v souřadnicích modelu (mm) promítnuté do obrazu; [{ a:[x,y,z], b:[x,y,z], text }] */
export function koty(studio, svg) {
  let seznam = [], zapnuto = false; const v = new THREE.Vector3();
  const bod = (p) => { v.copy(studio.zModelu(p)).project(studio.camera); const r = svg.getBoundingClientRect(); return [(v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height, v.z]; };
  function kresli() {
    if (!zapnuto) { svg.innerHTML = ''; return; }
    svg.innerHTML = seznam.map((k) => {
      const a = bod(k.a), b = bod(k.b); if (a[2] > 1 || b[2] > 1) return '';
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * 6, ny = dx / l * 6;
      return '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>' +
        '<line x1="' + (a[0] - nx) + '" y1="' + (a[1] - ny) + '" x2="' + (a[0] + nx) + '" y2="' + (a[1] + ny) + '"/><line x1="' + (b[0] - nx) + '" y1="' + (b[1] - ny) + '" x2="' + (b[0] + nx) + '" y2="' + (b[1] + ny) + '"/>' +
        '<text x="' + ((a[0] + b[0]) / 2 + nx * 2) + '" y="' + ((a[1] + b[1]) / 2 + ny * 2) + '" text-anchor="middle" dominant-baseline="middle">' + esc(k.text) + '</text>';
    }).join('');
  }
  studio.controls.addEventListener('change', kresli); new ResizeObserver(kresli).observe(svg);
  return { nastav(s) { seznam = s; kresli(); }, zapni(z) { zapnuto = z; kresli(); }, kresli };
}

/* „Zobraz v místnosti“: export GLB a prohlížeč <model-viewer> (WebXR na Androidu, Quick Look na iOS) */
export async function vMistnosti(studio, nazev) {
  hlaska('Připravuji model pro mobil…', 8000);
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const glb = await new GLTFExporter().parseAsync(studio.stage, { binary: true, onlyVisible: true });
  const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
  if (!customElements.get('model-viewer')) await import('https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js');
  let d = document.querySelector('dialog.okno.ar');
  if (!d) { d = document.createElement('dialog'); d.className = 'okno ar'; document.body.appendChild(d); }
  d.innerHTML = '<header><span>' + esc(nazev) + ' – zobrazit v místnosti</span><button type="button" class="tl" data-zavri>Zavřít</button></header><div class="telo">' +
    '<model-viewer src="' + url + '" ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" camera-controls shadow-intensity="0.8" tone-mapping="neutral" alt="' + esc(nazev) + '"></model-viewer>' +
    '<p class="pozn" style="color:var(--muted);font-size:13px;margin:10px 0 0">Na telefonu klepněte na ikonu krychle v rohu náhledu – výrobek se postaví na podlahu ve skutečné velikosti. Na počítači si model můžete uložit.</p>' +
    '<div class="drobne"><a href="' + url + '" download="' + esc(nazev.replace(/\s+/g, '-').toLowerCase()) + '.glb">Uložit model (GLB, ' + nf(glb.byteLength / 1048576, 1) + ' MB)</a></div></div>';
  d.querySelector('[data-zavri]').addEventListener('click', () => d.close());
  d.addEventListener('close', () => setTimeout(() => URL.revokeObjectURL(url), 1000), { once: true });
  document.querySelector('.hlaska').hidden = true; d.showModal();
}
