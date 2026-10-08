// Texturas procedurales (sin descargar imágenes): Tierra, paneles solares, MLI.
import * as THREE from 'three';

/** Ruido de valor 3D (suave, sin costuras al muestrear sobre una esfera). */
function noise3D(seed = 1) {
  const hash = (x, y, z) => {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const u = fade(x - X), v = fade(y - Y), w = fade(z - Z);
    const c = (dx, dy, dz) => hash(X + dx, Y + dy, Z + dz);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
      w,
    ) * 2 - 1;
  };
}

const planetCache = new Map();

/** Planeta procedural en proyección equirectangular (cacheado por parámetros). */
export function planetTexture(opts = {}) {
  const key = JSON.stringify(opts);
  if (!planetCache.has(key)) planetCache.set(key, drawPlanet(opts));
  return planetCache.get(key);
}

function drawPlanet({ seed = 7, ocean = [24, 54, 104], land = [[70, 102, 58], [140, 128, 88]], ice = true, sea = 0.02, size = 512 } = {}) {
  const w = size, h = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const n = noise3D(seed);
  for (let y = 0; y < h; y++) {
    const lat = (y / h) * Math.PI;
    for (let x = 0; x < w; x++) {
      const lon = (x / w) * Math.PI * 2;
      // punto real sobre la esfera: sin costuras ni estiramiento en los polos
      const sx = Math.sin(lat) * Math.cos(lon) * 2, sy = Math.sin(lat) * Math.sin(lon) * 2, sz = Math.cos(lat) * 2;
      let v = 0, amp = 0.6, f = 1;
      for (let o = 0; o < 6; o++) {
        v += amp * n(sx * f + 11, sy * f + 7, sz * f + 3);
        amp *= 0.5; f *= 2.03;
      }
      const polar = Math.abs(Math.cos(lat));
      let c;
      if (ice && polar > 0.94 + v * 0.05) c = [232, 236, 240];
      else if (v > sea) {
        const t = Math.min(1, (v - sea) * 2.2);
        c = land[0].map((a, i) => a + (land[1][i] - a) * t);
      } else {
        const d = Math.min(1, (sea - v) * 1.8);
        c = ocean.map((a) => a * (1 - d * 0.35));
      }
      const k = (y * w + x) * 4;
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function solarCellTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#16223f';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#7f8db0';
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= 128; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Arrugas del aislamiento multicapa (MLI) dorado. */
export function mliBumpTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const g = 90 + Math.random() * 90;
    ctx.strokeStyle = `rgb(${g},${g},${g})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    const x = Math.random() * 256, y = Math.random() * 256;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.random() * 60 - 30, y + Math.random() * 60 - 30, x + Math.random() * 80 - 40, y + Math.random() * 80 - 40);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
