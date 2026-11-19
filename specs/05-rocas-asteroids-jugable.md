# SPEC 05 — ROCAS jugable: port del Asteroids de referencia dentro del reproductor

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03, SPEC 04
> **Fecha:** 2026-11-19
> **Objetivo:** Convertir `/games/rocas/play` en el Asteroids real, portado a TypeScript desde `references/started-games/02-asteroids/` y conectado al HUD, la pausa y el modal de fin de juego de `GamePlayer`.

---

## Por qué existe esta spec

Hasta ahora `components/game-player.tsx` es una simulación para los 8 juegos del catálogo: la puntuación sube sola y la arena es decorativa. Esta spec trae el primer juego real.

La referencia es un único `game.js` de unas 510 líneas: canvas de 800×600, clases `Bullet`, `Asteroid`, `PowerUp`, `Ship` y `Particle`, un bucle `requestAnimationFrame` con `dt` capado a 50 ms, mundo toroidal y un power-up de disparo triple. Usa variables globales y escucha el teclado en `window`. Se porta a TypeScript sin cambiar la física. El catálogo ya tiene una entrada de asteroides, **ROCAS** (`id: "rocas"`), y es la que pasa a ser jugable.

Esta spec sustituye a la SPEC 05 anterior («ROCAS jugable con puntuaciones reales en Supabase», commit `3eaa00a`), que se ha descartado por ser demasiado grande. La persistencia de puntuaciones irá en una spec propia.

---

## Alcance

**Entra:**

- **Motor** `lib/asteroids/engine.ts`: TypeScript puro, sin React y sin estado global de módulo. Es un port de `game.js` que conserva:
  - las constantes: `RADII`, `SPEEDS`, `POINTS` (20 / 50 / 100), `ROT`, `THRUST`, `DRAG`, la velocidad de la bala, `SAFE_DIST`, `POWERUP_*` y `TRIPLE_SPREAD`;
  - 3 vidas, 2 s de espera tras morir, invencibilidad con parpadeo al reaparecer y división de asteroides;
  - partículas, `4` asteroides grandes al empezar y `3 + nivel` en cada nivel nuevo;
  - el power-up `3x` y su indicador dentro del canvas;
  - la colisión de la nave con el factor `0.82`.

  Cambios respecto a la referencia:
  - Todo el estado vive dentro de la instancia que devuelve `createAsteroidsGame(canvas, callbacks)`.
  - El canvas **ya no dibuja** `SCORE`, `NIVEL` ni el overlay `GAME OVER`. Esos datos los muestra React. Solo se queda el indicador `3x  N.Ns` del power-up.
  - Hay una fase nueva, `ready`: el campo de asteroides se ve y se mueve, pero la nave no responde y no hay colisiones. `Space` pasa a `playing`.
  - Al llegar a `gameover` no se reinicia con `Space`. Avisa con `onGameOver` y el reinicio lo hace React.
  - `setPaused(bool)` congela `update` y reinicia la referencia de tiempo al reanudar.
  - `end()` congela el juego (lo usa el botón FIN).
  - `destroy()` cancela el `requestAnimationFrame` y quita los listeners.
  - El teclado:
    - se ignora si el foco está en un `input`, `textarea` o `select`;
    - hace `preventDefault` de `ArrowLeft`, `ArrowRight`, `ArrowUp` y `Space` mientras la fase no es `gameover`, para que la página no haga scroll.
  - El canvas reserva `800·dpr × 600·dpr` píxeles y aplica `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`. Así se ve nítido en pantallas retina y la lógica sigue en coordenadas 800×600.

- **Componente cliente** `components/asteroids-canvas.tsx`:
  - Monta un `<canvas>` que ocupa `.crt-screen`, que ya tiene proporción 4:3. Crea el motor en un `useEffect` y lo destruye en el cleanup.
  - Recibe `paused` y `over` como props y los pasa al motor con `setPaused` y `end`.
  - Sube al padre `onStats({ score, lives, level })` y `onGameOver(score)`.
  - Mientras la fase es `ready`, muestra un overlay React `PULSA ESPACIO PARA EMPEZAR` con la leyenda de controles: `← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · P / ESC PAUSA`.
  - En dispositivos táctiles (`@media (hover: none) and (pointer: coarse)`), ese overlay añade el aviso `NECESITAS UN TECLADO PARA JUGAR`.
- **Cambios en `components/game-player.tsx`:**
  - Si `game.id === "rocas"`, la arena es `<AsteroidsCanvas>` y no se ejecuta el `setInterval` de la simulación. Los otros 7 juegos no cambian.
  - El HUD muestra la puntuación, las vidas (`♥` por vida restante) y el nivel reales que llegan de `onStats`.
  - **PAUSA / REANUDAR** sigue igual y pausa el motor. El overlay `EN PAUSA` es el de siempre.
  - Las teclas `P` y `Escape` hacen lo mismo que el botón PAUSA, en todos los juegos. No hacen nada con el modal abierto ni si el foco está en un campo de texto.
  - Si la pestaña se oculta (`visibilitychange` con `document.hidden`), la partida se pausa sola. Al volver no se reanuda sola.
  - **FIN** abre el modal y congela el motor.
  - Cuando el motor llega a `gameover`, se abre el modal con la puntuación final.
  - **JUGAR DE NUEVO** remonta `<AsteroidsCanvas>` (cambia una `key` de partida), vuelve a la fase `ready` y pone el HUD a 0 puntos, 3 vidas y nivel 01.
  - El modal no cambia: el campo de iniciales y `GUARDAR PUNTUACIÓN` siguen siendo solo visuales.
- **CSS en `app/globals.css`**, solo lo mínimo: el canvas a pantalla completa dentro de `.crt-screen`, el overlay de inicio y el aviso táctil. Se diseña con el skill `/frontend-design` siguiendo la estética CRT y neón actual. Las scanlines de `.crt-screen::after` quedan por encima del canvas.
- Validación con Playwright MCP.

**Fuera de alcance (para specs futuras):**

- Guardar puntuaciones (Supabase o localStorage), leaderboards reales y el Salón de la Fama.
- Controles táctiles o de gamepad.
- Sonido.
- OVNIs (los menciona la descripción de ROCAS en `lib/games.ts`, pero la referencia no los tiene). El texto del catálogo no cambia.
- Hacer jugables los otros 7 juegos.
- Cambios de física, balance o dificultad respecto a la referencia.
- Tests automatizados.

---

## Modelo de datos

No hay persistencia ni datos nuevos en la base de datos. `lib/games.ts` no cambia. Solo se añaden los tipos públicos del motor.

### `lib/asteroids/engine.ts`

```ts
export type AsteroidsPhase = "ready" | "playing" | "dead" | "gameover";

export type AsteroidsStats = {
  score: number;
  lives: number; // 3 → 0
  level: number; // empieza en 1
};

export type AsteroidsCallbacks = {
  onStats: (stats: AsteroidsStats) => void; // se llama solo cuando cambia algún valor
  onPhase: (phase: AsteroidsPhase) => void; // ready → playing ⇄ dead → gameover
  onGameOver: (score: number) => void;
};

export type AsteroidsGame = {
  setPaused: (paused: boolean) => void;
  end: () => void; // congela el juego (botón FIN); no llama a onGameOver
  destroy: () => void; // cancela el rAF y quita los listeners de window
};

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsGame;
```

Constantes internas (sin cambios respecto a `game.js`): `W = 800`, `H = 600`, `dt` máximo de `0.05` s.

### Props de `components/asteroids-canvas.tsx`

```ts
type AsteroidsCanvasProps = {
  paused: boolean;
  over: boolean;
  onStats: (stats: AsteroidsStats) => void;
  onGameOver: (score: number) => void;
};
```

La fase (`ready` o no) es estado local del componente y solo controla el overlay de inicio.

---

## Plan de implementación

1. **Motor.**
   - Leer `references/started-games/02-asteroids/game.js` completo.
   - Crear `lib/asteroids/engine.ts` con el port, siguiendo el modelo de datos y los cambios del Alcance. Las clases se mantienen y se tipan. `keys` y `justPressed` pasan a ser estado de la instancia.
   - `npm run build` pasa. El motor no se importa todavía desde ningún sitio.
2. **Componente canvas.**
   - Crear `components/asteroids-canvas.tsx` (`"use client"`), con el motor montado en `useEffect`. Los callbacks se guardan en una ref para no recrear el motor cuando cambian.
   - Añadir el overlay de inicio y el aviso táctil.
   - Añadir el CSS en `globals.css`, diseñado con `/frontend-design`.
3. **Integración en `GamePlayer`.**
   - Rama `game.id === "rocas"`: estado de vidas, `key` de partida para el reinicio, y `paused` y `over` conectados al canvas.
   - Atajos `P` / `Escape` y pausa automática por `visibilitychange`.
   - Prueba manual: `/games/rocas/play` se juega de principio a fin. `/games/serpentina/play` (u otro juego) sigue con la simulación.
4. **Validación.** Con `npm run dev` levantado y Playwright MCP:
   - A 1440×900, `/games/rocas/play`:
     - se ve el overlay de inicio;
     - `Space` arranca la partida;
     - mantener `ArrowLeft` y `Space` unos segundos destruye asteroides y la puntuación del HUD sube;
     - `window.scrollY` no cambia al pulsar flechas o espacio;
     - `P` pausa y vuelve a pulsarse para reanudar, y `Escape` pausa;
     - FIN abre el modal con la puntuación del HUD;
     - escribir iniciales con espacios en el modal funciona;
     - JUGAR DE NUEVO vuelve al overlay de inicio con el HUD a cero.
   - A 375×812: sin scroll horizontal y el canvas escalado en 4:3.
   - Revisar la consola en cada paso.
   - Pedir al usuario una partida manual hasta perder las 3 vidas, para comprobar el game over del motor.
   - `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] `lib/asteroids/engine.ts` no importa React ni nada de `next/*`, y no tiene variables mutables a nivel de módulo.
- [ ] Las constantes de física y puntuación del motor tienen los mismos valores que en `game.js` (`RADII`, `SPEEDS`, `POINTS`, `ROT`, `THRUST`, `DRAG`, velocidad de bala, `POWERUP_DROP_CHANCE`, `POWERUP_DURATION`, `POWERUP_TTL`, `TRIPLE_SPREAD`).
- [ ] Al entrar en `/games/rocas/play` se ve el campo de asteroides en movimiento y el overlay `PULSA ESPACIO PARA EMPEZAR` con la leyenda de controles. La nave no responde a las flechas hasta pulsar `Space`.
- [ ] Destruir un asteroide grande, uno mediano y uno pequeño suma 20, 50 y 100 en el HUD de React.
- [ ] El canvas no dibuja `SCORE`, `NIVEL` ni `GAME OVER`. Sí dibuja el indicador `3x` mientras el power-up está activo.
- [ ] Perder una vida baja un `♥` en el HUD. Al perder la tercera, se abre el modal `FIN DEL JUEGO` con la puntuación final.
- [ ] Limpiar un nivel sube el nivel del HUD (`02`, `03`…) y genera `3 + nivel` asteroides grandes.
- [ ] Pulsar flechas o `Space` durante la partida no hace scroll en la página.
- [ ] El botón PAUSA, `P` y `Escape` pausan y reanudan. En pausa el juego queda congelado y se ve el overlay `EN PAUSA`. Al reanudar no hay salto de posición.
- [ ] Ocultar la pestaña pausa la partida, y sigue en pausa al volver.
- [ ] FIN congela el juego y abre el modal con la puntuación actual.
- [ ] Con el modal abierto se pueden escribir iniciales con espacios, y ni `P` ni `Escape` cambian la pausa.
- [ ] JUGAR DE NUEVO vuelve al overlay de inicio con 0 puntos, `♥ ♥ ♥` y nivel `01`.
- [ ] Salir de la página (SALIR o navegación) no deja listeners de `keydown`/`keyup` ni bucles `requestAnimationFrame` activos: en otra ruta, las flechas vuelven a hacer scroll.
- [ ] Con React StrictMode en desarrollo solo hay un bucle activo (la velocidad del juego es la normal, no el doble).
- [ ] El canvas se ve nítido en pantallas con `devicePixelRatio` 2 y mantiene la proporción 4:3 a 1440px y a 375px. A 375px no hay scroll horizontal.
- [ ] En un dispositivo táctil emulado se ve el aviso `NECESITAS UN TECLADO PARA JUGAR`.
- [ ] Los otros 7 juegos siguen con la simulación, igual que antes.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/games/rocas/play`.

---

## Decisiones

- **Sí:** solo el juego. Las puntuaciones persistentes van en otra spec. La SPEC 05 anterior (juego + Supabase) se descartó por tamaño.
- **Sí:** ROCAS (`id: "rocas"`) es el juego que pasa a ser jugable. Ya es el asteroides del catálogo, con su portada y su ficha.
- **Sí:** motor en TypeScript puro (`lib/asteroids/engine.ts`) más un componente React fino. Así el motor queda tipado, se puede probar sin React y conecta con el HUD por callbacks.
- **No:** copiar `game.js` a `public/` y cargarlo como script. Sin tipos, con globales y sin manera limpia de leer la puntuación.
- **Sí:** la arena cambia según el juego dentro de `GamePlayer`. El HUD, la pausa, FIN y el modal se reutilizan. La rama es `game.id === "rocas"`. No se añade un campo `playable` a `Game` porque solo hay un juego real.
- **No:** un `AsteroidsPlayer` separado con su propio HUD y modal. Duplicaría `GamePlayer`.
- **Sí:** HUD y game over en React, y el canvas deja de dibujarlos. Así los datos no aparecen dos veces. El indicador `3x` se queda en el canvas porque es parte del juego.
- **Sí:** fase `ready` con overlay `PULSA ESPACIO`, para que el jugador no reciba un golpe antes de mirar la pantalla.
- **Sí:** `P` / `Escape` en `GamePlayer` para todos los juegos. Es el mismo botón PAUSA y no tiene sentido que funcione solo en uno.
- **Sí:** pausa automática al ocultar la pestaña, sin reanudar sola. El `dt` capado evita saltos, pero no evita morir con la pestaña oculta.
- **Sí:** reinicio remontando el componente con una `key`. Es más simple y más fiable que un `restart()` en el motor.
- **Sí:** mundo lógico de 800×600 escalado por CSS, con el backing store multiplicado por `devicePixelRatio`. La física no cambia y se ve nítido.
- **No:** controles táctiles en esta spec. En móvil solo se avisa de que hace falta teclado.
- **Sí:** se conserva `DRAG = 0.987` por frame, aunque depende de la tasa de refresco, porque la regla es no cambiar la física.

---

## Riesgos

| Riesgo                                                                                              | Mitigación                                                                                                                                     |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| StrictMode monta el efecto dos veces en desarrollo y puede dejar dos bucles y listeners duplicados. | `destroy()` en el cleanup del efecto, y un criterio de aceptación que comprueba la velocidad normal.                                           |
| El motor intercepta teclas mientras se escribe en el modal (las iniciales con espacio).             | El motor ignora eventos cuyo `target` es un campo de texto, y no hace `preventDefault` en `gameover`. Hay un criterio de aceptación para esto. |
| `DRAG` por frame hace que la nave planee distinto a 60 Hz y a 120 Hz.                               | Se acepta para no cambiar la física (ver Decisiones). Si molesta, se corrige en otra spec.                                                     |
| Llamar a `onStats` en cada frame provoca 60 renders por segundo de `GamePlayer`.                    | `onStats` solo se llama cuando cambia `score`, `lives` o `level`.                                                                              |
| Las scanlines u overlays de `.crt-screen` tapan el canvas o capturan clics.                         | El CSS fija el `z-index` del canvas por debajo de `::after` y `::before`, y los overlays decorativos tienen `pointer-events: none`.            |
| El game over automático es difícil de forzar con Playwright.                                        | Se valida con FIN de forma automática, y el game over por vidas en una partida manual del usuario (paso 4).                                    |

---

## Lo que **no** entra en esta spec

- Persistencia de puntuaciones, leaderboards y Salón de la Fama reales.
- Controles táctiles y gamepad.
- Sonido.
- OVNIs o cualquier mecánica que no esté en la referencia.
- Los otros 7 juegos.
- Tests automatizados.

Cada uno de estos puntos, si llega, va en su propia spec.
