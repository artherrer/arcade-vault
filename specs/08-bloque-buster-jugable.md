# SPEC 08 — BLOQUE BUSTER jugable: port del Arkanoid de referencia conectado al leaderboard

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-23
> **Objetivo:** Convertir `/games/bloque-buster/play` en el Arkanoid de `references/started-games/04-arkanoid/`, portado a TypeScript dentro de `GamePlayer` y guardando sus puntuaciones en Supabase.

---

## Por qué existe esta spec

BLOQUE BUSTER es el tercer juego real del Vault. Usa la entrada simulada `bloque-buster` que ya está en el catálogo, con su título, su portada `cover-bricks` y su color `cyan`.

La referencia son tres ficheros con estado global:

- `game.js` (268 líneas), `levels.js` (los 5 niveles) y `assets/spritesheet.js` (los sprites y la carga de la imagen);
- un canvas de 800×600, que ya es 4:3;
- una paleta que se mueve con `←`/`→` o con el ratón, una pelota y una rejilla de bloques de 10×6;
- 10 puntos por bloque, 3 vidas y 5 niveles, cada uno con su patrón y más rápido que el anterior;
- una animación de explosión de 4 frames al romper un bloque, y dos efectos de sonido.

Usa `P`/`Escape` para pausar, con un selector de nivel en la pausa. Dibuja en el canvas la puntuación, el nivel, las vidas, GAME OVER y la victoria. No capa el `dt`.

El contrato común (`GameStats`, `ArenaProps`, `ARENAS` y `ReadyOverlay`) ya existe desde la SPEC 07. Conectar este juego es:

- una arena nueva y su entrada en el registro;
- su fila en `games`;
- su regla en `SCORE_RULES`.

`GamePlayer`, el leaderboard y las páginas de lectura no se tocan.

---

## Alcance

**Entra:**

- **Motor** `lib/bloque-buster/engine.ts`: TypeScript puro, port de `game.js`, `levels.js` y `assets/spritesheet.js`. Conserva:
  - las constantes `PADDLE_SPEED`, `BLOCK_COLS`, `BLOCK_ROWS`, `BLOCK_W`, `BLOCK_H`, `BLOCKS_ORIGIN_X`, `BLOCKS_ORIGIN_Y`, `BASE_BALL_VX`, `BASE_BALL_VY` y `EXPLOSION_DURATION`;
  - la paleta de `81×14` en `y = 560` y la pelota de `16×16`;
  - los 5 niveles de `LEVELS`, con sus patrones, colores y multiplicadores de velocidad;
  - `SPRITES` y `EXPLOSION_FRAMES`, con las mismas coordenadas del spritesheet;
  - la física:
    - los rebotes con `abs` en las paredes y el techo;
    - el rebote en la paleta con la tolerancia de `+8` px y sin cambio de ángulo;
    - la colisión AABB con los bloques, que invierte `vy` y rompe un solo bloque por frame;
  - 10 puntos por bloque;
  - 3 vidas. La pelota se pierde con `y > 600` y vuelve a la paleta con la velocidad del nivel, sin saque;
  - el paso al nivel siguiente al romper el último bloque: la pelota vuelve a la paleta y la paleta no se mueve;
  - la animación de explosión de 4 frames y el fondo `#000`.

  Cambios respecto a la referencia:
  - El estado vive en la instancia de `createBloqueBusterGame(canvas, callbacks)`.
  - El spritesheet se carga con `new Image()` dentro de la instancia, desde `/bloque-buster/spritesheet-breakout.png`. Mientras carga, el canvas solo pinta el fondo.
  - Fases `ready → playing → gameover`:
    - En `ready` se ven los bloques del nivel 1, la paleta centrada y la pelota encima. Nada se mueve y no hay colisiones.
    - `Space` pasa a `playing`, pero solo cuando el spritesheet ya está cargado. La pelota sale sola con la velocidad del nivel 1.
    - `gameover` llega al perder la última vida, al romper el último bloque del nivel 5, o con `end()`.
  - La victoria es un fin natural de partida: llama a `onGameOver` con `level: 5`. Ya no se dibuja «¡Completaste el juego!».
  - Desaparecen el overlay de PAUSA y su selector de nivel, el overlay de GAME OVER, los textos Score y Nivel, las vidas dibujadas, y el sonido.
  - El `dt` se capa a 50 ms. `durationMs` es la suma de esos `dt` en `playing`.
  - `onStats({ score, lives, level })` solo se llama cuando algo cambia. `onGameOver` se llama una vez por partida.
  - `setPaused`, `end` y `destroy` funcionan como en ROCAS y APILA. Al pausar se sueltan `←` y `→`, para que la paleta no siga moviéndose al reanudar.
  - El teclado:
    - las teclas son `←` y `→` (se mantienen pulsadas) y `Space` (solo para empezar);
    - `P` y `Escape` dejan de ser del motor;
    - se ignoran los eventos con el foco en un campo de texto;
    - se hace `preventDefault` de esas teclas salvo en `gameover`.
  - El ratón:
    - con `mousemove` sobre el canvas, la paleta se centra en el cursor, con la x pasada al mundo lógico y limitada a `[0, 800 − 81]`;
    - solo tiene efecto en `playing` sin pausa (la referencia también la movía en pausa);
    - se quita el listener de `click` del selector de nivel.
  - El canvas reserva `800·dpr × 600·dpr` píxeles con `setTransform(dpr, …)`.

- **Arena** `components/bloque-buster-canvas.tsx` (`"use client"`):
  - mismo patrón que `ApilaCanvas`: el motor se crea en `useEffect` y se destruye en el cleanup, los callbacks van en una ref, y recibe `paused` y `over`;
  - en `ready` usa `ReadyOverlay` con la leyenda `← → / RATÓN MOVER · ESPACIO EMPEZAR · P / ESC PAUSA`, y el aviso táctil se mantiene.
- **Registro** `components/arenas.ts`: la entrada `"bloque-buster"`, con `initial: { score: 0, lives: 3, level: 1 }`. `GamePlayer` no cambia.
- **Catálogo** `lib/games.ts`: en `bloque-buster` solo cambia `long`, que pasa a ser:
  - «Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cinco niveles, cinco patrones, y la pelota acelera en cada uno. ¿Llegarás a limpiar el último muro?».
  - `id`, `title`, `short`, `cat`, `cover` y `color` se quedan igual. `best` y `plays` siguen simulados.
- **Assets**: `references/started-games/04-arkanoid/assets/spritesheet-breakout.png` se copia a `public/bloque-buster/spritesheet-breakout.png`. Los mp3 no se copian.
- **Conexión**: la migración `connect_bloque_buster` y la regla `"bloque-buster"` en `SCORE_RULES`.
- **CSS** mínimo en `app/globals.css` para el canvas dentro de `.crt-screen`. Se diseña con `/frontend-design`.
- Validación con Playwright MCP y `execute_sql`.

**Fuera de alcance (para specs futuras):**

- Sonido, aunque la referencia lo tiene, controles táctiles y gamepad.
- Cambios de física, velocidad, puntuación o niveles respecto a la referencia: ni ángulo según el punto de impacto en la paleta, ni saque manual, ni power-ups, ni más niveles.
- El selector de nivel y cualquier forma de saltar de nivel.
- Un modal de victoria distinto de `FIN DEL JUEGO`.
- Una portada nueva o un cambio de título.
- Hacer jugables otros juegos.
- Anti-trampas más allá de las cotas por nivel.
- Tests automatizados.

---

## Modelo de datos

No hay tablas nuevas ni cambios en `scores` ni en la vista `leaderboard`. Se añaden una fila en `games`, una regla y una entrada en `ARENAS`. Los tipos comunes (`GameStats`, `ArenaProps` y `ScoreSubmission`) se usan tal cual.

### Motor — `lib/bloque-buster/engine.ts`

```ts
export type BloqueBusterPhase = "ready" | "playing" | "gameover";

export type BloqueBusterCallbacks = {
  onStats: (stats: GameStats) => void; // { score, lives, level }, solo si cambia
  onPhase: (phase: BloqueBusterPhase) => void;
  onGameOver: (result: ScoreSubmission) => void; // sin vidas, nivel 5 completado, o end()
};

export type BloqueBusterGame = {
  setPaused: (paused: boolean) => void;
  end: () => void;
  destroy: () => void;
};

export function createBloqueBusterGame(
  canvas: HTMLCanvasElement,
  callbacks: BloqueBusterCallbacks,
): BloqueBusterGame;
```

Los niveles de `levels.js` se portan como datos constantes del módulo, que no se modifican:

```ts
type BlockColor =
  "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";
type Level = {
  speed: number;
  blocks: { col: number; row: number; color: BlockColor }[];
};
const LEVELS: readonly Level[]; // generado igual que en levels.js
```

Constantes copiadas de la referencia (mismos valores):

| Constante                             | Valor                                        |
| ------------------------------------- | -------------------------------------------- |
| `PADDLE_SPEED`                        | `400` px/s                                   |
| Paleta                                | `w 81`, `h 14`, `y 560`, centrada al empezar |
| Pelota                                | `w 16`, `h 16`                               |
| `BASE_BALL_VX` / `BASE_BALL_VY`       | `200` / `−300` px/s, × `speed` del nivel     |
| `BLOCK_COLS` / `BLOCK_ROWS`           | `10` / `6`                                   |
| `BLOCK_W` / `BLOCK_H`                 | `64` / `24`                                  |
| `BLOCKS_ORIGIN_X` / `BLOCKS_ORIGIN_Y` | `(800 − 10·64) / 2 = 80` / `80`              |
| Tolerancia del rebote en la paleta    | `+8` px bajo `paddle.y + paddle.h`           |
| Puntos por bloque                     | `10`                                         |
| Vidas iniciales                       | `3`                                          |
| `LEVELS[].speed`                      | `1.00`, `1.10`, `1.21`, `1.33`, `1.46`       |
| Bloques por nivel                     | `60`, `40`, `30`, `39`, `39` (208 en total)  |
| `EXPLOSION_DURATION`                  | `150` ms, 4 frames                           |
| `SPRITES` / `EXPLOSION_FRAMES`        | las coordenadas de `assets/spritesheet.js`   |
| Fondo                                 | `#000`                                       |

Los patrones de nivel también son los de `levels.js`:

| Nivel | Patrón y colores                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1     | rejilla completa, con colores por fila `red`, `yellow`, `cyan`, `magenta`, `hotpink` y `green`                                     |
| 2     | pirámide con `pyStart [4,3,2,1,0,0]` y `pyEnd [5,6,7,8,9,9]`, con colores `gray`, `cyan`, `hotpink`, `yellow`, `magenta` y `green` |
| 3     | ajedrez `(col + row) % 2 === 0`, `yellow` en las filas 0–2 y `magenta` en las 3–5                                                  |
| 4     | huecos `gaps4` de la referencia, con colores `cyan`, `magenta`, `green`, `yellow`, `hotpink` y `red`                               |
| 5     | marco y cruz (`col 4` / `row 2`): la cruz `hotpink` y el marco `cyan`                                                              |

Constantes nuevas del port:

| Constante         | Valor                                     | Motivo                                    |
| ----------------- | ----------------------------------------- | ----------------------------------------- |
| `W` × `H`         | `800` × `600`                             | el canvas de la referencia, que ya es 4:3 |
| `MAX_DT`          | `50` ms                                   | `dt` capado (la referencia no lo capa)    |
| `SPRITESHEET_SRC` | `/bloque-buster/spritesheet-breakout.png` | el asset copiado a `public/`              |

### Registro — `components/arenas.ts`

```ts
"bloque-buster": { Arena: BloqueBusterCanvas, initial: { score: 0, lives: 3, level: 1 } },
```

### Conexión — `supabase/migrations/<version>_connect_bloque_buster.sql`

```sql
insert into public.games (id) values ('bloque-buster');
```

`<version>` es la que devuelven `apply_migration` y `list_migrations`.

### Regla — `lib/scoring.ts`

```ts
// BLOQUE BUSTER: 10 puntos por bloque → múltiplo de 10.
// Bloques por nivel 60/40/30/39/39 → acumulado al completar cada nivel:
//   C = [0, 600, 1000, 1300, 1690, 2080].
// Para estar en el nivel N hay que haber completado los anteriores (≥ C[N−1]), y en el nivel N
// no se pueden romper más bloques que los suyos (≤ C[N]). Al completar el 5 la partida acaba con level 5.
// Sin límite de puntos/s: el total está acotado a 2080.
"bloque-buster": ({ score, level }) =>
  level !== null &&
  Number.isInteger(level) &&
  level >= 1 &&
  level <= 5 &&
  score % 10 === 0 &&
  score >= BLOQUE_BUSTER_CUMULATIVE[level - 1] &&
  score <= BLOQUE_BUSTER_CUMULATIVE[level],
```

`BLOQUE_BUSTER_CUMULATIVE = [0, 600, 1000, 1300, 1690, 2080]` es una constante local de `lib/scoring.ts`. No se importa del motor, porque `scoring.ts` se usa en el servidor.

---

## Plan de implementación

1. **Motor de BLOQUE BUSTER.**
   - Leer completos `references/started-games/04-arkanoid/game.js`, `levels.js` y `assets/spritesheet.js`, más `lib/apila/engine.ts` como patrón de fases, `dt`, `dpr` y teclado.
   - Copiar `spritesheet-breakout.png` a `public/bloque-buster/`.
   - Crear `lib/bloque-buster/engine.ts` siguiendo el modelo de datos y los cambios del Alcance.
   - `npm run build` pasa, aunque el motor no se importa todavía desde ningún sitio.
2. **Arena y CSS.**
   - Crear `components/bloque-buster-canvas.tsx` con `ReadyOverlay` y la leyenda de BLOQUE BUSTER.
   - Añadir el CSS del canvas en `globals.css`, diseñado con `/frontend-design`. Las scanlines de `.crt-screen::after` quedan por encima del canvas.
3. **Integración y catálogo.**
   - Añadir `"bloque-buster"` a `ARENAS`.
   - Cambiar `long` de `bloque-buster` en `lib/games.ts`.
   - Prueba manual: `/games/bloque-buster/play` se juega de principio a fin. APILA, ROCAS y `/games/serpentina/play` siguen igual.
4. **Conexión.**
   - Aplicar `connect_bloque_buster` con `apply_migration` y guardar el mismo SQL en `supabase/migrations/<version>_connect_bloque_buster.sql`.
   - Añadir la regla `"bloque-buster"` y `BLOQUE_BUSTER_CUMULATIVE` a `lib/scoring.ts`.
   - Ejecutar `get_advisors` (security). `database.types.ts` no cambia, porque solo se inserta una fila.
   - Prueba: con sesión, una partida crea **una** fila con `game_id = 'bloque-buster'`. Se comprueba con `execute_sql`.
5. **Validación.** Con `npm run dev` y Playwright MCP, a 1440×900, en `/games/bloque-buster/play`:
   - Se ven el overlay de inicio, los 60 bloques del nivel 1, la paleta y la pelota. Ni las flechas ni el ratón mueven nada.
   - `Space` arranca la partida: la pelota sale sola, y al romper el primer bloque el HUD suma exactamente `10`.
   - Con `←` o `→` mantenidas, y con `mousemove` sobre el canvas, la paleta se mueve y no sale del canvas.
   - Llevar la paleta a un borde y dejar caer la pelota: el HUD pasa de `♥ ♥ ♥` a `♥ ♥`, y la pelota vuelve a la paleta y sale sola.
   - Perder las 3 vidas abre el modal `FIN DEL JUEGO` con la puntuación del HUD, y se guarda una fila con `level = 1` y un `duration_ms` que cuadra con el tiempo jugado.
   - `window.scrollY` no cambia al pulsar flechas o `Space`.
   - `P` pausa: ni la pelota ni la paleta se mueven en 2 s, tampoco con el ratón. `P` reanuda sin salto, y `Escape` pausa.
   - FIN abre el modal. `JUGAR DE NUEVO` vuelve a `ready` con 0 puntos, `♥ ♥ ♥`, nivel `01` y los 60 bloques.

   Además:
   - Llamar a `saveScore` con `{ gameId: "bloque-buster", … }` y tres partidas imposibles: `{ score: 700, level: 1 }`, `{ score: 500, level: 2 }` y `{ score: 605, level: 1 }`. Las tres devuelven `invalid` y no crean filas.
   - `/games/bloque-buster`, `/hall-of-fame?game=bloque-buster` y `/games` muestran los datos reales.
   - ROCAS, APILA y `/games/serpentina/play` siguen igual.
   - A 375×812: no hay scroll horizontal y el canvas está en 4:3.
   - Emular un dispositivo táctil y ver el aviso `NECESITAS UN TECLADO PARA JUGAR`.
   - Revisar la consola en cada paso, incluido que el spritesheet carga sin 404.
   - Pedir al usuario una partida manual larga, que pase al menos al nivel 2 y, si puede, que complete el nivel 5 para comprobar la victoria.
   - Borrar las filas de `scores` y los usuarios de prueba.
   - `npm run lint` y `npm run build`.

---

## Criterios de aceptación

**Motor y juego**

- [ ] `lib/bloque-buster/engine.ts` no importa React ni nada de `next/*`, y no tiene variables mutables a nivel de módulo.
- [ ] Las constantes de la tabla del modelo de datos tienen los mismos valores que en `game.js`, `levels.js` y `spritesheet.js`, incluidos los 5 patrones (60, 40, 30, 39 y 39 bloques) y sus velocidades.
- [ ] `public/bloque-buster/spritesheet-breakout.png` existe y se carga sin errores.
- [ ] Al entrar en `/games/bloque-buster/play` se ven los bloques del nivel 1, la paleta, la pelota y el overlay `PULSA ESPACIO PARA EMPEZAR` con la leyenda de controles. Nada se mueve, y ni las flechas ni el ratón hacen nada.
- [ ] `Space` arranca la partida y la pelota sale sola.
- [ ] Cada bloque roto suma exactamente `10` en el HUD. La pelota rompe un solo bloque por frame.
- [ ] La paleta se mueve con `←`/`→` y con el ratón, y no sale de `[0, 719]`.
- [ ] Perder la pelota quita una vida en el HUD y la devuelve a la paleta. Con la tercera vida perdida se abre el modal `FIN DEL JUEGO` con la puntuación final.
- [ ] Al romper el último bloque de un nivel, el HUD pasa al nivel siguiente, se ve el patrón nuevo y la pelota es más rápida.
- [ ] Al completar el nivel 5 se abre el modal `FIN DEL JUEGO`, con `2080` puntos y nivel `05`.
- [ ] El canvas no dibuja puntuación, vidas, nivel, `GAME OVER`, victoria ni pausa. Sí dibuja las explosiones de 4 frames.
- [ ] `onGameOver` se llama una sola vez por partida, tanto en el game over natural, como en la victoria, como con FIN. `durationMs` no cuenta el tiempo en `ready` ni en pausa.
- [ ] Pulsar flechas o `Space` durante la partida no hace scroll en la página.
- [ ] El botón PAUSA, `P` y `Escape` pausan y reanudan. En pausa no se mueven ni la pelota ni la paleta, tampoco con el ratón. Al reanudar no hay salto y la paleta no sigue moviéndose sola.
- [ ] Ocultar la pestaña pausa la partida, y sigue en pausa al volver.
- [ ] `JUGAR DE NUEVO` vuelve a `ready` con 0 puntos, `♥ ♥ ♥`, nivel `01` y los 60 bloques del nivel 1.
- [ ] Al salir de la página no quedan listeners de `keydown`, `keyup` o `mousemove`, ni bucles `requestAnimationFrame`: en otra ruta, las flechas vuelven a hacer scroll.
- [ ] Con StrictMode solo hay un bucle activo, y la pelota se mueve a la velocidad normal.
- [ ] El canvas se ve nítido con `devicePixelRatio` 2 y mantiene el 4:3 a 1440 px y a 375 px. A 375 px no hay scroll horizontal.
- [ ] En un dispositivo táctil emulado se ve `NECESITAS UN TECLADO PARA JUGAR`.

**Catálogo y leaderboard**

- [ ] `ARENAS` contiene `"bloque-buster"` con `initial: { score: 0, lives: 3, level: 1 }`, y `GamePlayer` no ha cambiado.
- [ ] En `lib/games.ts`, `bloque-buster` solo cambia en `long`, que tiene el texto del Alcance.
- [ ] Existe `supabase/migrations/<version>_connect_bloque_buster.sql`, y `list_migrations` muestra la misma versión.
- [ ] `public.games` contiene exactamente `rocas`, `apila` y `bloque-buster`.
- [ ] `isConnected("bloque-buster")` es `true`.
- [ ] `get_advisors` (security) no muestra avisos nuevos.
- [ ] Con sesión y puntuación > 0, una partida crea **una** fila en `scores` con el `user_id` del jugador, `game_id = 'bloque-buster'`, y el `level` y el `duration_ms` de la partida.
- [ ] `saveScore` con `{ score: 700, level: 1 }`, `{ score: 500, level: 2 }` y `{ score: 605, level: 1 }` devuelve `invalid` y no inserta nada.
- [ ] `/games/bloque-buster`, `/hall-of-fame?game=bloque-buster` y la tarjeta de BLOQUE BUSTER en `/games` muestran los datos reales, o sus estados vacíos.
- [ ] ROCAS, APILA y los 5 juegos simulados que quedan se ven y funcionan igual que antes.

**Calidad**

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/games/bloque-buster/play`, `/games/bloque-buster`, `/games/rocas/play` ni `/games/apila/play`.
- [ ] Las filas de `scores` y los usuarios de prueba creados durante la validación se han borrado.

---

## Decisiones

**Heredadas de las SPEC 05, 06 y 07:**

- **Sí:** motor en TypeScript puro con `setPaused`, `end` y `destroy`, y una arena React fina encima (heredada de SPEC 05).
- **Sí:** fase `ready` y reinicio remontando el componente con una `key`. El motor no se reinicia solo (heredada de SPEC 05).
- **Sí:** el HUD y el game over los pinta React, no el canvas (heredada de SPEC 05).
- **Sí:** `P` y `Escape` son de `GamePlayer`, así que el motor deja de usarlas (heredada de SPEC 05).
- **Sí:** mundo lógico fijo con backing store × `devicePixelRatio` (heredada de SPEC 05).
- **Sí:** el port no cambia física, velocidad ni puntuación (heredada de SPEC 05).
- **Sí:** `dt` capado a 50 ms, aunque la referencia no lo capa (heredada de SPEC 07). Además evita que la pelota atraviese la paleta o los bloques después de un tirón de frames.
- **Sí:** conectar un juego es una fila en `games` más una regla en `SCORE_RULES`, sin tocar `scores`, `saveScore` ni las lecturas (heredada de SPEC 06).
- **Sí:** guardado automático, una vez por partida, solo con sesión. FIN guarda y SALIR descarta (heredada de SPEC 06).
- **Sí:** el juego se conecta con una entrada en `ARENAS`, `GameStats`, `ScoreSubmission` y `ReadyOverlay`, sin tocar `GamePlayer` (heredada de SPEC 07).

**Nuevas:**

- **Sí:** reutilizar la entrada `bloque-buster` con su id, título, portada `cover-bricks` y color `cyan`. Ya describe este juego y no deja un segundo Arkanoid simulado al lado del real.
- **Sí:** cambiar solo el `long`, para que hable de los cinco niveles y de la aceleración.
- **No:** un juego nuevo con otro nombre. A diferencia de APILA, la entrada del catálogo ya encaja con el juego.
- **Sí:** el ratón entra en esta spec. En la referencia es la forma principal de mover la paleta, y quitarlo cambiaría cómo se juega.
- **Sí:** el ratón solo actúa en `playing` sin pausa. En la referencia movía la paleta también en pausa, y eso rompería la pausa de `GamePlayer`.
- **Sí:** al pausar se sueltan `←` y `→`. Ocultar la pestaña puede comerse el `keyup`, y la paleta seguiría moviéndose al volver.
- **No:** el selector de nivel de la pausa. La pausa es de `GamePlayer`, y saltar de nivel invalidaría la regla de plausibilidad y el ranking.
- **Sí:** la victoria tras el nivel 5 es un fin natural, con el mismo modal `FIN DEL JUEGO` y `level: 5`. No cambia `ArenaProps` ni `GamePlayer`.
- **No:** un modal de victoria propio. Haría falta ampliar el contrato común solo para un juego.
- **Sí:** `Space` para empezar, y la pelota sale sola, también tras perder una vida o cambiar de nivel, como en la referencia.
- **No:** un saque manual. Cambiaría la jugabilidad.
- **Sí:** el HUD con `score`, `lives` y `level` reales, y `initial` igual que ROCAS. Las tres casillas tienen sentido en este juego.
- **Sí:** copiar solo el spritesheet a `public/bloque-buster/` y cargarlo con `new Image()` en la instancia. `Space` espera a que cargue.
- **No:** copiar los mp3. El sonido queda fuera de alcance, y copiar ficheros que no se usan no aporta nada.
- **No:** bandas ni un mundo lógico distinto. El canvas de la referencia ya es de 800×600.
- **Sí:** el aviso táctil se mantiene. `Space` hace falta para empezar, y en táctil no hay `mousemove` continuo.
- **Sí:** la regla de plausibilidad con cotas exactas por nivel, `C[N−1] ≤ score ≤ C[N]` sobre los acumulados `[0, 600, 1000, 1300, 1690, 2080]`, y múltiplo de 10. El número de bloques es finito y conocido, así que son límites exactos que no rechazan ninguna partida legítima.
- **No:** un tope de puntos por segundo. El total ya está acotado a 2.080, y un tope sacado de la velocidad de la pelota sería una aproximación.
- **Sí:** `BLOQUE_BUSTER_CUMULATIVE` vive en `lib/scoring.ts` y no se importa del motor. `scoring.ts` se ejecuta en el servidor y el motor depende del DOM.
- **Sí:** forzar el game over natural en Playwright llevando la paleta a un borde para dejar caer la pelota. La victoria queda para la partida manual del usuario.

---

## Riesgos

| Riesgo                                                                                             | Mitigación                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El spritesheet no carga (ruta mal puesta o 404), y no se ven bloques, paleta ni pelota.            | La ruta es una constante, `SPRITESHEET_SRC`. `Space` no arranca hasta que la imagen carga. La validación revisa la consola y la red.                                                               |
| Con `dt` grande, la pelota atraviesa la paleta o un bloque.                                        | `MAX_DT = 50` ms. A la velocidad máxima (`300 × 1.46 ≈ 438` px/s en `vy`), la pelota avanza ≤ 22 px por frame, que es menos que los 24 px de un bloque más los 8 px de tolerancia de la paleta.    |
| El ratón mueve la paleta durante la pausa o en `ready`.                                            | El listener solo actúa en `playing` sin pausa, y hay un criterio de aceptación para ello.                                                                                                          |
| Pasar la x del ratón al mundo lógico falla con el canvas escalado por CSS o con `dpr` 2.           | Se usa `getBoundingClientRect()` y `W / rect.width`, no `canvas.width`, que vale `800·dpr`. Se prueba a 1440 y a 375 px.                                                                           |
| La paleta sigue moviéndose sola tras ocultar la pestaña, porque se pierde el `keyup`.              | `setPaused(true)` suelta `←` y `→`.                                                                                                                                                                |
| La regla rechaza una partida legítima en el paso de nivel o en la victoria.                        | El nivel sube justo al romper el último bloque, con `score = C[N−1]`, que la regla acepta. La victoria da `2080` con `level 5 = C[5]`. La validación incluye una partida manual que pasa de nivel. |
| El game over natural cuesta de forzar con Playwright, porque la pelota puede rebotar en la paleta. | La paleta se lleva a un borde con `←` o `→` mantenidas. Si la pelota rebota, se cambia de borde.                                                                                                   |
| Quedan datos de prueba en el proyecto remoto.                                                      | El paso 5 los borra, y hay un criterio de aceptación.                                                                                                                                              |

---

## Lo que **no** entra en esta spec

- Sonido, controles táctiles y gamepad.
- Cambios de física, velocidad, puntuación o niveles respecto a la referencia: ni ángulo según el impacto en la paleta, ni saque manual, ni power-ups, ni más niveles.
- El selector de nivel o cualquier forma de saltar de nivel.
- Un modal de victoria propio.
- Una portada nueva o un cambio de título.
- Hacer jugables otros juegos.
- Anti-trampas más allá de las cotas por nivel.
- Tests automatizados.

Cada uno de estos puntos, si llega, va en su propia spec.
