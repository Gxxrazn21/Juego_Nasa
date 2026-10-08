# Δv · Arquitecto de Misiones

Juego 3D (Three.js + Vite) para el reto **Space Mission Design Game** del **NASA Space Apps Challenge 2026**.
El jugador diseña, lanza y simula una misión completa: objetivo, nave, instrumentos, energía, comunicaciones,
propulsión, lanzador y presupuesto. Cada decisión se valida con física real y **datos públicos de la NASA**.

## Cómo se juega

| Fase | Qué decides | Qué se valida |
|---|---|---|
| 01 Objetivo | Programa (SIMPLEx → Flagship), destino (LEO, GEO, Luna, Marte, asteroide real), vida útil | Clima espacial de los últimos 30 días (DONKI) |
| 02 Nave | Bus, instrumentos, paneles/RTG, antena y transmisor, motor y propelente, blindaje | Masa, potencia a la distancia del Sol, Δv (Tsiolkovsky), enlace de datos |
| 03 Lanzador | Electron, Falcon 9, Atlas V, Falcon Heavy, SLS | Capacidad según el destino y la energía C3 |
| 04 Revisión | — | Revisión de diseño (PDR) con 7–8 chequeos y el "por qué" de cada uno |
| 05 Vuelo | — | Simulación 3D con eventos solares reales, inserción orbital, retorno científico y nota (S–D) |

## Datos NASA usados para validar

- **DONKI (FLR, CME)** — fulguraciones y eyecciones de masa coronal de los últimos 30 días → índice de actividad solar → riesgo de radiación y eventos de la simulación (fecha y clase reales).
- **NeoWs (browse)** — asteroides reales con sus elementos orbitales (a, e, i, Ω, ω) → C3 de lanzamiento, Δv de encuentro y duración del viaje (Hohmann + cambio de plano), órbita dibujada en 3D, aviso PHA.
- **APOD** — imagen astronómica del día en el briefing.

Si la API falla o se agota `DEMO_KEY`, el juego usa datos históricos reales (tormentas solares de mayo/oct. 2024, Bennu, Ryugu, Apophis…) e indica "respaldo" en la interfaz.

La clave **nunca llega al navegador**: `api/nasa.js` es una Vercel Function que la añade en el servidor, solo permite 4 recursos y cachea en el CDN 1 h.

## Desarrollo

```bash
npm install
cp .env.example .env      # pega tu NASA_API_KEY
npm run dev               # http://localhost:5173 (el proxy /api/nasa también funciona en dev)
npm test                  # física, misión y proxy
npm run build
```

## Desplegar en Vercel

1. Importa el repositorio en vercel.com → detecta **Vite** automáticamente (build `npm run build`, salida `dist`).
2. *Settings → Environment Variables*: `NASA_API_KEY = tu_clave`.
3. Deploy. La carpeta `api/` se publica como función en `/api/nasa`.

## Estructura

```
api/nasa.js            Proxy seguro a api.nasa.gov (Vercel Function)
src/main.js            Arranque, estado, fases, eventos
src/mission.js         Presupuestos, validaciones y simulación
src/physics.js         Tsiolkovsky, Hohmann, encuentro con NEO, potencia solar, enlace
src/nasa.js            Cliente DONKI / NeoWs / APOD con respaldo
src/ui.js              Plantillas de cada fase y medidores
src/scene/             Escena 3D: nave procedural, mapa orbital, texturas
src/data/              Catálogo de piezas/lanzadores/destinos y datos de respaldo
tests/                 Pruebas con node:test
```

## Ideas para seguir creciendo

1. **Ventanas de lanzamiento reales**: usar JPL Horizons / efemérides para que la fecha de lanzamiento cambie el C3 (gráfico "porkchop").
2. **Asistencias gravitatorias**: sobrevuelo de la Tierra o Venus para ahorrar Δv (como OSIRIS-REx o Juno).
3. **Modo desafío / campaña**: misiones con requisitos ("trae una muestra de un PHA con < US$ 900 M") y tabla de clasificación.
4. **Modo multijugador en aula**: equipos con roles (jefe de misión, energía, comunicaciones, presupuesto) que negocian el mismo diseño.
5. **Más datos NASA**: EPIC (imagen real de la Tierra el día del lanzamiento), Exoplanet Archive para un modo telescopio, Mars weather para aterrizajes.
6. **Fase de aterrizaje**: entrada atmosférica en Marte con escudo térmico y paracaídas.
7. **Eventos durante operaciones**: pérdida de una rueda de reacción, degradación de paneles, extensión de misión.
8. **Bilingüe ES/EN** para el jurado internacional y modo accesible con lector de pantalla para la bitácora.

> Los valores de lanzadores y piezas son aproximaciones de datos públicos con fines educativos; los puntos científicos son de balance de juego.
