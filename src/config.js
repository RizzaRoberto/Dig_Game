// =====================================================================
//  PARAMETRI DEL GIOCO
//  Qui trovi i numeri da bilanciare. I valori specifici di ogni livello
//  (modello, dimensione, strati...) stanno invece in src/levels.js.
//  Molti di questi si possono provare dal vivo con il pannello di debug (tasto D).
// =====================================================================

// ---------- Griglia della roccia ----------
export const N = 56;                 // punti della griglia per lato (più alto = più dettaglio, più calcolo)
export const S = 0.28;               // lato del blocco in metri (28 cm)
export const CELL = S / (N - 1);     // dimensione di un voxel: ~5 mm
export const HALF = S / 2;
export const ISO = 0.5;              // soglia di densità che definisce la superficie
export const C = (N - 1) / 2;        // centro della griglia (in voxel)
export const CS = 16;                // celle per chunk, per lato
export const NCH = Math.ceil(N / CS);// chunk per lato

// ---------- Materiali degli strati ----------
export const DIRT = 1, ROCK = 2, SED = 3;
export const MAT_HEX = { 1: 0x8a6646, 2: 0x7a726b, 3: 0xd6c194 };
export const MAT_NAME = { 1: 'Terra', 2: 'Roccia', 3: 'Sabbia fine' };

// ---------- Roccia ----------
export const ROCCIA = {
  raggio: 21.3,      // raggio medio in voxel (~11 cm)
  irregolarita: 0.11 // quanto è bitorzoluta (0 = sfera)
};

// ---------- Valori predefiniti dei livelli (sovrascrivibili in levels.js) ----------
export const LIVELLO_DEFAULT = {
  dimensione: 11,                    // cm, lato più lungo del reperto (consigliato 6–13)
  orientamento: 'casuale',           // 'casuale' oppure [gradiX, gradiY, gradiZ]
  strati: { terra: 4.2, sabbia: 3.4 },// spessori in voxel (1 voxel ≈ 5 mm)
  zonaDaLiberare: 2.4,               // voxel attorno al reperto che contano come "scoperto"
  vittoria: 0.88,                    // frazione della zona da liberare per vincere
  resistenza: 1,                     // moltiplica il danno ricevuto (0.5 = reperto più robusto)
  coloreDetriti: '#e2cfa2',
};

// ---------- Strumenti ----------
// r = raggio d'azione in voxel
// rates = velocità con cui toglie materiale per strato {1: terra, 2: roccia, 3: sabbia} (0 = non lo intacca)
// dmg = danno al secondo al reperto quando la punta è troppo vicina
// hapt = intensità della vibrazione · snd = [frequenza, volume, risonanza] del suono
export const TOOLS = [
  { id: 'drill',  name: 'Trapano',   hint: 'veloce, rischioso',   r: 3.2, rates: { 1: 9,   2: 3.2, 3: 9   }, dmg: 40, hapt: 0.8,  snd: [650, 0.22, 3] },
  { id: 'chisel', name: 'Scalpello', hint: 'preciso',             r: 1.8, rates: { 1: 6,   2: 2.2, 3: 5   }, dmg: 16, hapt: 0.45, snd: [2300, 0.12, 6] },
  { id: 'brush',  name: 'Pennello',  hint: 'solo terra e sabbia', r: 3.8, rates: { 1: 4.5, 2: 0,   3: 4.5 }, dmg: 0,  hapt: 0.12, snd: [4800, 0.06, 0.7] },
];
export const GIOCO = {
  scanner: { durata: 3, ricarica: 10 },   // secondi
  sogliaDanno: 0.85,      // il danno parte quando la punta è entro r × questo valore dal reperto
  sogliaAvviso: 1.9,      // il cursore diventa arancione entro r × questo valore
  stelle: [90, 60],       // integrità minima per 3 e 2 stelle
};

// ---------- Interfaccia ----------
export const INTERFACCIA = {
  schermataIniziale: false, // true = mostra la schermata con "Gioca"; false = si parte subito dal livello
};

// ---------- Utilità ----------
export const idx = (x, y, z) => x + N * (y + N * z);
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const h3 = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };

// colore esadecimale sRGB -> componenti lineari (per i vertex color)
export function hexLinear(hex) {
  const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
}

// generatore pseudo-casuale con seme (stesso seme = stessa roccia)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
