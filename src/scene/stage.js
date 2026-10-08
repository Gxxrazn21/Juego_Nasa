// Escenario 3D. Modos:
//  hangar → nave en órbita baja sobre la Tierra real, cámara que enfoca cada pieza
//  crew   → creación de personaje con trajes reales de la NASA
//  map    → mapa orbital (Tierra–Luna o heliocéntrico) con la ruta y las estaciones
//  dock   → acoplamiento en una estación y transferencia de provisiones
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildShip } from './ship.js';
import { createEarth, createMoon, createMars, glowSprite, starfield } from './bodies.js';
import { loadNormalized, loadStation, tintSuit, preload } from './models.js';
import { orbitPoint } from '../physics.js';

const AU = 10;
const MOON_DIST = 30;
const EARTH_R = 3000; // Tierra del telón de fondo (escala de escena, no real)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SUN_DIR = new THREE.Vector3(0.8, 0.45, 0.5).normalize();

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020308);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 20000);
  camera.position.set(18, 6, 24);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;

  const sun = new THREE.DirectionalLight(0xfff3e2, 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -40; sc.right = sc.top = 40; sc.near = 1; sc.far = 600;
  scene.add(sun, sun.target);
  const fill = new THREE.HemisphereLight(0x6d8fcf, 0x0c0a08, 0.4); // luz azulada reflejada por la Tierra
  scene.add(fill);

  const stars = starfield();
  scene.add(stars);

  // ---------- Telón: la Tierra real bajo la órbita ----------
  const backdrop = new THREE.Group();
  const earthPivot = new THREE.Group();
  earthPivot.position.set(0, -EARTH_R - 420, -600);
  earthPivot.rotation.set(Math.PI / 2 - 0.45, 0, 0.25);
  const bigEarth = createEarth(EARTH_R, 160);
  bigEarth.rotation.y = 1.9; // empieza sobre América
  bigEarth.userData.setSun(SUN_DIR);
  earthPivot.add(bigEarth);
  backdrop.add(earthPivot);
  scene.add(backdrop);

  // ---------- Grupos por modo ----------
  const hangar = new THREE.Group();
  const crew = new THREE.Group();
  const map = new THREE.Group();
  const dock = new THREE.Group();
  scene.add(hangar, crew, map, dock);
  let ship = null;
  let shipInfo = null;
  let mapAnim = null;
  let dockAnim = null;
  let crewModels = [];
  let crewToken = 0;
  let mode = 'hangar';

  preload(['emu', 'iss-lite', 'gateway']);

  // ---------- Hangar ----------
  function setShip(ev, look) {
    if (ship) { hangar.remove(ship); dispose(ship); }
    shipInfo = buildShip(ev, look);
    ship = shipInfo.group;
    hangar.add(ship);
  }

  function focusSlot(slot, animate = true) {
    if (!shipInfo) return;
    const f = shipInfo.focus[slot] ?? shipInfo.focus.all;
    const dir = new THREE.Vector3(0.75, 0.32, 1).normalize();
    goTo(new THREE.Vector3(0, f.y, 0).addScaledVector(dir, f.r * 1.9), new THREE.Vector3(0, f.y, 0), animate);
  }

  // ---------- Tripulación ----------
  async function setCrew(state, suit, colors) {
    const token = ++crewToken;
    const members = state.crew.slice(0, 4);
    const models = await Promise.all(members.map(() => loadNormalized(suit.model, suit.height)));
    if (token !== crewToken) return;
    clearGroup(crew);
    crewModels = models;
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.4, 0.25, 64),
      new THREE.MeshStandardMaterial({ color: 0x1c1f27, roughness: 0.6, metalness: 0.5 }),
    );
    platform.position.y = -0.125;
    platform.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.04, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.accent) }));
    ring.rotation.x = Math.PI / 2;
    crew.add(platform, ring);
    const slots = [[0, 0, 0.6], [-1.6, 0, -0.9], [1.6, 0, -0.9], [0, 0, -2.2]];
    models.forEach((m, i) => {
      tintSuit(m, colors.suit, colors.stripes[i]);
      const [x, , z] = slots[i];
      m.position.set(x, 0, z);
      m.rotation.y = i === 0 ? 0 : x < 0 ? 0.35 : -0.35;
      if (i > 0) m.scale.multiplyScalar(0.96);
      crew.add(m);
      const el = document.createElement('div');
      el.className = i === 0 ? 'scene-label is-target' : 'scene-label';
      el.textContent = members[i].name;
      const l = new CSS2DObject(el);
      l.position.set(0, suit.height + 0.35, 0);
      m.add(l);
    });
    if (mode === 'crew') frameCrew();
  }

  function frameCrew() {
    goTo(new THREE.Vector3(3.2, 2.2, 6.4), new THREE.Vector3(0, 1.05, -0.3), true);
  }

  // ---------- Mapa ----------
  function showMap(ev, opts = {}) {
    clearGroup(map);
    mapAnim = ev.dest.frame === 'sun' ? heliocentric(ev) : geocentric(ev);
    mapAnim.t = opts.progress ?? 1;
    mapAnim.target = mapAnim.t;
    const r = mapAnim.extent;
    const c = mapAnim.center ?? new THREE.Vector3();
    goTo(new THREE.Vector3(r * 0.25, r * 0.8, r * 1.0).add(c), c, true);
  }

  function setProgress(t) {
    if (mapAnim) mapAnim.target = Math.min(1, Math.max(0, t));
  }

  function geocentric(ev) {
    const earth = createEarth(1, 96);
    earth.userData.setSun(SUN_DIR);
    earth.rotation.x = 0.41;
    map.add(earth);
    label(earth, 'Tierra', 1.25);
    map.userData.spin = earth;
    const leo = 1.12;
    map.add(ring(leo, 0x6f8fbf, 0.5));
    const stops = new Set(ev.state.stops);
    if (stops.has('iss') || ev.dest.id === 'iss') stationDot(new THREE.Vector3(leo, 0, 0).applyAxisAngle(Y, 0.9), 'ISS');
    if (stops.has('depot')) stationDot(new THREE.Vector3(leo * 1.03, 0, 0).applyAxisAngle(Y, 2.2), 'Depósito');

    const path = [];
    let extent = 5;
    if (ev.dest.id === 'iss') {
      for (let k = 0; k <= 200; k++) {
        const a = (k / 200) * Math.PI * 3.8;
        const r = leo * (1 - 0.03 * (1 - k / 200));
        path.push(new THREE.Vector3(Math.cos(a) * r, 0, -Math.sin(a) * r));
      }
    } else {
      const moon = createMoon(0.5);
      const ma = Math.PI;
      moon.position.set(Math.cos(ma) * MOON_DIST, 0, -Math.sin(ma) * MOON_DIST);
      map.add(moon);
      label(moon, 'Luna', 0.8, true);
      map.add(ring(MOON_DIST, 0x6f8fbf, 0.25));
      const nrho = stops.has('gateway');
      // salida: media vuelta en LEO + arco hacia la Luna
      for (let k = 0; k <= 30; k++) {
        const a = (k / 30) * Math.PI;
        path.push(new THREE.Vector3(Math.cos(a) * leo, 0, -Math.sin(a) * leo).applyAxisAngle(Y, Math.PI));
      }
      path.push(...arcPts(leo, MOON_DIST - 1.4, 0, Math.PI, 160, 0.6));
      // órbita en la Luna
      const loop = [];
      for (let k = 0; k <= 80; k++) {
        const a = (k / 80) * Math.PI * 2;
        const p = nrho
          ? new THREE.Vector3(Math.cos(a) * 1.0 + 0.4, Math.sin(a) * 3.2 + 1.6, 0)
          : new THREE.Vector3(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85);
        loop.push(p.add(moon.position));
      }
      if (nrho) {
        const halo = new THREE.Line(new THREE.BufferGeometry().setFromPoints(loop), new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.8 }));
        map.add(halo);
        stationDot(loop[20].clone(), 'Gateway');
      }
      path.push(...loop);
      // regreso: arco por debajo hacia la Tierra
      path.push(...arcPts(MOON_DIST - 1.4, 1.02, Math.PI, Math.PI, 160, -0.6));
      extent = 46;
      mapCenter.set(-MOON_DIST / 2, 0, 0);
    }
    if (ev.dest.id === 'iss') mapCenter.set(0, 0, 0);
    return { ...flight(path), extent, center: mapCenter.clone() };
  }

  const mapCenter = new THREE.Vector3();

  function heliocentric(ev) {
    const sunCore = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
    map.add(sunCore, glowSprite(0xffb36b, 7));
    label(sunCore, 'Sol', 0.9);
    const earthOrbit = { a: 1, e: 0.0167, i: 0, node: 0, peri: 102.9 };
    map.add(orbitLine(earthOrbit, 0x6f8fbf, 0.5));
    const target = ev.dest.orbit;
    map.add(orbitLine(target, 0xff7a3d, 0.85));

    const theta0 = Math.PI * 0.15;
    const start = new THREE.Vector3(Math.cos(theta0) * AU, 0, -Math.sin(theta0) * AU);
    let best = null;
    for (let k = 0; k < 720; k++) {
      const p = toScene(orbitPoint(target, (k / 720) * Math.PI * 2));
      const diff = Math.abs(wrap(Math.atan2(-p.z, p.x) - (theta0 + Math.PI)));
      if (!best || diff < best.diff) best = { diff, p };
    }
    const end = best.p;
    const out = transferArc(start, end, 140);
    const back = transferArc(end, new THREE.Vector3(Math.cos(theta0 + Math.PI * 1.9) * AU, 0, -Math.sin(theta0 + Math.PI * 1.9) * AU), 140);
    const sunLight = new THREE.PointLight(0xfff0dd, 600, 0, 1.4);
    map.add(sunLight);

    const earth = createEarth(0.35, 64);
    earth.position.copy(start);
    earth.userData.setSun(start.clone().negate());
    map.add(earth);
    label(earth, 'Tierra', 0.6);
    const body = ev.dest.id === 'mars' ? createMars(0.3) : asteroid(0.2);
    body.position.copy(end);
    map.add(body);
    label(body, ev.dest.name, 0.55, true);
    const ext = Math.max(end.length(), AU, (target.a ?? 1) * (1 + (target.e ?? 0)) * AU);
    return { ...flight([...out, ...back]), extent: ext * 1.3 + 4, center: new THREE.Vector3() };
  }

  function flight(points) {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const ghost = new THREE.Line(geo.clone(), new THREE.LineDashedMaterial({ color: 0xffd28a, dashSize: 0.3, gapSize: 0.3, transparent: true, opacity: 0.35 }));
    ghost.computeLineDistances();
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd28a }));
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0xffe6b8 }));
    marker.add(glowSprite(0xffc078, 1.4));
    map.add(ghost, trail, marker);
    return {
      update(dt) {
        this.t += (this.target - this.t) * Math.min(1, dt * 1.6);
        const n = points.length - 1;
        const f = this.t * n;
        const i = Math.min(n - 1, Math.floor(f));
        trail.geometry.setDrawRange(0, i + 2);
        marker.position.copy(points[i]).lerp(points[i + 1], f - i);
        marker.rotation.y += dt * 2;
      },
    };
  }

  function stationDot(pos, text) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.copy(pos);
    dot.add(glowSprite(0xffffff, 0.5));
    map.add(dot);
    label(dot, text, 0.25);
  }

  // ---------- Acoplamiento ----------
  async function showDock(stationId, ev, look) {
    clearGroup(dock);
    const token = Symbol('dock');
    dockAnim = { token, t: 0 };
    goTo(new THREE.Vector3(40, -10, 60), new THREE.Vector3(0, -12, 0), false);
    const [station, astro] = await Promise.all([loadStation(stationId), loadNormalized(look.suit.model, look.suit.height)]);
    if (dockAnim?.token !== token) return;
    tintSuit(astro, look.colors.suit, look.colors.stripes[0]);
    dock.add(station);
    const s = buildShip(ev, look);
    const craft = s.group;
    const portY = centralBottom(station) - 0.3;
    const dockedY = portY - s.height;
    craft.position.set(0, dockedY - 40, 0);
    dock.add(craft);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.7 }));
    astro.add(crate);
    crate.position.set(0.35, 1.1, 0.35);
    astro.visible = false;
    dock.add(astro);
    const from = new THREE.Vector3(2.4, portY - 2.5, 1.8);
    const to = new THREE.Vector3(5.5, portY + 3, 3.5);
    Object.assign(dockAnim, { craft, dockedY, astro, from, to, start: performance.now() });
    const look2 = new THREE.Vector3(2, portY - s.height * 0.35, 0);
    goTo(look2.clone().add(new THREE.Vector3(26, 7, 38)), look2, true);
  }

  function updateDock() {
    const d = dockAnim;
    if (!d?.craft) return;
    d.t = (performance.now() - d.start) / 1000; // en tiempo real, independiente de los FPS
    const approach = Math.min(1, d.t / 2.4);
    d.craft.position.y = d.dockedY - 40 * (1 - easeOut(approach));
    if (approach >= 1) {
      d.astro.visible = true;
      const k = ((d.t - 2.4) / 3) % 2;
      const u = k < 1 ? easeInOut(k) : easeInOut(2 - k);
      d.astro.position.lerpVectors(d.from, d.to, u);
      d.astro.position.y += Math.sin(d.t * 2) * 0.15;
      d.astro.rotation.set(0.25, d.t * 0.4, 0.15);
    }
  }

  // ---------- Modos ----------
  function setMode(next) {
    mode = next;
    hangar.visible = next === 'hangar';
    crew.visible = next === 'crew';
    map.visible = next === 'map';
    dock.visible = next === 'dock';
    backdrop.visible = next !== 'map';
    sun.castShadow = next === 'hangar' || next === 'crew' || next === 'dock';
    camera.near = next === 'map' ? 0.01 : 0.3;
    camera.far = next === 'map' ? 4000 : 20000;
    camera.updateProjectionMatrix();
    controls.minDistance = next === 'map' ? 1 : next === 'crew' ? 2.5 : 3;
    controls.maxDistance = next === 'map' ? 300 : 700;
    if (next !== 'dock') dockAnim = null;
    if (next === 'crew') frameCrew();
    if (next === 'hangar') focusSlot('all');
    // Etiquetas: solo las del modo activo
    for (const [g, m] of [[crew, 'crew'], [map, 'map'], [dock, 'dock']]) {
      g.traverse((o) => { if (o.isCSS2DObject) o.element.style.display = m === next ? '' : 'none'; });
    }
  }

  // ---------- Cámara ----------
  const camTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let flying = false;
  function goTo(pos, look, animate) {
    camTarget.pos.copy(pos);
    camTarget.look.copy(look);
    if (!animate || reduceMotion) {
      camera.position.copy(pos);
      controls.target.copy(look);
      flying = false;
    } else flying = true;
  }

  function label(obj, text, offset = 0.4, accent = false) {
    const el = document.createElement('div');
    el.className = accent ? 'scene-label is-target' : 'scene-label';
    el.textContent = text;
    const l = new CSS2DObject(el);
    l.position.set(0, offset, 0);
    obj.add(l);
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    const sheet = document.getElementById('sheet');
    const covered = w > 820 && sheet ? sheet.offsetWidth + 16 : 0;
    if (covered) camera.setViewOffset(w + covered, h, covered, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const timer = new THREE.Timer();
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(Math.max(timer.getDelta(), 0), 0.05);
    if (flying) {
      const k = 1 - Math.pow(0.002, dt);
      camera.position.lerp(camTarget.pos, k);
      controls.target.lerp(camTarget.look, k);
      if (camera.position.distanceTo(camTarget.pos) < 0.02 * camTarget.pos.length() + 0.01) flying = false;
    }
    if (!reduceMotion) {
      bigEarth.rotation.y += dt * 0.012;
      if (ship && mode === 'hangar') ship.rotation.y += dt * 0.05;
      if (mode === 'crew') crewModels.forEach((m, i) => { if (i === 0) m.rotation.y += dt * 0.35; });
      if (map.visible && map.userData.spin) map.userData.spin.rotation.y += dt * 0.05;
    }
    if (map.visible && mapAnim) mapAnim.update(dt);
    if (dock.visible) updateDock();
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });

  return { setShip, focusSlot, setCrew, setMode, showMap, setProgress, showDock, scene, camera, get mode() { return mode; } };
}

// ---------- utilidades ----------
const Y = new THREE.Vector3(0, 1, 0);
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function toScene({ x, y, z }) {
  return new THREE.Vector3(x * AU, z * AU, -y * AU);
}
function wrap(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
function orbitLine(orbit, color, opacity) {
  const pts = [];
  for (let k = 0; k <= 256; k++) pts.push(toScene(orbitPoint(orbit, (k / 256) * Math.PI * 2)));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
function ring(r, color, opacity) {
  const pts = [];
  for (let k = 0; k <= 160; k++) {
    const a = (k / 160) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
/** Semielipse entre radios r1 y r2 con una ligera elevación para leerse en 3D. */
function arcPts(r1, r2, a0, sweep, n, lift = 0) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = a0 + sweep * t;
    const r = r1 + (r2 - r1) * (1 - Math.cos(Math.PI * t)) / 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(Math.PI * t) * lift * 3, -Math.sin(a) * r));
  }
  return pts;
}
function transferArc(a, b, n) {
  const r1 = Math.hypot(a.x, a.z), r2 = Math.hypot(b.x, b.z);
  const a0 = Math.atan2(-a.z, a.x);
  let d = wrap(Math.atan2(-b.z, b.x) - a0);
  if (d < 0) d += Math.PI * 2;
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const ang = a0 + d * t;
    const r = r1 + (r2 - r1) * (1 - Math.cos(Math.PI * t)) / 2;
    pts.push(new THREE.Vector3(Math.cos(ang) * r, a.y + (b.y - a.y) * t, -Math.sin(ang) * r));
  }
  return pts;
}
function asteroid(radius) {
  const geo = new THREE.IcosahedronGeometry(radius, 3);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + 0.18 * Math.sin(v.x * 23) * Math.cos(v.y * 19) + 0.1 * Math.sin(v.z * 31));
    p.setXYZ(i, v.x, v.y * 0.85, v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a8178, roughness: 1, flatShading: true }));
}
/** Parte inferior de los módulos centrales de una estación (ignora paneles y armazones lejanos). */
function centralBottom(station) {
  station.updateMatrixWorld(true);
  const b = new THREE.Box3();
  const c = new THREE.Vector3();
  let min = Infinity;
  station.traverse((o) => {
    if (!o.isMesh) return;
    b.setFromObject(o);
    b.getCenter(c);
    if (Math.abs(c.x) < 6 && Math.abs(c.z) < 6) min = Math.min(min, b.min.y);
  });
  return Number.isFinite(min) ? min : new THREE.Box3().setFromObject(station).min.y;
}

function clearGroup(g) {
  g.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); });
  dispose(g);
  g.clear();
  g.userData = {};
}
function dispose(obj) {
  obj.traverse((o) => {
    if (o.isCSS2DObject) o.element.remove();
    if (o.geometry && !o.userData.shared) o.geometry.dispose();
  });
}
