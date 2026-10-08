// Niveles de calidad gráfica. "auto" elige según el dispositivo para que el juego
// corra fluido en teléfonos modestos y luzca al máximo en PC.

export const QUALITY = {
  alta: { label: 'Alta', pixelRatio: 2, shadows: 2048, textures: 4096, segments: 160, stars: 5000, fps: 60, antialias: true },
  media: { label: 'Media', pixelRatio: 1.5, shadows: 1024, textures: 2048, segments: 96, stars: 3000, fps: 60, antialias: true },
  baja: { label: 'Baja', pixelRatio: 1, shadows: 0, textures: 2048, segments: 64, stars: 1500, fps: 30, antialias: false },
};

/** Calidad sugerida para este dispositivo. */
export function detectQuality() {
  const mem = navigator.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const touch = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 820;
  if (mem <= 2 || cores <= 2) return 'baja';
  if (touch || small || mem <= 4 || cores <= 4) return 'media';
  return 'alta';
}

export function resolveQuality(pref) {
  return QUALITY[pref] ? pref : detectQuality();
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
