// Surface Nets: trasforma un campo di densità in una mesh liscia.
// Funziona su una regione: i vertici vengono calcolati per le celle in [vMin, vMax)
// e le facce per gli spigoli che partono dai punti in [eMin, eMax).
// Così ogni chunk produce solo le sue facce, ma si salda perfettamente ai vicini.
import { ISO } from '../config.js';

const EA = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3], EB = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7];

function samp(f, nx, ny, nz, x, y, z) {
  x = x < 0 ? 0 : x > nx - 1.001 ? nx - 1.001 : x;
  y = y < 0 ? 0 : y > ny - 1.001 ? ny - 1.001 : y;
  z = z < 0 ? 0 : z > nz - 1.001 ? nz - 1.001 : z;
  const x0 = x | 0, y0 = y | 0, z0 = z | 0, fx = x - x0, fy = y - y0, fz = z - z0, sxy = nx * ny;
  const i = x0 + nx * y0 + sxy * z0;
  const c00 = f[i] * (1 - fx) + f[i + 1] * fx, c10 = f[i + nx] * (1 - fx) + f[i + nx + 1] * fx;
  const c01 = f[i + sxy] * (1 - fx) + f[i + sxy + 1] * fx, c11 = f[i + sxy + nx] * (1 - fx) + f[i + sxy + nx + 1] * fx;
  return (c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz;
}

/**
 * @returns {{pos:Float32Array, nor:Float32Array, col:Float32Array, idx:Uint32Array}}
 * pos = off + p * scale  (p in coordinate locali della regione)
 */
export function surfaceNets(f, nx, ny, nz, vMin, vMax, eMin, eMax, colorFn, scale, off) {
  const cx = nx - 1, cy = ny - 1, cz = nz - 1, sxy = nx * ny;
  const cellV = new Int32Array(cx * cy * cz).fill(-1);
  const P = [], I = [], v = new Float32Array(8);
  const x0 = Math.max(0, vMin[0]), x1 = Math.min(cx, vMax[0]);
  const y0 = Math.max(0, vMin[1]), y1 = Math.min(cy, vMax[1]);
  const z0 = Math.max(0, vMin[2]), z1 = Math.min(cz, vMax[2]);
  for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const b = x + nx * y + sxy * z;
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const val = f[b + (c & 1) + ((c >> 1) & 1) * nx + ((c >> 2) & 1) * sxy];
      v[c] = val; if (val > ISO) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let px = 0, py = 0, pz = 0, n = 0;
    for (let e = 0; e < 12; e++) {
      const a = EA[e], bb = EB[e];
      if (((mask >> a) & 1) !== ((mask >> bb) & 1)) {
        const t = (ISO - v[a]) / (v[bb] - v[a]);
        const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1;
        px += ax + t * ((bb & 1) - ax); py += ay + t * (((bb >> 1) & 1) - ay); pz += az + t * (((bb >> 2) & 1) - az); n++;
      }
    }
    cellV[x + cx * (y + cy * z)] = P.length / 3;
    P.push(x + px / n, y + py / n, z + pz / n);
  }
  const cid = (x, y, z) => cellV[x + cx * (y + cy * z)];
  // L'ordine delle 4 celle attorno allo spigolo è antiorario visto dall'asse positivo,
  // quindi la normale punta verso +asse: se dentro è il lato "basso" la teniamo, altrimenti invertiamo.
  // La diagonale più corta riduce le pieghe.
  function emit(a, b, c, d, axis, in0) {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const dac = (P[3 * a] - P[3 * c]) ** 2 + (P[3 * a + 1] - P[3 * c + 1]) ** 2 + (P[3 * a + 2] - P[3 * c + 2]) ** 2;
    const dbd = (P[3 * b] - P[3 * d]) ** 2 + (P[3 * b + 1] - P[3 * d + 1]) ** 2 + (P[3 * b + 2] - P[3 * d + 2]) ** 2;
    if (dac <= dbd) { if (in0) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c); }
    else { if (in0) I.push(b, c, d, b, d, a); else I.push(b, d, c, b, a, d); }
  }
  const ex0 = Math.max(0, eMin[0]), ex1 = Math.min(nx, eMax[0]);
  const ey0 = Math.max(0, eMin[1]), ey1 = Math.min(ny, eMax[1]);
  const ez0 = Math.max(0, eMin[2]), ez1 = Math.min(nz, eMax[2]);
  for (let z = ez0; z < ez1; z++) for (let y = ey0; y < ey1; y++) for (let x = ex0; x < ex1; x++) {
    const i = x + nx * y + sxy * z, in0 = f[i] > ISO;
    if (x < cx && y >= 1 && y < cy && z >= 1 && z < cz && in0 !== (f[i + 1] > ISO))
      emit(cid(x, y - 1, z - 1), cid(x, y, z - 1), cid(x, y, z), cid(x, y - 1, z), 0, in0);
    if (y < cy && x >= 1 && x < cx && z >= 1 && z < cz && in0 !== (f[i + nx] > ISO))
      emit(cid(x - 1, y, z - 1), cid(x - 1, y, z), cid(x, y, z), cid(x, y, z - 1), 1, in0);
    if (z < cz && x >= 1 && x < cx && y >= 1 && y < cy && in0 !== (f[i + sxy] > ISO))
      emit(cid(x - 1, y - 1, z), cid(x, y - 1, z), cid(x, y, z), cid(x - 1, y, z), 2, in0);
  }
  // compatta: tieni solo i vertici usati dalle facce di questa regione
  const remap = new Int32Array(P.length / 3).fill(-1);
  let nv = 0;
  for (let k = 0; k < I.length; k++) { const o = I[k]; if (remap[o] < 0) remap[o] = nv++; I[k] = remap[o]; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const h = 0.75, out = [0, 0, 0];
  for (let k = 0; k < remap.length; k++) {
    const j = remap[k]; if (j < 0) continue;
    const x = P[3 * k], y = P[3 * k + 1], z = P[3 * k + 2];
    const gx = samp(f, nx, ny, nz, x + h, y, z) - samp(f, nx, ny, nz, x - h, y, z);
    const gy = samp(f, nx, ny, nz, x, y + h, z) - samp(f, nx, ny, nz, x, y - h, z);
    const gz = samp(f, nx, ny, nz, x, y, z + h) - samp(f, nx, ny, nz, x, y, z - h);
    const l = Math.hypot(gx, gy, gz) || 1;
    nor[3 * j] = -gx / l; nor[3 * j + 1] = -gy / l; nor[3 * j + 2] = -gz / l;
    pos[3 * j] = off[0] + x * scale; pos[3 * j + 1] = off[1] + y * scale; pos[3 * j + 2] = off[2] + z * scale;
    colorFn(x, y, z, out); col[3 * j] = out[0]; col[3 * j + 1] = out[1]; col[3 * j + 2] = out[2];
  }
  return { pos, nor, col, idx: Uint32Array.from(I) };
}
