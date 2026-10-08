// Retos con medallas: lista en la fase Misión y objetivos en la Revisión.
import { CHALLENGES, MEDALS, medalRank, matches } from '../data/challenges.js';
import { medalIcon } from './flight.js';
import { esc } from './common.js';

export function challenges(state, ev, medals, nasa) {
  const earned = Object.values(medals).reduce((a, m) => a + medalRank(m) + 1, 0);
  return `<h3>Retos <small>${earned} de ${CHALLENGES.length * MEDALS.length} medallas</small></h3>
  <ul class="challenges">
    ${CHALLENGES.map((c) => {
      const active = state.challenge === c.id;
      const best = medalRank(medals[c.id]);
      return `<li class="challenge" ${active ? 'data-active' : ''}>
        <div class="challenge__head">
          <strong>${esc(c.title)}</strong>
          ${c.live ? `<span class="tag tag--live">${live(c, nasa)}</span>` : ''}
          <span class="challenge__medals" aria-label="${best >= 0 ? `Mejor medalla: ${MEDALS[best].name}` : 'Sin medallas'}">${MEDALS.map((m, i) => `<span ${i > best ? 'data-off' : ''}>${medalIcon(m.id, true)}</span>`).join('')}</span>
        </div>
        <p class="challenge__brief">${esc(c.brief)}</p>
        ${active ? `${mismatch(c, ev)}${goals(c, ev)}<p class="hint">${esc(c.fact)}</p>` : ''}
        <button type="button" class="btn btn--small" data-challenge="${active ? '' : c.id}">${active ? 'Salir del reto' : best >= 0 ? 'Jugar otra vez' : 'Jugar reto'}</button>
      </li>`;
    }).join('')}
  </ul>`;
}

function live(c, nasa) {
  if (c.live === 'weather') return nasa.activity ? `Sol de hoy: ${esc(nasa.activity.label.toLowerCase())}` : 'Datos de hoy';
  return nasa.neosLive ? 'NeoWs en vivo' : 'NeoWs';
}

/** Objetivos con lo que el diseño actual promete (✓ / ✕ / ? se sabe al volar). */
export function goals(c, ev) {
  const fits = matches(c, ev);
  return `<ul class="goals">${c.goals.map((g) => {
    const plan = !fits ? false : g.plan ? g.plan(ev) : null;
    return `<li data-ok="${plan}">${medalIcon(g.medal, true)}<span>${esc(g.label)}</span><b title="${plan == null ? 'Se sabe al volar' : plan ? 'Tu diseño lo cumple' : 'Tu diseño aún no lo cumple'}">${plan == null ? '?' : plan ? '✓' : '✕'}</b></li>`;
  }).join('')}</ul>`;
}

/** Aviso si el diseño se alejó de la misión del reto (por ejemplo, al aplicar una nave de fábrica). */
function mismatch(c, ev) {
  if (matches(c, ev)) return '';
  return `<p class="hint hint--warn">Tu misión ya no es la de este reto (destino, programa o alunizaje).
    <button type="button" class="btn btn--small" data-challenge="${c.id}">Volver a la misión del reto</button></p>`;
}

/** Recuadro de objetivos para la Revisión. */
export function challengeBox(state, ev) {
  const c = CHALLENGES.find((x) => x.id === state.challenge);
  if (!c) return '';
  return `<section class="challenge-box">
    <h3>Reto: ${esc(c.title)} <small>✓ previsto · ? se sabe al volar</small></h3>
    ${mismatch(c, ev)}${goals(c, ev)}
  </section>`;
}
