// Fase 05: revisión de diseño.
import { money, kg, fmt } from './common.js';
import { challengeBox } from './challenges.js';

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
  ${challengeBox(state, ev)}
  <div class="actions">
    <button class="btn btn--go" data-launch ${ev.canLaunch ? '' : 'disabled'}>${ev.canLaunch ? '¡Lanzar!' : 'No se puede lanzar así'}</button>
    <button class="btn" data-go="hangar">Volver al hangar</button>
  </div>
  ${fails && ev.canLaunch ? '<p class="hint">Puedes lanzar con fallas: la simulación mostrará sus consecuencias.</p>' : ''}`;
}
