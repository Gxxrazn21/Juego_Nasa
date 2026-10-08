// Nave modular procedural, en metros. Cada ranura del hangar es una pieza visible
// apilada como en las naves reales: motor → tanques → módulo de servicio → escudo →
// cápsula → hábitat → puerto de acoplamiento.
import * as THREE from 'three';
import { PROPELLANTS } from '../data/parts.js';
import { glowSprite } from './bodies.js';
import { drawInsignia } from '../app/insignia.js';

const SOLAR_W_PER_M2 = 1361 * 0.29 * 0.85;

function solarCellTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#121b33';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#6f7ea3';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 128; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
  }
  ctx.strokeStyle = '#2b3a5e';
  ctx.lineWidth = 0.6;
  for (let i = 8; i < 128; i += 8) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const cellTex = solarCellTexture();
cellTex.userData.keep = true; // compartida: no se libera al reconstruir la nave

export const FINISHES = { satinado: [0.45, 0.15], mate: [0.85, 0], metalico: [0.28, 0.75] };
export const MLI_COLORS = { oro: [0xd9a441, 0.35, 0.85], plata: [0xc9ccd2, 0.3, 0.9], negro: [0x1d1d22, 0.55, 0.3] };

function luminance(hex) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** Insignia de la misión como textura. */
function insigniaTexture(opts) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  drawInsignia(c, opts);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { texture: t, canvas: c };
}

/**
 * Pintura del casco para superficies cilíndricas (tanques, hábitat): color base,
 * patrón de librea, nombre de la nave y la insignia. u recorre la circunferencia.
 */
function liveryTexture(circumference, length, look, base, insignia) {
  const W = 1024;
  const H = Math.round(Math.min(2048, Math.max(96, (W * length) / circumference)));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const accent = look.accent ?? '#f26a2e';
  switch (look.livery) {
    case 'bandas':
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, W, Math.max(6, H * 0.07));
      ctx.fillRect(0, H - Math.max(6, H * 0.07), W, Math.max(6, H * 0.07));
      break;
    case 'ajedrez': // patrón de rotación como el del Saturno V
      ctx.fillStyle = '#1a1b20';
      for (let col = 0; col < 4; col++) for (let row = 0; row < 2; row++) {
        if ((col + row) % 2) ctx.fillRect((col * W) / 4, (row * H) / 2, W / 4, H / 2);
      }
      break;
    case 'bicolor':
      ctx.fillStyle = accent;
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
      break;
    case 'carreras':
      ctx.fillStyle = accent;
      ctx.fillRect(W * 0.22, 0, W * 0.03, H);
      ctx.fillRect(W * 0.27, 0, W * 0.03, H);
      ctx.fillRect(W * 0.72, 0, W * 0.03, H);
      ctx.fillRect(W * 0.77, 0, W * 0.03, H);
      break;
    default:
  }
  const name = (look.name || '').toUpperCase().slice(0, 16);
  const ink = luminance(base) > 0.45 ? '#16181f' : '#f3ead8';
  const size = Math.min(H * 0.42, 64);
  const drawWrapped = (fn) => { for (const off of [-W, 0, W]) { ctx.save(); ctx.translate(off, 0); fn(); ctx.restore(); } };
  if (name && size >= 12) {
    ctx.fillStyle = look.livery === 'ajedrez' ? accent : ink;
    ctx.font = `800 ${Math.round(size)}px "Big Shoulders Display", "Arial Narrow", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawWrapped(() => { ctx.fillText(name, W * 0.1, H / 2); ctx.fillText(name, W * 0.6, H / 2); });
  }
  if (insignia && H >= 80) {
    const s = Math.min(H * 0.75, W * 0.11);
    drawWrapped(() => {
      ctx.drawImage(insignia, W * 0.38 - s / 2, H / 2 - s / 2, s, s);
      ctx.drawImage(insignia, W * 0.88 - s / 2, H / 2 - s / 2, s, s);
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function lathe(profile, segments = 64, mat) {
  return new THREE.Mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments), mat);
}

function bell(throat, exit, length, segments = 48) {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push([throat + (exit - throat) * Math.pow(t, 0.6), -length * t]);
  }
  return pts;
}

/**
 * @returns {{ group: THREE.Group, focus: Record<string, {y:number, r:number}>, height:number, bottom:number }}
 */
export function buildShip(ev, look = {}) {
  const { ship } = ev;
  const g = new THREE.Group();
  const [rough, metalF] = FINISHES[look.finish] ?? FINISHES.satinado;
  const paintHex = look.paint ?? '#e9e6df';
  const paint = new THREE.MeshStandardMaterial({ color: paintHex, roughness: rough, metalness: metalF });
  const insignia = insigniaTexture({ ...look.insignia, accent: look.accent ?? '#f26a2e' });
  const accent = new THREE.MeshStandardMaterial({ color: look.accent ?? '#f26a2e', roughness: 0.5, metalness: 0.1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9bcc4, roughness: 0.3, metalness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.55, metalness: 0.6 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x3b3833, roughness: 0.4, metalness: 0.85, side: THREE.DoubleSide });
  const [mliColor, mliRough, mliMetal] = MLI_COLORS[look.mli] ?? MLI_COLORS.oro;
  const mli = new THREE.MeshStandardMaterial({ color: mliColor, roughness: mliRough, metalness: mliMetal });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0f1a, roughness: 0.05, metalness: 1 });
  const focus = {};

  const R = ship.capsule.radius;
  let y = 0;
  // Etiqueta las piezas añadidas desde la última marca con su ranura del hangar
  let marked = 0;
  const mark = (slot) => {
    for (let i = marked; i < g.children.length; i++) g.children[i].userData.slot = slot;
    marked = g.children.length;
  };

  // ---------- Motor (cuelga bajo y = 0) ----------
  const engine = new THREE.Group();
  let engineBottom = 0;
  const e = ship.engine.id;
  if (e === 'aj10') {
    engine.add(lathe(bell(0.12, 0.55, 1.6), 48, nozzleMat));
    const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 24), metal);
    chamber.position.y = 0.25;
    engine.add(chamber);
    engineBottom = -1.6;
  } else if (e === 'rl10') {
    const n = lathe(bell(0.15, 1.05, 4.1), 48, nozzleMat);
    engine.add(n);
    const cone = lathe([[0.3, 0.6], [0.6, 0], [0.15, 0]], 32, mli);
    engine.add(cone);
    engineBottom = -4.1;
  } else if (e === 'rvac') {
    const m = nozzleMat.clone();
    m.color.set(0x5a4a3c);
    engine.add(lathe(bell(0.25, 1.15, 3.1), 64, m));
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 1.0, 24), dark);
    pump.position.y = 0.5;
    engine.add(pump);
    engineBottom = -3.1;
  } else if (e === 'hall') {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.8, R * 0.8, 0.2, 32), dark);
    plate.position.y = -0.1;
    engine.add(plate);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const th = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 32), metal);
      th.position.set(Math.cos(a) * R * 0.45, -0.35, Math.sin(a) * R * 0.45);
      const ring = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshBasicMaterial({ color: 0x7fb4ff }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.16;
      th.add(ring, glowSprite(0x7fb4ff, 2.2));
      engine.add(th);
    }
    engineBottom = -0.6;
  } else if (e === 'ntr') {
    const shadow = lathe([[0.4, 0], [1.3, 0], [1.3, -0.4], [0.4, -0.6]], 48, dark);
    engine.add(shadow);
    const trussL = 8;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, trussL, 8), metal);
      rod.position.set(Math.cos(a) * 0.9, -0.6 - trussL / 2, Math.sin(a) * 0.9);
      engine.add(rod);
    }
    for (let k = 1; k < 5; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 24), metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.6 - (trussL * k) / 5;
      engine.add(ring);
    }
    const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.2, 32), dark);
    reactor.position.y = -0.6 - trussL - 1.1;
    engine.add(reactor);
    const n = lathe(bell(0.2, 1.0, 2.6), 48, nozzleMat);
    n.position.y = -0.6 - trussL - 2.2;
    engine.add(n);
    engineBottom = -0.6 - trussL - 2.2 - 2.6;
  }
  g.add(engine);
  mark('engine');
  focus.engine = { y: engineBottom / 2, r: Math.max(6, -engineBottom * 1.2) };

  // ---------- Tanques ----------
  const pd = PROPELLANTS[ship.engine.prop];
  const volume = ship.tanks.capacity / pd.density;
  const rt = Math.min(R * 1.8, Math.max(R * 0.9, Math.cbrt(volume / (6 * Math.PI))));
  const L = Math.max(1.2, volume / (Math.PI * rt * rt));
  const tankMat = paint;
  const liveryMat = paint.clone();
  liveryMat.color.set(0xffffff);
  liveryMat.map = liveryTexture(2 * Math.PI * rt, L, look, paintHex, insignia.canvas);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(rt, rt, L, 64), liveryMat);
  tank.position.y = y + L / 2;
  g.add(tank);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(rt, 48, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), tankMat);
  dome.scale.y = 0.35;
  dome.position.y = y;
  g.add(dome);
  focus.tanks = { y: y + L / 2, r: Math.max(rt * 3, L * 1.2) };
  const tankBottom = y;
  y += L;

  // Adaptador si el tanque es más ancho o estrecho que la cápsula
  if (Math.abs(rt - R) > 0.05) {
    const ad = new THREE.Mesh(new THREE.CylinderGeometry(R, rt, 0.8, 48, 1, true), dark);
    ad.position.y = y + 0.4;
    g.add(ad);
    y += 0.8;
  }

  mark('tanks');

  // ---------- Módulo de servicio + energía ----------
  const smH = Math.max(1.2, R * 0.9);
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(R, R, smH, 48), mli);
  sm.position.y = y + smH / 2;
  g.add(sm);
  const smY = y + smH / 2;
  // propulsores de control de actitud (RCS)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const quad = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), dark);
    quad.position.set(Math.cos(a) * (R + 0.12), smY + smH * 0.3, Math.sin(a) * (R + 0.12));
    g.add(quad);
  }
  mark('life');
  addPower(g, ship.power, R, smY, dark, metal);
  mark('power');
  focus.power = { y: smY, r: Math.max(8, R * 5) };
  focus.life = { y: smY, r: R * 3.2 };
  y += smH;

  // ---------- Tren de aterrizaje ----------
  if (ship.legs.id !== 'none') {
    const footY = Math.min(engineBottom, tankBottom) - 0.6;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const top = new THREE.Vector3(Math.cos(a) * rt * 0.95, tankBottom + L * 0.35, Math.sin(a) * rt * 0.95);
      const foot = new THREE.Vector3(Math.cos(a) * (rt + 2.2), footY, Math.sin(a) * (rt + 2.2));
      g.add(strut(top, foot, 0.12, mli));
      const mid = new THREE.Vector3(Math.cos(a) * rt * 0.95, tankBottom + 0.2, Math.sin(a) * rt * 0.95);
      g.add(strut(mid, foot.clone().lerp(top, 0.25), 0.06, metal));
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.15, 24), metal);
      pad.position.copy(foot);
      g.add(pad);
    }
    focus.legs = { y: footY / 2 + tankBottom / 2, r: rt * 3.5 };
  } else {
    focus.legs = { y: tankBottom, r: rt * 3.5 };
  }

  mark('legs');

  // ---------- Escudo térmico ----------
  const shieldColors = { none: 0x555555, ablative: 0x5a4632, avcoat: 0x3d2f26, pica: 0x15151a };
  const shield = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.02, R * 0.98, 0.35, 64),
    new THREE.MeshStandardMaterial({ color: shieldColors[ship.shield.id], roughness: 0.95 }),
  );
  shield.position.y = y + 0.175;
  if (ship.shield.id !== 'none') g.add(shield);
  focus.shield = { y: y, r: R * 3 };
  y += ship.shield.id !== 'none' ? 0.35 : 0.05;

  mark('shield');

  // ---------- Cápsula ----------
  const capsuleBase = y;
  let capH;
  const c = ship.capsule.id;
  const profile = {
    orion: [[0, 0], [R, 0], [R * 0.98, 0.25], [1.05, 3.0], [0.9, 3.3], [0, 3.3]],
    dragon: [[0, 0], [R, 0], [R * 0.97, 0.35], [1.3, 2.6], [1.0, 3.4], [0.6, 3.85], [0, 4.0]],
    soyuz: [[0, 0], [R, 0], [R * 1.02, 0.3], [R * 0.9, 1.3], [R * 0.55, 2.0], [0, 2.1]],
  }[c];
  if (c === 'orion') {
    capH = 3.3;
    g.add(at(lathe(profile, 64, paint), y));
  } else if (c === 'dragon') {
    capH = 4.0;
    g.add(at(lathe(profile, 64, paint), y));
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.12), dark);
    fin.position.set(0, y + 0.2, R * 0.95);
    g.add(fin);
  } else {
    // Soyuz: módulo de descenso en forma de campana + módulo orbital esférico
    capH = 2.1 + 2.2;
    g.add(at(lathe(profile, 64, paint), y));
    const orb = new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), paint);
    orb.position.y = y + 2.1 + 1.05;
    g.add(orb);
  }
  // ventanas, pegadas a la superficie inclinada de la cápsula
  const winH = c === 'soyuz' ? 1.2 : 2.3;
  const slope = surfaceSlope(profile, winH);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const r = radiusAt(profile, winH) + 0.015;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.3), glass);
    win.position.set(Math.cos(a) * r, y + winH, Math.sin(a) * r);
    win.rotation.set(0, Math.PI / 2 - a, 0, 'YXZ');
    win.rotateX(-slope);
    g.add(win);
  }
  // parche de la misión
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 1.05),
    new THREE.MeshStandardMaterial({ map: insignia.texture, roughness: 0.6, transparent: true, alphaTest: 0.05 }),
  );
  const patchH = c === 'soyuz' ? 0.8 : 1.4;
  patch.position.set(0, y + patchH, radiusAt(profile, patchH) + 0.02);
  patch.rotation.x = -surfaceSlope(profile, patchH);
  g.add(patch);
  // franja de acento
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.005, R * 1.005, 0.18, 64, 1, true), accent);
  stripe.position.y = capsuleBase + 0.12;
  g.add(stripe);
  focus.capsule = { y: y + capH / 2, r: Math.max(6, R * 3.4) };
  focus.paint = { y: y, r: Math.max(10, R * 4) };
  y += capH;

  mark('capsule');

  // ---------- Hábitat ----------
  const h = ship.habitat.id;
  if (h !== 'none') {
    const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.6, 32), metal);
    adapter.position.y = y + 0.3;
    g.add(adapter);
    y += 0.6;
    const dims = { beam: [1.6, 4.0], halo: [1.5, 7.0], b330: [3.35, 13.7] }[h];
    const habBase = h === 'halo' ? paintHex : '#f1eee6';
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: h === 'halo' ? rough : 0.9,
      metalness: h === 'halo' ? metalF : 0,
      map: liveryTexture(2 * Math.PI * dims[0], dims[1], look, habBase, insignia.canvas),
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(dims[0], dims[0], dims[1] - dims[0] * 0.6, 64), bodyMat);
    for (const k of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(dims[0], 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: habBase, roughness: bodyMat.roughness, metalness: bodyMat.metalness }));
      cap.scale.y = 0.3;
      cap.rotation.x = k < 0 ? Math.PI : 0;
      cap.position.y = y + dims[1] / 2 + k * (dims[1] - dims[0] * 0.6) / 2;
      g.add(cap);
    }
    body.position.y = y + dims[1] / 2;
    g.add(body);
    if (h !== 'halo') {
      for (let k = 1; k < 6; k++) {
        const seam = new THREE.Mesh(new THREE.TorusGeometry(dims[0] * 1.002, 0.03, 6, 48), dark);
        seam.rotation.x = Math.PI / 2;
        seam.position.y = y + (dims[1] * k) / 6;
        g.add(seam);
      }
    } else {
      for (let k = 0; k < 8; k++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, dims[1] * 0.8, 0.12), metal);
        const a = (k / 8) * Math.PI * 2;
        rib.position.set(Math.cos(a) * dims[0], y + dims[1] / 2, Math.sin(a) * dims[0]);
        g.add(rib);
      }
    }
    focus.habitat = { y: y + dims[1] / 2, r: Math.max(8, dims[1] * 1.4) };
    y += dims[1];
  } else {
    focus.habitat = { y: y, r: 8 };
  }

  mark('habitat');

  // ---------- Acoplamiento ----------
  if (ship.docking.id !== 'none') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.5, 32), metal);
    base.position.y = y + 0.25;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.12, 12, 40), dark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y + 0.55;
    g.add(base, ring);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.08), accent);
      petal.position.set(Math.cos(a) * 0.62, y + 0.75, Math.sin(a) * 0.62);
      petal.lookAt(0, y + 0.75, 0);
      g.add(petal);
    }
    if (ship.docking.repairs) {
      const pts = [new THREE.Vector3(R * 0.6, y - 0.4, 0), new THREE.Vector3(R + 1.5, y + 1.6, 0.5), new THREE.Vector3(R + 3.4, y + 0.4, 1.2), new THREE.Vector3(R + 3.8, y - 1.0, 1.4)];
      for (let i = 0; i < pts.length - 1; i++) g.add(strut(pts[i], pts[i + 1], 0.13, paint));
      for (const p of pts) {
        const j = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), dark);
        j.position.copy(p);
        g.add(j);
      }
    }
    focus.docking = { y: y, r: 6 };
    y += 0.9;
  } else {
    focus.docking = { y: y, r: 6 };
  }

  mark('docking');

  // ---------- Ciencia: cajas de experimentos en el módulo de servicio ----------
  ev.instruments.forEach((ins, i) => {
    const a = (i / Math.max(1, ev.instruments.length)) * Math.PI * 2 + 0.3;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), i % 2 ? paint : mli);
    box.position.set(Math.cos(a) * (R + 0.25), smY - smH * 0.15, Math.sin(a) * (R + 0.25));
    box.lookAt(0, box.position.y, 0);
    g.add(box);
  });
  focus.science = { y: smY, r: R * 3.5 };

  mark('science');

  // ---------- Luces de navegación: roja a babor, verde a estribor, estroboscópicas blancas ----------
  const lights = [
    [0xff3b30, new THREE.Vector3(-(R + 0.18), smY + smH * 0.42, 0), 0],
    [0x34e07a, new THREE.Vector3(R + 0.18, smY + smH * 0.42, 0), 0],
    [0xffffff, new THREE.Vector3(0, y + 0.15, 0), 0.1],
    [0xffffff, new THREE.Vector3(0, tankBottom - 0.2, rt * 0.6), 0.7],
  ];
  for (const [color, pos, blink] of lights) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color }));
    bulb.position.copy(pos);
    bulb.add(glowSprite(color, 0.9));
    if (blink) bulb.userData.blink = blink;
    g.add(bulb);
  }

  // ---------- Llama del motor (visible en el encendido) ----------
  const plumeColor = { hall: 0x7fb4ff, ntr: 0xcfe3ff, rvac: 0xff9a5a, rl10: 0xbfd2ff, aj10: 0xffb070 }[ship.engine.id];
  const plumeLen = ship.engine.id === 'hall' ? 5 : 9;
  const plume = new THREE.Mesh(
    new THREE.ConeGeometry(ship.engine.id === 'hall' ? R * 0.8 : 1.4, plumeLen, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: plumeColor, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  plume.geometry.translate(0, -plumeLen / 2, 0);
  plume.position.y = engineBottom;
  plume.add(glowSprite(plumeColor, 6));
  plume.name = 'plume';
  plume.visible = false;
  g.add(plume);

  g.traverse((o) => { if (o.isMesh && o.material.blending !== THREE.AdditiveBlending) { o.castShadow = true; o.receiveShadow = true; } });
  const bottom = Math.min(engineBottom, ship.legs.id !== 'none' ? Math.min(engineBottom, tankBottom) - 0.6 : engineBottom);
  focus.all = { y: (y + bottom) / 2, r: Math.max(10, (y - bottom) * 1.1) };
  // Tamaño real (incluye paneles y mástiles) para encuadrar la nave completa
  const box = new THREE.Box3();
  g.children.forEach((c) => { if (c.name !== 'plume') box.expandByObject(c); });
  const width = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z));
  return { group: g, focus, height: y, bottom, top: box.max.y, low: box.min.y, width };
}

/** Radio de un perfil de torno a la altura h. */
function radiusAt(profile, h) {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1], [r1, y1] = profile[i];
    if (h >= y0 && h <= y1 && y1 > y0) return r0 + ((r1 - r0) * (h - y0)) / (y1 - y0);
  }
  return profile[1][0];
}

/** Inclinación (rad) de la pared del perfil respecto a la vertical. */
function surfaceSlope(profile, h) {
  const d = 0.05;
  return Math.atan2(radiusAt(profile, h - d) - radiusAt(profile, h + d), 2 * d);
}

function at(mesh, y) {
  mesh.position.y = y;
  return mesh;
}

function strut(a, b, radius, mat) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function addPower(g, power, R, y, dark, metal) {
  const area = power.output / SOLAR_W_PER_M2;
  const cellMat = new THREE.MeshStandardMaterial({ map: cellTex, metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide });
  if (power.id === 'xwing') {
    const w = 2.0, len = area / 4 / w;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const wing = new THREE.Group();
      const t = cellTex.clone(); t.needsUpdate = true; t.repeat.set(Math.round(len / 1.2), 2);
      const m = cellMat.clone(); m.map = t;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, w), m);
      panel.position.x = R + 0.4 + len / 2;
      const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5), metal);
      yoke.rotation.z = Math.PI / 2;
      yoke.position.x = R + 0.2;
      wing.add(panel, yoke);
      wing.rotation.y = a;
      wing.rotation.z = 0.12;
      wing.position.y = y;
      g.add(wing);
    }
  } else if (power.id === 'ultraflex') {
    const r = Math.sqrt(area / 2 / Math.PI);
    for (const s of [-1, 1]) {
      const fan = new THREE.Mesh(new THREE.CircleGeometry(r, 10), cellMat);
      fan.position.set(s * (R + 0.6 + r), y, 0);
      fan.rotation.x = -Math.PI / 2 + 0.2;
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6 + r), metal);
      boom.rotation.z = Math.PI / 2;
      boom.position.set(s * (R + (0.6 + r) / 2), y, 0);
      g.add(fan, boom);
    }
  } else if (power.id === 'rosa') {
    const w = 6, len = area / 2 / w;
    for (const s of [-1, 1]) {
      const t = cellTex.clone(); t.needsUpdate = true; t.repeat.set(Math.round(len / 1.5), 4);
      const m = cellMat.clone(); m.map = t;
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, w), m);
      blanket.position.set(s * (R + 0.8 + len / 2), y, 0);
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, w, 16), dark);
      roll.rotation.x = Math.PI / 2;
      roll.position.set(s * (R + 0.8 + len), y, 0);
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len), metal);
      boom.rotation.z = Math.PI / 2;
      boom.position.set(s * (R + 0.8 + len / 2), y, w / 2);
      g.add(blanket, roll, boom);
    }
  } else {
    // Reactores de fisión en un mástil, lejos de la tripulación, con radiadores
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 10), metal);
    mast.rotation.z = Math.PI / 2;
    mast.position.set(R + 5, y, 0);
    g.add(mast);
    for (let i = 0; i < 4; i++) {
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 16), dark);
      core.position.set(R + 3 + i * 2, y - 0.8, 0);
      const rad = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0xcfd2d6, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.4 }));
      rad.position.set(R + 3 + i * 2, y + 0.9, 0);
      g.add(core, rad);
    }
  }
}
