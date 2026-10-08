// Fase 06: bitácora de vuelo, decisiones en vivo e informe final.
import { CAREER_DOSE, fmtGb } from '../mission.js';
import { MEDALS } from '../data/challenges.js';
import { esc, money, fmt } from './common.js';

// ---------- 06 Vuelo ----------
export function flight(state, ev, run) {
  const r = run.result;
  const done = run.done && r;
  const title = !done ? (run.decision ? 'Decisión a bordo' : 'En vuelo…') : r.lostCrew ? 'Tripulación perdida' : r.ok ? 'Misión cumplida' : 'Misión abortada';
  return `
  <p class="eyebrow">Fase 06 · Vuelo</p>
  <h2>${title}</h2>
  <p class="lede">${esc(ev.dest.name)} · ${fmt(ev.routeDays)} días previstos · ${ev.crewN} tripulantes. Los eventos se basan en misiones reales y en el clima espacial de NASA DONKI.</p>
  ${telemetry(run.log)}
  <ol class="log">
    ${run.log.map((l) => `<li data-kind="${l.kind}"><time>${esc(l.t)}</time><span>${esc(l.text)}</span></li>`).join('')}
  </ol>
  ${run.decision ? decision(run.decision, run.log) : ''}
  ${done ? result(state, ev, r, run) : ''}`;
}

/** Tarjeta de decisión: el vuelo se detiene hasta que el jugador elige. */
function decision(d, log) {
  const day = log.at(-1)?.tele?.day ?? 0;
  return `<section class="decision" role="alertdialog" aria-labelledby="decision-title" aria-describedby="decision-text">
    <p class="decision__eyebrow">Día ${fmt(day)} · Control de misión espera tu decisión</p>
    <h3 id="decision-title" class="decision__title">${esc(d.title)}</h3>
    <p id="decision-text">${esc(d.text)}</p>
    <p class="decision__fact">${esc(d.fact)}</p>
    <div class="decision__options">
      ${d.options.map((o) => `<button type="button" class="choice" data-choice="${esc(o.id)}" ${o.disabled ? 'disabled' : ''}>
        <strong>${esc(o.label)}</strong><span>${esc(o.preview)}</span></button>`).join('')}
    </div>
  </section>`;
}

/** Resultado e informe final de la misión. */
function result(state, ev, r, run) {
  const d = run.debrief;
  const ch = run.challenge;
  return `
  <div class="result">
    <div class="grade" aria-label="Calificación">${r.grade}</div>
    <dl>
      <dt>Puntuación</dt><dd>${fmt(r.score)}</dd>
      <dt>Ciencia</dt><dd>${r.science.toFixed(1)} pts</dd>
      <dt>Exploración</dt><dd>${fmt(r.explore)} pts</dd>
      <dt>Radiación</dt><dd>${fmt(r.dose)} / ${CAREER_DOSE} mSv</dd>
      <dt>Datos recibidos</dt><dd>${r.dataGenerated > 0 ? `${fmtGb(r.dataSent)} de ${fmtGb(r.dataGenerated)}` : '—'}</dd>
      <dt>Duración</dt><dd>${fmt(r.days)} días</dd>
      <dt>Costo</dt><dd>${money(ev.cost)}</dd>
    </dl>
  </div>
  ${ch ? challengeResult(ch, r, ev) : ''}
  <div class="actions">
    <button class="btn btn--go" data-go="hangar">Rediseñar</button>
    <button class="btn" data-launch>Volar otra vez</button>
    <button class="btn" data-copy>Copiar informe</button>
  </div>
  <p class="hint">Volar la misma nave repite los mismos eventos: puedes probar otras decisiones y comparar.</p>
  ${d ? debrief(d, r) : ''}`;
}

function challengeResult(ch, r, ev) {
  const medal = MEDALS.find((m) => m.id === ch.medal);
  return `<section class="challenge-result">
    <h3>Reto: ${esc(ch.c.title)} <small>${medal ? `${ch.isNew ? '¡Nueva medalla!' : 'Medalla'} de ${medal.name.toLowerCase()}` : ch.mismatch ? 'La misión no es la del reto' : 'Sin medalla esta vez'}</small></h3>
    ${medal ? `<p class="medal-line">${medalIcon(medal.id)} ${medal.name}</p>` : ''}
    <ul class="goals">${ch.c.goals.map((g) => {
      const ok = !ch.mismatch && g.check(r, ev);
      return `<li data-ok="${ok}">${medalIcon(g.medal, true)}<span>${esc(g.label)}</span><b>${ok ? '✓' : '✕'}</b></li>`;
    }).join('')}</ul>
  </section>`;
}

/** Informe: decisiones, factores limitantes, experimentos «¿qué pasaría si…?» y lecciones. */
function debrief(d, r) {
  return `
  <h3>Informe de la misión <small>${esc(d.title)}</small></h3>
  ${r.decisions.length ? `<h4 class="sub">Tus decisiones</h4>
  <ol class="decisions">${r.decisions.map((x) => `<li data-kind="${x.kind}">
      <strong>${esc(x.title)} <small>· día ${fmt(x.day)}</small></strong>
      <span>Elegiste: ${esc(x.label)}${x.prudent ? ' <em class="tag tag--soft">prudente</em>' : ''}</span>
      <span class="decisions__res">${esc(x.result)}</span></li>`).join('')}</ol>
  <p class="hint">Con las opciones prudentes, la misma nave habría sacado <strong>${fmt(d.prudent.score)} puntos (${d.prudent.grade})</strong>${d.prudent.score === r.score ? ': tus decisiones no cambiaron la puntuación.' : r.score > d.prudent.score ? ': ¡tus riesgos salieron bien!' : ': las decisiones arriesgadas costaron puntos.'}</p>` : ''}

  ${d.limits.length ? `<h4 class="sub">Qué limitó tu misión</h4>
  <ul class="limits">${d.limits.map((l) => `<li data-status="${l.status}"><strong>${esc(l.label)}</strong><span>${esc(l.detail)}</span></li>`).join('')}</ul>` : ''}

  ${d.whatIf.length ? `<h4 class="sub">¿Qué pasaría si…? <small>misma misión, mismos eventos, un solo cambio</small></h4>
  <ul class="whatif">${d.whatIf.map((w) => `<li data-trend="${w.saved || w.delta > 0 ? 'up' : w.delta < 0 || !w.canLaunch ? 'down' : 'flat'}">
      <div><strong>${esc(w.label)}</strong><span>${esc(w.why)}</span><span class="whatif__out">${esc(w.outcome)}${w.cost ? ` · costo ${w.cost > 0 ? '+' : '−'}US$ ${fmt(Math.abs(w.cost))} M` : ''}</span></div>
      <b class="num">${w.canLaunch ? `${w.delta > 0 ? '+' : w.delta < 0 ? '−' : '±'}${fmt(Math.abs(w.delta))}` : '✕'}</b></li>`).join('')}</ul>` : ''}

  ${d.lessons.length ? `<h4 class="sub">Lo que aprendiste</h4>
  <ul class="lessons">${d.lessons.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`;
}

export function medalIcon(id, small = false) {
  const m = MEDALS.find((x) => x.id === id);
  if (!m) return '';
  return `<svg class="medal${small ? ' medal--small' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 1h4l2 6H9zM13 1h4l-2 6h-4z" fill="${m.color}" opacity=".7"/><circle cx="12" cy="15" r="7.5" fill="${m.color}"/><circle cx="12" cy="15" r="5" fill="none" stroke="#0003" stroke-width="1.2"/></svg>`;
}

/** Telemetría en vivo: día de misión, propelente, víveres y dosis acumulada. */
function telemetry(log) {
  const last = [...log].reverse().find((l) => l.tele);
  if (!last) return '';
  const { day, prop, cons, dose } = last.tele;
  return `<dl class="telemetry" aria-label="Telemetría">
    <div><dt>Día</dt><dd>${fmt(day)}</dd></div>
    <div><dt>Propelente</dt><dd>${fmt(prop)} kg</dd></div>
    <div><dt>Víveres</dt><dd>${fmt(cons)} kg</dd></div>
    <div><dt>Dosis</dt><dd>${fmt(dose)} mSv</dd></div>
  </dl>`;
}
