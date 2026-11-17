// Caricamento dei modelli .glb dei reperti e preparazione per la roccia.
// Il modello viene: centrato, scalato alla dimensione del livello, ruotato,
// e i suoi triangoli vengono passati al worker che li converte in voxel.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { C, CELL, HALF } from './config.js';

// Tutti i file in src/modelli/ (e sottocartelle, come strumenti/) vengono trovati automaticamente da Vite
const FILES = import.meta.glob('./modelli/**/*.glb', { eager: true, query: '?url', import: 'default' });

const loader = new GLTFLoader();
const draco = new DRACOLoader(); // i decoder sono inclusi nel progetto
loader.setDRACOLoader(draco);
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

export function modelUrl(name) { return FILES['./modelli/' + name]; }

export function loadModel(name) {
  if (cache.has(name)) return cache.get(name);
  const url = modelUrl(name);
  if (!url) return Promise.reject(new Error(`Modello "${name}" non trovato: mettilo nella cartella src/modelli/`));
  let p;
  if (url.startsWith('data:')) { // build a file singolo: il modello è incorporato nella pagina
    const bin = atob(url.slice(url.indexOf(',') + 1)), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    p = loader.parseAsync(buf.buffer, '');
  } else p = loader.loadAsync(url);
  cache.set(name, p);
  return p;
}

/**
 * Prepara un'istanza del modello per un nuovo scavo.
 * @returns {{ inner: THREE.Object3D, pivotPos: THREE.Vector3, positions: Float32Array, index: Uint32Array }}
 *  inner     = modello già scalato e ruotato, da appendere al pivot della roccia
 *  pivotPos  = posizione del centro del reperto nello spazio locale della roccia (metri)
 *  positions = triangoli in coordinate voxel, per il worker
 */
export async function prepareModel(level, rand) {
  const gltf = await loadModel(level.modello);
  const model = gltf.scene.clone(true);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
    o.castShadow = o.receiveShadow = true;
  });
  model.updateMatrixWorld(true);

  // centra e scala: il lato più lungo diventa level.dimensione cm
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const offset = new THREE.Group(); offset.position.copy(center).negate(); offset.add(model);
  const inner = new THREE.Group(); inner.add(offset);
  inner.scale.setScalar((level.dimensione / 100) / Math.max(size.x, size.y, size.z, 1e-6));
  if (Array.isArray(level.orientamento)) inner.rotation.set(...level.orientamento.map(THREE.MathUtils.degToRad));
  else inner.quaternion.random();

  // posizione nella roccia: vicino al centro, con un piccolo spostamento casuale
  const g = [C + (rand() - 0.5) * 2, C + (rand() - 0.5) * 2, C + (rand() - 0.5) * 2];
  const pivotPos = new THREE.Vector3(g[0] * CELL - HALF, g[1] * CELL - HALF, g[2] * CELL - HALF);

  // raccoglie tutti i triangoli in coordinate voxel
  const root = new THREE.Group(); root.position.copy(pivotPos); root.add(inner);
  root.updateMatrixWorld(true);
  const pos = [], ind = [], v = new THREE.Vector3();
  inner.traverse(o => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const pa = o.geometry.attributes.position, base = pos.length / 3;
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
      pos.push((v.x + HALF) / CELL, (v.y + HALF) / CELL, (v.z + HALF) / CELL);
    }
    const ix = o.geometry.index;
    if (ix) for (let i = 0; i < ix.count; i++) ind.push(base + ix.getX(i));
    else for (let i = 0; i < pa.count; i++) ind.push(base + i);
  });
  root.remove(inner);
  return { inner, pivotPos, positions: new Float32Array(pos), index: new Uint32Array(ind) };
}
