// ---------- Parametri globali del gioco ----------
export const N = 56;                 // punti della griglia per lato
export const S = 0.28;               // lato del blocco in metri
export const CELL = S / (N - 1);     // ~5 mm
export const HALF = S / 2;
export const ISO = 0.5;              // soglia della superficie
export const C = (N - 1) / 2;        // centro della griglia
export const CS = 16;                // celle per chunk (per lato)
export const NCH = Math.ceil(N / CS);// chunk per lato

export const DIRT = 1, ROCK = 2, SED = 3;
export const MAT_HEX = { 1: 0x8a6646, 2: 0x7a726b, 3: 0xd6c194 };
export const MAT_NAME = { 1: 'Terra', 2: 'Roccia', 3: 'Sabbia fine' };

export const R0 = 21.3;              // raggio medio della roccia (in voxel)
export const SED_BAND = 3.4;         // spessore della sabbia attorno al reperto
export const SHELL_BAND = 2.4;       // zona da liberare per "scoprire" il reperto
export const WIN_EXPOSURE = 0.88;

// Strumenti: r = raggio in voxel, rates = velocità per materiale, dmg = danno/s al reperto
export const TOOLS = [
  { id: 'drill',  name: 'Trapano',   hint: 'veloce, rischioso', r: 3.2, rates: { 1: 9,   2: 3.2, 3: 9   }, dmg: 40, hapt: 0.8,  snd: [650, 0.22, 3] },
  { id: 'chisel', name: 'Scalpello', hint: 'preciso',           r: 1.8, rates: { 1: 6,   2: 2.2, 3: 5   }, dmg: 16, hapt: 0.45, snd: [2300, 0.12, 6] },
  { id: 'brush',  name: 'Pennello',  hint: 'solo terra e sabbia', r: 3.8, rates: { 1: 4.5, 2: 0, 3: 4.5 }, dmg: 0, hapt: 0.12, snd: [4800, 0.06, 0.7] },
];
export const SCAN_TIME = 3, SCAN_COOLDOWN = 10;

export const idx = (x, y, z) => x + N * (y + N * z);
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const h3 = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };

// colore esadecimale sRGB -> componenti lineari (per i vertex color)
export function hexLinear(hex) {
  const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
}

// generatore pseudo-casuale con seme (stesso seme = stessa roccia nel worker e nel thread principale)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
