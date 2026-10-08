// Fase 02: creación de personaje y tripulación.
import { SUITS, ROLES, AGENCIES, SUIT_COLORS } from '../data/crew.js';
import { esc, radio, swatches } from './common.js';

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
