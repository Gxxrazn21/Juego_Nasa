import './styles.css';
import { createStage } from './scene/stage.js';
import { defaultState, evaluate, simulate, fmt } from './mission.js';
import { loadSpaceWeather, loadNeos, loadApod, solarActivity } from './nasa.js';
import * as ui from './ui.js';

const STORAGE_KEY = 'deltav.mission.v1';

const state = restore() ?? defaultState();
const nasa = { flares: [], cmes: [], neos: [], activity: null, weatherLive: null, neosLive: null, apod: null };
let phase = 'objective';
let flightRun = null; // { result, revealed, done }

const $sheet = document.getElementById('sheet');
const $phases = document.getElementById('phases');
const $budgets = document.getElementById('budgets');
const $feeds = document.getElementById('feeds');
const stage = createStage(document.getElementById('stage'));

let ev = evaluate(state, nasa);
let lastCraftKey = '';

function render({ sheet = true } = {}) {
  ev = evaluate(state, nasa);
  $phases.innerHTML = ui.phasesNav(phase, ev, !!flightRun);
  $budgets.innerHTML = ui.budgets(ev);
  $feeds.innerHTML = ui.feeds(nasa);

  const craftKey = JSON.stringify([state.bus, state.instruments, state.solarArea, state.rtgCount, state.antenna, state.engine, state.propellant > ev.bus.tankMax * 0.4]);
  if (craftKey !== lastCraftKey) {
    stage.setSpacecraft(ev);
    lastCraftKey = craftKey;
  }

  if (!sheet) return;
  const scroll = $sheet.scrollTop;
  switch (phase) {
    case 'objective': $sheet.innerHTML = ui.objective(state, ev, nasa); break;
    case 'craft': $sheet.innerHTML = ui.craft(state, ev); break;
    case 'launch': $sheet.innerHTML = ui.launch(state, ev); break;
    case 'review': $sheet.innerHTML = ui.review(state, ev); break;
    case 'flight': $sheet.innerHTML = ui.flight(state, ev, flightRun.result, flightRun.revealed, flightRun.done); break;
  }
  $sheet.scrollTop = scroll;
  persist();
}

function goPhase(next) {
  if (next === 'flight' && !flightRun) return;
  const prev = phase;
  phase = next;
  const wantsMap = next === 'objective' || next === 'flight';
  if (next !== 'flight') flightRun = null;
  if (wantsMap) stage.setMode('map', evaluate(state, nasa));
  else if (stage.mode !== 'workshop' || prev === 'flight') stage.setMode('workshop', ev);
  render();
  enter();
  $sheet.scrollTop = 0;
  $sheet.focus({ preventScroll: true });
}

let enterTimer;
function enter() {
  $sheet.classList.remove('is-entering');
  void $sheet.offsetWidth; // reinicia la animación
  $sheet.classList.add('is-entering');
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => $sheet.classList.remove('is-entering'), 700);
}

function launchMission() {
  ev = evaluate(state, nasa);
  if (!ev.canLaunch) return;
  const result = simulate(state, ev, nasa.flares);
  flightRun = { result, revealed: 1, done: false };
  phase = 'flight';
  stage.setMode('map', ev);
  render();
  enter();
  // la bitácora avanza durante el vuelo animado (~7 s)
  const step = 7000 / Math.max(1, result.log.length - 1);
  const timer = setInterval(() => {
    if (!flightRun || flightRun.result !== result) return clearInterval(timer);
    flightRun.revealed = Math.min(result.log.length, flightRun.revealed + 1);
    if (flightRun.revealed >= result.log.length) {
      flightRun.done = true;
      clearInterval(timer);
    }
    render();
    $sheet.scrollTop = $sheet.scrollHeight;
  }, step);
  stage.showMap(ev, true);
}

// ---------- eventos ----------
$phases.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-phase]');
  if (btn && !btn.disabled) goPhase(btn.dataset.phase);
});

$sheet.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) return goPhase(go.dataset.go);
  if (e.target.closest('[data-launch]')) return launchMission();
  const step = e.target.closest('[data-step]');
  if (step) {
    state[step.dataset.step] = Math.max(0, state[step.dataset.step] + Number(step.dataset.delta));
    return render();
  }
  if (e.target.closest('[data-autoprop]')) {
    state.propellant = Math.min(ev.bus.tankMax, Math.ceil(ev.propNeeded * 1.02));
    return render();
  }
  if (e.target.closest('[data-copy]')) copyReport(e.target.closest('[data-copy]'));
});

const NUMERIC = new Set(['years', 'solarArea', 'propellant', 'tx']);

$sheet.addEventListener('input', (e) => {
  const { name, value, type } = e.target;
  if (!name) return;
  if (type === 'range') {
    state[name] = Number(value);
    // durante el arrastre solo actualizamos la etiqueta y los medidores
    const out = e.target.closest('.slider')?.querySelector('output');
    if (out) out.textContent = name === 'years' ? `${value} años` : name === 'solarArea' ? `${value} m²` : `${fmt(+value)} kg`;
    render({ sheet: false });
  }
});

$sheet.addEventListener('change', (e) => {
  const { name, value, type, checked } = e.target;
  if (!name) return;
  if (name === 'instrument') {
    state.instruments = checked ? [...state.instruments, value] : state.instruments.filter((x) => x !== value);
  } else if (type !== 'range') {
    state[name] = NUMERIC.has(name) ? Number(value) : value;
  }
  if (name === 'destination') ensureNeo();
  if (name === 'bus') {
    const bus = evaluate(state, nasa).bus;
    state.instruments = state.instruments.slice(0, bus.slots);
    state.propellant = Math.min(state.propellant, bus.tankMax);
    state.rtgCount = Math.min(state.rtgCount, bus.maxRtg);
  }
  render();
  if ((name === 'destination' || name === 'neoId') && phase === 'objective') stage.setMode('map', ev);
});

async function copyReport(btn) {
  const r = flightRun.result;
  const text = [
    `Δv · Arquitecto de Misiones — Informe`,
    `Destino: ${ev.dest.name} · Programa ${ev.program.name} · ${state.years} años`,
    `Nave: ${ev.bus.name}, ${fmt(ev.wetMass)} kg, ${ev.instruments.map((i) => i.name).join(', ')}`,
    `Lanzador: ${ev.lv.name} · Costo total US$ ${fmt(ev.cost)} M`,
    `Calificación ${r.grade} · Puntuación ${r.score} · Ciencia ${r.science.toFixed(1)}`,
    `Clima espacial (NASA DONKI): actividad ${nasa.activity?.label ?? 'n/d'}`,
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
    return saved && typeof saved === 'object' ? { ...defaultState(), ...saved } : null;
  } catch {
    return null;
  }
}

function ensureNeo() {
  if (state.destination === 'neo' && !nasa.neos.some((n) => n.id === state.neoId)) {
    state.neoId = ui.sortNeos(nasa.neos)[0]?.n.id ?? null;
  }
}

// ---------- datos NASA ----------
async function boot() {
  stage.setMode('map', ev);
  render();
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
  if (phase === 'objective') stage.setMode('map', ev);
}

boot();
