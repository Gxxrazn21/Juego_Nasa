// Modelo de la misión tripulada: masa, ruta con estaciones y provisiones,
// validaciones contra física y datos NASA. El vuelo en sí vive en flight.js.
import { PROGRAMS, DESTINATIONS, LAUNCHERS, STATIONS, INSTRUMENTS, FALLBACK_NEOS } from './data/catalog.js';
import { PARTS, PROPELLANTS, PAINTS, ACCENTS } from './data/parts.js';
import { ROLES, DEFAULT_NAMES } from './data/crew.js';
import { neoRendezvous, G0, AU_KM, downlinkBps, meanEarthDistanceAU } from './physics.js';

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
      livery: 'bandas', finish: 'satinado', mli: 'oro', name: 'Esperanza', comms: 'hgax',
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
  // mientras NeoWs carga (o si falla) se usa el catálogo de respaldo: así siempre hay una órbita real
  const neo = neos.find((n) => n.id === state.neoId) || FALLBACK_NEOS.find((n) => n.id === state.neoId) || neos[0] || FALLBACK_NEOS[0];
  const t = neoRendezvous(neo);
  return {
    ...base,
    neo,
    name: neo.name,
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
    Comunicaciones: ship.comms.mass,
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
  const powerNeed = AVIONICS_W + ship.life.power + instrPower + ship.comms.power;
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

  // --- Comunicaciones (TDRS en órbita baja; Red de Espacio Profundo más lejos) ---
  const comms = linkBudget(state, dest, ship, instruments, steps, landing);

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
    check('comms', 'Comunicaciones', !comms.voiceOk ? 'fail' : comms.fraction >= 0.95 ? 'ok' : comms.fraction >= 0.5 ? 'warn' : 'fail',
      !comms.voiceOk ? `Solo ${fmtRate(comms.rate)} a ${fmtKm(comms.distKm)}: la tripulación queda incomunicada`
        : `${fmtRate(comms.rate)} vía ${comms.network} a ${fmtKm(comms.distKm)} · llegan ${fmtGb(comms.down)} de ${fmtGb(comms.generated)} de ciencia`,
      'La señal se debilita con la distancia al cuadrado. Las antenas de 34 y 70 m de la Red de Espacio Profundo de la NASA (California, España y Australia) reciben a las naves lejanas; en órbita baja se usan los satélites TDRS. El láser (DSOC) envía mucho más, pero las nubes lo bloquean.'),
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
    gen, powerNeed, enginePower, volume, volNeed, volPer, dose, twr, comms,
    costs, cost, activity, checks,
    canLaunch: !checks.some((c) => ['launch', 'crew'].includes(c.id) && c.status === 'fail'),
  };
}

/** ¿Puede este instrumento trabajar en esta misión? */
export function usable(ins, ev) {
  if (ins.needsLanding) return ev.landing;
  // muestras: en la superficie, o en un asteroide con brazo robótico (como TAGSAM de OSIRIS-REx)
  if (ins.needsSurface) return ev.landing || (ev.dest.id === 'neo' && ev.ship.docking.repairs);
  return true;
}

/** Presupuesto de enlace: tasa de bajada, datos generados y datos que llegan a la Tierra. */
function linkBudget(state, dest, ship, instruments, steps, landing) {
  const link = dest.link;
  const distKm = link.distKm ?? meanEarthDistanceAU(dest.orbit) * AU_KM;
  const rate = downlinkBps(ship.comms, distKm, link.ground) * (ship.comms.availability ?? 1);
  const stayDays = steps.filter((s) => s.type === 'stay').reduce((a, s) => a + s.days, 0);
  const lastBurn = [...steps].reverse().find((s) => s.type === 'burn');
  const backhaulDays = stayDays + (lastBurn?.days ?? 0); // se sigue transmitiendo en el regreso
  const ev = { landing, dest, ship };
  const dataInstr = instruments.filter((i) => i.kind === 'datos' && usable(i, ev));
  const generated = dataInstr.reduce((a, i) => a + i.data, 0) * stayDays;
  const perDay = (rate * link.contactH * 3600) / 1e9;
  const down = Math.min(generated, perDay * backhaulDays);
  return {
    network: link.network === 'TDRS' ? 'satélites TDRS' : 'Red de Espacio Profundo',
    distKm, rate, perDay, generated, down,
    capacity: perDay * backhaulDays, // lo que el enlace puede bajar en toda la misión
    fraction: generated > 0 ? down / generated : 1,
    voiceOk: rate >= 64e3, // voz, telemetría y video básico
  };
}

const fmtRate = (bps) => (bps >= 1e6 ? `${(bps / 1e6).toFixed(bps >= 1e7 ? 0 : 1)} Mbps` : bps >= 1e3 ? `${(bps / 1e3).toFixed(0)} kbps` : `${bps.toFixed(0)} bps`);
const fmtKm = (km) => (km >= 1e7 ? `${(km / AU_KM).toFixed(2)} UA` : `${fmt(km)} km`);
export const fmtGb = (gb) => (gb >= 1000 ? `${(gb / 1000).toFixed(1)} Tb` : gb >= 1 ? `${gb.toFixed(gb >= 100 ? 0 : 1)} Gb` : `${(gb * 1000).toFixed(0)} Mb`);
export { fmtRate, fmtKm };

function check(id, label, status, detail, why) {
  return { id, label, status, detail, why };
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
