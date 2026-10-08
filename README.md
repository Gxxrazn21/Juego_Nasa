# Δv · Arquitecto de Misiones

Juego 3D (Three.js + Vite) para el reto **Space Mission Design Game** del **NASA Space Apps Challenge 2026**.
Creas a tu astronauta y a su tripulación, armas una nave modular pieza por pieza (como un taller de autos,
pero con cápsulas, motores y escudos térmicos reales), planeas la ruta con escalas en estaciones para cargar
provisiones y vuelas la misión. Cada decisión se valida con física y **datos públicos de la NASA**.

## Cómo se juega

| Fase | Qué haces | Qué se valida |
|---|---|---|
| 01 Misión | Destino (ISS, Luna con o sin alunizaje, Marte, asteroide real), programa | Clima espacial de los últimos 30 días (DONKI) |
| 02 Tripulación | Creas tu personaje: nombre, agencia, parche, traje real de la NASA (EMU, Z-2, ACES, Mark III, Gemini, Mercury), color; añades tripulantes con rol | Asientos de la cápsula; cada rol da una ventaja |
| 03 Hangar | Cápsula, hábitat, motor, tanques, energía, soporte vital, escudo térmico, **antena**, acoplamiento, tren de aterrizaje, ciencia, pintura e insignia | Masa, volumen habitable, potencia a la distancia del Sol, enlace de datos |
| 04 Ruta | Cohete, nº de lanzamientos, inyección directa, propelente al despegar y escalas en estaciones | Tsiolkovsky etapa por etapa, víveres día a día, evaporación criogénica, repostajes |
| 05 Revisión | — | 14 chequeos tipo PDR con el «por qué» de cada uno + objetivos del reto activo |
| 06 Vuelo | **Tomas decisiones** cuando algo pasa a bordo | Cada encendido se calcula en vivo; tus decisiones cambian la masa, los víveres, la dosis y la ciencia |
| Informe | Lees qué decidiste, qué te limitó y qué habría pasado con otro diseño | Experimentos «¿qué pasaría si…?» con la misma semilla |

### Qué enseña (cómo cumple el reto)
El reto pide **diseñar, gestionar y simular una misión completa con compromisos de ingeniería**. En el juego:
- **Diseñar**: objetivo, nave, instrumentos, cohete, presupuesto, energía, masa, comunicaciones y restricciones orbitales; cada pieza tiene costo, masa y potencia reales.
- **Gestionar**: durante el vuelo aparecen problemas reales y eliges qué hacer; cada opción muestra su costo (dosis, víveres que sobrarían, % de éxito).
- **Simular**: el vuelo usa la ecuación del cohete con la masa de cada momento, el consumo de víveres, la evaporación criogénica, la dosis de radiación y el presupuesto de enlace.
- **Aprender del resultado**: el informe final vuelve a volar tu misión con un solo cambio (ECLSS, escala en Gateway, antena, escudo, médico…) y te muestra el efecto.

### Decisiones durante el vuelo (basadas en misiones reales)
| Evento | Dato real | Compromiso |
|---|---|---|
| Tormenta solar | El evento de partículas (SEP) o la fulguración más fuerte que **DONKI registró este mes**; maniquíes Helga y Zohar de Artemis I | Refugiarse (¼ de la dosis, −3 % ciencia) o seguir trabajando |
| Micrometeoroide | Soyuz MS-09 (2018) y MS-22 (2022) | Caminata espacial, sellar por dentro o aislar el hábitat / abortar |
| Oportunidad científica | LCROSS (hielo lunar), tormenta de Marte de 2018, partículas de Bennu (OSIRIS-REx) | Quedarse más días (+25 % ciencia) si los víveres alcanzan |
| Conjunción solar | Pausa de comandos a Marte cada ~26 meses | Guardar los datos 14 días o enviarlos con errores |
| Salud (SANS) | Síndrome neuro-ocular en ~70 % de estancias largas | Tratar a bordo o volver antes |
| Reciclador de agua | Procesador de orina de la ISS | Reparar o gastar reservas |
| Falla de motor | Apolo 13, Starliner 2024 | Reparar, seguir con RCS (+30 % propelente) o abortar (retorno libre) |

La ingeniería de vuelo, el brazo robótico y la medicina a bordo cambian las probabilidades. La misma nave repite los mismos eventos: se puede volar otra vez y decidir distinto.

### Retos con medallas
Seis retos con bronce, plata y oro: **Primera expedición** (ISS barata), **Como el Apolo** (Luna sin estaciones), **Clima espacial real** (dosis con el Sol de hoy según DONKI), **Volver a pisar la Luna** (muestras del suelo), **Cazador de asteroides** (NEO real de NeoWs) y **Ciencia desde Marte** (≥ 90 % de datos por la Red de Espacio Profundo). Las medallas se guardan en el dispositivo.

### Comunicaciones
Antenas omnidireccionales en banda S, alta ganancia de 1,5 m (X) y 3 m (Ka), o terminal láser (como DSOC). La tasa se calcula con la distancia real (TDRS en órbita baja, Red de Espacio Profundo más lejos; distancia media Tierra–Marte o Tierra–asteroide a partir de las órbitas) calibrada con Mars Reconnaissance Orbiter y DSOC. **La ciencia de datos que no llega a la Tierra no cuenta**; las muestras cuentan solo si la tripulación vuelve.

### Estaciones y provisiones
- **ISS** (LEO): víveres, agua, O₂, hipergólicos y xenón.
- **Depósito orbital** (concepto NASA): metalox, hidrolox e hidrógeno en grandes cantidades.
- **Gateway lunar** (en construcción): en NRHO; llegar cuesta 0,45 km/s en vez de 0,85.

Las estaciones solo venden ciertos propelentes: si eliges un Raptor (metano) no puedes repostar en Gateway.
Ejemplo real del juego: la Orion por defecto **no puede volver de la Luna sin repostar en Gateway**.

### Naves de fábrica
En el hangar, la pestaña **Naves** trae 6 diseños completos que ya vuelan (probados en los tests, incluso con el Sol en actividad extrema): **Integridad** (Artemis: Orion + SLS + Gateway), **Resiliencia** (Dragon a la ISS), **Tranquilidad** (retro Apolo con motor RL10 y repostaje en órbita), **Prometeo** (alunizador de una sola etapa con motor nuclear), **Ares IV** (tránsito a Marte con hábitat inflable) y **Vigía** (visita al asteroide Apophis). Se cargan con un toque y se pueden modificar; «Volver a mi diseño» deshace el cambio.

### Personalización
- **Pintura**: casco y acento (paleta o color libre), librea (liso, bandas, ajedrez del Saturno V, bicolor, franjas), acabado (satinado, mate, metalizado) y aislamiento MLI (dorado, plata, negro).
- **Nombre de la nave** pintado en los tanques y el hábitat.
- **Insignia de la misión**: forma, símbolo, fondo, texto, una estrella por tripulante… o **sube tu propio logo**. Se pinta en la cápsula y los tanques.
- Luces de navegación (roja a babor, verde a estribor, estroboscópicas) y llama del motor en la cuenta regresiva.

### Inmersión
Cuenta regresiva con encendido del motor y vibración de cámara, sonidos sintetizados (sin archivos), escenas de acoplamiento con los modelos reales de la ISS y el Gateway, y telemetría en vivo durante el vuelo (día, propelente, víveres, dosis).

## Móvil, PC e instalación como app
- **Responsive**: en PC la hoja de papel va a la derecha; en el teléfono vertical la vista 3D queda arriba, el panel tiene su propio scroll y los presupuestos van abajo (al alcance del pulgar); en horizontal se divide 3D | panel. El botón ⤢ amplía la vista 3D.
- **Calidad gráfica** (⚙): *Automática* elige según el dispositivo; *Baja* desactiva sombras, usa texturas de 2048 px y limita a 30 FPS para teléfonos sencillos.
- **Sin conexión**: un service worker guarda la app, los modelos y las texturas después de la primera visita.

### Instalar en el celular (PWA)
Abre el sitio en Chrome (Android) o Safari (iPhone) → menú → **Agregar a la pantalla de inicio**. En Android también aparece el botón **Instalar como app** en ⚙.

### Generar un APK para Android
1. Despliega en Vercel (necesitas la URL pública con HTTPS).
2. Entra a **https://www.pwabuilder.com**, pega la URL y pulsa *Start*.
3. *Package for stores* → **Android** → *Generate*. Descarga el ZIP: trae el `.apk` (para instalar directo) y el `.aab` (para Google Play).
4. Para que se abra a pantalla completa sin barra del navegador, copia el `assetlinks.json` que viene en el ZIP a `public/.well-known/assetlinks.json`, haz commit y vuelve a desplegar.

## Datos NASA usados para validar
- **DONKI (FLR, CME, SEP, GST)** → índice de actividad solar (fulguraciones, partículas solares, Kp) → dosis de radiación (límite de carrera NASA de 600 mSv) y **la tormenta concreta que vive la tripulación** en el vuelo y en el reto «Clima espacial real».
- **NeoWs** → asteroides reales con sus elementos orbitales y su próximo acercamiento a la Tierra → Δv de salida, encuentro y regreso, y duración del viaje.
- **EPIC (DSCOVR)** → foto real de la Tierra de hoy en el briefing.
- **APOD** → imagen del día en el briefing.
- Constantes reales: 0,84 kg de O₂/persona/día, ~1,8 mSv/día en espacio profundo (Curiosity/RAD), 11 km/s de reentrada lunar, capacidades de cohetes, Isp de motores reales.

Si la API falla, se usan datos históricos reales (tormentas de mayo/oct. 2024, Bennu, Apophis…) y la interfaz lo indica.
La clave **nunca llega al navegador**: `api/nasa.js` es una Vercel Function con lista blanca de recursos y caché en el CDN.

## Desarrollo
```bash
npm install
cp .env.example .env      # pega tu NASA_API_KEY
npm run dev               # http://localhost:5173
npm test                  # física, misión, rutas y proxy
npm run build
```

## Desplegar en Vercel
1. Importa el repositorio → Vercel detecta **Vite** (build `npm run build`, salida `dist`).
2. *Settings → Environment Variables*: `NASA_API_KEY`.
3. Deploy. `api/nasa.js` se publica como función en `/api/nasa`.

## Estructura
```
api/nasa.js              Proxy seguro a api.nasa.gov (Vercel Function)
src/main.js              Arranque, estado, fases, vuelo, ajustes
src/app/                 Calidad gráfica, sonido, insignia (canvas) e instalación PWA
src/ui/                  Una plantilla por fase (mission, crew, hangar, route, review, flight) y retos
src/mission.js           Ruta etapa por etapa, provisiones, enlace de datos y validaciones
src/flight.js            Motor de vuelo paso a paso (generador) con decisiones y piloto prudente
src/debrief.js           Informe final y experimentos «¿qué pasaría si…?»
src/physics.js           Tsiolkovsky, Hohmann, encuentro con NEO, potencia solar, presupuesto de enlace
src/data/                Piezas, trajes y roles, destinos, cohetes, estaciones, eventos y retos
src/scene/bodies.js      Tierra realista (día, luces nocturnas, nubes, océanos, atmósfera), Luna, Marte
src/scene/ship.js        Nave modular procedural
src/scene/models.js      Modelos NASA (trajes, ISS, Gateway) con Draco
src/scene/stage.js       Hangar orbital, creación de personaje, mapa y acoplamientos
public/models, textures  Recursos 3D y mapas (texturas de 4096 y 2048 px)
public/sw.js, manifest   App instalable y caché sin conexión
```

## Créditos de recursos
- Trajes (EMU, Z-2, ACES, Mark III, Gemini, Mercury), ISS y Gateway: [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) — dominio público. Comprimidos con Draco/WebP.
- Mapas de la Tierra (día, noche, nubes/rugosidad): [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0, basados en datos de la NASA; versiones redimensionadas de los ejemplos de three.js.
- Luna: textura de los ejemplos de three.js. Marte: NASA 3D Resources.

## Próximos pasos
1. **Caminar dentro de las estaciones**: tercera persona con un astronauta animado para recoger provisiones a mano.
2. **Piezas en GLB** diseñadas a medida que reemplacen a las procedurales (mismas ranuras).
3. **Ventanas de lanzamiento reales** (JPL Horizons) y asistencias gravitatorias.
4. **Modo aula por equipos** con roles reales y **versión en inglés** para el jurado.
