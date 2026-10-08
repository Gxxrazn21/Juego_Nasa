// Motor de vuelo paso a paso. Cada encendido se calcula en el momento con la ecuación de
// Tsiolkovsky y la masa real de ese instante, así las decisiones del jugador cambian lo que
// pasa después. Los eventos (data/events.js) se basan en situaciones reales de la NASA.
//
// Uso interactivo:   const gen = createFlight(state, ev, nasa).run();
//                    gen.next() → { value: entrada | { decision }, done }
//                    gen.next(idOpción) responde a una decisión; al terminar, value = resultado.
// Uso automático:    simulate(state, ev, nasa) elige siempre la opción prudente.
import { STATIONS } from './data/catalog.js';
import { PROPELLANTS } from './data/parts.js';
import { EVENTS, engineFailure } from './data/events.js';
import { G0 } from './physics.js';
import { usable, CAREER_DOSE, fmt } from './mission.js';

const GCR = { leo: 0.5, deep: 1.8, surface: 1.37 }; // mSv/día (ISS, Curiosity/RAD en crucero, Chang'e 4 en la Luna)

export function createFlight(state, ev, nasa = {}, { seed } = {}) {
  seed ??= hash(JSON.stringify(state)); // misma nave → mismos eventos: se puede volver a volar y decidir distinto
  const rng = mulberry32(seed);
  const steps = ev.steps;
  const roles = new Set(state.crew.map((c) => c.role));
  const pd = PROPELLANTS[ev.propType];
  const medic = roles.has('medico') ? 0.8 : 1;
  const shieldFactor = 1 - Math.min(0.35, ev.storage / 30000);
  const flares = Array.isArray(nasa) ? nasa : nasa.flares ?? [];
  const seps = Array.isArray(nasa) ? [] : nasa.seps ?? [];

  const ctx = {
    ev, steps, shieldFactor,
    totalDays: ev.routeDays,
    stormSource: stormSource(seps, flares),
    at: 0, // etapa actual (para que los eventos sepan cuánto viaje falta)
    daysLeft: (i) => steps.slice(i).reduce((a, s) => a + (s.days ?? 0), 0),
  };

  // ---------- estado del vuelo ----------
  const sim = {
    roles,
    prop: ev.prop0,
    cons: ev.cons0,
    day: 0,
    dose: 0,
    health: 100,
    scienceMult: 1,
    dvPenalty: 0,
    commsLostDays: 0,
    dataCorruption: 0,
    stayDone: 0,
    stayExtra: 0,
    stayFactor: 1,
    backhaulDays: 0,
    aborted: null,
    consRate: ev.crewN * ev.ship.life.rate,
    region: 'leo',
    addDose(mSv) { this.dose += mSv * medic; },
    useCons(kg) { this.cons -= kg; },
    spendDays(d) { elapse(d, this.region); },
    extendStay(d) { this.stayExtra += d; },
    shortenStay(f) { this.stayFactor *= f; },
    abort(reason) { this.aborted = reason; },
  };
  const mass = () => ev.dryMass + Math.max(0, sim.prop) + Math.max(0, sim.cons);

  function elapse(days, region) {
    sim.day += days;
    sim.cons -= sim.consRate * days;
    sim.dose += days * (GCR[region] ?? GCR.deep) * shieldFactor * medic;
    sim.prop *= Math.pow(1 - pd.boiloff, days);
  }

  // ---------- eventos programados (deterministas por la semilla del diseño) ----------
  const maxEvents = { iss: 2, moon: 3, mars: 5, neo: 4 }[ev.dest.id] ?? 3;
  const eligible = EVENTS.filter((e) => e.when(ctx));
  const fixed = eligible.filter((e) => ['storm', 'science', 'conjunction'].includes(e.id));
  const optional = eligible.filter((e) => !fixed.includes(e)).sort(() => rng() - 0.5);
  const chosen = [...fixed, ...optional].slice(0, maxEvents);
  const scheduled = new Map();
  for (const e of chosen) {
    const at = e.place(ctx);
    if (at < 0) continue;
    if (!scheduled.has(at)) scheduled.set(at, []);
    scheduled.get(at).push(e);
  }

  const stayIdx = steps.findIndex((s) => s.type === 'stay');
  const lastBurnIdx = steps.map((s) => s.type).lastIndexOf('burn');
  const reentryIdx = steps.findIndex((s) => s.type === 'reentry');

  function* run() {
    const log = [];
    const decisions = [];
    let departed = false, reached = false, landed = false, onSurface = false;
    let outcome = 'ok';

    const tele = (i) => ({ day: sim.day, prop: Math.max(0, sim.prop), cons: Math.max(0, sim.cons), dose: sim.dose, progress: (i + 1) / steps.length });
    const entry = (i, e) => { const x = { ...e, tele: tele(i) }; log.push(x); return x; };

    /** Etapa a la que salta un aborto: reentrada si aún no se sale de LEO (o retorno libre lunar), si no el último encendido. */
    function abortTarget(i) {
      if (onSurface) return steps.findIndex((x, k) => k >= i && x.type === 'burn' && !x.land);
      if (!departed || (!reached && ev.dest.id === 'moon')) return reentryIdx;
      return lastBurnIdx;
    }

    /** Presenta una decisión, espera la respuesta y aplica el efecto. */
    function* decide(i, card, eventId) {
      const choiceId = yield { decision: { ...card, id: eventId } };
      const option = card.options.find((o) => o.id === choiceId && !o.disabled)
        ?? card.options.find((o) => o.auto && !o.disabled) ?? card.options.find((o) => !o.disabled);
      const res = option.apply(sim, rng);
      decisions.push({ event: eventId, title: card.title, choice: option.id, label: option.label, prudent: !!option.auto, result: res.text, kind: res.kind, fact: card.fact, day: sim.day });
      yield entry(i, { t: `Día ${fmt(sim.day)}`, kind: res.kind, scene: 'event', text: `${card.title}: ${res.text}` });
    }

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const day = () => `Día ${fmt(sim.day)}`;

      // Aborto pendiente: saltar a la parte de regreso de la ruta
      if (sim.aborted && !sim.abortHandled) {
        const target = abortTarget(i);
        sim.abortHandled = true;
        outcome = 'abort';
        if (target > i) {
          const leo = !departed;
          const free = !leo && !reached && ev.dest.id === 'moon';
          yield entry(i, { t: day(), kind: 'warn', scene: 'burn', text: leo ? 'Se desorbita desde la órbita baja.' : free ? 'La trayectoria de retorno libre rodea la Luna y apunta de vuelta a la Tierra, como en el Apolo 13.' : 'Se prepara el encendido de regreso.' });
          if (leo) elapse(0.5, 'leo');
          else if (free) elapse(4, 'deep');
          i = target - 1;
          continue;
        }
      }

      if (s.type === 'launch') {
        const launches = state.launches + (ev.crewLaunch ? 1 : 0);
        for (let k = 0; k < launches; k++) {
          if (rng() > ev.lv.reliability + (roles.has('comandante') ? 0.02 : 0)) {
            yield entry(i, { t: 'T-0', kind: 'fail', scene: 'launch', text: `Falla del ${k === launches - 1 && ev.crewLaunch ? 'Falcon 9 de la tripulación' : ev.lv.name}. El sistema de escape salva a la tripulación, pero la misión se cancela.` });
            return finish('abort');
          }
        }
        elapse(s.days ?? 0, 'leo');
        yield entry(i, { t: 'T-0', kind: 'ok', scene: 'launch', text: `${s.name}: ${state.launches > 1 ? `${state.launches} lanzamientos y ensamblaje en órbita. ` : ''}${fmt(ev.wetMass)} kg en camino.${ev.crewLaunch ? ' La tripulación llega aparte en Falcon 9 y se acopla.' : ''}` });
        continue;
      }

      if (s.type === 'dock') {
        const st = STATIONS.find((x) => x.id === s.station);
        const stockProp = st.stock[ev.propType] ?? 0;
        const addProp = Math.max(0, Math.min(ev.tankCapacity - sim.prop, stockProp));
        const addCons = Math.max(0, Math.min(ev.storage - sim.cons, st.stock.consumables));
        if (s.dv) sim.prop -= mass() * (1 - Math.exp((-s.dv * 1000) / (ev.ship.engine.isp * G0)));
        sim.prop += addProp;
        sim.cons += addCons;
        const what = [];
        if (addProp > 0) what.push(`${fmt(addProp)} kg de ${pd.name.toLowerCase()}`);
        if (addCons > 0) what.push(`${fmt(addCons)} kg de víveres, agua y O₂`);
        elapse(s.days ?? 0, s.region ?? 'leo');
        sim.region = s.region ?? 'leo';
        yield entry(i, { t: day(), kind: 'ok', scene: 'dock', station: s.station, text: `${s.name}. ${state.crew[0].name} cruza la escotilla y carga ${what.length ? what.join(' y ') : 'nada: no hay stock compatible'}.` });
      }

      if (s.type === 'burn') {
        sim.region = s.region ?? 'deep';
        // Falla de motor antes de un encendido importante: decisión del jugador
        const failP = (1 - ev.ship.engine.reliability) * (roles.has('ingeniero') ? 0.6 : 1);
        if (s.dv > 0.3 && !sim.dvPenalty && rng() < failP) {
          yield* decide(i, engineFailure(ctx, sim, s, { canAbort: abortTarget(i) > i }), 'engine');
          if (sim.aborted) { i -= 1; continue; } // se vuelve a esta etapa para resolver el aborto
        }
        const dv = s.dv * (1 + sim.dvPenalty);
        const need = mass() * (1 - Math.exp((-dv * 1000) / (ev.ship.engine.isp * G0)));
        if (need > sim.prop + 1e-6) {
          const short = fmt(need - sim.prop);
          sim.prop = 0;
          if (!departed) {
            yield entry(i, { t: day(), kind: 'fail', scene: 'burn', text: `${s.name}: el propelente no alcanza (faltan ${short} kg). Se aborta en órbita baja y la tripulación vuelve a casa.` });
            return finish('abort');
          }
          if (!reached && ev.dest.id === 'moon') {
            yield entry(i, { t: day(), kind: 'fail', scene: 'burn', text: `${s.name}: sin propelente para frenar (faltan ${short} kg). La trayectoria de retorno libre trae a la tripulación de vuelta, como en el Apolo 13.` });
            return finish('freereturn');
          }
          yield entry(i, { t: day(), kind: 'fail', scene: 'burn', text: `${s.name}: el propelente se agota (faltan ${short} kg). La nave queda varada lejos de la Tierra.` });
          return finish('stranded');
        }
        sim.prop -= need;
        if (s.land) { landed = true; onSurface = true; }
        else if (onSurface) onSurface = false;
        if (s.dv > 0 || s.days > 1) departed = departed || s.region === 'deep';
        if (/Inserción|Encuentro/.test(s.name)) reached = true;
        yield entry(i, {
          t: day(), kind: 'info', scene: s.land ? 'land' : 'burn',
          text: s.dv > 0 ? `${s.name}: ${dv.toFixed(2)} km/s${sim.dvPenalty ? ' (con propulsores de maniobra)' : ''}, se usan ${fmt(need)} kg de propelente.` : `${s.name}: la etapa superior del cohete hace el encendido.`,
        });
      }

      // eventos programados en esta etapa
      ctx.at = i;
      for (const e of scheduled.get(i) ?? []) {
        if (sim.aborted) break;
        yield* decide(i, e.build(ctx, sim), e.id);
      }
      // si un evento obligó a abortar, la próxima etapa resuelve el regreso
      if (sim.aborted && !sim.abortHandled && abortTarget(i + 1) > i + 1) continue;

      if (s.type === 'stay') {
        reached = true;
        // si se decidió abortar aquí, solo se queda lo justo para preparar el regreso
        const days = sim.aborted ? 1 : Math.max(1, s.days * sim.stayFactor + sim.stayExtra);
        sim.stayExtra = 0;
        sim.stayDone += days;
        elapse(days, s.region ?? 'deep');
        yield entry(i, { t: day(), kind: 'ok', scene: s.region === 'surface' ? 'land' : 'stay', text: `${s.name} durante ${fmt(days)} días.` });
      } else if (s.type === 'burn' || s.type === 'launch') {
        elapse(s.days ?? 0, s.region ?? 'deep');
        if (i === lastBurnIdx) sim.backhaulDays += s.days ?? 0;
      }

      if (sim.cons < 0) {
        yield entry(i, { t: day(), kind: 'fail', scene: 'stay', text: 'Se acaban el agua, el oxígeno y la comida antes de volver. La tripulación no sobrevive.' });
        return finish('cons');
      }

      if (s.type === 'reentry') {
        const speed = !reached && !departed ? 7.8 : s.speed;
        if (ev.ship.shield.maxEntry < speed) {
          yield entry(i, { t: day(), kind: 'fail', scene: 'reentry', text: `Reentrada a ${speed.toFixed(1)} km/s: el escudo (${ev.ship.shield.maxEntry || 0} km/s) no resiste.` });
          return finish('reentry');
        }
        yield entry(i, { t: day(), kind: 'ok', scene: 'reentry', text: `Reentrada a ${speed.toFixed(1)} km/s y amerizaje. ¡Bienvenidos a casa!` });
      }
    }
    return finish(outcome);

    function finish(end) {
      const lostCrew = ['stranded', 'reentry', 'cons'].includes(end);
      const crewHome = !lostCrew;
      // ciencia: datos que llegan por radio/láser + muestras que vuelven con la tripulación
      const dataInstr = ev.instruments.filter((x) => x.kind === 'datos' && usable(x, ev));
      const generated = reached ? dataInstr.reduce((a, x) => a + x.data, 0) * sim.stayDone : 0;
      const sendDays = Math.max(0, sim.stayDone + sim.backhaulDays - sim.commsLostDays);
      const sent = Math.min(generated, ev.comms.perDay * sendDays) * (1 - sim.dataCorruption);
      const dataFraction = generated > 0 ? sent / generated : 1;
      let science = 0;
      if (reached) {
        for (const ins of ev.instruments) {
          if (!usable(ins, ev)) continue;
          science += ins.value[ev.dest.sci] * (ins.kind === 'datos' ? dataFraction : crewHome ? 1 : 0);
        }
        if (roles.has('cientifico')) science *= 1.25;
        science *= sim.scienceMult;
      }
      const explore = reached && crewHome ? ev.dest.explore + (landed ? 45 : 0) : 0;
      const overrun = Math.max(0, ev.cost / ev.program.budget - 1);
      // cada mSv suma riesgo de cáncer: la puntuación baja con la dosis y cae fuerte si se pasa el límite de carrera
      const doseFactor = sim.dose <= CAREER_DOSE ? 1 - 0.25 * (sim.dose / CAREER_DOSE) : 0.6;
      const healthy = doseFactor * Math.max(0.5, sim.health / 100);
      const factor = end === 'ok' ? 1 : end === 'freereturn' || end === 'abort' ? 0.4 : 0;
      const score = lostCrew ? 0 : Math.round((science * 8 + explore) * healthy * Math.max(0, 1 - overrun * 2) * factor);
      const grade = lostCrew ? 'F' : score >= 260 ? 'S' : score >= 180 ? 'A' : score >= 110 ? 'B' : score >= 50 ? 'C' : 'D';
      if (overrun > 0 && !lostCrew) log.push({ t: 'Revisión', kind: 'warn', text: `Sobrecosto de ${(overrun * 100).toFixed(0)} %: el Congreso recorta la puntuación.` });
      if (sim.dose > CAREER_DOSE && !lostCrew) log.push({ t: 'Revisión', kind: 'warn', text: `La tripulación superó el límite de radiación de carrera (${fmt(sim.dose)} mSv).` });
      return {
        ok: end === 'ok', outcome: end, lostCrew, log, decisions, seed,
        science, explore, score, grade, landed, reached,
        dose: sim.dose, days: sim.day, health: sim.health,
        dataGenerated: generated, dataSent: sent, dataFraction,
        samplesHome: crewHome && reached && ev.instruments.some((x) => x.kind === 'muestras' && usable(x, ev)),
        finalProp: Math.max(0, sim.prop), finalCons: Math.max(0, sim.cons),
      };
    }
  }

  return { run };
}

/** Vuelo completo eligiendo siempre la opción prudente (pruebas e informe «qué pasaría si»). */
export function simulate(state, ev, nasa = {}, opts = {}) {
  const gen = createFlight(state, ev, nasa, opts).run();
  let r = gen.next();
  while (!r.done) {
    const d = r.value.decision;
    r = gen.next(d ? (d.options.find((o) => o.auto && !o.disabled) ?? d.options.find((o) => !o.disabled)).id : undefined);
  }
  return r.value;
}

/** La tormenta del vuelo es real: el evento de partículas (SEP) o la fulguración más fuerte de DONKI. */
function stormSource(seps, flares) {
  if (seps.length) {
    const sep = seps[seps.length - 1];
    return { kind: 'SEP', date: (sep.eventTime || '').slice(0, 10) };
  }
  const rank = (c = '') => (c[0] === 'X' ? 100 : c[0] === 'M' ? 10 : 0) * (parseFloat(c.slice(1)) || 1);
  const strong = flares.filter((f) => /^[XM]/i.test(f.classType || '')).sort((a, b) => rank(b.classType) - rank(a.classType))[0];
  return strong ? { kind: 'FLR', classType: strong.classType, date: (strong.peakTime || strong.beginTime || '').slice(0, 10) } : null;
}

export function hash(str) {
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
