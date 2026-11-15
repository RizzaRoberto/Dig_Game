// Museo: i reperti trovati, salvati nel browser (localStorage)
import { SPECIMEN_TYPES } from './specimens.js';

const KEY = 'scavo3d.museo.v1';

export function loadCollection() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}

// Registra un ritrovamento. Ritorna { isNew, isRecord }
export function addFind(type, stars, integrity, seconds) {
  const col = loadCollection();
  const prev = col[type];
  const entry = prev ? { ...prev } : { count: 0, bestStars: 0, bestTime: null, bestIntegrity: 0, first: Date.now() };
  entry.count++;
  const isRecord = !!prev && (stars > entry.bestStars || (stars === entry.bestStars && seconds < entry.bestTime));
  entry.bestStars = Math.max(entry.bestStars, stars);
  entry.bestIntegrity = Math.max(entry.bestIntegrity, Math.round(integrity));
  entry.bestTime = entry.bestTime == null ? seconds : Math.min(entry.bestTime, seconds);
  col[type] = entry;
  try { localStorage.setItem(KEY, JSON.stringify(col)); } catch (e) { /* storage non disponibile */ }
  return { isNew: !prev, isRecord };
}

export function collectionSummary() {
  const col = loadCollection();
  return Object.entries(SPECIMEN_TYPES).map(([type, t]) => ({ type, name: t.name, rarity: t.rarity, ...(col[type] || { count: 0 }) }));
}
