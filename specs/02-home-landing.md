# SPEC 02 — Página de inicio (Home) de Arcade Vault

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-19
> **Objetivo:** Sustituir `/` por la landing de `references/resources/templates/home-about/home.jsx` y mover la Biblioteca a `/games`, sin implementar la página Acerca de.

---

## Por qué existe esta spec

La plantilla `home-about` añade dos pantallas nuevas: una landing (Home) y Acerca de. En la SPEC 01, `/` es la Biblioteca. La plantilla trata Home y Biblioteca como pantallas distintas, así que la Biblioteca necesita su propia ruta. Esta spec solo porta la Home. Acerca de va en su propia spec.

El CSS de `home-about/styles.css` es aditivo respecto a `references/resources/templates/styles.css`: no modifica ninguna regla existente, solo añade bloques nuevos. Por eso basta con copiar los bloques de Home a `app/globals.css`.

---

## Alcance

**Entra:**

- Mover la Biblioteca (hero actual + `<Library />`) de `/` a `/games` (`app/games/page.tsx`).
- Nueva Home en `/` (`app/page.tsx`) con las siete secciones de la plantilla, mismos textos y orden:
  1. **Hero:** siluetas pixel flotantes (`FloatingSilhouettes`, 8 SVG), eyebrow `▸ INSERTA UNA MONEDA_`, título en tres líneas, subtítulo, CTAs `▶  EXPLORAR JUEGOS` y `✦  CREAR CUENTA`, e indicador `DESLIZA ▼`.
  2. **// 01 ¿POR QUÉ ARCADE VAULT?:** 4 `feature-card` con iconos pixel (`FeatureIcon`: GAMEPAD, FREE, TROPHY, ROCKET).
  3. **// 02 JUEGOS DISPONIBLES AHORA:** `mini-rail` con los 6 primeros juegos de `GAMES` y el botón `VER TODOS LOS JUEGOS →`.
  4. **Stats:** 3 bloques (`12+ JUEGOS`, `MILES DE PARTIDAS`, `GLOBAL RANKING`).
  5. **// 03 ACTIVIDAD EN VIVO:** ticker `▸ ÚLTIMAS PUNTUACIONES` (7 filas) y `▸ TOP JUGADORES · HOY` (5 filas con barra) con el enlace `VER SALÓN →`.
  6. **// 04 PRECIOS:** tarjeta `JUGADOR VAULT $0 / SIEMPRE` con su lista, botón `EMPEZAR GRATIS →`, sello `FREE PLAY` y 3 FAQ.
  7. **CTA final:** `¿LISTO PARA JUGAR?` + `INSERTAR MONEDA →`.
- Animación de aparición `.reveal` → `.reveal.in` al entrar en viewport (IntersectionObserver, umbral 0.12, se desconecta al desmontar).
- Destinos de la Home:
  - `EXPLORAR JUEGOS`, `VER TODOS LOS JUEGOS →` e `INSERTAR MONEDA →` van a `/games`.
  - `CREAR CUENTA` y `EMPEZAR GRATIS →` van a `/login`, con el tab por defecto.
  - Cada mini-card va a `/games/<id>`.
  - `VER SALÓN →` va a `/hall-of-fame`.
- Nav: añadir el enlace **«Inicio»** (`/`) como primer enlace en desktop y en el panel móvil. El logo lleva a `/`. «Biblioteca» pasa a `/games`.
- Enlace activo: «Inicio» solo en `/`. «Biblioteca» en `/games` y `/games/*`.
- Los enlaces que hoy apuntan a `/` con el sentido de "volver al catálogo" pasan a `/games`:
  - `app/games/[id]/page.tsx` («VOLVER AL VAULT»).
  - `app/not-found.tsx`.
  - `app/hall-of-fame/page.tsx`.
  - `components/game-player.tsx`.
  - `components/login-form.tsx` (submit y «JUGAR COMO INVITADO» hacen `router.push("/games")`).
- Portar a `app/globals.css` solo los bloques `/* ===== HOME PAGE ===== */`, `/* ===== ACTIVITY (leaderboard + ticker) ===== */` y `/* ===== PRICING ===== */` de `references/resources/templates/home-about/styles.css`, sin cambiar las reglas existentes.
- Validación visual con Playwright MCP, comparando la app con `references/resources/templates/home-about/arcade-vault-standalone.html`.

**Fuera de alcance (para specs futuras):**

- Página Acerca de (`about.jsx`), su ruta `/about`, su CSS (`ABOUT PAGE`) y el enlace «Acerca de» de la nav.
- CSS del bloque `GAMEPAD` y sus variantes de tema, porque la Home no lo usa.
- Abrir `/login` directamente en el tab CREAR CUENTA (`?tab=up`).
- Datos reales en ACTIVIDAD EN VIVO y en los stats: siguen siendo textos fijos de la plantilla.
- Añadir juegos para que el contador `12+` sea real.
- Cualquier cambio visual o funcional en Biblioteca, Detalle, Reproductor, Acceso o Salón más allá de sus enlaces.
- Tests automatizados.

---

## Modelo de datos

Esta feature no introduce estructuras de datos persistentes ni cambia `lib/games.ts`. Reutiliza `GAMES` de la SPEC 01 (`GAMES.slice(0, 6)` para el rail).

Los datos decorativos de la Home son constantes locales en `app/page.tsx`, copiados tal cual de `home.jsx`:

```ts
type Feature = { icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET"; title: string; desc: string; color: AccentColor };
type Stat = { n: string; u: string; s: string };                  // { n: "12+", u: "JUEGOS", s: "Y CONTANDO" }
type Tick = { p: string; g: string; s: number; t: string; c: AccentColor }; // 7 filas del ticker
type TopPlayer = { r: number; p: string; s: number };              // 5 filas; barra = 100 - i * 16 (%)
```

Convenciones:

- Los números se formatean con `toLocaleString("es-ES")`, igual que en la SPEC 01.
- Los retardos escalonados de la plantilla (`transitionDelay` de 80ms y 90ms, `animationDelay` de 60ms) y el `width` de `tp-fill` son valores dinámicos por índice. Se quedan como `style` inline.

---

## Plan de implementación

1. **Mover la Biblioteca.** Crear `app/games/page.tsx` con el contenido actual de `app/page.tsx` (hero `av-hero` + `<Library />`). Dejar `app/page.tsx` con un placeholder mínimo. Prueba manual: `/games` se ve igual que la antigua `/`, y el buscador y los chips funcionan.
2. **Enlaces y nav.** En `components/nav.tsx`, añadir «Inicio» (`/`) en desktop y móvil, apuntar «Biblioteca» a `/games` y separar el enlace activo (`isHome = pathname === "/"`, `isLibrary = pathname === "/games" || pathname.startsWith("/games/")`). Cambiar a `/games` los enlaces listados en Alcance (Detalle, 404, Salón, Reproductor, login-form). Prueba manual: «VOLVER AL VAULT» en `/games/caida` lleva a `/games`.
3. **CSS.** Copiar a `app/globals.css` los bloques HOME PAGE, ACTIVITY y PRICING de `home-about/styles.css`. Comprobar que ningún selector choca con uno existente. `npm run build` pasa.
4. **Componentes decorativos.** Crear `components/home-art.tsx` (Server Component) con `FloatingSilhouettes` y `FeatureIcon`, portados a TSX con atributos JSX válidos (`strokeWidth`, etc.).
5. **Reveal.** Crear `components/reveal-observer.tsx` (`"use client"`, no renderiza nada). En `useEffect` observa todos los `.reveal`, añade `in` al intersectar y hace `disconnect` al desmontar.
6. **Home: hero, features y rail.** Reescribir `app/page.tsx` como Server Component con `<RevealObserver />`, el hero, la sección // 01 y la sección // 02. Las mini-cards son `<Link href="/games/<id>" className="mini-card">` y los CTAs son `<Link className="btn …">`. Prueba manual: los CTAs del hero navegan a `/games` y `/login`.
7. **Home: stats, actividad, precios y CTA final.** Añadir las secciones restantes a `app/page.tsx` con las constantes locales del modelo de datos. Prueba manual: `VER SALÓN →` va a `/hall-of-fame` y `INSERTAR MONEDA →` va a `/games`.
8. **Validación con Playwright MCP.** Con `npm run dev` levantado:
   - Abrir `/` y `file://…/references/resources/templates/home-about/arcade-vault-standalone.html` a 1440×900 y a 375×812.
   - Hacer scroll completo para disparar los `.reveal` y tomar capturas de página completa de ambos.
   - Compararlas sección por sección y corregir las diferencias.
   - Revisar la consola de la app en `/`, `/games` y `/games/caida`.
   - Ejecutar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] `/` muestra, en este orden, hero, // 01, // 02, stats, // 03, // 04 y CTA final, con los textos de `home.jsx`.
- [ ] El hero muestra las 8 siluetas pixel y el título `EL ARCADE / CLÁSICO ESTÁ / DE VUELTA`.
- [ ] La sección // 01 tiene 4 tarjetas, cada una con su icono SVG.
- [ ] La sección // 02 tiene exactamente 6 mini-cards (los 6 primeros de `GAMES`).
- [ ] Pulsar una mini-card navega a `/games/<id>` de ese juego.
- [ ] `EXPLORAR JUEGOS`, `VER TODOS LOS JUEGOS →` e `INSERTAR MONEDA →` navegan a `/games`.
- [ ] `CREAR CUENTA` y `EMPEZAR GRATIS →` navegan a `/login`.
- [ ] `VER SALÓN →` navega a `/hall-of-fame`.
- [ ] El ticker tiene 7 filas y TOP JUGADORES tiene 5 filas, con los puntos formateados en `es-ES` (p. ej. `312.840`).
- [ ] Tras hacer scroll hasta el final de `/`, todas las secciones `.reveal` tienen la clase `in`.
- [ ] `/games` muestra el hero `ARCADE VAULT`, el buscador, los chips y 8 tarjetas. Escribir "rocas" deja 1 tarjeta.
- [ ] La nav muestra «Inicio», «Biblioteca» y «Salón de la Fama», y no muestra «Acerca de».
- [ ] El enlace activo es «Inicio» en `/` y «Biblioteca» en `/games` y `/games/bloque-buster`.
- [ ] El logo navega a `/`.
- [ ] «VOLVER AL VAULT» en `/games/bloque-buster` y en `/games/no-existe` (404) navega a `/games`.
- [ ] Enviar el formulario de `/login` o pulsar «JUGAR COMO INVITADO» redirige a `/games`.
- [ ] No existe la ruta `/about` (devuelve la 404 temática).
- [ ] Las capturas de Playwright de `/` y del template standalone coinciden en layout, colores y textos a 1440px y a 375px.
- [ ] A 375px la Home no tiene scroll horizontal y el panel móvil de la nav incluye «Inicio».
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/` ni en `/games`.

---

## Decisiones

- **Sí:** Home en `/` y Biblioteca en `/games`. Encaja con las rutas en inglés de la SPEC 01, donde `/games/[id]` ya existe.
- **No:** Biblioteca en `/library`. Duplicaría el prefijo de juego en dos rutas.
- **No:** Home en `/home`. La landing debe ser la entrada principal.
- **Sí:** los enlaces de "volver al catálogo" y la redirección del login van a `/games`. Conservan su significado actual.
- **Sí:** añadir solo «Inicio» a la nav. «Acerca de» llegará con su spec, así que no hay enlaces rotos.
- **No:** añadir «Acerca de» apuntando a una 404.
- **Sí:** portar solo los bloques CSS HOME PAGE, ACTIVITY y PRICING. ABOUT y GAMEPAD no se usan en la Home.
- **Sí:** `app/page.tsx` como Server Component. La única interactividad es el reveal, aislado en `components/reveal-observer.tsx`.
- **No:** convertir toda la Home en `"use client"` como en la plantilla. Enviaría JS innecesario al cliente.
- **Sí:** `<Link>` con clases `btn` en lugar de `<button onClick={navigate}>`. Da prefetch y URLs reales, igual que en la SPEC 01.
- **Sí:** datos decorativos (ticker, top, stats, FAQ) como constantes locales en `app/page.tsx`. Son textos de marketing y no pertenecen a `lib/games.ts`.
- **Sí:** `CREAR CUENTA` va a `/login` sin cambiar de tab. Así no se toca el formulario ni hace falta Suspense por `searchParams`.
- **Sí:** `style` inline solo para los retardos y anchos que dependen del índice. Las utilidades de Tailwind no expresan bien valores calculados.
- **Sí:** validación visual con Playwright MCP contra el template standalone, a dos anchos. El usuario lo pidió, y no hay test runner.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los `.reveal` empiezan con `opacity: 0`. Si el observer falla o no hay JS, el contenido queda invisible. | El observer se monta en la propia página. Las capturas de Playwright se toman tras hacer scroll completo. El criterio de aceptación comprueba que todas las secciones tienen `in`. |
| `transitionDelay` inline o `toLocaleString` pueden provocar desajustes de hidratación. | Los valores son deterministas, igual que en la SPEC 01. La consola se revisa con Playwright. |
| Algún enlace a `/` con el sentido de "catálogo" puede quedar sin cambiar. | Antes de cerrar, ejecutar `grep -rn 'href="/"\|push("/")' app components`. Solo deben quedar el logo y «Inicio». |
| Un selector nuevo de la plantilla puede chocar con uno existente en `globals.css` (p. ej. `.section-title`, `.kicker`, `.lb-link`). | Buscar cada selector antes de pegarlo. Si existe y difiere, se escala al usuario en vez de sobrescribirlo. |
| El template standalone puede no abrir en la Home por defecto. | Navegar dentro del template a Inicio con el logo o con el enlace «Inicio» antes de capturar. |

---

## Lo que **no** entra en esta spec

- Página Acerca de, ruta `/about` y enlace «Acerca de» en la nav.
- CSS de ABOUT y GAMEPAD.
- `/login?tab=up`.
- Datos reales en actividad, ranking o stats.
- Cambios en otras pantallas más allá de sus enlaces.
- Tests automatizados.

Cada uno de estos puntos, si llega, va en su propia spec.
