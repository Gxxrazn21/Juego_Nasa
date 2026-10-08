// Fase 03: hangar modular, pintura e insignia.
import { INSTRUMENTS } from '../data/catalog.js';
import { PARTS, SLOTS, PROPELLANTS, PAINTS, ACCENTS, LIVERIES, FINISH_LIST, MLI_LIST } from '../data/parts.js';
import { SHAPES, SYMBOLS, INSIGNIA_BG, drawInsignia } from '../app/insignia.js';
import { esc, money, kg, fmt, radio, swatches, chips } from './common.js';

/** Vista previa de la insignia como imagen (mismo dibujo que se pinta en la nave). */
export function insigniaPreview(opts, size = 192) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return drawInsignia(c, opts).toDataURL('image/png');
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

export function hangar(state, ev, slot, insignia) {
  const tabs = SLOTS.map((s) => `<button type="button" class="tab" data-slot="${s.id}" ${slot === s.id ? 'aria-selected="true"' : ''}>${s.name}</button>`).join('');
  let body = '';
  if (slot === 'paint') {
    body = `<label class="field"><span>Nombre de la nave</span><input type="text" name="ship.name" value="${esc(state.ship.name)}" maxlength="16" autocomplete="off" placeholder="Esperanza" /></label>
      <h3>Casco</h3>${swatches('ship.paint', PAINTS, state.ship.paint, true)}
      <h3>Acento</h3>${swatches('ship.accent', ACCENTS, state.ship.accent, true)}
      <h3>Librea</h3>${chips('ship.livery', LIVERIES, state.ship.livery)}
      <h3>Acabado</h3>${chips('ship.finish', FINISH_LIST, state.ship.finish)}
      <h3>Aislamiento térmico (MLI)</h3>${swatches('ship.mli', MLI_LIST, state.ship.mli)}
      <p class="hint">El nombre y la insignia se pintan en los tanques y el hábitat. La espuma naranja es la del tanque externo del transbordador; el patrón de ajedrez ayudaba a medir la rotación del Saturno V en las fotos.</p>`;
  } else if (slot === 'insignia') {
    const ins = state.look.insignia;
    body = `<div class="insignia-editor">
        <img class="insignia-preview" src="${insignia}" alt="Insignia de la misión ${esc(state.look.patch)}" width="168" height="168" />
        <div>
          <label class="field"><span>Texto inferior (misión)</span><input type="text" name="look.patch" value="${esc(state.look.patch)}" maxlength="12" autocomplete="off" /></label>
          <p class="hint">Arriba va la agencia (${esc(state.look.agency)}). Una estrella por tripulante, como en los parches del Apolo.</p>
        </div>
      </div>
      <h3>Forma</h3>${chips('insignia.shape', SHAPES, ins.shape)}
      <h3>Símbolo</h3>${chips('insignia.symbol', SYMBOLS, ins.upload ? null : ins.symbol)}
      <h3>Fondo</h3>${swatches('insignia.bg', INSIGNIA_BG.map((hex) => ({ id: hex, name: hex, hex })), ins.bg)}
      <h3>Tu propio logo</h3>
      <div class="upload">
        <label class="btn btn--small"><input type="file" name="logo" accept="image/*" hidden />Subir imagen</label>
        ${ins.upload ? '<button type="button" class="btn btn--small" data-clear-logo>Quitar imagen</button>' : ''}
      </div>
      <p class="hint">PNG o JPG; se recorta en cuadrado y se guarda solo en este dispositivo.</p>`;
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
