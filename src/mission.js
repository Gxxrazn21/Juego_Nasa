// Modelo de la misión: estado, presupuestos (masa, potencia, Δv, datos, costo),
// validaciones y simulación de la misión.
import {
  PROGRAMS, DESTINATIONS, LAUNCHERS, BUSES, INSTRUMENTS, ANTENNAS, TRANSMITTERS,
  ENGINES, SHIELDING, SOLAR, RTG,
} from './data/catalog.js';
import {
  rocketDeltaV, propellantFor, neoRendezvous, solarPower, downlinkRate,
  launcherCapacity, AU_KM,
} from './physics.js';

export const DESIGN_MARGIN = 0.15; // contingencia de masa seca (fase conceptual)
export const DV_MARGIN = 0.10;
export const POWER_MARGIN = 0.20;
export const COST_RESERVE = 0.15;

const byId = (list, id) => list.find((x) => x.id === id);

export function defaultState() {
  return {
    program: 'discovery',
    destination: 'moon',
    neoId: null,
    years: 3,
    bus: 'medium',
    instruments: ['cam', 'lidar'],
    solarArea: 12,
    rtgCount: 0,
    antenna: 'hga1',
    tx: 20,
    engine: 'biprop',
    propellant: 600,
    shielding: 'light',
    launcher: 'falcon9',
  };
}

/** Destino resuelto (para NEO, calcula Δv y tiempos con su órbita real). */
export function resolveDestination(state, neos = []) {
  const base = byId(DESTINATIONS, state.destination);
  if (!base.computed) return { ...base, c3: base.c3 ?? 0 };
  const neo = neos.find((n) => n.id === state.neoId) || neos[0];
  if (!neo) return { ...base, c3: 20, scDv: 3, sunAU: 1.5, maxEarthKm: 3.5e8, transferDays: 300 };
  const t = neoRendezvous(neo);
  return {
    ...base,
    neo,
    name: neo.name,
    c3: t.c3,
    scDv: t.arrivalDv,
    sunAU: t.aphelionAU,
    maxEarthKm: (1 + t.aphelionAU) * AU_KM,
    transferDays: t.transferDays,
    orbit: neo,
    transfer: t,
  };
}

export function evaluate(state, nasa = {}) {
  const dest = resolveDestination(state, nasa.neos);
  const program = byId(PROGRAMS, state.program);
  const bus = byId(BUSES, state.bus);
  const lv = byId(LAUNCHERS, state.launcher);
  const antenna = byId(ANTENNAS, state.antenna);
  const tx = byId(TRANSMITTERS, state.tx);
  const engine = byId(ENGINES, state.engine);
  const shield = byId(SHIELDING, state.shielding);
  const instruments = state.instruments.map((id) => byId(INSTRUMENTS, id)).filter(Boolean);
  const rtgCount = Math.min(state.rtgCount, bus.maxRtg);
  const propellant = Math.min(state.propellant, bus.tankMax);

  // --- Masa ---
  const instrMass = sum(instruments, 'mass');
  const solarMass = state.solarArea * SOLAR.kgPerM2;
  const parts = {
    Bus: bus.dry,
    Instrumentos: instrMass,
    'Paneles solares': solarMass,
    RTG: rtgCount * RTG.mass,
    Comunicaciones: antenna.mass + tx.mass,
    Propulsión: engine.mass,
  };
  const baseDry = Object.values(parts).reduce((a, b) => a + b, 0);
  parts.Blindaje = baseDry * shield.massFrac;
  const dryNoMargin = baseDry + parts.Blindaje;
  const dryMass = dryNoMargin * (1 + DESIGN_MARGIN);
  const wetMass = dryMass + propellant;
  const capacity = launcherCapacity(lv, dest.launchTarget, dest.c3);

  // --- Δv ---
  const dvRequired = dest.scDv * (1 + DV_MARGIN);
  const dvAvailable = rocketDeltaV(engine.isp, wetMass, dryMass);
  const propNeeded = propellantFor(dvRequired, engine.isp, dryMass);

  // --- Potencia (peor caso: punto más lejano del Sol) ---
  const solarAtDest = solarPower(state.solarArea, dest.sunAU, SOLAR.efficiency, SOLAR.degradation);
  const solarAt1AU = solarPower(state.solarArea, 1, SOLAR.efficiency, SOLAR.degradation);
  const rtgPower = rtgCount * RTG.power;
  const powerGen = solarAtDest + rtgPower;
  const instrPower = sum(instruments, 'power');
  const commsPower = tx.power / 0.35; // eficiencia del amplificador
  const powerNeed = bus.avionicsW + instrPower + commsPower;
  const ionNeed = engine.power ? bus.avionicsW + engine.power : 0;
  const ionGen = solarAt1AU + rtgPower;

  // --- Datos ---
  const dataNeedGb = sum(instruments, 'data');
  const rate = downlinkRate(tx.power, antenna.diameter, dest.maxEarthKm);
  const dataDownGb = (rate * dest.contactH * 3600) / 1e9;

  // --- Costo (millones USD) ---
  const costs = {
    Bus: bus.cost,
    Instrumentos: sum(instruments, 'cost'),
    Energía: state.solarArea * SOLAR.costPerM2 + rtgCount * RTG.cost,
    Comunicaciones: antenna.cost + tx.cost,
    Propulsión: engine.cost,
    Blindaje: shield.cost,
    Lanzador: lv.cost,
    Operaciones: bus.opsPerYear * state.years,
  };
  const cost = Object.values(costs).reduce((a, b) => a + b, 0);

  // --- Radiación (con datos DONKI) ---
  const activity = nasa.activity ?? { index: 0.5, label: 'Sin datos' };
  const radiationRisk = dest.radiation * (0.6 + activity.index) * (1 - shield.reduce) * (state.years / 3);
  const radFailure = Math.min(0.45, radiationRisk * 0.12);

  const checks = [
    check('slots', 'Capacidad del bus',
      instruments.length <= bus.slots && instrMass <= bus.instrMass ? 'ok' : 'fail',
      `${instruments.length}/${bus.slots} ranuras · ${fmt(instrMass)}/${bus.instrMass} kg`,
      'Cada bus tiene un número de ranuras y un límite de masa para la carga útil científica.'),
    check('launch', 'Masa vs. lanzador',
      capacity <= 0 ? 'fail' : wetMass <= capacity * 0.9 ? 'ok' : wetMass <= capacity ? 'warn' : 'fail',
      capacity <= 0 ? `${lv.name} no llega a ${dest.short}` : `${fmt(wetMass)} kg de ${fmt(capacity)} kg (${dest.launchTarget}${dest.launchTarget === 'ESC' ? `, C3 ${dest.c3.toFixed(1)} km²/s²` : ''})`,
      'La capacidad del lanzador baja mucho cuanto más energía (C3) exige el destino. Deja ~10 % de margen.'),
    check('dv', 'Δv de la nave',
      dvAvailable >= dvRequired ? 'ok' : dvAvailable >= dest.scDv ? 'warn' : 'fail',
      `${dvAvailable.toFixed(2)} de ${dvRequired.toFixed(2)} km/s · necesitas ~${fmt(propNeeded)} kg de propelente`,
      'Tsiolkovsky: Δv = Isp·g₀·ln(m₀/m_f). Más propelente o mayor Isp → más Δv, pero cada kg cuesta capacidad de lanzamiento.'),
    check('power', 'Balance de potencia',
      powerGen >= powerNeed * (1 + POWER_MARGIN) ? 'ok' : powerGen >= powerNeed ? 'warn' : 'fail',
      `${fmt(powerGen)} W generados a ${dest.sunAU.toFixed(2)} UA · ${fmt(powerNeed)} W consumidos`,
      'La luz solar cae con 1/d². A Marte llega menos de la mitad que a la Tierra; por eso misiones lejanas usan RTG.'),
    engine.power ? check('ion', 'Potencia de propulsión iónica',
      ionGen >= ionNeed ? 'ok' : 'fail',
      `${fmt(ionGen)} W disponibles · ${fmt(ionNeed)} W para el motor`,
      'Los motores iónicos tienen Isp altísimo pero necesitan kilovatios de energía.') : null,
    check('data', 'Enlace de datos',
      dataDownGb >= dataNeedGb ? 'ok' : dataDownGb >= dataNeedGb * 0.5 ? 'warn' : 'fail',
      `${fmtData(dataDownGb)} bajables/día · ${fmtData(dataNeedGb)} generados/día`,
      'La tasa de bajada crece con potencia × diámetro² de antena y cae con la distancia².'),
    check('budget', 'Presupuesto',
      cost <= program.budget * (1 - COST_RESERVE) ? 'ok' : cost <= program.budget ? 'warn' : 'fail',
      `US$ ${fmt(cost)} M de ${fmt(program.budget)} M (${program.name})`,
      'NASA recomienda reservas de 15–25 %: los sobrecostos son la causa n.º 1 de cancelaciones.'),
    check('radiation', 'Radiación (DONKI)',
      radFailure < 0.06 ? 'ok' : radFailure < 0.15 ? 'warn' : 'fail',
      `Actividad solar ${activity.label.toLowerCase()} · riesgo de falla ${(radFailure * 100).toFixed(0)} %`,
      'Las fulguraciones y CME medidas por la NASA aumentan la dosis. El blindaje reduce el riesgo pero añade masa.'),
  ].filter(Boolean);

  return {
    dest, program, bus, lv, engine, antenna, tx, shield, instruments, rtgCount, propellant,
    parts, costs, dryMass, dryNoMargin, wetMass, capacity,
    dvRequired, dvAvailable, propNeeded,
    powerGen, powerNeed, solarAtDest, rtgPower,
    dataNeedGb, dataDownGb, rate,
    cost, activity, radiationRisk, radFailure, checks,
    canLaunch: checks.find((c) => c.id === 'launch').status !== 'fail',
  };
}

function check(id, label, status, detail, why) {
  return { id, label, status, detail, why };
}

/** Simulación determinista (semilla = diseño) con eventos reales de clima espacial. */
export function simulate(state, ev, flares = []) {
  const rng = mulberry32(hash(JSON.stringify(state)));
  const log = [];
  const days = Math.round(ev.dest.transferDays * ev.engine.timeFactor);
  let alive = true;
  let science = 0;

  log.push({ t: 'T-0', kind: 'info', text: `Despegue en ${ev.lv.name} con ${fmt(ev.wetMass)} kg.` });
  if (rng() > ev.lv.reliability) {
    log.push({ t: 'T+3 min', kind: 'fail', text: `Falla del lanzador (fiabilidad histórica ${(ev.lv.reliability * 100).toFixed(0)} %). La misión se pierde.` });
    return finish(false, 0);
  }
  log.push({ t: 'T+1 h', kind: 'ok', text: `Separación de la nave. Paneles desplegados: ${fmt(ev.solarAtDest)} W en destino.` });

  // Eventos de clima espacial reales durante el crucero / operaciones
  const strong = flares.filter((f) => /^[XM]/i.test(f.classType || '')).slice(0, 4);
  for (const f of strong) {
    const severity = f.classType.startsWith('X') ? 0.5 : 0.15;
    const hit = rng() < severity * ev.dest.radiation * (1 - ev.shield.reduce);
    log.push({
      t: f.peakTime?.slice(0, 10) || f.beginTime?.slice(0, 10),
      kind: hit ? 'warn' : 'info',
      source: 'DONKI',
      text: hit
        ? `Fulguración ${f.classType}: evento de partículas provoca un reinicio de la computadora. Recuperada en modo seguro.`
        : `Fulguración ${f.classType} registrada por la NASA. ${ev.shield.reduce ? 'El blindaje' : 'La suerte'} protege a la nave.`,
    });
    if (hit) science -= 0.5;
  }

  // Llegada / inserción
  const dvRatio = ev.dvAvailable / Math.max(ev.dvRequired, 0.01);
  if (ev.dest.id !== 'leo') {
    log.push({ t: `Día ${Math.max(1, days)}`, kind: 'info', text: `Llegada a ${ev.dest.name}.` });
  }
  let insertion = 1;
  if (dvRatio < 1 / (1 + DV_MARGIN)) {
    insertion = 0.2;
    log.push({ t: 'Inserción', kind: 'fail', text: 'Propelente insuficiente: la nave no logra quedarse en órbita. Solo un sobrevuelo breve.' });
  } else {
    log.push({ t: 'Inserción', kind: 'ok', text: `Maniobra de ${ev.dest.scDv.toFixed(2)} km/s completada. Quedan ${fmt(Math.max(0, ev.propellant - propellantFor(ev.dest.scDv, ev.engine.isp, ev.dryMass)))} kg de propelente.` });
  }

  if (rng() < ev.radFailure) {
    alive = false;
    log.push({ t: 'Operaciones', kind: 'fail', text: 'Daño acumulado por radiación en la electrónica. La nave deja de responder.' });
  }

  const powerRatio = Math.min(1, ev.powerGen / Math.max(ev.powerNeed, 1));
  const dataRatio = Math.min(1, ev.dataDownGb / Math.max(ev.dataNeedGb, 0.001));
  if (powerRatio < 1) log.push({ t: 'Operaciones', kind: 'warn', text: `Energía insuficiente: instrumentos al ${(powerRatio * 100).toFixed(0)} % del tiempo.` });
  if (dataRatio < 1) log.push({ t: 'Operaciones', kind: 'warn', text: `El enlace solo baja el ${(dataRatio * 100).toFixed(0)} % de los datos generados.` });

  const yearsFlown = alive ? state.years : state.years * (0.2 + rng() * 0.5);
  for (const ins of ev.instruments) science += ins.value[ev.dest.sci] * powerRatio * dataRatio * insertion;
  science *= Math.sqrt(yearsFlown / 3);
  science = Math.max(0, science);

  log.push({
    t: 'Fin',
    kind: alive ? 'ok' : 'warn',
    text: alive ? `Misión nominal completada tras ${state.years} años.` : `Misión terminada tras ${yearsFlown.toFixed(1)} años.`,
  });
  return finish(alive, science);

  function finish(ok, sci) {
    const overrun = Math.max(0, ev.cost / ev.program.budget - 1);
    const score = Math.round(sci * 10 * Math.max(0, 1 - overrun * 2));
    const efficiency = sci > 0 ? (sci * 100) / ev.cost : 0;
    const grade = score >= 300 ? 'S' : score >= 200 ? 'A' : score >= 120 ? 'B' : score >= 60 ? 'C' : 'D';
    if (overrun > 0) log.push({ t: 'Revisión', kind: 'warn', text: `Sobrecosto de ${(overrun * 100).toFixed(0)} %: el Congreso recorta la puntuación.` });
    return { ok, log, science: sci, score, efficiency, grade, days };
  }
}

const sum = (list, key) => list.reduce((a, x) => a + x[key], 0);
export const fmt = (n) => Math.round(n).toLocaleString('es');
export const fmtData = (gb) => (gb >= 1 ? `${gb.toFixed(gb >= 100 ? 0 : 1)} Gb` : `${(gb * 1000).toFixed(0)} Mb`);

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
