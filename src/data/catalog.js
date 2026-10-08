// Programas, destinos, lanzadores, estaciones y carga científica.
// Valores físicos: aproximaciones de datos públicos (NASA, fabricantes).
// Puntos científicos y precios de provisiones: balance de juego.

export const PROGRAMS = [
  { id: 'comercial', name: 'Comercial LEO', budget: 1200, blurb: 'Visitas a la órbita baja: turismo, investigación en la ISS.' },
  { id: 'artemis', name: 'Artemis', budget: 9000, blurb: 'Regreso a la Luna con tripulación.' },
  { id: 'horizonte', name: 'Horizonte Marte', budget: 40000, blurb: 'Viajes largos al espacio profundo.' },
  { id: 'libre', name: 'Modo libre', budget: 1e6, blurb: 'Sin límite de presupuesto: experimenta.' },
];

// Δv en km/s medidos desde una órbita de estacionamiento LEO de ~300 km.
export const DESTINATIONS = [
  {
    id: 'iss', name: 'Visita a la ISS', short: 'ISS', frame: 'earth', sci: 'iss', sunAU: 1,
    stay: 10, reentry: 7.8, explore: 10, canLand: false,
    link: { network: 'TDRS', distKm: 40000, ground: 0.02, contactH: 20 },
    blurb: 'Encuentro y acoplamiento con la Estación Espacial Internacional a 420 km. La misión de entrenamiento perfecta.',
  },
  {
    id: 'moon', name: 'La Luna', short: 'Luna', frame: 'earth', sci: 'moon', sunAU: 1,
    stay: 6, reentry: 11.0, explore: 35, canLand: true,
    link: { network: 'DSN', distKm: 384400, ground: 1, contactH: 12 },
    blurb: 'Inyección translunar de 3,15 km/s, 3 días de viaje. Puedes quedarte en órbita o alunizar.',
  },
  {
    id: 'mars', name: 'Órbita de Marte', short: 'Marte', frame: 'sun', sci: 'mars', sunAU: 1.67,
    stay: 30, reentry: 12.5, explore: 130, canLand: false,
    link: { network: 'DSN', ground: 1, contactH: 8 },
    orbit: { a: 1.5237, e: 0.0934, i: 1.85, node: 49.56, peri: 286.5 },
    blurb: 'Misión de oposición: ~210 días de ida, 30 en Marte y ~250 de vuelta. Comida, agua y radiación son el reto.',
  },
  {
    id: 'neo', name: 'Asteroide cercano', short: 'NEO', frame: 'sun', sci: 'neo', computed: true,
    stay: 30, explore: 80, canLand: false,
    link: { network: 'DSN', ground: 1, contactH: 8 },
    blurb: 'Elige un asteroide real del catálogo NeoWs de la NASA. Su órbita define el Δv y la duración.',
  },
];

// Capacidad en kg a LEO y a escape/translunar (esc, inyección directa por la etapa superior).
// crewRated: certificado para llevar personas.
export const LAUNCHERS = [
  { id: 'falcon9', name: 'Falcon 9', maker: 'SpaceX', cost: 70, reliability: 0.99, leo: 17500, esc: 4000, crewRated: true },
  { id: 'atlas', name: 'Atlas V N22', maker: 'ULA', cost: 160, reliability: 0.99, leo: 13000, esc: 0, crewRated: true },
  { id: 'newglenn', name: 'New Glenn', maker: 'Blue Origin', cost: 110, reliability: 0.95, leo: 45000, esc: 7000, crewRated: false },
  { id: 'falconheavy', name: 'Falcon Heavy', maker: 'SpaceX', cost: 150, reliability: 0.97, leo: 63800, esc: 16800, crewRated: false },
  { id: 'sls', name: 'SLS Block 1', maker: 'NASA', cost: 2000, reliability: 0.96, leo: 95000, esc: 27000, crewRated: true },
  { id: 'starship', name: 'Starship', maker: 'SpaceX', cost: 250, reliability: 0.9, leo: 120000, esc: 0, crewRated: false },
];

// Estaciones donde la tripulación recoge provisiones.
// stock en kg; price en millones de US$ por kg entregado.
export const STATIONS = [
  {
    id: 'iss', name: 'Estación Espacial Internacional', short: 'ISS', where: 'leo', dv: 0.2, days: 2,
    model: 'iss', price: 0.03,
    stock: { consumables: 2500, hipergolico: 1500, xenon: 300 },
    blurb: '420 km, 51,6° de inclinación. Recibe carga de Dragon, Cygnus y Progress: víveres, agua, oxígeno e hipergólicos.',
  },
  {
    id: 'depot', name: 'Depósito orbital de propelente', short: 'Depósito', where: 'leo', dv: 0.15, days: 1,
    model: 'depot', price: 0.008, concept: true,
    stock: { consumables: 0, metalox: 120000, hidrolox: 60000, lh2: 60000 },
    blurb: 'Concepto estudiado por la NASA: tanques en órbita que se llenan con varios lanzamientos para repostar naves de espacio profundo.',
  },
  {
    id: 'gateway', name: 'Gateway lunar', short: 'Gateway', where: 'moon', dv: 0, days: 2,
    model: 'gateway', price: 0.06, planned: true,
    stock: { consumables: 1200, hipergolico: 2500, xenon: 600 },
    blurb: 'Estación en órbita de halo casi rectilínea (NRHO) alrededor de la Luna. Llegar cuesta solo 0,45 km/s en vez de 0,85.',
  },
];

// value: puntos científicos por destino (iss, moon, mars, neo)
// data: gigabits por día de operación. kind: 'datos' se envían por radio/láser;
// 'muestras' vuelven físicamente con la tripulación.
export const INSTRUMENTS = [
  { id: 'lab', name: 'Laboratorio de microgravedad', mass: 900, power: 1500, cost: 60, data: 2, kind: 'muestras', value: { iss: 9, moon: 4, mars: 5, neo: 4 } },
  { id: 'cam', name: 'Cámaras multiespectrales', mass: 60, power: 120, cost: 18, data: 40, kind: 'datos', value: { iss: 5, moon: 6, mars: 8, neo: 7 } },
  { id: 'irs', name: 'Espectrómetro infrarrojo', mass: 80, power: 150, cost: 30, data: 10, kind: 'datos', value: { iss: 4, moon: 8, mars: 9, neo: 9 } },
  { id: 'radar', name: 'Radar de penetración', mass: 150, power: 400, cost: 45, data: 25, kind: 'datos', value: { iss: 2, moon: 8, mars: 9, neo: 7 } },
  { id: 'rad', name: 'Dosímetros de radiación', mass: 20, power: 30, cost: 8, data: 0.2, kind: 'datos', value: { iss: 4, moon: 7, mars: 9, neo: 7 } },
  { id: 'drill', name: 'Taladro y cajas de muestras', mass: 250, power: 300, cost: 70, data: 0.5, kind: 'muestras', value: { iss: 0, moon: 9, mars: 6, neo: 10 }, needsSurface: true },
  { id: 'rover', name: 'Rover presurizado (tipo LTV)', mass: 3000, power: 800, cost: 250, data: 8, kind: 'datos', value: { iss: 0, moon: 10, mars: 0, neo: 0 }, needsLanding: true },
  { id: 'bio', name: 'Experimentos biológicos', mass: 120, power: 200, cost: 25, data: 1, kind: 'muestras', value: { iss: 8, moon: 5, mars: 8, neo: 4 } },
];

// Asteroides reales de respaldo (elementos orbitales públicos, JPL SBDB).
export const FALLBACK_NEOS = [
  { id: '2101955', name: '101955 Bennu', a: 1.126, e: 0.204, i: 6.03, node: 2.06, peri: 66.2, diameterM: 490, hazardous: true },
  { id: '2162173', name: '162173 Ryugu', a: 1.19, e: 0.191, i: 5.87, node: 251.3, peri: 211.6, diameterM: 900, hazardous: false },
  { id: '2065803', name: '65803 Didymos', a: 1.643, e: 0.384, i: 3.41, node: 72.98, peri: 319.6, diameterM: 780, hazardous: true },
  { id: '2099942', name: '99942 Apophis', a: 0.922, e: 0.191, i: 3.34, node: 203.9, peri: 126.6, diameterM: 340, hazardous: true,
    approach: { date: '2029-04-13', au: 0.000254, km: 38000, kms: 7.4 } }, // pasará más cerca que los satélites geoestacionarios
  { id: '2000433', name: '433 Eros', a: 1.458, e: 0.223, i: 10.83, node: 304.3, peri: 178.9, diameterM: 16840, hazardous: false },
  { id: '2025143', name: '25143 Itokawa', a: 1.324, e: 0.280, i: 1.62, node: 69.1, peri: 162.8, diameterM: 330, hazardous: false },
];
