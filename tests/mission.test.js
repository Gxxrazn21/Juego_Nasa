import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, evaluate, paintHex, accentHex } from '../src/mission.js';
import { simulate } from '../src/flight.js';
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
  const r = simulate(s, ev, { flares: FALLBACK_FLARES });
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
    const r = simulate(s, ev, { flares: FALLBACK_FLARES });
    assert.ok(Number.isFinite(r.score), destination);
    for (const l of r.log) assert.ok(!/NaN|undefined/.test(l.text), `${destination}: ${l.text}`);
  }
});

test('Cada entrada de la bitácora trae telemetría (día, propelente, víveres)', () => {
  const s = defaultState();
  const r = simulate(s, evaluate(s, nasa), { flares: FALLBACK_FLARES });
  for (const l of r.log.filter((x) => x.t !== 'Revisión')) {
    assert.ok(l.tele && Number.isFinite(l.tele.day) && Number.isFinite(l.tele.prop) && Number.isFinite(l.tele.cons), l.text);
  }
});

test('Los colores admiten la paleta o un hex personalizado', () => {
  assert.equal(paintHex('#12ab34'), '#12ab34');
  assert.equal(paintHex('white'), '#e9e6df');
  assert.equal(accentHex('nada'), '#f26a2e');
});

test('Todas las naves de fábrica completan su misión sin fallas', async () => {
  const { PRESETS } = await import('../src/data/presets.js');
  const { presetState } = await import('../src/mission.js');
  const { solarActivity } = await import('../src/nasa.js');
  // con el Sol en actividad extrema (respaldo de mayo de 2024)
  const hard = { neos: FALLBACK_NEOS, activity: solarActivity(FALLBACK_FLARES) };
  for (const p of PRESETS) {
    const s = presetState(defaultState(), p, hard);
    const ev = evaluate(s, hard);
    const fails = ev.checks.filter((c) => c.status === 'fail').map((c) => `${c.label}: ${c.detail}`);
    assert.deepEqual(fails, [], p.id);
    const r = simulate(s, ev, { flares: FALLBACK_FLARES });
    assert.equal(r.lostCrew, false, p.id);
    assert.ok(r.reached, `${p.id} llega a su destino`);
  }
});

test('Con antenas omnidireccionales en banda S, desde Marte la tripulación queda incomunicada', () => {
  const ev = evaluate(variant({ destination: 'mars', program: 'horizonte', ship: { comms: 'sband' } }), nasa);
  assert.equal(status(ev, 'comms'), 'fail');
  assert.equal(ev.comms.voiceOk, false);
  assert.equal(ev.comms.network, 'Red de Espacio Profundo');
});

test('Una antena más grande o el láser bajan más ciencia desde Marte', () => {
  const rate = (comms) => evaluate(variant({ destination: 'mars', program: 'horizonte', ship: { comms } }), nasa).comms.rate;
  assert.ok(rate('hgaka') > rate('hgax') * 10, 'banda Ka de 3 m ≫ banda X de 1,5 m');
  assert.ok(rate('laser') > rate('hgax'), 'el láser supera a la banda X aun con nubes');
});
