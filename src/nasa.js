// Cliente de datos NASA. Todo pasa por /api/nasa (la clave vive en el servidor).
// Si la API falla, usamos datos de respaldo y lo indicamos en la interfaz.
import { FALLBACK_NEOS } from './data/catalog.js';
import { FALLBACK_FLARES, FALLBACK_CMES } from './data/fallback.js';

async function call(resource, params = {}) {
  const qs = new URLSearchParams({ resource, ...params });
  const res = await fetch(`/api/nasa?${qs}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`NASA ${resource}: HTTP ${res.status}`);
  return res.json();
}

const isoDate = (d) => d.toISOString().slice(0, 10);

/** Fulguraciones y CME de los últimos 30 días (DONKI). */
export async function loadSpaceWeather() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400e3);
  const range = { startDate: isoDate(start), endDate: isoDate(end) };
  try {
    const [flares, cmes] = await Promise.all([call('flares', range), call('cmes', range)]);
    return { flares: flares || [], cmes: cmes || [], live: true, range };
  } catch (err) {
    console.warn('DONKI sin conexión, usando respaldo', err);
    return { flares: FALLBACK_FLARES, cmes: FALLBACK_CMES, live: false, range: { startDate: '2024-05-01', endDate: '2024-10-31' } };
  }
}

/** Asteroides cercanos con elementos orbitales reales (NeoWs browse). */
export async function loadNeos() {
  try {
    const page = Math.floor(Math.random() * 40);
    const data = await call('neo', { page: String(page), size: '20' });
    const neos = (data.near_earth_objects || [])
      .filter((n) => n.orbital_data)
      .map((n) => {
        const o = n.orbital_data;
        const d = n.estimated_diameter?.meters;
        return {
          id: n.id,
          name: n.name.replace(/[()]/g, '').trim(),
          a: +o.semi_major_axis,
          e: +o.eccentricity,
          i: +o.inclination,
          node: +o.ascending_node_longitude,
          peri: +o.perihelion_argument,
          diameterM: d ? Math.round((d.estimated_diameter_min + d.estimated_diameter_max) / 2) : null,
          hazardous: n.is_potentially_hazardous_asteroid,
          jplUrl: n.nasa_jpl_url,
        };
      })
      .filter((n) => n.a > 0.5 && n.a < 3.5 && n.e < 0.9);
    if (!neos.length) throw new Error('NeoWs sin resultados útiles');
    return { neos, live: true };
  } catch (err) {
    console.warn('NeoWs sin conexión, usando respaldo', err);
    return { neos: FALLBACK_NEOS, live: false };
  }
}

/** Imagen astronómica del día para el briefing. */
export async function loadApod() {
  try {
    const data = await call('apod', { thumbs: 'true' });
    return { ...data, live: true };
  } catch {
    return null;
  }
}

/** Índice de actividad solar a partir de las clases de fulguración (C, M, X). */
export function solarActivity(flares) {
  let score = 0, x = 0, m = 0;
  for (const f of flares) {
    const cls = (f.classType || '').toUpperCase();
    const mag = parseFloat(cls.slice(1)) || 1;
    if (cls.startsWith('X')) { score += 10 * mag; x++; }
    else if (cls.startsWith('M')) { score += mag; m++; }
    else if (cls.startsWith('C')) score += 0.1 * mag;
  }
  const index = Math.min(2, score / 40); // 0 = Sol tranquilo, 2 = tormenta extrema
  const label = index < 0.4 ? 'Baja' : index < 1 ? 'Moderada' : index < 1.6 ? 'Alta' : 'Extrema';
  return { index, label, x, m, total: flares.length };
}
