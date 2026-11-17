// =====================================================================
//  PUNTO DI INGRESSO DEL GIOCO
//  Crea la scena, collega input e interfaccia, e contiene il loop di gioco
//  (l'equivalente di Update() in Unity: vedi renderer.setAnimationLoop in fondo).
// =====================================================================
import * as THREE from 'three';
import { TOOLS, GIOCO, MAT_HEX, MAT_NAME, ROCK, CELL } from './config.js';
import { LEVELS } from './levels.js';
import { createScene, applyLights, followTarget } from './scene.js';
import { Rock } from './voxel/rock.js';
import { Debris } from './fx/debris.js';
import { initAudio, toolSound, blip } from './fx/audio.js';
import { ToolRig, Cursor, TIP } from './tools.js';
import { XRInput } from './xr/xr.js';
import { XRHud } from './ui/hud-xr.js';
import { UI, fmtTime } from './ui/screens.js';
import { createDebug } from './ui/debug.js';
import { saveResult, isUnlocked } from './progress.js';

// ================= STATO DI GIOCO =================
const G = {
  levelIndex: 0, tool: 0, integrity: 100, exposure: 0, winAt: 0.88,
  state: 'menu',          // menu | loading | play | won | lost
  loading: false, placing: false, started: false, t0: 0, tEnd: 0,
  scanT: 0, scanCD: 0, flash: 0, layer: '–', rightActive: false,
  specimenName: '', stars: 0, banner: '',
};
const MAT_COL = Object.fromEntries(Object.entries(MAT_HEX).map(([k, v]) => [k, new THREE.Color(v)]));

// ================= SCENA =================
const { renderer, scene, camera, controls, lights } = createScene();
const CAM0 = camera.position.clone();
const rock = new Rock(); scene.add(rock);
const debris = new Debris(); scene.add(debris);
const cursor = new Cursor(); scene.add(cursor);
const toolRig = new ToolRig(); scene.add(toolRig); // su PC segue il mouse, nel visore passa al controller destro
const xrHud = new XRHud();
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.125, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8a94a, transparent: true, opacity: 0.8 }));
reticle.visible = false; reticle.matrixAutoUpdate = false; scene.add(reticle);

// ================= INTERFACCIA =================
const ui = new UI({
  play: (i, ar) => { if (ar) enterAR(); startLevel(i); },
  tool: setTool, scan: scanner, enterAR,
  retry: () => startLevel(G.levelIndex),
  next: () => startLevel(G.levelIndex + 1),
  menu: () => { if (renderer.xr.isPresenting) renderer.xr.getSession().end(); showMenu('levels'); },
  arSupported: () => XRInput.supported(),
});
const debug = createDebug({
  onLights: () => applyLights(renderer, scene, lights),
  getLevel: () => rock.level,
  regenerate: () => startLevel(G.levelIndex, rock.level),
});
function setTool(i) { G.tool = i; toolRig.setTool(i); ui.setTool(i); }

// ================= FLUSSO DI GIOCO =================
async function startLevel(i, levelOverride) {
  const level = levelOverride || LEVELS[i];
  if (!level) return;
  G.levelIndex = i; G.state = 'loading'; G.loading = true; G.rightActive = false;
  ui.show('game'); ui.setLevel(level); ui.hideResult();
  controls.autoRotate = false;
  try {
    await rock.generate(level, (Math.random() * 2 ** 31) | 0);
  } catch (e) {
    G.loading = false; ui.loading(false);
    ui.note('Errore nel caricare il livello: ' + e.message);
    console.error(e); return;
  }
  Object.assign(G, { integrity: 100, state: 'play', loading: false, started: false, t0: 0, tEnd: 0, scanT: 0, scanCD: 0, flash: 0,
    specimenName: level.nome, stars: 0, banner: '', winAt: level.vittoria });
  G.exposure = rock.exposure();
  rock.setOpacity(1);
  if (renderer.xr.isPresenting && !G.placing && !xr.anchor) xr.setAnchor(rock.matrixWorld);
}

// Menu: la roccia del primo livello gira sullo sfondo
async function showMenu(screen = 'start') {
  G.state = 'menu'; ui.show(screen);
  camera.position.copy(CAM0).multiplyScalar(1.15); controls.target.set(0, 0, 0);
  controls.autoRotate = true; controls.autoRotateSpeed = 0.8;
  if (!rock.density) { try { await rock.generate(LEVELS[0], 7); } catch (e) { ui.note(e.message); } }
  rock.setOpacity(1); rock.specPivot.visible = true;
}

function finish(won) {
  G.state = won ? 'won' : 'lost'; G.tEnd = performance.now(); G.rightActive = false; toolSound(G.tool, false);
  const secs = G.started ? (G.tEnd - G.t0) / 1000 : 0;
  const level = rock.level;
  if (won) {
    const [s3, s2] = GIOCO.stelle;
    G.stars = G.integrity >= s3 ? 3 : G.integrity >= s2 ? 2 : 1;
    const r = saveResult(level.id, G.stars, G.integrity, secs);
    const hasNext = G.levelIndex + 1 < LEVELS.length;
    G.banner = r.isFirst ? (hasNext ? 'Nuovo livello sbloccato!' : 'Livello completato!') : r.isRecord ? 'Nuovo record!' : '';
    ui.showResult({ won, name: level.nome, stars: G.stars, text: `Integrità ${Math.round(G.integrity)}% · Tempo ${fmtTime(secs)}`, badge: G.banner, hasNext: hasNext && isUnlocked(LEVELS, G.levelIndex + 1) });
    blip('win');
  } else {
    G.banner = '';
    ui.showResult({ won, text: 'Troppo vicino col trapano! Vicino al reperto usa scalpello e pennello.' });
    debris.spawn(rock.specPivot.getWorldPosition(new THREE.Vector3()), new THREE.Color(level.coloreDetriti), 140, 0.6);
    rock.specPivot.visible = false;
    blip('lose');
  }
}

function scanner() {
  if (G.state !== 'play' || G.scanCD > 0) return;
  G.scanT = GIOCO.scanner.durata; G.scanCD = GIOCO.scanner.ricarica; blip('scan');
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
  if (ui.screen !== 'game') return;
  if (e.key === 'Shift') controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  if (e.key >= '1' && e.key <= String(TOOLS.length)) setTool(+e.key - 1);
  if (e.key === 's' || e.key === 'S') scanner();
  if (e.key === 'r' || e.key === 'R') startLevel(G.levelIndex);
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
    if (G.state === 'won' || G.state === 'lost') startLevel(G.levelIndex);
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
  if (h === 'left' && i === 4) { G.placing = true; xr.clearAnchor(); grab = null; }                 // X: riposiziona
  if (h === 'left' && i === 5) renderer.xr.getSession()?.end();                                        // Y: esci dall'AR
  if (h === 'right' && i === 4) scanner();                                                            // A: scanner
  if (h === 'right' && i === 5) { setTool((G.tool + 1) % TOOLS.length); blip('tool'); }              // B: strumento
};
function placeRock() { G.placing = false; reticle.visible = false; rock.updateMatrixWorld(); xr.setAnchor(rock.matrixWorld); blip('place'); }

async function enterAR() {
  initAudio();
  if (!(await XRInput.supported())) { ui.note('Realtà mista non disponibile qui. Apri la pagina dal browser del Meta Quest (indirizzo https).'); return; }
  try { await xr.enter(); ui.note(''); }
  catch (e) { ui.note('Non riesco ad avviare l\'AR (' + e.message + ').'); }
}
renderer.xr.addEventListener('sessionstart', () => { scene.background = null; G.placing = true; });
renderer.xr.addEventListener('sessionend', () => {
  scene.background = new THREE.Color(); applyLights(renderer, scene, lights);
  G.placing = false; grab = null; G.rightActive = false; reticle.visible = false;
  rock.position.set(0, 0, 0); rock.quaternion.identity(); scene.add(toolRig);
  camera.position.copy(CAM0); controls.target.set(0, 0, 0);
});

const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpM = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0);
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
  camera.getWorldPosition(tmpV2).sub(rock.position); tmpV2.y = 0;
  if (tmpV2.lengthSq() > 1e-4) rock.quaternion.setFromAxisAngle(UP, Math.atan2(tmpV2.x, tmpV2.z));
}

// ================= LOOP DI GIOCO (come Update() in Unity) =================
const timer = new THREE.Timer();
let lastPulse = 0;
setTool(0);
showMenu('start');

renderer.setAnimationLoop((time, frame) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.05), now = performance.now();
  const inXR = renderer.xr.isPresenting;
  if (inXR) {
    xr.update(frame);
    if (G.placing) updatePlacement();
    else if (grab) { tmpM.multiplyMatrices(grab.c.matrixWorld, grab.off); tmpM.decompose(rock.position, rock.quaternion, tmpS); }
    else if (xr.anchorPose) xr.anchorPose.decompose(rock.position, rock.quaternion, tmpS);
  }
  rock.updateMatrixWorld();
  followTarget(lights, rock.position);

  // ---- posizione della punta dello strumento ----
  const T = TOOLS[G.tool], playing = G.state === 'play' && !G.placing;
  let tipLocal = null, using = false;
  cursor.visible = false;
  toolRig.visible = inXR || false;
  if (inXR) {
    if (toolRig.parent !== scene && playing) {
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
      // su PC lo strumento arriva in diagonale dall'alto a destra, con la punta sul punto colpito
      tmpV2.copy(ray.ray.direction).multiplyScalar(0.15)
        .addScaledVector(UP.clone().applyQuaternion(camera.quaternion), -0.07)
        .addScaledVector(RIGHT.clone().applyQuaternion(camera.quaternion), -0.07).normalize();
      toolRig.position.copy(hits[0].point).addScaledVector(tmpV2, -TIP);
      toolRig.lookAt(tmpV.copy(toolRig.position).sub(tmpV2));
      toolRig.visible = ui.showTool;
    }
  }

  // ---- scavo ----
  let res = null, near = false;
  if (tipLocal) {
    const g = rock.localToGrid(tipLocal);
    const fd = rock.distAt(g.x, g.y, g.z);
    near = T.dmg > 0 && fd < T.r * GIOCO.sogliaAvviso;
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

  // ---- aspetto del reperto (danni) ----
  G.flash = Math.max(0, G.flash - dt);
  rock.setSpecimenDamage(G.integrity / 100, G.flash);

  // ---- scanner e trasparenza della roccia ----
  if (G.scanT > 0) G.scanT = Math.max(0, G.scanT - dt);
  if (G.scanCD > 0) G.scanCD = Math.max(0, G.scanCD - dt);
  let target = G.scanT > 0 ? 0.22 : G.placing ? 0.8 : 1;
  if (G.state === 'won') target = 0;
  const o = rock.opacity + (target - rock.opacity) * Math.min(1, dt * (G.state === 'won' ? 1.5 : 8));
  rock.setOpacity(Math.abs(o - target) < 0.005 ? target : o);

  // ---- fine partita ----
  if (G.state === 'play') {
    if (G.integrity <= 0) finish(false);
    else if (G.exposure >= G.winAt) finish(true);
  }
  if (G.state === 'won') rock.specPivot.rotation.y += dt * 0.6;

  debris.update(dt);

  // ---- interfaccia ----
  const secs = G.started ? ((G.state === 'play' ? now : G.tEnd) - G.t0) / 1000 : 0;
  ui.update(G, secs);
  if (inXR) xrHud.draw(G, now);

  if (!inXR) controls.update(dt);
  renderer.render(scene, camera);
});

// accesso per debug dalla console del browser
window.__scavo = { G, rock, startLevel, scene, debug, camera, controls, renderer };
