# SPEC 05 — ROCAS jugable (Asteroids) con puntuaciones reales en Supabase

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02, SPEC 04
> **Fecha:** 2026-11-19
> **Objetivo:** Convertir `/games/rocas/play` en el Asteroids real portado de `references/started-games/02-asteroids/`, y guardar sus puntuaciones en Supabase para mostrarlas en el detalle de ROCAS y en el Salón de la Fama.

---

## Por qué existe esta spec

Hasta ahora `components/game-player.tsx` es una simulación: la puntuación sube sola. La SPEC 04 ya sabe quién es el jugador (`profiles.username`). Esta spec trae el primer juego real y la primera tabla con datos de juego.

La referencia es un único `game.js` de ~510 líneas (canvas 800×600, clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, bucle `requestAnimationFrame` con `dt` capado a 50 ms, mundo toroidal y power-up de disparo triple). Se porta a TypeScript sin cambiar la física. El catálogo ya tiene una entrada de asteroides, **ROCAS** (`id: "rocas"`), que es la que pasa a ser jugable. Los otros 7 juegos siguen con la simulación y los datos mock.

La puntuación la calcula el navegador, así que se puede falsear. Se acepta ese límite y se pone una validación de plausibilidad en el servidor y en la base de datos.

---

## Alcance

**Entra:**

- **Motor del juego** `lib/asteroids/engine.ts` (TypeScript puro, sin React). Es un port de `game.js` con la misma física, constantes, puntos (20 / 50 / 100), vidas (3), invencibilidad al reaparecer, división de asteroides, partículas, niveles (`3 + nivel` asteroides grandes) y power-up `3x` (probabilidad 0,15, garantizado a las 5 bajas, dura 5 s y desaparece a los 12 s).
  - Cambios respecto a la referencia:
    - Paleta neón del Vault: nave cian (`#00f5ff`), asteroides magenta (`#ff006e`), balas amarillas (`#f5ff00`), power-up verde (`#00ff88`), llama del propulsor amarilla, partículas en el color del objeto que explota, con `shadowBlur` para el glow.
    - El canvas **no** dibuja HUD ni overlay de GAME OVER. El motor emite eventos y la UI es React.
    - En game over el motor se detiene. Espacio no reinicia: se reinicia desde el modal.
    - Las teclas `ArrowLeft`, `ArrowRight`, `ArrowUp` y `Space` hacen `preventDefault()` para que la página no haga scroll.
    - El canvas tiene 800×600 unidades lógicas y su buffer se escala por `devicePixelRatio`, para que los trazos se vean nítidos. Por CSS ocupa el 100% de `.crt-screen` (que ya es 4:3).
    - El motor cuenta el tiempo jugado (suma de `dt` mientras no está en pausa) para la validación.
- **Componente** `components/asteroids-player.tsx` (cliente), que monta el canvas dentro del `.crt` existente y usa el HUD y el modal de siempre:
  - **HUD:** Jugador (username en mayúsculas o `INVITADO`), Puntuación, Vidas (`♥` según las vidas reales), Nivel, y un indicador `3x · 4.2s` mientras dura el power-up.
  - **PAUSA / REANUDAR:** pausa el motor. También con las teclas `P` o `Escape`. Con el juego en pausa se ve el overlay `EN PAUSA` actual.
  - **Autopausa:** el juego se pausa solo con `visibilitychange` (pestaña oculta) y con `blur` de la ventana. No se reanuda solo.
  - **FIN:** termina la partida como si fuera un game over, con el mismo modal y el mismo guardado.
  - **SALIR:** vuelve a `/games/rocas`. La partida en curso se descarta sin guardar.
  - **Táctil:** si `matchMedia("(hover: none) and (pointer: coarse)")` coincide, la pantalla CRT muestra `REQUIERE TECLADO` y el motor no arranca.
  - La partida empieza al montar el componente, como en la referencia (la nave tiene 3 s de invencibilidad).
- **Modal FIN DEL JUEGO** (el de siempre: título, PUNTUACIÓN FINAL, JUGAR DE NUEVO, VOLVER AL VAULT). La zona de guardado cambia:
  - **Con sesión y puntuación > 0:** se guarda automáticamente al abrirse. Muestra `▸ GUARDANDO…`, después `▸ PUNTUACIÓN GUARDADA_` o un error (tabla del modelo de datos). Solo el error `unknown` ofrece `REINTENTAR`.
  - **Con sesión y puntuación 0:** `▸ SIN PUNTOS QUE GUARDAR`. No llama al servidor.
  - **Sin sesión:** `INICIA SESIÓN PARA GUARDAR TUS PUNTUACIONES` y un botón a `/login`.
  - El input de iniciales desaparece en ROCAS.
  - `JUGAR DE NUEVO` reinicia el motor y el estado de guardado.
- **Refactor de `components/game-player.tsx`:** se extraen el HUD (`components/player-hud.tsx`) y el modal (`components/game-over-modal.tsx`) para que los usen tanto la simulación como ROCAS sin duplicar marcado. El modal recibe la zona de guardado como `children`. La simulación queda igual que hoy (input de iniciales solo visual).
- **Ruta de juego** `app/games/[id]/play/page.tsx`: si `game.id === "rocas"`, renderiza `AsteroidsPlayer` con el `username` de `getCurrentProfile()` (dentro del `<Suspense>` que ya existe). El resto de juegos renderiza `GamePlayer`.
- **Catálogo** `lib/games.ts`:
  - nuevo campo opcional `live?: true` en `Game`, presente solo en ROCAS;
  - la descripción `long` de ROCAS pasa a ser: «Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Atrapa el núcleo 3x para disparar en abanico.» (se quitan los OVNIs, que no existen).
- **Persistencia:**
  - migración versionada `create_scores` (tabla `public.scores`, vista `public.leaderboard`, RLS), aplicada con el MCP;
  - tipos regenerados en `lib/supabase/database.types.ts`;
  - Server Action `saveScore` en `app/games/actions.ts`;
  - lecturas en `lib/scores.ts` (`server-only`).
- **Detalle `/games/rocas`** (`app/games/[id]/page.tsx`), para juegos con `live`:
  - el leaderboard muestra el top 10 real (mejor puntuación de cada jugador);
  - `Mejor global` es la primera puntuación del top, o `0`;
  - `Partidas` es el número de filas de `scores` de ROCAS;
  - la etiqueta `TECLADO / TÁCTIL` pasa a `TECLADO`;
  - si no hay puntuaciones, el leaderboard muestra `SÉ EL PRIMERO EN ENTRAR AL RANKING`.
- **Salón de la Fama**, pestaña ROCAS: top 12 real con el mismo criterio. Si hay menos de 3 filas, los puestos vacíos del podio muestran `—`. Si no hay ninguna, se ve el podio vacío y la tabla muestra `SIN PUNTUACIONES TODAVÍA`. Las demás pestañas siguen con `seededScores`.
- CSS nuevo en `app/globals.css`, solo lo mínimo: canvas a pantalla completa del CRT, overlay `REQUIERE TECLADO`, estados de guardado del modal, indicador `3x` del HUD y estados vacíos. Se diseña con el skill `/frontend-design` y la estética existente.
- `get_advisors` (security y performance) después de la migración.
- Validación con Playwright MCP.

**Fuera de alcance (para specs futuras):**

- Controles táctiles y juego en móvil.
- Sonido.
- OVNIs, hiperespacio o cualquier mecánica que no esté en la referencia.
- Portar Tetris o Arkanoid (`references/started-games/03-tetris`, `04-arkanoid`), y datos reales para los otros 7 juegos.
- Guardar puntuaciones de invitados.
- Anti-trampas fuerte (simulación en servidor, replays, tokens de partida firmados) y rate limiting propio.
- Tabla `games` en Supabase. `lib/games.ts` sigue siendo la fuente del catálogo.
- Historial de partidas del jugador, perfil público o «mi mejor puntuación».
- Borrar o moderar puntuaciones.
- El contador `CRÉDITOS · 03` de la nav sigue siendo fijo.
- Tests automatizados, porque no hay test runner.

---

## Modelo de datos

### Base de datos — `supabase/migrations/<version>_create_scores.sql`

```sql
create table public.scores (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  game_id     text not null check (game_id in ('rocas')),
  score       integer not null check (score > 0 and score <= 1000000 and score % 10 = 0),
  level       integer not null check (level >= 1),
  duration_ms integer not null check (duration_ms >= 1000),
  created_at  timestamptz not null default now(),
  -- Plausibilidad: máx. 1500 puntos/s (disparo triple: 3 balas × 100 cada 0,2 s)
  constraint scores_rate_plausible  check (score <= (duration_ms / 1000.0) * 1500),
  -- Superar un nivel exige destruir al menos 4 asteroides grandes completos (4 × 520 = 2080)
  constraint scores_level_plausible check (level <= 1 + score / 2080)
);

create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_user_id_idx on public.scores (user_id);

alter table public.scores enable row level security;

-- Las puntuaciones son públicas (rankings).
create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);

-- Cada usuario solo inserta filas propias. Sin update ni delete.
create policy "scores_insert_own" on public.scores
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Mejor puntuación de cada jugador por juego (en empate, la más antigua).
create view public.leaderboard
with (security_invoker = true) as
select distinct on (s.game_id, s.user_id)
  s.game_id, s.user_id, p.username, s.score, s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.game_id, s.user_id, s.score desc, s.created_at asc;
```

- `<version>` es la que devuelve `apply_migration` / `list_migrations`, como en la SPEC 04.
- `game_id` solo admite `'rocas'`. Cada juego real futuro amplía el `check` con su propia migración.
- `security_invoker = true` hace que la vista respete el RLS de `scores` y `profiles`.

### Motor — `lib/asteroids/engine.ts`

```ts
export type AsteroidsSnapshot = {
  score: number;
  lives: number; // 0–3
  level: number;
  tripleShot: number; // segundos restantes, 0 si no hay power-up (redondeado a 0,1)
};

export type AsteroidsResult = {
  score: number;
  level: number;
  durationMs: number;
};

export type AsteroidsCallbacks = {
  onChange: (s: AsteroidsSnapshot) => void; // solo cuando cambia algún valor, no en cada frame
  onGameOver: (r: AsteroidsResult) => void; // una sola vez por partida (vidas a 0 o end())
};

export type AsteroidsGame = {
  pause(): void;
  resume(): void;
  end(): void; // fuerza el game over con la puntuación actual
  restart(): void; // nueva partida desde cero
  destroy(): void; // cancela el rAF y quita los listeners de teclado
};

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsGame;
```

- Las constantes de la referencia (`RADII`, `SPEEDS`, `POINTS`, velocidades, `DRAG`, cooldown 0,2 s, etc.) se mantienen con sus valores.
- Los listeners de teclado van en `window`, se registran en `createAsteroidsGame` y se quitan en `destroy()`. En pausa o game over se ignoran las teclas de juego.
- `durationMs` es la suma de los `dt` (ya capados a 50 ms) mientras el estado es `playing` o `dead`, sin contar la pausa.

### Server Action — `app/games/actions.ts`

```ts
export type SaveScoreInput = {
  gameId: string;
  score: number;
  level: number;
  durationMs: number;
};

export type SaveScoreErrorCode =
  | "unauthenticated" // getClaims() sin usuario
  | "invalid" // falla cualquier regla de validación (o un check de la BD)
  | "unknown"; // cualquier otro error (se registra con console.error)

export type SaveScoreResult =
  { status: "saved" } | { status: "error"; code: SaveScoreErrorCode };

export async function saveScore(
  input: SaveScoreInput,
): Promise<SaveScoreResult>;
```

Validación en el servidor, antes de insertar (las mismas reglas que los `check`):

- `gameId` es un juego de `GAMES` con `live` (hoy solo `rocas`).
- `score`, `level` y `durationMs` son enteros finitos.
- `0 < score ≤ 1.000.000` y `score % 10 === 0`.
- `level ≥ 1` y `level ≤ 1 + floor(score / 2080)`.
- `durationMs ≥ 1000` y `score ≤ durationMs / 1000 × 1500`.
- `user_id` sale de `getClaims()` en el servidor, nunca del cliente.
- Un error de `check` de Postgres (`23514`) se devuelve como `invalid`. El detalle del error nunca llega al cliente.

Mensajes del modal:

| Estado / código   | Mensaje                                                    | Acción extra     |
| ----------------- | ---------------------------------------------------------- | ---------------- |
| enviando          | `▸ GUARDANDO…`                                             | —                |
| `saved`           | `▸ PUNTUACIÓN GUARDADA_`                                   | —                |
| `unauthenticated` | `[ERR] TU SESIÓN HA CADUCADO. INICIA SESIÓN PARA GUARDAR.` | botón a `/login` |
| `invalid`         | `[ERR] PUNTUACIÓN RECHAZADA.`                              | —                |
| `unknown`         | `[ERR] NO SE PUDO GUARDAR.`                                | `REINTENTAR`     |

### Lecturas — `lib/scores.ts` (`server-only`)

```ts
import type { ScoreRow } from "@/lib/games";

// Top N de la vista leaderboard para un juego: score desc, created_at asc.
// name = username en mayúsculas; date = created_at en dd/mm/aaaa (UTC).
export async function getLeaderboard(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]>;

// Número de filas de scores para el juego (count exact, head).
export async function getPlays(gameId: string): Promise<number>;
```

- Usan el cliente de servidor de la SPEC 04 y son lecturas dinámicas, siempre dentro de un `<Suspense>` (ya lo están las del detalle y el Salón).
- Si Supabase falla, registran el error con `console.error` y devuelven `[]` / `0`. La página muestra el estado vacío en lugar de romperse.

---

## Plan de implementación

1. **Lectura previa.**
   - Leer `references/started-games/02-asteroids/game.js` completo.
   - Leer en `node_modules/next/dist/docs/01-app/` la referencia de Server Actions y la guía de Cache Components para lecturas dinámicas dentro de `<Suspense>`.
   - Comprobar con `list_tables` que `public` solo tiene `profiles`.
2. **Motor.** Crear `lib/asteroids/engine.ts` con la API del modelo de datos y la paleta neón. Montarlo de forma provisional en `AsteroidsPlayer` (paso 4) para probarlo.
   - Prueba manual: se juega igual que la referencia (rotar, propulsar, disparar, wrap, división, power-up `3x`, vidas, niveles).
   - `npm run build` pasa.
3. **Refactor del reproductor.** Extraer `components/player-hud.tsx` y `components/game-over-modal.tsx` de `game-player.tsx`.
   - Prueba manual: los otros juegos (por ejemplo `/games/caida/play`) se ven y funcionan igual que antes.
4. **`AsteroidsPlayer` sin guardado.**
   - Crear `components/asteroids-player.tsx`: canvas en `.crt-screen`, HUD con los eventos del motor, PAUSA/REANUDAR, teclas `P`/`Escape`, autopausa, FIN, SALIR y overlay `REQUIERE TECLADO`.
   - Enrutar `rocas` en `app/games/[id]/play/page.tsx` y pasar `username` desde `getCurrentProfile()`.
   - Añadir `live: true` y la nueva descripción en `lib/games.ts`.
   - CSS con `/frontend-design`.
   - Prueba manual: el modal se abre en game over y con FIN, y `JUGAR DE NUEVO` reinicia.
5. **Migración y tipos.**
   - Aplicar la migración del modelo de datos con `apply_migration` (`create_scores`) y guardar el mismo SQL en `supabase/migrations/<version>_create_scores.sql`.
   - Ejecutar `get_advisors` (security y performance) y corregir los avisos sobre `scores` o `leaderboard`.
   - Regenerar `lib/supabase/database.types.ts`.
6. **Guardado.**
   - Crear `app/games/actions.ts` con `saveScore`.
   - Conectar el modal de ROCAS: guardado automático una sola vez por partida (con un `ref` como guarda, no en un `useEffect`), los estados de la tabla, `REINTENTAR` solo con `unknown`, y las variantes sin sesión y con puntuación 0.
   - Prueba manual: con sesión, una partida crea una fila en `scores` (comprobarlo con `execute_sql`).
7. **Lecturas.**
   - Crear `lib/scores.ts`.
   - Usarlo en el detalle (leaderboard, `Mejor global`, `Partidas`, etiqueta `TECLADO`) y en la pestaña ROCAS del Salón de la Fama (podio con `—` y estado vacío), solo para juegos con `live`.
   - Añadir el CSS de los estados vacíos.
8. **Validación.** Con `npm run dev` y Playwright MCP, a 1440×900:
   - jugar con teclado y llegar a game over;
   - FIN a mitad de partida;
   - PAUSA con el botón y con `P`, y autopausa al cambiar de pestaña;
   - modal con sesión (guardado), sin sesión y con puntuación 0;
   - llamar a `saveScore` con datos imposibles (por ejemplo `score: 999990, durationMs: 1000`) y comprobar `invalid` sin fila nueva;
   - el detalle y el Salón muestran la puntuación nueva tras volver;
   - estado vacío del detalle y del Salón (antes de la primera partida);
   - `/games/rocas/play` a 375×812 en emulación táctil muestra `REQUIERE TECLADO`;
   - `/games/caida/play` sigue igual.
     Revisar la consola. Borrar las filas de `scores` y los usuarios de prueba al terminar. Ejecutar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] `/games/rocas/play` muestra un canvas dentro del CRT en lugar de la arena simulada.
- [ ] `←` `→` rotan, `↑` propulsa y `Espacio` dispara. Pulsarlas no hace scroll en la página.
- [ ] Nave, asteroides, balas y power-up se dibujan en cian, magenta, amarillo y verde respectivamente.
- [ ] Destruir un asteroide grande, uno mediano y uno pequeño suma 20, 50 y 100 puntos, y el HUD los refleja.
- [ ] Los asteroides grandes se parten en 2 medianos y los medianos en 2 pequeños. Los objetos que salen por un borde entran por el opuesto.
- [ ] Al vaciar el nivel, el HUD pasa al nivel siguiente y aparecen `3 + nivel` asteroides grandes.
- [ ] Al chocar, las vidas del HUD bajan en 1 y la nave reaparece en el centro parpadeando 3 s.
- [ ] Recoger el power-up activa el disparo triple 5 s, y el HUD muestra `3x` con la cuenta atrás.
- [ ] El canvas no dibuja textos de HUD ni de GAME OVER.
- [ ] PAUSA y la tecla `P` (o `Escape`) congelan el juego y muestran `EN PAUSA`. REANUDAR lo continúa.
- [ ] Ocultar la pestaña pausa el juego, y al volver sigue en pausa.
- [ ] Al quedarse sin vidas se abre el modal FIN DEL JUEGO con la puntuación final. FIN a mitad de partida abre el mismo modal.
- [ ] Con sesión y puntuación > 0, el modal muestra `▸ GUARDANDO…` y después `▸ PUNTUACIÓN GUARDADA_`, y en `scores` aparece **una** fila con el `user_id` del jugador.
- [ ] Con sesión y puntuación 0, el modal muestra `▸ SIN PUNTOS QUE GUARDAR` y no se crea ninguna fila.
- [ ] Sin sesión, el modal muestra `INICIA SESIÓN PARA GUARDAR TUS PUNTUACIONES` con un botón a `/login`, y no se crea ninguna fila.
- [ ] `JUGAR DE NUEVO` empieza una partida nueva (puntuación 0, 3 vidas, nivel 1).
- [ ] El HUD muestra el username en mayúsculas con sesión, e `INVITADO` sin ella.
- [ ] `saveScore` con `score: 999990, durationMs: 1000` devuelve `invalid` y no inserta nada. Un insert directo con esos valores falla por el `check` de la BD.
- [ ] Un usuario autenticado no puede insertar en `scores` con otro `user_id` (RLS).
- [ ] Existe `supabase/migrations/<version>_create_scores.sql`, y `list_migrations` muestra la misma versión.
- [ ] `get_advisors` (security) no muestra avisos sobre `scores` ni `leaderboard`.
- [ ] `lib/supabase/database.types.ts` incluye la tabla `scores` y la vista `leaderboard`.
- [ ] `/games/rocas` muestra en el leaderboard una sola fila por jugador (su mejor puntuación), ordenadas de mayor a menor. `Mejor global` y `Partidas` coinciden con la BD.
- [ ] Sin puntuaciones, `/games/rocas` muestra `SÉ EL PRIMERO EN ENTRAR AL RANKING`, `Mejor global` 0 y `Partidas` 0.
- [ ] La pestaña ROCAS de `/hall-of-fame` muestra los datos reales. Con menos de 3 jugadores, los puestos vacíos del podio muestran `—`. Sin datos, la tabla muestra `SIN PUNTUACIONES TODAVÍA`.
- [ ] Tras guardar una puntuación, volver a `/games/rocas` la muestra sin recargar la página a mano.
- [ ] Las demás pestañas del Salón, los demás detalles y `/games/caida/play` se ven igual que antes de esta spec.
- [ ] Con emulación táctil a 375×812, `/games/rocas/play` muestra `REQUIERE TECLADO`, el juego no arranca y no hay scroll horizontal.
- [ ] Salir de `/games/rocas/play` detiene el bucle: no quedan listeners de teclado ni `requestAnimationFrame` activos (las flechas vuelven a hacer scroll en otras páginas).
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/games/rocas`, `/games/rocas/play` ni `/hall-of-fame?game=rocas`.
- [ ] Las filas de `scores` y los usuarios de prueba creados durante la validación se han borrado.

---

## Decisiones

- **Sí:** reutilizar la entrada ROCAS del catálogo. Ya describe asteroides y tiene portada. Se corrige la descripción para no prometer OVNIs.
- **Sí:** port fiel de la física y las constantes de `game.js`. La referencia ya está afinada. Solo cambian la paleta, el HUD y el reinicio.
- **Sí:** motor en TypeScript puro (`lib/asteroids/engine.ts`) con una API imperativa y callbacks. El bucle a 60 fps no pasa por el estado de React. React solo recibe cambios de HUD.
- **No:** reescribir el juego con estado de React por frame. Provoca re-renders en cada frame y mezcla lógica y vista.
- **No:** `lib/games/asteroids/…`. Chocaría con el módulo `lib/games.ts` en la resolución de `@/lib/games`.
- **Sí:** HUD y modal de la app, no del canvas. Mantiene una sola estética y PAUSA/FIN/SALIR funcionan igual en todos los juegos.
- **Sí:** extraer `PlayerHud` y `GameOverModal`. La simulación y ROCAS comparten el marcado sin duplicarlo.
- **Sí:** paleta neón del Vault sobre la forma vectorial clásica.
- **Sí:** solo teclado. En táctil se avisa y no se arranca. Los controles táctiles merecen su propia spec.
- **Sí:** la partida empieza al cargar, como en la referencia. La invencibilidad inicial de 3 s da margen.
- **Sí:** autopausa con `visibilitychange` y `blur`, sin reanudación automática.
- **Sí:** guardar solo con sesión, con el username de `profiles`. Evita insert anónimo, nombres sin moderar y spam.
- **Sí:** guardado automático en game over y con FIN. No se pierde ninguna partida y el modal no necesita botón.
- **Sí:** SALIR descarta la partida en curso. Salir es abandonar.
- **Sí:** validación de plausibilidad (múltiplo de 10, puntos por segundo, nivel frente a puntuación, duración mínima) en la Server Action y como `check` en la BD. Frena las trampas triviales. Se acepta que no es a prueba de trampas.
- **No:** simulación en servidor, replays o tokens de partida. Es mucha más complejidad de la que pide un MVP.
- **Sí:** Server Action `saveScore` que llama el cliente con un objeto. Sigue el patrón de las SPEC 03 y 04 y el `user_id` sale del servidor.
- **Sí:** `game_id` como texto con `check (game_id in ('rocas'))`. No hace falta una tabla `games` mientras el catálogo viva en `lib/games.ts`. Cada juego real nuevo amplía el `check`.
- **Sí:** vista `leaderboard` con `distinct on` y `security_invoker`. Da la mejor puntuación por jugador sin RPC y respeta el RLS.
- **Sí:** ranking por la mejor puntuación de cada jugador; en empate gana la más antigua.
- **Sí:** lecturas dinámicas dentro de `<Suspense>`, sin `"use cache"`. Los datos se ven al instante tras guardar y no hace falta invalidar caché. Si la carga crece, se cachea en otra spec.
- **Sí:** `Partidas` real (número de filas de `scores`) y `Mejor global` real para ROCAS.
- **Sí:** campo `live?: true` en `Game` para decidir qué juegos usan datos reales. Los mock no cambian.
- **No:** rate limiting en esta spec. Se confía en que solo hay insert autenticado y en los límites de Supabase.

---

## Riesgos

| Riesgo                                                                                                  | Mitigación                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La puntuación se puede falsear llamando a `saveScore` desde la consola.                                 | Validación de plausibilidad en la acción y en la BD. Se asume el riesgo residual y queda documentado. Un anti-trampas serio va en otra spec.                                                                                                |
| Las reglas de plausibilidad rechazan una partida legítima.                                              | Los límites salen del máximo teórico de la referencia (1500 pts/s con disparo triple, 2080 puntos por nivel). Con `dt` capado, el tiempo contado nunca supera el tiempo real de simulación. La validación del paso 8 juega partidas reales. |
| Guardado doble (StrictMode, varios clics, re-render).                                                   | El guardado lo dispara `onGameOver` (una vez por partida) con un `ref` de guarda, no un `useEffect`. Un criterio de aceptación comprueba que se crea una sola fila.                                                                         |
| Fugas del bucle o de listeners al salir de la ruta.                                                     | `destroy()` cancela el `requestAnimationFrame` y quita los listeners, y se llama en el cleanup del efecto. Hay un criterio de aceptación para ello.                                                                                         |
| Las teclas del juego hacen scroll o activan botones enfocados (Espacio pulsa el último botón con foco). | `preventDefault()` en las teclas de juego. El canvas toma el foco al montar y los botones del HUD lo sueltan (`blur()`) tras el clic.                                                                                                       |
| Leer cookies o datos de Supabase fuera de `<Suspense>` rompe el prerender con `cacheComponents`.        | Todas las lecturas van dentro de los `<Suspense>` que ya existen. `npm run build` lo valida.                                                                                                                                                |
| Una vista sin `security_invoker` se salta el RLS y el advisor lo marca.                                 | La vista se crea con `security_invoker = true`. Se ejecuta `get_advisors` tras la migración.                                                                                                                                                |
| La API de Server Actions de Next 16.4 puede diferir de lo conocido.                                     | El paso 1 obliga a leer `node_modules/next/dist/docs/` antes de escribir código.                                                                                                                                                            |
| Datos de prueba que se quedan en el proyecto remoto.                                                    | El paso 8 incluye borrarlos, y un criterio de aceptación lo comprueba.                                                                                                                                                                      |

---

## Lo que **no** entra en esta spec

- Controles táctiles y sonido.
- OVNIs u otras mecánicas nuevas.
- Otros juegos reales (Tetris, Arkanoid) y datos reales para los juegos mock.
- Puntuaciones de invitados.
- Anti-trampas fuerte y rate limiting propio.
- Tabla `games` en Supabase.
- Historial y perfil del jugador.
- Moderación o borrado de puntuaciones.
- Caché de los rankings.
- Tests automatizados.

Cada uno de estos puntos, si llega, va en su propia spec.
