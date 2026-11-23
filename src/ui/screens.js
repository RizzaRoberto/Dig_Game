// Schermate HTML: iniziale, scelta livello, interfaccia di gioco e risultato.
// In Unity sarebbero Canvas UI; qui sono elementi HTML sopra il canvas 3D.
import { TOOLS, INTERFACCIA } from '../config.js';
import { LEVELS } from '../levels.js';
import { loadProgress, isUnlocked } from '../progress.js';

const $ = s => document.querySelector(s);

// Telefono o tablet? (schermo touch senza mouse): niente tasti da tastiera nei testi
export const isMobile = matchMedia('(hover: none) and (pointer: coarse)').matches;
document.body.classList.toggle('mobile', isMobile);

// Comandi mostrati nel riquadro sotto al pannello
const COMANDI_PC = [
  ['Clic sinistro', 'scava'],
  ['Tasto destro', 'ruota'],
  ['Shift + trascina', 'ruota'],
  ['Rotellina', 'zoom'],
  ['1 2 3', 'strumenti'],
  ['S', 'scanner'],
  ['R', 'ricomincia'],
  ['D', 'pannello di debug'],
];
const COMANDI_MOBILE = [
  ['Un dito', 'scava'],
  ['Due dita', 'ruota e zoom'],
];
export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);

export class UI {
  /** @param h callback: play(levelIndex, ar), tool(i), scan(), retry(), next(), menu() */
  constructor(h) {
    this.h = h; this.cache = '';
    $('#playBtn').onclick = () => this.show('levels');
    // senza schermata iniziale, "Indietro" torna al gioco
    $('#levelsBack').onclick = () => INTERFACCIA.schermataIniziale ? this.show('start') : h.back();
    // spunta "Mostra strumento" (solo su PC), ricordata nel browser
    const cb = $('#showTool');
    try { cb.checked = localStorage.getItem('scavo3d.mostraStrumento') !== '0'; } catch (e) { /* storage non disponibile */ }
    cb.onchange = () => { try { localStorage.setItem('scavo3d.mostraStrumento', cb.checked ? '1' : '0'); } catch (e) { /* ignorato */ } cb.blur(); };
    $('#legendList').innerHTML = (isMobile ? COMANDI_MOBILE : COMANDI_PC).map(([k, v]) => `<li><b>${k}</b><span>${v}</span></li>`).join('');
    $('#menuBtn').onclick = h.menu; $('#levelsBtn').onclick = h.menu;
    $('#retryBtn').onclick = h.retry; $('#nextBtn').onclick = h.next;
    $('#scanBtn').onclick = h.scan;
    $('#arBtn').onclick = h.enterAR;
    TOOLS.forEach((t, i) => {
      const b = document.createElement('button'); b.dataset.t = i;
      b.innerHTML = `${t.name}<small>${t.hint}</small>`;
      b.onclick = () => h.tool(i); $('#toolbar').insertBefore(b, $('#scanBtn'));
    });
  }

  get screen() { return document.body.dataset.screen; }
  get showTool() { return !isMobile && $('#showTool').checked; }
  show(name) {
    document.body.dataset.screen = name;
    if (name === 'levels') this.renderLevels();
    if (name !== 'game') this.hideResult();
  }

  async renderLevels() {
    const prog = loadProgress(), ar = await this.h.arSupported();
    $('#levelList').innerHTML = LEVELS.map((l, i) => {
      const p = prog[l.id], open = isUnlocked(LEVELS, i);
      return `<div class="lvl ${open ? '' : 'locked'}">
        <span class="num">Livello ${i + 1}</span>
        <h3>${open ? l.nome : '???'}</h3>
        <p>${open ? l.descrizione || '' : 'Completa il livello precedente per sbloccarlo.'}</p>
        ${p ? `<span class="stars">${stars(p.stars)}</span><span class="best">Miglior tempo ${fmtTime(p.bestTime)} · integrità max ${p.bestIntegrity}%</span>` : ''}
        ${open ? `<div class="btns"><button data-play="${i}" ${ar ? '' : 'class="accent"'}>Gioca</button>${ar ? `<button data-play="${i}" data-ar="1" class="accent">Gioca in AR</button>` : ''}</div>` : ''}
      </div>`;
    }).join('');
    $('#levelList').querySelectorAll('[data-play]').forEach(b => b.onclick = () => this.h.play(+b.dataset.play, !!b.dataset.ar));
  }

  setLevel(level) { $('#levelName').textContent = level.nome; }
  setTool(i) {
    document.querySelectorAll('#toolbar button[data-t]').forEach(b => b.classList.toggle('on', +b.dataset.t === i));
  }
  update(G, secs) {
    const sig = `${Math.round(G.integrity)}|${Math.round(G.exposure * 1000)}|${Math.floor(secs)}|${G.layer}|${Math.ceil(G.scanCD)}|${G.loading}`;
    if (sig === this.cache) return; this.cache = sig;
    $('#integV').textContent = Math.round(G.integrity) + '%';
    $('#integ > i').style.width = G.integrity + '%';
    const ex = Math.min(1, G.exposure / G.winAt);
    $('#expoV').textContent = Math.round(ex * 100) + '%';
    $('#expo > i').style.width = ex * 100 + '%';
    $('#layerV').textContent = G.layer;
    const sb = $('#scanBtn'); sb.disabled = G.scanCD > 0;
    sb.querySelector('small').textContent = G.scanCD > 0 ? `ricarica ${Math.ceil(G.scanCD)}s` : 'vedi dentro';
    $('#loading').style.display = G.loading ? 'block' : 'none';
  }
  showResult({ won, name, stars: st, text, badge, hasNext }) {
    $('#msgT').textContent = won ? `${name} estratto!` : 'Reperto distrutto';
    $('#msgS').textContent = won ? stars(st) : '';
    $('#msgP').textContent = text;
    $('#msgB').textContent = badge || ''; $('#msgB').style.display = badge ? 'inline-block' : 'none';
    $('#nextBtn').style.display = won && hasNext ? '' : 'none';
    $('#msg').style.display = 'block';
  }
  hideResult() { $('#msg').style.display = 'none'; }
  loading(on) { $('#loading').style.display = on ? 'block' : 'none'; }
  note(text) { const n = $('#note'); n.textContent = text; n.style.display = text ? 'block' : 'none'; if (text) { clearTimeout(this._nt); this._nt = setTimeout(() => this.note(''), 9000); } }
}
