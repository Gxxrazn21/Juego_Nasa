// Fase 06: bitácora de vuelo y resultado.
import { CAREER_DOSE } from '../mission.js';
import { esc, money, fmt } from './common.js';

// ---------- 06 Vuelo ----------
export function flight(state, ev, result, revealed, done) {
  const items = result.log.slice(0, revealed);
  const title = !done ? 'En vuelo…' : result.lostCrew ? 'Tripulación perdida' : result.ok ? 'Misión cumplida' : 'Misión abortada';
  return `
  <p class="eyebrow">Fase 06 · Vuelo</p>
  <h2>${title}</h2>
  <p class="lede">${esc(ev.dest.name)} · ${fmt(ev.routeDays)} días · ${ev.crewN} tripulantes · eventos solares reales de NASA DONKI.</p>
  ${telemetry(ev, items)}
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

/** Telemetría en vivo: día de misión, propelente, víveres y dosis prevista. */
function telemetry(ev, items) {
  const last = [...items].reverse().find((l) => l.tele);
  if (!last) return '';
  const { day, prop, cons } = last.tele;
  return `<dl class="telemetry" aria-label="Telemetría">
    <div><dt>Día</dt><dd>${fmt(day)}</dd></div>
    <div><dt>Propelente</dt><dd>${fmt(prop)} kg</dd></div>
    <div><dt>Víveres</dt><dd>${fmt(cons)} kg</dd></div>
    <div><dt>Dosis</dt><dd>${fmt((ev.dose * day) / Math.max(1, ev.routeDays))} mSv</dd></div>
  </dl>`;
}
