// Interfaccia HTML per PC e telefono
import { TOOLS, WIN_EXPOSURE } from '../config.js';
import { collectionSummary } from '../collection.js';

const $ = s => document.querySelector(s);
export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class DomHud {
  constructor(handlers) {
    this.cache = '';
    const tb = $('#toolbar');
    TOOLS.forEach((t, i) => {
      const b = document.createElement('button'); b.dataset.t = i;
      b.innerHTML = `${t.name}<small>${t.hint} · ${i + 1}</small>`;
      b.onclick = () => handlers.tool(i); tb.insertBefore(b, $('#scanBtn'));
    });
    $('#scanBtn').onclick = handlers.scan;
    $('#again').onclick = handlers.newDig;
    $('#museumBtn').onclick = () => this.showMuseum(true);
    $('#museumClose').onclick = () => this.showMuseum(false);
    $('#arBtn').onclick = handlers.enterAR;
  }
  setTool(i) {
    document.querySelectorAll('#toolbar button[data-t]').forEach(b => b.classList.toggle('on', +b.dataset.t === i));
    $('#toolName').textContent = TOOLS[i].name;
  }
  update(G, secs) {
    const sig = `${Math.round(G.integrity)}|${Math.round(G.exposure * 1000)}|${Math.floor(secs)}|${G.layer}|${Math.ceil(G.scanCD)}|${G.loading}`;
    if (sig === this.cache) return; this.cache = sig;
    $('#integV').textContent = Math.round(G.integrity) + '%';
    $('#integ > i').style.width = G.integrity + '%';
    const ex = Math.min(1, G.exposure / WIN_EXPOSURE);
    $('#expoV').textContent = Math.round(ex * 100) + '%';
    $('#expo > i').style.width = ex * 100 + '%';
    $('#timeV').textContent = fmtTime(secs);
    $('#layerV').textContent = G.layer;
    const sb = $('#scanBtn'); sb.disabled = G.scanCD > 0;
    sb.querySelector('small').textContent = G.scanCD > 0 ? `ricarica ${Math.ceil(G.scanCD)}s` : 'vedi dentro · S';
    $('#loading').style.display = G.loading ? 'block' : 'none';
  }
  showResult(won, specimenName, stars, text, badge) {
    $('#msgT').textContent = won ? `${specimenName} estratto!` : 'Reperto distrutto';
    $('#msgS').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
    $('#msgP').textContent = text;
    $('#msgB').textContent = badge || ''; $('#msgB').style.display = badge ? 'inline-block' : 'none';
    $('#msg').style.display = 'block';
  }
  hideResult() { $('#msg').style.display = 'none'; }
  note(text) { const n = $('#note'); n.textContent = text; n.style.display = text ? 'block' : 'none'; }
  showMuseum(show) {
    if (show) {
      $('#museumList').innerHTML = collectionSummary().map(s => s.count ? `
        <div class="card found"><b>${s.name}</b><span class="rar">${s.rarity}</span>
        <span class="stars">${'★'.repeat(s.bestStars)}${'☆'.repeat(3 - s.bestStars)}</span>
        <small>Trovati: ${s.count} · Miglior tempo ${fmtTime(s.bestTime)} · Integrità max ${s.bestIntegrity}%</small></div>` : `
        <div class="card"><b>???</b><span class="rar">${s.rarity}</span><small>Non ancora trovato</small></div>`).join('');
    }
    $('#museum').style.display = show ? 'block' : 'none';
  }
}
