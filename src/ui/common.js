// Piezas compartidas de la interfaz.
import { fmt } from '../mission.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (m) => (m >= 1e5 ? 'sin límite' : `US$ ${fmt(m)} M`);
export const kg = (m) => `${fmt(m)} kg`;
export { fmt };

export function radio(name, value, checked, title, meta = '', aside = '', disabled = false) {
  return `<label class="option">
    <input type="radio" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
    <span class="option__name">${title}</span>
    <span class="option__aside">${aside}</span>
    ${meta ? `<span class="option__meta">${meta}</span>` : ''}
  </label>`;
}

/** Muestras de color; `custom` añade un selector libre (input color). */
export function swatches(name, list, current, custom = false) {
  const isCustom = custom && typeof current === 'string' && current.startsWith('#');
  return `<div class="swatches" role="radiogroup">${list.map((c) => `<label class="swatch" title="${esc(c.name)}">
    <input type="radio" name="${name}" value="${c.id}" ${current === c.id ? 'checked' : ''} aria-label="${esc(c.name)}" />
    <span style="background:${c.css ?? c.hex}"></span></label>`).join('')}
    ${custom ? `<label class="swatch swatch--custom" title="Color personalizado">
      <input type="color" name="${name}" value="${isCustom ? current : '#5a8f6e'}" aria-label="Color personalizado" />
      <span ${isCustom ? `style="background:${current}" data-on` : ''}>+</span></label>` : ''}</div>`;
}

/** Botones tipo píldora para opciones cortas. */
export function chips(name, list, current) {
  return `<div class="chips" role="radiogroup">${list.map((c) => `<label class="chip">
    <input type="radio" name="${name}" value="${c.id}" ${current === c.id ? 'checked' : ''} />
    <span>${esc(c.name)}</span></label>`).join('')}</div>`;
}
