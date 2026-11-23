// Generazione della roccia a strati attorno al reperto (gira nel worker)
import { N, C, ROCCIA, ISO, CELL, HALF, DIRT, ROCK, SED, MAT_HEX, idx, clamp01, h3, hexLinear, rng } from '../config.js';
import { surfaceNets } from './mesher.js';

/**
 * @param seed   seme casuale (forma della roccia)
 * @param spec   reperto: { dist(gx,gy,gz) } distanza con segno in voxel
 * @param params { terra, sabbia, zona }  spessori in voxel
 */
export function generateRock(seed, spec, params) {
  const r = rng(seed);
  const ph = Array.from({ length: 8 }, () => r() * 6.283);
  const density = new Float32Array(N * N * N), mat = new Uint8Array(N * N * N), fd = new Float32Array(N * N * N);
  const shell = [];
  const R0 = ROCCIA.raggio;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y, z);
    const dx = x - C, dy = (y - C) * 1.12, dz = z - C;
    const rr = Math.hypot(dx, dy, dz) || 1e-6, ux = dx / rr, uy = dy / rr, uz = dz / rr;
    const nz = 0.6 * Math.sin(3 * ux + ph[0]) * Math.sin(3 * uy + ph[1]) * Math.sin(3 * uz + ph[2])
             + 0.4 * Math.sin(5 * ux + 2 * uy + ph[3]) * Math.sin(5 * uz - uy + ph[4]);
    const Rr = R0 * (1 + ROCCIA.irregolarita * nz);
    let d = clamp01(0.5 + (Rr - rr) / 2.2);
    const f = spec.dist(x, y, z);
    fd[i] = f;
    d = Math.min(d, clamp01(0.5 + f * 0.9));           // il reperto "scava" il suo spazio nella roccia
    if (x === 0 || y === 0 || z === 0 || x === N - 1 || y === N - 1 || z === N - 1) d = 0;
    density[i] = d;
    const dirtDepth = params.terra + params.terra * 0.45 * Math.sin(ux * 4 + ph[5]) * Math.sin(uz * 4 + ph[6]);
    mat[i] = f < params.sabbia ? SED : (rr > Rr - dirtDepth ? DIRT : ROCK);
    if (f >= 0 && f < params.zona && d > ISO) shell.push(i);
  }
  return { density, mat, fd, shell: Int32Array.from(shell) };
}

// Mesh di un reperto procedurale su una griglia a risoluzione doppia
export function specimenMesh(spec) {
  const FR = 0.5, pad = 1.6, br = spec.boundR + pad;
  const mn = spec.center.map(c => c - br);
  const n = Math.ceil((2 * br) / FR) + 1;
  const f = new Float32Array(n * n * n);
  for (let z = 1; z < n - 1; z++) for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++)
    f[x + n * (y + n * z)] = clamp01(0.5 - spec.dist(mn[0] + x * FR, mn[1] + y * FR, mn[2] + z * FR));
  const off = mn.map(m => m * CELL - HALF);
  return surfaceNets(f, n, n, n, [0, 0, 0], [n, n, n], [0, 0, 0], [n, n, n],
    (x, y, z, out) => spec.color(mn[0] + x * FR, mn[1] + y * FR, mn[2] + z * FR, out), FR * CELL, off);
}

// Colore della roccia per un punto della regione
const MAT_LIN = { 1: hexLinear(MAT_HEX[1]), 2: hexLinear(MAT_HEX[2]), 3: hexLinear(MAT_HEX[3]) };
export function rockColorFn(mat, R, o) {
  return (x, y, z, out) => {
    const xi = Math.round(x), yi = Math.round(y), zi = Math.round(z);
    const gx = x + o[0], gy = y + o[1], gz = z + o[2];
    const m = mat[xi + R * (yi + R * zi)] || ROCK, c = MAT_LIN[m];
    let k = 0.84 + 0.26 * h3(xi + o[0], yi + o[1], zi + o[2]);
    if (m === ROCK) k *= 0.9 + 0.1 * Math.sin(gy * 1.0 + gx * 0.18);
    if (m === DIRT) k *= 0.9 + 0.1 * Math.sin(gx * 0.5 + gz * 0.65);
    k *= 0.72 + 0.28 * Math.min(1, Math.hypot(gx - C, gy - C, gz - C) / 18);
    out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k;
  };
}
