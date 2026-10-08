// Retos con medallas. Cada reto fija la misión y pide tres objetivos de ingeniería:
// bronce (cumplir la misión), plata y oro (hacerlo mejor). Algunos dependen de datos
// reales de la NASA del día (clima espacial de DONKI, asteroides de NeoWs).
//
// goal.check(r, ev) → ¿se cumplió en el vuelo?   goal.plan(ev) → ¿el diseño apunta a cumplirlo? (null = se sabe al volar)
import { usable, CAREER_DOSE } from '../mission.js';

export const MEDALS = [
  { id: 'bronce', name: 'Bronce', color: '#b0703a' },
  { id: 'plata', name: 'Plata', color: '#a9b1bb' },
  { id: 'oro', name: 'Oro', color: '#e0b43c' },
];

const home = (r) => r.ok && r.reached;
const mSv = (n) => `${n} mSv`;
const docks = (ev) => ev.steps.some((s) => s.type === 'dock');
const regolith = (ev) => ev.instruments.some((i) => i.needsSurface && usable(i, ev));

export const CHALLENGES = [
  {
    id: 'iss',
    title: 'Primera expedición',
    brief: 'Lleva una tripulación a la ISS y tráela de vuelta con el presupuesto de una empresa privada.',
    fact: 'Desde 2020 la NASA compra los viajes a la ISS a empresas (Commercial Crew): cada asiento cuesta unos US$ 70–90 M.',
    setup: { destination: 'iss', program: 'comercial', land: false },
    goals: [
      { medal: 'bronce', label: 'Completar la expedición y volver', check: home },
      { medal: 'plata', label: 'Costo total ≤ US$ 600 M', check: (r, ev) => ev.cost <= 600, plan: (ev) => ev.cost <= 600 },
      { medal: 'oro', label: 'Ciencia ≥ 25 puntos', check: (r) => r.science >= 25 },
    ],
  },
  {
    id: 'apollo',
    title: 'Como el Apolo',
    brief: 'Ve a la órbita lunar y vuelve sin escalas en ninguna estación: todo lo que necesitas sale de la Tierra.',
    fact: 'El Apolo llevó todo su propelente desde el despegue: el Saturno V pesaba 2 900 t para devolver una cápsula de 5,5 t.',
    setup: { destination: 'moon', program: 'artemis', land: false, stops: [] },
    goals: [
      { medal: 'bronce', label: 'Ir y volver sin acoplarse a estaciones', check: (r, ev) => home(r) && !docks(ev), plan: (ev) => !docks(ev) },
      { medal: 'plata', label: 'Costo total ≤ US$ 1 500 M', check: (r, ev) => ev.cost <= 1500, plan: (ev) => ev.cost <= 1500 },
      { medal: 'oro', label: 'Puntuación ≥ 150', check: (r) => r.score >= 150 },
    ],
  },
  {
    id: 'storm',
    title: 'Clima espacial real',
    brief: 'Una misión lunar con el Sol de hoy: la tormenta del vuelo es el evento más fuerte que la NASA (DONKI) registró este mes.',
    fact: 'La NASA vigila el Sol las 24 horas desde la oficina de análisis de radiación espacial (SRAG) para avisar a los astronautas.',
    live: 'weather',
    setup: { destination: 'moon', program: 'artemis' },
    goals: [
      { medal: 'bronce', label: 'Volver con la tripulación', check: home },
      { medal: 'plata', label: `Dosis ≤ ${mSv(60)} por persona`, check: (r) => home(r) && r.dose <= 60, plan: (ev) => ev.dose <= 60 },
      { medal: 'oro', label: `Dosis ≤ ${mSv(40)} por persona`, check: (r) => home(r) && r.dose <= 40, plan: (ev) => ev.dose <= 40 },
    ],
  },
  {
    id: 'moonland',
    title: 'Volver a pisar la Luna',
    brief: 'Aluniza, toma muestras del suelo y regresa. Artemis III llevará a la primera mujer a la superficie lunar.',
    fact: 'Las misiones Apolo trajeron 382 kg de rocas lunares; todavía se estudian en el Centro Espacial Johnson.',
    setup: { destination: 'moon', program: 'artemis', land: true },
    goals: [
      { medal: 'bronce', label: 'Alunizar y volver', check: (r) => home(r) && r.landed, plan: (ev) => ev.landing },
      { medal: 'plata', label: 'Traer muestras del suelo (taladro)', check: (r, ev) => home(r) && r.landed && regolith(ev), plan: regolith },
      { medal: 'oro', label: 'Costo total ≤ US$ 2 500 M', check: (r, ev) => ev.cost <= 2500, plan: (ev) => ev.cost <= 2500 },
    ],
  },
  {
    id: 'asteroid',
    title: 'Cazador de asteroides',
    brief: 'Visita un asteroide real del catálogo NeoWs y trae una muestra, como OSIRIS-REx con Bennu.',
    fact: 'OSIRIS-REx trajo 121,6 g de Bennu en 2023: la muestra de asteroide más grande de la historia.',
    live: 'neos',
    setup: { destination: 'neo', program: 'horizonte' },
    goals: [
      { medal: 'bronce', label: 'Llegar al asteroide y volver', check: home },
      { medal: 'plata', label: 'Traer una muestra (taladro + brazo robótico)', check: (r, ev) => home(r) && regolith(ev), plan: regolith },
      { medal: 'oro', label: 'Costo total ≤ US$ 3 500 M', check: (r, ev) => ev.cost <= 3500, plan: (ev) => ev.cost <= 3500 },
    ],
  },
  {
    id: 'mars',
    title: 'Ciencia desde Marte',
    brief: 'Órbita de Marte durante 30 días. La ciencia solo cuenta si llega a la Tierra por la Red de Espacio Profundo.',
    fact: 'Mars Reconnaissance Orbiter ha enviado más datos que todas las otras misiones a Marte juntas, gracias a su antena de 3 m.',
    setup: { destination: 'mars', program: 'horizonte' },
    goals: [
      { medal: 'bronce', label: 'Volver con la tripulación', check: home },
      { medal: 'plata', label: 'Recibir ≥ 90 % de los datos científicos', check: (r) => home(r) && r.dataFraction >= 0.9, plan: (ev) => ev.comms.fraction >= 0.9 },
      { medal: 'oro', label: `Dosis ≤ ${mSv(380)} (límite de carrera ${CAREER_DOSE})`, check: (r) => home(r) && r.dose <= 380, plan: (ev) => ev.dose <= 380 },
    ],
  },
];

/** Medalla ganada: la más alta cuyo objetivo y todos los anteriores se cumplieron. */
export function medalFor(challenge, result, ev) {
  if (!matches(challenge, ev)) return null;
  let medal = null;
  for (const g of challenge.goals) {
    if (!g.check(result, ev)) break;
    medal = g.medal;
  }
  return medal;
}

/** ¿La misión diseñada es la que pide el reto? (destino, programa y alunizaje si se exige) */
export function matches(challenge, ev) {
  const { destination, program, land } = challenge.setup;
  return ev.dest.id === destination && ev.program.id === program && (!land || ev.landing);
}

export const medalRank = (m) => MEDALS.findIndex((x) => x.id === m);
