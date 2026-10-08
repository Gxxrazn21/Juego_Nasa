// Carga de modelos 3D reales de NASA 3D Resources (dominio público), con Draco.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader().setDecoderPath('/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const cache = new Map();

/** Promesa con el gltf.scene original (se clona en cada uso). */
function load(name) {
  if (!cache.has(name)) {
    cache.set(name, loader.loadAsync(`/models/${name}.glb`).then((g) => {
      g.scene.traverse((o) => {
        if (o.isMesh) {
          if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
          // Algunos trajes vienen exportados con transmisión = 1 (vidrio) y se ven negros
          for (const m of [].concat(o.material)) if (m.transmission) m.transmission = 0;
          o.castShadow = o.receiveShadow = true;
          o.userData.shared = true; // la geometría vive en la caché: no se libera
        }
      });
      return g.scene;
    }));
  }
  return cache.get(name);
}

export function preload(names) {
  for (const n of names) load(n).catch(() => {});
}

async function cloneModel(name) {
  const obj = (await load(name)).clone(true);
  obj.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); });
  return obj;
}

/** Clona el modelo, lo escala a `height` metros y apoya los pies en y = 0. */
export async function loadNormalized(name, height) {
  const obj = await cloneModel(name);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = height / size.y;
  obj.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -box2.min.y, -c.z);
  const wrap = new THREE.Group();
  wrap.add(obj);
  return wrap;
}

const tmp = { h: 0, s: 0, l: 0 };

/** Pinta el traje: telas claras (o naranja en el ACES) toman el color elegido; franjas rojas, el del rol. */
export function tintSuit(root, suitHex, stripeHex) {
  const suit = suitHex ? new THREE.Color(suitHex) : null;
  const stripe = new THREE.Color(stripeHex);
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m.userData.base) m.userData.base = m.color.clone();
      const base = m.userData.base;
      base.getHSL(tmp);
      const fabric = (tmp.l > 0.5 && tmp.s < 0.25) || (m.map && tmp.s < 0.25) || (tmp.h > 0.02 && tmp.h < 0.07 && tmp.s > 0.6 && tmp.l > 0.3);
      const isStripe = tmp.s > 0.8 && tmp.h < 0.02 && tmp.l > 0.2 && tmp.l < 0.5;
      if (isStripe) m.color.copy(stripe);
      else if (fabric && suit) m.color.copy(m.map ? suit : suit.clone().multiplyScalar(Math.min(1, 0.55 + tmp.l * 0.5)));
      else m.color.copy(base);
      m.roughness = Math.max(m.roughness ?? 0.8, 0.55);
    }
  });
}

/** Estaciones: ISS y Gateway reales a escala en metros; el depósito se construye aquí. */
export async function loadStation(id) {
  if (id === 'iss') {
    const obj = await cloneModel('iss-lite');
    const box = new THREE.Box3().setFromObject(obj);
    const span = box.getSize(new THREE.Vector3());
    obj.scale.setScalar(109 / Math.max(span.x, span.z)); // la ISS mide 109 m entre paneles
    obj.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (/SolarPanels/i.test(m.name)) { m.color.set('#7a5a22'); m.metalness = 0.6; m.roughness = 0.35; }
      }
    });
    return center(obj);
  }
  if (id === 'gateway') {
    const obj = await cloneModel('gateway');
    const box = new THREE.Box3().setFromObject(obj);
    const span = box.getSize(new THREE.Vector3());
    obj.scale.setScalar(60 / Math.max(span.x, span.y, span.z));
    return center(obj);
  }
  return depot();
}

/** Envuelve el objeto en un grupo con su centro geométrico en el origen. */
function center(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.sub(c);
  const g = new THREE.Group();
  g.add(obj);
  return g;
}

function depot() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.5, metalness: 0.2 });
  const foam = new THREE.MeshStandardMaterial({ color: 0xc8692c, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.5, metalness: 0.6 });
  const truss = new THREE.Mesh(new THREE.BoxGeometry(2, 40, 2), dark);
  g.add(truss);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(3, 16, 8, 24), i % 2 ? foam : white);
    tank.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6);
    g.add(tank);
  }
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1b2a4a, metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const arr = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 9), panelMat);
    arr.position.set(s * 24, 14, 0);
    g.add(arr);
  }
  const port = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.25, 12, 32), dark);
  port.rotation.x = Math.PI / 2;
  port.position.y = 20.5;
  g.add(port);
  g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return g;
}
