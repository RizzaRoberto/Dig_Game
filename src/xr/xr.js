// Sessione AR, controller, hit-test (superfici reali), ancore e vibrazione
import * as THREE from 'three';

export class XRInput {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.hands = { left: null, right: null };   // controller three.js per mano
    this.sources = { left: null, right: null }; // XRInputSource
    this.hitSources = { left: null, right: null };
    this.hits = { left: null, right: null };    // ultima posa colpita (Matrix4)
    this.prevButtons = { left: [], right: [] };
    this.on = {};                               // callback: trigger, squeeze, button
    this.anchor = null; this._anchorReq = null; this._anchorMatrix = new THREE.Matrix4();
    this.features = new Set();

    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i); scene.add(c);
      c.addEventListener('connected', e => {
        const h = e.data.handedness; if (h !== 'left' && h !== 'right') return;
        c.userData.hand = h; this.hands[h] = c; this.sources[h] = e.data;
        this._requestHitSource(h, e.data);
        this.on.connected && this.on.connected(h, c);
      });
      c.addEventListener('disconnected', () => {
        const h = c.userData.hand; if (!h) return;
        this.on.disconnected && this.on.disconnected(h, c);
        this.hitSources[h]?.cancel?.(); this.hitSources[h] = null;
        this.hands[h] = null; this.sources[h] = null; c.userData.hand = null;
      });
      c.addEventListener('selectstart', () => c.userData.hand && this.on.trigger?.(c.userData.hand, true));
      c.addEventListener('selectend', () => c.userData.hand && this.on.trigger?.(c.userData.hand, false));
      c.addEventListener('squeezestart', () => c.userData.hand && this.on.squeeze?.(c.userData.hand, true));
      c.addEventListener('squeezeend', () => c.userData.hand && this.on.squeeze?.(c.userData.hand, false));
    }
    renderer.xr.addEventListener('sessionend', () => { this.anchor = null; this.hitSources = { left: null, right: null }; });
  }

  static async supported() {
    try { return !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) { return false; }
  }

  async enter() {
    const session = await navigator.xr.requestSession('immersive-ar', {
      optionalFeatures: ['local-floor', 'hit-test', 'anchors', 'hand-tracking'],
    });
    this.renderer.xr.setReferenceSpaceType(session.enabledFeatures?.includes?.('local-floor') === false ? 'local' : 'local-floor');
    await this.renderer.xr.setSession(session);
    this.features = new Set(session.enabledFeatures || []);
    // hit-test per i controller già collegati
    for (const src of session.inputSources) if (src.handedness === 'left' || src.handedness === 'right') this._requestHitSource(src.handedness, src);
    return session;
  }

  _requestHitSource(hand, src) {
    const s = this.renderer.xr.getSession();
    if (!s || !s.requestHitTestSource || this.hitSources[hand]) return;
    s.requestHitTestSource({ space: src.targetRaySpace }).then(h => { this.hitSources[hand] = h; }).catch(() => {});
  }

  // Da chiamare ogni frame con l'XRFrame
  update(frame) {
    if (!frame) return;
    const ref = this.renderer.xr.getReferenceSpace();
    for (const h of ['left', 'right']) {
      this.hits[h] = null;
      const hs = this.hitSources[h];
      if (hs) {
        const res = frame.getHitTestResults(hs);
        if (res.length) { const p = res[0].getPose(ref); if (p) this.hits[h] = new THREE.Matrix4().fromArray(p.transform.matrix); }
      }
      // pulsanti A/B/X/Y (mappatura xr-standard: 4 e 5)
      const gp = this.sources[h]?.gamepad;
      if (gp) {
        const prev = this.prevButtons[h];
        gp.buttons.forEach((b, i) => { if (b.pressed && !prev[i]) this.on.button?.(h, i); prev[i] = b.pressed; });
      }
    }
    // ancora: creazione richiesta e lettura della posa
    if (this._anchorReq && frame.createAnchor) {
      const m = this._anchorReq; this._anchorReq = null;
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s);
      frame.createAnchor(new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, { x: q.x, y: q.y, z: q.z, w: q.w }), ref)
        .then(a => { this.anchor?.delete?.(); this.anchor = a; }).catch(() => {});
    }
    this.anchorPose = null;
    if (this.anchor && frame.trackedAnchors?.has(this.anchor)) {
      const pose = frame.getPose(this.anchor.anchorSpace, ref);
      if (pose) this.anchorPose = this._anchorMatrix.fromArray(pose.transform.matrix);
    }
  }

  setAnchor(matrix) { if (this.features.has('anchors')) this._anchorReq = matrix.clone(); }
  clearAnchor() { this.anchor?.delete?.(); this.anchor = null; this._anchorReq = null; }

  pulse(hand, intensity, ms) {
    const ha = this.sources[hand]?.gamepad?.hapticActuators?.[0];
    if (ha) { try { ha.pulse(intensity, ms); } catch (e) { /* ignorato */ } }
  }
}
