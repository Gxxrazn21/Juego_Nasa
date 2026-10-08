// Plantillas de la interfaz (HTML como texto; los eventos se delegan en main.js).
import {
  PROGRAMS, DESTINATIONS, LAUNCHERS, BUSES, INSTRUMENTS, ANTENNAS, TRANSMITTERS,
  ENGINES, SHIELDING, SOLAR, RTG,
} from './data/catalog.js';
import { neoRendezvous, launcherCapacity } from './physics.js';
import { fmt, fmtData } from './mission.js';

export const PHASES = [
  { id: 'objective', name: 'Objetivo' },
  { id: 'craft', name: 'Nave' },
  { id: 'launch', name: 'Lanzador' },
  { id: 'review', name: 'Revisión' },
  { id: 'flight', name: 'Vuelo' },
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (m) => `US$ ${fmt(m)} M`;
const dots = (v) => '●'.repeat(Math.round(v / 2)) + '○'.repeat(5 - Math.round(v / 2));

function radio(name, value, checked, title, meta = '', aside = '', disabled = false) {
  return `<label class="option">
    <input type="radio" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
    <span class="option__name">${title}</span>
    <span class="option__aside">${aside}</span>
    ${meta ? `<span class="option__meta">${meta}</span>` : ''}
  </label>`;
}

export function phasesNav(current, ev, flown) {
  return PHASES.map((p, i) => {
    const flag = p.id === 'review' && ev.checks.some((c) => c.status === 'fail') ? 'fail' : '';
    const disabled = p.id === 'flight' && !flown;
    return `<button class="phase" data-phase="${p.id}" ${current === p.id ? 'aria-current="step"' : ''} ${flag ? `data-flag="${flag}"` : ''} ${disabled ? 'disabled' : ''}>
      <span class="phase__num">${String(i + 1).padStart(2, '0')}</span><span class="phase__name">${p.name}</span>
    </button>`;
  }).join('');
}

export function feeds(nasa) {
  const item = (label, s) => `<li class="feed" data-state="${s}" title="${s === 'live' ? 'Datos en vivo de api.nasa.gov' : s === 'fallback' ? 'Sin conexión: datos históricos reales de respaldo' : 'Cargando…'}">${label}</li>`;
  const st = (x) => (x == null ? 'loading' : x ? 'live' : 'fallback');
  return item('DONKI · clima espacial', st(nasa.weatherLive)) + item('NeoWs · asteroides', st(nasa.neosLive));
}

// ---------- 01 Objetivo ----------
export function objective(state, ev, nasa) {
  const a = nasa.activity;
  const flares = [...(nasa.flares || [])]
    .filter((f) => /^[XM]/i.test(f.classType || ''))
    .sort((x, y) => rank(y.classType) - rank(x.classType))
    .slice(0, 4);
  return `
  <p class="eyebrow">Fase 01 · Concepto</p>
  <h2>Define la misión</h2>
  <p class="lede">Elige programa y destino. Cada destino cambia la física: energía de lanzamiento, luz solar, distancia de comunicaciones y radiación.</p>

  <h3>Programa <small>techo de costo, lanzamiento incluido</small></h3>
  <div class="options">
    ${PROGRAMS.map((p) => radio('program', p.id, state.program === p.id, p.name, p.blurb, money(p.budget))).join('')}
  </div>

  <h3>Destino</h3>
  <div class="options">
    ${DESTINATIONS.map((d) => radio('destination', d.id, state.destination === d.id, d.name, d.blurb, d.short)).join('')}
  </div>

  ${state.destination === 'neo' ? neoPicker(state, nasa) : ''}

  <div class="slider">
    <label for="years">Vida útil de la misión <output class="num">${state.years} años</output></label>
    <input id="years" type="range" name="years" min="1" max="10" step="1" value="${state.years}" />
  </div>

  <h3>Clima espacial <small>NASA DONKI · ${nasa.weatherLive ? 'últimos 30 días' : 'respaldo histórico'}</small></h3>
  ${a ? `<dl class="weather">
      <dt>Actividad</dt><dd>${esc(a.label)} (índice ${a.index.toFixed(2)})</dd>
      <dt>Fulguraciones</dt><dd>${a.total} registradas · ${a.x} clase X · ${a.m} clase M</dd>
      <dt>CME</dt><dd>${(nasa.cmes || []).length} eyecciones de masa coronal</dd>
    </dl>
    ${flares.length ? `<ul class="flare-list">${flares.map((f) => `<li><span class="flare-class" ${/^X/i.test(f.classType) ? 'data-x' : ''}>${esc(f.classType)}</span><span class="num">${esc((f.peakTime || f.beginTime || '').slice(0, 10))}</span><span>${esc(f.sourceLocation || '')}</span></li>`).join('')}</ul>` : '<p class="hint">Sol tranquilo: sin fulguraciones M o X en el periodo.</p>'}
    <p class="hint">Este índice alimenta el riesgo de radiación de tu nave y los eventos de la simulación.</p>`
    : '<p class="hint">Consultando a la NASA…</p>'}

  ${nasa.apod && nasa.apod.media_type === 'image' ? `<div class="apod">
    <img src="${esc(nasa.apod.url)}" alt="${esc(nasa.apod.title)}" loading="lazy" />
    <div><strong>${esc(nasa.apod.title)}</strong>Imagen astronómica del día (APOD) · ${esc(nasa.apod.date)}</div>
  </div>` : ''}

  <div class="actions"><button class="btn btn--go" data-go="craft">Diseñar la nave →</button></div>`;
}

function rank(cls = '') {
  const c = cls.toUpperCase();
  const base = c[0] === 'X' ? 100 : c[0] === 'M' ? 10 : 1;
  return base * (parseFloat(c.slice(1)) || 1);
}

/** Asteroides ordenados por accesibilidad (C3 del lanzador + Δv de la nave). */
export function sortNeos(neos) {
  return neos
    .map((n) => ({ n, t: neoRendezvous(n) }))
    .sort((x, y) => x.t.c3 + x.t.arrivalDv * 4 - (y.t.c3 + y.t.arrivalDv * 4));
}

function neoPicker(state, nasa) {
  const neos = nasa.neos || [];
  if (!neos.length) return '<p class="hint">Cargando asteroides de NeoWs…</p>';
  const rows = sortNeos(neos).slice(0, 8);
  return `<h3>Asteroide objetivo <small>NeoWs · ${nasa.neosLive ? 'en vivo' : 'respaldo'} · ordenados por accesibilidad</small></h3>
  <div class="options">
    ${rows.map(({ n, t }) => radio('neoId', n.id, state.neoId === n.id,
      `${esc(n.name)}${n.hazardous ? '<span class="tag tag--alert">PHA</span>' : ''}`,
      `a ${n.a.toFixed(3)} UA · e ${n.e.toFixed(3)} · i ${n.i.toFixed(1)}°${n.diameterM ? ` · ~${fmt(n.diameterM)} m` : ''}`,
      `C3 ${t.c3.toFixed(1)} · Δv ${t.arrivalDv.toFixed(2)} km/s`)).join('')}
  </div>
  <p class="hint">Δv y C3 se calculan con los elementos orbitales reales del asteroide (Hohmann + cambio de plano). PHA = potencialmente peligroso.</p>`;
}

// ---------- 02 Nave ----------
export function craft(state, ev) {
  const sci = ev.dest.sci;
  return `
  <p class="eyebrow">Fase 02 · Ingeniería</p>
  <h2>Construye la nave</h2>
  <p class="lede">Todo suma masa, consume energía y cuesta dinero. Mira la barra de presupuestos abajo mientras decides.</p>

  <h3>Plataforma (bus)</h3>
  <div class="options">
    ${BUSES.map((b) => radio('bus', b.id, state.bus === b.id, b.name,
      `${b.slots} ranuras · ${b.instrMass} kg de carga útil · tanque ${fmt(b.tankMax)} kg`, `${fmt(b.dry)} kg · ${money(b.cost)}`)).join('')}
  </div>

  <h3>Instrumentos <small>${ev.instruments.length}/${ev.bus.slots} ranuras · valor en ${esc(ev.dest.short)}</small></h3>
  <div class="options">
    ${INSTRUMENTS.map((ins) => {
      const on = state.instruments.includes(ins.id);
      const full = !on && state.instruments.length >= ev.bus.slots;
      return `<label class="option">
        <input type="checkbox" name="instrument" value="${ins.id}" ${on ? 'checked' : ''} ${full ? 'disabled' : ''} />
        <span class="option__name">${ins.name}</span>
        <span class="option__aside value-dots" title="Valor científico en este destino: ${ins.value[sci]}/10">${dots(ins.value[sci])}</span>
        <span class="option__meta num">${ins.mass} kg · ${ins.power} W · ${fmtData(ins.data)}/día · ${money(ins.cost)}</span>
      </label>`;
    }).join('')}
  </div>

  <h3>Energía <small>${fmt(ev.solarAtDest)} W solares en destino (${ev.dest.sunAU.toFixed(2)} UA)</small></h3>
  <div class="slider">
    <label for="solarArea">Paneles solares <output class="num">${state.solarArea} m²</output></label>
    <input id="solarArea" type="range" name="solarArea" min="0" max="${SOLAR.maxArea}" step="0.5" value="${state.solarArea}" />
  </div>
  <p class="hint">${SOLAR.kgPerM2} kg/m² · eficiencia ${SOLAR.efficiency * 100} % · degradación al fin de vida ${Math.round((1 - SOLAR.degradation) * 100)} %.</p>
  <div class="slider">
    <label>Generadores ${RTG.name} <output class="num">${ev.rtgCount} × ${RTG.power} W</output></label>
    <div class="stepper">
      <button type="button" data-step="rtgCount" data-delta="-1" ${ev.rtgCount <= 0 ? 'disabled' : ''} aria-label="Quitar RTG">−</button>
      <span class="num">${ev.rtgCount} / ${ev.bus.maxRtg}</span>
      <button type="button" data-step="rtgCount" data-delta="1" ${ev.rtgCount >= ev.bus.maxRtg ? 'disabled' : ''} aria-label="Añadir RTG">+</button>
    </div>
  </div>
  <p class="hint">${ev.bus.maxRtg ? `Cada RTG: ${RTG.mass} kg, ${money(RTG.cost)}. Potencia constante, sin importar la distancia al Sol.` : 'Este bus es demasiado pequeño para un RTG.'}</p>

  <h3>Comunicaciones <small>${fmtData(ev.dataDownGb)}/día hacia la Red de Espacio Profundo</small></h3>
  <div class="options">
    ${ANTENNAS.map((a) => radio('antenna', a.id, state.antenna === a.id, a.name, '', `${a.mass} kg · ${money(a.cost)}`)).join('')}
  </div>
  <div class="options">
    ${TRANSMITTERS.map((t) => radio('tx', t.id, state.tx === t.id, `Transmisor ${t.name}`, '', `${t.mass} kg · consume ${fmt(t.power / 0.35)} W`)).join('')}
  </div>

  <h3>Propulsión <small>necesitas ${ev.dvRequired.toFixed(2)} km/s</small></h3>
  <div class="options">
    ${ENGINES.map((e) => radio('engine', e.id, state.engine === e.id, e.name,
      e.power ? `Requiere ${fmt(e.power)} W · vuelo ${e.timeFactor}× más lento` : '', `Isp ${e.isp} s · ${money(e.cost)}`)).join('')}
  </div>
  <div class="slider">
    <label for="propellant">Propelente <output class="num">${fmt(ev.propellant)} kg</output></label>
    <input id="propellant" type="range" name="propellant" min="0" max="${ev.bus.tankMax}" step="${Math.max(0.5, ev.bus.tankMax / 400)}" value="${ev.propellant}" />
  </div>
  <p class="hint">Con este diseño: <strong class="num">${ev.dvAvailable.toFixed(2)} km/s</strong>. Para ${ev.dvRequired.toFixed(2)} km/s harían falta ~<strong class="num">${fmt(ev.propNeeded)} kg</strong>${ev.propNeeded > ev.bus.tankMax ? ' (¡más de lo que cabe en el tanque!)' : ''}.
    <button type="button" class="btn btn--small" data-autoprop>Ajustar</button></p>

  <h3>Blindaje contra radiación</h3>
  <div class="options">
    ${SHIELDING.map((s) => radio('shielding', s.id, state.shielding === s.id, s.name,
      s.reduce ? `Reduce el riesgo ${s.reduce * 100} %` : '', s.massFrac ? `+${s.massFrac * 100} % masa · ${money(s.cost)}` : '—')).join('')}
  </div>

  <div class="actions"><button class="btn btn--go" data-go="launch">Elegir lanzador →</button></div>`;
}

// ---------- 03 Lanzador ----------
export function launch(state, ev) {
  return `
  <p class="eyebrow">Fase 03 · Lanzamiento</p>
  <h2>Elige el cohete</h2>
  <p class="lede">Tu nave pesa <strong class="num">${fmt(ev.wetMass)} kg</strong> cargada (incluye ${Math.round(0.15 * 100)} % de margen de diseño). Destino: <strong>${esc(ev.dest.launchTarget === 'ESC' ? `escape con C3 = ${ev.dest.c3.toFixed(1)} km²/s²` : ev.dest.launchTarget)}</strong>.</p>
  <div class="options">
    ${LAUNCHERS.map((lv) => {
      const cap = launcherCapacity(lv, ev.dest.launchTarget, ev.dest.c3);
      const pct = cap > 0 ? Math.min(100, (ev.wetMass / cap) * 100) : 100;
      const over = ev.wetMass > cap;
      return `<label class="option">
        <input type="radio" name="launcher" value="${lv.id}" ${state.launcher === lv.id ? 'checked' : ''} />
        <span class="option__name">${lv.name} <small class="maker">${lv.maker}</small></span>
        <span class="option__aside num">${money(lv.cost)}</span>
        <span class="option__meta num">${cap > 0 ? `Capacidad ${fmt(cap)} kg` : 'No alcanza este destino'} · fiabilidad ${(lv.reliability * 100).toFixed(0)} %</span>
        <span class="lv-bar" ${over ? 'data-over' : ''}><span style="width:${pct}%"></span></span>
      </label>`;
    }).join('')}
  </div>
  <p class="hint">Capacidades aproximadas de datos públicos. Para destinos de escape usamos un modelo lineal: la capacidad cae a cero al llegar al C3 máximo del cohete.</p>
  <div class="actions"><button class="btn btn--go" data-go="review">Revisión de diseño →</button></div>`;
}

// ---------- 04 Revisión ----------
const PART_COLORS = ['oklch(0.35 0.03 265)', 'oklch(0.66 0.19 42)', 'oklch(0.55 0.1 250)', 'oklch(0.45 0.05 150)', 'oklch(0.72 0.12 85)', 'oklch(0.5 0.12 20)', 'oklch(0.62 0.02 265)', 'oklch(0.8 0.05 60)'];

function stack(obj) {
  const entries = Object.entries(obj).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
  return `<div class="stack" role="img" aria-label="${entries.map(([k, v]) => `${k} ${fmt(v)}`).join(', ')}">
    ${entries.map(([, v], i) => `<span style="width:${(v / total) * 100}%;background:${PART_COLORS[i % PART_COLORS.length]}"></span>`).join('')}
  </div>
  <ul class="legend">${entries.map(([k, v], i) => `<li><i style="background:${PART_COLORS[i % PART_COLORS.length]}"></i>${k} <span class="num">${fmt(v)}</span></li>`).join('')}</ul>`;
}

export function review(state, ev) {
  const fails = ev.checks.filter((c) => c.status === 'fail').length;
  const warns = ev.checks.filter((c) => c.status === 'warn').length;
  const icon = { ok: '✓', warn: '!', fail: '✕' };
  return `
  <p class="eyebrow">Fase 04 · Revisión de diseño (PDR)</p>
  <h2>${fails ? `${fails} problema${fails > 1 ? 's' : ''} crítico${fails > 1 ? 's' : ''}` : warns ? 'Lista, con riesgos' : 'Lista para volar'}</h2>
  <p class="lede">Un panel de ingenieros revisa tu diseño contra la física y los datos de la NASA. Toca cada punto para entender por qué importa.</p>
  <ul class="checks">
    ${ev.checks.map((c) => `<li><details class="check" data-status="${c.status}">
      <summary><span class="check__icon" aria-label="${c.status}">${icon[c.status]}</span><span class="check__label">${c.label}</span><span class="check__detail">${c.detail}</span></summary>
      <p class="check__why">${c.why}</p>
    </details></li>`).join('')}
  </ul>

  <h3>Masa seca <small class="num">${fmt(ev.dryMass)} kg con margen</small></h3>
  ${stack(ev.parts)}
  <h3>Costo <small class="num">${money(ev.cost)}</small></h3>
  ${stack(ev.costs)}

  <div class="actions">
    <button class="btn btn--go" data-launch ${ev.canLaunch ? '' : 'disabled'}>${ev.canLaunch ? 'Lanzar misión' : 'El cohete no puede con esta nave'}</button>
    <button class="btn" data-go="craft">Volver a la nave</button>
  </div>
  ${fails && ev.canLaunch ? '<p class="hint">Puedes lanzar con fallas: la simulación mostrará sus consecuencias.</p>' : ''}`;
}

// ---------- 05 Vuelo ----------
export function flight(state, ev, result, revealed, done) {
  const items = result.log.slice(0, revealed);
  return `
  <p class="eyebrow">Fase 05 · Operaciones</p>
  <h2>${done ? (result.ok ? 'Misión cumplida' : 'Misión perdida') : 'En vuelo…'}</h2>
  <p class="lede">${esc(ev.dest.name)} · ${ev.dest.id === 'leo' ? 'puesta en órbita inmediata' : `${fmt(result.days)} días de crucero`} · eventos solares reales de NASA DONKI.</p>
  <ol class="log">
    ${items.map((l) => `<li data-kind="${l.kind}"><time>${esc(l.t)}</time><span>${esc(l.text)}${l.source ? `<span class="src">${l.source}</span>` : ''}</span></li>`).join('')}
  </ol>
  ${done ? `<div class="result">
      <div class="grade" aria-label="Calificación">${result.grade}</div>
      <dl>
        <dt>Puntuación</dt><dd>${fmt(result.score)}</dd>
        <dt>Ciencia</dt><dd>${result.science.toFixed(1)} pts</dd>
        <dt>Eficiencia</dt><dd>${result.efficiency.toFixed(2)} pts / US$100 M</dd>
        <dt>Costo</dt><dd>${money(ev.cost)}</dd>
      </dl>
    </div>
    <div class="actions">
      <button class="btn btn--go" data-go="craft">Rediseñar</button>
      <button class="btn" data-copy>Copiar informe</button>
    </div>` : ''}`;
}

// ---------- Presupuestos ----------
export function budgets(ev) {
  const status = (id) => ev.checks.find((c) => c.id === id)?.status ?? 'ok';
  const meter = (label, value, used, limit, st, note) => {
    const max = Math.max(used, limit) * 1.1 || 1;
    return `<div class="meter" data-status="${st}">
      <div class="meter__head"><span class="meter__label">${label}</span><span class="meter__value">${value}</span></div>
      <div class="meter__track"><div class="meter__fill" style="width:${(used / max) * 100}%"></div><div class="meter__limit" style="left:${(limit / max) * 100}%"></div></div>
      <p class="meter__note">${note}</p>
    </div>`;
  };
  return [
    meter('Masa', `${fmt(ev.wetMass)} kg`, ev.wetMass, ev.capacity, status('launch'), `límite ${ev.lv.name}: ${fmt(ev.capacity)} kg`),
    meter('Δv', `${ev.dvAvailable.toFixed(2)} km/s`, ev.dvAvailable, ev.dvRequired, status('dv') === 'ok' ? 'ok' : status('dv'), `requiere ${ev.dvRequired.toFixed(2)} km/s`),
    meter('Potencia', `${fmt(ev.powerNeed)} W`, ev.powerNeed, ev.powerGen, status('power'), `genera ${fmt(ev.powerGen)} W`),
    meter('Datos', `${fmtData(ev.dataNeedGb)}/d`, ev.dataNeedGb, ev.dataDownGb, status('data'), `enlace ${fmtData(ev.dataDownGb)}/d`),
    meter('Costo', money(ev.cost), ev.cost, ev.program.budget, status('budget'), `techo ${money(ev.program.budget)}`),
  ].join('');
}
