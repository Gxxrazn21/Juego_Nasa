// Física orbital simplificada con fines educativos.
// Todas las velocidades en km/s, distancias en km, masas en kg.

export const G0 = 9.80665; // m/s²
export const MU_SUN = 1.32712440018e11; // km³/s²
export const MU_EARTH = 398600.4418; // km³/s²
export const AU_KM = 1.495978707e8;
export const R_EARTH = 6378.137;
export const R_LEO = R_EARTH + 300;
export const SOLAR_CONSTANT = 1361; // W/m² a 1 UA

const DEG = Math.PI / 180;

/** Ecuación del cohete de Tsiolkovsky. */
export function rocketDeltaV(isp, wetMass, dryMass) {
  if (dryMass <= 0 || wetMass <= dryMass) return 0;
  return (isp * G0 * Math.log(wetMass / dryMass)) / 1000;
}

/** Propelente necesario para lograr un Δv con una masa seca dada. */
export function propellantFor(dv, isp, dryMass) {
  return dryMass * (Math.exp((dv * 1000) / (isp * G0)) - 1);
}

/** Transferencia de Hohmann entre órbitas circulares coplanares. */
export function hohmann(r1, r2, mu) {
  const at = (r1 + r2) / 2;
  const v1 = Math.sqrt(mu / r1);
  const v2 = Math.sqrt(mu / r2);
  const dv1 = v1 * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
  const dv2 = v2 * (1 - Math.sqrt((2 * r1) / (r1 + r2)));
  const tof = Math.PI * Math.sqrt(at ** 3 / mu); // s
  return { dv1: Math.abs(dv1), dv2: Math.abs(dv2), tof, v1, v2 };
}

/**
 * Estimación de una misión de encuentro con un asteroide a partir de sus
 * elementos orbitales reales (a [UA], e, i [grados]).
 * Hohmann heliocéntrica + cambio de plano repartido entre salida y llegada
 * + penalización por excentricidad. No sustituye a un optimizador de
 * trayectorias, pero ordena correctamente los objetivos "fáciles" y "difíciles".
 */
export function neoRendezvous({ a, e, i }) {
  const r1 = AU_KM;
  const r2 = a * AU_KM;
  const h = hohmann(r1, r2, MU_SUN);
  const plane = 2 * h.v1 * Math.sin((i * DEG) / 2);
  // El cambio de plano se reparte: 70 % lo paga el lanzador (C3), 30 % la nave.
  const vinf = Math.hypot(h.dv1, plane * 0.7);
  const arrival = Math.hypot(h.dv2, plane * 0.3) + e * h.v2 * 0.1;
  return {
    c3: vinf * vinf, // km²/s², lo aporta el lanzador
    vinf,
    arrivalDv: arrival, // lo aporta la nave
    departureFromLeo: Math.sqrt(vinf * vinf + (2 * MU_EARTH) / R_LEO) - Math.sqrt(MU_EARTH / R_LEO),
    transferDays: h.tof / 86400,
    aphelionAU: a * (1 + e),
    perihelionAU: a * (1 - e),
  };
}

/** Potencia solar disponible a una distancia del Sol (UA). */
export function solarPower(areaM2, distanceAU, efficiency, degradation = 1) {
  return areaM2 * (SOLAR_CONSTANT / (distanceAU * distanceAU)) * efficiency * degradation;
}

// Constante calibrada con MRO (antena 3 m, 100 W, ~6 Mbps a 0,7 UA) usando la Red
// de Espacio Profundo (DSN) de 34 m. Tasa ∝ P·D²/d².
const LINK_K = 7.35e19;
export const MAX_RATE_BPS = 150e6;

/** Tasa de bajada aproximada (bit/s). */
export function downlinkRate(txPowerW, dishM, distanceKm) {
  const rate = (LINK_K * txPowerW * dishM * dishM) / (distanceKm * distanceKm);
  return Math.min(rate, MAX_RATE_BPS);
}

/** Capacidad del lanzador (kg) para un objetivo. Modelo lineal en C3 para escape. */
export function launcherCapacity(lv, target, c3 = 0) {
  switch (target) {
    case 'LEO': return lv.leo;
    case 'GTO': return lv.gto;
    case 'TLI': return lv.tli;
    case 'ESC': return Math.max(0, lv.esc * (1 - c3 / lv.c3max));
    default: return 0;
  }
}

/** Posición heliocéntrica (en UA) de un punto de la órbita para una anomalía verdadera ν. */
export function orbitPoint({ a, e, i, node = 0, peri = 0 }, nu) {
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
  const O = node * DEG, w = peri * DEG, inc = i * DEG;
  const u = w + nu;
  const x = r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(inc));
  const y = r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(inc));
  const z = r * Math.sin(u) * Math.sin(inc);
  return { x, y, z };
}
