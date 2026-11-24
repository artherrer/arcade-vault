---
name: spec-juego
description: Diseña la spec para hacer jugable un juego de Arcade Vault y conectarlo al leaderboard de Supabase, siguiendo el patrón de la SPEC 05 (ROCAS jugable) y la SPEC 06 (leaderboard). El juego puede portarse desde references/started-games/ o diseñarse desde cero. Solo escribe la spec en specs/; no escribe código.
disable-model-invocation: true
argument-hint: "juego a integrar (id del catálogo o nombre) y, si existe, carpeta de referencia"
---

# /spec-juego — Spec para integrar un juego jugable con leaderboard

Esta skill produce **una spec** (`specs/NN-<id>-jugable.md`) que, al implementarse con `/spec-impl`, deja un juego del catálogo jugable dentro de `GamePlayer` y guardando puntuaciones en Supabase. **No escribes código.** Solo el `.md` de la spec al final.

Las dos specs canónicas son `specs/05-rocas-asteroids-jugable.md` (motor + reproductor) y `specs/06-leaderboard-supabase.md` (persistencia). La spec que generes es la suma de ambas aplicada a un juego nuevo, **sin rehacer lo que ya es genérico**.

Usa `template.md` (en esta misma carpeta) como forma de la spec. Responde en el idioma del usuario (en este repo, español).

---

## Invariantes heredadas (no se reabren)

Estas decisiones ya se tomaron en las SPEC 05 y 06. La spec las aplica sin preguntar. Si el usuario quiere cambiar alguna, es otra spec.

**Motor** (`lib/<id>/engine.ts`):

- TypeScript puro: sin React, sin `next/*`, sin variables mutables a nivel de módulo. Todo el estado vive en la instancia de `create<Nombre>Game(canvas, callbacks)`.
- Devuelve `{ setPaused, end, destroy }`. `setPaused` congela `update` y reinicia la referencia de tiempo. `end()` congela y llama a `onGameOver` si aún no se llamó. `destroy()` cancela el `requestAnimationFrame` y quita los listeners.
- Callbacks: `onStats` (solo cuando cambia algún valor), `onPhase` y `onGameOver(result)` **una vez por partida** (fin natural o `end()`).
- `result` tiene la forma de `ScoreSubmission` de `lib/scoring.ts`: `score`, `level` (`null` si el juego no tiene niveles) y `durationMs` (entero, suma de los `dt` capados en las fases jugables; no cuenta `ready` ni la pausa).
- Fase `ready` al montar: el juego se ve pero no responde ni hay colisiones. Una tecla de inicio pasa a jugar. El motor **no** se reinicia solo: el reinicio lo hace React remontando el componente con una `key`.
- El canvas **no dibuja** puntuación, vidas, nivel ni `GAME OVER`: eso lo muestra el HUD de React. Sí dibuja indicadores que son parte del juego (power-ups, pieza siguiente, etc.).
- Mundo lógico fijo (p. ej. 800×600), backing store `W·dpr × H·dpr` con `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, escalado por CSS dentro de `.crt-screen` (4:3).
- Teclado en `window`: ignora eventos con foco en `input`/`textarea`/`select`; hace `preventDefault` de las teclas del juego salvo en la fase final. **`P` y `Escape` están reservadas** para la pausa de `GamePlayer`: si la referencia las usa, el motor las deja de usar.
- Si hay referencia: **port sin cambiar física, balance ni puntuación.** Las constantes conservan sus valores y la spec las enumera.

**Plataforma:**

- Arena React fina `components/<id>-canvas.tsx` (`"use client"`): crea el motor en `useEffect`, lo destruye en el cleanup (StrictMode), guarda los callbacks en una ref, recibe `paused` y `over`, y muestra el overlay de inicio con la leyenda de controles y el aviso táctil `NECESITAS UN TECLADO PARA JUGAR` (si el juego necesita teclado).
- `GamePlayer` reutiliza HUD, PAUSA, `P`/`Escape`, pausa por `visibilitychange`, FIN, modal, guardado automático con `ref` de guarda y `JUGAR DE NUEVO`. No se crea un reproductor aparte.
- Conectar el juego = **migración** `connect_<id>` con `insert into public.games (id) values ('<id>')` (fichero en `supabase/migrations/`, aplicada con `apply_migration`) **+ entrada en `SCORE_RULES`** de `lib/scoring.ts`. No se toca el esquema de `scores` ni la vista `leaderboard`.
- `saveScore`, `lib/scores.ts`, el detalle `/games/[id]`, el Salón de la Fama y la biblioteca ya funcionan para cualquier juego con `isConnected(id)`. La spec **no los modifica**: solo verifica que muestran el juego nuevo.
- El catálogo visual sigue en `lib/games.ts`. El `id` del catálogo, la fila de `games` y la clave de `SCORE_RULES` son el mismo string.
- CSS mínimo en `app/globals.css`, diseñado con `/frontend-design` y la estética CRT/neón.
- Fuera de alcance por defecto: sonido, controles táctiles/gamepad, anti-trampas fuerte, tests automatizados, cambios a otros juegos. Si el usuario quiere alguno, propón otra spec.

---

## Fase 1 — Contexto (sin preguntar todavía)

1. Lee `CLAUDE.md`, lista `specs/` (para el número siguiente) y lee **completas** las SPEC 05 y 06, más la última spec de juego si ya hay alguna posterior (su patrón manda sobre el de la 05).
2. Haz inventario del estado real del código. No supongas: compruébalo.
   - `lib/scoring.ts`: qué juegos están ya en `SCORE_RULES`.
   - `supabase/migrations/`: qué migraciones `connect_*` existen.
   - `components/game-player.tsx`: ¿la arena se elige con un `if` fijo (`isRocas`) o con un registro de arenas? ¿El HUD y `endGame` usan tipos de ROCAS (`AsteroidsStats`, `AsteroidsResult`) o tipos genéricos?
   - `lib/games.ts`: si el juego ya tiene entrada en el catálogo (id, título, portada `cover-*`, categoría).
   - Si el juego ya está conectado, para y díselo al usuario.
3. Si el juego viene de `references/started-games/<carpeta>/`, lee **todo**: `game.js`, ficheros auxiliares (`levels.js`, `assets/`, `style.css`, `index.html`), `README.md`, `CLAUDE.md` y sus `specs/` si las tiene. Extrae y anota:
   - tamaño del canvas, bucle y manejo de `dt` (¿capado?, ¿por frame o por segundo?);
   - constantes de física, balance y puntuación, con sus valores;
   - vidas, niveles, condición de fin de partida y fases/estados;
   - controles y teclas (incluidas las que chocan con `P`/`Escape`), uso de ratón;
   - globales, listeners y qué dibuja el canvas que deba pasar al HUD (score, nivel, game over);
   - assets (sprites, fuentes, sonidos) que habría que copiar a `public/`.
4. Resume al usuario lo encontrado en un bloque corto antes de la Fase 2.

## Fase 2 — Preguntas

Bloques de 3 a 5 preguntas numeradas, concretas, con 2–4 opciones y tu recomendación. Espera respuesta tras cada bloque. Considera siempre:

- **Catálogo.** ¿Reutiliza una entrada mock de `lib/games.ts` o se crea una nueva? Sugiere la más parecida (p. ej. tetris → `caida`, arkanoid → `bloque-buster`, snake → `serpentina`). Si se crea, pregunta título, `short`, `long`, categoría, color y portada `cover-<id>`.
- **Origen.** Port de referencia o diseño desde cero. **Desde cero** exige definir por completo en la spec: controles, reglas, tabla de puntos, vidas, niveles, condición de fin y constantes. Sin eso no hay regla de plausibilidad posible.
- **HUD.** Qué stats tiene el juego (`score`, `lives`, `level`). Si no tiene vidas o niveles, ¿el HUD muestra `—` u oculta la casilla? ¿Hace falta otro dato (p. ej. líneas)? Recomienda no añadir casillas nuevas al HUD salvo que el juego no se entienda sin ellas.
- **Regla de plausibilidad.** Propón la regla de `SCORE_RULES` **con el cálculo explícito** a partir de las constantes, como hace la SPEC 06 con ROCAS: granularidad de los puntos (múltiplo de N), puntos máximos por segundo teóricos, y relación mínima entre nivel y puntos. El límite debe ser el máximo teórico, nunca un valor «razonable» que rechace partidas legítimas.
- **Entrada.** Tecla de inicio en `ready` (por defecto `Space`), teclas que se reasignan si chocan con `P`/`Escape`, y si el ratón entra en esta spec.
- **Assets.** Qué se copia a `public/<id>/` y cómo se carga. El sonido queda fuera salvo que el usuario lo pida (y entonces sugiere otra spec).
- **Proporción.** Si el canvas de la referencia no es 4:3, ¿se encaja con bandas o se cambia el mundo lógico? Recomienda bandas: no cambia la física.
- **Generalización** (solo si `GamePlayer` sigue con el `if` fijo de ROCAS). Este es el segundo juego real, así que la spec incluye extraer el contrato común. Propón nombres concretos y confírmalos, por ejemplo:
  - tipos compartidos de motor (`GameStats` con `lives` y `level` que admiten `null`, y el resultado como `ScoreSubmission`);
  - registro `ARENAS` de `id` → componente de arena con props `{ paused, over, onStats, onGameOver }`, que sustituye a `isRocas`;
  - overlay de inicio compartido (CTA + leyenda de controles + aviso táctil) extraído de `AsteroidsCanvas`.
    ROCAS debe seguir igual tras este paso; es el primer paso del plan y tiene criterio de aceptación propio. Si el registro ya existe, el juego solo añade su entrada.

Para cuando puedas responder sin suponer: qué ficheros aparecen o cambian, cuál es el primer y el último paso, y cómo se verifica que el juego está terminado (incluida la fila en `scores`).

Si el juego obliga a decidir en muchos frentes a la vez (mecánica desde cero + assets + ratón + sonido), propón partir la spec.

## Fase 3 — Secciones, una a una

Sigue el orden de `template.md`. Muestra cada sección, pregunta si se queda así y no avances hasta que el usuario confirme. Reglas propias de las specs de juego:

- El **modelo de datos** lleva la API pública del motor con nombres reales, la lista de constantes con valores (si es port), la migración SQL exacta y la regla de `SCORE_RULES` con su comentario de cálculo.
- El **plan** empieza por la generalización si hace falta, luego motor (build pasa sin importarlo), arena + CSS, integración en `GamePlayer`, conexión (migración + regla + `database.types.ts` si cambia) y validación. Cada paso deja el sistema funcionando.
- La **validación** sigue el paso 4 de la SPEC 05 y el paso 6 de la SPEC 06 adaptados: Playwright MCP a 1440×900 y 375×812, consola limpia, `window.scrollY` estable, pausa con `P`/`Escape`, FIN, `JUGAR DE NUEVO`, una fila en `scores` por partida (`execute_sql`), `saveScore` con datos imposibles → `invalid`, el juego aparece en detalle/Salón/biblioteca, ROCAS y los juegos mock siguen igual, borrado de filas y usuarios de prueba, partida manual del usuario hasta el fin natural, `npm run lint` y `npm run build`.
- Los **criterios de aceptación** son booleanos e incluyen siempre: constantes iguales a la referencia (si es port), puntos por acción en el HUD, fin de partida abre el modal, `onGameOver` una sola vez, sin listeners ni rAF tras salir, una sola instancia con StrictMode, nitidez con `dpr` 2, `public.games` con la fila nueva, `isConnected("<id>")` es `true`, y los demás juegos sin cambios.
- En **Decisiones**, registra las invariantes heredadas que aplican (con «heredada de SPEC 05/06») y todas las decisiones nuevas con su razón.

## Fase 4 — Guardar

1. Número siguiente en `specs/` y nombre `NN-<id>-jugable.md` (o el slug que el usuario prefiera). Confirma el nombre antes de escribir.
2. Estado `Borrador`, fecha de hoy y `Depende de:` al menos SPEC 05 y SPEC 06 (y la spec de juego anterior si su generalización es requisito).
3. Indica la ruta, recuerda que pase a `Aprobado` tras releerla y sugiere implementarla con `/spec-impl NN`.

## Reglas duras

- Nunca escribas código ni toques ficheros fuera de `specs/`.
- Nunca generes la spec entera de una vez.
- No supongas el estado del código: compruébalo en la Fase 1.
- No inventes constantes de una referencia: cópialas de su `game.js`.
- No reabras las invariantes heredadas ni metas en la spec cambios a `saveScore`, `lib/scores.ts`, el esquema de `scores` u otras páginas, salvo que el inventario demuestre que no son genéricas.
