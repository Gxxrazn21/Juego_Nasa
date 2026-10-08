// Insignia de la misión dibujada en canvas: se usa en la interfaz (vista previa)
// y como textura en la cápsula y los tanques de la nave.

export const SHAPES = [
  { id: 'circulo', name: 'Círculo' },
  { id: 'escudo', name: 'Escudo' },
  { id: 'delta', name: 'Delta' },
  { id: 'hexagono', name: 'Hexágono' },
];

export const SYMBOLS = [
  { id: 'cohete', name: 'Cohete' },
  { id: 'orbita', name: 'Órbita' },
  { id: 'luna', name: 'Luna' },
  { id: 'planeta', name: 'Planeta' },
  { id: 'estrella', name: 'Estrella' },
  { id: 'casco', name: 'Casco' },
];

export const INSIGNIA_BG = ['#14182a', '#1f3a68', '#3a1f1f', '#14332a', '#f1efe9'];

function shapePath(ctx, shape, r) {
  ctx.beginPath();
  if (shape === 'escudo') {
    ctx.moveTo(-r * 0.85, -r * 0.9);
    ctx.lineTo(r * 0.85, -r * 0.9);
    ctx.lineTo(r * 0.85, r * 0.1);
    ctx.quadraticCurveTo(r * 0.8, r * 0.75, 0, r);
    ctx.quadraticCurveTo(-r * 0.8, r * 0.75, -r * 0.85, r * 0.1);
    ctx.closePath();
  } else if (shape === 'delta') {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.95, r * 0.8);
    ctx.lineTo(-r * 0.95, r * 0.8);
    ctx.closePath();
  } else if (shape === 'hexagono') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
}

function drawSymbol(ctx, symbol, s, color, accent) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  if (symbol === 'cohete') {
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.32, -s * 0.5, s * 0.25, s * 0.45);
    ctx.lineTo(-s * 0.25, s * 0.45);
    ctx.quadraticCurveTo(-s * 0.32, -s * 0.5, 0, -s);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, s * 0.5); ctx.lineTo(0, s * 1.05); ctx.lineTo(s * 0.18, s * 0.5);
    ctx.fill();
    ctx.fillStyle = color;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(k * s * 0.24, s * 0.05); ctx.lineTo(k * s * 0.5, s * 0.5); ctx.lineTo(k * s * 0.24, s * 0.42);
      ctx.fill();
    }
  } else if (symbol === 'orbita') {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.rotate(-0.4); ctx.strokeStyle = accent;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.95, s * 0.38, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(s * 0.8, -s * 0.38, s * 0.1, 0, Math.PI * 2); ctx.fill();
  } else if (symbol === 'luna') {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(s * 0.35, -s * 0.2, s * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(s * 0.55, s * 0.45, s * 0.12, 0, Math.PI * 2); ctx.fill();
  } else if (symbol === 'planeta') {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = accent;
    ctx.save(); ctx.rotate(-0.35);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.95, s * 0.22, 0, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.restore();
  } else if (symbol === 'estrella') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.38 : s * 0.9;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  } else {
    // casco de astronauta con visor dorado
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.5, s * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(-s * 0.6, s * 0.62, s * 1.2, s * 0.22);
  }
  ctx.restore();
}

const imageCache = new Map();
function uploaded(src) {
  if (!src) return null;
  if (!imageCache.has(src)) {
    const img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  const img = imageCache.get(src);
  return img.complete && img.naturalWidth ? img : null;
}

/**
 * Dibuja la insignia centrada en un canvas cuadrado.
 * opts: { shape, symbol, bg, accent, top, bottom, stars, upload }
 */
export function drawInsignia(canvas, opts) {
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  const r = size * 0.46;
  const ink = '#f3ead8';
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  // borde de color de acento
  shapePath(ctx, opts.shape, r);
  ctx.fillStyle = opts.accent;
  ctx.fill();
  shapePath(ctx, opts.shape, r * 0.88);
  ctx.fillStyle = opts.bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const img = uploaded(opts.upload);
  if (img) {
    const k = Math.max((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight);
    ctx.drawImage(img, (-img.naturalWidth * k) / 2, (-img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
  } else {
    // estrellas: una por tripulante, como en los parches del Apolo
    ctx.fillStyle = ink;
    for (let i = 0; i < (opts.stars ?? 3); i++) {
      const a = Math.PI * 1.15 + (i / Math.max(1, (opts.stars ?? 3) - 1)) * Math.PI * 0.7;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55 - r * 0.05, r * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
    const light = /^#f/i.test(opts.bg);
    drawSymbol(ctx, opts.symbol, r * 0.42, light ? '#14182a' : ink, opts.accent);
  }
  ctx.restore();
  // textos
  const light = /^#f/i.test(opts.bg) && !img;
  ctx.fillStyle = light ? '#14182a' : ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = img ? size * 0.02 : 0;
  ctx.font = `800 ${Math.round(size * 0.12)}px "Big Shoulders Display", "Arial Narrow", sans-serif`;
  if (opts.bottom) ctx.fillText(opts.bottom.slice(0, 12).toUpperCase(), 0, r * (opts.shape === 'delta' ? 0.55 : 0.62));
  ctx.font = `700 ${Math.round(size * 0.075)}px "Atkinson Hyperlegible", sans-serif`;
  if (opts.top && opts.shape !== 'delta') ctx.fillText(opts.top.slice(0, 16), 0, -r * 0.66);
  ctx.restore();
  return canvas;
}

/** Imagen subida por el jugador → dataURL cuadrado pequeño (cabe en localStorage). */
export function fileToLogo(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('No es una imagen'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const k = Math.max(size / img.width, size / img.height);
      ctx.drawImage(img, (size - img.width * k) / 2, (size - img.height * k) / 2, img.width * k, img.height * k);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/webp', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

/** Promesa que se resuelve cuando la imagen subida está lista para dibujarse. */
export function preloadLogo(src) {
  if (!src) return Promise.resolve();
  uploaded(src);
  const img = imageCache.get(src);
  return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
}
