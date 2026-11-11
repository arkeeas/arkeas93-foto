/* Foto-vizuál: společná kostra stránky – studio, tlačítka pohledů a nástrojů, stav doostření, prostředí, kóty. */
import { createStudio, PROSTREDI } from './studio.js';
import { createMaterialy } from './materialy.js';
import { $, cipy, hlaska, koty as kotyVrstva, sdilet, vMistnosti } from './ui.js';

export function zaloz(o) {
  const studio = createStudio($('platno'), o.studio || {});
  if (!studio) return null;
  const mat = createMaterialy(studio), ladeni = /[?&]ladeni=1/.test(location.search);
  const ui = o.ui;                                                     // { prostredi, koty, dof, svary } – stav stránky

  /* pohledy */
  const pohledy = $('pohledy');
  function kresliPohledy(seznam) {
    pohledy.innerHTML = seznam.map((p, i) => '<button type="button" class="tl" data-i="' + i + '">' + p.lab + '</button>').join('');
    pohledy.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { const p = seznam[b.dataset.i]; if (p.detail) studio.detail(p.detail()); else studio.pohled(p.id); }));
  }

  /* nástroje nad scénou */
  const k = kotyVrstva(studio, $('koty'));
  const nastroje = $('nastroje');
  const tl = (id, lab, title) => '<button type="button" class="tl" id="' + id + '" title="' + title + '">' + lab + '</button>';
  nastroje.innerHTML = '<button type="button" class="tl hlavni" id="tFoto" title="Uloží obrázek PNG ve dvojnásobném rozlišení, bez tlačítek">Foto</button>' +
    '<button type="button" class="tl vice" id="tVice" aria-expanded="false" aria-label="Další nástroje">⋯</button><div class="dalsi" id="dalsi">' +
    tl('tKoty', 'Kóty', 'Zobrazí hlavní rozměry v mm') + tl('tDof', 'Hloubka ostrosti', 'Jemně rozostří pozadí jako objektiv fotoaparátu') +
    (o.ar ? tl('tAr', 'V místnosti', 'Zobrazí výrobek v místnosti přes fotoaparát telefonu (AR)') : '') +
    (o.dilna ? tl('tDilna', 'Technický pohled', 'Přepne na technický pohled pro kontrolu výroby') : '') +
    tl('tSdilet', 'Sdílet', 'Zkopíruje odkaz na tuhle konfiguraci') + tl('tCela', 'Celá obrazovka', 'Zobrazí scénu přes celou obrazovku') + '</div>';
  $('tVice').addEventListener('click', () => { const o = nastroje.classList.toggle('otevrene'); $('tVice').setAttribute('aria-expanded', String(o)); });
  const stisk = (el, v) => el.setAttribute('aria-pressed', String(!!v));
  $('tFoto').addEventListener('click', async () => {
    $('tFoto').disabled = true; $('tFoto').textContent = 'Fotím…';
    try { await studio.foto(2, o.nazevFotky ? o.nazevFotky() : 'foto'); hlaska('Fotka je uložená ve stažených souborech.'); } catch (e) { console.error(e); hlaska('Fotku se nepodařilo uložit.'); }
    $('tFoto').disabled = false; $('tFoto').textContent = 'Foto';
  });
  $('tKoty').addEventListener('click', () => { ui.koty = !ui.koty; stisk($('tKoty'), ui.koty); k.zapni(ui.koty); o.zmenaUi && o.zmenaUi(); });
  $('tDof').addEventListener('click', () => { ui.dof = !ui.dof; stisk($('tDof'), ui.dof); studio.nastav({ dof: ui.dof }); o.zmenaUi && o.zmenaUi(); });
  if (o.ar) $('tAr').addEventListener('click', () => vMistnosti(studio, o.nazev ? o.nazev() : 'Výrobek').catch((e) => { console.error(e); hlaska('Model pro mobil se nepodařilo připravit.'); }));
  if (o.dilna) $('tDilna').addEventListener('click', () => { ui.dilna = !ui.dilna; stisk($('tDilna'), ui.dilna); o.dilna(ui.dilna); o.zmenaUi && o.zmenaUi(); });
  $('tSdilet').addEventListener('click', () => sdilet(document.title));
  $('tCela').addEventListener('click', () => { const s = document.querySelector('.scena'); if (document.fullscreenElement) document.exitFullscreen(); else s.requestFullscreen && s.requestFullscreen(); });
  stisk($('tKoty'), ui.koty); stisk($('tDof'), ui.dof); k.zapni(!!ui.koty); studio.nastav({ dof: !!ui.dof });

  /* stav: doostřování / hotovo; s ?ladeni=1 i FPS a počty */
  const stav = $('stav'); let fps = [], posl = 0;
  studio.na('snimek', (dt) => {
    k.kresli();
    fps.push(dt); if (fps.length > 30) fps.shift();
    const ted = performance.now(); if (ted - posl < 250) return; posl = ted;
    const prum = fps.reduce((a, b) => a + b, 0) / fps.length, i = studio.info();
    stav.classList.toggle('ok', studio.ostre && !ladeni);
    stav.textContent = ladeni ? Math.round(1000 / prum) + ' FPS · ' + Math.round(i.trojuhelniku / 1000) + ' tis. trojúh. · ' + i.volani + ' volání · ×' + i.pr + ' · ' + i.snimku + ' sn.' : studio.ostre ? 'Hotovo' : 'Doostřuji…';
  });
  studio.na('kvalita', () => { stav.classList.toggle('ok', !ladeni); if (!ladeni) stav.textContent = 'Hotovo'; if (ladeni) console.log('[foto] doostřeno', studio.info()); });

  /* prostředí – čipy s náhledem */
  function kresliProstredi(el, seznam, popis) {
    const barva = (id) => (PROSTREDI[id].pozadi === 'hdr' ? (id === 'zahrada' ? 'linear-gradient(#b9d3e6 45%,#7c9a62 46%)' : 'linear-gradient(#8fb8e0 55%,#c9c5bd 56%)') : 'radial-gradient(circle at 50% 40%,' + PROSTREDI[id].pozadi[0] + ',' + PROSTREDI[id].pozadi[1] + ')');
    cipy(el, seznam.map((id) => ({ id, lab: PROSTREDI[id].lab, barva: barva(id) })),
      ui.prostredi, (id) => { ui.prostredi = id; studio.prostredi(id).then(() => o.poProstredi && o.poProstredi()); kresliProstredi(el, seznam, popis); o.zmenaUi && o.zmenaUi(); }, { velke: false });
    if (popis && PROSTREDI[ui.prostredi]) popis(PROSTREDI[ui.prostredi].lab, barva(ui.prostredi));
  }
  /* „Moje fotka“: vlastní snímek balkonu nebo schodiště jako pozadí – model se k němu natočí myší */
  function mojeFotka(el, poVyberu) {
    el.innerHTML = '<div class="drobne"><button type="button" id="tFotka">Vložit moji fotku jako pozadí</button></div><input type="file" id="fFotka" accept="image/*" hidden><p class="pozn">Fotka zůstane jen ve vašem prohlížeči. Zábradlí si k ní natočte a přibližte myší nebo prsty.</p>';
    $('tFotka').addEventListener('click', () => $('fFotka').click());
    $('fFotka').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return; const img = new Image();
      img.onload = () => { studio.pozadiFotka(img); poVyberu && poVyberu(); hlaska('Fotka je na pozadí. Natočte si model podle ní.'); }; img.src = URL.createObjectURL(f);
    });
  }
  /* ?cisto=1 – jen scéna bez ovládání (pro snímky a náhledové obrázky) */
  if (/[?&]cisto=1/.test(location.search)) document.body.classList.add('cisto');
  return { studio, mat, koty: k, kresliPohledy, kresliProstredi, mojeFotka, ladeni };
}
