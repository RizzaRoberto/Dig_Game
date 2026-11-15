// Modelli 3D degli strumenti (tenuti dal controller destro) e cursore
import * as THREE from 'three';
import { TOOLS, CELL } from './config.js';

export const TIP = 0.075; // distanza punta-controller in metri

function makeToolModel(id) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.8, roughness: 0.3 });
  const body = new THREE.MeshStandardMaterial({ color: id === 'drill' ? 0xe8a94a : 0x6b4a2e, roughness: 0.6 });
  const cyl = (r1, r2, len, mat, z0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 16), mat); m.rotation.x = Math.PI / 2; m.position.z = z0 - len / 2; g.add(m); };
  if (id === 'drill') { cyl(0.016, 0.016, 0.04, body, 0.0); cyl(0.006, 0.006, 0.012, metal, -0.04); cyl(0.0015, 0.004, 0.023, metal, -0.052); }
  if (id === 'chisel') { cyl(0.008, 0.009, 0.045, body, 0.0); const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.002, 0.03), metal); b.position.z = -0.06; g.add(b); }
  if (id === 'brush') { cyl(0.005, 0.005, 0.05, body, 0.0); cyl(0.009, 0.006, 0.025, new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 1 }), -0.05); }
  return g;
}

export class ToolRig extends THREE.Group {
  constructor() {
    super();
    this.models = TOOLS.map((t, i) => { const m = makeToolModel(t.id); m.visible = i === 0; this.add(m); return m; });
    this.tip = new THREE.Object3D(); this.tip.position.z = -TIP; this.add(this.tip);
  }
  setTool(i) { this.models.forEach((m, k) => (m.visible = k === i)); }
}

export class Cursor extends THREE.Mesh {
  constructor() {
    super(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd28a, wireframe: true, transparent: true, opacity: 0.35, depthTest: false }));
    this.renderOrder = 10;
  }
  setState(toolIndex, mode) { // mode: idle | near | damage
    this.scale.setScalar(TOOLS[toolIndex].r * CELL);
    this.material.color.set(mode === 'damage' ? 0xff3b2a : mode === 'near' ? 0xff9a2e : 0xffd28a);
    this.material.opacity = mode === 'idle' ? 0.35 : 0.75;
  }
}
