// Modelli 3D degli strumenti e cursore.
// Ogni strumento usa il tuo modello .glb se in config.js ha "modello", altrimenti una forma semplice fatta di cilindri.
// Convenzione: lo strumento punta verso -Z e la sua punta sta a TIP metri dall'origine (dove c'è il controller).
import * as THREE from 'three';
import { TOOLS, CELL } from './config.js';
import { loadModel } from './specimen-model.js';

export const TIP = 0.075; // distanza punta-controller in metri

// Forma semplice di riserva (cilindri e parallelepipedi)
function makeBasicModel(id) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.8, roughness: 0.3 });
  const body = new THREE.MeshStandardMaterial({ color: id === 'drill' ? 0xe8a94a : 0x6b4a2e, roughness: 0.6 });
  const cyl = (r1, r2, len, mat, z0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 16), mat); m.rotation.x = Math.PI / 2; m.position.z = z0 - len / 2; g.add(m); };
  if (id === 'drill') { cyl(0.016, 0.016, 0.04, body, 0.0); cyl(0.006, 0.006, 0.012, metal, -0.04); cyl(0.0015, 0.004, 0.023, metal, -0.052); }
  if (id === 'chisel') { cyl(0.008, 0.009, 0.045, body, 0.0); const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.002, 0.03), metal); b.position.z = -0.06; g.add(b); }
  if (id === 'brush') { cyl(0.005, 0.005, 0.05, body, 0.0); cyl(0.009, 0.006, 0.025, new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 1 }), -0.05); }
  return g;
}

// Tutti i vertici del modello in coordinate del modello
function forEachVertex(root, fn) {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  root.traverse(o => {
    const pa = o.isMesh && o.geometry.attributes.position; if (!pa) return;
    for (let i = 0; i < pa.count; i++) fn(v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld));
  });
}

const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

// Da che parte è la punta? Con 'auto': l'estremità più sottile lungo l'asse più lungo.
function findTipDirection(root, box, punta) {
  if (punta && punta !== 'auto') {
    const neg = punta.startsWith('-'), a = AXES[punta.replace('-', '')];
    if (a) return new THREE.Vector3(...a).multiplyScalar(neg ? -1 : 1);
  }
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const k = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  const others = ['x', 'y', 'z'].filter(a => a !== k), len = size[k];
  let wMin = 0, wMax = 0; // larghezza vicino alle due estremità
  forEachVertex(root, p => {
    const t = (p[k] - box.min[k]) / len;
    const w = Math.hypot(p[others[0]] - ctr[others[0]], p[others[1]] - ctr[others[1]]);
    if (t < 0.15) wMin = Math.max(wMin, w);
    if (t > 0.85) wMax = Math.max(wMax, w);
  });
  return new THREE.Vector3(...AXES[k]).multiplyScalar(wMax <= wMin ? 1 : -1);
}

// Allinea il modello: punta verso -Z a distanza TIP, lunghezza = t.lunghezza cm
function fitToolModel(scene, t) {
  const model = scene.clone(true);
  model.traverse(o => { if (o.isMesh) o.castShadow = true; });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const dir = findTipDirection(model, box, t.punta);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const length = Math.abs(dir.dot(size)) || 1;
  const tipPoint = ctr.clone().addScaledVector(dir, length / 2);

  const offset = new THREE.Group(); offset.position.copy(tipPoint).negate(); offset.add(model);
  const orient = new THREE.Group(); orient.add(offset);
  orient.quaternion.setFromUnitVectors(dir, new THREE.Vector3(0, 0, -1));
  orient.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(t.rotazione || 0)));
  orient.scale.setScalar(((t.lunghezza || 12) / 100) / length);
  const holder = new THREE.Group(); holder.position.z = -TIP; holder.add(orient);
  return holder;
}

export class ToolRig extends THREE.Group {
  constructor() {
    super();
    this.models = TOOLS.map((t, i) => { const m = new THREE.Group(); m.add(makeBasicModel(t.id)); m.visible = i === 0; this.add(m); return m; });
    this.tip = new THREE.Object3D(); this.tip.position.z = -TIP; this.add(this.tip);
    // carica i modelli .glb indicati in config.js (se il caricamento fallisce resta la forma semplice)
    TOOLS.forEach((t, i) => {
      if (!t.modello) return;
      loadModel(t.modello)
        .then(gltf => { this.models[i].clear(); this.models[i].add(fitToolModel(gltf.scene, t)); })
        .catch(e => console.warn(`Strumento "${t.name}": ${e.message}. Uso la forma semplice.`));
    });
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
