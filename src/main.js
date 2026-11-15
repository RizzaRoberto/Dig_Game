import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TOOLS, MAT_HEX, MAT_NAME, ROCK, CELL, WIN_EXPOSURE, SCAN_TIME, SCAN_COOLDOWN } from './config.js';
import { pickSpecimenType } from './specimens.js';
import { Rock } from './voxel/rock.js';
import { Debris } from './fx/debris.js';
import { initAudio, toolSound, blip } from './fx/audio.js';
import { ToolRig, Cursor } from './tools.js';
import { XRInput } from './xr/xr.js';
import { XRHud } from './ui/hud-xr.js';
import { DomHud, fmtTime } from './ui/hud-dom.js';
import { addFind } from './collection.js';

// ================= STATO DI GIOCO =================
const G = {
  tool: 0, integrity: 100, exposure: 0, state: 'loading', loading: true, placing: false,
  started: false, t0: 0, tEnd: 0, scanT: 0, scanCD: 0, flash: 0, layer: '–',
  rightActive: false, specimenName: '', stars: 0, banner: '',
};
const MAT_COL = Object.fromEntries(Object.entries(MAT_HEX).map(([k, v]) => [k, new THREE.Color(v)]));

// ================= SCENA =================
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const BG = new THREE.Color(0x1d1813);
scene.background = BG;
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 20);
const CAM0 = new THREE.Vector3(0.2, 0.14, 0.42);
camera.position.copy(CAM0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 0.22; controls.maxDistance = 1.2;

scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3b3026, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(0.6, 1.2, 0.7); scene.add(sun);
const fill = new THREE.DirectionalLight(0xffc89a, 0.6); fill.position.set(-0.8, 0.2, -0.5); scene.add(fill);

const rock = new Rock(); scene.add(rock);
const debris = new Debris(); scene.add(debris);
const cursor = new Cursor(); scene.add(cursor);
const toolRig = new ToolRig();
const xrHud = new XRHud();
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.125, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8a94a, transparent: true, opacity: 0.8 }));
reticle.visible = false; reticle.matrixAutoUpdate = false; scene.add(reticle);

// ================= INTERFACCIA =================
const hud = new DomHud({ tool: setTool, scan: scanner, newDig, enterAR });
function setTool(i) { G.tool = i; toolRig.setTool(i); hud.setTool(i); }

// ================= PARTITA =================
async function newDig() {
  G.state = 'loading'; G.loading = true; G.rightActive = false;
  hud.hideResult();
  const type = pickSpecimenType(Math.random);
  await rock.generate((Math.random() * 2 ** 31) | 0, type);
  Object.assign(G, { integrity: 100, state: 'play', loading: false, started: false, t0: 0, tEnd: 0, scanT: 0, scanCD: 0, flash: 0, specimenName: rock.specimen.name, stars: 0, banner: '' });
  G.exposure = rock.exposure();
  rock.setOpacity(1); rock.specMat.color.setRGB(1, 1, 1);
  if (renderer.xr.isPresenting && !G.placing && !xr.anchor) xr.setAnchor(rock.matrixWorld);
}

function finish(won) {
  G.state = won ? 'won' : 'lost'; G.tEnd = performance.now(); G.rightActive = false; toolSound(G.tool, false);
  const secs = G.started ? (G.tEnd - G.t0) / 1000 : 0;
  if (won) {
    G.stars = G.integrity >= 90 ? 3 : G.integrity >= 60 ? 2 : 1;
    const r = addFind(rock.specimen.type, G.stars, G.integrity, secs);
    G.banner = r.isNew ? 'Nuovo reperto nel museo!' : r.isRecord ? 'Nuovo record!' : '';
    hud.showResult(true, G.specimenName, G.stars, `Integrità ${Math.round(G.integrity)}% · Tempo ${fmtTime(secs)}`, G.banner);
    blip('win');
  } else {
    G.banner = '';
    hud.showResult(false, '', 0, 'Troppo vicino col trapano! Vicino al reperto usa scalpello e pennello.');
    const col = rock.specMesh.geometry.getAttribute('color');
    const c = col ? new THREE.Color(col.getX(0), col.getY(0), col.getZ(0)) : new THREE.Color(0xe2cfa2);
    debris.spawn(rock.pivot.getWorldPosition(new THREE.Vector3()), c, 140, 0.6);
    rock.pivot.visible = false;
    blip('lose');
  }
}

function scanner() {
  if (G.state !== 'play' || G.scanCD > 0) return;
  G.scanT = SCAN_TIME; G.scanCD = SCAN_COOLDOWN; blip('scan');
}

// ================= INPUT PC / TOUCH =================
const pointer = new THREE.Vector2(); let pointerIn = false, pointerDown = false; const activePtrs = new Set();
const ray = new THREE.Raycaster();
const cv = renderer.domElement;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  activePtrs.add(e.pointerId); initAudio(); setPointer(e);
  pointerDown = activePtrs.size === 1 && e.button === 0 && !e.shiftKey;
});
cv.addEventListener('pointermove', setPointer);
const up = e => { activePtrs.delete(e.pointerId); if (!activePtrs.size) pointerDown = false; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('pointerleave', e => { pointerIn = false; if (e.pointerType === 'mouse') pointerDown = false; });
function setPointer(e) { pointer.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); pointerIn = true; }
addEventListener('keydown', e => {
  if (e.key === 'Shift') controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  if (e.key >= '1' && e.key <= String(TOOLS.length)) setTool(+e.key - 1);
  if (e.key === 's' || e.key === 'S') scanner();
  if (e.key === 'r' || e.key === 'R') newDig();
  if (e.key === 'Escape') hud.showMuseum(false);
});
addEventListener('keyup', e => { if (e.key === 'Shift') controls.mouseButtons.LEFT = null; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ================= INPUT VISORE =================
const xr = new XRInput(renderer, scene);
let grab = null;
xr.on.connected = (h, c) => { if (h === 'right') c.add(toolRig); else c.add(xrHud); };
xr.on.disconnected = (h, c) => { c.remove(h === 'right' ? toolRig : xrHud); };
xr.on.trigger = (h, down) => {
  if (h === 'right') {
    if (G.placing) { if (down) placeRock(); return; }
    G.rightActive = down && G.state === 'play';
  } else if (down) {
    if (G.state === 'won' || G.state === 'lost') newDig();
    else if (G.placing) placeRock();
    else { setTool((G.tool + 1) % TOOLS.length); blip('tool'); }
  }
};
xr.on.squeeze = (h, down) => {
  if (h === 'right') { if (down) scanner(); return; }
  if (G.placing) return;
  if (down) { const c = xr.hands.left; c.updateMatrixWorld(); xr.clearAnchor(); grab = { c, off: c.matrixWorld.clone().invert().multiply(rock.matrixWorld) }; }
  else if (grab) { grab = null; xr.setAnchor(rock.matrixWorld); }
};
xr.on.button = (h, i) => {
  if (h === 'left' && i === 4) { G.placing = true; xr.clearAnchor(); grab = null; }        // X: riposiziona
  if (h === 'left' && i === 5) newDig();                                                     // Y: nuovo scavo
  if (h === 'right' && i === 4) scanner();                                                   // A: scanner
  if (h === 'right' && i === 5) { setTool((G.tool + 1) % TOOLS.length); blip('tool'); }     // B: strumento
};
function placeRock() { G.placing = false; reticle.visible = false; rock.updateMatrixWorld(); xr.setAnchor(rock.matrixWorld); blip('place'); }

async function enterAR() {
  initAudio();
  if (!(await XRInput.supported())) { hud.note('Realtà mista non disponibile qui. Apri la pagina dal browser del Meta Quest (indirizzo https).'); return; }
  try { await xr.enter(); hud.note(''); }
  catch (e) { hud.note('Non riesco ad avviare l\'AR (' + e.message + '). Se la pagina è dentro un\'anteprima, aprila dal suo indirizzo https.'); }
}
renderer.xr.addEventListener('sessionstart', () => { scene.background = null; G.placing = true; });
renderer.xr.addEventListener('sessionend', () => {
  scene.background = BG; G.placing = false; grab = null; G.rightActive = false; reticle.visible = false;
  rock.position.set(0, 0, 0); rock.quaternion.identity();
  camera.position.copy(CAM0); controls.target.set(0, 0, 0);
});

const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpM = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
function updatePlacement() {
  const hand = xr.hands.right ? 'right' : 'left', c = xr.hands[hand];
  const hit = xr.hits[hand];
  if (hit) {
    hit.decompose(tmpV, tmpQ, tmpS);
    reticle.matrix.makeTranslation(tmpV.x, tmpV.y + 0.002, tmpV.z); reticle.visible = true;
    rock.position.set(tmpV.x, tmpV.y + rock.bottom, tmpV.z);
  } else if (c) {
    reticle.visible = false;
    c.getWorldPosition(tmpV); tmpV2.set(0, 0, -1).applyQuaternion(c.getWorldQuaternion(tmpQ));
    rock.position.copy(tmpV).addScaledVector(tmpV2, 0.45);
  } else return;
  // la roccia guarda verso di te (solo rotazione orizzontale)
  camera.getWorldPosition(tmpV2).sub(rock.position); tmpV2.y = 0;
  if (tmpV2.lengthSq() > 1e-4) rock.quaternion.setFromAxisAngle(UP, Math.atan2(tmpV2.x, tmpV2.z));
}

// ================= LOOP =================
const clock = new THREE.Clock();
let lastPulse = 0;
setTool(0);
newDig();

renderer.setAnimationLoop((time, frame) => {
  const dt = Math.min(clock.getDelta(), 0.05), now = performance.now();
  const inXR = renderer.xr.isPresenting;
  if (inXR) {
    xr.update(frame);
    if (G.placing) updatePlacement();
    else if (grab) { tmpM.multiplyMatrices(grab.c.matrixWorld, grab.off); tmpM.decompose(rock.position, rock.quaternion, tmpS); }
    else if (xr.anchorPose) xr.anchorPose.decompose(rock.position, rock.quaternion, tmpS);
  }
  rock.updateMatrixWorld();

  // ---- posizione della punta dello strumento ----
  const T = TOOLS[G.tool], playing = G.state === 'play' && !G.placing;
  let tipLocal = null, using = false;
  cursor.visible = false;
  if (inXR) {
    if (toolRig.parent && playing) {
      toolRig.tip.getWorldPosition(tmpV);
      cursor.position.copy(tmpV); cursor.visible = true;
      tipLocal = rock.worldToLocal(tmpV.clone());
      using = G.rightActive;
    }
  } else if (pointerIn && playing) {
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(rock.meshes, false);
    if (hits.length) {
      cursor.position.copy(hits[0].point); cursor.visible = true;
      tipLocal = rock.worldToLocal(hits[0].point.clone().addScaledVector(ray.ray.direction, CELL * 0.5));
      using = pointerDown;
    }
  }

  // ---- scavo ----
  let res = null, near = false;
  if (tipLocal) {
    const g = rock.localToGrid(tipLocal);
    const fd = rock.specimen.dist(g.x, g.y, g.z);
    near = T.dmg > 0 && fd < T.r * 1.9;
    G.layer = fd < 0.8 ? 'Reperto!' : (MAT_NAME[rock.materialAt(g.x, g.y, g.z)] || '–');
    if (using) {
      if (!G.started) { G.started = true; G.t0 = now; }
      res = rock.applyTool(g.x, g.y, g.z, G.tool, dt);
      G.integrity = Math.max(0, G.integrity - res.dmg);
      if (res.removed > 0 && Math.random() < 0.7)
        debris.spawn(rock.localToWorld(tipLocal.clone()), MAT_COL[res.dom || 1], Math.min(4, 1 + Math.floor(res.removed * 3)));
      if (res.dmg > 0) G.flash = 0.25;
    }
  } else G.layer = '–';
  cursor.setState(G.tool, res && res.dmg > 0 ? 'damage' : near ? 'near' : 'idle');

  // ---- suono e vibrazione ----
  const active = !!(res && (res.removed > 0.0005 || res.dmg > 0));
  toolSound(G.tool, active, !!(res && res.dmg > 0));
  if (inXR && now - lastPulse > 40) {
    if (active) { lastPulse = now; xr.pulse('right', res.dmg > 0 ? 1 : T.hapt * (res.dom === ROCK ? 1 : 0.6), 50); }
    else if (near && now - lastPulse > 300) { lastPulse = now; xr.pulse('right', 0.15, 20); }
  }

  // ---- mesh e avanzamento ----
  rock.flush();
  if (res && res.removed > 0) G.exposure = rock.exposure();

  // ---- aspetto del reperto ----
  G.flash = Math.max(0, G.flash - dt);
  const k = G.integrity / 100;
  rock.specMat.color.setRGB(0.62 + 0.38 * k, 0.5 + 0.5 * k, 0.45 + 0.55 * k);
  rock.specMat.emissive.setRGB(G.flash * 2.4, G.flash * 0.3, 0);

  // ---- scanner e trasparenza ----
  if (G.scanT > 0) G.scanT = Math.max(0, G.scanT - dt);
  if (G.scanCD > 0) G.scanCD = Math.max(0, G.scanCD - dt);
  let target = G.scanT > 0 ? 0.22 : G.placing ? 0.8 : 1;
  if (G.state === 'won') target = 0;
  const o = rock.opacity + (target - rock.opacity) * Math.min(1, dt * (G.state === 'won' ? 1.5 : 8));
  rock.setOpacity(Math.abs(o - target) < 0.005 ? target : o);

  // ---- fine partita ----
  if (G.state === 'play') {
    if (G.integrity <= 0) finish(false);
    else if (G.exposure >= WIN_EXPOSURE) finish(true);
  }
  if (G.state === 'won') rock.pivot.rotation.y += dt * 0.6;

  debris.update(dt);

  // ---- HUD ----
  const secs = G.started ? ((G.state === 'play' ? now : G.tEnd) - G.t0) / 1000 : 0;
  hud.update(G, secs);
  if (inXR) xrHud.draw(G, now);

  if (!inXR) controls.update();
  renderer.render(scene, camera);
});

// accesso per debug dalla console
window.__scavo = { G, rock, newDig };
