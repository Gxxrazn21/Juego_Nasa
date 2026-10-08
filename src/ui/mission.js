// Fase 01: destino, programa y clima espacial (DONKI).
import { PROGRAMS, DESTINATIONS } from '../data/catalog.js';
import { neoRendezvous } from '../physics.js';
import { esc, money, radio, fmt } from './common.js';

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

  <aside class="callout">
    <p><strong>¿Primera vez?</strong> Empieza con una nave de fábrica ya probada: Artemis, Dragon, un alunizador nuclear o el tránsito a Marte.</p>
    <button type="button" class="btn btn--small" data-go="hangar" data-open="presets">Ver naves →</button>
  </aside>

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
