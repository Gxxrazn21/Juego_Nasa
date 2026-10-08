// Construye el modelo 3D de la nave a partir del diseño evaluado.
// Cada decisión del jugador se ve: tamaño de paneles, antena, RTG, instrumentos, motor.
import * as THREE from 'three';
import { solarCellTexture, mliBumpTexture } from './textures.js';

const cellTex = solarCellTexture();
const mliTex = mliBumpTexture();

const mat = {
  mli: new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.85, roughness: 0.32, bumpMap: mliTex, bumpScale: 0.6 }),
  silver: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 0.9, roughness: 0.25 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe9e6df, metalness: 0.1, roughness: 0.55, side: THREE.DoubleSide }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a2c33, metalness: 0.6, roughness: 0.5 }),
  cell: new THREE.MeshStandardMaterial({ map: cellTex, color: 0xffffff, metalness: 0.55, roughness: 0.3, emissive: 0x0a1230 }),
  lens: new THREE.MeshStandardMaterial({ color: 0x0b0f1a, metalness: 1, roughness: 0.05 }),
  ion: new THREE.MeshBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: 0.85 }),
  hot: new THREE.MeshBasicMaterial({ color: 0xff6a2b }),
};

export function buildSpacecraft(ev) {
  const g = new THREE.Group();
  const s = ev.bus.size;

  // Bus con MLI dorado
  const bus = new THREE.Mesh(new THREE.BoxGeometry(s, s * 1.15, s), mat.mli);
  bus.castShadow = bus.receiveShadow = true;
  g.add(bus);
  // marco del bus
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(bus.geometry), new THREE.LineBasicMaterial({ color: 0x5a4320 }));
  g.add(edges);

  // Paneles solares: dos alas, área total = solarArea (escala visual comprimida)
  const area = ev.parts['Paneles solares'] > 0 ? ev.parts['Paneles solares'] / 3.5 : 0;
  if (area > 0) {
    const visual = Math.sqrt(area) * 0.55 * Math.max(0.6, s);
    const wingW = visual * 1.6, wingH = Math.min(visual * 0.6, s * 1.1);
    const tex = cellTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(wingW / 0.4)), Math.max(1, Math.round(wingH / 0.4)));
    const wingMat = mat.cell.clone();
    wingMat.map = tex;
    for (const side of [-1, 1]) {
      const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s + 0.01, 0.02 * s + 0.01, s * 0.5), mat.silver);
      yoke.rotation.z = Math.PI / 2;
      yoke.position.x = side * (s * 0.75);
      g.add(yoke);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(wingW, wingH, 0.02), wingMat);
      wing.position.x = side * (s + wingW / 2);
      wing.rotation.x = -0.25;
      wing.castShadow = true;
      g.add(wing);
    }
  }

  // RTG: cilindros con aletas en la parte trasera
  for (let k = 0; k < ev.rtgCount; k++) {
    const rtg = new THREE.Group();
    rtg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 20), mat.dark));
    for (let f = 0; f < 8; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.62, 0.22), mat.dark);
      fin.rotation.y = (f / 8) * Math.PI * 2;
      fin.position.set(Math.cos(fin.rotation.y) * 0.18, 0, -Math.sin(fin.rotation.y) * 0.18);
      rtg.add(fin);
    }
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 12), mat.hot);
    rtg.add(glow);
    rtg.rotation.x = Math.PI / 2.6;
    rtg.position.set((k - (ev.rtgCount - 1) / 2) * 0.45, -s * 0.45, -s * 0.5 - 0.45);
    g.add(rtg);
  }

  // Antena de alta ganancia (paraboloide)
  const dishR = Math.max(0.12, ev.antenna.diameter * 0.45);
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const r = (i / 16) * dishR;
    pts.push(new THREE.Vector2(r, (r * r) / (dishR * 1.6)));
  }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mat.white);
  dish.position.y = s * 0.58 + 0.08;
  dish.castShadow = true;
  g.add(dish);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, dishR * 0.65), mat.silver);
  feed.position.y = dish.position.y + dishR * 0.32;
  g.add(feed);

  // Instrumentos en la cara +Z (apuntando al objetivo)
  const n = ev.instruments.length;
  ev.instruments.forEach((ins, idx) => {
    const col = idx % 3, row = Math.floor(idx / 3);
    const x = (col - 1) * s * 0.3 * (n === 1 ? 0 : 1);
    const y = s * 0.25 - row * s * 0.32;
    const unit = Math.max(0.08, s * 0.13);
    let m;
    if (ins.shape === 'lens') {
      m = new THREE.Group();
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(unit * 0.6, unit * 0.7, unit * 1.6, 24), mat.silver);
      barrel.rotation.x = Math.PI / 2;
      const glass = new THREE.Mesh(new THREE.CircleGeometry(unit * 0.55, 24), mat.lens);
      glass.position.z = unit * 0.81;
      m.add(barrel, glass);
      m.position.set(x, y, s / 2 + unit * 0.8);
    } else if (ins.shape === 'boom') {
      m = new THREE.Group();
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, s * 1.4), mat.silver);
      boom.rotation.z = Math.PI / 2.3;
      boom.position.x = s * 0.6;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(unit * 0.6, unit * 0.6, unit * 0.6), mat.white);
      tip.position.set(s * 1.25, s * 0.3, 0);
      m.add(boom, tip);
      m.position.set(0, y - s * 0.2, s * 0.3 - row * 0.1);
    } else if (ins.shape === 'arm') {
      m = new THREE.Group();
      const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, s * 0.9), mat.silver);
      a1.position.set(0, -s * 0.2, s * 0.45);
      a1.rotation.x = Math.PI / 3;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(unit * 0.8, unit * 0.5, unit * 0.5, 16), mat.white);
      head.position.set(0, -s * 0.45, s * 0.9);
      m.add(a1, head);
      m.position.set(x, -s * 0.2, 0);
    } else {
      m = new THREE.Mesh(new THREE.BoxGeometry(unit * 1.4, unit * 1.1, unit * 0.9), mat.white);
      m.position.set(x, y, s / 2 + unit * 0.45);
    }
    g.add(m);
  });

  // Motor
  if (ev.engine.id === 'ion') {
    const grid = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.22, s * 0.22, 0.06, 32), mat.dark);
    grid.position.y = -s * 0.6;
    const plume = new THREE.Mesh(new THREE.ConeGeometry(s * 0.2, s * 1.4, 32, 1, true), mat.ion.clone());
    plume.material.opacity = 0.35;
    plume.position.y = -s * 0.6 - s * 0.7;
    plume.name = 'plume';
    g.add(grid, plume);
  } else {
    const scale = ev.engine.id === 'biprop' ? 1 : 0.6;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.06 * scale + 0.01, s * 0.18 * scale + 0.02, s * 0.35 * scale + 0.05, 24, 1, true), mat.dark);
    nozzle.material.side = THREE.DoubleSide;
    nozzle.position.y = -s * 0.575 - (s * 0.35 * scale) / 2;
    g.add(nozzle);
  }

  // Tanque visible si hay mucho propelente
  if (ev.propellant > ev.bus.tankMax * 0.4) {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(s * 0.28, 24, 16), mat.silver);
    tank.position.set(0, 0, -s * 0.52);
    tank.scale.z = 0.5;
    g.add(tank);
  }

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
