// Reperti procedurali. Ognuno è una funzione di distanza (SDF, in unità voxel)
// più una funzione colore. Lo stesso (tipo, seme) produce lo stesso reperto ovunque.
import { C, rng, hexLinear } from './config.js';

export const SPECIMEN_TYPES = {
  ammonite:  { name: 'Ammonite',          rarity: 'Comune',    weight: 45, material: { roughness: 0.55, metalness: 0.05 } },
  trilobite: { name: 'Trilobite',         rarity: 'Non comune', weight: 35, material: { roughness: 0.5,  metalness: 0.1 } },
  crystal:   { name: 'Geode di ametista', rarity: 'Rara',      weight: 20, material: { roughness: 0.18, metalness: 0.15 } },
};

export function pickSpecimenType(r) {
  const tot = Object.values(SPECIMEN_TYPES).reduce((a, t) => a + t.weight, 0);
  let x = r() * tot;
  for (const [k, t] of Object.entries(SPECIMEN_TYPES)) { if ((x -= t.weight) < 0) return k; }
  return 'ammonite';
}

// ---------- piccola algebra ----------
function rotMatrix(ax, ay, az) {
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
  // R = Rz * Ry * Rx (righe)
  return [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ];
}
const lerp3 = (a, b, t, out) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; };
function sdEllipsoid(x, y, z, rx, ry, rz) {
  const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 > 1e-6 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

// ---------- AMMONITE ----------
function buildAmmonite(r) {
  const M = 260, P = new Float32Array(M * 3), RAD = new Float32Array(M), TH = new Float32Array(M), th1 = 3.25 * Math.PI;
  for (let i = 0; i < M; i++) {
    const th = th1 * i / (M - 1), rs = 1.75 * Math.exp(0.165 * th);
    P[3 * i] = rs * Math.cos(th); P[3 * i + 1] = 0; P[3 * i + 2] = rs * Math.sin(th);
    RAD[i] = 0.33 * rs * (1 + 0.09 * Math.max(0, Math.sin(th * 10))); TH[i] = th;
  }
  // centra la spirale
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < M; i++) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], P[3 * i + a] - RAD[i]); mx[a] = Math.max(mx[a], P[3 * i + a] + RAD[i]); }
  for (let i = 0; i < M; i++) for (let a = 0; a < 3; a++) P[3 * i + a] -= (mn[a] + mx[a]) / 2;
  let near = 0;
  const bone = hexLinear(0xe2cfa2), dark = hexLinear(0x8c6a42);
  return {
    boundR: 10,
    sdf(x, y, z) {
      let best = 1e9, bi = 0;
      for (let i = 0; i < M; i++) {
        const dx = x - P[3 * i], dy = y - P[3 * i + 1], dz = z - P[3 * i + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - RAD[i];
        if (d < best) { best = d; bi = i; }
      }
      near = bi; return best;
    },
    color(x, y, z, out) {
      const d = this.sdf(x, y, z), th = TH[near];
      const k = 0.35 * (0.5 + 0.5 * Math.sin(th * 10)) + 0.25 * (1 - th / th1) + 0.1 * Math.max(0, -d);
      lerp3(bone, dark, k, out);
    },
  };
}

// ---------- TRILOBITE ----------
function buildTrilobite(r) {
  const base = hexLinear(0x4a3d31), light = hexLinear(0x9b8263), axial = hexLinear(0x6e5a44);
  return {
    boundR: 12,
    sdf(x, y, z) { const K = 1.3; return K * this.sdf0(x / K, y / K, z / K); },
    sdf0(x, y, z) {
      const seg = (z > -6 && z < 4) ? 0.22 * Math.sin(z * 2.4) : 0;
      let d = sdEllipsoid(x, y, z, 4.4, 1.25 + seg, 6.2);
      d = smin(d, sdEllipsoid(x, y - 0.75, z, 1.45, 1.25 + seg * 1.2, 6.4), 0.8);
      d = smin(d, sdEllipsoid(x, y + 0.1, z - 5.2, 5.0, 1.15, 2.7), 1.0);
      d = smin(d, sdEllipsoid(x, y, z + 6.0, 2.8, 0.9, 1.9), 0.8);
      d = Math.min(d, Math.hypot(Math.abs(x) - 1.9, y - 1.0, z - 5.5) - 0.75);
      return d;
    },
    color(x, y, z, out) {
      x /= 1.3; y /= 1.3; z /= 1.3;
      const ridge = 0.5 + 0.5 * Math.sin(z * 2.4);
      const ax = Math.max(0, 1 - Math.abs(x) / 1.5);
      lerp3(base, light, 0.25 + 0.45 * ridge * (y > 0 ? 1 : 0.4), out);
      lerp3(out, axial, ax * 0.4, out);
    },
  };
}

// ---------- GEODE DI AMETISTA ----------
function buildCrystal(r) {
  const K = 6 + Math.floor(r() * 3), cr = [];
  const base = [0, -3.2, 0];
  for (let i = 0; i < K; i++) {
    const a = r() * Math.PI * 2, el = 0.35 + r() * 1.0; // elevazione
    const d = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
    // base ortonormale
    const t = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = [d[1] * t[2] - d[2] * t[1], d[2] * t[0] - d[0] * t[2], d[0] * t[1] - d[1] * t[0]];
    const ul = Math.hypot(...u); u = u.map(v => v / ul);
    const w = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    cr.push({ d, u, w, L: 6 + r() * 3, rad: 1.4 + r() * 0.9, tip: 2.4, hue: r() });
  }
  const purple = hexLinear(0x7d3fb8), lilac = hexLinear(0xd6b6f2), quartz = hexLinear(0xece6f2);
  let near = -1, nearT = 0;
  return {
    boundR: 12,
    sdf(x, y, z) {
      const px = x - base[0], py = y - base[1], pz = z - base[2];
      let best = Math.hypot(px, py * 1.3, pz) - 3.2; near = -1; nearT = 0;
      for (let i = 0; i < cr.length; i++) {
        const c = cr[i];
        const t = px * c.d[0] + py * c.d[1] + pz * c.d[2];
        const qx = px * c.u[0] + py * c.u[1] + pz * c.u[2], qy = px * c.w[0] + py * c.w[1] + pz * c.w[2];
        const hex = Math.max(Math.abs(qy), Math.abs(qx) * 0.866 + Math.abs(qy) * 0.5);
        const rr = c.rad * Math.min(1, Math.max(0, (c.L - t) / c.tip));
        const d = Math.max(hex - rr, -t, t - c.L) * 0.8;
        if (d < best) { best = d; near = i; nearT = t / c.L; }
      }
      return best;
    },
    color(x, y, z, out) {
      this.sdf(x, y, z);
      if (near < 0) { out[0] = quartz[0]; out[1] = quartz[1]; out[2] = quartz[2]; return; }
      lerp3(purple, lilac, Math.min(1, Math.max(0, nearT * 0.9 + cr[near].hue * 0.25 - 0.1)), out);
    },
  };
}

const BUILDERS = { ammonite: buildAmmonite, trilobite: buildTrilobite, crystal: buildCrystal };

// Crea il reperto posizionato e ruotato nella griglia (coordinate voxel globali)
export function makeSpecimen(type, seed) {
  const r = rng(seed ^ 0x9e3779b9);
  const local = BUILDERS[type](r);
  const R = rotMatrix(r() * Math.PI * 2, r() * Math.PI * 2, r() * Math.PI * 2);
  const ctr = [C + (r() - 0.5) * 2, C + (r() - 0.5) * 2, C + (r() - 0.5) * 2];
  const toLocal = (gx, gy, gz, o) => {
    const dx = gx - ctr[0], dy = gy - ctr[1], dz = gz - ctr[2];
    // R^T * d
    o[0] = R[0] * dx + R[3] * dy + R[6] * dz;
    o[1] = R[1] * dx + R[4] * dy + R[7] * dz;
    o[2] = R[2] * dx + R[5] * dy + R[8] * dz;
  };
  const tmp = [0, 0, 0];
  return {
    type, seed, name: SPECIMEN_TYPES[type].name, material: SPECIMEN_TYPES[type].material,
    center: ctr, boundR: local.boundR,
    dist(gx, gy, gz) {
      const dx = gx - ctr[0], dy = gy - ctr[1], dz = gz - ctr[2];
      const far = Math.sqrt(dx * dx + dy * dy + dz * dz) - local.boundR;
      if (far > 6) return far; // fuori dalla zona utile: basta una stima
      toLocal(gx, gy, gz, tmp); return local.sdf(tmp[0], tmp[1], tmp[2]);
    },
    color(gx, gy, gz, out) { toLocal(gx, gy, gz, tmp); local.color(tmp[0], tmp[1], tmp[2], out); },
  };
}
