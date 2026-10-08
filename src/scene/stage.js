// Escenario 3D: vista de taller (nave sobre la Tierra) y mapa orbital animado.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSpacecraft } from './spacecraft.js';
import { planetTexture } from './textures.js';
import { orbitPoint } from '../physics.js';

const AU = 10; // unidades de escena por UA en el mapa heliocéntrico
const MOON_DIST = 30; // distancia lunar comprimida (real ≈ 60 radios terrestres)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060b);
  // Entorno suave para que el MLI dorado y el metal tengan reflejos creíbles
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 4000);
  camera.position.set(4.5, 2.4, 6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.2;
  controls.maxDistance = 200;

  // Luz solar cálida + relleno frío muy tenue (luz reflejada por la Tierra)
  const sun = new THREE.DirectionalLight(0xfff1dd, 3.2);
  sun.position.set(8, 6, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x4a6aa8, 0x0a0806, 0.35));

  scene.add(starfield());

  // --- Vista taller ---
  const workshop = new THREE.Group();
  scene.add(workshop);
  const earthTex = planetTexture({ seed: 11, size: 1024 });
  const bigEarth = new THREE.Mesh(new THREE.SphereGeometry(60, 128, 96), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.9, metalness: 0, envMapIntensity: 0 }));
  bigEarth.position.set(-10, -72, -40);
  bigEarth.rotation.set(1.1, 0, 0.35); // ecuador hacia la cámara
  workshop.add(bigEarth, atmosphere(60, bigEarth.position));
  let craft = new THREE.Group();
  workshop.add(craft);

  // --- Mapa orbital ---
  const map = new THREE.Group();
  map.visible = false;
  scene.add(map);
  let mapAnim = null;

  let mode = 'workshop';
  const camTarget = { pos: camera.position.clone(), look: new THREE.Vector3() };
  let flying = 0;

  function setSpacecraft(ev) {
    workshop.remove(craft);
    disposeTree(craft);
    craft = buildSpacecraft(ev);
    workshop.add(craft);
    if (mode === 'workshop') frameWorkshop(ev.bus.size, false);
  }

  function frameWorkshop(size, animate = true) {
    const d = 3.2 + size * 3.4;
    goTo(new THREE.Vector3(d * 0.75, d * 0.38, d), new THREE.Vector3(0, 0, 0), animate);
  }

  function setMode(next, ev) {
    mode = next;
    workshop.visible = next === 'workshop';
    map.visible = next === 'map';
    sun.castShadow = next === 'workshop';
    if (next === 'workshop') frameWorkshop(ev.bus.size);
    else showMap(ev, false);
  }

  /** Construye el mapa del destino. Con `play` anima el vuelo de la nave. */
  function showMap(ev, play, onArrive) {
    disposeTree(map);
    map.clear();
    labelsClear();
    mapAnim = ev.dest.frame === 'sun' ? heliocentric(ev) : geocentric(ev);
    mapAnim.play = play;
    mapAnim.t = play ? 0 : 1;
    mapAnim.onArrive = onArrive;
    const r = mapAnim.extent;
    goTo(new THREE.Vector3(r * 0.35, r * 0.95, r * 1.25), new THREE.Vector3(0, 0, 0), true);
  }

  function heliocentric(ev) {
    const g = map;
    const sunCore = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    g.add(sunCore, glowSprite(0xffb36b, 5));
    g.add(new THREE.PointLight(0xfff0dd, 400, 0, 1.6));
    label(sunCore, 'Sol');

    const earthOrbit = { a: 1, e: 0.0167, i: 0, node: 0, peri: 102.9 };
    g.add(orbitLine(earthOrbit, 0x6f8fbf, 0.55));
    const target = ev.dest.orbit;
    g.add(orbitLine(target, 0xff7a3d, 0.9));

    // Punto de salida y llegada (Hohmann: 180° de diferencia)
    const theta0 = Math.PI * 0.15;
    const start = new THREE.Vector3(Math.cos(theta0) * AU, 0, -Math.sin(theta0) * AU);
    let best = null;
    for (let k = 0; k < 720; k++) {
      const nu = (k / 720) * Math.PI * 2;
      const p = toScene(orbitPoint(target, nu));
      const ang = Math.atan2(-p.z, p.x);
      const diff = Math.abs(wrap(ang - (theta0 + Math.PI)));
      if (!best || diff < best.diff) best = { diff, p, ang };
    }
    const r1 = AU, r2 = Math.hypot(best.p.x, best.p.z);
    let dAng = wrap(best.ang - theta0);
    if (dAng < 0) dAng += Math.PI * 2;
    const path = [];
    for (let k = 0; k <= 200; k++) {
      const t = k / 200;
      const ang = theta0 + dAng * t;
      const r = r1 + (r2 - r1) * (1 - Math.cos(Math.PI * t)) / 2;
      path.push(new THREE.Vector3(Math.cos(ang) * r, best.p.y * t * t, -Math.sin(ang) * r));
    }

    const earth = planet(0.32, planetTexture({ seed: 11, size: 256 }));
    earth.position.copy(start);
    g.add(earth);
    label(earth, 'Tierra');

    const isMars = ev.dest.id === 'mars';
    const body = isMars
      ? planet(0.26, planetTexture({ seed: 4, size: 256, ocean: [120, 60, 38], land: [[168, 92, 56], [200, 140, 96]], sea: -0.1, ice: true }))
      : asteroid(0.18);
    body.position.copy(best.p);
    g.add(body);
    label(body, ev.dest.name, true);

    return { ...flight(path, body, 0.6), extent: Math.max(r2, AU, ev.dest.orbit.a * (1 + ev.dest.orbit.e) * AU) * 1.35 + 4 };
  }

  function geocentric(ev) {
    const g = map;
    const earth = planet(1, planetTexture({ seed: 11 }));
    earth.add(atmosphere(1, new THREE.Vector3()));
    g.add(earth);
    label(earth, 'Tierra');
    const leo = 1.12;
    g.add(ring(leo, 0x6f8fbf, 0.5));
    let path = [], targetBody = earth, orbitR = leo, extent = 6;

    if (ev.dest.id === 'leo') {
      path = arc(leo, leo, 0, Math.PI * 0.5, 40);
    } else if (ev.dest.id === 'geo') {
      const geo = 6.6;
      g.add(ring(geo, 0xff7a3d, 0.9));
      path = arc(leo, geo, 0, Math.PI, 160);
      orbitR = geo;
      extent = 13;
    } else {
      g.add(ring(MOON_DIST, 0x6f8fbf, 0.35));
      const moon = planet(0.27 * 2, planetTexture({ seed: 21, size: 256, ocean: [96, 96, 100], land: [[150, 148, 144], [190, 188, 184]], sea: -0.05, ice: false }));
      const ang = Math.PI;
      moon.position.set(Math.cos(ang) * MOON_DIST, 0, -Math.sin(ang) * MOON_DIST);
      g.add(moon);
      label(moon, 'Luna', true);
      path = arc(leo, MOON_DIST - 0.9, 0, Math.PI, 220);
      targetBody = moon;
      orbitR = 0.9;
      extent = 36;
    }
    return { ...flight(path, targetBody, orbitR, ev.dest.id === 'geo' || ev.dest.id === 'leo'), extent };
  }

  /** Marca de la nave + estela que se dibuja con el progreso. */
  function flight(points, targetBody, orbitR, orbitCenter = false) {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd28a }));
    const ghost = new THREE.Line(geo.clone(), new THREE.LineDashedMaterial({ color: 0xffd28a, dashSize: 0.25, gapSize: 0.25, transparent: true, opacity: 0.35 }));
    ghost.computeLineDistances();
    map.add(ghost, trail);
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffe6b8 }));
    marker.add(glowSprite(0xffc078, 1.2));
    map.add(marker);
    return {
      update(dt, time) {
        if (this.play && this.t < 1) {
          this.t = Math.min(1, this.t + dt / 7);
          if (this.t === 1) this.onArrive?.();
        }
        const n = points.length - 1;
        const eased = 1 - (1 - this.t) ** 2;
        const idx = Math.floor(eased * n);
        trail.geometry.setDrawRange(0, idx + 1);
        if (this.t < 1) {
          marker.position.copy(points[idx]);
        } else {
          const c = orbitCenter ? new THREE.Vector3() : targetBody.position;
          const a = time * 0.9;
          marker.position.set(c.x + Math.cos(a) * orbitR, c.y + Math.sin(a * 0.5) * orbitR * 0.15, c.z - Math.sin(a) * orbitR);
        }
        marker.rotation.y += dt * 2;
      },
    };
  }

  function goTo(pos, look, animate) {
    camTarget.pos.copy(pos);
    camTarget.look.copy(look);
    controls.maxDistance = Math.max(200, pos.length() * 3);
    if (!animate || reduceMotion) {
      camera.position.copy(pos);
      controls.target.copy(look);
      flying = 0;
    } else flying = 1;
  }

  const labelNodes = [];
  function label(obj, text, accent = false) {
    const el = document.createElement('div');
    el.className = accent ? 'scene-label is-target' : 'scene-label';
    el.textContent = text;
    const l = new CSS2DObject(el);
    const r = obj.geometry?.boundingSphere?.radius ?? 0.3;
    l.position.set(0, (obj.geometry?.parameters?.radius ?? r) + 0.35, 0);
    obj.add(l);
    labelNodes.push(l);
  }
  function labelsClear() {
    for (const l of labelNodes) { l.element.remove(); l.parent?.remove(l); }
    labelNodes.length = 0;
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    // En escritorio la hoja de papel tapa la derecha: desplazamos el centro óptico
    const sheet = document.getElementById('sheet');
    const covered = w > 820 && sheet ? sheet.offsetWidth + 16 : 0;
    if (covered) camera.setViewOffset(w + covered, h, covered, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const timer = new THREE.Timer();
  renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();
    if (flying) {
      const k = 1 - Math.pow(0.0015, dt);
      camera.position.lerp(camTarget.pos, k);
      controls.target.lerp(camTarget.look, k);
      if (camera.position.distanceTo(camTarget.pos) < 0.05) flying = 0;
    }
    if (!reduceMotion) {
      bigEarth.rotation.y += dt * 0.01;
      craft.rotation.y += dt * 0.12;
      const plume = craft.getObjectByName('plume');
      if (plume) plume.material.opacity = 0.28 + Math.sin(t * 9) * 0.06;
    }
    if (map.visible && mapAnim) mapAnim.update(dt, t);
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });

  return { setSpacecraft, setMode, showMap, get mode() { return mode; } };
}

// ---------- utilidades de escena ----------

function toScene({ x, y, z }) {
  // eclíptica (x, y, z) → escena (x, z hacia arriba, -y)
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
  for (let k = 0; k <= 128; k++) {
    const a = (k / 128) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

/** Semielipse de transferencia entre radios r1 y r2. */
function arc(r1, r2, a0, sweep, n) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = a0 + sweep * t;
    const r = r1 + (r2 - r1) * (1 - Math.cos(Math.PI * t)) / 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, -Math.sin(a) * r));
  }
  return pts;
}

function planet(radius, map) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), new THREE.MeshStandardMaterial({ map, roughness: 0.95 }));
}

function asteroid(radius) {
  const geo = new THREE.IcosahedronGeometry(radius, 3);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const k = 1 + 0.18 * Math.sin(v.x * 23) * Math.cos(v.y * 19) + 0.1 * Math.sin(v.z * 31);
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y * 0.85, v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a8178, roughness: 1, flatShading: true }));
}

function atmosphere(radius, position) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.025, 64, 32),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(0x5c8de0) } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 color; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(color, f * 0.9); }`,
    }),
  );
  m.position.copy(position);
  return m;
}

let glowTex;
function glowSprite(color, size) {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

function starfield() {
  const n = 4000;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(900 + Math.random() * 600);
    pos.set([v.x, v.y, v.z], i * 3);
    const warm = Math.random();
    const b = 0.55 + Math.random() * 0.45;
    col.set([b, b * (0.92 + warm * 0.06), b * (0.85 + (1 - warm) * 0.15)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true }));
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !Array.isArray(o.material) && o.material.map && o.material.map.isCanvasTexture && o.material.userData.owned) o.material.map.dispose();
  });
}
