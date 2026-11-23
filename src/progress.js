// Progressi del giocatore per ogni livello (salvati nel browser con localStorage)
const KEY = 'scavo3d.progressi.v2';

export function loadProgress() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}

// Registra il risultato di un livello completato. Ritorna { isFirst, isRecord }
export function saveResult(levelId, stars, integrity, seconds) {
  const all = loadProgress();
  const prev = all[levelId];
  const e = prev ? { ...prev } : { completed: 0, stars: 0, bestTime: null, bestIntegrity: 0 };
  const isRecord = !!prev && (stars > e.stars || (stars === e.stars && seconds < e.bestTime));
  e.completed++;
  e.stars = Math.max(e.stars, stars);
  e.bestIntegrity = Math.max(e.bestIntegrity, Math.round(integrity));
  e.bestTime = e.bestTime == null ? seconds : Math.min(e.bestTime, seconds);
  all[levelId] = e;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (err) { /* storage non disponibile */ }
  return { isFirst: !prev, isRecord };
}

// Un livello è sbloccato se è il primo o se il precedente è stato completato
export function isUnlocked(levels, i) {
  if (i === 0) return true;
  const p = loadProgress()[levels[i - 1].id];
  return !!(p && p.completed);
}
