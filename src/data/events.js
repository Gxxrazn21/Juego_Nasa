// Eventos del vuelo que exigen una decisión. Todos están basados en situaciones reales
// de la NASA y sus socios; los efectos usan la física del motor de vuelo.
//
// Cada evento: { id, when(ctx) → ¿puede ocurrir?, place(ctx) → índice de etapa, build(ctx, sim) → tarjeta }
// Cada opción: { id, label, preview, auto?, disabled?, apply(sim, rng) → { kind, text } }
//   auto: la opción prudente que usa el piloto automático (pruebas e «informe qué pasaría si»).

const pct = (p) => `${Math.round(p * 100)} %`;
const kgs = (x) => `${Math.round(x).toLocaleString('es')} kg`;
const firstLong = (steps, pred) => steps.findIndex((s) => pred(s) && (s.days ?? 0) > 2);
/** Víveres que sobrarían al volver si se gastan `kg` ahora (lo que hay menos lo que falta por consumir). */
const margin = (ctx, sim, kg = 0) => sim.cons - kg - sim.consRate * ctx.daysLeft(ctx.at);
const reserve = (ctx, sim, kg) => {
  const m = margin(ctx, sim, kg);
  return m >= 0 ? `reserva al volver: ${kgs(m)}` : `¡faltarían ${kgs(-m)} de víveres!`;
};
const longest = (steps, pred) => {
  let best = -1, days = -1;
  steps.forEach((s, i) => { if (pred(s) && (s.days ?? 0) > days) { best = i; days = s.days; } });
  return best;
};

/** Dosis (mSv) de una tormenta de partículas dentro de la nave, según el evento real de DONKI. */
function stormDose(ctx) {
  const e = ctx.stormSource;
  const base = e.kind === 'SEP' ? 90 : /^X/i.test(e.classType) ? 60 + 6 * (parseFloat(e.classType.slice(1)) || 1) : 20;
  return base * ctx.shieldFactor;
}

export const EVENTS = [
  {
    id: 'storm',
    when: (ctx) => !!ctx.stormSource && ctx.steps.some((s) => s.region === 'deep' && s.days > 2),
    place: (ctx) => longest(ctx.steps, (s) => s.region === 'deep'),
    build: (ctx, sim) => {
      const dose = stormDose(ctx);
      const src = ctx.stormSource;
      const name = src.kind === 'SEP' ? 'Evento de partículas solares' : `Fulguración ${src.classType}`;
      return {
        title: 'Tormenta solar',
        text: `${name} detectado por la NASA (DONKI, ${src.date}). En minutos llega una lluvia de protones: fuera de la magnetosfera, la nave no tiene la protección natural de la Tierra.`,
        fact: 'Dato real: en Artemis I, los maniquíes Helga y Zohar midieron la radiación dentro de Orion. Orion tiene un refugio: la tripulación se rodea de las bolsas de agua y provisiones del piso.',
        options: [
          {
            id: 'shelter', auto: true,
            label: 'Refugiarse junto al agua y las provisiones',
            preview: `+${Math.round(dose * 0.25)} mSv · se pierde un día de trabajo (−3 % de ciencia)`,
            apply: (s) => { s.addDose(dose * 0.25); s.scienceMult *= 0.97; return { kind: 'ok', text: `La tripulación pasa la tormenta en el refugio: recibe ${Math.round(dose * 0.25)} mSv en vez de ${Math.round(dose)}.` }; },
          },
          {
            id: 'continue',
            label: 'Seguir con el trabajo normal',
            preview: `+${Math.round(dose)} mSv por persona (${pct(dose / 600)} del límite de carrera) · +3 % de ciencia`,
            apply: (s) => { s.addDose(dose); s.scienceMult *= 1.03; return { kind: 'warn', text: `Se siguen las operaciones. Cada tripulante recibe ${Math.round(dose)} mSv, ${pct(dose / 600)} del límite de toda su carrera.` }; },
          },
        ],
      };
    },
  },
  {
    id: 'mmod',
    when: (ctx) => ctx.totalDays > 8,
    // en el primer tramo largo de ida; en la ISS, durante la expedición
    place: (ctx) => {
      const out = firstLong(ctx.steps, (s) => s.type === 'burn' && s.region === 'deep');
      return out >= 0 ? out : longest(ctx.steps, (s) => s.type === 'stay' || s.type === 'dock');
    },
    build: (ctx, sim) => {
      const engineer = sim.roles.has('ingeniero');
      const arm = ctx.ev.ship.docking.repairs;
      const evaOk = Math.min(0.97, 0.78 + (engineer ? 0.12 : 0) + (arm ? 0.05 : 0));
      const hab = ctx.ev.ship.habitat.id !== 'none';
      return {
        title: 'Impacto de micrometeoroide',
        text: 'Un grano de polvo a 10 km/s perfora el casco. La presión baja lentamente y la nave pierde aire.',
        fact: 'Dato real: en 2018 la Soyuz MS-09 tuvo un agujero de 2 mm y la tripulación lo selló con resina epoxi; en 2022 un micrometeoroide perforó el radiador de la Soyuz MS-22.',
        options: [
          {
            id: 'patch', auto: true,
            label: 'Caminata espacial para parcharlo por fuera',
            preview: `Éxito ${pct(evaOk)}${engineer ? ' (ingeniería ayuda)' : ''} · +3 mSv · 1 día · si falla: −${kgs(40 * ctx.ev.crewN)} de reservas`,
            apply: (s, rng) => {
              s.addDose(3); s.spendDays(1);
              if (rng() < evaOk) return { kind: 'ok', text: 'El parche exterior aguanta: la presión vuelve a la normalidad.' };
              s.useCons(40 * ctx.ev.crewN);
              return { kind: 'warn', text: 'El parche no sella del todo: se reponen 40 kg de oxígeno y nitrógeno por persona de las reservas.' };
            },
          },
          {
            id: 'seal',
            label: 'Sellar desde adentro con resina',
            preview: `Éxito 70 % · gasta ${kgs(15 * ctx.ev.crewN)} de O₂ (${kgs(45 * ctx.ev.crewN)} si falla) · ${reserve(ctx, sim, 45 * ctx.ev.crewN)} en el peor caso`,
            apply: (s, rng) => {
              s.useCons(15 * ctx.ev.crewN);
              if (rng() < 0.7) return { kind: 'ok', text: 'El sellado interior funciona, como en la Soyuz MS-09.' };
              s.useCons(30 * ctx.ev.crewN);
              return { kind: 'warn', text: 'La resina no cura bien y la fuga sigue un tiempo: se gasta más oxígeno de reserva.' };
            },
          },
          hab
            ? {
              id: 'isolate',
              label: 'Cerrar la escotilla del hábitat y vivir en la cápsula',
              preview: 'Sin riesgo inmediato · menos espacio y −15 % de ciencia',
              apply: (s) => { s.scienceMult *= 0.85; s.health -= 8; return { kind: 'warn', text: 'El hábitat queda sellado. La tripulación vive apretada en la cápsula el resto del viaje.' }; },
            }
            : {
              id: 'abort',
              label: 'Abortar y volver a casa',
              preview: 'Tripulación segura · se pierde la misión',
              apply: (s) => { s.abort('Aborto por fuga de presión'); return { kind: 'warn', text: 'Se decide volver de inmediato. La tripulación está a salvo, pero la misión termina.' }; },
            },
        ],
      };
    },
  },
  {
    id: 'science',
    when: (ctx) => ctx.steps.some((s) => s.type === 'stay'),
    place: (ctx) => ctx.steps.findIndex((s) => s.type === 'stay'),
    build: (ctx, sim) => {
      const extra = ctx.ev.dest.id === 'mars' || ctx.ev.dest.id === 'neo' ? 10 : 3;
      const kg = Math.round(sim.consRate * extra);
      const finding = {
        iss: ['Una aurora austral gigante y un experimento de cristales de proteínas que está saliendo bien.', 'Dato real: los cristales de proteínas crecen más grandes y ordenados en microgravedad; la ISS los usa para estudiar medicamentos.'],
        moon: ['El radar detecta señales de hielo en un cráter en sombra permanente.', 'Dato real: en 2009 la sonda LCROSS de la NASA confirmó agua helada en el cráter Cabeus, cerca del polo sur lunar.'],
        mars: ['Comienza una tormenta de polvo que podría cubrir todo el planeta.', 'Dato real: la tormenta global de 2018 dejó sin energía solar al rover Opportunity, que nunca despertó.'],
        neo: ['El asteroide expulsa pequeñas partículas desde su superficie.', 'Dato real: en 2019 la nave OSIRIS-REx de la NASA vio a Bennu lanzar partículas al espacio.'],
      }[ctx.ev.dest.sci];
      return {
        title: 'Oportunidad científica',
        text: finding[0],
        fact: finding[1],
        options: [
          {
            id: 'extend',
            label: `Quedarse ${extra} días más para estudiarlo`,
            preview: `+25 % de ciencia · usa ${kgs(kg)} de víveres y suma radiación · ${reserve(ctx, sim, kg)}`,
            apply: (s) => {
              s.extendStay(extra);
              s.scienceMult *= 1.25;
              return { kind: 'ok', text: `La tripulación se queda ${extra} días más y documenta el hallazgo.` };
            },
          },
          ...(margin(ctx, sim) < 0 ? [{
            id: 'ration',
            label: 'Acortar la estancia para ahorrar víveres',
            preview: `−30 % de ciencia · ahorra ${kgs(sim.consRate * (ctx.steps[ctx.at].days ?? 0) * 0.5)}`,
            apply: (s) => { s.shortenStay(0.5); s.scienceMult *= 0.7; return { kind: 'warn', text: 'Se recorta la estancia a la mitad: menos ciencia, pero los víveres alcanzan para volver.' }; },
          }] : []),
          {
            id: 'plan', auto: true,
            label: 'Seguir el plan original',
            preview: `Sin costo extra · ${reserve(ctx, sim, 0)}`,
            apply: () => ({ kind: 'info', text: 'Se anota la observación para una misión futura y se sigue el plan.' }),
          },
        ],
      };
    },
  },
  {
    id: 'conjunction',
    when: (ctx) => ctx.ev.dest.id === 'mars',
    place: (ctx) => ctx.steps.findIndex((s, i) => i > ctx.steps.findIndex((x) => x.type === 'stay') && s.type === 'burn' && s.days > 30),
    build: () => ({
      title: 'Conjunción solar',
      text: 'La Tierra y la nave quedan en lados opuestos del Sol durante dos semanas. El Sol interfiere la señal de radio.',
      fact: 'Dato real: ocurre cada ~26 meses con Marte; la NASA deja de enviar comandos a sus rovers y orbitadores durante esas semanas.',
      options: [
        {
          id: 'store', auto: true,
          label: 'Guardar los datos a bordo y esperar',
          preview: 'Sin errores · 14 días menos para enviar ciencia (importa si la antena es lenta)',
          apply: (s) => { s.commsLostDays += 14; return { kind: 'ok', text: 'Los datos quedan guardados a bordo hasta que el Sol se aparte.' }; },
        },
        {
          id: 'push',
          label: 'Seguir transmitiendo con la señal degradada',
          preview: 'Se sigue enviando, pero ~8 % de los datos de la misión llega con errores',
          apply: (s) => { s.dataCorruption += 0.08; return { kind: 'warn', text: 'Parte de los datos llega con errores y hay que descartarlos.' }; },
        },
      ],
    }),
  },
  {
    id: 'health',
    when: (ctx) => ctx.totalDays > 60,
    // durante la estancia, para que volver antes sea una opción real
    place: (ctx) => {
      const stay = ctx.steps.findIndex((s) => s.type === 'stay' && s.days >= 10);
      return stay >= 0 ? stay : longest(ctx.steps, (s) => s.type === 'burn');
    },
    build: (ctx, sim) => {
      const medic = sim.roles.has('medico');
      const ok = medic ? 0.95 : 0.7;
      return {
        title: 'Problema de salud',
        text: 'Un tripulante tiene visión borrosa y dolor de cabeza: posible síndrome neuro-ocular por la microgravedad.',
        fact: 'Dato real: el síndrome neuro-ocular asociado a vuelos espaciales (SANS) aparece en cerca de 7 de cada 10 astronautas de estancias largas en la ISS.',
        options: [
          {
            id: 'treat', auto: true,
            label: medic ? 'Tratarlo a bordo (hay medicina en la tripulación)' : 'Tratarlo a bordo con guía desde la Tierra',
            preview: `Éxito ${pct(ok)}`,
            apply: (s, rng) => {
              if (rng() < ok) return { kind: 'ok', text: 'El tratamiento funciona y el tripulante se recupera.' };
              s.health -= 20;
              return { kind: 'warn', text: 'Los síntomas siguen; el tripulante trabaja menos el resto de la misión.' };
            },
          },
          {
            id: 'cut',
            label: 'Recortar la estancia y volver antes',
            preview: 'Seguro · −30 % de ciencia',
            apply: (s) => { s.scienceMult *= 0.7; s.shortenStay(0.5); return { kind: 'warn', text: 'Se acorta la misión para atenderlo en la Tierra cuanto antes.' }; },
          },
        ],
      };
    },
  },
  {
    id: 'water',
    when: (ctx) => ctx.ev.ship.life.id !== 'open' && ctx.totalDays > 30,
    place: (ctx) => firstLong(ctx.steps, (s) => s.type === 'burn'),
    build: (ctx, sim) => {
      const engineer = sim.roles.has('ingeniero');
      const kg = Math.round(ctx.ev.crewN * 3.5 * 20);
      return {
        title: 'Falla del reciclador de agua',
        text: 'El procesador que recupera agua de la orina y el sudor se detiene.',
        fact: 'Dato real: el sistema de recuperación de agua de la ISS recicla ~98 % del agua, pero su procesador de orina ha necesitado repuestos varias veces.',
        options: [
          {
            id: 'repair', auto: true,
            label: 'Repararlo con repuestos',
            preview: `Éxito ${pct(engineer ? 0.92 : 0.65)}${engineer ? ' (ingeniería ayuda)' : ''} · si falla: −${kgs(kg)} de agua`,
            apply: (s, rng) => {
              if (rng() < (engineer ? 0.92 : 0.65)) return { kind: 'ok', text: 'Se cambia la bomba dañada y el agua vuelve a reciclarse.' };
              s.useCons(kg);
              return { kind: 'warn', text: `No hay arreglo: se usan ${kg} kg de agua de reserva por 20 días.` };
            },
          },
          {
            id: 'reserves',
            label: 'Usar el agua de reserva',
            preview: `Sin riesgo de reparación · gasta ${kgs(kg)} de agua · ${reserve(ctx, sim, kg)}`,
            apply: (s) => { s.useCons(kg); return { kind: 'info', text: `Se consumen ${kg} kg de agua de reserva mientras tanto.` }; },
          },
        ],
      };
    },
  },
];

/** Falla de motor: no se programa, aparece si falla una tirada de fiabilidad antes de un encendido. */
export function engineFailure(ctx, sim, step, { canAbort = true } = {}) {
  const engineer = sim.roles.has('ingeniero');
  const arm = ctx.ev.ship.docking.repairs;
  const canEva = engineer || arm;
  const ok = Math.min(0.95, 0.65 + (engineer ? 0.2 : 0) + (arm ? 0.1 : 0));
  return {
    title: 'Falla del motor principal',
    text: `Antes de «${step.name}» el motor no enciende: una válvula de combustible no abre.`,
    fact: 'Dato real: en el Apolo 13 (1970) se usó el motor del módulo lunar para volver; en 2024 la Starliner de Boeing tuvo fallas en sus propulsores y regresó sin tripulación.',
    options: [
      {
        id: 'eva', auto: canEva, disabled: !canEva,
        label: 'Repararlo con una caminata espacial',
        preview: canEva ? `Éxito ${pct(ok)} · +3 mSv · 1 día` : 'Hace falta ingeniería de vuelo o el brazo robótico',
        apply: (s, rng) => {
          s.addDose(3); s.spendDays(1);
          if (rng() < ok) return { kind: 'ok', text: 'La válvula queda reparada y el motor vuelve a funcionar.' };
          s.dvPenalty = 0.3;
          return { kind: 'warn', text: 'No se logra: se seguirá con los propulsores de maniobra, que gastan 30 % más.' };
        },
      },
      {
        id: 'rcs', auto: !canEva,
        label: 'Seguir con los propulsores de maniobra (RCS)',
        preview: 'Gastan ~30 % más de propelente por cada encendido',
        apply: (s) => { s.dvPenalty = 0.3; return { kind: 'warn', text: 'Los propulsores pequeños harán los encendidos que faltan, con menos eficiencia.' }; },
      },
      {
        id: 'abort', disabled: !canAbort,
        label: 'Abortar la misión y volver',
        preview: canAbort ? 'Prioriza la vida de la tripulación' : 'Este encendido es el que trae a la tripulación de vuelta: no se puede saltar',
        apply: (s) => { s.abort('Aborto por falla de motor'); return { kind: 'warn', text: 'Se activa el plan de regreso de emergencia.' }; },
      },
    ],
  };
}
