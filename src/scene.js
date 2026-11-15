// =====================================================================
//  SCENA, CAMERA E LUCI
//  In Unity avresti: una Camera, una Directional Light, l'Ambient/Skybox
//  nelle Lighting Settings. Qui è tutto creato da codice.
// =====================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------- Parametri delle luci (modificabili anche dal pannello di debug) ----------
export const LUCI = {
  esposizione: 1.0,          // luminosità generale (come l'Exposure del post-processing)
  ambiente: 0.5,             // riflessi di una stanza virtuale: rende i materiali PBR (metallo, gemme) credibili
  cielo:   { colore: '#fff1dc', terreno: '#3b3026', intensita: 1.2 },  // luce diffusa dall'alto e dal basso
  sole:    { colore: '#ffffff', intensita: 2.4, direzione: [0.6, 1.2, 0.7], ombre: true },
  riempimento: { colore: '#ffc89a', intensita: 0.6, direzione: [-0.8, 0.2, -0.5] }, // luce calda di controluce
  sfondo: '#1d1813',         // colore di sfondo su PC (in AR lo sfondo è il mondo reale)
};

export function createScene() {
  // Renderer: disegna la scena. alpha = sfondo trasparente (serve per vedere il passthrough in AR)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // come il Tonemapping ACES di Unity
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LUCI.sfondo);

  // Ambiente: una "stanza" generata che fornisce luce indiretta e riflessi (simile a un Reflection Probe)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 20);
  camera.position.set(0.2, 0.14, 0.42);

  // Controlli orbitali (solo PC): tasto destro ruota, rotellina zoom
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 0.22; controls.maxDistance = 1.2;

  // Luci
  const hemi = new THREE.HemisphereLight();             // cielo + terreno
  const sun = new THREE.DirectionalLight();             // il "sole": unica luce che proietta ombre
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -0.2;
  sun.shadow.camera.right = sun.shadow.camera.top = 0.2;
  sun.shadow.camera.near = 0.05; sun.shadow.camera.far = 1.5;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.002;
  const fill = new THREE.DirectionalLight();
  scene.add(hemi, sun, sun.target, fill, fill.target);

  const lights = { hemi, sun, fill };
  applyLights(renderer, scene, lights);
  return { renderer, scene, camera, controls, lights };
}

// Applica i valori di LUCI (chiamata all'avvio e quando li cambi dal pannello di debug)
export function applyLights(renderer, scene, { hemi, sun, fill }) {
  renderer.toneMappingExposure = LUCI.esposizione;
  scene.environmentIntensity = LUCI.ambiente;
  hemi.color.set(LUCI.cielo.colore); hemi.groundColor.set(LUCI.cielo.terreno); hemi.intensity = LUCI.cielo.intensita;
  sun.color.set(LUCI.sole.colore); sun.intensity = LUCI.sole.intensita; sun.castShadow = LUCI.sole.ombre;
  fill.color.set(LUCI.riempimento.colore); fill.intensity = LUCI.riempimento.intensita;
  if (scene.background && scene.background.isColor) scene.background.set(LUCI.sfondo);
}

// Le luci direzionali puntano verso il loro "target": le teniamo attaccate alla roccia,
// così ombre e illuminazione restano uguali anche quando in AR la sposti sul tavolo.
const _d = new THREE.Vector3();
export function followTarget({ sun, fill }, target) {
  sun.target.position.copy(target);
  sun.position.copy(target).add(_d.fromArray(LUCI.sole.direzione).normalize().multiplyScalar(0.6));
  fill.target.position.copy(target);
  fill.position.copy(target).add(_d.fromArray(LUCI.riempimento.direzione).normalize().multiplyScalar(0.6));
}
