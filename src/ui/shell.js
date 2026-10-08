// Navegación de fases, indicadores de datos NASA y presupuestos.
import { money, kg, fmt } from './common.js';

export const PHASES = [
  { id: 'mission', name: 'Misión' },
  { id: 'crew', name: 'Tripulación' },
  { id: 'hangar', name: 'Hangar' },
  { id: 'route', name: 'Ruta' },
  { id: 'review', name: 'Revisión' },
  { id: 'flight', name: 'Vuelo' },
];

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
