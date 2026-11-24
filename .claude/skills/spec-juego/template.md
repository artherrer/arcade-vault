# Plantilla de spec de juego jugable + leaderboard

Forma que debe respetar la spec que genera `/spec-juego`. **No es texto para copiar**: cada bloque indica qué va y cómo de concreto debe ser. Los ejemplos reales son `specs/05-rocas-asteroids-jugable.md` y `specs/06-leaderboard-supabase.md`.

Reglas globales: una idea por frase, nombres concretos (rutas, tipos, strings exactos), sin TODOs, sin funciones completas (solo tipos, SQL y snippets cortos), markdown estándar.

---

## Cabecera

```markdown
# SPEC NN — <TÍTULO> jugable: <port de X | juego nuevo> conectado al leaderboard

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06[, SPEC de juego anterior]
> **Fecha:** AAAA-MM-DD
> **Objetivo:** Una frase: qué juego pasa a ser jugable en `/games/<id>/play` y que guarda sus puntuaciones.
```

## Por qué existe esta spec

- Qué juego es, de dónde sale (carpeta de `references/started-games/` o diseño propio) y qué entrada del catálogo usa.
- Resumen de la referencia: tamaño del canvas, bucle y `dt`, clases/módulos, globales, controles.
- Si esta spec generaliza `GamePlayer` (segundo juego real), decirlo aquí y por qué.

## Alcance

**Entra:**

- **Generalización** (solo si hace falta): tipos compartidos, registro de arenas, overlay de inicio compartido. ROCAS no cambia de comportamiento.
- **Motor** `lib/<id>/engine.ts`: qué se conserva de la referencia (constantes por nombre, reglas, fases) y lista de cambios respecto a ella (estado en instancia, `ready`, sin HUD en canvas, `end`/`destroy`, teclado, `dpr`, teclas reasignadas).
- **Arena** `components/<id>-canvas.tsx`: props, overlay de inicio con su texto exacto y leyenda de controles, aviso táctil.
- **`GamePlayer`**: entrada en el registro (o rama), stats del HUD y cómo se muestran los que no aplican.
- **Catálogo** `lib/games.ts`: entrada reutilizada o nueva (con portada `cover-<id>`).
- **Conexión**: migración `connect_<id>` y regla en `SCORE_RULES`.
- **Assets** copiados a `public/<id>/` (si hay).
- **CSS** mínimo con `/frontend-design`.
- Validación con Playwright MCP y `execute_sql`.

**Fuera de alcance (para specs futuras):** sonido, táctil/gamepad, cambios de física o balance, mecánicas que no están en la referencia, otros juegos, anti-trampas fuerte, tests automatizados, y lo que haya salido en las preguntas y se haya aplazado.

## Modelo de datos

### Motor — `lib/<id>/engine.ts`

```ts
export type <Nombre>Phase = "ready" | "playing" | /* … */ "gameover";

export type <Nombre>Callbacks = {
  onStats: (stats: GameStats) => void; // solo cuando cambia
  onPhase: (phase: <Nombre>Phase) => void;
  onGameOver: (result: ScoreSubmission) => void; // una vez por partida
};

export function create<Nombre>Game(canvas: HTMLCanvasElement, callbacks: <Nombre>Callbacks): {
  setPaused: (paused: boolean) => void;
  end: () => void;
  destroy: () => void;
};
```

Constantes (port): tabla o lista con **nombre y valor** copiados de la referencia. Mundo lógico `W×H`, `dt` máximo.

Juego desde cero: reglas completas (controles, tabla de puntos, vidas, niveles, condición de fin) y constantes con valores.

### Tipos compartidos y registro (solo si esta spec generaliza)

Tipos con nombres reales y dónde viven, y forma del registro de arenas.

### Conexión — `supabase/migrations/<version>_connect_<id>.sql`

```sql
insert into public.games (id) values ('<id>');
```

### Regla — `lib/scoring.ts`

```ts
// <TÍTULO>: <granularidad>; máx. <N> pts/s (<cálculo desde las constantes>);
// <relación nivel/puntos y su cálculo>.
<id>: ({ score, level, durationMs }) => /* … */,
```

## Plan de implementación

Pasos numerados; cada uno deja el sistema funcionando y es commiteable.

1. **Generalización** (si aplica). Prueba manual: ROCAS se juega igual.
2. **Motor.** Leer la referencia completa, portar, `npm run build` pasa sin importarlo.
3. **Arena + CSS** (con `/frontend-design`).
4. **Integración en `GamePlayer` y catálogo.** Prueba manual: se juega de principio a fin; otro juego mock sigue igual.
5. **Conexión.** `apply_migration` + fichero en `supabase/migrations/`, entrada en `SCORE_RULES`, `get_advisors`. Prueba: una partida con sesión crea **una** fila (`execute_sql`).
6. **Validación.** Playwright MCP a 1440×900 y 375×812 (pasos concretos del juego), datos imposibles a `saveScore` → `invalid`, detalle/Salón/biblioteca muestran el juego, ROCAS intacto, consola limpia, partida manual del usuario hasta el fin natural, borrar filas y usuarios de prueba, `npm run lint` y `npm run build`.

## Criterios de aceptación

Checklist booleana. Mínimo:

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `lib/<id>/engine.ts` no importa React ni `next/*` y no tiene estado mutable de módulo.
- [ ] Las constantes tienen los mismos valores que la referencia (enumeradas).
- [ ] Overlay de inicio visible; el juego no responde hasta la tecla de inicio.
- [ ] Cada acción puntuable suma exactamente lo esperado en el HUD (enumeradas).
- [ ] El canvas no dibuja puntuación, vidas, nivel ni game over.
- [ ] El fin natural de partida abre el modal con la puntuación final; FIN también. `onGameOver` se llama una vez, con `durationMs` sin `ready` ni pausa.
- [ ] Teclas del juego no hacen scroll; `P`/`Escape` pausan; pestaña oculta pausa.
- [ ] `JUGAR DE NUEVO` vuelve a `ready` con el HUD inicial.
- [ ] Sin listeners ni rAF tras salir; una sola instancia con StrictMode.
- [ ] Nítido con `devicePixelRatio` 2; 4:3 a 1440 y 375 px; sin scroll horizontal a 375 px.
- [ ] `public.games` contiene la fila `<id>`; `isConnected("<id>")` es `true`.
- [ ] Con sesión, una partida con puntos crea **una** fila con `game_id = '<id>'`, `level` y `duration_ms` correctos.
- [ ] `saveScore` con datos imposibles para este juego devuelve `invalid` y no inserta.
- [ ] `/games/<id>`, `/hall-of-fame?game=<id>` y `/games` muestran los datos reales.
- [ ] ROCAS y los juegos mock se ven y funcionan igual que antes.
- [ ] Consola sin errores ni avisos de hidratación en `/games/<id>/play`.
- [ ] Filas y usuarios de prueba borrados.

## Decisiones

- Invariantes heredadas que aplican, marcadas «(heredada de SPEC 05/06)».
- Decisiones nuevas con **Sí/No** y razón: catálogo, regla de plausibilidad, HUD, teclas reasignadas, assets, proporción, generalización.

## Riesgos

Tabla `Riesgo | Mitigación`, solo con riesgos no obvios del juego concreto (p. ej. `dt` por frame en la referencia, colisión con `P`/`Escape`, assets que no cargan, regla que rechaza partidas legítimas, fin natural difícil de forzar con Playwright).

## Lo que **no** entra en esta spec

Repetición explícita del fuera de alcance. «Cada uno de estos puntos, si llega, va en su propia spec.»
