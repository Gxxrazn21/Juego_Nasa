// Creación de personaje: trajes reales (modelos 3D de NASA 3D Resources), roles y agencias.

export const SUITS = [
  { id: 'emu', name: 'EMU', era: '1981 – hoy', ref: 'Traje de caminata espacial de la ISS y el transbordador', model: 'emu', height: 1.9 },
  { id: 'z2', name: 'Z-2', era: 'Prototipo 2016', ref: 'Prototipo de traje de exploración planetaria con entrada trasera', model: 'z2', height: 1.9 },
  { id: 'aces', name: 'ACES', era: '1994 – 2011', ref: 'Traje naranja de lanzamiento y reentrada del transbordador', model: 'aces', height: 1.85 },
  { id: 'mark3', name: 'Mark III', era: 'Prototipo 1988', ref: 'Traje rígido de alta presión para superficies planetarias', model: 'mark3', height: 1.95 },
  { id: 'gemini', name: 'Gemini G4C', era: '1965 – 1966', ref: 'Primer traje estadounidense para caminatas espaciales', model: 'gemini', height: 1.85 },
  { id: 'mercury', name: 'Mercury', era: '1961 – 1963', ref: 'Traje plateado de los primeros astronautas de la NASA', model: 'mercury', height: 1.85 },
];

export const ROLES = [
  { id: 'comandante', name: 'Comandante', perk: '+2 % de fiabilidad en maniobras y acoplamientos', stripe: '#c8242b' },
  { id: 'piloto', name: 'Piloto', perk: '−5 % de Δv en inserciones gracias a encendidos precisos', stripe: '#2f63c8' },
  { id: 'ingeniero', name: 'Ingeniería de vuelo', perk: '−40 % de probabilidad de fallas de motor', stripe: '#d4a23c' },
  { id: 'cientifico', name: 'Ciencia', perk: '+25 % de retorno científico', stripe: '#3f9a5c' },
  { id: 'medico', name: 'Medicina', perk: '−20 % de efecto de la radiación en la salud', stripe: '#e9e6df' },
];

export const AGENCIES = ['NASA', 'ESA', 'JAXA', 'CSA', 'ISRO', 'AEM (México)', 'CONAE (Argentina)', 'AEB (Brasil)', 'Comercial'];

export const SUIT_COLORS = [
  { id: 'original', name: 'Colores originales de la NASA', hex: null, css: 'conic-gradient(#f1efe9 0 50%, #e8762f 0 75%, #4c74c9 0)' },
  { id: 'white', name: 'Blanco', hex: '#f1efe9' },
  { id: 'orange', name: 'Naranja', hex: '#e8762f' },
  { id: 'blue', name: 'Azul', hex: '#4c74c9' },
  { id: 'lunar', name: 'Gris lunar', hex: '#9fa3a8' },
  { id: 'sand', name: 'Arena marciana', hex: '#c99a6b' },
];

export const DEFAULT_NAMES = ['Ana Rivera', 'Kenji Sato', 'Amara Okafor', 'Lucía Ferreyra', 'Mateo Silva', 'Ingrid Holm', 'Ravi Menon'];
