// Fase 04: cohete, propelente y escalas en estaciones.
import { LAUNCHERS } from '../data/catalog.js';
import { PROPELLANTS } from '../data/parts.js';
import { availableStations, directInjection } from '../mission.js';
import { esc, money, kg, fmt } from './common.js';

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
