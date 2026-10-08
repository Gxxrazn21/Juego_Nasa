import './styles.css';
import { createStage } from './scene/stage.js';
import { defaultState, evaluate, simulate, newCrewMember, paintHex, accentHex, fmt } from './mission.js';
import { loadSpaceWeather, loadNeos, loadApod, solarActivity } from './nasa.js';
import { SUITS, ROLES, SUIT_COLORS } from './data/crew.js';
import { PARTS } from './data/parts.js';
import * as ui from './ui.js';

const STORAGE_KEY = 'deltav.crewed.v1';

const state = restore() ?? defaultState();
const nasa = { flares: [], cmes: [], neos: [], activity: null, weatherLive: null, neosLive: null, apod: null };
let phase = 'mission';
let slot = 'capsule';
let flightRun = null; // { result, revealed, done }

const $sheet = document.getElementById('sheet');
const $phases = document.getElementById('phases');
const $budgets = document.getElementById('budgets');
const $feeds = document.getElementById('feeds');
const stage = createStage(document.getElementById('stage'));

if (import.meta.env.DEV) window.__deltav = { stage, state };

let ev = evaluate(state, nasa);
let lastShipKey = '';
let lastCrewKey = '';

// ---------- apariencia (traje y nave) ----------
function suitLook() {
  const suit = SUITS.find((s) => s.id === state.look.suit) ?? SUITS[0];
  const colors = {
    suit: (SUIT_COLORS.find((c) => c.id === state.look.suitColor) ?? SUIT_COLORS[0]).hex, // null = original
    accent: accentHex(state.ship.accent),
    stripes: state.crew.map((c) => ROLES.find((r) => r.id === c.role)?.stripe ?? '#c8242b'),
  };
  return { suit, colors };
}
function shipLook() {
  return { paint: paintHex(state.ship.paint), accent: accentHex(state.ship.accent), patch: state.look.patch, agency: state.look.agency };
}

function syncScene() {
  const shipKey = JSON.stringify([state.ship, state.instruments, state.look.patch, state.look.agency]);
  if (shipKey !== lastShipKey) {
    stage.setShip(ev, shipLook());
    lastShipKey = shipKey;
    if (stage.mode === 'hangar') stage.focusSlot(slot);
  }
  const crewKey = JSON.stringify([state.crew, state.look.suit, state.look.suitColor, state.ship.accent]);
  if (crewKey !== lastCrewKey) {
    const { suit, colors } = suitLook();
    stage.setCrew(state, suit, colors);
    lastCrewKey = crewKey;
  }
}

function render({ sheet = true } = {}) {
  ev = evaluate(state, nasa);
  $phases.innerHTML = ui.phasesNav(phase, ev, !!flightRun);
  $budgets.innerHTML = ui.budgets(ev);
  $feeds.innerHTML = ui.feeds(nasa);
  syncScene();
  if (!sheet) return;
  const scroll = $sheet.scrollTop;
  switch (phase) {
    case 'mission': $sheet.innerHTML = ui.mission(state, ev, nasa); break;
    case 'crew': $sheet.innerHTML = ui.crew(state, ev); break;
    case 'hangar': $sheet.innerHTML = ui.hangar(state, ev, slot); break;
    case 'route': $sheet.innerHTML = ui.route(state, ev); break;
    case 'review': $sheet.innerHTML = ui.review(state, ev); break;
    case 'flight': $sheet.innerHTML = ui.flight(state, ev, flightRun.result, flightRun.revealed, flightRun.done); break;
  }
  $sheet.scrollTop = scroll;
  persist();
}

function sceneFor(p) {
  if (p === 'mission' || p === 'route') {
    stage.setMode('map');
    stage.showMap(ev);
  } else if (p === 'crew') stage.setMode('crew');
  else if (p === 'hangar') { stage.setMode('hangar'); stage.focusSlot(slot); }
  else if (p === 'review') { stage.setMode('hangar'); stage.focusSlot('all'); }
}

function goPhase(next) {
  if (next === 'flight' && !flightRun) return;
  phase = next;
  if (next !== 'flight') flightRun = null;
  render();
  sceneFor(next);
  enter();
  $sheet.scrollTop = 0;
  $sheet.focus({ preventScroll: true });
}

let enterTimer;
function enter() {
  $sheet.classList.remove('is-entering');
  void $sheet.offsetWidth;
  $sheet.classList.add('is-entering');
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => $sheet.classList.remove('is-entering'), 700);
}

// ---------- vuelo ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchMission() {
  ev = evaluate(state, nasa);
  if (!ev.canLaunch) return;
  const result = simulate(state, ev, nasa.flares);
  const run = { result, revealed: 0, done: false };
  flightRun = run;
  phase = 'flight';
  stage.setMode('map');
  stage.showMap(ev, { progress: 0 });
  render();
  enter();
  const n = result.log.length;
  for (let i = 0; i < n; i++) {
    if (flightRun !== run) return;
    const entry = result.log[i];
    run.revealed = i + 1;
    if (entry.scene === 'dock') {
      const { suit, colors } = suitLook();
      stage.setMode('dock');
      stage.showDock(entry.station, ev, { ...shipLook(), suit, colors });
      render();
      $sheet.scrollTop = $sheet.scrollHeight;
      await sleep(5200);
      if (flightRun !== run) return;
      stage.setMode('map');
      stage.showMap(ev, { progress: i / n });
    } else {
      stage.setProgress((i + 1) / n);
      render();
      $sheet.scrollTop = $sheet.scrollHeight;
      await sleep(1500);
    }
  }
  if (flightRun !== run) return;
  run.done = true;
  render();
  $sheet.scrollTop = $sheet.scrollHeight;
}

// ---------- propelente justo ----------
function autoPropellant() {
  const cap = ev.tankCapacity;
  const works = (load) => {
    const e = evaluate({ ...state, propLoad: load }, nasa);
    return e.route.failure?.reason !== 'prop' && e.route.finalProp >= cap * 0.05;
  };
  if (!works(cap)) { state.propLoad = cap; return; }
  let lo = 0, hi = cap;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (works(mid)) hi = mid; else lo = mid;
  }
  state.propLoad = Math.ceil(hi / 10) * 10;
}

// ---------- eventos ----------
$phases.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-phase]');
  if (btn && !btn.disabled) goPhase(btn.dataset.phase);
});

$sheet.addEventListener('click', (e) => {
  const t = e.target;
  const go = t.closest('[data-go]');
  if (go) return goPhase(go.dataset.go);
  if (t.closest('[data-launch]')) return launchMission();
  const tab = t.closest('[data-slot]');
  if (tab) {
    slot = tab.dataset.slot;
    render();
    stage.focusSlot(slot);
    return;
  }
  const step = t.closest('[data-step]');
  if (step) {
    const key = step.dataset.step;
    state[key] = Math.max(1, state[key] + Number(step.dataset.delta));
    if (key === 'launches' && state.launches > 1) state.direct = false;
    return render();
  }
  if (t.closest('[data-add-crew]')) {
    if (state.crew.length < ev.ship.capsule.seats) state.crew.push(newCrewMember(state));
    return render();
  }
  const rm = t.closest('[data-remove-crew]');
  if (rm) {
    state.crew.splice(Number(rm.dataset.removeCrew), 1);
    return render();
  }
  if (t.closest('[data-autoprop]')) {
    autoPropellant();
    return render();
  }
  if (t.closest('[data-copy]')) copyReport(t.closest('[data-copy]'));
});

$sheet.addEventListener('input', (e) => {
  const { name, value, type } = e.target;
  if (!name) return;
  if (type === 'range' && name === 'propLoad') {
    state.propLoad = Number(value);
    const out = e.target.closest('.slider')?.querySelector('output');
    if (out) out.textContent = `${fmt(+value)} kg`;
    render({ sheet: false });
  } else if (type === 'text') {
    applyPath(name, value);
    render({ sheet: false });
  }
});

$sheet.addEventListener('change', (e) => {
  const { name, value, type, checked } = e.target;
  if (!name) return;
  if (type === 'range' || type === 'text') return render();
  if (name === 'instrument') {
    state.instruments = checked ? [...state.instruments, value] : state.instruments.filter((x) => x !== value);
  } else if (name === 'stop') {
    state.stops = checked ? [...new Set([...state.stops, value])] : state.stops.filter((x) => x !== value);
  } else if (type === 'checkbox') {
    state[name] = checked;
  } else {
    applyPath(name, value);
  }
  // reglas de consistencia
  if (name === 'ship.capsule') state.crew = state.crew.slice(0, PARTS.capsule.find((c) => c.id === value).seats);
  if (name === 'destination') {
    ensureNeo();
    if (value === 'iss') state.land = false;
  }
  render();
  if (['destination', 'neoId', 'land'].includes(name) || (phase === 'route' && ['stop', 'direct', 'launcher'].includes(name))) {
    stage.showMap(ev);
  }
});

function applyPath(name, value) {
  const parts = name.split('.');
  if (parts.length === 1) { state[name] = value; return; }
  if (parts[0] === 'crew') {
    const member = state.crew[Number(parts[1])];
    if (member) member[parts[2]] = value;
    return;
  }
  state[parts[0]][parts[1]] = value;
}

function ensureNeo() {
  if (state.destination === 'neo' && !nasa.neos.some((n) => n.id === state.neoId)) {
    state.neoId = ui.sortNeos(nasa.neos)[0]?.n.id ?? null;
  }
}

async function copyReport(btn) {
  const r = flightRun.result;
  const text = [
    `Δv · Arquitecto de Misiones — Informe de vuelo`,
    `Misión ${state.look.patch} (${state.look.agency}) → ${ev.dest.name} · ${fmt(ev.routeDays)} días`,
    `Tripulación: ${state.crew.map((c) => `${c.name} (${ROLES.find((x) => x.id === c.role)?.name})`).join(', ')}`,
    `Nave: ${ev.ship.capsule.name} + ${ev.ship.engine.name} · ${fmt(ev.wetMass)} kg · ${ev.lv.name} ×${state.launches}`,
    `Escalas: ${ev.route.steps.filter((s) => s.type === 'dock').map((s) => s.refill.station.short).join(', ') || 'ninguna'}`,
    `Resultado: ${r.grade} · ${r.score} puntos · costo US$ ${fmt(ev.cost)} M`,
  ].join('\n');
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copiado ✓';
  } catch {
    btn.textContent = 'No se pudo copiar';
  }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* modo privado */ }
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return null;
    const base = defaultState();
    return { ...base, ...saved, ship: { ...base.ship, ...saved.ship }, look: { ...base.look, ...saved.look } };
  } catch {
    return null;
  }
}

// ---------- arranque y datos NASA ----------
async function boot() {
  render();
  sceneFor(phase);
  enter();
  const [weather, neos, apod] = await Promise.all([loadSpaceWeather(), loadNeos(), loadApod()]);
  Object.assign(nasa, {
    flares: weather.flares,
    cmes: weather.cmes,
    weatherLive: weather.live,
    activity: solarActivity(weather.flares),
    neos: neos.neos,
    neosLive: neos.live,
    apod,
  });
  ensureNeo();
  render();
  if (phase === 'mission') stage.showMap(ev);
}

boot();
