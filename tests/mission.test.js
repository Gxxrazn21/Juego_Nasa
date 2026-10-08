import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, evaluate, simulate } from '../src/mission.js';
import { FALLBACK_NEOS } from '../src/data/catalog.js';
import { FALLBACK_FLARES } from '../src/data/fallback.js';

const nasa = { neos: FALLBACK_NEOS };
const variant = (patch) => {
  const base = defaultState();
  return { ...base, ...patch, ship: { ...base.ship, ...(patch.ship ?? {}) } };
};
const status = (ev, id) => ev.checks.find((c) => c.id === id)?.status;

test('La misión lunar por defecto (Orion + SLS + Gateway) vuelve a casa', () => {
  const s = defaultState();
  const ev = evaluate(s, nasa);
  assert.equal(ev.canLaunch, true);
  assert.equal(ev.route.failure, null);
  const r = simulate(s, ev, FALLBACK_FLARES);
  assert.equal(r.lostCrew, false);
  assert.ok(r.score > 0);
});

test('Sin la escala en Gateway, el propelente no alcanza para volver', () => {
  const ev = evaluate(variant({ stops: [] }), nasa);
  assert.equal(ev.route.failure?.reason, 'prop');
  assert.match(ev.route.failure.step.name, /TEI/);
});

test('Las estaciones solo venden propelentes compatibles', () => {
  // Raptor (metalox) no puede repostar en Gateway, que solo tiene hipergólicos y xenón
  const ev = evaluate(variant({ ship: { engine: 'rvac' } }), nasa);
  const dock = ev.route.steps.find((st) => st.type === 'dock');
  assert.equal(dock.refill.prop, 0);
  assert.equal(dock.refill.incompatible, true);
});

test('A Marte con soporte vital abierto se acaban los víveres', () => {
  const ev = evaluate(variant({ destination: 'mars', program: 'horizonte', stops: [] }), nasa);
  assert.equal(status(ev, 'cons'), 'fail');
  assert.equal(status(ev, 'reentry'), 'fail'); // Avcoat no soporta 12,5 km/s
});

test('Un escudo ablativo básico no sirve para volver de la Luna', () => {
  const ev = evaluate(variant({ ship: { shield: 'ablative' } }), nasa);
  assert.equal(status(ev, 'reentry'), 'fail');
});

test('Alunizar con el AJ10 no tiene empuje suficiente', () => {
  const ev = evaluate(variant({ land: true, ship: { legs: 'lunar' } }), nasa);
  assert.equal(status(ev, 'landing'), 'fail');
});

test('Un cohete sin certificación humana obliga a lanzar la tripulación aparte', () => {
  const ev = evaluate(variant({ launcher: 'falconheavy', direct: false, stops: [] }), nasa);
  assert.equal(ev.crewLaunch, true);
  assert.equal(status(ev, 'crewrated'), 'warn');
});

test('Todos los destinos evalúan y simulan sin NaN', () => {
  for (const destination of ['iss', 'moon', 'mars', 'neo']) {
    const s = variant({ destination, neoId: '2101955' });
    const ev = evaluate(s, nasa);
    for (const c of ev.checks) assert.ok(!/NaN|undefined/.test(c.detail), `${destination}: ${c.detail}`);
    const r = simulate(s, ev, FALLBACK_FLARES);
    assert.ok(Number.isFinite(r.score), destination);
    for (const l of r.log) assert.ok(!/NaN|undefined/.test(l.text), `${destination}: ${l.text}`);
  }
});
