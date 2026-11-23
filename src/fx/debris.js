// Detriti che saltano via mentre scavi (InstancedMesh, coordinate mondo)
import * as THREE from 'three';
import { CELL } from '../config.js';

const DMAX = 400;
export class Debris extends THREE.InstancedMesh {
  constructor() {
    super(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 1 }), DMAX);
    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.frustumCulled = false;
    this.P = new Float32Array(DMAX * 3); this.V = new Float32Array(DMAX * 3);
    this.L = new Float32Array(DMAX); this.Sz = new Float32Array(DMAX); this.Rt = new Float32Array(DMAX);
    this.next = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < DMAX; i++) { this.setColorAt(i, white); this._m.makeScale(0, 0, 0); this.setMatrixAt(i, this._m); }
  }
  spawn(p, color, n, speed = 0.35) {
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % DMAX;
      this.P[3 * i] = p.x; this.P[3 * i + 1] = p.y; this.P[3 * i + 2] = p.z;
      this.V[3 * i] = (Math.random() - .5) * speed; this.V[3 * i + 1] = Math.random() * speed * 0.9; this.V[3 * i + 2] = (Math.random() - .5) * speed;
      this.L[i] = 0.6 + Math.random() * 0.6; this.Sz[i] = CELL * (0.3 + Math.random() * 0.5); this.Rt[i] = Math.random() * 6;
      this.setColorAt(i, color);
    }
    this.instanceColor.needsUpdate = true;
  }
  update(dt) {
    const { P, V, L, Sz, Rt } = this;
    for (let i = 0; i < DMAX; i++) {
      if (L[i] <= 0) continue;
      L[i] -= dt; V[3 * i + 1] -= 2.5 * dt;
      P[3 * i] += V[3 * i] * dt; P[3 * i + 1] += V[3 * i + 1] * dt; P[3 * i + 2] += V[3 * i + 2] * dt;
      Rt[i] += dt * 8;
      const s = L[i] > 0 ? Sz[i] * Math.min(1, L[i] * 3) : 0;
      this._m.compose(this._p.set(P[3 * i], P[3 * i + 1], P[3 * i + 2]), this._q.setFromEuler(this._e.set(Rt[i], Rt[i] * 0.7, 0)), this._s.set(s, s, s));
      this.setMatrixAt(i, this._m);
    }
    this.instanceMatrix.needsUpdate = true;
  }
}
