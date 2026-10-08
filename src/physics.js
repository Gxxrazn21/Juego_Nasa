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

// ---------- Comunicaciones ----------
// Radio: tasa ∝ P · D² / (λ² · d²). Calibrado con Mars Reconnaissance Orbiter: antena de 3 m,
// 100 W en banda X, ~6 Mbps a 0,7 UA hacia una antena de 34 m de la Red de Espacio Profundo.
const RF_K = 7.35e19;
// Factor por banda respecto a la X: S tiene λ 3,6 veces mayor (∝ 1/λ²); Ka en la práctica rinde ~4×.
export const BANDS = { S: 0.077, X: 1, Ka: 4 };
export const RF_MAX_BPS = 150e6; // límite práctico en banda Ka
// Láser: calibrado con DSOC (nave Psyche, 2023): 4 W y 267 Mbps a ~0,2 UA.
const LASER_K = 7.3e22;
export const LASER_MAX_BPS = 260e6; // O2O de Artemis II

/**
 * Tasa de bajada en bit/s.
 * @param {object} c  terminal: { tx (W), dish (m), band ('S'|'X'|'Ka'), laser? }
 * @param {number} distKm distancia a la estación terrena
 * @param {number} ground factor de la antena terrena (1 = DSN 34 m; TDRS ≈ 0,02)
 */
export function downlinkBps(c, distKm, ground = 1) {
  if (c.laser) return Math.min(LASER_MAX_BPS, (LASER_K * c.tx) / (distKm * distKm));
  const band = BANDS[c.band] ?? 1;
  return Math.min(RF_MAX_BPS, (RF_K * band * c.tx * c.dish * c.dish * ground) / (distKm * distKm));
}

/** Distancia media Tierra–órbita objetivo (UA), promediando todas las posiciones relativas. */
export function meanEarthDistanceAU(orbit, n = 48) {
  if (!orbit) return 1;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const p = orbitPoint(orbit, (i / n) * Math.PI * 2);
    for (let j = 0; j < n; j++) {
      const t = (j / n) * Math.PI * 2;
      sum += Math.hypot(p.x - Math.cos(t), p.y - Math.sin(t), p.z);
    }
  }
  return sum / (n * n);
}
