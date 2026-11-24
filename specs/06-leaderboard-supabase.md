# SPEC 06 — Leaderboard en Supabase para juegos conectados (ROCAS primero)

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 04, SPEC 05
> **Fecha:** 2026-11-23
> **Objetivo:** Guardar en Supabase las puntuaciones de los juegos conectados (hoy solo ROCAS) y mostrarlas en el detalle, el Salón de la Fama y la biblioteca, de forma que conectar otro juego sea añadir una fila en `games` y sus reglas de validación.

---

## Por qué existe esta spec

La SPEC 05 dejó ROCAS jugable, pero el modal de fin de juego solo simula el guardado y todos los rankings salen de `seededScores`. La SPEC 04 ya identifica al jugador (`profiles.username`). En Supabase **no existe todavía ninguna tabla de puntuaciones**: `public` solo tiene `profiles`.

Esta spec crea esa persistencia pensando en varios juegos: una tabla `games` con los juegos conectados, una tabla `scores` genérica y un registro de reglas por juego en el código. ROCAS es el primer juego conectado. Los otros 7 siguen con datos mock.

La puntuación la calcula el navegador, así que se puede falsear. Se acepta ese límite. La BD y la acción validan un rango genérico, y cada juego añade su validación de plausibilidad en el servidor.

Retoma la persistencia que la SPEC 05 dejó fuera (la primera versión de la SPEC 05, juego + Supabase, se descartó y ya no está en `specs/`).

---

## Alcance

**Entra:**

- **Base de datos** (migración versionada `create_games_and_scores`, aplicada con el MCP):
  - tabla `public.games`, solo con los juegos conectados, con la fila inicial `rocas`;
  - tabla `public.scores`, genérica, con FK a `games` y a `profiles`;
  - vista `public.leaderboard` con la mejor puntuación de cada jugador por juego;
  - RLS: lectura pública e insert solo propio y autenticado;
  - tipos regenerados en `lib/supabase/database.types.ts`;
  - `get_advisors` (security y performance) después de la migración.
- **Registro de reglas** `lib/scoring.ts`: mapa `SCORE_RULES` de `gameId` a validador de plausibilidad, y `isConnected(gameId)`. En el código, un juego está conectado si tiene entrada en `SCORE_RULES`. Para guardar, además debe existir en `games` (FK).
- **Motor de ROCAS** (`lib/asteroids/engine.ts`):
  - `onGameOver` pasa a recibir `AsteroidsResult` (`score`, `level`, `durationMs`) en vez de solo `score`;
  - `end()` (botón FIN) ahora también llama a `onGameOver`, una sola vez por partida;
  - el motor cuenta `durationMs`: la suma de los `dt` (ya capados a 50 ms) mientras la fase es `playing` o `dead`, sin contar `ready` ni la pausa.
  - La física no cambia.
- **Server Action** `saveScore` en `app/games/actions.ts`. Valida el rango genérico y las reglas del juego, y saca el `user_id` de `getClaims()`.
- **Lecturas** en `lib/scores.ts` (`server-only`): `getLeaderboard`, `getPlays` y `getBestScores`.
- **Reproductor** (`components/game-player.tsx` y `components/asteroids-canvas.tsx`):
  - `app/games/[id]/play/page.tsx` pasa a `GamePlayer` las props `username` (de `getCurrentProfile()`, o `null`) y `connected` (`isConnected(game.id)`);
  - el HUD muestra como jugador el username en mayúsculas, o `INVITADO` sin sesión, en todos los juegos;
  - **solo en juegos conectados**, el modal cambia la zona de guardado (ver la tabla de estados) y desaparece el input de iniciales;
  - los juegos no conectados mantienen el modal actual (iniciales y guardado solo visuales).
- **Guardado automático**, una sola vez por partida, cuando el motor llama a `onGameOver` (por vidas a 0 o por FIN). SALIR descarta la partida sin guardar. `JUGAR DE NUEVO` reinicia el estado de guardado.
- **Detalle `/games/[id]`** de un juego conectado:
  - el leaderboard muestra el top 10 real;
  - `Mejor global` es la primera puntuación del top, o `0`;
  - `Partidas` es el número de filas de `scores` del juego, formateado con `toLocaleString("es-ES")`;
  - sin puntuaciones, el leaderboard muestra `SÉ EL PRIMERO EN ENTRAR AL RANKING`.
- **Salón de la Fama**, en la pestaña de un juego conectado: top 12 real. Si hay menos de 3 filas, los puestos vacíos del podio muestran `—`. Sin filas, el podio queda vacío y la tabla muestra `SIN PUNTUACIONES TODAVÍA`.
- **Biblioteca** `/games`: la tarjeta de un juego conectado muestra la mejor puntuación real (`0` si no hay ninguna).
  - `Library` (cliente) recibe un `bests: Record<string, number>` opcional.
  - `app/games/page.tsx` lo carga con un Server Component dentro de un `<Suspense>`. El fallback es `<Library />` sin `bests`, y las tarjetas conectadas muestran `—` mientras carga.
- CSS mínimo en `app/globals.css` para los estados de guardado del modal y los estados vacíos. Se diseña con `/frontend-design` y la estética existente.
- Validación con Playwright MCP y `execute_sql`.

**Fuera de alcance (para specs futuras):**

- Conectar más juegos o portar Tetris y Arkanoid. Esta spec solo deja el mecanismo listo.
- Guardar puntuaciones de invitados.
- Anti-trampas fuerte (simulación en servidor, replays, tokens de partida firmados) y rate limiting propio.
- Mover el catálogo visual (título, portada, descripción) a Supabase. `lib/games.ts` sigue siendo la fuente.
- Caché de rankings (`"use cache"`, `cacheTag`).
- Historial del jugador, perfil público o «mi mejor puntuación».
- Moderar o borrar puntuaciones.
- Cambiar la etiqueta `TECLADO / TÁCTIL`, la descripción de ROCAS o el contador `CRÉDITOS`.
- Datos reales en la home (`app/page.tsx`).
- Tests automatizados, porque no hay test runner.

---

## Modelo de datos

### Base de datos — `supabase/migrations/<version>_create_games_and_scores.sql`

```sql
-- Juegos conectados al leaderboard. El catálogo visual sigue en lib/games.ts.
create table public.games (
  id         text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  created_at timestamptz not null default now()
);

insert into public.games (id) values ('rocas');

alter table public.games enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);
-- Sin insert/update/delete desde la API: los juegos se conectan por migración.

create table public.scores (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  game_id     text not null references public.games (id) on delete restrict,
  score       integer not null check (score > 0 and score <= 10000000),
  level       integer check (level is null or level >= 1),
  duration_ms integer not null check (duration_ms >= 1000),
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
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

- `<version>` es la que devuelven `apply_migration` y `list_migrations`, como en la SPEC 04.
- Para conectar un juego nuevo hace falta una migración `insert into public.games (id) values ('<id>')` y una entrada en `SCORE_RULES`.
- `level` admite `null` para los juegos que no tienen niveles.
- `security_invoker = true` hace que la vista respete el RLS de `scores` y `profiles`.

### Registro de reglas — `lib/scoring.ts`

```ts
export type ScoreSubmission = {
  score: number;
  level: number | null;
  durationMs: number;
};

// true si la partida es plausible para ese juego.
export type ScoreRule = (s: ScoreSubmission) => boolean;

export const SCORE_RULES: Record<string, ScoreRule> = {
  // ROCAS: puntos 20/50/100 → múltiplo de 10; máx. 1500 pts/s (disparo triple:
  // 3 balas × 100 cada 0,2 s); superar un nivel exige ≥ 2080 puntos (4 grandes × 520).
  rocas: ({ score, level, durationMs }) =>
    level !== null &&
    score % 10 === 0 &&
    score <= (durationMs / 1000) * 1500 &&
    level <= 1 + Math.floor(score / 2080),
};

export function isConnected(gameId: string): boolean;
```

### Motor — cambios en `lib/asteroids/engine.ts`

```ts
export type AsteroidsResult = {
  score: number;
  level: number;
  durationMs: number; // entero (Math.round)
};

export type AsteroidsCallbacks = {
  onStats: (stats: AsteroidsStats) => void;
  onPhase: (phase: AsteroidsPhase) => void;
  onGameOver: (result: AsteroidsResult) => void; // una vez por partida: vidas a 0 o end()
};
```

`end()` congela el juego y llama a `onGameOver` si aún no se ha llamado. `AsteroidsCanvas` pasa `onGameOver(result: AsteroidsResult)` al padre.

### Server Action — `app/games/actions.ts`

```ts
export type SaveScoreInput = {
  gameId: string;
  score: number;
  level: number | null;
  durationMs: number;
};

export type SaveScoreErrorCode =
  | "unauthenticated" // getClaims() sin usuario
  | "invalid" // falla una regla genérica o del juego, o un check/FK de la BD
  | "unknown"; // cualquier otro error (se registra con console.error)

export type SaveScoreResult =
  { status: "saved" } | { status: "error"; code: SaveScoreErrorCode };

export async function saveScore(
  input: SaveScoreInput,
): Promise<SaveScoreResult>;
```

Validación en el servidor, antes de insertar:

1. `isConnected(gameId)`.
2. `score`, `durationMs` y `level` (si no es `null`) son enteros finitos.
3. Reglas genéricas, iguales que los `check` de la BD: `0 < score ≤ 10.000.000`, `durationMs ≥ 1000` y `level` `null` o `≥ 1`.
4. `SCORE_RULES[gameId](input)`.
5. `user_id` sale de `getClaims()` en el servidor, nunca del cliente.

Los errores de Postgres `23514` (check) y `23503` (FK, juego sin fila en `games`) se devuelven como `invalid`. El detalle del error nunca llega al cliente.

### Estados del modal en un juego conectado

| Situación                 | Mensaje                                                    | Acción extra     |
| ------------------------- | ---------------------------------------------------------- | ---------------- |
| Sin sesión                | `INICIA SESIÓN PARA GUARDAR TUS PUNTUACIONES`              | botón a `/login` |
| Con sesión y puntuación 0 | `▸ SIN PUNTOS QUE GUARDAR` (no llama al servidor)          | —                |
| Enviando                  | `▸ GUARDANDO…`                                             | —                |
| `saved`                   | `▸ PUNTUACIÓN GUARDADA_`                                   | —                |
| `unauthenticated`         | `[ERR] TU SESIÓN HA CADUCADO. INICIA SESIÓN PARA GUARDAR.` | botón a `/login` |
| `invalid`                 | `[ERR] PUNTUACIÓN RECHAZADA.`                              | —                |
| `unknown`                 | `[ERR] NO SE PUDO GUARDAR.`                                | `REINTENTAR`     |

### Lecturas — `lib/scores.ts` (`server-only`)

```ts
import type { ScoreRow } from "@/lib/games";

// Top N de la vista leaderboard: score desc, created_at asc.
// rank desde 1; name = username en mayúsculas; date = created_at en dd/mm/aaaa (UTC).
export async function getLeaderboard(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]>;

// Número de filas de scores del juego (count exact, head).
export async function getPlays(gameId: string): Promise<number>;

// Mejor puntuación de cada juego conectado (0 si no tiene). Para la biblioteca.
export async function getBestScores(): Promise<Record<string, number>>;
```

- Usan el cliente de servidor de la SPEC 04. Son lecturas dinámicas y siempre van dentro de un `<Suspense>`.
- Si Supabase falla, registran el error con `console.error` y devuelven `[]`, `0` o `{}`. La página muestra el estado vacío en lugar de romperse.
- `Leaderboard` usa `key` = `rank` en lugar de `name`, porque ahora puede haber filas reales y mock con nombres repetidos.

---

## Plan de implementación

1. **Lectura previa.**
   - Leer en `node_modules/next/dist/docs/01-app/` la referencia de Server Actions (`"use server"`) y la guía de Cache Components para lecturas dinámicas dentro de `<Suspense>`.
   - Revisar `app/login/actions.ts` para seguir el mismo patrón de Server Action.
   - Comprobar con `list_tables` que `public` solo tiene `profiles`.
2. **Migración y tipos.**
   - Aplicar la migración del modelo de datos con `apply_migration` (`create_games_and_scores`) y guardar el mismo SQL en `supabase/migrations/<version>_create_games_and_scores.sql`.
   - Ejecutar `get_advisors` (security y performance) y corregir los avisos sobre `games`, `scores` o `leaderboard`.
   - Regenerar `lib/supabase/database.types.ts`.
   - `npm run build` pasa.
3. **Reglas y motor.**
   - Crear `lib/scoring.ts`.
   - Cambiar el motor: `AsteroidsResult`, `durationMs`, y que `end()` llame a `onGameOver`. Adaptar `AsteroidsCanvas` y `GamePlayer` a la nueva firma, todavía sin guardar.
   - Prueba manual: ROCAS se juega igual. FIN y game over abren el modal con la puntuación correcta.
4. **Guardado.**
   - Crear `app/games/actions.ts` con `saveScore`.
   - Pasar `username` y `connected` desde `app/games/[id]/play/page.tsx`.
   - En `GamePlayer`: HUD con el username, zona de guardado de juegos conectados con todos los estados de la tabla, guardado automático con un `ref` como guarda (no en un `useEffect`), y `REINTENTAR` solo con `unknown`.
   - CSS de los estados con `/frontend-design`.
   - Prueba manual: con sesión, una partida crea **una** fila en `scores` (comprobarlo con `execute_sql`).
5. **Lecturas.**
   - Crear `lib/scores.ts`.
   - Usarlo en el detalle (leaderboard, `Mejor global`, `Partidas` y estado vacío), en la pestaña del Salón (podio con `—` y estado vacío) y en la biblioteca (`bests` con `<Suspense>`), solo para juegos conectados.
   - Cambiar la `key` de `Leaderboard` a `rank`.
   - CSS de los estados vacíos.
6. **Validación.** Con `npm run dev` y Playwright MCP, a 1440×900:
   - Estado vacío del detalle, del Salón y de la tarjeta de ROCAS, antes de la primera partida.
   - Sin sesión: FIN en ROCAS muestra `INICIA SESIÓN PARA GUARDAR…` y no crea filas.
   - Con un usuario de prueba:
     - FIN sin puntos muestra `SIN PUNTOS QUE GUARDAR`;
     - una partida con puntos guarda una fila;
     - `JUGAR DE NUEVO` y una segunda partida guardan otra fila;
     - el HUD muestra el username.
   - Llamar a `saveScore` con datos imposibles (`score: 999990, level: 1, durationMs: 1000`): devuelve `invalid` y no crea ninguna fila.
   - Un insert directo con `score: 0` falla por el `check`. Un insert con otro `user_id` falla por RLS. Un insert con `game_id: 'caida'` falla por la FK.
   - Volver a `/games/rocas`, `/hall-of-fame?game=rocas` y `/games`: se ven los datos nuevos sin recargar a mano.
   - `/games/caida/play`, `/games/caida` y la pestaña CAÍDA del Salón se ven igual que antes.
   - Revisar la consola. Borrar las filas de `scores` y los usuarios de prueba al terminar. Ejecutar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] Existe `supabase/migrations/<version>_create_games_and_scores.sql`, y `list_migrations` muestra la misma versión.
- [ ] `public.games` contiene exactamente una fila: `rocas`.
- [ ] `lib/supabase/database.types.ts` incluye `games`, `scores` y la vista `leaderboard`.
- [ ] `get_advisors` (security) no muestra avisos sobre `games`, `scores` ni `leaderboard`.
- [ ] Un usuario autenticado no puede insertar en `scores` con otro `user_id` (RLS), y `anon` no puede insertar.
- [ ] Un insert en `scores` con un `game_id` que no está en `games` falla por la FK.
- [ ] `isConnected("rocas")` es `true` y `isConnected("caida")` es `false`.
- [ ] La física de ROCAS no cambia: las constantes del motor siguen con los mismos valores.
- [ ] FIN a mitad de partida y el game over por vidas llaman a `onGameOver` una sola vez, con `score`, `level` y `durationMs`. `durationMs` no cuenta el tiempo en `ready` ni en pausa.
- [ ] Con sesión y puntuación > 0 en ROCAS, el modal muestra `▸ GUARDANDO…` y después `▸ PUNTUACIÓN GUARDADA_`, y en `scores` aparece **una** fila con el `user_id` del jugador, `game_id = 'rocas'` y el `level` y `duration_ms` de la partida.
- [ ] Con sesión y puntuación 0, el modal muestra `▸ SIN PUNTOS QUE GUARDAR` y no se crea ninguna fila.
- [ ] Sin sesión, el modal muestra `INICIA SESIÓN PARA GUARDAR TUS PUNTUACIONES` con un botón a `/login`, y no se crea ninguna fila.
- [ ] En ROCAS el modal no muestra el input de iniciales.
- [ ] `saveScore` con `score: 999990, level: 1, durationMs: 1000` devuelve `invalid` y no inserta nada.
- [ ] SALIR a mitad de partida no crea ninguna fila.
- [ ] `JUGAR DE NUEVO` reinicia el estado de guardado, y la partida siguiente guarda su propia fila.
- [ ] El HUD muestra el username en mayúsculas con sesión, e `INVITADO` sin ella.
- [ ] `/games/rocas` muestra una sola fila por jugador (su mejor puntuación), de mayor a menor. `Mejor global` y `Partidas` coinciden con la BD.
- [ ] Sin puntuaciones, `/games/rocas` muestra `SÉ EL PRIMERO EN ENTRAR AL RANKING`, `Mejor global` 0 y `Partidas` 0.
- [ ] La pestaña ROCAS de `/hall-of-fame` muestra los datos reales. Con menos de 3 jugadores, los puestos vacíos del podio muestran `—`. Sin datos, la tabla muestra `SIN PUNTUACIONES TODAVÍA`.
- [ ] La tarjeta de ROCAS en `/games` muestra la mejor puntuación real (o `0`).
- [ ] Tras guardar una puntuación, volver a `/games/rocas`, `/hall-of-fame?game=rocas` y `/games` la muestra sin recargar a mano.
- [ ] Los 7 juegos no conectados (reproductor, modal, detalle, pestaña del Salón y tarjeta) se ven igual que antes de esta spec.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/games`, `/games/rocas`, `/games/rocas/play` ni `/hall-of-fame?game=rocas`.
- [ ] Las filas de `scores` y los usuarios de prueba creados durante la validación se han borrado.

---

## Decisiones

- **Sí:** tabla `games` en Supabase, solo con los ids de los juegos conectados y FK desde `scores`. Conectar un juego es una fila, sin rehacer `check`s. La BD rechaza puntuaciones de juegos que no existen.
- **No:** `check (game_id in (...))` como en la primera versión descartada de la SPEC 05. Cada juego nuevo obligaría a reescribir la restricción.
- **No:** mover el catálogo visual a Supabase. `lib/games.ts` sigue siendo la fuente. `games` en la BD es solo la lista de juegos conectados.
- **Sí:** registro `SCORE_RULES` en `lib/scoring.ts` como fuente de «conectado» en el código. La validación de plausibilidad es específica de cada juego y tiene que vivir en algún sitio. Así no hace falta un flag `live` aparte ni una lectura extra de `games`.
- **No:** campo `live` en `lib/games.ts`. Sería un segundo sitio que mantener junto a las reglas.
- **No:** leer `games` de Supabase para decidir qué está conectado. Añade una lectura por página y no aporta nada mientras las reglas vivan en el código.
- **Sí:** validación en dos capas. En la BD y la acción, el rango genérico. En la acción, la plausibilidad de cada juego. Frena las trampas triviales sin meter lógica de un juego en la tabla. Se acepta que no es a prueba de trampas.
- **No:** checks de plausibilidad de ROCAS en la BD. No escalan a varios juegos.
- **Sí:** `scores` genérica (`score`, `level` nullable y `duration_ms`). Cubre ROCAS y la mayoría de arcades sin columnas por juego.
- **Sí:** guardar solo con sesión, automáticamente, con el username de `profiles`. Evita insert anónimo, nombres sin moderar y spam. Se quita el input de iniciales en los juegos conectados.
- **Sí:** guardan el game over y FIN, y SALIR descarta. FIN es terminar y SALIR es abandonar.
- **Sí:** `end()` del motor emite `onGameOver` con el resultado, en lugar de que React reconstruya los datos. El motor es quien conoce `level` y `durationMs`.
- **Sí:** guardado disparado desde `onGameOver` con un `ref` de guarda, no con un `useEffect`. Evita el doble guardado con StrictMode y los re-renders.
- **Sí:** vista `leaderboard` con `distinct on` y `security_invoker`. Da la mejor puntuación por jugador sin RPC y respeta el RLS. En empate gana la más antigua.
- **Sí:** lecturas dinámicas dentro de `<Suspense>`, sin `"use cache"`. Los datos se ven al momento tras guardar y no hay que invalidar nada. Si la carga crece, la caché va en otra spec.
- **Sí:** la biblioteca recibe `bests` de un Server Component en `<Suspense>`, con la `Library` sin datos reales como fallback. La biblioteca sigue siendo cliente y el filtro no cambia.
- **Sí:** el HUD muestra el username en todos los juegos. Es la misma sesión y no cuesta nada.
- **No:** rate limiting propio. Solo hay insert autenticado y ya están los límites de Supabase.

---

## Riesgos

| Riesgo                                                                                  | Mitigación                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Se puede falsear la puntuación llamando a `saveScore` desde la consola.                 | Rango genérico en la BD y plausibilidad por juego en la acción. El riesgo residual se asume y queda documentado.                                                         |
| La plausibilidad de ROCAS rechaza una partida legítima.                                 | Los límites salen del máximo teórico de la referencia. Con `dt` capado, el tiempo contado nunca supera el tiempo simulado. La validación del paso 6 usa partidas reales. |
| Se conecta un juego con regla en `SCORE_RULES` pero sin fila en `games`, o al revés.    | Sin fila, la FK falla y se devuelve `invalid`. Sin regla, `isConnected` es `false` y el juego sigue en mock. La spec documenta que hacen falta las dos piezas.           |
| Guardado doble (StrictMode, varios clics, re-render).                                   | `onGameOver` se llama una vez por partida y el guardado tiene un `ref` de guarda. Un criterio de aceptación comprueba que se crea una sola fila.                         |
| Leer cookies o Supabase fuera de `<Suspense>` rompe el prerender con `cacheComponents`. | Todas las lecturas van dentro de `<Suspense>`, también la nueva de la biblioteca. `npm run build` lo valida.                                                             |
| El router de cliente muestra rankings viejos al volver tras guardar.                    | Las lecturas son dinámicas. Un criterio de aceptación lo comprueba. Si falla, se añade `router.refresh()` tras un `saved`.                                               |
| Una vista sin `security_invoker` se salta el RLS.                                       | Se crea con `security_invoker = true` y se ejecuta `get_advisors`.                                                                                                       |
| Datos de prueba que se quedan en el proyecto remoto.                                    | El paso 6 los borra, y un criterio de aceptación lo comprueba.                                                                                                           |

---

## Lo que **no** entra en esta spec

- Conectar otros juegos (Tetris, Arkanoid, etc.).
- Puntuaciones de invitados.
- Anti-trampas fuerte y rate limiting.
- Catálogo visual en Supabase.
- Caché de rankings.
- Historial y perfil del jugador.
- Moderación o borrado de puntuaciones.
- Datos reales en la home.
- Tests automatizados.

Cada uno de estos puntos, si llega, va en su propia spec.
