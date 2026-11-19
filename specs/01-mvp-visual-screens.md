# SPEC 01 — MVP visual de Arcade Vault

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-11-19
> **Objetivo:** Llevar a Next.js App Router las cinco pantallas de `references/resources/templates/` (Biblioteca, Detalle, Reproductor, Acceso y Salón de la Fama) con datos mock y sin ningún juego real.

---

## Por qué existe esta spec

Las plantillas son un SPA en React 18 que se carga con Babel en el navegador y navega guardando estado en el hash de la URL. El proyecto usa Next.js 16 con Cache Components. Esta spec convierte esas pantallas en rutas reales, Server Components por defecto y componentes cliente solo donde hay interacción. Los estilos ya están portados a `app/globals.css` (commit `dac4a63`) y las fuentes ya se cargan con `next/font` en `app/layout.tsx`. No se reescribe CSS.

---

## Alcance

**Entra:**

- Datos mock tipados en `lib/games.ts`, portados de `data.jsx`.
- Navegación global (`Nav`) con enlace activo, contador decorativo `CRÉDITOS · 03`, botón "Iniciar Sesión" y menú móvil (hamburguesa) que se abre y se cierra.
- Footer global `© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`.
- **Biblioteca** (`/`): hero, buscador por título, chips de categoría, grid de tarjetas con efecto tilt y estado "NO HAY RESULTADOS".
- **Detalle** (`/games/[id]`): portada, tags, descripción, stat strip, acciones "JUGAR AHORA" y "VOLVER AL VAULT", y leaderboard mock de 10 filas.
- **Reproductor** (`/games/[id]/play`): HUD (jugador `INVITADO`, puntuación, vidas, nivel), arena CRT decorativa, puntuación simulada que sube sola, PAUSA/REANUDAR con overlay, FIN con modal de fin de juego, JUGAR DE NUEVO y SALIR.
- Modal de fin de juego: input de iniciales (mayúsculas, máx. 10). "GUARDAR PUNTUACIÓN" solo muestra `▸ PUNTUACIÓN GUARDADA_`.
- **Acceso** (`/login`): tabs INICIAR SESIÓN / CREAR CUENTA (CREAR CUENTA añade el campo correo), formulario, "JUGAR COMO INVITADO" y botones GOOGLE/GITHUB sin acción. Enviar el formulario o jugar como invitado redirige a `/`.
- **Salón de la Fama** (`/hall-of-fame?game=<id>`): tabs por juego enlazables con query param, podio top 3 y tabla de 12 filas mock.
- Página 404 temática (`app/not-found.tsx`) para ids de juego inexistentes.

**Fuera de alcance (para specs futuras):**

- Cualquier juego jugable real (canvas, input de teclado, lógica de juego).
- Autenticación real o simulada: nunca hay usuario logueado y no se escribe `av_user` en localStorage.
- Persistencia de puntuaciones: no se escribe `av_scores` en ningún sitio.
- Fila "TU MEJOR MARCA" del Salón de la Fama, porque requiere usuario.
- Backend, base de datos o API routes.
- Reescribir los estilos con utilidades Tailwind.
- Tests automatizados, porque no hay test runner configurado.

---

## Modelo de datos

Todo vive en `lib/games.ts`. Son datos estáticos y no se persisten.

```ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type CategoryFilter = "TODOS" | Category;
export type AccentColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;          // slug usado en la URL: "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;       // clase CSS de portada: "cover-bricks"
  color: AccentColor;
  best: number;
  plays: string;       // ya formateado: "12.4K"
};

export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date "DD/MM/2026"

export const GAMES: Game[];               // los 8 juegos de data.jsx, mismo orden y textos
export const CATEGORIES: CategoryFilter[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export function getGame(id: string): Game | undefined;
export function seededScores(seed: number, count?: number): ScoreRow[]; // mismo algoritmo determinista que data.jsx
```

Convenciones:

- Los números se formatean con `toLocaleString("es-ES")`, igual que en la plantilla.
- Semilla del leaderboard de Detalle: `id.length * 17 + 3`, 10 filas.
- Semilla del Salón de la Fama: `id.length * 23 + 7`, 12 filas.
- `seededScores` es determinista para que servidor y cliente rendericen lo mismo, sin errores de hidratación.

---

## Plan de implementación

1. **Datos.** Crear `lib/games.ts` con los tipos, `GAMES`, `CATEGORIES`, `PLAYERS` (interno), `getGame` y `seededScores`. `npm run build` pasa.
2. **Layout global.** Crear `components/nav.tsx` (`"use client"`, usa `usePathname` para el enlace activo y `useState` para el menú móvil). Los enlaces son `next/link` a `/`, `/hall-of-fame` y `/login`. "Biblioteca" queda activo en `/` y en `/games/*`. Añadir `<Nav />`, `<main className="av-main">` y el footer en `app/layout.tsx`. El footer reemplaza los `style={{}}` inline por utilidades Tailwind. Prueba manual: la nav se ve en `/` y el menú móvil abre y cierra por debajo de 840px.
3. **Biblioteca.** Crear `components/game-card.tsx` (`"use client"`, tilt con `onMouseMove` y `onMouseLeave` sobre un ref; la tarjeta y "JUGAR" navegan a `/games/[id]`) y `components/library.tsx` (`"use client"`, búsqueda y chip de categoría con `useState`, filtro como en la plantilla y estado vacío). Reescribir `app/page.tsx` con hero + `<Library />`. Prueba manual: buscar "rocas" deja 1 tarjeta y el chip PUZZLE deja solo CAÍDA.
4. **Detalle.** Crear `components/leaderboard.tsx` (Server Component, filas con clases `top1`/`top2`/`top3`) y `app/games/[id]/page.tsx`. Este último hace `await params`, llama a `getGame`, usa `notFound()` si no existe y exporta `generateStaticParams` con los 8 ids. Crear `app/not-found.tsx` con texto `GAME OVER · 404` y un enlace "VOLVER AL VAULT" a `/`. Prueba manual: `/games/caida` renderiza y `/games/xxx` muestra la 404.
5. **Reproductor.** Crear `components/game-player.tsx` (`"use client"`, recibe `game`). Tiene un intervalo de 220ms que suma entre 10 y 99 puntos mientras no esté en pausa ni terminado, nivel +1 cuando `score % 2500 < 100`, vidas fijas en 3, overlay EN PAUSA, modal de fin de juego, reinicio y SALIR a `/games/[id]`. Crear `app/games/[id]/play/page.tsx` con `notFound()` y `generateStaticParams`. Prueba manual: la puntuación sube, PAUSA la congela y FIN abre el modal.
6. **Acceso.** Crear `components/login-form.tsx` (`"use client"`, tab `in`/`up`, campos controlados; submit y "JUGAR COMO INVITADO" hacen `router.push("/")`) y `app/login/page.tsx`. Prueba manual: el tab CREAR CUENTA muestra el campo correo y enviar lleva a `/`.
7. **Salón de la Fama.** Crear `app/hall-of-fame/page.tsx`. Lee `searchParams.game` y, si falta o no es válido, usa `GAMES[0].id`. Los tabs son `<Link href="/hall-of-fame?game=<id>">`. Podio (plata, oro, bronce) + tabla con `animationDelay` escalonado. La parte que depende de `searchParams` va dentro de `<Suspense>`, como exige Cache Components. Prueba manual: `/hall-of-fame?game=caida` marca el tab CAÍDA y sobrevive a recargar.
8. **Limpieza.** Sustituir los `style={{}}` inline que queden por utilidades Tailwind con los tokens de `@theme` (`text-ink-faint`, `font-pixel`, etc.). Ejecutar `npm run lint` y `npm run build` sin errores.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] `/` muestra el hero y 8 tarjetas de juego.
- [ ] Escribir "rocas" en el buscador deja exactamente 1 tarjeta (ROCAS).
- [ ] El chip SHOOTER deja exactamente 2 tarjetas (INVASORES y ROCAS).
- [ ] Una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Al pulsar una tarjeta o su botón JUGAR se navega a `/games/<id>`.
- [ ] `/games/bloque-buster` muestra título, descripción larga, stat strip y 10 filas de leaderboard.
- [ ] `/games/no-existe` y `/games/no-existe/play` muestran la 404 temática.
- [ ] En `/games/<id>/play` la puntuación aumenta sola. PAUSA la detiene y muestra "EN PAUSA". REANUDAR la continúa.
- [ ] FIN abre el modal con la puntuación final. GUARDAR PUNTUACIÓN muestra `▸ PUNTUACIÓN GUARDADA_`. JUGAR DE NUEVO pone la puntuación a 0 y el nivel a 01.
- [ ] Tras guardar una puntuación, `localStorage` no tiene las claves `av_scores` ni `av_user`.
- [ ] `/login`: el tab CREAR CUENTA muestra el campo "Correo electrónico", INICIAR SESIÓN lo oculta, y enviar el formulario redirige a `/`.
- [ ] La nav siempre muestra "Iniciar Sesión" y nunca un nombre de usuario.
- [ ] `/hall-of-fame` muestra por defecto el tab BLOQUE BUSTER, un podio de 3 puestos y una tabla de 12 filas.
- [ ] `/hall-of-fame?game=caida` marca el tab CAÍDA como activo tras recargar la página.
- [ ] El enlace activo de la nav es "Biblioteca" en `/` y `/games/*`, y "Salón de la Fama" en `/hall-of-fame`.
- [ ] A 375px de ancho la nav muestra la hamburguesa y el panel móvil abre y cierra.
- [ ] La consola del navegador no muestra errores de hidratación en ninguna ruta.

---

## Decisiones

- **Sí:** rutas reales del App Router (`/`, `/games/[id]`, `/games/[id]/play`, `/login`, `/hall-of-fame`). Dan URLs compartibles y encajan con Next.
- **No:** SPA con estado en el hash como `app.jsx`. Va contra el modelo de Next y rompe el prefetch.
- **Sí:** rutas en inglés. Lo eligió el usuario, aunque la UI está en español.
- **Sí:** reutilizar las clases ya portadas en `app/globals.css`. Da fidelidad máxima y no duplica CSS. Tailwind solo sustituye los estilos inline.
- **No:** reescribir con utilidades Tailwind. Es mucho trabajo con riesgo de diferencias visuales y sin beneficio en un MVP.
- **Sí:** Reproductor con puntuación simulada como en la plantilla. Muestra todos los estados visuales (jugando, pausa, fin) sin implementar un juego.
- **Sí:** Acceso solo visual. No hay sesión mock, así que la nav y el Salón nunca muestran usuario. La autenticación va en su propia spec.
- **No:** sesión mock en `localStorage`. Crearía estado que la spec de auth real tendría que deshacer.
- **Sí:** GUARDAR PUNTUACIÓN solo da feedback visual. La persistencia de puntuaciones va en otra spec.
- **Sí:** datos en `lib/games.ts` tipado. Es una sola fuente, fácil de cambiar después por un backend.
- **No:** JSON en `data/`. Añade una capa sin beneficio todavía.
- **Sí:** componentes compartidos en `components/` en la raíz, importados con `@/components/...`.
- **Sí:** pestaña del Salón en el query param `?game=`. Se puede enlazar y sobrevive a recargar.
- **Sí:** `notFound()` + `app/not-found.tsx` temático para ids inválidos.
- **No:** redirigir a `/` en silencio. El usuario no entiende qué pasó.
- **Sí:** incluir los elementos decorativos (créditos fijos en 03, botones GOOGLE/GITHUB sin acción, menú móvil funcional) para mantener la fidelidad a la plantilla.
- **Sí:** `generateStaticParams` en las rutas de juego, porque los ids son estáticos y conocidos.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Con Cache Components, leer `searchParams` fuera de `<Suspense>` hace fallar el build. | En `/hall-of-fame` el contenido que depende del query param va dentro de `<Suspense>`. Revisar `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` antes de implementar. |
| Desajuste de hidratación si algo aleatorio se renderiza en el servidor. | `seededScores` es determinista. `Math.random()` solo se usa dentro del intervalo cliente del Reproductor. |
| Clases de la plantilla que falten o difieran en `globals.css`. | Compararlas con `references/resources/templates/styles.css` en cada pantalla. Si falta una clase, se añade a `globals.css` sin cambiar las existentes. |
| El tilt de las tarjetas manipula `style.transform` directamente. | Se limita a un ref dentro de `GameCard`, sin estado de React. Es el mismo comportamiento que la plantilla. |

---

## Lo que **no** entra en esta spec

- Juegos jugables reales.
- Autenticación (real o mock) y cualquier estado de usuario.
- Persistencia de puntuaciones y leaderboards reales.
- Fila "TU MEJOR MARCA" en el Salón de la Fama.
- Backend, base de datos o API.
- Tests automatizados.

Cada uno de estos puntos, si llega, va en su propia spec.
