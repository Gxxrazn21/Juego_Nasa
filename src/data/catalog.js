// Catálogo de piezas, lanzadores, destinos y programas.
// Los valores físicos de lanzadores y destinos son aproximaciones de datos
// públicos; los valores "científicos" son de balance de juego, inspirados en
// misiones reales (MRO, LRO, OSIRIS-REx, Juno…).

export const PROGRAMS = [
  { id: 'smallsat', name: 'SIMPLEx', budget: 80, blurb: 'Misión pequeña de bajo costo. Ideal para CubeSats y SmallSats.' },
  { id: 'discovery', name: 'Discovery', budget: 600, blurb: 'Misión enfocada, un objetivo científico claro.' },
  { id: 'newfrontiers', name: 'New Frontiers', budget: 1100, blurb: 'Misión de clase media a destinos exigentes.' },
  { id: 'flagship', name: 'Flagship', budget: 3500, blurb: 'Misión insignia: grande, compleja y cara.' },
];

// launchTarget: a qué entrega el lanzador. scDv: Δv que debe aportar la nave (km/s).
export const DESTINATIONS = [
  {
    id: 'leo', name: 'Órbita baja terrestre', short: 'LEO', frame: 'earth', sci: 'earth',
    launchTarget: 'LEO', scDv: 0.15, sunAU: 1, maxEarthKm: 2500, contactH: 1.2, radiation: 0.25,
    transferDays: 0.1, blurb: 'Observación de la Tierra a 300–800 km. Barato de alcanzar; pocas horas de contacto con estaciones.',
  },
  {
    id: 'geo', name: 'Órbita geoestacionaria', short: 'GEO', frame: 'earth', sci: 'earth',
    launchTarget: 'GTO', scDv: 1.85, sunAU: 1, maxEarthKm: 42000, contactH: 24, radiation: 0.6,
    transferDays: 7, blurb: 'A 35 786 km la nave gira con la Tierra: contacto continuo, pero dentro de los cinturones de radiación.',
  },
  {
    id: 'moon', name: 'Órbita lunar', short: 'Luna', frame: 'earth', sci: 'moon',
    launchTarget: 'TLI', scDv: 0.9, sunAU: 1, maxEarthKm: 406000, contactH: 10, radiation: 0.8,
    transferDays: 5, blurb: 'Inyección translunar + frenado en órbita lunar (LOI). Sin magnetosfera que proteja.',
  },
  {
    id: 'mars', name: 'Órbita de Marte', short: 'Marte', frame: 'sun', sci: 'mars',
    launchTarget: 'ESC', c3: 12, scDv: 1.0, sunAU: 1.67, maxEarthKm: 4.0e8, contactH: 8, radiation: 1.0,
    transferDays: 210, orbit: { a: 1.5237, e: 0.0934, i: 1.85, node: 49.56, peri: 286.5 },
    blurb: 'Transferencia de ~7 meses (C3 ≈ 12 km²/s²). Inserción en órbita con aerofrenado.',
  },
  {
    id: 'neo', name: 'Asteroide cercano', short: 'NEO', frame: 'sun', sci: 'neo',
    launchTarget: 'ESC', computed: true, contactH: 8, radiation: 1.0,
    blurb: 'Elige un asteroide real del catálogo NeoWs de la NASA. Su órbita define el Δv y la duración.',
  },
];

// Capacidades aproximadas en kg (datos públicos de fabricantes / NASA LSP).
// esc = capacidad a C3 = 0; c3max = C3 donde la capacidad llega a 0 (modelo lineal educativo).
export const LAUNCHERS = [
  { id: 'electron', name: 'Electron', maker: 'Rocket Lab', cost: 7.5, reliability: 0.93, leo: 300, gto: 0, tli: 30, esc: 0, c3max: 1, height: 18 },
  { id: 'falcon9', name: 'Falcon 9', maker: 'SpaceX', cost: 70, reliability: 0.99, leo: 17500, gto: 5500, tli: 3500, esc: 4000, c3max: 30, height: 70 },
  { id: 'atlas551', name: 'Atlas V 551', maker: 'ULA', cost: 160, reliability: 0.99, leo: 18850, gto: 8900, tli: 7000, esc: 6500, c3max: 50, height: 62 },
  { id: 'falconheavy', name: 'Falcon Heavy', maker: 'SpaceX', cost: 150, reliability: 0.97, leo: 63800, gto: 26700, tli: 20000, esc: 22000, c3max: 90, height: 70 },
  { id: 'sls', name: 'SLS Block 1', maker: 'NASA', cost: 2000, reliability: 0.95, leo: 95000, gto: 0, tli: 27000, esc: 27000, c3max: 100, height: 98 },
];

export const BUSES = [
  { id: 'cubesat', name: 'CubeSat 12U', dry: 10, slots: 1, instrMass: 6, avionicsW: 12, cost: 3, tankMax: 4, opsPerYear: 1.5, size: 0.35, maxRtg: 0 },
  { id: 'small', name: 'SmallSat (ESPA)', dry: 70, slots: 2, instrMass: 60, avionicsW: 45, cost: 25, tankMax: 150, opsPerYear: 6, size: 0.8, maxRtg: 0 },
  { id: 'medium', name: 'Bus mediano', dry: 450, slots: 4, instrMass: 220, avionicsW: 140, cost: 120, tankMax: 1800, opsPerYear: 25, size: 1.4, maxRtg: 2 },
  { id: 'large', name: 'Bus grande', dry: 1600, slots: 7, instrMass: 700, avionicsW: 320, cost: 450, tankMax: 7000, opsPerYear: 60, size: 2.2, maxRtg: 3 },
];

// value: puntos científicos por tipo de destino (earth, moon, mars, neo)
export const INSTRUMENTS = [
  { id: 'cam', name: 'Cámara multiespectral', mass: 12, power: 25, data: 40, cost: 18, value: { earth: 9, moon: 6, mars: 7, neo: 7 }, shape: 'lens' },
  { id: 'irs', name: 'Espectrómetro infrarrojo', mass: 20, power: 30, data: 15, cost: 30, value: { earth: 7, moon: 8, mars: 9, neo: 9 }, shape: 'box' },
  { id: 'radar', name: 'Radar de penetración', mass: 35, power: 120, data: 30, cost: 45, value: { earth: 6, moon: 8, mars: 9, neo: 6 }, shape: 'boom' },
  { id: 'lidar', name: 'Altímetro láser', mass: 15, power: 35, data: 2, cost: 22, value: { earth: 5, moon: 8, mars: 7, neo: 8 }, shape: 'lens' },
  { id: 'mag', name: 'Magnetómetro', mass: 4, power: 6, data: 0.3, cost: 6, value: { earth: 6, moon: 5, mars: 7, neo: 4 }, shape: 'boom' },
  { id: 'grs', name: 'Espectrómetro gamma/neutrones', mass: 25, power: 20, data: 1, cost: 28, value: { earth: 2, moon: 9, mars: 8, neo: 8 }, shape: 'box' },
  { id: 'rad', name: 'Detector de radiación', mass: 6, power: 8, data: 0.5, cost: 8, value: { earth: 5, moon: 6, mars: 6, neo: 4 }, shape: 'box' },
  { id: 'sample', name: 'Brazo de toma de muestras', mass: 40, power: 50, data: 0.5, cost: 80, value: { earth: 0, moon: 6, mars: 4, neo: 10 }, shape: 'arm' },
];

export const ANTENNAS = [
  { id: 'patch', name: 'Parche 0,3 m', diameter: 0.3, mass: 1, cost: 1 },
  { id: 'hga1', name: 'Alta ganancia 1 m', diameter: 1, mass: 8, cost: 6 },
  { id: 'hga2', name: 'Alta ganancia 2 m', diameter: 2, mass: 18, cost: 12 },
  { id: 'hga3', name: 'Alta ganancia 3 m', diameter: 3, mass: 35, cost: 20 },
];

export const TRANSMITTERS = [
  { id: 5, name: '5 W', power: 5, mass: 2, cost: 1 },
  { id: 20, name: '20 W', power: 20, mass: 4, cost: 3 },
  { id: 50, name: '50 W', power: 50, mass: 7, cost: 5 },
  { id: 100, name: '100 W', power: 100, mass: 10, cost: 8 },
];

export const ENGINES = [
  { id: 'mono', name: 'Monopropelente (hidracina)', isp: 225, mass: 5, cost: 3, power: 0, timeFactor: 1 },
  { id: 'biprop', name: 'Bipropelente', isp: 320, mass: 25, cost: 12, power: 0, timeFactor: 1 },
  { id: 'ion', name: 'Eléctrica iónica (tipo NEXT-C)', isp: 4100, mass: 60, cost: 40, power: 7000, timeFactor: 1.6 },
];

export const SHIELDING = [
  { id: 'none', name: 'Sin blindaje', massFrac: 0, cost: 0, reduce: 0 },
  { id: 'light', name: 'Blindaje ligero', massFrac: 0.03, cost: 2, reduce: 0.35 },
  { id: 'vault', name: 'Bóveda de titanio (tipo Juno)', massFrac: 0.08, cost: 10, reduce: 0.7 },
];

export const SOLAR = { kgPerM2: 3.5, costPerM2: 0.6, efficiency: 0.29, degradation: 0.85, maxArea: 80 };
export const RTG = { name: 'MMRTG', mass: 45, power: 110, cost: 110 };

// Asteroides reales de respaldo (elementos orbitales públicos, JPL SBDB).
export const FALLBACK_NEOS = [
  { id: '2101955', name: '101955 Bennu', a: 1.126, e: 0.204, i: 6.03, node: 2.06, peri: 66.2, diameterM: 490, hazardous: true },
  { id: '2162173', name: '162173 Ryugu', a: 1.19, e: 0.191, i: 5.87, node: 251.3, peri: 211.6, diameterM: 900, hazardous: false },
  { id: '2065803', name: '65803 Didymos', a: 1.643, e: 0.384, i: 3.41, node: 72.98, peri: 319.6, diameterM: 780, hazardous: true },
  { id: '2099942', name: '99942 Apophis', a: 0.922, e: 0.191, i: 3.34, node: 203.9, peri: 126.6, diameterM: 340, hazardous: true },
  { id: '2000433', name: '433 Eros', a: 1.458, e: 0.223, i: 10.83, node: 304.3, peri: 178.9, diameterM: 16840, hazardous: false },
  { id: '2025143', name: '25143 Itokawa', a: 1.324, e: 0.280, i: 1.62, node: 69.1, peri: 162.8, diameterM: 330, hazardous: false },
];
