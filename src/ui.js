// Plantillas de la interfaz (HTML como texto; los eventos se delegan en main.js).
import { PROGRAMS, DESTINATIONS, LAUNCHERS, STATIONS, INSTRUMENTS } from './data/catalog.js';
import { PARTS, SLOTS, PROPELLANTS, PAINTS, ACCENTS } from './data/parts.js';
import { SUITS, ROLES, AGENCIES, SUIT_COLORS } from './data/crew.js';
import { neoRendezvous } from './physics.js';
import { fmt, availableStations, directInjection, CAREER_DOSE } from './mission.js';

export const PHASES = [
  { id: 'mission', name: 'Misión' },
  { id: 'crew', name: 'Tripulación' },
  { id: 'hangar', name: 'Hangar' },
  { id: 'route', name: 'Ruta' },
  { id: 'review', name: 'Revisión' },
  { id: 'flight', name: 'Vuelo' },
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (m) => (m >= 1e5 ? 'sin límite' : `US$ ${fmt(m)} M`);
const kg = (m) => `${fmt(m)} kg`;

function radio(name, value, checked, title, meta = '', aside = '', disabled = false) {
  return `<label class="option">
    <input type="radio" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
    <span class="option__name">${title}</span>
    <span class="option__aside">${aside}</span>
    ${meta ? `<span class="option__meta">${meta}</span>` : ''}
  </label>`;
}

function swatches(name, list, current) {
  return `<div class="swatches" role="radiogroup">${list.map((c) => `<label class="swatch" title="${esc(c.name)}">
    <input type="radio" name="${name}" value="${c.id}" ${current === c.id ? 'checked' : ''} aria-label="${esc(c.name)}" />
    <span style="background:${c.css ?? c.hex}"></span></label>`).join('')}</div>`;
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

// ---------- 01 Misión ----------
export function mission(state, ev, nasa) {
  const a = nasa.activity;
  const flares = [...(nasa.flares || [])]
    .filter((f) => /^[XM]/i.test(f.classType || ''))
    .sort((x, y) => rank(y.classType) - rank(x.classType))
    .slice(0, 4);
  return `
  <p class="eyebrow">Fase 01 · Concepto</p>
  <h2>Elige la misión</h2>
  <p class="lede">Una misión tripulada: tu personaje y su equipo deben ir y volver. Cada destino cambia el Δv, los días de víveres, la radiación y el escudo térmico necesario.</p>

  <h3>Destino</h3>
  <div class="options">
    ${DESTINATIONS.map((d) => radio('destination', d.id, state.destination === d.id, d.name, d.blurb, d.short)).join('')}
  </div>
  ${ev.dest.canLand ? `<label class="toggle"><input type="checkbox" name="land" ${state.land ? 'checked' : ''} /> <span><strong>Alunizar</strong> · descenso y ascenso de ~1,9–2,5 km/s, más ciencia y +45 puntos de exploración</span></label>` : ''}
  ${state.destination === 'neo' ? neoPicker(state, nasa) : ''}

  <h3>Programa <small>techo de costo total</small></h3>
  <div class="options">
    ${PROGRAMS.map((p) => radio('program', p.id, state.program === p.id, p.name, p.blurb, money(p.budget))).join('')}
  </div>

  <h3>Clima espacial <small>NASA DONKI · ${nasa.weatherLive ? 'últimos 30 días' : 'respaldo histórico'}</small></h3>
  ${a ? `<dl class="weather">
      <dt>Actividad</dt><dd>${esc(a.label)} (índice ${a.index.toFixed(2)})</dd>
      <dt>Fulguraciones</dt><dd>${a.total} registradas · ${a.x} clase X · ${a.m} clase M</dd>
      <dt>CME</dt><dd>${(nasa.cmes || []).length} eyecciones de masa coronal</dd>
    </dl>
    ${flares.length ? `<ul class="flare-list">${flares.map((f) => `<li><span class="flare-class" ${/^X/i.test(f.classType) ? 'data-x' : ''}>${esc(f.classType)}</span><span class="num">${esc((f.peakTime || f.beginTime || '').slice(0, 10))}</span><span>${esc(f.sourceLocation || '')}</span></li>`).join('')}</ul>` : '<p class="hint">Sol tranquilo: sin fulguraciones M o X en el periodo.</p>'}
    <p class="hint">Este índice sube la dosis de radiación de la tripulación fuera de la magnetosfera.</p>`
    : '<p class="hint">Consultando a la NASA…</p>'}

  ${nasa.apod && nasa.apod.media_type === 'image' ? `<div class="apod">
    <img src="${esc(nasa.apod.url)}" alt="${esc(nasa.apod.title)}" loading="lazy" />
    <div><strong>${esc(nasa.apod.title)}</strong>Imagen astronómica del día (APOD) · ${esc(nasa.apod.date)}</div>
  </div>` : ''}

  <div class="actions"><button class="btn btn--go" data-go="crew">Crear tripulación →</button></div>
  <p class="credits">Modelos 3D de trajes, ISS y Gateway: NASA 3D Resources (dominio público). Mapas de la Tierra: Solar System Scope (CC BY 4.0), basados en datos de la NASA. Marte: NASA.</p>`;
}

function rank(cls = '') {
  const c = cls.toUpperCase();
  return (c[0] === 'X' ? 100 : c[0] === 'M' ? 10 : 1) * (parseFloat(c.slice(1)) || 1);
}

/** Asteroides ordenados por accesibilidad (Δv total desde LEO). */
export function sortNeos(neos) {
  return neos
    .map((n) => ({ n, t: neoRendezvous(n) }))
    .sort((x, y) => x.t.departureFromLeo + x.t.arrivalDv * 2 - (y.t.departureFromLeo + y.t.arrivalDv * 2));
}

function neoPicker(state, nasa) {
  const neos = nasa.neos || [];
  if (!neos.length) return '<p class="hint">Cargando asteroides de NeoWs…</p>';
  return `<h3>Asteroide objetivo <small>NeoWs · ${nasa.neosLive ? 'en vivo' : 'respaldo'} · ordenados por accesibilidad</small></h3>
  <div class="options">
    ${sortNeos(neos).slice(0, 8).map(({ n, t }) => radio('neoId', n.id, state.neoId === n.id,
      `${esc(n.name)}${n.hazardous ? '<span class="tag tag--alert">PHA</span>' : ''}`,
      `a ${n.a.toFixed(3)} UA · e ${n.e.toFixed(3)} · i ${n.i.toFixed(1)}°${n.diameterM ? ` · ~${fmt(n.diameterM)} m` : ''} · viaje ${fmt(t.transferDays)} días`,
      `Δv ${(t.departureFromLeo + t.arrivalDv * 2).toFixed(1)} km/s`)).join('')}
  </div>
  <p class="hint">El Δv (salida + encuentro + regreso) se calcula con los elementos orbitales reales del asteroide. PHA = potencialmente peligroso.</p>`;
}

// ---------- 02 Tripulación (creación de personaje) ----------
export function crew(state, ev) {
  const me = state.crew[0];
  const seats = ev.ship.capsule.seats;
  return `
  <p class="eyebrow">Fase 02 · Personaje</p>
  <h2>Tu astronauta</h2>
  <p class="lede">Los trajes son modelos 3D reales de la NASA. El rol de cada tripulante da una ventaja en la simulación.</p>

  <div class="field-row">
    <label class="field"><span>Nombre</span><input type="text" name="crew.0.name" value="${esc(me.name)}" maxlength="24" autocomplete="off" /></label>
    <label class="field"><span>Agencia</span><select name="look.agency">${AGENCIES.map((a) => `<option ${state.look.agency === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
  </div>
  <label class="field"><span>Nombre de la misión (parche)</span><input type="text" name="look.patch" value="${esc(state.look.patch)}" maxlength="12" autocomplete="off" /></label>

  <h3>Traje</h3>
  <div class="options">
    ${SUITS.map((s) => radio('look.suit', s.id, state.look.suit === s.id, s.name, s.ref, s.era)).join('')}
  </div>
  <h3>Color del traje</h3>
  ${swatches('look.suitColor', SUIT_COLORS, state.look.suitColor)}

  <h3>Tripulación <small>${state.crew.length} de ${seats} asientos (${esc(ev.ship.capsule.name)})</small></h3>
  <ol class="crew-list">
    ${state.crew.map((c, i) => `<li>
      <span class="crew-stripe" style="background:${ROLES.find((r) => r.id === c.role)?.stripe}"></span>
      ${i === 0 ? `<strong>${esc(c.name)}</strong>` : `<input type="text" name="crew.${i}.name" value="${esc(c.name)}" maxlength="24" aria-label="Nombre del tripulante ${i + 1}" />`}
      <select name="crew.${i}.role" aria-label="Rol">${ROLES.map((r) => `<option value="${r.id}" ${c.role === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
      ${i > 0 ? `<button type="button" class="icon-btn" data-remove-crew="${i}" aria-label="Quitar a ${esc(c.name)}">✕</button>` : '<span></span>'}
    </li>`).join('')}
  </ol>
  <button type="button" class="btn btn--small" data-add-crew ${state.crew.length >= seats ? 'disabled' : ''}>+ Añadir tripulante</button>
  <ul class="perks">${ROLES.map((r) => `<li><span class="crew-stripe" style="background:${r.stripe}"></span><strong>${r.name}:</strong> ${r.perk}</li>`).join('')}</ul>
  <p class="hint">Cada persona suma ${100} kg y consume víveres cada día. Las franjas de color en el traje identifican el rol, como las franjas rojas del comandante en los trajes EMU reales.</p>

  <div class="actions"><button class="btn btn--go" data-go="hangar">Ir al hangar →</button></div>`;
}

// ---------- 03 Hangar ----------
function partStats(slot, p, ev) {
  switch (slot) {
    case 'capsule': return `${p.seats} asientos · ${p.volume} m³ · víveres ${kg(p.storage)} · ${p.slots} ciencia`;
    case 'habitat': return p.id === 'none' ? 'Más ligero, pero apretado' : `+${p.volume} m³ · víveres +${kg(p.storage)} · +${p.slots} ciencia`;
    case 'engine': return `Isp ${p.isp} s · empuje ${p.thrust >= 1 ? `${fmt(p.thrust)} kN` : `${(p.thrust * 1000).toFixed(1)} N`} · ${PROPELLANTS[p.prop].name}${p.power ? ` · ${fmt(p.power / 1000)} kW` : ''}`;
    case 'tanks': {
      const pd = PROPELLANTS[ev.ship.engine.prop];
      return `${kg(p.capacity)} de ${pd.name.toLowerCase()} · tanque ${kg(p.capacity * pd.tankFrac)} · ${fmt(p.capacity / pd.density)} m³`;
    }
    case 'power': return `${fmt(p.output / 1000)} kW ${p.solar ? 'a 1 UA (cae con 1/d²)' : 'constantes'}`;
    case 'life': return `${p.rate} kg/persona/día · consume ${fmt(p.power / 1000)} kW`;
    case 'shield': return p.maxEntry ? `Hasta ${p.maxEntry} km/s` : 'Sin regreso posible';
    default: return '';
  }
}

export function hangar(state, ev, slot) {
  const tabs = SLOTS.map((s) => `<button type="button" class="tab" data-slot="${s.id}" ${slot === s.id ? 'aria-selected="true"' : ''}>${s.name}</button>`).join('');
  let body = '';
  if (slot === 'paint') {
    body = `<h3>Casco</h3>${swatches('ship.paint', PAINTS, state.ship.paint)}
      <h3>Acento y franjas</h3>${swatches('ship.accent', ACCENTS, state.ship.accent)}
      <p class="hint">El parche de la misión «${esc(state.look.patch)}» se pinta sobre la cápsula. La espuma naranja es la del tanque externo del transbordador y de la etapa central del SLS.</p>`;
  } else if (slot === 'science') {
    body = `<h3>Carga científica <small>${ev.instruments.length} de ${ev.sciSlots} espacios</small></h3>
    <div class="options">${INSTRUMENTS.map((ins) => {
      const on = state.instruments.includes(ins.id);
      const full = !on && state.instruments.length >= ev.sciSlots;
      const v = ins.value[ev.dest.sci];
      return `<label class="option">
        <input type="checkbox" name="instrument" value="${ins.id}" ${on ? 'checked' : ''} ${full ? 'disabled' : ''} />
        <span class="option__name">${ins.name}${ins.needsLanding ? '<span class="tag">superficie</span>' : ''}</span>
        <span class="option__aside value-dots" title="Valor en ${esc(ev.dest.short)}: ${v}/10">${'●'.repeat(Math.round(v / 2))}${'○'.repeat(5 - Math.round(v / 2))}</span>
        <span class="option__meta num">${kg(ins.mass)} · ${fmt(ins.power)} W · ${money(ins.cost)}</span>
      </label>`;
    }).join('')}</div>`;
  } else {
    const current = ev.ship[slot];
    body = `<div class="options">${PARTS[slot].map((p) => {
      const dm = (p.mass ?? 0) - (current.mass ?? 0);
      const delta = p.id === current.id ? 'instalado' : `${dm >= 0 ? '+' : '−'}${kg(Math.abs(dm))}`;
      return radio(`ship.${slot}`, p.id, current.id === p.id, p.name,
        `<em>${esc(p.ref)}</em><br>${partStats(slot, p, ev)}`, `${delta}<br>${money(p.cost)}`);
    }).join('')}</div>`;
    if (slot === 'engine') body += `<p class="hint">Cambiar de motor cambia el tipo de propelente: no todas las estaciones lo venden.</p>`;
    if (slot === 'life') body += `<p class="hint">Con ${ev.crewN} tripulantes y ${fmt(ev.routeDays)} días: ${kg(ev.crewN * ev.ship.life.rate * ev.routeDays)} de víveres, agua y O₂.</p>`;
  }
  return `
  <p class="eyebrow">Fase 03 · Ingeniería</p>
  <h2>Hangar orbital</h2>
  <p class="lede">Arma tu nave pieza por pieza, como en un taller: cada cambio se ve en 3D y mueve los presupuestos de abajo.</p>
  <div class="tabs" role="tablist">${tabs}</div>
  ${body}
  <dl class="spec">
    <dt>Masa seca</dt><dd>${kg(ev.dryMass)}</dd>
    <dt>Propelente máx.</dt><dd>${kg(ev.tankCapacity)}</dd>
    <dt>Volumen</dt><dd>${ev.volume.toFixed(1)} m³</dd>
  </dl>
  <div class="actions"><button class="btn btn--go" data-go="route">Planear la ruta →</button></div>`;
}

// ---------- 04 Ruta ----------
export function route(state, ev) {
  const direct = directInjection(state);
  const stations = availableStations(state);
  const prop = PROPELLANTS[ev.propType];
  return `
  <p class="eyebrow">Fase 04 · Operaciones</p>
  <h2>Lanzamiento y ruta</h2>
  <p class="lede">Elige cohete, cuánto propelente cargar al despegar y en qué estaciones parar por provisiones. Menos carga al despegar = cohete más barato, pero dependes de las estaciones.</p>

  <h3>Cohete</h3>
  <div class="options">
    ${LAUNCHERS.map((lv) => {
      const cap = direct ? lv.esc : lv.leo * state.launches;
      const over = ev.wetMass > cap;
      return `<label class="option">
        <input type="radio" name="launcher" value="${lv.id}" ${state.launcher === lv.id ? 'checked' : ''} />
        <span class="option__name">${lv.name} <small class="maker">${lv.maker}</small>${lv.crewRated ? '<span class="tag">tripulado</span>' : ''}</span>
        <span class="option__aside num">${money(lv.cost)}</span>
        <span class="option__meta num">${cap > 0 ? `${direct ? 'Translunar/escape' : 'A LEO'}: ${kg(cap)}` : 'No hace inyección directa'} · fiabilidad ${(lv.reliability * 100).toFixed(0)} %</span>
        <span class="lv-bar" ${over ? 'data-over' : ''}><span style="width:${cap > 0 ? Math.min(100, (ev.wetMass / cap) * 100) : 100}%"></span></span>
      </label>`;
    }).join('')}
  </div>
  <div class="field-row">
    <div class="slider">
      <label>Lanzamientos (ensamblaje en órbita) <output class="num">${state.launches}</output></label>
      <div class="stepper">
        <button type="button" data-step="launches" data-delta="-1" ${state.launches <= 1 ? 'disabled' : ''} aria-label="Menos lanzamientos">−</button>
        <span class="num">${state.launches}</span>
        <button type="button" data-step="launches" data-delta="1" ${state.launches >= 6 ? 'disabled' : ''} aria-label="Más lanzamientos">+</button>
      </div>
    </div>
    ${state.destination !== 'iss' ? `<label class="toggle"><input type="checkbox" name="direct" ${state.direct ? 'checked' : ''} ${state.launches > 1 ? 'disabled' : ''} /> <span><strong>Inyección directa</strong> · la etapa superior hace la salida (sin escalas en LEO)</span></label>` : ''}
  </div>

  <div class="slider">
    <label for="propLoad">Propelente al despegar <output class="num">${kg(Math.min(state.propLoad, ev.tankCapacity))}</output></label>
    <input id="propLoad" type="range" name="propLoad" min="0" max="${ev.tankCapacity}" step="${Math.max(10, ev.tankCapacity / 300)}" value="${Math.min(state.propLoad, ev.tankCapacity)}" />
  </div>
  <p class="hint">Tanque de ${kg(ev.tankCapacity)} de ${prop.name.toLowerCase()}${prop.boiloff ? `; se evapora ~${(prop.boiloff * 100).toFixed(2)} % por día` : ''}. Víveres al despegar: ${kg(ev.cons0)} de ${kg(ev.storage)} posibles.</p>

  <h3>Estaciones y provisiones</h3>
  ${stations.length ? `<div class="options">${stations.map((st) => {
    const sells = st.stock[ev.propType] ?? 0;
    return `<label class="option">
      <input type="checkbox" name="stop" value="${st.id}" ${state.stops.includes(st.id) || state.destination === 'iss' && st.id === 'iss' ? 'checked' : ''} ${state.destination === 'iss' && st.id === 'iss' ? 'disabled' : ''} />
      <span class="option__name">${st.name}${st.concept ? '<span class="tag">concepto</span>' : ''}${st.planned ? '<span class="tag">en construcción</span>' : ''}</span>
      <span class="option__aside num">US$ ${fmt(st.price * 1000)} mil/kg</span>
      <span class="option__meta">${st.blurb}<br><strong>${sells ? `Vende ${kg(sells)} de tu propelente` : `No vende ${prop.name.toLowerCase()}`}</strong> · víveres ${kg(st.stock.consumables)}${st.dv ? ` · desvío ${st.dv} km/s` : ''}</span>
    </label>`;
  }).join('')}</div>` : `<p class="hint">${direct ? 'Con inyección directa no hay escalas en órbita baja.' : 'No hay estaciones en esta ruta.'}</p>`}

  <h3>Plan de vuelo <small>${fmt(ev.routeDays)} días · Δv ${ev.totalDv.toFixed(2)} km/s</small></h3>
  <ol class="timeline">
    ${ev.route.steps.map((s) => {
      const failed = ev.route.failure?.step.name === s.name;
      return `<li data-type="${s.type}" ${failed ? 'data-fail' : ''}>
        <span class="timeline__day num">día ${fmt(s.day)}</span>
        <span class="timeline__name">${esc(s.name)}</span>
        <span class="timeline__data num">${s.dv ? `${s.dv.toFixed(2)} km/s · ` : ''}${s.refill ? `+${kg(s.refill.prop)} prop. +${kg(s.refill.cons)} víveres · ` : ''}quedan ${kg(s.after.prop)} / ${kg(s.after.cons)}</span>
      </li>`;
    }).join('')}
  </ol>
  <p class="hint">«Quedan» = propelente / víveres después de cada etapa.${ev.route.resupplyCost ? ` Provisiones compradas: US$ ${fmt(ev.route.resupplyCost)} M.` : ''}</p>

  <div class="actions">
    <button class="btn btn--small" type="button" data-autoprop>Cargar lo justo</button>
    <button class="btn btn--go" data-go="review">Revisión de diseño →</button>
  </div>`;
}

// ---------- 05 Revisión ----------
const PART_COLORS = ['oklch(0.35 0.03 265)', 'oklch(0.66 0.19 42)', 'oklch(0.55 0.1 250)', 'oklch(0.45 0.05 150)', 'oklch(0.72 0.12 85)', 'oklch(0.5 0.12 20)', 'oklch(0.62 0.02 265)', 'oklch(0.8 0.05 60)', 'oklch(0.4 0.08 300)', 'oklch(0.6 0.1 200)', 'oklch(0.7 0.05 120)'];

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
  <p class="eyebrow">Fase 05 · Revisión de diseño (PDR)</p>
  <h2>${fails ? `${fails} problema${fails > 1 ? 's' : ''} crítico${fails > 1 ? 's' : ''}` : warns ? 'Lista, con riesgos' : 'Lista para volar'}</h2>
  <p class="lede">Un panel de ingenieros revisa tu nave y tu ruta contra la física y los datos de la NASA. Toca cada punto para entender por qué importa.</p>
  <ul class="checks">
    ${ev.checks.map((c) => `<li><details class="check" data-status="${c.status}">
      <summary><span class="check__icon" aria-label="${c.status}">${icon[c.status]}</span><span class="check__label">${c.label}</span><span class="check__detail">${c.detail}</span></summary>
      <p class="check__why">${c.why}</p>
    </details></li>`).join('')}
  </ul>
  <h3>Masa seca <small class="num">${kg(ev.dryMass)} con 10 % de margen</small></h3>
  ${stack(ev.parts)}
  <h3>Costo <small class="num">${money(ev.cost)}</small></h3>
  ${stack(ev.costs)}
  <div class="actions">
    <button class="btn btn--go" data-launch ${ev.canLaunch ? '' : 'disabled'}>${ev.canLaunch ? '¡Lanzar!' : 'No se puede lanzar así'}</button>
    <button class="btn" data-go="hangar">Volver al hangar</button>
  </div>
  ${fails && ev.canLaunch ? '<p class="hint">Puedes lanzar con fallas: la simulación mostrará sus consecuencias.</p>' : ''}`;
}

// ---------- 06 Vuelo ----------
export function flight(state, ev, result, revealed, done) {
  const items = result.log.slice(0, revealed);
  const title = !done ? 'En vuelo…' : result.lostCrew ? 'Tripulación perdida' : result.ok ? 'Misión cumplida' : 'Misión abortada';
  return `
  <p class="eyebrow">Fase 06 · Vuelo</p>
  <h2>${title}</h2>
  <p class="lede">${esc(ev.dest.name)} · ${fmt(ev.routeDays)} días · ${ev.crewN} tripulantes · eventos solares reales de NASA DONKI.</p>
  <ol class="log">
    ${items.map((l) => `<li data-kind="${l.kind}"><time>${esc(l.t)}</time><span>${esc(l.text)}${l.source ? `<span class="src">${l.source}</span>` : ''}</span></li>`).join('')}
  </ol>
  ${done ? `<div class="result">
      <div class="grade" aria-label="Calificación">${result.grade}</div>
      <dl>
        <dt>Puntuación</dt><dd>${fmt(result.score)}</dd>
        <dt>Ciencia</dt><dd>${result.science.toFixed(1)} pts</dd>
        <dt>Exploración</dt><dd>${fmt(result.explore)} pts</dd>
        <dt>Radiación</dt><dd>${fmt(ev.dose)} / ${CAREER_DOSE} mSv</dd>
        <dt>Costo</dt><dd>${money(ev.cost)}</dd>
      </dl>
    </div>
    <div class="actions">
      <button class="btn btn--go" data-go="hangar">Rediseñar</button>
      <button class="btn" data-copy>Copiar informe</button>
    </div>` : ''}`;
}

// ---------- Presupuestos ----------
export function budgets(ev) {
  const status = (id) => ev.checks.find((c) => c.id === id)?.status ?? 'ok';
  const propUsed = ev.route.steps.reduce((a, s) => a + s.need, 0);
  const propAvail = ev.prop0 + ev.route.steps.reduce((a, s) => a + (s.refill?.prop ?? 0), 0);
  const consUsed = ev.crewN * ev.ship.life.rate * ev.routeDays;
  const consAvail = ev.cons0 + ev.route.steps.reduce((a, s) => a + (s.refill?.cons ?? 0), 0);
  const meter = (label, value, used, limit, st, note) => {
    const max = Math.max(used, limit) * 1.1 || 1;
    return `<div class="meter" data-status="${st}">
      <div class="meter__head"><span class="meter__label">${label}</span><span class="meter__value">${value}</span></div>
      <div class="meter__track"><div class="meter__fill" style="width:${(used / max) * 100}%"></div><div class="meter__limit" style="left:${(limit / max) * 100}%"></div></div>
      <p class="meter__note">${note}</p>
    </div>`;
  };
  return [
    meter('Masa', kg(ev.wetMass), ev.wetMass, ev.capacity, status('launch'), `límite ${kg(ev.capacity)}`),
    meter('Propelente', kg(propUsed), propUsed, propAvail, status('route'), `disponible ${kg(propAvail)}`),
    meter('Víveres', kg(consUsed), consUsed, consAvail, status('cons'), `a bordo + estaciones ${kg(consAvail)}`),
    meter('Energía', `${fmt(ev.powerNeed)} W`, ev.powerNeed, ev.gen, status('power'), `genera ${fmt(ev.gen)} W`),
    meter('Costo', money(ev.cost), ev.cost, ev.program.budget, status('budget'), `techo ${money(ev.program.budget)}`),
  ].join('');
}
