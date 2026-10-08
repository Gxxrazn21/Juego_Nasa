import './styles.css';
import { createStage } from './scene/stage.js';
import { defaultState, evaluate, simulate, newCrewMember, paintHex, accentHex, fmt, minimalPropellant, presetState } from './mission.js';
import { loadSpaceWeather, loadNeos, loadApod, solarActivity } from './nasa.js';
import { SUITS, ROLES, SUIT_COLORS } from './data/crew.js';
import { PARTS } from './data/parts.js';
import { PRESETS } from './data/presets.js';
import { FALLBACK_NEOS } from './data/catalog.js';
import { QUALITY, resolveQuality, detectQuality, hasWebGL } from './app/quality.js';
import { sfx, setSound } from './app/audio.js';
import { fileToLogo, preloadLogo } from './app/insignia.js';
import { setupInstall } from './app/pwa.js';
import * as ui from './ui/index.js';

const STORAGE_KEY = 'deltav.crewed.v1';
const PREFS_KEY = 'deltav.prefs.v1';

const state = restore() ?? defaultState();
const prefs = { quality: 'auto', sound: true, ...readJSON(PREFS_KEY) };
const nasa = { flares: [], cmes: [], neos: [], activity: null, weatherLive: null, neosLive: null, apod: null };
let phase = 'mission';
let slot = 'presets';
let presetBackup = null; // diseño anterior, para «Volver a mi diseño»
let flightRun = null; // { result, revealed, done }

const $sheet = document.getElementById('sheet');
const $phases = document.getElementById('phases');
const $budgets = document.getElementById('budgets');
const $feeds = document.getElementById('feeds');
const $loader = document.getElementById('loader');
const $countdown = document.getElementById('countdown');
setSound(prefs.sound);

// ---------- escena 3D (con alternativa si no hay WebGL) ----------
const stage = hasWebGL()
  ? createStage(document.getElementById('stage'), { quality: resolveQuality(prefs.quality), onProgress: loading, onContextLost: contextLost })
  : noStage();
if (import.meta.env.DEV) window.__deltav = { stage, state, applyPreset };

function noStage() {
  document.getElementById('stage').innerHTML = '<p class="no-webgl">Tu navegador no tiene WebGL: el juego funciona, pero sin la vista 3D.</p>';
  loading(1);
  const noop = () => {};
  return { setShip: noop, focusSlot: noop, setCrew: noop, setMode: noop, showMap: noop, setProgress: noop, showDock: noop, setQuality: noop, ignite: noop, resize: noop, mode: 'none' };
}

function contextLost() {
  // El teléfono se quedó sin memoria gráfica: tu diseño está guardado, basta con recargar
  const box = document.createElement('div');
  box.className = 'no-webgl';
  box.innerHTML = '<p>La vista 3D se detuvo para liberar memoria del teléfono.<br>Tu nave está guardada.</p><button type="button" class="btn btn--go">Recargar vista 3D</button>';
  box.querySelector('button').addEventListener('click', () => location.reload());
  document.getElementById('stage').append(box);
  if (prefs.quality !== 'baja') { prefs.quality = 'baja'; savePrefs(); }
}

function loading(p) {
  document.getElementById('loader-bar').style.transform = `scaleX(${Math.max(0.05, p)})`;
  if (p >= 1) setTimeout(() => $loader.classList.add('is-done'), 250);
}
setTimeout(() => loading(1), 15000); // nunca bloquear el juego por una textura lenta

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
  const { ship, look } = state;
  return {
    paint: paintHex(ship.paint),
    accent: accentHex(ship.accent),
    livery: ship.livery,
    finish: ship.finish,
    mli: ship.mli,
    name: ship.name,
    insignia: { ...look.insignia, accent: accentHex(ship.accent), top: look.agency, bottom: look.patch, stars: state.crew.length },
  };
}

let shipTimer;
function syncScene({ debounce = false } = {}) {
  const shipKey = JSON.stringify([state.ship, state.instruments, state.look.patch, state.look.agency, state.look.insignia, state.crew.length]);
  if (shipKey !== lastShipKey) {
    clearTimeout(shipTimer);
    const apply = () => {
      stage.setShip(ev, shipLook());
      lastShipKey = shipKey;
      if (stage.mode === 'hangar') stage.focusSlot(focusFor(slot));
    };
    if (debounce) shipTimer = setTimeout(apply, 220); else apply();
  }
  const crewKey = JSON.stringify([state.crew, state.look.suit, state.look.suitColor, state.ship.accent]);
  if (crewKey !== lastCrewKey) {
    clearTimeout(crewTimer);
    const apply = () => {
      const { suit, colors } = suitLook();
      stage.setCrew(state, suit, colors);
      lastCrewKey = crewKey;
    };
    if (debounce) crewTimer = setTimeout(apply, 400); else apply();
  }
}
let crewTimer;

const focusFor = (s) => (s === 'insignia' ? 'capsule' : s);

function render({ sheet = true, debounce = false } = {}) {
  ev = evaluate(state, nasa);
  $phases.innerHTML = ui.phasesNav(phase, ev, !!flightRun);
  $budgets.innerHTML = ui.budgets(ev);
  $feeds.innerHTML = ui.feeds(nasa);
  syncScene({ debounce });
  if (!sheet) return;
  const scroll = $sheet.scrollTop;
  switch (phase) {
    case 'mission': $sheet.innerHTML = ui.mission(state, ev, nasa); break;
    case 'crew': $sheet.innerHTML = ui.crew(state, ev); break;
    case 'hangar': $sheet.innerHTML = ui.hangar(state, ev, slot, slot === 'insignia' ? ui.insigniaPreview(shipLook().insignia) : null, {
      summaries: slot === 'presets' ? presetSummaries() : null,
      canUndo: !!presetBackup,
    }); break;
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
  else if (p === 'hangar') { stage.setMode('hangar'); stage.focusSlot(focusFor(slot)); }
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
  // en móvil, mantener visible la pestaña activa de la barra de fases
  $phases.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

let enterTimer;
function enter() {
  $sheet.classList.remove('is-entering');
  void $sheet.offsetWidth;
  $sheet.classList.add('is-entering');
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => $sheet.classList.remove('is-entering'), 700);
}

// ---------- lanzamiento y vuelo ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function countdown() {
  stage.setMode('hangar');
  stage.focusSlot('all');
  $countdown.hidden = false;
  for (const n of reduceMotion ? ['¡Despegue!'] : ['3', '2', '1', '¡Despegue!']) {
    $countdown.textContent = n;
    $countdown.classList.remove('is-tick');
    void $countdown.offsetWidth;
    $countdown.classList.add('is-tick');
    if (n === '1') stage.ignite(true);
    if (n.startsWith('¡')) sfx.launch(); else sfx.countdown();
    await sleep(reduceMotion ? 600 : 900);
  }
  stage.ignite(false);
  $countdown.hidden = true;
}

async function launchMission() {
  ev = evaluate(state, nasa);
  if (!ev.canLaunch) return;
  const result = simulate(state, ev, nasa.flares);
  const run = { result, revealed: 0, done: false };
  flightRun = run;
  phase = 'flight';
  render();
  enter();
  await countdown();
  if (flightRun !== run) return;
  stage.setMode('map');
  stage.showMap(ev, { progress: 0 });
  const n = result.log.length;
  for (let i = 0; i < n; i++) {
    if (flightRun !== run) return;
    const entry = result.log[i];
    run.revealed = i + 1;
    if (entry.kind === 'fail') sfx.alarm();
    if (entry.scene === 'dock') {
      const { suit, colors } = suitLook();
      stage.setMode('dock');
      stage.showDock(entry.station, ev, { ...shipLook(), suit, colors });
      sfx.dock();
      render();
      $sheet.scrollTop = $sheet.scrollHeight;
      await sleep(5200);
      if (flightRun !== run) return;
      stage.setMode('map');
      stage.showMap(ev, { progress: i / n });
    } else {
      if (entry.scene === 'burn' || entry.scene === 'land') sfx.burn();
      stage.setProgress((i + 1) / n);
      render();
      $sheet.scrollTop = $sheet.scrollHeight;
      await sleep(1500);
    }
  }
  if (flightRun !== run) return;
  run.done = true;
  if (result.ok) sfx.success();
  render();
  $sheet.scrollTop = $sheet.scrollHeight;
}

// ---------- naves de fábrica ----------
let summaryCache = { key: '', data: null };
function presetSummaries() {
  const key = JSON.stringify([nasa.weatherLive, nasa.neosLive, nasa.neos.length, nasa.activity?.index]);
  if (summaryCache.key !== key) {
    const data = {};
    for (const p of PRESETS) {
      ensurePresetNeo(p);
      const e = evaluate(presetState(state, p, nasa), nasa);
      data[p.id] = { dest: e.dest.short, engine: e.ship.engine.name, crew: e.crewN, days: e.routeDays, cost: e.cost, fails: e.checks.filter((c) => c.status === 'fail').length };
    }
    summaryCache = { key, data };
  }
  return summaryCache.data;
}

/** Vigía va a Apophis: si NeoWs en vivo no lo trae, se agrega desde el respaldo. */
function ensurePresetNeo(p) {
  const id = p.mission.neoId;
  if (id && !nasa.neos.some((n) => n.id === id)) {
    const neo = FALLBACK_NEOS.find((n) => n.id === id);
    if (neo) nasa.neos = [...nasa.neos, neo];
  }
}

function applyPreset(id) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;
  ensurePresetNeo(p);
  presetBackup = structuredClone(state);
  Object.assign(state, presetState(state, p, nasa));
  sfx.select();
  render();
  stage.focusSlot('all');
}

function undoPreset() {
  if (!presetBackup) return;
  Object.assign(state, presetBackup);
  presetBackup = null;
  render();
  stage.focusSlot('all');
}

// ---------- eventos ----------
$phases.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-phase]');
  if (btn && !btn.disabled) { sfx.click(); goPhase(btn.dataset.phase); }
});

$sheet.addEventListener('click', (e) => {
  const t = e.target;
  const go = t.closest('[data-go]');
  if (go) {
    sfx.select();
    if (go.dataset.open) slot = go.dataset.open;
    return goPhase(go.dataset.go);
  }
  const preset = t.closest('[data-preset]');
  if (preset) return applyPreset(preset.dataset.preset);
  if (t.closest('[data-undo-preset]')) return undoPreset();
  if (t.closest('[data-launch]')) return launchMission();
  const tab = t.closest('[data-slot]');
  if (tab) {
    sfx.click();
    slot = tab.dataset.slot;
    render();
    stage.focusSlot(focusFor(slot));
    tab.scrollIntoView({ block: 'nearest', inline: 'center' });
    return;
  }
  const step = t.closest('[data-step]');
  if (step) {
    sfx.click();
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
    state.propLoad = minimalPropellant(state, nasa);
    return render();
  }
  if (t.closest('[data-clear-logo]')) {
    state.look.insignia.upload = null;
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
  } else if (type === 'text' || type === 'color') {
    applyPath(name, value);
    if (/^ship\./.test(name)) state.presetId = null;
    if (type === 'color') {
      const dot = e.target.nextElementSibling;
      if (dot) { dot.style.background = value; dot.dataset.on = ''; }
    }
    render({ sheet: false, debounce: true });
    const preview = $sheet.querySelector('.insignia-preview');
    if (preview) preview.src = ui.insigniaPreview(shipLook().insignia);
  }
});

$sheet.addEventListener('change', async (e) => {
  const { name, value, type, checked, files } = e.target;
  if (!name) return;
  // Los textos ya se aplicaron en «input»: no se reconstruye la hoja para no perder el toque siguiente
  if (type === 'text') return persist();
  if (type === 'range') return render();
  if (type === 'file') {
    try {
      const logo = await fileToLogo(files[0]);
      await preloadLogo(logo);
      state.look.insignia.upload = logo;
      sfx.select();
    } catch (err) {
      alert(err.message);
    }
    return render();
  }
  if (name === 'instrument') {
    state.instruments = checked ? [...state.instruments, value] : state.instruments.filter((x) => x !== value);
  } else if (name === 'stop') {
    state.stops = checked ? [...new Set([...state.stops, value])] : state.stops.filter((x) => x !== value);
  } else if (type === 'checkbox') {
    state[name] = checked;
  } else {
    applyPath(name, value);
  }
  sfx.click();
  if (/^(ship|insignia)\./.test(name) || name === 'instrument') state.presetId = null;
  // reglas de consistencia
  if (name === 'ship.capsule') state.crew = state.crew.slice(0, PARTS.capsule.find((c) => c.id === value).seats);
  if (name === 'insignia.symbol') state.look.insignia.upload = null;
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
  if (parts[0] === 'insignia') { state.look.insignia[parts[1]] = value; return; }
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
    `Misión ${state.look.patch} (${state.look.agency}) · nave «${state.ship.name}» → ${ev.dest.name} · ${fmt(ev.routeDays)} días`,
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

// ---------- barra superior: vista ampliada, sonido, ajustes ----------
const $expand = document.getElementById('expand');
$expand.addEventListener('click', () => {
  const on = document.body.classList.toggle('is-expanded');
  $expand.setAttribute('aria-pressed', String(on));
  sfx.click();
  setTimeout(() => stage.resize(), 320);
});

const $mute = document.getElementById('mute');
function syncMute() {
  $mute.setAttribute('aria-pressed', String(!prefs.sound));
  $mute.setAttribute('aria-label', prefs.sound ? 'Silenciar' : 'Activar sonido');
}
$mute.addEventListener('click', () => {
  prefs.sound = !prefs.sound;
  setSound(prefs.sound);
  syncMute();
  savePrefs();
  sfx.click();
});
syncMute();

const $quality = document.getElementById('quality-options');
function renderQuality() {
  const detected = QUALITY[detectQuality()].label.toLowerCase();
  const opts = [{ id: 'auto', name: `Automática (${detected})` }, ...Object.entries(QUALITY).map(([id, q]) => ({ id, name: q.label }))];
  $quality.innerHTML = opts.map((o) => `<label class="chip"><input type="radio" name="quality" value="${o.id}" ${prefs.quality === o.id ? 'checked' : ''} /><span>${o.name}</span></label>`).join('');
  document.getElementById('quality-hint').textContent = 'Baja: sin sombras, texturas ligeras y 30 FPS, ideal para teléfonos sencillos y ahorrar batería.';
}
$quality.addEventListener('change', (e) => {
  prefs.quality = e.target.value;
  stage.setQuality(resolveQuality(prefs.quality));
  savePrefs();
});
renderQuality();
setupInstall(document.getElementById('install'), document.getElementById('install-hint'));

// ---------- persistencia ----------
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; }
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* modo privado */ }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sin espacio o modo privado */ }
}
function restore() {
  const saved = readJSON(STORAGE_KEY);
  if (!saved.ship) return null;
  const base = defaultState();
  return {
    ...base,
    ...saved,
    ship: { ...base.ship, ...saved.ship },
    look: { ...base.look, ...saved.look, insignia: { ...base.look.insignia, ...saved.look?.insignia } },
  };
}

// ---------- arranque y datos NASA ----------
async function boot() {
  render();
  sceneFor(phase);
  enter();
  if (state.look.insignia.upload) preloadLogo(state.look.insignia.upload).then(() => { lastShipKey = ''; syncScene(); });
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
