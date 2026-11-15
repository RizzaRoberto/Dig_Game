// Pannello informativo sul controller sinistro (nel visore)
import * as THREE from 'three';
import { TOOLS, WIN_EXPOSURE } from '../config.js';

export class XRHud extends THREE.Mesh {
  constructor() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    super(new THREE.PlaneGeometry(0.14, 0.14 * 288 / 512), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    this.cv = cv; this.ctx = cv.getContext('2d'); this.tex = tex;
    this.position.set(0, 0.05, -0.03); this.rotation.x = -0.75;
    this.last = 0; this.sig = '';
  }
  draw(G, now) {
    const sig = [G.tool, Math.round(G.integrity), Math.round(G.exposure * 100), G.state, G.placing, Math.ceil(G.scanCD), G.scanT > 0, G.specimenName, G.banner].join('|');
    if (sig === this.sig || now - this.last < 120) return;
    this.sig = sig; this.last = now;
    const c = this.ctx; c.clearRect(0, 0, 512, 288);
    c.fillStyle = 'rgba(28,22,17,.9)'; c.beginPath(); c.roundRect(4, 4, 504, 280, 24); c.fill();
    c.textBaseline = 'alphabetic';
    if (G.placing) {
      c.fillStyle = '#e8a94a'; c.font = 'bold 36px system-ui,sans-serif'; c.fillText('Posiziona la roccia', 26, 64);
      c.fillStyle = '#f3e7d3'; c.font = '25px system-ui,sans-serif';
      c.fillText('Punta il controller destro su un tavolo', 26, 120);
      c.fillText('e premi il grilletto destro.', 26, 154);
      c.fillStyle = '#b9a88e'; c.font = '21px system-ui,sans-serif';
      c.fillText('Puoi spostarla dopo con l\'impugnatura sinistra', 26, 222);
      c.fillText('o riposizionarla con il tasto X.', 26, 252);
    } else {
      c.fillStyle = '#e8a94a'; c.font = 'bold 38px system-ui,sans-serif'; c.fillText(TOOLS[G.tool].name, 26, 56);
      c.fillStyle = '#b9a88e'; c.font = '22px system-ui,sans-serif';
      c.fillText(G.scanT > 0 ? 'Scanner attivo' : G.scanCD > 0 ? `Scanner tra ${Math.ceil(G.scanCD)}s` : 'Scanner pronto', 300, 52);
      const bar = (y, label, v, col) => {
        c.fillStyle = '#f3e7d3'; c.font = '23px system-ui,sans-serif'; c.fillText(`${label} ${Math.round(v * 100)}%`, 26, y);
        c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(26, y + 10, 460, 14); c.fillStyle = col; c.fillRect(26, y + 10, 460 * v, 14);
      };
      bar(100, 'Integrità', G.integrity / 100, G.integrity > 50 ? '#7cc576' : '#e0573f');
      bar(154, 'Scoperto', Math.min(1, G.exposure / WIN_EXPOSURE), '#e8a94a');
      if (G.state === 'play') {
        c.fillStyle = '#b9a88e'; c.font = '20px system-ui,sans-serif';
        c.fillText('Grilletto sx: strumento · Impugnatura dx: scanner', 26, 222);
        c.fillText('Impugnatura sx: sposta · X: riposiziona', 26, 252);
      } else {
        c.fillStyle = G.state === 'won' ? '#7cc576' : '#e0573f'; c.font = 'bold 25px system-ui,sans-serif';
        c.fillText(G.state === 'won' ? `${G.specimenName} estratto! ${'★'.repeat(G.stars)}${'☆'.repeat(3 - G.stars)}` : 'Reperto distrutto', 26, 222);
        c.fillStyle = '#f3e7d3'; c.font = '21px system-ui,sans-serif';
        c.fillText(G.banner || 'Grilletto sinistro: nuovo scavo', 26, 254);
      }
    }
    this.tex.needsUpdate = true;
  }
}
