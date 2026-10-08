// Informe final: qué decidiste, qué limitó la misión y experimentos «¿qué pasaría si…?».
// Cada experimento vuelve a volar tu misma misión con un solo cambio de diseño y la misma
// semilla (los mismos eventos), así la diferencia se debe solo a ese cambio.
import { PARTS } from './data/parts.js';
import { STATIONS } from './data/catalog.js';
import { ROLES } from './data/crew.js';
import { evaluate, minimalPropellant, part, fmt } from './mission.js';
import { simulate } from './flight.js';

const OUTCOME = {
  ok: 'Misión cumplida',
  abort: 'Misión abortada: la tripulación volvió a salvo',
  freereturn: 'Retorno libre alrededor de la Luna',
  stranded: 'La nave quedó varada sin propelente',
  reentry: 'El escudo térmico no resistió la reentrada',
  cons: 'Se acabaron el agua, el oxígeno y la comida',
};

const LESSON = {
  stranded: 'La ecuación de Tsiolkovsky es exponencial: cada kilo extra exige mucho más propelente. Repostar en estaciones o usar un motor con más Isp rompe esa «tiranía del cohete».',
  reentry: 'Volver de la Luna a 11 km/s calienta el escudo a ~2 700 °C; de Marte, aún más. El escudo se elige por la velocidad de regreso, no por la de ida.',
  cons: 'Cada persona usa ~6 kg de agua, oxígeno y comida al día. El reciclaje regenerativo de la ISS (ECLSS) baja eso a ~2,3 kg: en viajes largos pesa menos que cargarlo todo.',
  abort: 'Abortar no es fracasar: en la NASA la regla es «la tripulación primero». El Apolo 13 se llama «el fracaso exitoso».',
  freereturn: 'La trayectoria de retorno libre usa la gravedad lunar para volver sin encender el motor: así se salvó el Apolo 13.',
};

export function debrief(state, ev, result, nasa = {}) {
  const seed = result.seed;
  const fly = (s) => {
    const e = evaluate(s, nasa);
    return { e, r: e.canLaunch ? simulate(s, e, nasa, { seed }) : null };
  };
  // misma nave con las opciones prudentes, para separar el diseño de las decisiones
  const prudent = simulate(state, ev, nasa, { seed });

  const list = variants(state, ev, result);
  // si hay varios arreglos posibles, probar también todos juntos
  const fixes = list.filter((v) => v.fix);
  if (fixes.length > 1 && result.lostCrew) {
    list.push({ all: true, label: 'Con todos esos arreglos a la vez', why: fixes.map((v) => v.label.replace(/^Con /, '')).join(' + '), fix: true, apply: (s) => fixes.reduce((acc, v) => v.apply(acc), s) });
  }
  const whatIf = list
    .map((v) => {
      const next = v.apply(structuredClone(state));
      const cap = evaluate(next, nasa).tankCapacity;
      next.propLoad = Math.min(cap, Math.max(state.propLoad, minimalPropellant(next, nasa)));
      const { e, r } = fly(next);
      return {
        label: v.label,
        why: v.why,
        fix: !!v.fix,
        all: !!v.all,
        canLaunch: e.canLaunch,
        cost: e.cost - ev.cost,
        score: r?.score ?? 0,
        grade: r?.grade ?? '—',
        outcome: r ? OUTCOME[r.outcome] : 'No despega: con el propelente que necesita, no cabe en el cohete',
        delta: (r?.score ?? 0) - prudent.score,
        saved: !!r && !r.lostCrew && result.lostCrew,
      };
    })
    .filter((w) => w.delta !== 0 || w.saved || !w.canLaunch || (result.lostCrew && w.fix))
    .sort((a, b) => Number(b.saved) - Number(a.saved) || Number(b.all) - Number(a.all) || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);

  const limits = ev.checks
    .filter((c) => c.status !== 'ok')
    .sort((a, b) => (a.status === 'fail' ? -1 : 0) - (b.status === 'fail' ? -1 : 0))
    .map((c) => ({ label: c.label, status: c.status, detail: c.detail }));

  const lessons = [];
  if (LESSON[result.outcome]) lessons.push(LESSON[result.outcome]);
  for (const d of result.decisions) if (d.fact) lessons.push(capitalize(d.fact.replace(/^Dato real: /, '')));
  for (const c of ev.checks) if (c.status === 'fail') lessons.push(c.why);

  return {
    title: OUTCOME[result.outcome],
    prudent: { score: prudent.score, grade: prudent.grade, outcome: OUTCOME[prudent.outcome], lostCrew: prudent.lostCrew },
    whatIf,
    limits,
    lessons: [...new Set(lessons)].slice(0, 5),
  };
}

/** Cambios de diseño que vale la pena probar para esta misión. */
function variants(state, ev, result) {
  const out = [];
  const roles = new Set(state.crew.map((c) => c.role));
  const next = (slot) => {
    const list = PARTS[slot];
    const i = list.findIndex((p) => p.id === ev.ship[slot].id);
    return list[i + 1];
  };
  const swap = (role) => (s) => {
    if (s.crew.length < ev.ship.capsule.seats) s.crew.push({ name: 'Nueva incorporación', role });
    else s.crew[s.crew.length - 1].role = role;
    return s;
  };
  const roleName = (id) => ROLES.find((r) => r.id === id)?.name.toLowerCase() ?? id;

  if (ev.ship.life.id === 'open' && ev.routeDays > 20) {
    out.push({ fix: true, label: 'Con soporte vital regenerativo (ECLSS)', why: 'Recicla agua y oxígeno: 2,3 kg por persona al día en vez de 6.', apply: (s) => { s.ship.life = 'eclss'; return s; } });
  }
  const shield = PARTS.shield.find((p) => p.maxEntry >= ev.dest.reentry);
  if (ev.ship.shield.maxEntry < ev.dest.reentry && shield) {
    out.push({ fix: true, label: `Con escudo ${shield.name}`, why: `Aguanta ${shield.maxEntry} km/s; tu regreso es a ${ev.dest.reentry.toFixed(1)} km/s.`, apply: (s) => { s.ship.shield = shield.id; return s; } });
  }
  const tank = next('tanks');
  if (tank && (ev.route.failure?.reason === 'prop' || result.outcome === 'stranded' || result.outcome === 'freereturn')) {
    out.push({ fix: true, label: `Con ${tank.name.toLowerCase()}`, why: `${fmt(tank.capacity)} kg de capacidad en vez de ${fmt(ev.tankCapacity)} kg.`, apply: (s) => { s.ship.tanks = tank.id; return s; } });
  }
  if (ev.dest.id === 'moon' && !state.stops.includes('gateway')) {
    out.push({ fix: true, label: 'Con escala en Gateway', why: 'Reposta en la órbita lunar: el regreso cuesta 0,45 km/s en vez de 0,85.', apply: (s) => { s.stops = [...s.stops, 'gateway']; return s; } });
  }
  const comms = ev.comms.fraction < 0.95 ? (ev.ship.comms.id === 'hgaka' ? part('comms', 'laser') : part('comms', 'hgaka')) : null;
  if (comms && comms.id !== ev.ship.comms.id) {
    out.push({ label: `Con ${comms.name.toLowerCase()}`, why: `Hoy llega ${Math.round(ev.comms.fraction * 100)} % de tus datos: la ciencia que no se envía no cuenta.`, apply: (s) => { s.ship.comms = comms.id; return s; } });
  }
  if (!roles.has('medico') && result.dose > 150) {
    out.push({ label: 'Con una persona de medicina a bordo', why: `Reduce la dosis efectiva un 20 % y trata problemas de salud (${roleName('medico')}).`, apply: swap('medico') });
  }
  if (!roles.has('ingeniero') && result.decisions.some((d) => ['engine', 'mmod', 'water'].includes(d.event))) {
    out.push({ label: 'Con ingeniería de vuelo', why: 'Las reparaciones salen bien mucho más seguido.', apply: swap('ingeniero') });
  }
  const hab = next('habitat');
  if (hab && ev.checks.some((c) => c.id === 'volume' && c.status !== 'ok')) {
    out.push({ fix: true, label: `Con ${hab.name.toLowerCase()}`, why: `Más espacio por persona: ${hab.volume} m³ extra y más víveres que blindan la radiación.`, apply: (s) => { s.ship.habitat = hab.id; return s; } });
  }
  if (ev.ship.engine.id !== 'ntr' && ev.routeDays > 200) {
    out.push({ label: 'Con motor nuclear térmico', why: 'Viajes ~20 % más cortos: menos radiación y menos víveres.', apply: (s) => { s.ship.engine = 'ntr'; if (!['l', 'lx', 'xl', 'xxl'].includes(s.ship.tanks)) s.ship.tanks = 'lx'; return s; } });
  }
  if (!roles.has('cientifico')) {
    out.push({ label: 'Con una persona de ciencia a bordo', why: '+25 % de retorno científico.', apply: swap('cientifico') });
  }
  // y al revés: ¿qué tan importante fue cada escala?
  for (const id of state.stops) {
    const dock = ev.steps.find((x) => x.type === 'dock' && x.station === id);
    if (dock) out.push({ label: `Sin la escala en ${STATIONS.find((x) => x.id === id).short}`, why: 'Para ver cuánto dependía tu misión de repostar ahí.', apply: (s) => { s.stops = s.stops.filter((x) => x !== id); return s; } });
  }
  return out;
}

const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);
