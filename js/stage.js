// Tamdotti – interactive 3D stage for the start page.
// Three small dioramas (Zimmer, Garten, Wiese) built from the app's own models.
// The camera is driven by scroll; Wuffel looks at the pointer and reacts to taps.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const ORIGIN = { room: V3(0, 0, 0), garden: V3(16, 0, 0), meadow: V3(32, 0, 0) };
const DOTTI_H = 0.95; // room scale; outdoors slightly smaller so the props read

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const glb = (name) => {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(`3d/${name}.glb`));
  return cache.get(name);
};

/* ------------------------------------------------------------------ */
/* small helpers                                                        */
/* ------------------------------------------------------------------ */
function radialTexture(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let _shadowTex;
function blobShadow(w, d, opacity = 0.42) {
  _shadowTex ||= radialTexture([[0, 'rgba(90,50,25,1)'], [0.45, 'rgba(90,50,25,.55)'], [1, 'rgba(90,50,25,0)']]);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: _shadowTex, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}
function heartTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 70);
  g.beginPath();
  g.moveTo(0, 30);
  g.bezierCurveTo(-46, 0, -38, -44, 0, -22);
  g.bezierCurveTo(38, -44, 46, 0, 0, 30);
  const gr = g.createLinearGradient(0, -40, 0, 30);
  gr.addColorStop(0, '#ff9b80');
  gr.addColorStop(1, '#f2603a');
  g.fillStyle = gr;
  g.fill();
  g.globalAlpha = 0.55;
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(-16, -18, 9, 6, -0.6, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function mat(color, rough = 0.6, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
}
/** Put an object on the ground at `pos`, scaled so its largest footprint/height matches. */
function place(obj, { pos, rotY = 0, scale = 1, height, y = 0 }) {
  obj.rotation.y = rotY;
  obj.scale.setScalar(1);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const s = height ? height / (box.max.y - box.min.y) : scale;
  obj.scale.setScalar(s);
  obj.updateMatrixWorld(true);
  box.setFromObject(obj);
  obj.position.set(pos.x, pos.y + y - box.min.y, pos.z);
  return obj;
}
function prop(gltf) {
  const o = gltf.scene.clone(true);
  o.traverse((m) => {
    if (m.isMesh) {
      m.material.envMapIntensity = 0.55;
    }
  });
  return o;
}

/** Grass tufts and little flowers, instanced; `avoid` = [[x, z, r], …] keeps props clear. */
function meadowDetails(radius, seed, avoid, garden = false) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts = [];
  for (let n = 0; pts.length < (garden ? 55 : 95) && n < 4000; n++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * radius;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (avoid.some(([ax, az, ar]) => (x - ax) ** 2 + (z - az) ** 2 < ar * ar)) continue;
    if (garden && z > 1.2 && x > -0.6) continue; // keep the river bank clean
    pts.push([x, z, rnd()]);
  }
  const group = new THREE.Group();
  const tuft = new THREE.ConeGeometry(0.035, 0.12, 4);
  tuft.translate(0, 0.06, 0);
  const tufts = new THREE.InstancedMesh(tuft, mat('#6fb04a', 0.95, { envMapIntensity: 0.3 }), pts.length);
  const bloom = new THREE.SphereGeometry(0.05, 10, 8);
  bloom.translate(0, 0.07, 0);
  const flowerPts = pts.filter((p) => p[2] > 0.62);
  const flowers = new THREE.InstancedMesh(bloom, mat('#ffffff', 0.45), flowerPts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const tint = new THREE.Color();
  pts.forEach(([x, z, k], i) => {
    q.setFromAxisAngle(_v1.set(Math.sin(k * 9), 0, Math.cos(k * 9)).normalize(), (k - 0.5) * 0.5);
    sc.setScalar(0.7 + k * 0.7);
    m.compose(pos.set(x, 0.01, z), q, sc);
    tufts.setMatrixAt(i, m);
    tufts.setColorAt(i, tint.set('#ffffff').offsetHSL(0, 0, -(k * 0.18)));
  });
  const palette = ['#fff6ea', '#ffc6d4', '#ffd977', '#ffc6d4', '#c9d8ff', '#ffd977'];
  flowerPts.forEach(([x, z, k], i) => {
    m.compose(pos.set(x + 0.04, 0.01, z), q.identity(), sc.setScalar(0.8 + k * 0.4));
    flowers.setMatrixAt(i, m);
    flowers.setColorAt(i, tint.set(palette[Math.floor(k * 97) % palette.length]));
  });
  group.add(tufts, flowers);
  return group;
}

/* ------------------------------------------------------------------ */
/* Dotti (skinned, animated)                                            */
/* ------------------------------------------------------------------ */
class Dotti {
  constructor(gltf, { height = DOTTI_H } = {}) {
    this.root = SkeletonUtils.clone(gltf.scene);
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        o.material.envMapIntensity = 0.7;
      }
      if (o.isBone && o.name === 'Head') this.head = o;
    });
    this.height = height;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
    this.current = null;
    this.busyUntil = 0;
    this.look = { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0, weight: 1 };
    this.mixer.addEventListener('finished', () => this.play('idle'));
  }
  setOn(pos, rotY) {
    const g = new THREE.Group();
    g.add(this.root);
    place(this.root, { pos: V3(0, 0, 0), height: this.height });
    g.position.copy(pos);
    g.rotation.y = rotY;
    this.group = g;
    this.shadow = blobShadow(this.height * 1.25, this.height * 1.05, 0.5);
    this.shadow.position.y = 0.012;
    g.add(this.shadow);
    return g;
  }
  play(name, { once = false, fade = 0.35, maxDur } = {}) {
    const clip = this.clips[name];
    if (!clip) return 0;
    const next = this.mixer.clipAction(clip);
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, false);
    next.play();
    this.current = next;
    clearTimeout(this._t);
    const dur = Math.min(clip.duration, maxDur ?? clip.duration);
    if (once && maxDur && maxDur < clip.duration) this._t = setTimeout(() => this.play('idle'), dur * 1000);
    return dur;
  }
  /** Hit sphere in world space. */
  hitSphere(target) {
    this.group.updateMatrixWorld();
    target.center.set(0, this.height * 0.5, 0).applyMatrix4(this.group.matrixWorld);
    target.radius = this.height * 0.55;
    return target;
  }
  headWorld(v) {
    return v.set(0, this.height * 0.95, 0).applyMatrix4(this.group.matrixWorld);
  }
  update(dt) {
    this.mixer.update(dt);
    if (!this.head) return;
    // critically-damped-ish spring towards the look target (decorative tracking)
    const L = this.look, k = 90, c = 2 * Math.sqrt(k) * 0.9;
    L.vy += (k * (L.ty - L.yaw) - c * L.vy) * dt;
    L.vp += (k * (L.tp - L.pitch) - c * L.vp) * dt;
    L.yaw += L.vy * dt;
    L.pitch += L.vp * dt;
    if (Math.abs(L.yaw) < 1e-4 && Math.abs(L.pitch) < 1e-4) return;
    // apply as an additive rotation in the Dotti's own frame (world-up yaw, local-right pitch)
    this.root.updateMatrixWorld(true);
    const parent = this.head.parent;
    const pq = parent.getWorldQuaternion(_q1);
    const gq = this.group.getWorldQuaternion(_q2);
    const yawAxis = _v1.set(0, 1, 0);
    const pitchAxis = _v2.set(1, 0, 0).applyQuaternion(gq);
    const qw = _q3.setFromAxisAngle(yawAxis, L.yaw * L.weight).multiply(_q4.setFromAxisAngle(pitchAxis, -L.pitch * L.weight));
    const local = _q4.copy(pq).invert().multiply(qw).multiply(pq);
    this.head.quaternion.premultiply(local);
  }
}
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();

/* ------------------------------------------------------------------ */
/* Stage                                                                */
/* ------------------------------------------------------------------ */
export async function createStage({ canvas, hint, reduceMotion = false, poster = null, onProgress = () => {} }) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    preserveDrawingBuffer: poster !== null,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  scene.add(new THREE.HemisphereLight(0xffe8c8, 0xb8d4ff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0e0, 1.35);
  sun.position.set(4, 7, 5);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);

  /* ---------- dioramas (geometry first, models stream in) ---------- */
  const dioramas = {};
  const actors = []; // { dotti, diorama }
  const spinners = []; // objects with per-frame motion
  let hero = null;

  // Zimmer: the app's room shell, cut open towards the camera
  async function buildRoom() {
    const g = new THREE.Group();
    g.position.copy(ORIGIN.room);
    scene.add(g);
    dioramas.room = g;
    const base = new THREE.Mesh(new RoundedBoxGeometry(6.35, 0.34, 4.85, 4, 0.12), mat('#e8c3a0', 0.75));
    base.position.set(0, -0.2, 0.25);
    g.add(base);
    const sh = blobShadow(9.5, 7.5, 0.28);
    sh.position.set(0.3, -0.37, 0.5);
    g.add(sh);

    const [room, w, bed, rug, lamp, monstera, win, pic, bowl, ball, bean] = await Promise.all(
      ['room', 'wuffel', 'bed', 'rug', 'lamp', 'monstera', 'window', 'picture', 'water_bowl', 'ball', 'beanbag'].map(glb),
    );
    const shell = prop(room);
    g.add(shell);
    const add = (gl, opts, shadow) => {
      const o = place(prop(gl), opts);
      g.add(o);
      if (shadow) {
        const s = blobShadow(shadow[0], shadow[1], shadow[2] ?? 0.32);
        s.position.set(opts.pos.x, 0.01, opts.pos.z);
        g.add(s);
      }
      return o;
    };
    add(bed, { pos: V3(-2.25, 0, -1.25), height: 1.0 }, [1.6, 1.9]);
    add(rug, { pos: V3(0.15, 0, 0.55), scale: 1.25 });
    add(lamp, { pos: V3(-0.95, 0, -1.6), height: 1.5 }, [0.9, 0.7]);
    add(monstera, { pos: V3(2.45, 0, -1.45), height: 1.35 }, [0.9, 0.9]);
    add(win, { pos: V3(0.75, 0, -1.92), height: 1.15, y: 0.95 });
    add(pic, { pos: V3(-2.93, 0, 0.6), height: 0.6, y: 1.35, rotY: Math.PI / 2 });
    add(bowl, { pos: V3(-1.35, 0, 1.55), height: 0.16 }, [0.55, 0.55, 0.25]);
    add(bean, { pos: V3(1.95, 0, 0.35), height: 0.5, rotY: -0.7 }, [1.1, 1.0]);
    add(ball, { pos: V3(0.95, 0, 1.35), height: 0.2 }, [0.32, 0.32, 0.3]);

    hero = new Dotti(w, { height: DOTTI_H });
    g.add(hero.setOn(V3(0.05, 0.035, 0.75), 0.32));
    actors.push({ dotti: hero, key: 'room' });
    hero.play('idle');
  }

  // Garten: a round patch of grass with two raised beds and a bit of river
  async function buildGarden() {
    const g = new THREE.Group();
    g.position.copy(ORIGIN.garden);
    scene.add(g);
    dioramas.garden = g;
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.75, 0.42, 64), mat('#c9946a', 0.85));
    soil.position.y = -0.23;
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(2.92, 2.92, 0.06, 64), mat('#8cc663', 0.85));
    grass.position.y = -0.02;
    const river = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.68, 64, 1, 1.42 * Math.PI, 0.62 * Math.PI),
      mat('#86cdee', 0.12, { envMapIntensity: 1.1 }),
    );
    river.rotation.x = -Math.PI / 2;
    river.position.y = 0.013;
    const sh = blobShadow(8.4, 8.4, 0.28);
    sh.position.y = -0.46;
    g.add(soil, grass, river, sh);
    g.add(meadowDetails(2.7, 3, [[-0.95, -0.55, 1.1], [1.0, -0.75, 1.0], [-1.75, -1.75, 0.8], [0.2, 0.6, 0.55]], true));
    const bedBox = (x, z, w, d) => {
      const b = new THREE.Mesh(new RoundedBoxGeometry(w, 0.3, d, 3, 0.06), mat('#c48656', 0.7));
      b.position.set(x, 0.15, z);
      const earth = new THREE.Mesh(new RoundedBoxGeometry(w - 0.14, 0.04, d - 0.14, 2, 0.02), mat('#7a5238', 0.95));
      earth.position.set(x, 0.3, z);
      const s = blobShadow(w + 0.6, d + 0.6, 0.3);
      s.position.set(x, 0.012, z);
      g.add(b, earth, s);
    };
    bedBox(-0.95, -0.55, 1.55, 0.95);
    bedBox(1.0, -0.75, 1.35, 0.95);

    const [w, straw, pump, lett, tree, fly] = await Promise.all(
      ['wuffel', 'strawberry_plant', 'pumpkin_plant', 'lettuce_tripo', 'apple_tree_tripo', 'butterfly'].map(glb),
    );
    const add = (gl, opts) => {
      const o = place(prop(gl), opts);
      g.add(o);
      return o;
    };
    add(straw, { pos: V3(-1.38, 0.31, -0.55), height: 0.55 });
    add(straw, { pos: V3(-0.55, 0.31, -0.5), height: 0.5, rotY: 1.4 });
    add(pump, { pos: V3(0.72, 0.31, -0.78), height: 0.5 });
    add(lett, { pos: V3(1.38, 0.31, -0.72), height: 0.42 });
    add(tree, { pos: V3(-1.75, 0, -1.75), height: 2.2 });
    const ts = blobShadow(1.8, 1.6, 0.3);
    ts.position.set(-1.75, 0.012, -1.7);
    g.add(ts);
    const d = new Dotti(w, { height: 0.92 });
    g.add(d.setOn(V3(0.2, 0, 0.6), -0.25));
    actors.push({ dotti: d, key: 'garden', routine: ['sniff', 'idle'] });
    d.play('sniff');
    addButterfly(g, fly, V3(0.4, 0.95, -0.2), 0);
  }

  // Wiese: carousel, bench, slide – and two friends
  async function buildMeadow() {
    const g = new THREE.Group();
    g.position.copy(ORIGIN.meadow);
    scene.add(g);
    dioramas.meadow = g;
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.45, 0.42, 72), mat('#c9946a', 0.85));
    soil.position.y = -0.23;
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(3.62, 3.62, 0.06, 72), mat('#90c866', 0.85));
    grass.position.y = -0.02;
    const sh = blobShadow(10, 10, 0.28);
    sh.position.y = -0.46;
    g.add(soil, grass, sh);
    g.add(meadowDetails(3.3, 7, [[-1.75, -1.25, 1.4], [1.85, -1.6, 1.3], [2.05, 0.75, 0.9], [-0.2, 0.95, 0.6], [-1.35, 1.2, 0.5], [0.95, 0.45, 0.5]]));
    const [w, fl, pg, carousel, bench, slide, fly] = await Promise.all(
      ['wuffel', 'flauschi', 'pinguno', 'merry_go_round', 'park_bench', 'slide', 'butterfly'].map(glb),
    );
    const add = (gl, opts, shadow) => {
      const o = place(prop(gl), opts);
      g.add(o);
      if (shadow) {
        const s = blobShadow(shadow[0], shadow[1], 0.3);
        s.position.set(opts.pos.x, 0.012, opts.pos.z);
        g.add(s);
      }
      return o;
    };
    const car = add(carousel, { pos: V3(-1.75, 0, -1.25), height: 1.05 }, [2.6, 2.6]);
    spinners.push({ key: 'meadow', tick: (dt) => (car.rotation.y += dt * 0.35) });
    add(slide, { pos: V3(1.85, 0, -1.6), height: 1.3, rotY: -0.5 }, [2.4, 1.8]);
    add(bench, { pos: V3(2.05, 0, 0.75), height: 0.62, rotY: -1.15 }, [1.2, 1.7]);

    const me = new Dotti(w, { height: 1.0 });
    g.add(me.setOn(V3(-0.2, 0, 0.95), 0.2));
    const a = new Dotti(fl, { height: 0.92 });
    g.add(a.setOn(V3(-1.35, 0, 1.2), 0.75));
    const b = new Dotti(pg, { height: 0.95 });
    g.add(b.setOn(V3(0.95, 0, 0.45), -0.7));
    me.play('idle');
    a.play('happy');
    b.play('idle');
    actors.push({ dotti: me, key: 'meadow', routine: ['wave', 'idle', 'idle'] });
    actors.push({ dotti: a, key: 'meadow' });
    actors.push({ dotti: b, key: 'meadow', routine: ['idle', 'wave', 'idle'], offset: 1.6 });
    addButterfly(g, fly, V3(0.5, 1.1, -0.4), 1.7);
    addButterfly(g, fly, V3(-0.6, 1.3, 0.2), 4.1);
  }

  function addButterfly(parent, gl, base, phase) {
    const o = place(prop(gl), { pos: V3(0, 0, 0), height: 0.05 });
    o.scale.multiplyScalar(1);
    const holder = new THREE.Group();
    holder.add(o);
    parent.add(holder);
    const prev = new THREE.Vector3();
    const key = parent === dioramas.garden ? 'garden' : 'meadow';
    spinners.push({
      key,
      tick: (dt, t) => {
        const u = t * 0.55 + phase;
        prev.copy(holder.position);
        holder.position.set(base.x + Math.sin(u) * 0.75, base.y + Math.sin(u * 2.3) * 0.12, base.z + Math.sin(u * 0.8 + 1) * 0.5);
        const dx = holder.position.x - prev.x, dz = holder.position.z - prev.z;
        if (dx * dx + dz * dz > 1e-8) holder.rotation.y = Math.atan2(dx, dz);
        o.scale.x = Math.abs(Math.sin(t * 13 + phase)) * 0.75 + 0.25;
      },
    });
  }

  /* ---------- camera stations ---------- */
  // dir: from target towards camera; r: radius that must stay in frame
  const stations = [
    { target: () => ORIGIN.room.clone().add(V3(0.05, 0.62, 0.6)), dir: V3(0.42, 0.3, 1), r: 1.25 },
    { target: () => ORIGIN.room.clone().add(V3(-0.1, 0.55, 0.25)), dir: V3(0.8, 1.15, 1), r: 3.5, rMobile: 3.85 },
    { target: () => ORIGIN.garden.clone().add(V3(0, 0.45, -0.1)), dir: V3(0.45, 0.7, 1), r: 2.85 },
    { target: () => ORIGIN.meadow.clone().add(V3(0, 0.55, 0.2)), dir: V3(0.5, 0.6, 1), r: 3.15 },
  ];
  stations.forEach((s) => s.dir.normalize());

  let W = 1, H = 1, mobile = false;
  const frame = { offX: 0, offY: 0, fitW: 1, fitH: 1 };
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    mobile = W / H < 0.9;
    renderer.setPixelRatio(poster !== null ? 2 : Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = mobile ? 40 : 30;
    // shift the projection so the subject sits beside (desktop) / above (mobile) the text
    if (mobile) { frame.offX = 0; frame.offY = H * 0.13; frame.fitW = 0.94; frame.fitH = 0.62; }
    else { frame.offX = -W * 0.2; frame.offY = H * 0.02; frame.fitW = 0.56; frame.fitH = 0.86; }
    camera.setViewOffset(W, H, frame.offX, frame.offY, W, H);
    camera.updateProjectionMatrix();
    dirty = true;
  }
  function stationPose(i, outPos, outTarget) {
    const s = stations[i];
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const halfV = Math.atan(Math.tan(vf / 2) * frame.fitH);
    const halfH = Math.atan(Math.tan(vf / 2) * camera.aspect * frame.fitW);
    const dist = (mobile && s.rMobile ? s.rMobile : s.r) / Math.sin(Math.min(halfV, halfH));
    outTarget.copy(s.target());
    outPos.copy(s.dir).multiplyScalar(dist).add(outTarget);
  }

  /* ---------- interaction ---------- */
  const pointer = { x: 0, y: 0, active: false, last: 0 };
  const ray = new THREE.Raycaster();
  const sphere = new THREE.Sphere();
  const tmp = new THREE.Vector3();
  const reactions = [['happy', 2.6], ['jump', 2.3], ['pet', 3.0]];
  let reactionIx = 0;
  const hearts = [];
  const heartMat = new THREE.SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false });
  function toNdc(e) {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  function overHero(ndc) {
    if (!hero?.group) return false;
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectsSphere(hero.hitSphere(sphere));
  }
  let downAt = null;
  canvas.addEventListener('pointermove', (e) => {
    const n = toNdc(e);
    pointer.x = n.x; pointer.y = n.y; pointer.active = true; pointer.last = performance.now();
    if (e.pointerType === 'mouse') canvas.style.cursor = overHero(n) ? 'pointer' : '';
    wake();
  });
  canvas.addEventListener('pointerleave', () => { pointer.active = false; canvas.style.cursor = ''; });
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: e.timeStamp }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const quick = e.timeStamp - downAt.t < 450; // event times, not handler times: robust when the main thread is busy
    downAt = null;
    if (moved > 10 || !quick) return;
    const n = toNdc(e);
    pointer.x = n.x; pointer.y = n.y; pointer.active = true; pointer.last = performance.now();
    if (overHero(n)) poke();
  });
  function poke() {
    if (!hero) return;
    const [name, max] = reactions[reactionIx++ % reactions.length];
    hero.play(name, { once: true, maxDur: max, fade: 0.2 });
    spawnHeart(name === 'pet' ? 2 : 1);
    hideHint(true);
    wake(max + 0.6);
  }
  function spawnHeart(n) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(heartMat.clone());
      hero.headWorld(s.position);
      s.position.x += (Math.random() - 0.5) * 0.18 + 0.12;
      s.position.y += 0.06;
      s.scale.setScalar(0.001);
      s.renderOrder = 5;
      scene.add(s);
      hearts.push({ s, t: -i * 0.18, x0: s.position.x, y0: s.position.y });
    }
  }

  /* ---------- hint label (DOM), anchored to Wuffel's head ---------- */
  let hintState = 'hidden';
  let hintDismissed = false;
  function showHint() {
    if (!hint || hintDismissed || poster !== null) return;
    hint.hidden = false;
    requestAnimationFrame(() => hint.classList.add('is-on'));
    hintState = 'on';
  }
  function hideHint(forever = false) {
    if (!hint) return;
    if (forever) hintDismissed = true;
    if (hintState === 'hidden') return;
    hint.classList.remove('is-on');
    hintState = 'hidden';
  }
  let hintX = -1, hintY = -1;
  function placeHint() {
    if (!hint || hintState !== 'on') return;
    hero.headWorld(tmp).project(camera);
    const x = Math.round((tmp.x * 0.5 + 0.5) * W), y = Math.round((-tmp.y * 0.5 + 0.5) * H);
    if (x !== hintX || y !== hintY) {
      hintX = x; hintY = y;
      hint.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }

  /* ---------- scroll → camera ---------- */
  let progress = 0; // 0..stations-1 (continuous, eased per segment)
  let anchors = [0, 1, 2, 3];
  function setAnchors(a) { anchors = a; }
  function readScroll() {
    const y = window.scrollY;
    let p = 0;
    for (let i = 0; i < anchors.length - 1; i++) {
      if (y >= anchors[i + 1]) { p = i + 1; continue; }
      if (y >= anchors[i]) {
        const u = (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]);
        p = i + easeInOut(clamp((u - 0.3) / 0.62, 0, 1));
      }
      break;
    }
    if (reduceMotion) p = Math.round(p);
    if (p !== progress) {
      const changedStation = Math.round(p) !== Math.round(progress);
      progress = p;
      if (reduceMotion && changedStation) {
        canvas.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.23,1,.32,1)' });
      }
      if (progress > 0.35) hideHint();
      else if (introDone && !hintDismissed && hintState === 'hidden') showHint();
      wake();
    }
  }

  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  const aPos = new THREE.Vector3(), aTgt = new THREE.Vector3(), bPos = new THREE.Vector3(), bTgt = new THREE.Vector3();
  const desiredPos = new THREE.Vector3(), desiredTgt = new THREE.Vector3();
  let camInit = false;
  function updateCamera(dt) {
    const i = Math.min(stations.length - 2, Math.floor(progress));
    const f = clamp(progress - i, 0, 1);
    stationPose(i, aPos, aTgt);
    stationPose(i + 1, bPos, bTgt);
    desiredPos.lerpVectors(aPos, bPos, f);
    desiredTgt.lerpVectors(aTgt, bTgt, f);
    // gentle crane arc between dioramas
    desiredPos.y += Math.sin(f * Math.PI) * (i === 0 ? 0.4 : 1.4);
    // decorative parallax for fine pointers only
    if (finePointer && !reduceMotion && pointer.active) {
      desiredPos.x += pointer.x * 0.12 * (1 + i * 0.6);
      desiredPos.y += pointer.y * 0.06 * (1 + i * 0.6);
    }
    if (!camInit || reduceMotion || poster !== null) {
      camPos.copy(desiredPos); camTgt.copy(desiredTgt); camInit = true;
    } else {
      const k = 1 - Math.exp(-dt * 7);
      camPos.lerp(desiredPos, k);
      camTgt.lerp(desiredTgt, k);
    }
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    return camPos.distanceToSquared(desiredPos) > 1e-6 || camTgt.distanceToSquared(desiredTgt) > 1e-6;
  }

  function updateLook() {
    if (!hero?.group) return;
    const L = hero.look;
    const idleFor = performance.now() - pointer.last;
    if (!pointer.active || idleFor > 2600 || progress > 0.6 || reduceMotion) { L.ty = 0; L.tp = 0; return; }
    // point on a plane through the head, facing the camera
    ray.setFromCamera(new THREE.Vector2(pointer.x, pointer.y), camera);
    const head = hero.headWorld(tmp);
    const n = camera.getWorldDirection(_v1).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, head.clone().addScaledVector(n, 0.5));
    const hit = ray.ray.intersectPlane(plane, _v2);
    if (!hit) return;
    const local = hero.group.worldToLocal(hit.clone()).sub(V3(0, hero.height * 0.95, 0));
    L.ty = clamp(Math.atan2(local.x, Math.max(0.05, local.z)), -0.65, 0.65);
    L.tp = clamp(Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.3, 0.35);
    L.weight = hero.current && hero.current.getClip().name !== 'idle' ? 0.35 : 1;
  }

  /* ---------- loop ---------- */
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let dprCap = poster !== null ? 2 : finePointer ? 1.5 : 1.75;
  let visible = true, running = false, dirty = true, wakeUntil = 0, last = 0, clockT = 0;
  let introDone = false;
  let manual = false; // QA: frames advanced explicitly (deterministic recordings)
  const perf = { n: 0, acc: 0 };
  function wake(seconds = 0.5) {
    if (manual) return;
    wakeUntil = Math.max(wakeUntil, performance.now() + seconds * 1000);
    if (!running && visible && !document.hidden) {
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
  }
  function activeKeys() { return keyFor(progress); }
  function keyFor(progress) {
    const k = Math.round(progress);
    return new Set([['room', 'room', 'garden', 'meadow'][k], ['room', 'room', 'garden', 'meadow'][Math.min(3, Math.ceil(progress))], ['room', 'room', 'garden', 'meadow'][Math.floor(progress)]]);
  }
  const routineState = new Map();
  function runRoutines(t) {
    for (const a of actors) {
      if (!a.routine) continue;
      let st = routineState.get(a);
      if (!st) { st = { i: 0, next: t + (a.offset ?? 0) + 2.5 }; routineState.set(a, st); }
      if (t < st.next) continue;
      const name = a.routine[st.i++ % a.routine.length];
      const d = a.dotti.play(name, { once: name !== 'idle', maxDur: name === 'wave' ? 3.2 : 4.5 });
      st.next = t + (name === 'idle' ? 3.5 : d + 0.6);
    }
  }
  function tick(now) {
    if (!visible || document.hidden) { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const keepGoing = advance(dt, now);
    if (keepGoing) requestAnimationFrame(tick);
    else running = false;
  }
  function advance(dt, now) {
    clockT += dt;
    const animate = !reduceMotion;
    const keys = activeKeys();
    // only draw the dioramas we're at or travelling between (fewer draw calls, no ghosting at the edges)
    for (const k in dioramas) dioramas[k].visible = keys.has(k);
    if (animate) runRoutines(clockT);
    for (const a of actors) {
      if (keys.has(a.key) && (animate || now < wakeUntil)) a.dotti.update(dt);
    }
    if (animate) for (const s of spinners) if (keys.has(s.key)) s.tick(dt, clockT);
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.t += dt;
      const u = clamp(h.t / 1.1, 0, 1);
      const e = 1 - Math.pow(1 - u, 3);
      h.s.position.y = h.y0 + e * (reduceMotion ? 0 : 0.32);
      h.s.position.x = h.x0 + Math.sin(u * 5) * (reduceMotion ? 0 : 0.03);
      h.s.scale.setScalar(h.t < 0 ? 0.001 : 0.1 + 0.05 * Math.min(1, u * 4));
      h.s.material.opacity = h.t < 0 ? 0 : u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45;
      if (u >= 1) { scene.remove(h.s); h.s.material.dispose(); hearts.splice(i, 1); }
    }
    updateLook();
    const moving = updateCamera(dt);
    renderer.render(scene, camera);
    placeHint();
    // adaptive resolution: if we're consistently slow, render fewer pixels
    perf.acc += dt; perf.n++;
    if (perf.n === 90 && !manual) {
      const avg = perf.acc / perf.n;
      if (avg > 0.024 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.25); resize(); }
      perf.n = 0; perf.acc = 0;
    }
    dirty = false;
    return animate || moving || now < wakeUntil || hearts.length > 0;
  }

  const io = new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible) wake();
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  new ResizeObserver(() => { resize(); wake(); }).observe(canvas);
  window.addEventListener('scroll', readScroll, { passive: true });

  /* ---------- boot ---------- */
  resize();
  await buildRoom();
  onProgress('room');
  if (poster !== null) {
    // still frames for the fallback posters
    progress = poster;
    const rest = buildGarden().then(buildMeadow);
    await rest;
    for (const a of actors) { a.dotti.play('idle', { fade: 0 }); a.dotti.mixer.setTime(1.4); }
    updateCamera(0);
    renderer.render(scene, camera);
    return { ready: true, render: () => renderer.render(scene, camera), setProgress: (p) => { progress = p; for (const k in dioramas) dioramas[k].visible = keyFor(p).has(k); updateCamera(0); renderer.render(scene, camera); } };
  }
  readScroll();
  updateCamera(0);
  renderer.compile(scene, camera);
  if (!reduceMotion) {
    const d = hero.play('wave', { once: true, maxDur: 3.2, fade: 0.25 });
    setTimeout(() => { introDone = true; if (progress < 0.35) showHint(); }, (d + 0.4) * 1000);
  } else {
    hero.mixer.setTime(1.4);
    introDone = true;
    if (progress < 0.35) showHint();
  }
  wake(1);

  // stream the other dioramas in the background
  const later = () => buildGarden().then(() => { onProgress('garden'); wake(); return buildMeadow(); }).then(() => { onProgress('meadow'); wake(); });
  if ('requestIdleCallback' in window) requestIdleCallback(later, { timeout: 1500 });
  else setTimeout(later, 600);

  return {
    setAnchors: (a) => { setAnchors(a); readScroll(); },
    poke,
    // QA hooks for deterministic captures
    manual: () => { manual = true; },
    step: (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) advance(dt, performance.now()); },
    loaded: () => Boolean(dioramas.meadow && actors.length >= 5),
  };
}
