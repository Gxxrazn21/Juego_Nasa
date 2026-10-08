import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hohmann, rocketDeltaV, propellantFor, neoRendezvous, solarPower, MU_SUN, AU_KM } from '../src/physics.js';
import { defaultState, evaluate, simulate } from '../src/mission.js';
import { FALLBACK_NEOS } from '../src/data/catalog.js';
import { solarActivity } from '../src/nasa.js';
import { FALLBACK_FLARES } from '../src/data/fallback.js';

test('Hohmann Tierra→Marte ≈ 2.94 + 2.65 km/s, ~259 días', () => {
  const h = hohmann(AU_KM, 1.524 * AU_KM, MU_SUN);
  assert.ok(Math.abs(h.dv1 - 2.94) < 0.05, `dv1=${h.dv1}`);
  assert.ok(Math.abs(h.dv2 - 2.65) < 0.05, `dv2=${h.dv2}`);
  assert.ok(Math.abs(h.tof / 86400 - 259) < 3);
});

test('Tsiolkovsky es consistente con propellantFor', () => {
  const prop = propellantFor(2, 320, 1000);
  assert.ok(Math.abs(rocketDeltaV(320, 1000 + prop, 1000) - 2) < 1e-9);
});

test('Bennu es más accesible que Eros (inclinación 10.8°)', () => {
  const bennu = neoRendezvous(FALLBACK_NEOS[0]);
  const eros = neoRendezvous(FALLBACK_NEOS[4]);
  assert.ok(bennu.c3 < eros.c3);
  assert.ok(bennu.c3 > 0 && bennu.c3 < 40);
});

test('Potencia solar en Marte < 45 % de la de la Tierra', () => {
  assert.ok(solarPower(10, 1.524, 0.29) / solarPower(10, 1, 0.29) < 0.45);
});

test('Actividad solar con fulguraciones X es alta', () => {
  assert.ok(solarActivity(FALLBACK_FLARES).index > 1);
});

test('El diseño por defecto es lanzable y simulable', () => {
  const state = defaultState();
  const ev = evaluate(state, { neos: FALLBACK_NEOS, activity: solarActivity([]) });
  assert.equal(ev.canLaunch, true);
  const r = simulate(state, ev, FALLBACK_FLARES);
  assert.ok(r.log.length > 2);
  assert.ok(Number.isFinite(r.score));
});

test('Todos los destinos evalúan sin NaN', () => {
  for (const destination of ['leo', 'geo', 'moon', 'mars', 'neo']) {
    const ev = evaluate({ ...defaultState(), destination, neoId: '2101955' }, { neos: FALLBACK_NEOS });
    for (const c of ev.checks) assert.ok(!/NaN|undefined/.test(c.detail), `${destination}: ${c.detail}`);
  }
});
