// Modelo de la misión tripulada: masa, ruta con estaciones y provisiones,
// validaciones contra física y datos NASA, y simulación del vuelo.
import { PROGRAMS, DESTINATIONS, LAUNCHERS, STATIONS, INSTRUMENTS } from './data/catalog.js';
import { PARTS, PROPELLANTS, PAINTS, ACCENTS } from './data/parts.js';
import { ROLES, DEFAULT_NAMES } from './data/crew.js';
import { neoRendezvous, G0 } from './physics.js';

export const DESIGN_MARGIN = 0.10; // contingencia de masa seca
export const CREW_MASS = 100; // kg por persona con traje
export const CAREER_DOSE = 600; // mSv, límite de carrera NASA-STD-3001
export const AVIONICS_W = 1500;
export const LUNAR_G = 1.62;
const ESCAPE_DV = 3.2; // km/s de LEO a C3 = 0

const byId = (list, id) => list.find((x) => x.id === id);
export const part = (slot, id) => byId(PARTS[slot], id) ?? PARTS[slot][0];

export function defaultState() {
  return {
    program: 'artemis',
    destination: 'moon',
    land: false,
    neoId: null,
    crew: [
      { name: DEFAULT_NAMES[0], role: 'comandante' },
      { name: DEFAULT_NAMES[1], role: 'piloto' },
      { name: DEFAULT_NAMES[2], role: 'ingeniero' },
      { name: DEFAULT_NAMES[3], role: 'cientifico' },
    ],
    look: {
      suit: 'emu', suitColor: 'original', agency: 'NASA', patch: 'ARTEMIS',
      insignia: { shape: 'circulo', symbol: 'cohete', bg: '#14182a', upload: null },
    },
    ship: {
      capsule: 'orion', habitat: 'none', engine: 'aj10', tanks: 'm', power: 'xwing',
      life: 'open', shield: 'avcoat', docking: 'idss', legs: 'none', paint: 'white', accent: 'orange',
      livery: 'bandas', finish: 'satinado', mli: 'oro', name: 'Esperanza',
    },
    instruments: ['cam', 'rad'],
    propLoad: 9000,
    stops: ['gateway'],
    launcher: 'sls',
    launches: 1,
    direct: true,
  };
}

/** Destino resuelto (para NEO, con la órbita real del asteroide). */
export function resolveDestination(state, neos = []) {
  const base = byId(DESTINATIONS, state.destination) ?? DESTINATIONS[0];
  if (!base.computed) return base;
  const neo = neos.find((n) => n.id === state.neoId) || neos[0];
  const t = neo ? neoRendezvous(neo) : { departureFromLeo: 4.5, arrivalDv: 2, transferDays: 220, vinf: 3, aphelionAU: 1.4 };
  return {
    ...base,
    neo,
    name: neo ? neo.name : base.name,
    sunAU: t.aphelionAU,
    reentry: Math.sqrt(11.1 ** 2 + t.vinf ** 2),
    orbit: neo,
    transfer: t,
  };
}

/** Estaciones que esta misión puede visitar. */
export function availableStations(state) {
  if (state.destination === 'iss') return STATIONS.filter((s) => s.id === 'iss');
  const leoAllowed = !directInjection(state);
  return STATIONS.filter((s) => (s.where === 'leo' && leoAllowed) || (s.where === 'moon' && state.destination === 'moon'));
}

export function directInjection(state) {
  return state.direct && state.launches === 1 && state.destination !== 'iss';
}

/** Secuencia de etapas de la misión desde el despegue hasta la reentrada. */
export function buildRoute(state, dest, ship) {
  const steps = [];
  const direct = directInjection(state);
  const stops = new Set(state.stops);
  const slow = ship.engine.timeFactor;
  // Trayectorias rápidas (motor nuclear): menos días de viaje a cambio de ~12 % más Δv de salida y regreso
  const fast = slow < 1 ? 1.12 : 1;
  const pilot = state.crew.some((c) => c.role === 'piloto') ? 0.95 : 1;

  steps.push({ type: 'launch', name: direct ? 'Lanzamiento con inyección directa' : 'Lanzamiento a órbita baja', region: 'leo', days: 0.2 });

  if (dest.id === 'iss') {
    steps.push({ type: 'dock', station: 'iss', name: 'Acoplamiento con la ISS', dv: 0.2, days: 1, region: 'leo' });
    steps.push({ type: 'stay', name: 'Expedición a bordo de la ISS', days: dest.stay, region: 'leo' });
    steps.push({ type: 'burn', name: 'Encendido de desorbitado', dv: 0.1, days: 0.5, region: 'leo' });
    steps.push({ type: 'reentry', name: 'Reentrada atmosférica', speed: dest.reentry, region: 'leo' });
    return steps;
  }

  if (!direct) {
    for (const st of STATIONS.filter((s) => s.where === 'leo' && stops.has(s.id))) {
      steps.push({ type: 'dock', station: st.id, name: `Escala en ${st.short}: provisiones`, dv: st.dv, days: st.days, region: 'leo' });
    }
  }

  if (dest.id === 'moon') {
    const nrho = stops.has('gateway');
    steps.push({ type: 'burn', name: 'Inyección translunar (TLI)', dv: direct ? 0 : 3.15, days: 3 * slow, region: 'deep' });
    if (nrho) {
      steps.push({ type: 'burn', name: 'Inserción en órbita de halo (NRHO)', dv: 0.45 * pilot, days: 0.5, region: 'deep' });
      steps.push({ type: 'dock', station: 'gateway', name: 'Acoplamiento con Gateway: provisiones', dv: 0.02, days: 2, region: 'deep' });
    } else {
      steps.push({ type: 'burn', name: 'Inserción en órbita lunar baja', dv: 0.85 * pilot, days: 0.5, region: 'deep' });
    }
    if (state.land) {
      const dv = nrho ? 2.5 : 1.9;
      steps.push({ type: 'burn', name: 'Descenso a la superficie', dv: dv * pilot, days: 0.2, land: true, region: 'deep' });
      steps.push({ type: 'stay', name: 'Exploración de la superficie lunar', days: dest.stay, region: 'surface' });
      steps.push({ type: 'burn', name: 'Despegue lunar', dv, days: 0.2, region: 'deep' });
    } else {
      steps.push({ type: 'stay', name: 'Operaciones en órbita lunar', days: dest.stay, region: 'deep' });
    }
    steps.push({ type: 'burn', name: 'Inyección transterrestre (TEI)', dv: nrho ? 0.45 : 0.85, days: 3 * slow, region: 'deep' });
  } else if (dest.id === 'mars') {
    steps.push({ type: 'burn', name: 'Inyección trans-marciana (TMI)', dv: (direct ? 3.6 - ESCAPE_DV : 3.6) * fast, days: 210 * slow, region: 'deep' });
    steps.push({ type: 'burn', name: 'Inserción en órbita marciana (MOI)', dv: 2.1 * pilot, days: 0.5, region: 'deep' });
    steps.push({ type: 'stay', name: 'Operaciones en órbita de Marte', days: dest.stay, region: 'deep' });
    steps.push({ type: 'burn', name: 'Inyección de regreso (TEI)', dv: 2.1 * fast, days: 250 * slow, region: 'deep' });
  } else if (dest.id === 'neo') {
    const t = dest.transfer;
    const dep = direct ? Math.max(0.05, t.departureFromLeo - ESCAPE_DV) : t.departureFromLeo;
    steps.push({ type: 'burn', name: `Salida hacia ${dest.name}`, dv: dep * fast, days: t.transferDays * slow, region: 'deep' });
    steps.push({ type: 'burn', name: 'Encuentro con el asteroide', dv: t.arrivalDv * pilot, days: 0.5, region: 'deep' });
    steps.push({ type: 'stay', name: 'Exploración del asteroide', days: dest.stay, region: 'deep' });
    steps.push({ type: 'burn', name: 'Regreso a la Tierra', dv: t.arrivalDv * fast, days: t.transferDays * slow, region: 'deep' });
  }
  steps.push({ type: 'reentry', name: 'Reentrada atmosférica', speed: dest.reentry, region: 'leo' });
  return steps;
}

/** Recorre la ruta con Tsiolkovsky, consumo de víveres, evaporación y repostajes. */
export function flyRoute(steps, ctx) {
  const { dryMass, tankCapacity, storage, engine, propType, crewN, life, prop0, cons0 } = ctx;
  const pd = PROPELLANTS[propType];
  let prop = prop0;
  let cons = cons0;
  let days = 0;
  let resupplyCost = 0;
  let failure = null;
  let minProp = Infinity;
  let minCons = Infinity;
  const dailyUse = crewN * life.rate;
  const out = [];

  for (const step of steps) {
    const before = { prop, cons };
    let need = 0, refill = null;
    if (step.dv > 0) {
      const mass = dryMass + prop + cons;
      need = mass * (1 - Math.exp((-step.dv * 1000) / (engine.isp * G0)));
      if (need > prop + 1e-6 && !failure) failure = { step, reason: 'prop', short: need - prop, day: days };
      prop = Math.max(0, prop - need);
    }
    if (step.type === 'dock') {
      const st = STATIONS.find((s) => s.id === step.station);
      const stockProp = st.stock[propType] ?? 0;
      const addProp = Math.max(0, Math.min(tankCapacity - prop, stockProp));
      const addCons = Math.max(0, Math.min(storage - cons, st.stock.consumables));
      prop += addProp;
      cons += addCons;
      const cost = (addProp + addCons) * st.price;
      resupplyCost += cost;
      refill = { prop: addProp, cons: addCons, cost, station: st, incompatible: stockProp === 0 };
    }
    const d = step.days ?? 0;
    days += d;
    cons -= dailyUse * d;
    if (cons < 0 && !failure) failure = { step, reason: 'cons', short: -cons, day: days };
    cons = Math.max(0, cons);
    prop *= Math.pow(1 - pd.boiloff, d);
    minProp = Math.min(minProp, prop);
    minCons = Math.min(minCons, cons);
    out.push({ ...step, need, refill, before, after: { prop, cons }, day: days });
  }
  return { steps: out, failure, days, resupplyCost, finalProp: prop, finalCons: cons, minProp, minCons };
}

export function evaluate(state, nasa = {}) {
  const dest = resolveDestination(state, nasa.neos);
  const program = byId(PROGRAMS, state.program) ?? PROGRAMS[0];
  const lv = byId(LAUNCHERS, state.launcher) ?? LAUNCHERS[0];
  const ship = Object.fromEntries(Object.keys(PARTS).map((slot) => [slot, part(slot, state.ship[slot])]));
  const crewN = state.crew.length;
  const propType = ship.engine.prop;
  const pd = PROPELLANTS[propType];
  const sciSlots = ship.capsule.slots + ship.habitat.slots;
  const instruments = state.instruments.map((id) => byId(INSTRUMENTS, id)).filter(Boolean);
  const landing = state.land && dest.canLand;

  // --- Masa ---
  const tankCapacity = ship.tanks.capacity;
  const parts = {
    Cápsula: ship.capsule.mass,
    Hábitat: ship.habitat.mass,
    Motor: ship.engine.mass,
    Tanques: tankCapacity * pd.tankFrac,
    Energía: ship.power.mass,
    'Soporte vital': ship.life.mass + (ship.life.id === 'open' ? 50 * crewN : 0),
    'Escudo térmico': ship.shield.mass,
    Acoplamiento: ship.docking.mass,
    'Tren de aterrizaje': ship.legs.mass,
    Ciencia: instruments.reduce((a, i) => a + i.mass, 0),
    Tripulación: crewN * CREW_MASS,
  };
  const dryNoMargin = Object.values(parts).reduce((a, b) => a + b, 0);
  const dryMass = dryNoMargin * (1 + DESIGN_MARGIN);
  const storage = ship.capsule.storage + ship.habitat.storage;

  // --- Ruta y víveres ---
  const steps = buildRoute(state, dest, ship);
  const routeDays = steps.reduce((a, s) => a + (s.days ?? 0), 0);
  // Víveres al despegar: lo de la ruta + 10 % + 5 días de reserva (si caben)
  const consNeeded = crewN * ship.life.rate * (routeDays * 1.1 + 5);
  const cons0 = Math.min(storage, consNeeded);
  const prop0 = Math.min(state.propLoad, tankCapacity);
  const route = flyRoute(steps, { dryMass, tankCapacity, storage, engine: ship.engine, propType, crewN, life: ship.life, prop0, cons0 });
  const wetMass = dryMass + prop0 + cons0;
  const totalDv = steps.reduce((a, s) => a + (s.dv ?? 0), 0);

  // --- Lanzamiento ---
  const direct = directInjection(state);
  const capacity = direct ? lv.esc : lv.leo * state.launches;
  const crewLaunch = !lv.crewRated; // la tripulación sube aparte en un Falcon 9 + cápsula
  const needsDock = route.steps.some((s) => s.type === 'dock') || crewLaunch || state.launches > 1;

  // --- Energía (peor caso: punto más lejano del Sol) ---
  const gen = ship.power.solar ? ship.power.output / (dest.sunAU * dest.sunAU) : ship.power.output;
  const instrPower = instruments.reduce((a, i) => a + i.power, 0);
  const powerNeed = AVIONICS_W + ship.life.power + instrPower;
  const enginePower = ship.engine.power ? ship.engine.power + AVIONICS_W : 0;
  const genAt1AU = ship.power.output;

  // --- Habitabilidad (NASA: ~25 m³/persona en misiones largas) ---
  const volume = ship.capsule.volume + ship.habitat.volume;
  const volNeed = routeDays <= 21 ? 2.2 : routeDays <= 60 ? 5 : routeDays <= 180 ? 12 : 25;
  const volPer = volume / Math.max(1, crewN);

  // --- Radiación (DONKI) ---
  const activity = nasa.activity ?? { index: 0.5, label: 'Sin datos' };
  const rates = { leo: 0.5, deep: 1.8 + activity.index * 0.4, surface: 1.37 };
  const shieldFactor = 1 - Math.min(0.35, storage / 30000);
  const medic = state.crew.some((c) => c.role === 'medico') ? 0.8 : 1;
  const dose = steps.reduce((a, s) => a + (s.days ?? 0) * rates[s.region ?? 'deep'], 0) * shieldFactor * medic;

  // --- Aterrizaje ---
  const descent = route.steps.find((s) => s.land);
  const landMass = descent ? dryMass + descent.before.prop + descent.before.cons : wetMass;
  const twr = (ship.engine.thrust * 1000) / (landMass * LUNAR_G);

  // --- Costos (millones US$) ---
  const partCost = Object.keys(PARTS).reduce((a, slot) => a + (ship[slot].cost ?? 0), 0);
  const costs = {
    Nave: partCost,
    Ciencia: instruments.reduce((a, i) => a + i.cost, 0),
    Lanzamientos: lv.cost * state.launches + (crewLaunch ? 70 : 0),
    Provisiones: route.resupplyCost,
    Operaciones: routeDays * 0.25 * crewN,
  };
  const cost = Object.values(costs).reduce((a, b) => a + b, 0);

  const failStep = route.failure?.step;
  const checks = [
    check('crew', 'Tripulación', crewN >= 1 && crewN <= ship.capsule.seats ? 'ok' : 'fail',
      `${crewN} de ${ship.capsule.seats} asientos`,
      'Cada cápsula tiene asientos limitados: el peso y el volumen de cada persona cuentan.'),
    check('volume', 'Habitabilidad', volPer >= volNeed ? 'ok' : volPer >= volNeed * 0.6 ? 'warn' : 'fail',
      `${volPer.toFixed(1)} m³ por persona · se recomiendan ${volNeed} m³ para ${fmt(routeDays)} días`,
      'La NASA recomienda ~25 m³ por persona en viajes de meses: el encierro afecta la salud y el desempeño.'),
    check('launch', 'Masa al despegue', wetMass <= capacity * 0.95 ? 'ok' : wetMass <= capacity ? 'warn' : 'fail',
      capacity > 0 ? `${fmt(wetMass)} kg de ${fmt(capacity)} kg (${direct ? 'inyección directa' : `${state.launches} × ${lv.name} a LEO`})` : `${lv.name} no puede hacer inyección directa`,
      direct ? 'Con inyección directa la etapa superior del cohete hace el primer gran encendido, pero la carga útil es mucho menor que a órbita baja.'
        : 'Varios lanzamientos permiten ensamblar la nave en órbita, como la ISS, a cambio de más costo.'),
    check('crewrated', 'Certificación para tripulación', crewLaunch ? 'warn' : 'ok',
      crewLaunch ? `${lv.name} no lleva personas: la tripulación sube aparte en Falcon 9 (+US$ 70 M)` : `${lv.name} está certificado para tripulación`,
      'Solo los cohetes con certificación humana (sistema de escape, redundancias) pueden llevar astronautas.'),
    check('route', 'Δv y propelente',
      route.failure?.reason === 'prop' ? 'fail' : route.finalProp < tankCapacity * 0.05 ? 'warn' : 'ok',
      route.failure?.reason === 'prop' ? `Sin propelente en «${failStep.name}»: faltan ${fmt(route.failure.short)} kg`
        : `${totalDv.toFixed(2)} km/s en total · llegas con ${fmt(route.finalProp)} kg de reserva`,
      'Cada encendido se calcula con la ecuación de Tsiolkovsky usando la masa de ese momento. Repostar en estaciones rompe la «tiranía del cohete».'),
    check('cons', 'Víveres, agua y oxígeno',
      route.failure?.reason === 'cons' ? 'fail' : route.finalCons < crewN * ship.life.rate * 3 ? 'warn' : 'ok',
      route.failure?.reason === 'cons' ? `Se acaban en «${failStep.name}» (día ${fmt(route.failure.day)})`
        : `${fmt(crewN * ship.life.rate)} kg/día · capacidad ${fmt(storage)} kg · reserva final ${fmt(route.finalCons)} kg`,
      'Una persona usa ~0,84 kg de O₂, ~3,5 kg de agua y ~1,8 kg de comida al día. Reciclar (ECLSS) o reabastecerse en estaciones lo cambia todo.'),
    check('power', 'Energía', gen >= powerNeed * 1.2 && genAt1AU >= enginePower ? 'ok' : gen >= powerNeed && genAt1AU >= enginePower ? 'warn' : 'fail',
      `${fmt(gen)} W a ${dest.sunAU.toFixed(2)} UA · consumo ${fmt(powerNeed)} W${enginePower ? ` · motor ${fmt(enginePower)} W` : ''}`,
      'La luz solar cae con 1/d². El soporte vital regenerativo y la propulsión eléctrica consumen kilovatios.'),
    check('reentry', 'Escudo térmico', ship.shield.maxEntry >= dest.reentry ? 'ok' : 'fail',
      ship.shield.maxEntry ? `Soporta ${ship.shield.maxEntry.toFixed(1)} km/s · regreso a ${dest.reentry.toFixed(1)} km/s` : 'Sin escudo: la cápsula no sobrevive la reentrada',
      'Volver de la Luna (11 km/s) calienta el escudo a ~2 700 °C; de Marte, aún más.'),
    check('docking', 'Acoplamiento', !needsDock || ship.docking.id !== 'none' ? 'ok' : 'fail',
      needsDock ? (ship.docking.id === 'none' ? 'La ruta necesita acoplarse y no hay puerto' : `${ship.docking.name} listo`) : 'No se requiere',
      'Para visitar estaciones, ensamblar en órbita o recibir a la tripulación hace falta un puerto IDSS.'),
    landing ? check('landing', 'Alunizaje', ship.legs.id === 'none' ? 'fail' : twr >= 1.4 ? 'ok' : twr >= 1 ? 'warn' : 'fail',
      ship.legs.id === 'none' ? 'Falta el tren de aterrizaje' : `Empuje/peso lunar ${twr.toFixed(2)} (recomendado ≥ 1,4)`,
      'El motor debe vencer la gravedad lunar (1,62 m/s²) con margen para frenar y maniobrar. El módulo lunar del Apolo empezaba el descenso con ~1,8.') : null,
    check('science', 'Carga científica', instruments.length <= sciSlots ? 'ok' : 'fail',
      `${instruments.length} de ${sciSlots} espacios`,
      'Los hábitats agregan espacio para experimentos; la cápsula sola tiene muy poco.'),
    check('budget', 'Presupuesto', cost <= program.budget * 0.85 ? 'ok' : cost <= program.budget ? 'warn' : 'fail',
      `US$ ${fmt(cost)} M de ${fmt(program.budget)} M (${program.name})`,
      'La NASA recomienda reservas de 15–25 %: los sobrecostos son la causa n.º 1 de cancelaciones.'),
    check('radiation', 'Radiación (DONKI)', dose <= CAREER_DOSE * 0.6 ? 'ok' : dose <= CAREER_DOSE ? 'warn' : 'fail',
      `${fmt(dose)} mSv por persona · límite de carrera ${CAREER_DOSE} mSv · Sol ${activity.label.toLowerCase()}`,
      'Fuera de la magnetosfera la dosis es ~1,8 mSv/día (medido por el Curiosity en crucero). Los víveres y el agua funcionan como blindaje.'),
  ].filter(Boolean);

  return {
    state, dest, program, lv, ship, instruments, crewN, propType, pd, landing, sciSlots,
    parts, dryMass, dryNoMargin, wetMass, capacity, direct, crewLaunch, needsDock,
    storage, cons0, prop0, tankCapacity, steps, route, routeDays, totalDv,
    gen, powerNeed, enginePower, volume, volNeed, volPer, dose, twr,
    costs, cost, activity, checks,
    canLaunch: !checks.some((c) => ['launch', 'crew'].includes(c.id) && c.status === 'fail'),
  };
}

function check(id, label, status, detail, why) {
  return { id, label, status, detail, why };
}

/** Simulación determinista (semilla = diseño) con eventos reales de clima espacial. */
export function simulate(state, ev, flares = []) {
  const rng = mulberry32(hash(JSON.stringify(state)));
  const log = [];
  const roles = new Set(state.crew.map((c) => c.role));
  const reliabilityBonus = roles.has('comandante') ? 0.02 : 0;
  const engineFail = (1 - ev.ship.engine.reliability) * (roles.has('ingeniero') ? 0.6 : 1);
  const canRepair = ev.ship.docking.repairs || roles.has('ingeniero');
  let departed = false;
  let reached = false;
  let landed = false;

  const flareEvents = flares.filter((f) => /^[XM]/i.test(f.classType || '')).slice(0, 3);
  let flareIdx = 0;

  // Cada etapa devuelve el desenlace si la misión termina ahí (o null para seguir).
  const runStep = (s) => {
    const day = `Día ${fmt(s.day)}`;
    if (s.type === 'launch') {
      const launches = state.launches + (ev.crewLaunch ? 1 : 0);
      for (let i = 0; i < launches; i++) {
        if (rng() > ev.lv.reliability + reliabilityBonus) {
          log.push({ t: 'T-0', kind: 'fail', scene: 'launch', text: `Falla del ${i === launches - 1 && ev.crewLaunch ? 'Falcon 9 de la tripulación' : ev.lv.name}. El sistema de escape salva a la tripulación, pero la misión se cancela.` });
          return 'abort';
        }
      }
      log.push({ t: 'T-0', kind: 'ok', scene: 'launch', text: `${s.name}: ${state.launches > 1 ? `${state.launches} lanzamientos y ensamblaje en órbita. ` : ''}${fmt(ev.wetMass)} kg en camino.${ev.crewLaunch ? ' La tripulación llega aparte en Falcon 9 y se acopla.' : ''}` });
      return null;
    }
    if (s.type === 'dock') {
      const r = s.refill;
      const what = [];
      if (r.prop > 0) what.push(`${fmt(r.prop)} kg de ${PROPELLANTS[ev.propType].name.toLowerCase()}`);
      if (r.cons > 0) what.push(`${fmt(r.cons)} kg de víveres, agua y O₂`);
      log.push({
        t: day, kind: 'ok', scene: 'dock', station: s.station,
        text: `${s.name}. ${state.crew[0].name} cruza la escotilla y carga ${what.length ? what.join(' y ') : 'nada: no hay stock compatible'}${r.cost ? ` (US$ ${fmt(r.cost)} M)` : ''}.${r.incompatible && ev.propType ? ` La estación no tiene ${PROPELLANTS[ev.propType].name.toLowerCase()}.` : ''}`,
      });
      return null;
    }
    if (s.type === 'burn') {
      if (ev.route.failure?.reason === 'prop' && ev.route.failure.step.name === s.name) {
        const short = fmt(ev.route.failure.short);
        if (!departed) {
          log.push({ t: day, kind: 'fail', scene: 'burn', text: `${s.name}: el propelente no alcanza (faltan ${short} kg). Se aborta en órbita baja y la tripulación vuelve a casa.` });
          return 'abort';
        }
        if (!reached && ev.dest.id === 'moon') {
          log.push({ t: day, kind: 'fail', scene: 'burn', text: `${s.name}: sin propelente para frenar (faltan ${short} kg). Como el Apolo 13, la trayectoria de retorno libre rodea la Luna y trae a la tripulación de vuelta.` });
          return 'freereturn';
        }
        log.push({ t: day, kind: 'fail', scene: 'burn', text: `${s.name}: el propelente se agota (faltan ${short} kg). La nave queda varada lejos de la Tierra.` });
        return 'stranded';
      }
      if (s.dv > 0.3 && rng() < engineFail) {
        if (canRepair) {
          log.push({ t: day, kind: 'warn', scene: 'burn', text: `${s.name}: el motor se apaga antes de tiempo. ${roles.has('ingeniero') ? 'Ingeniería de vuelo' : 'El brazo robótico'} permite repararlo y repetir el encendido.` });
        } else {
          log.push({ t: day, kind: 'fail', scene: 'burn', text: `${s.name}: falla del motor sin forma de repararlo.` });
          return departed ? 'stranded' : 'abort';
        }
      } else {
        log.push({
          t: day, kind: 'info', scene: s.land ? 'land' : 'burn',
          text: s.dv > 0 ? `${s.name}: ${s.dv.toFixed(2)} km/s, se usan ${fmt(s.need)} kg de propelente.` : `${s.name}: la etapa superior del cohete hace el encendido.`,
        });
      }
      if (s.land) landed = true;
      if (s.dv > 0 || s.days > 1) departed = true;
      if (/Inserción|Encuentro/.test(s.name)) reached = true;
      // tormentas solares reales durante los tramos largos
      if (s.days > 2 && flareIdx < flareEvents.length) {
        const f = flareEvents[flareIdx++];
        const date = (f.peakTime || f.beginTime || '').slice(0, 10);
        log.push({ t: `Días ${fmt(s.day - s.days)}–${fmt(s.day)}`, kind: 'warn', source: 'DONKI', scene: 'burn', text: `Fulguración ${f.classType} (como la registrada por la NASA el ${date}): la tripulación se refugia junto a los tanques de agua durante la tormenta de partículas.` });
      }
      return null;
    }
    if (s.type === 'stay') {
      reached = true;
      if (ev.route.failure?.reason === 'cons' && ev.route.failure.step.name === s.name) {
        log.push({ t: day, kind: 'fail', scene: 'stay', text: `${s.name}: se acaban los víveres. Regreso de emergencia.` });
        return 'cons';
      }
      log.push({ t: day, kind: 'ok', scene: s.region === 'surface' ? 'land' : 'stay', text: `${s.name} durante ${fmt(s.days)} días.` });
      return null;
    }
    if (s.type === 'reentry') {
      if (ev.route.failure?.reason === 'cons') {
        log.push({ t: day, kind: 'fail', scene: 'reentry', text: 'Los víveres se agotaron antes de volver. La tripulación no sobrevive.' });
        return 'cons';
      }
      if (ev.ship.shield.maxEntry < s.speed) {
        log.push({ t: day, kind: 'fail', scene: 'reentry', text: `Reentrada a ${s.speed.toFixed(1)} km/s: el escudo (${ev.ship.shield.maxEntry || 0} km/s) no resiste.` });
        return 'reentry';
      }
      log.push({ t: day, kind: 'ok', scene: 'reentry', text: `Reentrada a ${s.speed.toFixed(1)} km/s y amerizaje. ¡Bienvenidos a casa!` });
    }
    return null;
  };

  for (const s of ev.route.steps) {
    const from = log.length;
    const outcome = runStep(s);
    // telemetría para la interfaz: día, propelente y víveres tras la etapa
    for (let i = from; i < log.length; i++) log[i].tele ??= { day: s.day, prop: s.after.prop, cons: s.after.cons };
    if (outcome) return finish(outcome);
  }
  return finish('ok');

  function finish(outcome) {
    const lostCrew = ['stranded', 'reentry', 'cons'].includes(outcome);
    let science = 0;
    if (reached) {
      for (const ins of ev.instruments) {
        if (ins.needsLanding && !landed) continue;
        science += ins.value[ev.dest.sci];
      }
      if (roles.has('cientifico')) science *= 1.25;
    }
    const explore = reached ? ev.dest.explore + (landed ? 45 : 0) : 0;
    const overrun = Math.max(0, ev.cost / ev.program.budget - 1);
    const healthy = ev.dose <= CAREER_DOSE ? 1 : 0.6;
    let score = lostCrew ? 0 : Math.round((science * 8 + explore) * healthy * Math.max(0, 1 - overrun * 2) * (outcome === 'ok' ? 1 : 0.4));
    const grade = lostCrew ? 'F' : score >= 260 ? 'S' : score >= 180 ? 'A' : score >= 110 ? 'B' : score >= 50 ? 'C' : 'D';
    if (overrun > 0 && !lostCrew) log.push({ t: 'Revisión', kind: 'warn', text: `Sobrecosto de ${(overrun * 100).toFixed(0)} %: el Congreso recorta la puntuación.` });
    if (ev.dose > CAREER_DOSE && !lostCrew) log.push({ t: 'Revisión', kind: 'warn', text: `La tripulación superó el límite de radiación (${fmt(ev.dose)} mSv).` });
    return { ok: outcome === 'ok', outcome, lostCrew, log, science, explore, score, grade, landed, reached };
  }
}

/** Propelente mínimo al despegar para completar la ruta con 5 % de reserva (búsqueda binaria). */
export function minimalPropellant(state, nasa = {}) {
  const cap = evaluate(state, nasa).tankCapacity;
  const works = (load) => {
    const e = evaluate({ ...state, propLoad: load }, nasa);
    return e.route.failure?.reason !== 'prop' && e.route.finalProp >= cap * 0.05;
  };
  if (!works(cap)) return cap;
  let lo = 0, hi = cap;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (works(mid)) hi = mid; else lo = mid;
  }
  return Math.ceil(hi / 10) * 10;
}

/** Aplica una nave de fábrica: conserva los nombres de la tripulación y el traje elegido. */
export function presetState(state, preset, nasa = {}) {
  const next = structuredClone(state);
  Object.assign(next, { land: false, neoId: null }, preset.mission);
  next.crew = preset.crewRoles.map((role, i) => ({ name: state.crew[i]?.name ?? newCrewMember({ crew: next.crew ?? [] }).name, role }));
  next.ship = { ...state.ship, ...preset.ship, ...preset.look };
  next.look = { ...state.look, patch: preset.patch, insignia: { ...preset.insignia, upload: null } };
  next.instruments = [...preset.instruments];
  next.presetId = preset.id;
  next.propLoad = minimalPropellant(next, nasa);
  return next;
}

export function newCrewMember(state) {
  const used = new Set(state.crew.map((c) => c.name));
  const name = DEFAULT_NAMES.find((n) => !used.has(n)) ?? `Astronauta ${state.crew.length + 1}`;
  const usedRoles = new Set(state.crew.map((c) => c.role));
  const role = ROLES.find((r) => !usedRoles.has(r.id))?.id ?? 'cientifico';
  return { name, role };
}

// Los colores pueden ser un id de la paleta o un hex personalizado (#rrggbb)
export const paintHex = (id) => (/^#[0-9a-f]{6}$/i.test(id) ? id : (PAINTS.find((p) => p.id === id) ?? PAINTS[0]).hex);
export const accentHex = (id) => (/^#[0-9a-f]{6}$/i.test(id) ? id : (ACCENTS.find((p) => p.id === id) ?? ACCENTS[0]).hex);

export const fmt = (n) => Math.round(n).toLocaleString('es');

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
