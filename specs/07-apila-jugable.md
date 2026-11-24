# SPEC 07 — APILA jugable: port del Tetris de referencia conectado al leaderboard

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-11-23
> **Objetivo:** Convertir `/games/apila/play` en el Tetris de `references/started-games/03-tetris/`, portado a TypeScript dentro de `GamePlayer` y guardando sus puntuaciones en Supabase.

---

## Por qué existe esta spec

APILA es el segundo juego real del Vault. Sustituye a la entrada simulada CAÍDA (`caida`), que sale del catálogo.

La referencia es un `game.js` de 332 líneas con estado global:

- un tablero de 10×20 celdas de 30 px, en un canvas de 300×600;
- un segundo canvas de 120×120 para la pieza siguiente;
- 8 piezas: las 7 clásicas más la N «tuerca», que es un anillo de 3×3;
- rotación con _wall kicks_, pieza fantasma, caída suave e instantánea;
- puntuación `[0, 100, 300, 500, 800] × nivel` y un nivel cada 10 líneas.

Usa `P` para pausar, tiene cambio de tema claro/oscuro con `localStorage` y no capa el `dt`.

`GamePlayer` está escrito solo para ROCAS: elige la arena con `isRocas` y usa `AsteroidsStats` y `AsteroidsResult`. Como APILA es el segundo juego real, esta spec extrae primero ese contrato común:

- tipos compartidos;
- un registro de arenas;
- un overlay de inicio compartido.

Después de ese paso, conectar un juego será añadir su arena al registro, su fila en `games` y su regla en `SCORE_RULES`.

El leaderboard (SPEC 06) ya es genérico y no se toca.

---

## Alcance

**Entra:**

- **Contrato común** (el primer paso, sin cambiar cómo se juega a ROCAS):
  - `lib/game-types.ts`:
    - `GameStats = { score: number; lives: number | null; level: number | null }`;
    - `ArenaProps = { paused; over; onStats; onGameOver }`, con `onGameOver: (result: ScoreSubmission) => void`.
  - `components/arenas.ts`: un registro `ARENAS` de `id` → `{ Arena, initial }`.
    - `initial` son los stats del HUD al empezar una partida y al pulsar JUGAR DE NUEVO: ROCAS `{ 0, 3, 1 }` y APILA `{ 0, null, 1 }`.
    - Sustituye a `isRocas`. Un juego sin entrada sigue con la simulación.
  - `components/ready-overlay.tsx`: el texto de inicio, la leyenda de controles (como prop) y el aviso táctil `NECESITAS UN TECLADO PARA JUGAR`.
    - Se saca de `AsteroidsCanvas`, que pasa a usarlo.
    - Las clases CSS `asteroids-ready`, `asteroids-keys`, etc. pasan a nombres genéricos.
  - El motor de ROCAS y `AsteroidsCanvas` dejan de exportar tipos propios para el HUD y el resultado: usan `GameStats` y `ScoreSubmission`.
  - En el HUD, `lives` o `level` en `null` se muestran como `—`.
- **Motor** `lib/apila/engine.ts`: TypeScript puro, port de `game.js`. Conserva:
  - las constantes `COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES` (las 8, con la N «tuerca») y `LINE_SCORES`;
  - los _kicks_ `[0, -1, 1, -2, 2]`, la velocidad inicial de 1000 ms y `dropInterval = max(100, 1000 − (nivel−1)·90)`;
  - el nivel `floor(líneas/10) + 1`;
  - los puntos: líneas × nivel antes de subir, +1 por fila en la caída suave y +2 por celda en la caída instantánea;
  - el sorteo uniforme de las 8 piezas, el punto de aparición, el game over cuando la pieza nueva choca al aparecer, `dropAccum = 0` tras cada caída, la pieza fantasma con alpha 0.2 y el brillo superior de cada bloque.

  Cambios respecto a la referencia:
  - El estado vive en la instancia de `createApilaGame(canvas, callbacks)`.
  - El mundo lógico es de 800×600. El tablero de 300×600 va centrado en x = 250, y a su derecha hay un panel dibujado en el canvas con **SIGUIENTE** (caja de 4×4 celdas) y **LÍNEAS**.
  - La rejilla y el fondo del tablero usan constantes con los valores del tema oscuro (`#22222e` y `#1a1a25`). Ya no leen variables CSS.
  - Desaparecen el cambio de tema, `localStorage`, el overlay de PAUSA/GAME OVER y los textos SCORE y LEVEL del DOM.
  - Fases `ready → playing → gameover`.
    - En `ready` se ven el tablero vacío y el panel, y no cae nada.
    - `Space` pasa a `playing` sin hacer caída instantánea con esa pulsación.
  - El `dt` se capa a 50 ms. `durationMs` es la suma de esos `dt` en `playing`.
  - `onStats({ score, lives: null, level })` solo se llama cuando algo cambia. `onGameOver` se llama una vez por partida, al chocar la pieza al aparecer o con `end()`.
  - `setPaused`, `end` y `destroy` funcionan como en ROCAS.
  - El teclado:
    - las teclas son `←`, `→`, `↓`, `↑`, `X` y `Space`, con autorepeat como en la referencia;
    - `P` deja de ser del motor;
    - se ignoran los eventos con el foco en un campo de texto;
    - se hace `preventDefault` de esas teclas salvo en `gameover`.
  - El canvas reserva `800·dpr × 600·dpr` píxeles con `setTransform(dpr, …)`.

- **Arena** `components/apila-canvas.tsx` (`"use client"`):
  - mismo patrón que `AsteroidsCanvas`: el motor se crea en `useEffect` y se destruye en el cleanup, los callbacks van en una ref, y recibe `paused` y `over`;
  - en `ready` usa `ReadyOverlay` con `PULSA ESPACIO PARA EMPEZAR` y la leyenda `← → MOVER · ↑ / X ROTAR · ↓ BAJAR · ESPACIO CAÍDA · P / ESC PAUSA`.
- **`GamePlayer`**: elige la arena con `ARENAS[game.id]` y toma de `initial` los stats de partida nueva. Nada más cambia: pausa, FIN, modal y guardado siguen como en las SPEC 05 y 06.
- **Catálogo** `lib/games.ts`: la entrada `caida` se sustituye, en la misma posición, por:
  - `id: "apila"`, `title: "APILA"`, `cat: "PUZZLE"`, `color: "magenta"`, `cover: "cover-tetro"` (la portada existente);
  - `short: "Encaja las piezas y no dejes que la torre toque el techo."`;
  - `long: "Ocho piezas de neón caen sin pausa, entre ellas la temida tuerca. Muévelas, gíralas y completa filas para borrarlas. Cada 10 líneas sube el nivel y la caída se acelera."`;
  - `best` y `plays` se quedan con valores simulados (en los juegos conectados la UI ya muestra los reales).
- **Conexión**: migración `connect_apila` y regla `apila` en `SCORE_RULES`.
- **CSS** mínimo en `app/globals.css`: el canvas de APILA dentro de `.crt-screen` y el cambio de nombre de las clases del overlay a genéricas. Se diseña con `/frontend-design`.
- Validación con Playwright MCP y `execute_sql`.

**Fuera de alcance (para specs futuras):**

- Sonido, controles táctiles o de gamepad, y ratón.
- Cambios de reglas, velocidad o puntuación respecto a la referencia: ni bolsa de 7, ni _hold_, ni T-spins, ni _lock delay_, ni DAS propio.
- Guardar las líneas en la base de datos (`scores` no cambia).
- Una casilla `LÍNEAS` en el HUD de React.
- Una portada nueva para APILA.
- Tema claro.
- Hacer jugables otros juegos.
- Anti-trampas más allá de las cotas por nivel.
- Tests automatizados.

---

## Modelo de datos

No hay tablas nuevas ni cambios en `scores` ni en la vista `leaderboard`. Solo se añaden una fila en `games`, una regla y unos tipos.

### Contrato común — `lib/game-types.ts`

```ts
import type { ScoreSubmission } from "@/lib/scoring";

export type GameStats = {
  score: number;
  lives: number | null; // null: el juego no tiene vidas (el HUD muestra —)
  level: number | null; // null: el juego no tiene niveles
};

export type ArenaProps = {
  paused: boolean;
  over: boolean;
  onStats: (stats: GameStats) => void;
  onGameOver: (result: ScoreSubmission) => void; // una vez por partida
};
```

### Registro — `components/arenas.ts`

```ts
export type ArenaEntry = {
  Arena: ComponentType<ArenaProps>;
  initial: GameStats; // HUD al montar y tras JUGAR DE NUEVO
};

export const ARENAS: Partial<Record<string, ArenaEntry>> = {
  rocas: { Arena: AsteroidsCanvas, initial: { score: 0, lives: 3, level: 1 } },
  apila: { Arena: ApilaCanvas, initial: { score: 0, lives: null, level: 1 } },
};
```

### Overlay — `components/ready-overlay.tsx`

```ts
type ReadyOverlayProps = {
  controls: { keys: string[]; action: string }[];
};
```

El texto es siempre `PULSA ESPACIO PARA EMPEZAR`, seguido de la leyenda y del aviso táctil.

### Motor — `lib/apila/engine.ts`

```ts
export type ApilaPhase = "ready" | "playing" | "gameover";

export type ApilaCallbacks = {
  onStats: (stats: GameStats) => void; // { score, lives: null, level }, solo si cambia
  onPhase: (phase: ApilaPhase) => void;
  onGameOver: (result: ScoreSubmission) => void; // pieza que choca al aparecer, o end()
};

export type ApilaGame = {
  setPaused: (paused: boolean) => void;
  end: () => void;
  destroy: () => void;
};

export function createApilaGame(
  canvas: HTMLCanvasElement,
  callbacks: ApilaCallbacks,
): ApilaGame;
```

Constantes copiadas de `game.js` (mismos valores):

| Constante                  | Valor                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `COLS` / `ROWS` / `BLOCK`  | `10` / `20` / `30`                                                                                |
| `COLORS[1..8]`             | `#4dd0e1`, `#ffd54f`, `#ba68c8`, `#81c784`, `#e57373`, `#90caf9`, `#ffb74d`, `#9e9e9e`            |
| `PIECES[1..8]`             | I, O, T, S, Z, J, L y N «tuerca» (`[[8,8,8],[8,0,8],[8,8,8]]`), con las matrices de la referencia |
| `LINE_SCORES`              | `[0, 100, 300, 500, 800]`                                                                         |
| Kicks de rotación          | `[0, -1, 1, -2, 2]`                                                                               |
| Caída inicial              | `1000` ms                                                                                         |
| `dropInterval`             | `max(100, 1000 − (nivel − 1) · 90)` ms                                                            |
| Nivel                      | `floor(líneas / 10) + 1`                                                                          |
| Caída suave / instantánea  | `+1` por fila / `+2` por celda                                                                    |
| Alpha de la pieza fantasma | `0.2`                                                                                             |

Constantes nuevas del port:

| Constante                | Valor                 | Motivo                                                           |
| ------------------------ | --------------------- | ---------------------------------------------------------------- |
| `W` × `H`                | `800` × `600`         | mundo lógico en 4:3                                              |
| `BOARD_X`                | `250`                 | tablero centrado (`(800 − 300) / 2`)                             |
| `PANEL_X`                | `580`                 | panel SIGUIENTE / LÍNEAS, 30 px a la derecha del tablero         |
| `MAX_DT`                 | `50` ms               | `dt` capado (la referencia no lo capa)                           |
| `BOARD_BG` / `GRID_LINE` | `#1a1a25` / `#22222e` | valores del tema oscuro, que en la referencia eran variables CSS |

### Conexión — `supabase/migrations/<version>_connect_apila.sql`

```sql
insert into public.games (id) values ('apila');
```

`<version>` es la que devuelven `apply_migration` y `list_migrations`.

### Regla — `lib/scoring.ts`

```ts
// APILA: granularidad 1 (la caída suave suma 1).
// Cota mínima: el nivel N exige ≥ 10·(N−1) líneas de ≥ 100 puntos → level ≤ 1 + floor(score/1000).
// Cota máxima: con L = 10·level − 1 líneas como mucho:
//   líneas ≤ 200·level cada una (una tetrada son 800·level entre 4 líneas, y el nivel nunca baja);
//   caídas ≤ 38 por pieza (19 filas × 2), con piezas ≤ (10L + 200)/4 + 1 (≥ 4 celdas por pieza,
//   tablero de 200 celdas, más la pieza que está cayendo) → ≤ 95L + 1938.
//   score ≤ L·(200·level + 95) + 1938. Nivel 1 → 4.593.
// Sin límite de puntos/s: la caída instantánea no tiene tope físico de velocidad.
apila: ({ score, level }) => {
  if (level === null || level > 1 + Math.floor(score / 1000)) return false;
  const lines = 10 * level - 1;
  return score <= lines * (200 * level + 95) + 1938;
},
```

---

## Plan de implementación

1. **Contrato común, sin cambiar cómo se juega a ROCAS.**
   - Leer `components/game-player.tsx`, `components/asteroids-canvas.tsx` y la API pública de `lib/asteroids/engine.ts`.
   - Crear `lib/game-types.ts` y `components/ready-overlay.tsx`. Pasar las clases CSS del overlay a nombres genéricos.
   - Adaptar el motor de ROCAS y `AsteroidsCanvas` a `GameStats` y `ScoreSubmission`. La física no se toca.
   - Crear `components/arenas.ts` con la entrada `rocas` y cambiar `isRocas` por `ARENAS[game.id]` en `GamePlayer`. Tanto la partida inicial como `JUGAR DE NUEVO` toman los stats de `initial`.
   - El HUD muestra `—` cuando `lives` o `level` son `null`.
   - `npm run build` pasa.
   - Prueba manual: ROCAS se juega y guarda igual que antes, y `/games/serpentina/play` sigue con la simulación.
2. **Motor de APILA.**
   - Leer `references/started-games/03-tetris/game.js` completo.
   - Crear `lib/apila/engine.ts` siguiendo el modelo de datos y los cambios del Alcance.
   - `npm run build` pasa, aunque el motor no se importa todavía desde ningún sitio.
3. **Arena y CSS.**
   - Crear `components/apila-canvas.tsx` con `ReadyOverlay` y la leyenda de APILA.
   - Añadir el CSS del canvas en `globals.css`, diseñado con `/frontend-design`. Las scanlines de `.crt-screen::after` quedan por encima del canvas.
4. **Integración y catálogo.**
   - Añadir `apila` a `ARENAS`.
   - Sustituir en `lib/games.ts` la entrada `caida` por `apila`, en la misma posición y con los datos del Alcance.
   - Prueba manual: `/games/apila/play` se juega de principio a fin, y `/games/caida` devuelve 404.
5. **Conexión.**
   - Aplicar `connect_apila` con `apply_migration` y guardar el mismo SQL en `supabase/migrations/<version>_connect_apila.sql`.
   - Añadir la regla `apila` a `SCORE_RULES`.
   - Ejecutar `get_advisors` (security). `database.types.ts` no cambia, porque solo se inserta una fila.
   - Prueba: con sesión, una partida crea **una** fila con `game_id = 'apila'`. Se comprueba con `execute_sql`.
6. **Validación.** Con `npm run dev` y Playwright MCP, a 1440×900, en `/games/apila/play`:
   - Se ve el overlay de inicio. Las flechas no mueven nada y no cae ninguna pieza.
   - `Space` arranca la partida y esa pulsación no suma puntos.
   - Una caída instantánea suma `2 ×` las celdas recorridas, y `↓` suma 1 por fila.
   - Pulsar `Space` repetidas veces apila piezas en el centro hasta el game over natural. El modal se abre con la puntuación del HUD y se guarda una fila.
   - `window.scrollY` no cambia al pulsar flechas o `Space`.
   - `P` pausa y la pieza no se mueve durante 2 s. `P` reanuda y `Escape` pausa.
   - FIN abre el modal. `JUGAR DE NUEVO` vuelve a `ready` con 0 puntos, `—` en vidas y nivel `01`.

   Además:
   - Llamar a `saveScore` con `{ gameId: "apila", score: 5000, level: 1, durationMs: 60000 }` y con `{ score: 1500, level: 3, … }`. Las dos devuelven `invalid` y no crean filas.
   - `/games/apila`, `/hall-of-fame?game=apila` y `/games` muestran los datos reales.
   - ROCAS y `/games/serpentina/play` siguen igual.
   - A 375×812: no hay scroll horizontal y el canvas está en 4:3.
   - Revisar la consola en cada paso.
   - Pedir al usuario una partida manual larga, que limpie líneas y suba de nivel.
   - Borrar las filas de `scores` y los usuarios de prueba.
   - `npm run lint` y `npm run build`.

---

## Criterios de aceptación

**Contrato común**

- [ ] `GamePlayer` ya no contiene `isRocas`. Elige la arena con `ARENAS[game.id]` y los stats iniciales con `initial`.
- [ ] ROCAS se juega, pausa, termina y guarda igual que antes de esta spec, con `♥ ♥ ♥` al empezar y tras `JUGAR DE NUEVO`.
- [ ] Las constantes del motor de ROCAS no cambian.
- [ ] El overlay de inicio de ROCAS y el de APILA salen del mismo `ReadyOverlay`.

**Motor y juego**

- [ ] `lib/apila/engine.ts` no importa React ni nada de `next/*`, y no tiene variables mutables a nivel de módulo.
- [ ] Las constantes de la tabla del modelo de datos tienen los mismos valores que en `game.js`, incluidas las 8 piezas.
- [ ] Al entrar en `/games/apila/play` se ven el tablero vacío, el panel SIGUIENTE / LÍNEAS y el overlay `PULSA ESPACIO PARA EMPEZAR` con la leyenda de controles. No cae nada y las flechas no hacen nada.
- [ ] La pulsación de `Space` que arranca la partida no hace caída instantánea ni suma puntos.
- [ ] Una caída instantánea suma `2 ×` las celdas recorridas. Cada `↓` que baja una fila suma 1.
- [ ] Limpiar 1, 2, 3 o 4 líneas suma `100`, `300`, `500` u `800` × el nivel. El contador LÍNEAS del canvas sube lo mismo.
- [ ] Al llegar a 10 líneas el HUD pasa al nivel `02` y la caída se acelera.
- [ ] El canvas no dibuja puntuación, nivel ni `GAME OVER`, y sí dibuja SIGUIENTE, LÍNEAS y la pieza fantasma.
- [ ] El HUD muestra `—` en vidas durante toda la partida.
- [ ] Cuando una pieza choca al aparecer, se abre el modal `FIN DEL JUEGO` con la puntuación final.
- [ ] `onGameOver` se llama una sola vez por partida, tanto en el game over natural como con FIN. `durationMs` no cuenta el tiempo en `ready` ni en pausa.
- [ ] Pulsar flechas o `Space` durante la partida no hace scroll en la página.
- [ ] El botón PAUSA, `P` y `Escape` pausan y reanudan. En pausa la pieza no se mueve, y al reanudar no da un salto.
- [ ] Ocultar la pestaña pausa la partida, y sigue en pausa al volver.
- [ ] `JUGAR DE NUEVO` vuelve a `ready` con 0 puntos, `—` y nivel `01`.
- [ ] Al salir de la página no quedan listeners de `keydown` ni bucles `requestAnimationFrame`: en otra ruta, las flechas vuelven a hacer scroll.
- [ ] Con StrictMode solo hay un bucle activo, y las piezas caen a la velocidad normal.
- [ ] El canvas se ve nítido con `devicePixelRatio` 2 y mantiene el 4:3 a 1440 px y a 375 px. A 375 px no hay scroll horizontal.
- [ ] En un dispositivo táctil emulado se ve `NECESITAS UN TECLADO PARA JUGAR`.

**Catálogo y leaderboard**

- [ ] `lib/games.ts` contiene `apila` en la posición que tenía `caida`, con los datos del Alcance, y ya no contiene `caida`.
- [ ] `/games/caida` y `/games/caida/play` devuelven 404.
- [ ] Existe `supabase/migrations/<version>_connect_apila.sql`, y `list_migrations` muestra la misma versión.
- [ ] `public.games` contiene exactamente `rocas` y `apila`.
- [ ] `isConnected("apila")` es `true`.
- [ ] `get_advisors` (security) no muestra avisos nuevos.
- [ ] Con sesión y puntuación > 0, una partida crea **una** fila en `scores` con el `user_id` del jugador, `game_id = 'apila'`, y el `level` y el `duration_ms` de la partida.
- [ ] `saveScore` con `score: 5000, level: 1` y con `score: 1500, level: 3` devuelve `invalid` y no inserta nada.
- [ ] `/games/apila`, `/hall-of-fame?game=apila` y la tarjeta de APILA en `/games` muestran los datos reales, o sus estados vacíos.
- [ ] Los 6 juegos simulados que quedan se ven y funcionan igual que antes.

**Calidad**

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/games/apila/play`, `/games/rocas/play` ni `/games/apila`.
- [ ] Las filas de `scores` y los usuarios de prueba creados durante la validación se han borrado.

---

## Decisiones

**Heredadas de las SPEC 05 y 06:**

- **Sí:** motor en TypeScript puro con `setPaused`, `end` y `destroy`, y una arena React fina encima (heredada de SPEC 05).
- **Sí:** fase `ready` y reinicio remontando el componente con una `key`. El motor no se reinicia solo (heredada de SPEC 05).
- **Sí:** el HUD y el game over los pinta React, no el canvas (heredada de SPEC 05).
- **Sí:** `P` y `Escape` son de `GamePlayer`, así que el motor deja de usar `P` (heredada de SPEC 05).
- **Sí:** mundo lógico fijo con backing store × `devicePixelRatio` (heredada de SPEC 05).
- **Sí:** el port no cambia reglas, velocidad ni puntuación (heredada de SPEC 05).
- **Sí:** conectar un juego es una fila en `games` más una regla en `SCORE_RULES`, sin tocar `scores`, `saveScore` ni las lecturas (heredada de SPEC 06).
- **Sí:** guardado automático, una vez por partida, solo con sesión. FIN guarda y SALIR descarta (heredada de SPEC 06).

**Nuevas:**

- **Sí:** un juego nuevo, APILA, en lugar de reutilizar `caida`. Decisión del usuario.
- **Sí:** quitar `caida` del catálogo. Así no hay un segundo Tetris simulado al lado del real. Los rankings simulados de los demás juegos no cambian, porque salen de la longitud del `id`.
- **Sí:** el nombre original APILA. «Tetris» es una marca registrada, y el catálogo usa nombres propios.
- **Sí:** reutilizar la portada `cover-tetro` y el color `magenta`. La portada ya es de bloques que caen, así que no hace falta otra.
- **Sí:** extraer el contrato común en esta spec (`GameStats`, `ArenaProps`, `ARENAS` y `ReadyOverlay`). Con dos juegos reales, una segunda rama `if` en `GamePlayer` duplicaría la lógica.
- **No:** un campo `playable` en `Game`. El registro `ARENAS` ya dice qué juegos tienen arena.
- **Sí:** `initial` en cada entrada del registro. Cada juego empieza con un HUD distinto (`♥ ♥ ♥` en ROCAS, `—` en APILA).
- **Sí:** el resultado del motor es `ScoreSubmission`. Es justo lo que `saveScore` necesita, sin tipos intermedios.
- **Sí:** mundo de 800×600 con el tablero centrado y el panel SIGUIENTE / LÍNEAS dentro del canvas. El tablero cabe con su alto exacto, la física no cambia y la pieza siguiente es parte del juego.
- **No:** un canvas de 300×600 con bandas y la pieza siguiente en React. Partiría el juego en dos sitios.
- **Sí:** las líneas solo se ven en el canvas. El HUD no tiene casilla para ellas y `scores` no las guarda.
- **No:** una casilla `LÍNEAS` en el HUD, ni guardar las líneas en la base de datos. Haría falta cambiar `GameStats` o el esquema solo para un juego.
- **Sí:** capar el `dt` a 50 ms, aunque la referencia no lo capa. A 60 Hz no cambia nada, `durationMs` nunca supera el tiempo simulado, y es la regla común de los motores.
- **Sí:** conservar la paleta `COLORS` y la pieza N «tuerca». Es un port fiel.
- **No:** el tema claro y `localStorage`. El Vault solo tiene estética oscura.
- **Sí:** el autorepeat del sistema para las teclas mantenidas, como en la referencia.
- **No:** un DAS o ARR propio. Sería cambiar cómo se juega.
- **Sí:** la regla de plausibilidad solo con cotas por nivel: `level ≤ 1 + floor(score/1000)` y `score ≤ L·(200·level + 95) + 1938`. Son máximos teóricos que salen de las constantes y no rechazan ninguna partida legítima.
- **No:** un tope de puntos por segundo. La caída instantánea no tiene límite físico de velocidad, y cualquier tope sería una suposición.
- **Sí:** forzar el game over natural en Playwright pulsando `Space` seguido. A diferencia de ROCAS, aquí se puede automatizar.

---

## Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                                                    |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Generalizar `GamePlayer` rompe ROCAS: HUD, reinicio o guardado.                                | Es el paso 1 y va solo. Se prueba ROCAS a mano, y hay criterios de aceptación propios del contrato común.                                     |
| La pulsación de `Space` que arranca la partida dispara también una caída instantánea.          | El motor consume esa pulsación al pasar de `ready` a `playing`, y hay un criterio de aceptación para ello.                                    |
| El autorepeat de `Space` encadena caídas instantáneas si se mantiene pulsada.                  | Se acepta porque la referencia funciona igual. La regla de plausibilidad no pone tope de velocidad, así que tampoco rechaza esas partidas.    |
| La regla rechaza una partida legítima.                                                         | Las cotas son máximos teóricos sacados de las constantes. La validación usa partidas reales, incluida una manual larga con varios niveles.    |
| El panel SIGUIENTE / LÍNEAS no cabe o se ve mal en el 4:3.                                     | El tablero ocupa 300 de los 800 px. El diseño del panel y del canvas se hace con `/frontend-design` y se revisa a 1440 y 375 px.              |
| Quitar `caida` deja enlaces rotos.                                                             | `caida` solo aparece en `lib/games.ts`. `/games/caida` devuelve 404 con la página `not-found` que ya existe, y hay un criterio de aceptación. |
| Al cambiar el nombre de las clases CSS del overlay se queda algún estilo sin aplicar en ROCAS. | El cambio de nombre se hace en el paso 1 y se revisa ROCAS visualmente con Playwright.                                                        |
| Quedan datos de prueba en el proyecto remoto.                                                  | El paso 6 los borra, y hay un criterio de aceptación.                                                                                         |

---

## Lo que **no** entra en esta spec

- Sonido, controles táctiles, gamepad y ratón.
- Cambios de reglas, velocidad o puntuación respecto a la referencia: bolsa de 7, _hold_, T-spins, _lock delay_ o DAS propio.
- Guardar las líneas en la base de datos, o una casilla `LÍNEAS` en el HUD.
- Una portada nueva para APILA.
- Tema claro.
- Hacer jugables otros juegos.
- Anti-trampas más allá de las cotas por nivel.
- Tests automatizados.

Cada uno de estos puntos, si llega, va en su propia spec.
