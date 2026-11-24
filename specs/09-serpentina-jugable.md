# SPEC 09 — SERPENTINA jugable: Snake clásico conectado al leaderboard

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-23
> **Objetivo:** Convertir `/games/serpentina/play` en un Snake clásico, escrito en TypeScript dentro de `GamePlayer`, con las frutas de `references/resources/snake-assets/` y guardando sus puntuaciones en Supabase.

---

## Por qué existe esta spec

SERPENTINA es un juego real más del Vault. Usa la entrada simulada `serpentina` que ya está en el catálogo, con su título, su portada `cover-snake` y su color `green`.

No hay un `game.js` de referencia: es un **diseño desde cero**, básico y clásico. Por eso esta spec fija todas las reglas y constantes, y de ellas sale la regla de plausibilidad.

Las reglas, en resumen:

- una rejilla de 32×24 celdas;
- una serpiente que avanza a pasos y acelera con el nivel;
- una fruta en el tablero en cada momento;
- 10 puntos por fruta;
- la partida acaba al chocar con el muro o con el propio cuerpo.

El único asset es `references/resources/snake-assets/fruits.png`: una hoja de 3790×442 con 22 frutas en tres estilos. Se usa la fila de pixel art que recorta `sprites.js`. Las coordenadas de `sprites.js` son válidas, pero **sus nombres no coinciden con la imagen** (`banana` en `x 34` es una manzana), así que se usan solo los recortes.

El contrato común (`GameStats`, `ArenaProps`, `ARENAS` y `ReadyOverlay`) existe desde la SPEC 07. Conectar el juego es:

- una arena nueva y su entrada en el registro;
- su fila en `games`;
- su regla en `SCORE_RULES`.

`GamePlayer`, el leaderboard y las páginas de lectura no se tocan.

Esta spec no depende de la SPEC 08 (BLOQUE BUSTER). Las dos se pueden implementar en cualquier orden.

---

## Alcance

**Entra:**

- **Motor** `lib/serpentina/engine.ts`: TypeScript puro, diseño propio con las reglas del modelo de datos.
  - El estado vive en la instancia de `createSerpentinaGame(canvas, callbacks)`.
  - El mundo lógico es de 800×600, con una rejilla de 32×24 celdas de 25 px.
  - Fases `ready → playing → gameover`:
    - En `ready` se ven la rejilla, la serpiente de 3 segmentos en el centro mirando a la derecha y la primera fruta. Nada se mueve y las direcciones se ignoran.
    - `Space` pasa a `playing`, pero solo cuando `fruits.png` ya está cargado. Después, `Space` no hace nada.
    - `gameover` llega al chocar con el muro o con el propio cuerpo, al llenar el tablero, o con `end()`.
  - El movimiento va a pasos:
    - un acumulador de `dt` (capado a 50 ms) da un paso cada vez que supera `stepInterval(level)`;
    - si en un frame se acumulan varios intervalos, se dan varios pasos, con un bucle `while`.
  - La dirección:
    - un búfer de hasta 2 giros pendientes; cada paso consume uno;
    - se descarta un giro que es la misma dirección que el último del búfer, o su opuesta (giro de 180°);
    - con el búfer lleno, se descartan los giros nuevos.
  - Choques:
    - con el muro, si la cabeza sale de la rejilla;
    - con el cuerpo, si la cabeza entra en un segmento. La cola cuenta como libre si en ese paso no se come, porque se mueve a la vez.
  - Las frutas:
    - siempre hay una en el tablero;
    - aparece en una celda libre elegida al azar, con un recorte al azar de `FRUIT_SPRITES`;
    - comerla da `+10`, alarga la serpiente un segmento y recalcula el nivel;
    - si no queda ninguna celda libre, la partida acaba (fin natural).
  - El dibujo:
    - el fondo y la rejilla con constantes del Vault oscuro;
    - la serpiente en verde neón, con la cabeza en un tono más claro;
    - la fruta escalada dentro de su celda, manteniendo la proporción.
    - No dibuja puntuación, nivel ni `GAME OVER`.
  - El spritesheet se carga con `new Image()` dentro de la instancia, desde `/serpentina/fruits.png`. Mientras carga, se dibuja todo salvo la fruta.
  - `durationMs` es la suma de los `dt` capados en `playing`, redondeada a entero.
  - `onStats({ score, lives: null, level })` solo se llama cuando algo cambia. `onGameOver` se llama una vez por partida.
  - `setPaused`, `end` y `destroy` funcionan como en ROCAS y APILA.
  - El teclado:
    - las teclas son `←`, `↑`, `→`, `↓`, `W`, `A`, `S`, `D` y `Space`;
    - las letras valen en mayúscula y en minúscula, y se reconocen por `event.key`;
    - se ignoran los eventos con el foco en un campo de texto;
    - se hace `preventDefault` de esas teclas salvo en `gameover`;
    - no hay ratón.
  - El canvas reserva `800·dpr × 600·dpr` píxeles con `setTransform(dpr, …)`.

- **Arena** `components/serpentina-canvas.tsx` (`"use client"`):
  - mismo patrón que `ApilaCanvas`: el motor se crea en `useEffect` y se destruye en el cleanup, los callbacks van en una ref, y recibe `paused` y `over`;
  - en `ready` usa `ReadyOverlay` con la leyenda `← ↑ → ↓ / WASD MOVER · ESPACIO EMPEZAR · P / ESC PAUSA`, y el aviso táctil se mantiene.
- **Registro** `components/arenas.ts`: la entrada `serpentina`, con `initial: { score: 0, lives: null, level: 1 }`. `GamePlayer` no cambia.
- **Catálogo** `lib/games.ts`: en `serpentina` solo cambia `long`, que pasa a ser:
  - «Una serpiente de luz recorre la grilla devorando frutas pixeladas. Cada bocado la alarga, y cada cinco sube el nivel y la velocidad. Un choque contra el muro o contra tu propia cola y se acabó.».
  - `id`, `title`, `short`, `cat`, `cover` y `color` se quedan igual. `best` y `plays` siguen simulados.
- **Assets**: `references/resources/snake-assets/fruits.png` se copia entero a `public/serpentina/fruits.png`. `sprites.js` no se copia: sus recortes pasan al motor como `FRUIT_SPRITES`.
- **Conexión**: la migración `connect_serpentina` y la regla `serpentina` en `SCORE_RULES`.
- **CSS** mínimo en `app/globals.css` para el canvas dentro de `.crt-screen`. Se diseña con `/frontend-design`.
- Validación con Playwright MCP y `execute_sql`.

**Fuera de alcance (para specs futuras):**

- Sonido, controles táctiles, gamepad y ratón.
- Muros que te hacen aparecer por el lado opuesto, obstáculos, frutas con puntos distintos o que caducan, power-ups y varios jugadores.
- Recortar u optimizar `fruits.png`, o usar sus filas plana o de fotos.
- Una portada nueva o un cambio de título.
- Hacer jugables otros juegos.
- Anti-trampas más allá de la regla de plausibilidad.
- Tests automatizados.

---

## Modelo de datos

No hay tablas nuevas ni cambios en `scores` ni en la vista `leaderboard`. Se añaden una fila en `games`, una regla y una entrada en `ARENAS`. Los tipos comunes (`GameStats`, `ArenaProps` y `ScoreSubmission`) se usan tal cual.

### Motor — `lib/serpentina/engine.ts`

```ts
export type SerpentinaPhase = "ready" | "playing" | "gameover";

export type SerpentinaCallbacks = {
  onStats: (stats: GameStats) => void; // { score, lives: null, level }, solo si cambia
  onPhase: (phase: SerpentinaPhase) => void;
  onGameOver: (result: ScoreSubmission) => void; // muro, cuerpo, tablero lleno, o end()
};

export type SerpentinaGame = {
  setPaused: (paused: boolean) => void;
  end: () => void;
  destroy: () => void;
};

export function createSerpentinaGame(
  canvas: HTMLCanvasElement,
  callbacks: SerpentinaCallbacks,
): SerpentinaGame;
```

Estado interno (orientativo):

```ts
type Cell = { x: number; y: number }; // columna 0..31, fila 0..23
type Dir = "up" | "down" | "left" | "right";
// snake: Cell[] (cabeza en [0]), dir: Dir, queue: Dir[] (≤ 2),
// fruit: { cell: Cell; sprite: number }, fruits, score, level, acc, durationMs
```

Reglas del juego (diseño propio):

| Regla                 | Valor                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `W` × `H`             | `800` × `600`                                                                            |
| `CELL`                | `25` px                                                                                  |
| `COLS` × `ROWS`       | `32` × `24` (768 celdas)                                                                 |
| Serpiente inicial     | 3 segmentos: cabeza en `(16, 12)` y cuerpo en `(15, 12)` y `(14, 12)`, mirando a `right` |
| `stepInterval(level)` | `max(60, 150 − (level − 1) · 10)` ms (nivel 1 → 150, nivel 10 o más → 60)                |
| `MIN_STEP`            | `60` ms                                                                                  |
| `POINTS_PER_FRUIT`    | `10`                                                                                     |
| `FRUITS_PER_LEVEL`    | `5`; `level = floor(fruits / 5) + 1`                                                     |
| `MAX_QUEUE`           | `2` giros pendientes                                                                     |
| `MAX_DT`              | `50` ms                                                                                  |
| Fin de partida        | muro, cuerpo (la cola cuenta como libre si no se come) o tablero lleno                   |
| Puntuación máxima     | `(768 − 3) · 10 = 7650`                                                                  |

`FRUIT_SPRITES` son los 22 recortes de `sprites.js`, sin nombres. Todos tienen `y 136` y `h 160`. Los pares `x / w`, en orden:

`34/110`, `186/150`, `378/110`, `540/130`, `712/130`, `894/110`, `1066/110`, `1228/130`, `1400/130`, `1582/110`, `1734/150`, `1906/150`, `2068/170`, `2250/140`, `2432/130`, `2604/130`, `2786/110`, `2948/130`, `3110/150`, `3302/110`, `3454/150`, `3637/130`.

Colores y ruta (constantes del motor, con los valores de los tokens de `globals.css`):

| Constante     | Valor                    | Origen                            |
| ------------- | ------------------------ | --------------------------------- |
| `BG`          | `#0a0a0f`                | `--bg`                            |
| `GRID_LINE`   | `#14141f`                | nuevo, rejilla tenue              |
| `SNAKE`       | `#00ff88`                | `--green`                         |
| `SNAKE_HEAD`  | `#b3ffd9`                | nuevo, verde claro para la cabeza |
| `SPRITES_SRC` | `/serpentina/fruits.png` | asset copiado a `public/`         |

`GRID_LINE` y `SNAKE_HEAD` se pueden ajustar con `/frontend-design`. No cambian las reglas.

### Registro — `components/arenas.ts`

```ts
serpentina: { Arena: SerpentinaCanvas, initial: { score: 0, lives: null, level: 1 } },
```

### Conexión — `supabase/migrations/<version>_connect_serpentina.sql`

```sql
insert into public.games (id) values ('serpentina');
```

`<version>` es la que devuelven `apply_migration` y `list_migrations`.

### Regla — `lib/scoring.ts`

```ts
// SERPENTINA: 10 puntos por fruta → múltiplo de 10.
// El nivel sale solo de las frutas: level = floor(fruits/5) + 1 = floor(score/50) + 1 (igualdad exacta).
// Máximo: 768 celdas − 3 segmentos iniciales = 765 frutas → 7650.
// Tiempo: una fruta exige un paso, y un paso consume ≥ 60 ms de dt acumulado
//   → frutas ≤ sumDt/60. Con durationMs = round(sumDt), sumDt ≤ durationMs + 0,5
//   → score ≤ 10 · floor((durationMs + 1) / 60).
serpentina: ({ score, level, durationMs }) =>
  level !== null &&
  score % 10 === 0 &&
  score <= 7650 &&
  level === Math.floor(score / 50) + 1 &&
  score <= 10 * Math.floor((durationMs + 1) / 60),
```

---

## Plan de implementación

1. **Motor de SERPENTINA.**
   - Leer `lib/apila/engine.ts` como patrón de fases, `dt`, `dpr`, teclado y `onStats`.
   - Copiar `references/resources/snake-assets/fruits.png` a `public/serpentina/fruits.png`.
   - Crear `lib/serpentina/engine.ts` con las reglas y constantes del modelo de datos y los detalles del Alcance.
   - `npm run build` pasa, aunque el motor no se importa todavía desde ningún sitio.
2. **Arena y CSS.**
   - Crear `components/serpentina-canvas.tsx` con `ReadyOverlay` y la leyenda de SERPENTINA.
   - Añadir el CSS del canvas en `globals.css`, diseñado con `/frontend-design`. Las scanlines de `.crt-screen::after` quedan por encima del canvas.
3. **Integración y catálogo.**
   - Añadir `serpentina` a `ARENAS`.
   - Cambiar `long` de `serpentina` en `lib/games.ts`.
   - Prueba manual: `/games/serpentina/play` se juega de principio a fin. ROCAS, APILA y `/games/gloton/play`, que sigue simulado, siguen igual.
4. **Conexión.**
   - Aplicar `connect_serpentina` con `apply_migration` y guardar el mismo SQL en `supabase/migrations/<version>_connect_serpentina.sql`.
   - Añadir la regla `serpentina` a `SCORE_RULES`.
   - Ejecutar `get_advisors` (security). `database.types.ts` no cambia, porque solo se inserta una fila.
   - Prueba: con sesión, una partida con puntos crea **una** fila con `game_id = 'serpentina'`. Se comprueba con `execute_sql`.
5. **Validación.** Con `npm run dev` y Playwright MCP, a 1440×900, en `/games/serpentina/play`:
   - Se ven el overlay de inicio, la rejilla, la serpiente de 3 segmentos y una fruta. Las flechas no mueven nada.
   - `Space` arranca la partida y la serpiente avanza a la derecha. Sin tocar nada, choca con el muro en unos 2,4 s (16 pasos × 150 ms) y se abre el modal `FIN DEL JUEGO` con 0 puntos.
   - En otra partida, se localiza la fruta leyendo los píxeles del canvas con `getImageData` (la celda que no es fondo, ni rejilla, ni serpiente) y se lleva la serpiente hasta ella con las flechas. El HUD suma exactamente `10`.
   - Pulsar `→` estando la serpiente mirando a la izquierda, o `←` mirando a la derecha, no la mata.
   - `W`, `A`, `S` y `D` giran igual que las flechas.
   - `window.scrollY` no cambia al pulsar flechas o `Space`.
   - `P` pausa: la serpiente no se mueve en 2 s. `P` reanuda sin salto, y `Escape` pausa.
   - FIN abre el modal. `JUGAR DE NUEVO` vuelve a `ready` con 0 puntos, `—` en vidas y nivel `01`.

   Además:
   - Con sesión, la partida con fruta crea una fila con `score = 10`, `level = 1` y un `duration_ms` que cuadra con el tiempo jugado.
   - Llamar a `saveScore` con `{ gameId: "serpentina", … }` y cuatro partidas imposibles:
     - `{ score: 15, level: 1, durationMs: 60000 }`, que no es múltiplo de 10;
     - `{ score: 100, level: 1, durationMs: 60000 }`, con un nivel que no cuadra;
     - `{ score: 7660, level: 154, durationMs: 9999999 }`, por encima del máximo;
     - `{ score: 100, level: 3, durationMs: 500 }`, demasiado rápida.

     Las cuatro devuelven `invalid` y no crean filas.

   - `/games/serpentina`, `/hall-of-fame?game=serpentina` y `/games` muestran los datos reales.
   - ROCAS, APILA y `/games/gloton/play` siguen igual.
   - A 375×812: no hay scroll horizontal y el canvas está en 4:3.
   - Emular un dispositivo táctil y ver el aviso `NECESITAS UN TECLADO PARA JUGAR`.
   - Revisar la consola en cada paso, incluido que `fruits.png` carga sin 404.
   - Pedir al usuario una partida manual larga, que pase al menos al nivel 3 y termine de forma natural.
   - Borrar las filas de `scores` y los usuarios de prueba.
   - `npm run lint` y `npm run build`.

---

## Criterios de aceptación

**Motor y juego**

- [ ] `lib/serpentina/engine.ts` no importa React ni nada de `next/*`, y no tiene variables mutables a nivel de módulo.
- [ ] Las constantes del motor tienen los valores de la tabla del modelo de datos, incluidos los 22 recortes de `FRUIT_SPRITES`.
- [ ] `public/serpentina/fruits.png` existe y se carga sin errores.
- [ ] Al entrar en `/games/serpentina/play` se ven la rejilla de 32×24, la serpiente de 3 segmentos en el centro, una fruta y el overlay `PULSA ESPACIO PARA EMPEZAR` con la leyenda de controles. Nada se mueve y las flechas no hacen nada.
- [ ] `Space` arranca la partida y la serpiente avanza a la derecha a un paso cada 150 ms.
- [ ] Cada fruta comida suma exactamente `10` en el HUD, alarga la serpiente un segmento y hace aparecer otra fruta en una celda libre.
- [ ] Con 5 frutas el HUD pasa al nivel `02`, y la serpiente avanza a un paso cada 140 ms.
- [ ] El giro de 180° se ignora. Dos giros rápidos dentro del mismo paso se aplican en dos pasos seguidos.
- [ ] Chocar con el muro o con el propio cuerpo abre el modal `FIN DEL JUEGO` con la puntuación final. Entrar en la celda de la cola en un paso sin fruta no mata.
- [ ] El canvas no dibuja puntuación, nivel ni `GAME OVER`.
- [ ] El HUD muestra `—` en vidas durante toda la partida.
- [ ] `onGameOver` se llama una sola vez por partida, tanto en el game over natural como con FIN. `durationMs` no cuenta el tiempo en `ready` ni en pausa.
- [ ] Pulsar flechas, `WASD` o `Space` durante la partida no hace scroll en la página.
- [ ] El botón PAUSA, `P` y `Escape` pausan y reanudan. En pausa la serpiente no se mueve, y al reanudar no da un salto.
- [ ] Ocultar la pestaña pausa la partida, y sigue en pausa al volver.
- [ ] `JUGAR DE NUEVO` vuelve a `ready` con 0 puntos, `—` y nivel `01`.
- [ ] Al salir de la página no quedan listeners de `keydown` ni bucles `requestAnimationFrame`: en otra ruta, las flechas vuelven a hacer scroll.
- [ ] Con StrictMode solo hay un bucle activo, y la serpiente avanza a la velocidad normal.
- [ ] El canvas se ve nítido con `devicePixelRatio` 2 y mantiene el 4:3 a 1440 px y a 375 px. A 375 px no hay scroll horizontal.
- [ ] En un dispositivo táctil emulado se ve `NECESITAS UN TECLADO PARA JUGAR`.

**Catálogo y leaderboard**

- [ ] `ARENAS` contiene `serpentina` con `initial: { score: 0, lives: null, level: 1 }`, y `GamePlayer` no ha cambiado.
- [ ] En `lib/games.ts`, `serpentina` solo cambia en `long`, que tiene el texto del Alcance.
- [ ] Existe `supabase/migrations/<version>_connect_serpentina.sql`, y `list_migrations` muestra la misma versión.
- [ ] `public.games` contiene `serpentina`, y además solo los juegos conectados antes: `rocas`, `apila` y, si la SPEC 08 ya está implementada, `bloque-buster`.
- [ ] `isConnected("serpentina")` es `true`.
- [ ] `get_advisors` (security) no muestra avisos nuevos.
- [ ] Con sesión y puntuación > 0, una partida crea **una** fila en `scores` con el `user_id` del jugador, `game_id = 'serpentina'`, y el `level` y el `duration_ms` de la partida.
- [ ] `saveScore` con las cuatro partidas imposibles del paso 5 devuelve `invalid` y no inserta nada.
- [ ] `/games/serpentina`, `/hall-of-fame?game=serpentina` y la tarjeta de SERPENTINA en `/games` muestran los datos reales, o sus estados vacíos.
- [ ] ROCAS, APILA y los juegos simulados que quedan se ven y funcionan igual que antes.

**Calidad**

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/games/serpentina/play`, `/games/serpentina`, `/games/rocas/play` ni `/games/apila/play`.
- [ ] Las filas de `scores` y los usuarios de prueba creados durante la validación se han borrado.

---

## Decisiones

**Heredadas de las SPEC 05, 06 y 07:**

- **Sí:** motor en TypeScript puro con `setPaused`, `end` y `destroy`, y una arena React fina encima (heredada de SPEC 05).
- **Sí:** fase `ready` y reinicio remontando el componente con una `key`. El motor no se reinicia solo (heredada de SPEC 05).
- **Sí:** el HUD y el game over los pinta React, no el canvas (heredada de SPEC 05).
- **Sí:** `P` y `Escape` son de `GamePlayer` (heredada de SPEC 05).
- **Sí:** mundo lógico fijo con backing store × `devicePixelRatio` (heredada de SPEC 05).
- **Sí:** `dt` capado a 50 ms (heredada de SPEC 07).
- **Sí:** conectar un juego es una fila en `games` más una regla en `SCORE_RULES`, sin tocar `scores`, `saveScore` ni las lecturas (heredada de SPEC 06).
- **Sí:** guardado automático, una vez por partida, solo con sesión. FIN guarda y SALIR descarta (heredada de SPEC 06).
- **Sí:** el juego se conecta con una entrada en `ARENAS`, `GameStats`, `ScoreSubmission` y `ReadyOverlay`, sin tocar `GamePlayer` (heredada de SPEC 07).

**Nuevas:**

- **Sí:** diseño desde cero, básico y clásico. No hay un `game.js` de referencia, así que la spec fija todas las reglas.
- **Sí:** reutilizar la entrada `serpentina` con su id, título, portada `cover-snake` y color `green`. Ya describe este juego.
- **Sí:** cambiar solo el `long`. El texto actual habla de «núcleos magenta», y ahora el juego tiene frutas y niveles.
- **Sí:** rejilla de 32×24 celdas de 25 px en el mundo de 800×600. Cabe exacta en el 4:3, sin bandas.
- **Sí:** los muros son mortales. Es el Snake clásico.
- **No:** aparecer por el lado opuesto al cruzar un muro. Sería una variante.
- **Sí:** movimiento a pasos con un acumulador de `dt` y un bucle `while`. La velocidad no depende de los fps, y la regla de tiempo sale directa de `MIN_STEP`.
- **Sí:** `stepInterval = max(60, 150 − (nivel − 1)·10)` y un nivel cada 5 frutas. La aceleración se nota y tiene un tope jugable a partir del nivel 10.
- **Sí:** un búfer de 2 giros, descartando el giro de 180° y los repetidos. Así dos pulsaciones rápidas no se pierden ni matan a la serpiente.
- **Sí:** la cola cuenta como libre si en ese paso no se come. Es el comportamiento correcto, porque la cola se mueve en ese mismo paso.
- **Sí:** llenar el tablero es fin natural. No queda sitio para la fruta, y no hace falta un estado de victoria aparte.
- **Sí:** 10 puntos por fruta, sin multiplicador de nivel. Es lo más simple, y la regla de plausibilidad sale exacta.
- **Sí:** HUD con puntos y nivel, y `—` en vidas, igual que APILA. Snake no tiene vidas.
- **Sí:** `WASD` además de las flechas. No chocan con `P` ni con `Escape`.
- **No:** ratón. En Snake no tiene uso natural.
- **Sí:** el aviso táctil se mantiene. Sin teclado no se puede jugar.
- **Sí:** las frutas con la fila de pixel art de `fruits.png`, elegidas al azar. Es la fila que recorta `sprites.js`, y encaja con la estética arcade.
- **Sí:** usar solo las coordenadas de `sprites.js`, sin sus nombres. Los nombres no coinciden con la imagen.
- **Sí:** copiar `fruits.png` entero a `public/serpentina/`. Recortarlo exigiría herramientas de imagen, y sus 585 KB se cargan una vez.
- **Sí:** el aspecto es neón CRT propio del Vault: fondo oscuro, rejilla tenue y serpiente verde.
- **No:** imitar el tablero de ajedrez verde ni el estilo del Google Snake. Las frutas vienen de ese juego (según `sprites.js`), así que el resto del aspecto es propio. Antes de publicar el Vault habría que revisar la licencia del asset.
- **Sí:** la regla de plausibilidad exacta: múltiplo de 10, `level === floor(score/50) + 1`, `score ≤ 7650` y `score ≤ 10·floor((durationMs + 1)/60)`. Todo sale de las reglas propias, así que no rechaza ninguna partida legítima.
- **Sí:** probar la puntuación en Playwright localizando la fruta con `getImageData`. La fruta aparece al azar, y sin eso no hay forma automática de sumar puntos.
- **Sí:** usar `/games/gloton/play` como juego simulado de control, porque `serpentina` deja de ser simulado.

---

## Riesgos

| Riesgo                                                                                                                | Mitigación                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fruits.png` no carga (ruta mal puesta o 404), y no aparece la fruta.                                                 | La ruta es una constante, `SPRITES_SRC`. `Space` no arranca hasta que la imagen carga. La validación revisa la consola y la red.                                         |
| Los nombres de `sprites.js` no coinciden con la imagen, y alguien los usa creyendo que son correctos.                 | `FRUIT_SPRITES` es un array sin nombres, y la spec lo explica.                                                                                                           |
| Con muchos pasos por frame (tras un tirón), la serpiente salta varias celdas y se salta un choque.                    | Cada paso se resuelve entero dentro del `while`, con choque y comida, antes del siguiente. Con `MAX_DT = 50` ms y `MIN_STEP = 60` ms nunca hay más de un paso por frame. |
| Dos giros rápidos provocan un giro de 180° encubierto (por ejemplo `↑` y `←` mirando a la derecha, en un mismo paso). | Cada giro se compara con el último del búfer, no con la dirección actual, y cada paso consume un solo giro.                                                              |
| La regla de tiempo rechaza una partida legítima por el redondeo de `durationMs`.                                      | El `+1` de `floor((durationMs + 1) / 60)` cubre el redondeo, y los pasos nunca consumen menos de 60 ms.                                                                  |
| Buscar celda libre para la fruta se hace lento con la serpiente muy larga.                                            | Se recorren las 768 celdas como mucho una vez por fruta, que es despreciable.                                                                                            |
| No se puede sumar puntos con Playwright, porque la fruta aparece al azar.                                             | Se localiza con `getImageData` y se dirige la serpiente hasta ella. Como respaldo, la partida manual del usuario.                                                        |
| La licencia del asset de frutas no está clara (Google Snake).                                                         | Solo se usan los sprites de fruta, y el resto del aspecto es propio. Queda anotado en Decisiones para revisarlo antes de publicar.                                       |
| Quedan datos de prueba en el proyecto remoto.                                                                         | El paso 5 los borra, y hay un criterio de aceptación.                                                                                                                    |

---

## Lo que **no** entra en esta spec

- Sonido, controles táctiles, gamepad y ratón.
- Muros que te hacen aparecer por el lado opuesto, obstáculos, frutas con puntos distintos o que caducan, power-ups y varios jugadores.
- Recortar u optimizar `fruits.png`, o usar sus filas plana o de fotos.
- Una portada nueva o un cambio de título.
- Hacer jugables otros juegos.
- Anti-trampas más allá de la regla de plausibilidad.
- Tests automatizados.

Cada uno de estos puntos, si llega, va en su propia spec.
