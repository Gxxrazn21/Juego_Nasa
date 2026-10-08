// Piezas de la nave por ranura, inspiradas en hardware real.
// mass en kg, power en W (consumo, o generación si es fuente), cost en millones de US$.

export const PROPELLANTS = {
  hipergolico: { name: 'Hipergólico (MMH/NTO)', density: 1200, tankFrac: 0.06, boiloff: 0 },
  metalox: { name: 'Metalox (CH₄/LOX)', density: 830, tankFrac: 0.07, boiloff: 0.0001 },
  hidrolox: { name: 'Hidrolox (LH₂/LOX)', density: 360, tankFrac: 0.12, boiloff: 0.0005 },
  lh2: { name: 'Hidrógeno líquido', density: 71, tankFrac: 0.16, boiloff: 0.0007 },
  xenon: { name: 'Xenón', density: 1600, tankFrac: 0.1, boiloff: 0 },
};

export const SLOTS = [
  { id: 'capsule', name: 'Cápsula' },
  { id: 'habitat', name: 'Hábitat' },
  { id: 'engine', name: 'Motor' },
  { id: 'tanks', name: 'Tanques' },
  { id: 'power', name: 'Energía' },
  { id: 'life', name: 'Soporte vital' },
  { id: 'shield', name: 'Escudo térmico' },
  { id: 'docking', name: 'Acoplamiento' },
  { id: 'legs', name: 'Aterrizaje' },
  { id: 'science', name: 'Ciencia' },
  { id: 'paint', name: 'Pintura' },
  { id: 'insignia', name: 'Insignia' },
];

export const PARTS = {
  capsule: [
    { id: 'soyuz', name: 'Cápsula tipo Soyuz', ref: 'Soyuz MS (Roscosmos), desde 1967', seats: 3, mass: 4300, volume: 8.5, storage: 300, slots: 1, cost: 60, radius: 1.1 },
    { id: 'dragon', name: 'Cápsula tipo Crew Dragon', ref: 'Crew Dragon (SpaceX), desde 2020', seats: 4, mass: 7000, volume: 9.3, storage: 600, slots: 2, cost: 140, radius: 1.85 },
    { id: 'orion', name: 'Cápsula tipo Orion', ref: 'Orion (NASA/Lockheed Martin), Artemis', seats: 4, mass: 8500, volume: 9, storage: 900, slots: 2, cost: 600, radius: 2.5 },
  ],
  habitat: [
    { id: 'none', name: 'Sin hábitat', ref: 'Solo la cápsula', mass: 0, volume: 0, storage: 0, slots: 0, cost: 0 },
    { id: 'beam', name: 'Módulo inflable pequeño', ref: 'Tipo BEAM, acoplado a la ISS en 2016', mass: 1400, volume: 16, storage: 400, slots: 1, cost: 25 },
    { id: 'halo', name: 'Módulo rígido', ref: 'Tipo HALO del Gateway lunar', mass: 10000, volume: 60, storage: 3000, slots: 3, cost: 450 },
    { id: 'b330', name: 'Hábitat inflable grande', ref: 'Tipo B330 / Deep Space Habitat', mass: 20000, volume: 330, storage: 9000, slots: 5, cost: 700 },
  ],
  engine: [
    { id: 'aj10', name: 'AJ10', ref: 'Motor del módulo de servicio de Orion y del transbordador', prop: 'hipergolico', isp: 316, thrust: 26.7, mass: 120, cost: 15, power: 0, reliability: 0.995, timeFactor: 1 },
    { id: 'rl10', name: 'RL10B-2', ref: 'Etapas superiores Delta IV y SLS', prop: 'hidrolox', isp: 465, thrust: 110, mass: 300, cost: 25, power: 0, reliability: 0.995, timeFactor: 1 },
    { id: 'rvac', name: 'Raptor Vacuum', ref: 'Etapa superior de Starship', prop: 'metalox', isp: 380, thrust: 2500, mass: 1600, cost: 8, power: 0, reliability: 0.98, timeFactor: 1 },
    { id: 'hall', name: 'Propulsión eléctrica Hall ×4', ref: 'Propulsores AEPS del Gateway', prop: 'xenon', isp: 2800, thrust: 0.0024, mass: 900, cost: 120, power: 50000, reliability: 0.99, timeFactor: 2.2 },
    { id: 'ntr', name: 'Nuclear térmico', ref: 'Programa DRACO (NASA/DARPA), heredero de NERVA', prop: 'lh2', isp: 900, thrust: 111, mass: 3500, cost: 900, power: 0, reliability: 0.96, timeFactor: 1 },
  ],
  tanks: [
    { id: 's', name: 'Tanque pequeño', ref: 'Similar a un tanque de módulo de servicio de Dragon', capacity: 3000, cost: 10 },
    { id: 'm', name: 'Tanque mediano', ref: 'Similar al Módulo de Servicio Europeo de Orion (8,6 t)', capacity: 9000, cost: 40 },
    { id: 'l', name: 'Etapa de crucero', ref: 'Similar a una etapa superior criogénica', capacity: 30000, cost: 90 },
    { id: 'xl', name: 'Etapa de transferencia pesada', ref: 'Arquitecturas de Marte (DRA 5.0)', capacity: 90000, cost: 200 },
  ],
  power: [
    { id: 'ultraflex', name: 'Abanicos UltraFlex', ref: 'Cygnus, InSight y Lucy', output: 7000, solar: true, mass: 250, cost: 25 },
    { id: 'xwing', name: 'Alas en X', ref: 'Módulo de Servicio Europeo de Orion (11 kW)', output: 11000, solar: true, mass: 400, cost: 30 },
    { id: 'rosa', name: 'Paneles enrollables ROSA', ref: 'iROSA de la ISS y Gateway', output: 30000, solar: true, mass: 900, cost: 70 },
    { id: 'kilopower', name: 'Reactores Kilopower ×4', ref: 'Fission Surface Power (NASA), 10 kW cada uno', output: 40000, solar: false, mass: 6000, cost: 500 },
  ],
  life: [
    { id: 'open', name: 'Circuito abierto', ref: 'Apolo y Soyuz: todo se lleva y se gasta', rate: 6.0, mass: 300, power: 400, cost: 20 },
    { id: 'eclss', name: 'Regenerativo ECLSS', ref: 'ISS: recicla ~98 % del agua y genera O₂', rate: 2.3, mass: 1600, power: 2500, cost: 250 },
    { id: 'bio', name: 'Bioregenerativo con invernadero', ref: 'Experimental: Veggie/APH de la ISS a escala', rate: 1.1, mass: 5500, power: 9000, cost: 600 },
  ],
  shield: [
    { id: 'none', name: 'Sin escudo térmico', ref: 'La tripulación no puede volver a la Tierra', maxEntry: 0, mass: 0, cost: 0 },
    { id: 'ablative', name: 'Ablativo básico', ref: 'Tipo Soyuz', maxEntry: 8.0, mass: 500, cost: 10 },
    { id: 'avcoat', name: 'Avcoat', ref: 'Apolo y Orion, regreso lunar', maxEntry: 11.5, mass: 1400, cost: 60 },
    { id: 'pica', name: 'PICA-X', ref: 'Dragon; diseñado para velocidades de regreso de Marte', maxEntry: 13.0, mass: 900, cost: 90 },
  ],
  docking: [
    { id: 'none', name: 'Sin puerto', ref: 'No podrás visitar estaciones', mass: 0, cost: 0 },
    { id: 'idss', name: 'Puerto IDSS', ref: 'Estándar internacional (NASA Docking System)', mass: 340, cost: 25 },
    { id: 'arm', name: 'IDSS + brazo robótico', ref: 'Tipo Canadarm: permite reparaciones externas', mass: 900, cost: 80, repairs: true },
  ],
  legs: [
    { id: 'none', name: 'Sin tren de aterrizaje', ref: 'Solo misiones en órbita', mass: 0, cost: 0 },
    { id: 'lunar', name: 'Tren de aterrizaje lunar', ref: 'Tipo Módulo Lunar del Apolo', mass: 1200, cost: 40 },
  ],
};

export const PAINTS = [
  { id: 'white', name: 'Blanco NASA', hex: '#e9e6df' },
  { id: 'steel', name: 'Acero', hex: '#a7abb2' },
  { id: 'carbon', name: 'Carbono', hex: '#2b2d33' },
  { id: 'foam', name: 'Espuma aislante', hex: '#c8692c' },
  { id: 'navy', name: 'Azul profundo', hex: '#2c3e66' },
];

export const LIVERIES = [
  { id: 'liso', name: 'Liso' },
  { id: 'bandas', name: 'Bandas' },
  { id: 'ajedrez', name: 'Ajedrez Saturno V' },
  { id: 'bicolor', name: 'Bicolor' },
  { id: 'carreras', name: 'Franjas' },
];

export const FINISH_LIST = [
  { id: 'satinado', name: 'Satinado' },
  { id: 'mate', name: 'Mate' },
  { id: 'metalico', name: 'Metalizado' },
];

export const MLI_LIST = [
  { id: 'oro', name: 'Kapton dorado', hex: '#d9a441' },
  { id: 'plata', name: 'Aluminizado plata', hex: '#c9ccd2' },
  { id: 'negro', name: 'Kapton negro', hex: '#1d1d22' },
];

export const ACCENTS = [
  { id: 'orange', name: 'Naranja internacional', hex: '#f26a2e' },
  { id: 'red', name: 'Rojo', hex: '#c8242b' },
  { id: 'blue', name: 'Azul', hex: '#2f63c8' },
  { id: 'gold', name: 'Oro', hex: '#d4a23c' },
  { id: 'black', name: 'Negro', hex: '#1a1b20' },
];
