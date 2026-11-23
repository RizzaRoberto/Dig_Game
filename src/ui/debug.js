// Pannello di debug (tasto D): cambia i parametri dal vivo, come l'Inspector di Unity.
// Quando trovi valori che ti piacciono, "Copia valori" e incollali in config.js / scene.js / levels.js.
import GUI from 'lil-gui';
import { TOOLS, GIOCO } from '../config.js';
import { LUCI } from '../scene.js';

export function createDebug({ onLights, getLevel, regenerate }) {
  const gui = new GUI({ title: 'Debug (D per nascondere)' });
  gui.hide();

  const l = gui.addFolder('Luci');
  l.add(LUCI, 'esposizione', 0.2, 3, 0.01).onChange(onLights);
  l.add(LUCI, 'ambiente', 0, 3, 0.01).name('riflessi ambiente').onChange(onLights);
  l.addColor(LUCI, 'sfondo').onChange(onLights);
  const c = l.addFolder('Cielo (HemisphereLight)');
  c.addColor(LUCI.cielo, 'colore').onChange(onLights); c.addColor(LUCI.cielo, 'terreno').onChange(onLights);
  c.add(LUCI.cielo, 'intensita', 0, 5, 0.01).onChange(onLights);
  const s = l.addFolder('Sole (DirectionalLight)');
  s.addColor(LUCI.sole, 'colore').onChange(onLights); s.add(LUCI.sole, 'intensita', 0, 8, 0.01).onChange(onLights);
  s.add(LUCI.sole, 'ombre').onChange(onLights);
  ['x', 'y', 'z'].forEach((k, i) => s.add(LUCI.sole.direzione, i, -2, 2, 0.01).name('direzione ' + k));
  const f = l.addFolder('Riempimento'); f.close();
  f.addColor(LUCI.riempimento, 'colore').onChange(onLights); f.add(LUCI.riempimento, 'intensita', 0, 5, 0.01).onChange(onLights);

  const t = gui.addFolder('Strumenti'); t.close();
  for (const tool of TOOLS) {
    const tf = t.addFolder(tool.name); tf.close();
    tf.add(tool, 'r', 0.5, 6, 0.1).name('raggio (voxel)');
    tf.add(tool.rates, 1, 0, 20, 0.1).name('velocità terra');
    tf.add(tool.rates, 2, 0, 20, 0.1).name('velocità roccia');
    tf.add(tool.rates, 3, 0, 20, 0.1).name('velocità sabbia');
    tf.add(tool, 'dmg', 0, 150, 1).name('danno / s');
  }

  const g = gui.addFolder('Gioco'); g.close();
  g.add(GIOCO.scanner, 'durata', 0.5, 10, 0.5).name('scanner durata (s)');
  g.add(GIOCO.scanner, 'ricarica', 0, 30, 1).name('scanner ricarica (s)');
  g.add(GIOCO, 'sogliaDanno', 0.3, 1.5, 0.05).name('soglia danno');
  g.add(GIOCO, 'sogliaAvviso', 1, 3, 0.05).name('soglia avviso');

  const lv = gui.addFolder('Livello corrente (poi "Rigenera")'); lv.close();
  const fields = [['dimensione', 4, 14, 0.5], ['vittoria', 0.5, 1, 0.01], ['resistenza', 0.1, 3, 0.05]];
  // "wrap" legge e scrive sempre il livello in gioco in quel momento
  const wrap = { get dimensione() { return getLevel()?.dimensione ?? 11; }, set dimensione(v) { getLevel().dimensione = v; },
    get vittoria() { return getLevel()?.vittoria ?? 0.88; }, set vittoria(v) { getLevel().vittoria = v; },
    get resistenza() { return getLevel()?.resistenza ?? 1; }, set resistenza(v) { getLevel().resistenza = v; },
    get terra() { return getLevel()?.strati.terra ?? 4; }, set terra(v) { getLevel().strati.terra = v; },
    get sabbia() { return getLevel()?.strati.sabbia ?? 3; }, set sabbia(v) { getLevel().strati.sabbia = v; } };
  fields.forEach(([k, a, b, st]) => lv.add(wrap, k, a, b, st).listen());
  lv.add(wrap, 'terra', 1, 8, 0.1).name('strato terra (voxel)').listen();
  lv.add(wrap, 'sabbia', 0.5, 6, 0.1).name('strato sabbia (voxel)').listen();
  lv.add({ rigenera: regenerate }, 'rigenera').name('Rigenera roccia');

  gui.add({ copia: () => copyValues(getLevel()) }, 'copia').name('Copia valori');

  addEventListener('keydown', e => { if (e.key === 'd' || e.key === 'D') gui.show(gui._hidden); });
  return gui;
}

function copyValues(level) {
  const pick = ({ id, nome, dimensione, strati, vittoria, resistenza }) => ({ id, nome, dimensione, strati, vittoria, resistenza });
  const txt = `// LUCI (scene.js)\n${JSON.stringify(LUCI, null, 2)}\n\n// TOOLS (config.js)\n${JSON.stringify(TOOLS.map(({ name, r, rates, dmg }) => ({ name, r, rates, dmg })), null, 2)}\n\n// GIOCO (config.js)\n${JSON.stringify(GIOCO, null, 2)}\n\n// Livello (levels.js)\n${JSON.stringify(level ? pick(level) : {}, null, 2)}`;
  navigator.clipboard?.writeText(txt).then(() => console.log('Valori copiati')).catch(() => console.log(txt));
  console.log(txt);
}
