// Lato "thread principale" della roccia: stato dei voxel, strumenti, chunk e reperto.
import * as THREE from 'three';
import { N, CS, NCH, CELL, HALF, ISO, TOOLS, idx } from '../config.js';
import { makeSpecimen } from '../specimens.js';
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

    this.rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.chunkGroup = new THREE.Group(); this.add(this.chunkGroup);
    this.pivot = new THREE.Group(); this.add(this.pivot);
    this.specMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
    this.specMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.specMat);
    this.pivot.add(this.specMesh);
    this.opacity = 1;

    // ombra morbida sotto la roccia
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.add(this.shadow);
  }

  // Nuova roccia: la genera il worker, poi tutti i chunk vengono ricostruiti
  generate(seed, type) {
    this.gen++; this.ready = false;
    this.specimen = makeSpecimen(type, seed);
    this.specMat.roughness = this.specimen.material.roughness;
    this.specMat.metalness = this.specimen.material.metalness;
    return new Promise(res => {
      this._onReady = res;
      this.worker.postMessage({ type: 'gen', id: this.gen, seed, specimen: type });
    });
  }

  _onMessage(d) {
    if (d.type === 'gen') {
      if (d.id !== this.gen) return;
      this.density = d.density; this.mat = d.mat; this.fd = d.fd; this.shell = d.shell;
      const sm = d.specimenMesh, g = toGeometry(sm);
      g.computeBoundingBox();
      const ctr = g.boundingBox.getCenter(new THREE.Vector3());
      g.translate(-ctr.x, -ctr.y, -ctr.z);
      this.specMesh.geometry.dispose(); this.specMesh.geometry = g;
      this.pivot.position.copy(ctr); this.pivot.rotation.set(0, 0, 0); this.pivot.visible = true;
      for (let z = 0; z < NCH; z++) for (let y = 0; y < NCH; y++) for (let x = 0; x < NCH; x++) this.dirty.add(x + NCH * (y + NCH * z));
      this.inFlight = false; this._firstMesh = true;
      this.flush();
    } else if (d.type === 'mesh') {
      this.inFlight = false;
      if (d.gen !== this.gen) { this.flush(); return; }
      for (const r of d.results) {
        let mesh = this.chunks.get(r.key);
        if (!r.idx.length) { if (mesh) { mesh.visible = false; } continue; }
        const g = toGeometry(r);
        if (!mesh) { mesh = new THREE.Mesh(g, this.rockMat); mesh.renderOrder = 2; mesh.userData.rock = true; this.chunkGroup.add(mesh); this.chunks.set(r.key, mesh); }
        else { mesh.geometry.dispose(); mesh.geometry = g; }
        mesh.visible = true;
      }
      if (this._firstMesh) {
        this._firstMesh = false;
        let minY = 0;
        for (const m of this.chunks.values()) if (m.visible) { m.geometry.computeBoundingBox(); minY = Math.min(minY, m.geometry.boundingBox.min.y); }
        this.bottom = -minY;
        this.shadow.position.y = minY + 0.001;
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
    const f = this.specimen.dist(gx, gy, gz);
    let dmg = 0;
    if (T.dmg > 0 && f < r * 0.85) dmg = T.dmg * Math.min(1.5, 1 - f / (r * 0.85)) * dt;
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
  }

  get meshes() { return [...this.chunkGroup.children.filter(m => m.visible), this.specMesh]; }
}

function toGeometry(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.col, 3));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  g.computeBoundingSphere();
  return g;
}
