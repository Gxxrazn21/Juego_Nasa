import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, evaluate, presetState } from '../src/mission.js';
import { createFlight, simulate } from '../src/flight.js';
import { debrief } from '../src/debrief.js';
import { engineFailure } from '../src/data/events.js';
import { CHALLENGES, medalFor, matches } from '../src/data/challenges.js';
import { PRESETS } from '../src/data/presets.js';
import { FALLBACK_NEOS } from '../src/data/catalog.js';
import { FALLBACK_FLARES } from '../src/data/fallback.js';

const nasa = { neos: FALLBACK_NEOS, flares: FALLBACK_FLARES };
const preset = (id) => presetState(defaultState(), PRESETS.find((p) => p.id === id), nasa);

/** Vuela respondiendo a cada decisión con `pick(decisión)`. */
function fly(state, pick) {
  const ev = evaluate(state, nasa);
  const gen = createFlight(state, ev, nasa).run();
  const seen = [];
  let r = gen.next();
  while (!r.done) {
    const d = r.value.decision;
    if (d) seen.push(d);
    r = gen.next(d ? pick(d) : undefined);
  }
  return { result: r.value, seen, ev };
}

test('Una misión a Marte presenta decisiones con opciones reales', () => {
  const { seen } = fly(preset('ares'), (d) => d.options.find((o) => o.auto).id);
  assert.ok(seen.length >= 3, 'al menos tres decisiones en un viaje de más de un año');
  for (const d of seen) {
    assert.ok(d.title && d.text && d.fact, d.id);
    assert.ok(d.options.length >= 2, d.id);
    for (const o of d.options) assert.ok(!/NaN|undefined/.test(o.preview), `${d.id}: ${o.preview}`);
  }
  assert.ok(seen.some((d) => d.id === 'storm'), 'la tormenta solar usa datos DONKI');
  assert.ok(seen.some((d) => d.id === 'conjunction'), 'Marte tiene conjunción solar');
});

test('Quedarse fuera del refugio en la tormenta solar sube la dosis', () => {
  const s = preset('artemis');
  const shelter = fly(s, (d) => (d.id === 'storm' ? 'shelter' : d.options.find((o) => o.auto).id)).result;
  const exposed = fly(s, (d) => (d.id === 'storm' ? 'continue' : d.options.find((o) => o.auto).id)).result;
  assert.ok(exposed.dose > shelter.dose + 50, `${exposed.dose} vs ${shelter.dose}`);
});

test('La misma nave repite los mismos eventos (semilla determinista)', () => {
  const s = preset('vigia');
  const a = simulate(s, evaluate(s, nasa), nasa);
  const b = simulate(s, evaluate(s, nasa), nasa);
  assert.deepEqual(a.decisions.map((d) => d.event), b.decisions.map((d) => d.event));
  assert.equal(a.score, b.score);
});

test('No se puede abortar el encendido que trae a la tripulación de vuelta', () => {
  const s = defaultState();
  const ev = evaluate(s, nasa);
  const tei = ev.steps.find((x) => /TEI/.test(x.name));
  const card = engineFailure({ ev }, { roles: new Set(['comandante']) }, tei, { canAbort: false });
  assert.equal(card.options.find((o) => o.id === 'abort').disabled, true);
  assert.equal(card.options.find((o) => o.id === 'eva').disabled, true, 'sin ingeniería ni brazo no hay caminata');
  assert.ok(card.options.some((o) => o.auto && !o.disabled), 'siempre queda una opción prudente');
});

test('Sin escala en Gateway, el informe muestra que con ella se salva la tripulación', () => {
  const s = { ...defaultState(), stops: [] };
  const ev = evaluate(s, nasa);
  const r = simulate(s, ev, nasa);
  assert.equal(r.lostCrew, true);
  const d = debrief(s, ev, r, nasa);
  const gw = d.whatIf.find((w) => /Gateway/.test(w.label));
  assert.ok(gw?.saved, 'la escala en Gateway salva la misión');
  assert.ok(d.limits.some((l) => l.status === 'fail'));
  assert.ok(d.lessons.length > 0);
});

test('Medallas: la nave Dragon gana al menos plata en la primera expedición', () => {
  const s = preset('dragon');
  const ev = evaluate(s, nasa);
  const c = CHALLENGES.find((x) => x.id === 'iss');
  assert.equal(matches(c, ev), true);
  const medal = medalFor(c, simulate(s, ev, nasa), ev);
  assert.ok(['plata', 'oro'].includes(medal), medal);
  // otro destino no cuenta para el reto
  const moon = evaluate(preset('artemis'), nasa);
  assert.equal(medalFor(c, simulate(preset('artemis'), moon, nasa), moon), null);
});
