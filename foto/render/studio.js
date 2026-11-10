/* Foto-vizuál: společné „studio“ – renderer, světlo z HDRI, stíny, kamera, doostření a export fotky.
 *
 * Svět je v metrech, osa Y nahoru. Modely z jader konfigurátoru jsou v mm s osou Z nahoru – vkládají se do
 * skupiny `stage` (otočené a zmenšené), takže se s jejich souřadnicemi nic nepočítá ani nepřepisuje.
 *
 * Kvalita má dva režimy:
 *   pohyb     – jeden snímek, MSAA, rozlišení se přizpůsobuje rychlosti (adaptivně)
 *   doostření – po zastavení se skládá až N snímků s posunem o zlomek pixelu (vyhlazení hran),
 *               s rozptylem slunce (měkké polostíny) a volitelně s rozptylem objektivu (hloubka ostrosti)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const ASSETS = new URL('../assets/', import.meta.url).href;

/* Prostředí: HDRI (Poly Haven, CC0) + podlaha + pozadí. `sun` se dopočítá z nejjasnějšího místa HDRI. */
export const PROSTREDI = {
  studio: { lab: 'Studio', hdr: 'studio_small_08_1k.hdr', pozadi: ['#f4f5f7', '#dfe2e7'], podlaha: 'cyc', env: 1.0, slunce: 1.5, vyska: 58, rozptyl: 0.06, exp: 1.0 },
  teple: { lab: 'Teplé studio', hdr: 'brown_photostudio_02_1k.hdr', pozadi: ['#f3eee7', '#d9cfc2'], podlaha: 'cyc', env: 1.0, slunce: 1.3, vyska: 55, rozptyl: 0.07, exp: 1.0 },
  terasa: { lab: 'Venku – obloha', hdr: 'kloofendal_48d_partly_cloudy_puresky_1k.hdr', pozadi: 'hdr', rozmazani: 0.04, podlaha: 'beton', env: 0.9, slunce: 2.2, rozptyl: 0.012, exp: 1.0 },
  zahrada: { lab: 'Zahrada', hdr: 'rooitou_park_1k.hdr', pozadi: 'hdr', rozmazani: 0.05, podlaha: 'terasa', env: 1.0, slunce: 2.6, rozptyl: 0.03, exp: 1.0 }
};

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* průměrování snímků (doostření) – lineární HDR, tónování až za ním */
class SkladaniPass extends Pass {
  constructor() {
    super();
    this.n = 0; this.a = null; this.b = null;
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.mix = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tNew: { value: null }, tAcc: { value: null }, w: { value: 1 } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D tNew, tAcc; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(tAcc, vUv), texture2D(tNew, vUv), w); }'
    }));
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { t: { value: null } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }'
    }));
  }
  setSize(w, h) {
    if (this.a) { this.a.dispose(); this.b.dispose(); }
    const o = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.a = new THREE.WebGLRenderTarget(w, h, o); this.b = new THREE.WebGLRenderTarget(w, h, o); this.n = 0;
  }
  render(renderer, writeBuffer, readBuffer) {
    const u = this.mix.material.uniforms;
    u.tNew.value = readBuffer.texture; u.tAcc.value = this.a.texture; u.w.value = 1 / (this.n + 1);
    renderer.setRenderTarget(this.b); this.mix.render(renderer);
    const t = this.a; this.a = this.b; this.b = t; this.n++;
    this.copy.material.uniforms.t.value = this.a.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.copy.render(renderer);
  }
  dispose() { if (this.a) { this.a.dispose(); this.b.dispose(); } this.mix.dispose(); this.copy.dispose(); }
}

/* nejjasnější místo HDRI = směr hlavního světla (aby stín seděl s odlesky) */
function smerSlunce(tex) {
  const { data, width: w, height: h } = tex.image, ch = data.length / (w * h);
  const krok = Math.max(1, Math.floor(w / 512)), lum = [];
  for (let y = 0; y < h; y += krok) for (let x = 0; x < w; x += krok) {
    const i = (y * w + x) * ch, L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    lum.push(L);
  }
  const sorted = Float32Array.from(lum).sort(), prah = sorted[Math.floor(sorted.length * 0.997)];
  const s = new THREE.Vector3(); let k = 0, E = 0;
  const dw = (Math.PI / (h / krok)) * (2 * Math.PI / (w / krok));
  for (let y = 0; y < h; y += krok) for (let x = 0; x < w; x += krok) {
    const L = lum[k++];
    const v = 1 - (y + 0.5) / h, u = (x + 0.5) / w, lat = (v - 0.5) * Math.PI, lon = (u - 0.5) * 2 * Math.PI;
    if (lat > 0) E += Math.min(L, Math.max(6, sorted[Math.floor(sorted.length * 0.5)] * 14)) * Math.sin(lat) * Math.cos(lat) * dw;   // osvětlení vodorovné plochy (slunce oříznuté)
    if (L < prah) continue;
    const wgt = L * Math.cos(lat);
    s.x += Math.cos(lon) * Math.cos(lat) * wgt; s.y += Math.sin(lat) * wgt; s.z += Math.sin(lon) * Math.cos(lat) * wgt;
  }
  if (s.lengthSq() < 1e-9) s.set(-0.4, 0.8, 0.45);
  s.normalize();
  /* slunce v HDRI oříznout – svítí místo něj směrové světlo se stínem (jinak by svítilo dvakrát a pálilo plochy do bíla) */
  const strop = Math.max(6, sorted[Math.floor(sorted.length * 0.5)] * 14);
  for (let i = 0; i < data.length; i += ch) {
    const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (L > strop) { const q = strop / L; data[i] *= q; data[i + 1] *= q; data[i + 2] *= q; }
  }
  tex.needsUpdate = true;
  return { dir: s, jas: Math.max(0.02, E / Math.PI) };                  // jas = co odrazí bílá matná plocha
}

export function createStudio(host, opts = {}) {
  const mobil = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
  const klid = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = { prMax: Math.min(mobil ? 1.75 : 2, devicePixelRatio || 1), pr: 1, snimku: mobil ? 16 : 40, stin: mobil ? 2048 : 4096, ao: true, dof: false, lite: false };
  q.pr = q.prMax;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { host.innerHTML = '<p class="bez3d">3D náhled nejde spustit – prohlížeč nemá zapnuté WebGL.</p>'; return null; }
  if (!renderer.capabilities.isWebGL2) q.lite = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(q.pr);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  canvas.tabIndex = 0; canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', 'Otočný 3D pohled na výrobek. Šipky otáčejí, plus a minus přibližují, Home vrátí celkový pohled.');
  host.appendChild(canvas);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov || 36, 1, 0.01, 120);
  camera.position.set(1.2, 0.9, 1.6);
  const stage = new THREE.Group(); stage.rotation.x = -Math.PI / 2; stage.scale.setScalar(0.001); scene.add(stage);
  const content = new THREE.Group(); stage.add(content);
  const okoli = new THREE.Group(); stage.add(okoli);                    // stavba kolem (deska, fasáda) – nepočítá se do záběru kamery

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !klid; controls.dampingFactor = 0.09; controls.zoomToCursor = true;
  controls.rotateSpeed = 0.75; controls.zoomSpeed = 1.1; controls.minDistance = 0.05; controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI * 0.515;

  /* ---------- světla ---------- */
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.castShadow = true;
  sun.shadow.mapSize.set(q.stin, q.stin); sun.shadow.bias = -0.00012; sun.shadow.normalBias = 0.0018; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3(-0.4, 0.8, 0.45).normalize();
  let envCfg = PROSTREDI.studio, envId = '';

  /* ---------- podlaha ---------- */
  const floor = new THREE.Group(); scene.add(floor);
  const shadowFloor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.ShadowMaterial({ opacity: 0.3, color: 0x10141a }));
  shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.receiveShadow = true; floor.add(shadowFloor);
  let pbrFloor = null;
  const texLoader = new THREE.TextureLoader();
  const texCache = new Map();
  function tex(file, srgb, mm, rot) {
    const key = file + '|' + mm + '|' + (rot || 0);
    if (texCache.has(key)) return texCache.get(key);
    const t = texLoader.load(ASSETS + 'tex/' + file, () => invalidate());
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (mm) t.repeat.set(1 / mm, 1 / mm);
    if (rot) t.rotation = rot;
    texCache.set(key, t); return t;
  }
  function pbrSet(name, mm, extra, rot) {
    return Object.assign({ map: tex(name + '_Diffuse.jpg', true, mm, rot), normalMap: tex(name + '_nor_gl.jpg', false, mm, rot),
      roughnessMap: tex(name + '_arm.jpg', false, mm, rot), aoMap: tex(name + '_arm.jpg', false, mm, rot) }, extra || {});
  }
  function makePbrFloor(kind) {
    if (pbrFloor) { floor.remove(pbrFloor); pbrFloor.geometry.dispose(); pbrFloor.material.dispose(); pbrFloor = null; }
    if (kind === 'cyc') return;
    const R = 9, g = new THREE.CircleGeometry(R, 96), uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getY(i));                 // UV v metrech
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 40, 128, 128, 128);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(1, '#000'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    const alpha = new THREE.CanvasTexture(c);
    const set = kind === 'terasa' ? pbrSet('wood_floor_deck', 1.6, { roughness: 1 }) : pbrSet('concrete_floor_worn_001', 2.2, { roughness: 1 });
    const m = new THREE.MeshStandardMaterial(Object.assign(set, { transparent: true, metalness: 0 }));
    m.alphaMap = alpha; alpha.channel = 1;
    g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(Array.from({ length: p.count }, (_, i) => [p.getX(i) / (2 * R) + 0.5, p.getY(i) / (2 * R) + 0.5]).flat()), 2));
    pbrFloor = new THREE.Mesh(g, m); pbrFloor.rotation.x = -Math.PI / 2; pbrFloor.receiveShadow = true; pbrFloor.position.y = -0.0006; floor.add(pbrFloor);
  }

  /* ---------- kontaktní stín (měkký stín z oblohy pod výrobkem) – peče se jen při změně modelu ---------- */
  const kontakt = (() => {
    const RES = 512, rtA = new THREE.WebGLRenderTarget(RES, RES), rtB = new THREE.WebGLRenderTarget(RES, RES);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const depthMat = new THREE.ShaderMaterial({
      uniforms: { uH: { value: 1 } }, side: THREE.DoubleSide,
      vertexShader: 'varying float vH; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vH = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uH; varying float vH; void main(){ float a = clamp(1.0 - vH / uH, 0.0, 1.0); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a); }'
    });
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const blur = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, d: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D t; uniform vec2 d; varying vec2 vUv;
        void main(){ float a = 0.0; float w[5]; w[0]=0.227; w[1]=0.194; w[2]=0.121; w[3]=0.054; w[4]=0.016;
          a += texture2D(t, vUv).a * w[0];
          for (int i = 1; i < 5; i++) { a += texture2D(t, vUv + d * float(i)).a * w[i]; a += texture2D(t, vUv - d * float(i)).a * w[i]; }
          gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`
    }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2)); geo.setIndex([0, 1, 2, 0, 2, 3]);
    const plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: rtA.texture, transparent: true, opacity: 0.62, depthWrite: false, color: 0x0b0e12, toneMapped: false }));
    plane.renderOrder = 1; plane.frustumCulled = false; plane.visible = false; scene.add(plane);
    function bake(box, y) {
      if (!box || box.isEmpty()) { plane.visible = false; return; }
      const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const S = Math.max(sz.x, sz.z) * 1.5 + 0.3, H = Math.min(0.9, Math.max(0.25, sz.y));
      cam.left = -S / 2; cam.right = S / 2; cam.top = S / 2; cam.bottom = -S / 2; cam.near = 0; cam.far = H;
      cam.position.set(c.x, y, c.z); cam.up.set(0, 0, -1); cam.lookAt(c.x, y + 1, c.z); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      depthMat.uniforms.uH.value = H;
      const vis = [floor.visible, plane.visible, sun.visible]; floor.visible = false; plane.visible = false;
      const bg = scene.background, om = scene.overrideMaterial; scene.background = null; scene.overrideMaterial = depthMat;
      const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
      renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(scene, cam);
      scene.overrideMaterial = om; scene.background = bg; floor.visible = vis[0];
      const u = blur.material.uniforms;
      [[2.4, 1.2], [1.0, 0.6]].forEach(([a]) => {
        u.t.value = rtA.texture; u.d.value.set(a / RES, 0); renderer.setRenderTarget(rtB); blur.render(renderer);
        u.t.value = rtB.texture; u.d.value.set(0, a / RES); renderer.setRenderTarget(rtA); blur.render(renderer);
      });
      renderer.setRenderTarget(null); renderer.setClearColor(cc, ca);
      const P = geo.attributes.position, v = new THREE.Vector3();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([nx, ny], i) => { v.set(nx, ny, -1).unproject(cam); P.setXYZ(i, v.x, y + 0.0004, v.z); });
      P.needsUpdate = true; plane.visible = true;
    }
    return { bake, plane };
  })();

  /* ---------- skládání obrazu ---------- */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q.lite ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.updateGtaoMaterial({ radius: 0.07, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);
  /* při doostřování se šum AO každý snímek mění, takže se průměrováním vyhladí */
  const sumyAO = Array.from({ length: 12 }, () => {
    const n = 32, d = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) { const a = Math.random() * Math.PI * 2; d[i * 4] = (Math.cos(a) * 0.5 + 0.5) * 255; d[i * 4 + 1] = (Math.sin(a) * 0.5 + 0.5) * 255; d[i * 4 + 2] = 127; d[i * 4 + 3] = Math.random() * 255; }
    const t = new THREE.DataTexture(d, n, n); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t;
  });
  const sklad = new SkladaniPass(); composer.addPass(sklad);
  composer.addPass(new OutputPass());

  /* ---------- stav smyčky ---------- */
  let W = 2, H = 2, bounds = new THREE.Box3(), vse = new THREE.Box3(), floorY = 0, posledniPohyb = 0, vPohybu = true, hotovo = false, casy = [], animace = null, zrusit = false;
  const udalosti = { snimek: [], kvalita: [], obnova: [] };
  function velikost(force) {
    const r = host.getBoundingClientRect(), w = Math.max(16, Math.round(r.width)), h = Math.max(16, Math.round(r.height));
    if (!force && w === W && h === H) return;
    W = w; H = h; renderer.setPixelRatio(q.pr); renderer.setSize(w, h, false); composer.setPixelRatio(q.pr); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix(); if (typeof srovnejFotku === 'function') srovnejFotku(); invalidate();
  }
  new ResizeObserver(() => velikost()).observe(host);
  function nastavPr(pr) { pr = Math.round(pr * 100) / 100; if (Math.abs(pr - q.pr) < 0.01) return; q.pr = pr; velikost(true); }
  function invalidate() { posledniPohyb = performance.now(); vPohybu = true; hotovo = false; sklad.n = 0; }
  controls.addEventListener('change', invalidate);

  function umistiSlunce(i) {
    const B = vse.isEmpty() ? bounds : vse;
    const c = B.isEmpty() ? new THREE.Vector3() : B.getCenter(new THREE.Vector3());
    const R = B.isEmpty() ? 1 : B.getSize(new THREE.Vector3()).length() / 2 + 0.05;
    let r = R;
    /* při přiblížení se stínová mapa soustředí na to, co je vidět – stín zůstane ostrý i na detailu */
    const dist = camera.position.distanceTo(controls.target), zaber = Math.max(0.35, dist * 1.15);
    if (zaber < R) { r = zaber; c.copy(controls.target).clamp(B.min, B.max); }
    const d = sunDir.clone();
    if (i > 0) {                                                        // rozptyl slunce = měkký polostín
      const a = halton(i, 2) * Math.PI * 2, rr = Math.sqrt(halton(i, 3)) * envCfg.rozptyl;
      const t1 = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize(), t2 = new THREE.Vector3().crossVectors(d, t1);
      d.addScaledVector(t1, Math.cos(a) * rr).addScaledVector(t2, Math.sin(a) * rr).normalize();
    }
    sun.position.copy(c).addScaledVector(d, R * 3 + 1); sun.target.position.copy(c);
    const s = sun.shadow.camera; s.left = -r; s.right = r; s.top = r; s.bottom = -r; s.near = 0.05; s.far = R * 6 + 2; s.updateProjectionMatrix();
    sun.shadow.normalBias = 0.0018 * Math.max(0.25, r / 1.2);
  }

  const _o = new THREE.Vector3(), _p = new THREE.Vector3(), _qt = new THREE.Quaternion();
  renderer.info.autoReset = false;                                     // počty za celý snímek (všechny průchody), ne jen za poslední
  function snimek(i) {
    renderer.info.reset();
    umistiSlunce(i);
    gtao.gtaoMaterial.uniforms.tNoise.value = i > 0 ? sumyAO[i % sumyAO.length] : gtao.gtaoNoiseTexture;
    const db = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (i > 0) camera.setViewOffset(db.x, db.y, halton(i, 2) - 0.5, halton(i, 3) - 0.5, db.x, db.y); else camera.clearViewOffset();
    let vratit = false;
    if (i > 0 && q.dof) {                                               // rozptyl objektivu kolem bodu ostření
      const dist = camera.position.distanceTo(controls.target), ap = dist * (q.clona || 0.012);
      const a = halton(i, 5) * Math.PI * 2, rr = Math.sqrt(halton(i, 7)) * ap;
      _p.copy(camera.position); _qt.copy(camera.quaternion); vratit = true;
      _o.set(Math.cos(a) * rr, Math.sin(a) * rr, 0).applyQuaternion(camera.quaternion);
      camera.position.add(_o); camera.lookAt(controls.target); camera.updateMatrixWorld();
    }
    composer.render();
    if (vratit) { camera.position.copy(_p); camera.quaternion.copy(_qt); camera.updateMatrixWorld(); }
    camera.clearViewOffset();
  }

  let rafId = 0, minuly = performance.now();
  function smycka(t) {
    rafId = requestAnimationFrame(smycka);
    if (zrusit) return;
    const dt = t - minuly; minuly = t;
    if (animace) animace(t);
    controls.update();
    const ted = performance.now();
    if (vPohybu && ted - posledniPohyb > 140 && !animace) {            // zastavil se → přepnout na doostření
      vPohybu = false; gtao.enabled = q.ao && !q.lite;
      if (q.pr < q.prMax) nastavPr(q.prMax);
      sklad.n = 0; hotovo = false;
    }
    if (vPohybu) {
      gtao.enabled = q.ao && !q.lite && !q.aoJenVKlidu;
      sklad.n = 0; snimek(0);
      if (dt < 200) { casy.push(dt); if (casy.length > 24) casy.shift(); }
      if (casy.length >= 12) {                                          // adaptivní rozlišení podle rychlosti
        const avg = casy.reduce((a, b) => a + b, 0) / casy.length;
        if (avg > 26 && q.pr > 0.75) { casy = []; if (!q.aoJenVKlidu) { q.aoJenVKlidu = true; } else nastavPr(Math.max(0.75, q.pr - 0.25)); posledniPohyb = ted; vPohybu = true; }
      }
      udalosti.snimek.forEach((f) => f(dt));
    } else if (!hotovo) {
      const n = q.lite ? 1 : q.snimku;
      snimek(sklad.n);
      if (sklad.n >= n) { hotovo = true; udalosti.kvalita.forEach((f) => f('ostre')); }
      udalosti.snimek.forEach((f) => f(dt));
    }
  }

  /* ---------- prostředí ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envCache = new Map();
  function pozadiGradient(a, b) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const x = c.getContext('2d'), g = x.createRadialGradient(256, 215, 30, 256, 256, 420);
    g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  async function prostredi(id) {
    const E = PROSTREDI[id] || PROSTREDI.studio; envId = PROSTREDI[id] ? id : 'studio';
    let e = envCache.get(E.hdr);
    if (!e) {
      const loader = new HDRLoader(); loader.setDataType(THREE.FloatType);
      const eq = await loader.loadAsync(ASSETS + 'hdri/' + E.hdr);
      eq.mapping = THREE.EquirectangularReflectionMapping;
      const an = smerSlunce(eq);                                        // zároveň ořízne slunce v datech
      e = { eq, pmrem: pmrem.fromEquirectangular(eq).texture, dir: an.dir, jas: an.jas };
      envCache.set(E.hdr, e);
    }
    if (PROSTREDI[envId] !== E) return;                                 // mezitím zvoleno jiné
    /* každé HDRI je jinak jasné – srovnat tak, aby bílá matná plocha vyšla na stejný jas */
    envCfg = E; scene.environment = e.pmrem; scene.environmentIntensity = E.env * 0.5 / e.jas;
    if (E.pozadi === 'hdr') { scene.background = e.eq; scene.backgroundBlurriness = E.rozmazani; scene.backgroundIntensity = E.env * 0.5 / e.jas; }
    else { scene.background = pozadiGradient(E.pozadi[0], E.pozadi[1]); scene.backgroundBlurriness = 0; }
    /* hlavní světlo svítí vždy zleva zepředu (stín padá doprava dozadu); HDRI se k němu natočí, aby seděly odlesky */
    const az = opts.azimut != null ? opts.azimut : -0.62, el = THREE.MathUtils.degToRad(E.vyska || Math.max(38, THREE.MathUtils.radToDeg(Math.asin(e.dir.y))));
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const otoc = az - Math.atan2(e.dir.x, e.dir.z);
    scene.environmentRotation.set(0, otoc, 0); scene.backgroundRotation.set(0, otoc, 0);
    sun.intensity = E.slunce; renderer.toneMappingExposure = E.exp;
    makePbrFloor(opts.podlaha === false ? 'cyc' : E.podlaha);
    shadowFloor.visible = E.podlaha === 'cyc' && opts.podlaha !== false;
    fotka = null;
    shadowFloor.material.opacity = E.pozadi === 'hdr' ? 0.4 : 0.26;
    kontakt.plane.material.opacity = E.pozadi === 'hdr' ? 0.5 : 0.6;
    invalidate();
  }

  /* vlastní fotka jako pozadí (balkon, schodiště zákazníka) – zůstává jen v prohlížeči, nikam se neposílá */
  let fotka = null;
  function srovnejFotku() {
    if (!fotka) return; const a = fotka.image.width / fotka.image.height, b = W / H;
    if (a > b) { fotka.repeat.set(b / a, 1); fotka.offset.set((1 - b / a) / 2, 0); } else { fotka.repeat.set(1, a / b); fotka.offset.set(0, (1 - a / b) / 2); }
  }
  function pozadiFotka(img) {
    const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    fotka = t; srovnejFotku(); scene.background = t; scene.backgroundBlurriness = 0; scene.backgroundIntensity = 1; scene.backgroundRotation.set(0, 0, 0); invalidate();
  }

  /* ---------- obsah a kamera ---------- */
  function obsahZmenen(o = {}) {
    stage.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(content); vse = bounds.clone().union(new THREE.Box3().setFromObject(okoli));
    if (o.podlahaZ != null) floorY = o.podlahaZ / 1000; else floorY = bounds.isEmpty() ? 0 : bounds.min.y;
    floor.position.y = floorY;
    if (opts.kontakt !== false && o.kontakt !== false) kontakt.bake(bounds, floorY); else kontakt.plane.visible = false;
    const r = bounds.isEmpty() ? 1 : bounds.getSize(new THREE.Vector3()).length() / 2;
    gtao.updateGtaoMaterial({ radius: THREE.MathUtils.clamp(r * 0.11, 0.03, 0.14) });
    if (!vse.isEmpty()) gtao.setSceneClipBox(vse.clone().expandByScalar(Math.max(0.15, r * 0.35)));
    controls.maxDistance = Math.max(4, r * 9); camera.near = Math.max(0.004, r * 0.004); camera.far = Math.max(80, r * 60); camera.updateProjectionMatrix();
    invalidate();
  }
  const POHLEDY = { celek: opts.celek || [0.62, 0.42, 0.9], zepredu: [0, 0.1, 1], zboku: [1, 0.1, 0], shora: [0.0001, 1, 0.0001], zezadu: [-0.55, 0.35, -0.9] };
  function vzdalenostCelku(mar = 0.92) {
    const r = bounds.getSize(new THREE.Vector3()).length() / 2 || 1, f = THREE.MathUtils.degToRad(camera.fov / 2);
    return r / Math.sin(Math.min(f, Math.atan(Math.tan(f) * camera.aspect))) * mar;
  }
  function let_(pos, target, ms = 700) {
    if (klid) ms = 0;
    const p0 = camera.position.clone(), t0 = controls.target.clone(), z = performance.now();
    if (!ms) { camera.position.copy(pos); controls.target.copy(target); controls.update(); animace = null; invalidate(); return; }
    const d0 = p0.clone().sub(t0), d1 = pos.clone().sub(target), s0 = new THREE.Spherical().setFromVector3(d0), s1 = new THREE.Spherical().setFromVector3(d1);
    let dth = s1.theta - s0.theta; if (dth > Math.PI) dth -= 2 * Math.PI; if (dth < -Math.PI) dth += 2 * Math.PI;
    const tl = controls.enableDamping; controls.enableDamping = false;
    animace = (t) => {
      const k = ease(Math.min(1, (t - z) / ms));
      const s = new THREE.Spherical(THREE.MathUtils.lerp(s0.radius, s1.radius, k), THREE.MathUtils.lerp(s0.phi, s1.phi, k), s0.theta + dth * k);
      controls.target.lerpVectors(t0, target, k); camera.position.setFromSpherical(s).add(controls.target); camera.lookAt(controls.target); invalidate();
      if (k >= 1) { animace = null; controls.enableDamping = tl; }
    };
  }
  function pohled(jmeno, ms) {
    if (bounds.isEmpty()) return;
    const c = bounds.getCenter(new THREE.Vector3()), d = new THREE.Vector3().fromArray(POHLEDY[jmeno] || POHLEDY.celek).normalize();
    let_(c.clone().addScaledVector(d, vzdalenostCelku()), c, ms);
  }
  /* detail: bod v souřadnicích modelu (mm, Z nahoru), směr pohledu tamtéž a vzdálenost v mm */
  const zModelu = (v) => stage.localToWorld(new THREE.Vector3(v[0], v[1], v[2]));
  function detail(o, ms) {
    stage.updateMatrixWorld(true);
    const t = zModelu(o.bod), d = new THREE.Vector3(o.smer[0], o.smer[2], -o.smer[1]).normalize();
    let_(t.clone().addScaledVector(d, o.vzd / 1000), t, ms);
  }

  /* dvojklik myší = přiblížit na místo, dvojité klepnutí prstem = celkový pohled */
  const ray = new THREE.Raycaster(); let typ = 'mouse';
  canvas.addEventListener('pointerdown', (e) => { typ = e.pointerType; canvas.focus({ preventScroll: true }); });
  canvas.addEventListener('dblclick', (e) => {
    if (typ === 'touch') { pohled('celek'); return; }
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(content, true)[0];
    if (!hit) { pohled('celek'); return; }
    const dir = camera.position.clone().sub(hit.point).normalize(), dist = Math.max(0.09, camera.position.distanceTo(hit.point) * 0.32);
    let_(hit.point.clone().addScaledVector(dir, dist), hit.point, 600);
  });
  canvas.addEventListener('keydown', (e) => {
    const off = camera.position.clone().sub(controls.target), s = new THREE.Spherical().setFromVector3(off), k = e.key;
    if (k === 'ArrowLeft') s.theta -= 0.12; else if (k === 'ArrowRight') s.theta += 0.12;
    else if (k === 'ArrowUp') s.phi = Math.max(0.05, s.phi - 0.1); else if (k === 'ArrowDown') s.phi = Math.min(controls.maxPolarAngle, s.phi + 0.1);
    else if (k === '+' || k === '=') s.radius = Math.max(controls.minDistance, s.radius * 0.85); else if (k === '-') s.radius = Math.min(controls.maxDistance, s.radius / 0.85);
    else if (k === 'Home') { pohled('celek'); e.preventDefault(); return; } else return;
    e.preventDefault(); camera.position.setFromSpherical(s).add(controls.target); camera.lookAt(controls.target); invalidate();
  });

  /* ---------- fotka: PNG ve větším rozlišení, bez ovládacích prvků ---------- */
  async function foto(nasobek = 2, jmeno = 'foto') {
    zrusit = true;
    const pr0 = q.pr, max = renderer.capabilities.maxTextureSize, cil = Math.min(nasobek * Math.max(1, devicePixelRatio || 1), Math.floor(Math.min(max, 8192) / Math.max(W, H)));
    q.pr = cil; renderer.setPixelRatio(cil); renderer.setSize(W, H, false); composer.setPixelRatio(cil); composer.setSize(W, H);
    gtao.enabled = q.ao && !q.lite; sklad.n = 0;
    const n = q.lite ? 1 : Math.max(24, q.snimku);
    for (let i = 0; i < n; i++) { snimek(sklad.n); if (i % 8 === 7) await new Promise((r) => setTimeout(r)); }
    snimek(sklad.n);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    q.pr = pr0; velikost(true); zrusit = false;
    if (blob && jmeno) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000); }
    return blob;
  }

  /* ztráta a obnova WebGL kontextu (mobil, přepnutí grafiky): světlo z HDRI a zapečený stín se musí spočítat znovu */
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); zrusit = true; });
  canvas.addEventListener('webglcontextrestored', () => {
    envCache.forEach((e) => { e.pmrem.dispose(); e.pmrem = pmrem.fromEquirectangular(e.eq).texture; });
    zrusit = false; const id = envId; envId = '';
    prostredi(id || 'studio').then(() => { obsahZmenen({ podlahaZ: floorY * 1000 }); udalosti.obnova.forEach((f) => f()); });
  });

  velikost(true);
  rafId = requestAnimationFrame(smycka);

  return {
    THREE, renderer, scene, camera, controls, stage, content, okoli, sun, q, maxAniso, mobil,
    prostredi, pozadiFotka, obsahZmenen, pohled, detail, let: let_, foto, invalidate, tex, pbrSet,
    get bounds() { return bounds; }, get prostrediId() { return envId; }, get ostre() { return hotovo; }, get snimku() { return sklad.n; },
    vzdalenostCelku, zModelu,
    na(ev, f) { udalosti[ev].push(f); },
    nastav(o) { Object.assign(q, o); invalidate(); },
    info() { const i = renderer.info; return { volani: i.render.calls, trojuhelniku: i.render.triangles, geometrii: i.memory.geometries, textur: i.memory.textures, pr: q.pr, snimku: sklad.n }; },
    zrus() { cancelAnimationFrame(rafId); renderer.dispose(); }
  };
}
