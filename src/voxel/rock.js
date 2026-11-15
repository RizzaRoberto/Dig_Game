// La roccia (lato "thread principale"): stato dei voxel, strumenti, chunk e reperto.
// In termini Unity: è un GameObject con figli (i chunk e il reperto) e il suo "script".
import * as THREE from 'three';
import { N, CS, NCH, CELL, HALF, ISO, TOOLS, GIOCO, idx, rng } from '../config.js';
import { prepareModel } from '../specimen-model.js';
import MeshWorker from './mesh-worker.js?worker&inline';

const R = CS + 4;

export class Rock extends THREE.Group {
  constructor() {
    super();
    this.worker = new MeshWorker();
    this.worker.onmessage = e => this._onMessage(e.data);
    this.gen = 0;
    this.chunks = new Map();       // key -> Mesh
    this.dirty = new Set();
    this.inFlight = false;
    this.ready = false;
    this.bottom = 0.09;

    // materiale della roccia: i colori arrivano dai vertici (vertex colors)
    this.rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.chunkGroup = new THREE.Group(); this.add(this.chunkGroup);
    // specPivot = centro del reperto (ruota su se stesso quando vinci)
    this.specPivot = new THREE.Group(); this.add(this.specPivot);
    this.specMaterials = [];
    this.opacity = 1;

    // ombra morbida finta sotto la roccia (economica, funziona anche in AR)
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.add(this.shadow);
  }

  // Nuova roccia per un livello. Il worker genera i voxel, poi tutti i chunk vengono ricostruiti.
  async generate(level, seed) {
    const gen = ++this.gen; this.ready = false; this.level = level;
    const params = { terra: level.strati.terra, sabbia: level.strati.sabbia, zona: level.zonaDaLiberare };
    const msg = { type: 'gen', id: gen, seed, params };
    const transfer = [];
    if (level.modello) {
      const prep = await prepareModel(level, rng(seed ^ 0x51ed));
      if (gen !== this.gen) return;
      msg.mesh = { positions: prep.positions, index: prep.index };
      transfer.push(prep.positions.buffer, prep.index.buffer);
      this._prep = prep;
    } else { msg.procedural = level.procedurale; this._prep = null; }
    return new Promise((res, rej) => {
      this._onReady = res; this._onError = rej;
      this.worker.postMessage(msg, transfer);
    });
  }

  _setupSpecimen(d) {
    this.specPivot.clear(); this.specPivot.rotation.set(0, 0, 0); this.specPivot.visible = true;
    if (this._prep) {
      this.specPivot.position.copy(this._prep.pivotPos);
      this.specPivot.add(this._prep.inner);
    } else {
      const g = toGeometry(d.specimenMesh); g.computeBoundingBox();
      const ctr = g.boundingBox.getCenter(new THREE.Vector3()); g.translate(-ctr.x, -ctr.y, -ctr.z);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 }));
      m.castShadow = m.receiveShadow = true;
      this.specPivot.position.copy(ctr); this.specPivot.add(m);
    }
    // ricorda i colori originali per mostrare i danni
    this.specMaterials = [];
    this.specPivot.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) this.specMaterials.push({ m, color: m.color.clone(), emissive: m.emissive ? m.emissive.clone() : null }); });
    this.specMeshes = []; this.specPivot.traverse(o => o.isMesh && this.specMeshes.push(o));
  }

  // 0..1 integrità -> colore; flash = lampo rosso quando lo colpisci
  setSpecimenDamage(integrity, flash) {
    for (const s of this.specMaterials) {
      s.m.color.copy(s.color).multiply(_tint.setRGB(0.62 + 0.38 * integrity, 0.5 + 0.5 * integrity, 0.45 + 0.55 * integrity));
      if (s.emissive) s.m.emissive.copy(s.emissive).add(_tint.setRGB(flash * 2.4, flash * 0.3, 0));
    }
  }

  _onMessage(d) {
    if (d.type === 'error') { if (d.id === this.gen && this._onError) this._onError(new Error(d.message)); return; }
    if (d.type === 'gen') {
      if (d.id !== this.gen) return;
      this.density = d.density; this.mat = d.mat; this.fd = d.fd; this.shell = d.shell;
      this._setupSpecimen(d);
      for (let z = 0; z < NCH; z++) for (let y = 0; y < NCH; y++) for (let x = 0; x < NCH; x++) this.dirty.add(x + NCH * (y + NCH * z));
      this.inFlight = false; this._firstMesh = true;
      this.flush();
    } else if (d.type === 'mesh') {
      this.inFlight = false;
      if (d.gen !== this.gen) { this.flush(); return; }
      for (const r of d.results) {
        let mesh = this.chunks.get(r.key);
        if (!r.idx.length) { if (mesh) mesh.visible = false; continue; }
        const g = toGeometry(r);
        if (!mesh) {
          mesh = new THREE.Mesh(g, this.rockMat); mesh.renderOrder = 2; mesh.castShadow = mesh.receiveShadow = true;
          this.chunkGroup.add(mesh); this.chunks.set(r.key, mesh);
        } else { mesh.geometry.dispose(); mesh.geometry = g; }
        mesh.visible = true;
      }
      if (this._firstMesh) {
        this._firstMesh = false;
        let minY = 0;
        for (const m of this.chunks.values()) if (m.visible) { m.geometry.computeBoundingBox(); minY = Math.min(minY, m.geometry.boundingBox.min.y); }
        this.bottom = -minY; this.shadow.position.y = minY + 0.001;
        this.ready = true;
        this._onReady && this._onReady();
      }
      this.flush();
    }
  }

  // Invia al worker i chunk modificati (uno scaglione alla volta)
  flush() {
    if (this.inFlight || !this.dirty.size || !this.density) return;
    const jobs = [], transfer = [];
    for (const key of this.dirty) {
      const cx = key % NCH, cy = Math.floor(key / NCH) % NCH, cz = Math.floor(key / (NCH * NCH));
      const o = [cx * CS - 2, cy * CS - 2, cz * CS - 2];
      const f = new Float32Array(R * R * R), m = new Uint8Array(R * R * R);
      for (let z = 0; z < R; z++) {
        const gz = o[2] + z; if (gz < 0 || gz >= N) continue;
        for (let y = 0; y < R; y++) {
          const gy = o[1] + y; if (gy < 0 || gy >= N) continue;
          for (let x = 0; x < R; x++) {
            const gx = o[0] + x; if (gx < 0 || gx >= N) continue;
            const gi = idx(gx, gy, gz), li = x + R * (y + R * z);
            f[li] = this.density[gi]; m[li] = this.mat[gi];
          }
        }
      }
      jobs.push({ key, o, f, m }); transfer.push(f.buffer, m.buffer);
    }
    this.dirty.clear(); this.inFlight = true;
    this.worker.postMessage({ type: 'mesh', gen: this.gen, jobs }, transfer);
  }

  markDirty(x0, y0, z0, x1, y1, z1) {
    const c = v => Math.min(NCH - 1, Math.max(0, Math.floor(v / CS)));
    for (let z = c(z0 - 2); z <= c(z1 + 2); z++) for (let y = c(y0 - 2); y <= c(y1 + 2); y++) for (let x = c(x0 - 2); x <= c(x1 + 2); x++)
      this.dirty.add(x + NCH * (y + NCH * z));
  }

  // Distanza dal reperto in voxel (negativa = dentro), interpolata dalla griglia
  distAt(x, y, z) {
    if (!this.fd) return 99;
    x = Math.min(Math.max(x, 0), N - 1.001); y = Math.min(Math.max(y, 0), N - 1.001); z = Math.min(Math.max(z, 0), N - 1.001);
    const x0 = x | 0, y0 = y | 0, z0 = z | 0, fx = x - x0, fy = y - y0, fz = z - z0, f = this.fd, sxy = N * N;
    const i = idx(x0, y0, z0);
    const c00 = f[i] * (1 - fx) + f[i + 1] * fx, c10 = f[i + N] * (1 - fx) + f[i + N + 1] * fx;
    const c01 = f[i + sxy] * (1 - fx) + f[i + sxy + 1] * fx, c11 = f[i + sxy + N] * (1 - fx) + f[i + sxy + N + 1] * fx;
    return (c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz;
  }

  // Applica lo strumento attorno al punto (coordinate voxel)
  applyTool(gx, gy, gz, toolIndex, dt) {
    const T = TOOLS[toolIndex], r = T.r, r2 = r * r;
    let removed = 0; const mc = [0, 0, 0, 0];
    const x0 = Math.max(1, Math.floor(gx - r)), x1 = Math.min(N - 2, Math.ceil(gx + r));
    const y0 = Math.max(1, Math.floor(gy - r)), y1 = Math.min(N - 2, Math.ceil(gy + r));
    const z0 = Math.max(1, Math.floor(gz - r)), z1 = Math.min(N - 2, Math.ceil(gz + r));
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - gx, dy = y - gy, dz = z - gz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      const i = idx(x, y, z), den = this.density[i];
      if (den <= 0) continue;
      const m = this.mat[i], rate = T.rates[m];
      if (!rate) continue;
      const a = Math.min(den, rate * dt * (0.35 + 0.65 * (1 - Math.sqrt(d2) / r)));
      this.density[i] = den - a; removed += a; mc[m] += a;
    }
    if (removed > 0) this.markDirty(x0, y0, z0, x1, y1, z1);
    let dom = 0; for (let m = 1; m <= 3; m++) if (mc[m] > mc[dom]) dom = m;
    const f = this.distAt(gx, gy, gz), th = r * GIOCO.sogliaDanno;
    let dmg = 0;
    if (T.dmg > 0 && f < th) dmg = T.dmg * this.level.resistenza * Math.min(1.5, 1 - f / th) * dt;
    return { removed, dom, dmg, f };
  }

  materialAt(gx, gy, gz) {
    const xi = Math.round(gx), yi = Math.round(gy), zi = Math.round(gz);
    if (xi < 0 || yi < 0 || zi < 0 || xi >= N || yi >= N || zi >= N) return 0;
    const i = idx(xi, yi, zi);
    return this.density[i] > 0.05 ? this.mat[i] : 0;
  }

  exposure() {
    let rem = 0; const sh = this.shell;
    for (let k = 0; k < sh.length; k++) if (this.density[sh[k]] > ISO) rem++;
    return sh.length ? 1 - rem / sh.length : 1;
  }

  localToGrid(v, out = new THREE.Vector3()) { return out.set((v.x + HALF) / CELL, (v.y + HALF) / CELL, (v.z + HALF) / CELL); }

  setOpacity(o) {
    this.opacity = o;
    const tr = o < 0.999;
    if (this.rockMat.transparent !== tr) { this.rockMat.transparent = tr; this.rockMat.depthWrite = !tr; this.rockMat.needsUpdate = true; }
    this.rockMat.opacity = o;
    this.chunkGroup.visible = o > 0.01;
    for (const m of this.chunks.values()) m.castShadow = !tr;
  }

  // oggetti colpibili dal mouse
  get meshes() { return [...this.chunkGroup.children.filter(m => m.visible), ...(this.specMeshes || [])]; }
}

const _tint = new THREE.Color();
function toGeometry(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.col, 3));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  g.computeBoundingSphere();
  return g;
}
