# SPEC 04 — Integración base de Supabase y autenticación con email y contraseña

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-19
> **Objetivo:** Conectar la app a Supabase y convertir `/login` en un registro e inicio de sesión reales con email y contraseña, con un perfil público (`profiles.username`) y la sesión visible en la nav.

---

## Por qué existe esta spec

Hasta ahora todo es mock: `lib/games.ts` tiene los datos fijos y `components/login-form.tsx` solo redirige a `/games`. Las siguientes features (puntuaciones, Salón de la Fama real) necesitan saber quién es el jugador. Esta spec pone la base técnica de Supabase (SDK, clientes, proxy de sesión, migraciones versionadas y tipos generados) y la usa para la primera feature real: la autenticación.

El proyecto Supabase (`smayrjdsljptftvxasxs`, ya conectado por MCP en `.mcp.json`) está vacío: no hay tablas en `public` ni usuarios.

Con `cacheComponents` activo, leer la sesión es una lectura en tiempo de petición. Por eso la parte de la nav que depende de la sesión va detrás de un `<Suspense>` (ver `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`).

---

## Alcance

**Entra:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`, obtenidas con el MCP (`get_project_url`, `get_publishable_keys`). Se documentan en `README.md`, en español.
- Cliente de servidor `lib/supabase/server.ts` (`createServerClient` de `@supabase/ssr` con `cookies()` de `next/headers`, `import "server-only"`).
- `proxy.ts` en la raíz, que:
  - refresca la sesión de Supabase en cada petición (lee y reescribe las cookies);
  - redirige `/login` a `/games` si hay sesión.
- Migración versionada en `supabase/migrations/` que crea `public.profiles`, sus políticas RLS y el trigger que crea el perfil al registrarse. Se aplica con el MCP (`apply_migration`).
- Tipos generados en `lib/supabase/database.types.ts` (MCP `generate_typescript_types`). El cliente de servidor se tipa con `Database`.
- `lib/auth.ts` (`server-only`) con `getCurrentProfile()`, envuelto en `cache` de React para no repetir la consulta en una misma petición.
- Server Actions en `app/login/actions.ts`: `signIn`, `signUp` y `signOut`.
- Cambios en `components/login-form.tsx`:
  - **INICIAR SESIÓN:** campos Correo electrónico + Contraseña (el campo Usuario desaparece de este tab).
  - **CREAR CUENTA:** campos Usuario + Correo electrónico + Contraseña.
  - El botón principal llama a `signIn` o `signUp` según el tab, con `useActionState`.
  - **Enviando:** el botón muestra `▶  CONECTANDO…` y queda deshabilitado.
  - **Error:** una línea roja estilo terminal bajo el botón (`[ERR] …`, mensajes en la tabla del modelo de datos) y la animación `shake` (400 ms) en `.auth-card`. Los campos conservan lo escrito.
  - **Éxito:** redirección a `/games`, con la nav ya actualizada.
  - `JUGAR COMO INVITADO` sigue yendo a `/games` sin sesión.
  - Los botones GOOGLE y GITHUB siguen siendo solo visuales.
- Nav (`components/nav.tsx` + nuevo `components/nav-account.tsx`, Server Component):
  - **Sin sesión:** el botón `Iniciar Sesión` de siempre, en escritorio y en el panel móvil.
  - **Con sesión:** el username en mayúsculas (`▸ PX_KAI`) y un botón `SALIR`, que es un `<form action={signOut}>`. Se muestra en escritorio y en el panel móvil.
  - `NavAccount` se renderiza dentro de `<Suspense>` con un placeholder del mismo tamaño, para no mostrar «Iniciar Sesión» un instante a un usuario con sesión.
- CSS nuevo en `app/globals.css`, solo lo mínimo: `.auth-error`, `@keyframes shake` / `.auth-card.shake` (si no existen ya) y el chip de usuario de la nav. El diseño de estas piezas se hace con el skill `/frontend-design`, siguiendo la estética existente.
- Configuración de Supabase Auth en el dashboard (el MCP no puede cambiarla): desactivar **Confirm email** y fijar la longitud mínima de contraseña en **8**. Se documenta en `README.md`.
- Comprobación de los advisors de seguridad de Supabase (MCP `get_advisors`) tras la migración.
- Validación con Playwright MCP de los flujos de registro, login, logout y errores.

**Fuera de alcance (para specs futuras):**

- OAuth con Google o GitHub (los botones quedan como están).
- Confirmación de email, SMTP propio y plantillas de email.
- Recuperar o cambiar la contraseña.
- Editar el username o borrar la cuenta.
- Login con username.
- Tabla `games`, puntuaciones, Salón de la Fama y leaderboards con datos reales. `lib/games.ts` no cambia.
- Proteger rutas. Jugar sigue siendo posible sin sesión.
- Cliente de Supabase para el navegador (`lib/supabase/client.ts`). En esta spec nada lo usa.
- Stack local con Supabase CLI y Docker.
- Rate limiting propio. Se confía en los límites que Supabase Auth trae por defecto.
- El contador `CRÉDITOS · 03` de la nav sigue siendo fijo.
- Tests automatizados, porque no hay test runner.

---

## Modelo de datos

### Base de datos — `supabase/migrations/<version>_create_profiles.sql`

```sql
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,16}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Los usernames son públicos (los usarán los rankings).
create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);

-- Sin políticas de insert/update/delete: solo el trigger escribe.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- `<version>` es la versión que devuelve `apply_migration` / `list_migrations`, para que el archivo del repo y el historial remoto coincidan.
- Si el username falta, no cumple el `check` o ya existe, el trigger falla y Supabase no crea el usuario. La base de datos es la autoridad final.

### Tipos en `app/login/actions.ts`

```ts
export type AuthErrorCode =
  | "missing" // falta algún campo tras trim()
  | "bad_username" // no cumple ^[a-z0-9_]{3,16}$ (tras pasarlo a minúsculas)
  | "bad_email" // no cumple /^[^\s@]+@[^\s@]+\.[^\s@]+$/ o supera 254 caracteres
  | "short_password" // menos de 8 caracteres o más de 72
  | "username_taken" // ya existe en profiles
  | "email_taken" // Supabase devuelve user_already_exists
  | "invalid_credentials" // Supabase devuelve invalid_credentials
  | "unknown"; // cualquier otro error (se registra con console.error)

export type AuthState =
  { status: "idle" } | { status: "error"; code: AuthErrorCode };

export async function signIn(
  prev: AuthState,
  formData: FormData,
): Promise<AuthState>;
export async function signUp(
  prev: AuthState,
  formData: FormData,
): Promise<AuthState>;
export async function signOut(): Promise<void>;
```

Campos del `FormData`: `email` y `password` (los dos tabs), y `username` (solo CREAR CUENTA).

Mensajes que muestra el formulario:

| Código                | Mensaje                                                 |
| --------------------- | ------------------------------------------------------- |
| `missing`             | `[ERR] COMPLETA TODOS LOS CAMPOS.`                      |
| `bad_username`        | `[ERR] USUARIO: 3–16 CARACTERES, SOLO a-z, 0-9 Y _.`    |
| `bad_email`           | `[ERR] CORREO NO VÁLIDO.`                               |
| `short_password`      | `[ERR] LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES.` |
| `username_taken`      | `[ERR] ESE USUARIO YA ESTÁ EN USO.`                     |
| `email_taken`         | `[ERR] YA EXISTE UNA CUENTA CON ESE CORREO.`            |
| `invalid_credentials` | `[ERR] CORREO O CONTRASEÑA INCORRECTOS.`                |
| `unknown`             | `[ERR] FALLO DEL SISTEMA. INTÉNTALO DE NUEVO.`          |

Reglas de las acciones:

- `signUp` valida los campos en el servidor. Después comprueba en `profiles` si el username ya existe, para devolver `username_taken`. Por último llama a `supabase.auth.signUp({ email, password, options: { data: { username } } })`. Si el trigger falla por una carrera entre dos registros, el resultado es `unknown`.
- `signIn` valida que no falte nada y llama a `supabase.auth.signInWithPassword`.
- Si todo va bien, las dos hacen `revalidatePath("/", "layout")` y `redirect("/games")`.
- `signOut` llama a `supabase.auth.signOut()`, revalida el layout y hace `redirect("/")`.
- El detalle de un error de Supabase nunca llega al cliente. Solo llega el `code`.

### `lib/auth.ts`

```ts
export type CurrentProfile = { id: string; username: string };
export const getCurrentProfile: () => Promise<CurrentProfile | null>; // cache(): getClaims() + select en profiles
```

---

## Plan de implementación

1. **Dependencias y entorno.**
   - `npm install @supabase/supabase-js @supabase/ssr`.
   - Obtener la URL y la publishable key con el MCP y crear `.env.local` (ya ignorado por `.env*`).
   - Documentar en `README.md` las dos variables y los dos ajustes del dashboard (Confirm email desactivado, contraseña mínima de 8).
   - Leer en `node_modules/next/dist/docs/01-app/` las guías `proxy.md`, `authentication.md` y `authentication-with-cache-components.md`, y la referencia de Server Actions / `useActionState`. Buscar la guía de Supabase SSR para Next.js con `search_docs` del MCP.
   - `npm run build` pasa.
2. **Migración.**
   - Comprobar con `list_tables` que `public` sigue vacío.
   - Aplicar la migración del modelo de datos con `apply_migration` (`create_profiles`) y guardar el mismo SQL en `supabase/migrations/<version>_create_profiles.sql`.
   - Ejecutar `get_advisors` (security) y corregir cualquier aviso sobre `profiles` o `handle_new_user`.
3. **Tipos.** Generar `lib/supabase/database.types.ts` con `generate_typescript_types`.
4. **Cliente de servidor y proxy.**
   - Crear `lib/supabase/server.ts`, tipado con `Database`.
   - Crear `proxy.ts`, que refresca la sesión con `getClaims()` y redirige `/login` a `/games` si hay sesión. El `matcher` excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes.
   - Prueba manual: la app navega igual que antes y la consola del servidor no muestra errores.
5. **Server Actions.** Crear `app/login/actions.ts` (`"use server"`) con `signIn`, `signUp` y `signOut`, según el modelo de datos. Crear `lib/auth.ts` con `getCurrentProfile()`.
6. **Formulario.** Conectar `components/login-form.tsx`:
   - un `useActionState` por tab;
   - `formAction` según el tab activo;
   - campos por tab según el Alcance, controlados para que conserven lo escrito;
   - estado de envío, línea `.auth-error` y `shake` ante cada nuevo error.
     Añadir el CSS de `.auth-error` y `shake` (diseñado con `/frontend-design`). Antes, comprobar que `@keyframes shake` no existe ya en `globals.css` (lo puede haber añadido la SPEC 03).
     Prueba manual: registrarse crea el usuario y la fila en `profiles`, y redirige a `/games`.
7. **Nav con sesión.**
   - Crear `components/nav-account.tsx` (Server Component, `getCurrentProfile()`), con una variante para escritorio y otra para el panel móvil.
   - Pasarlo a `Nav` como props (slots), cada uno dentro de `<Suspense>` con su placeholder, desde `app/layout.tsx`.
   - `SALIR` es un `<form action={signOut}>`.
   - Añadir el CSS del chip de usuario (con `/frontend-design`).
   - Prueba manual: con sesión, la nav muestra `▸ USERNAME` y `SALIR`. `SALIR` cierra la sesión y vuelve a `/`.
8. **Validación.** Con `npm run dev` levantado y Playwright MCP, a 1440×900 y a 375×812:
   - registro correcto;
   - registro con username ya usado, con email ya usado, con username inválido y con contraseña corta;
   - login correcto y login con credenciales malas;
   - visitar `/login` con sesión;
   - logout;
   - recargar la página con sesión, que debe mantenerse.
     Revisar la consola. Comprobar en SQL (`execute_sql`) que cada usuario tiene su fila en `profiles`. Borrar los usuarios de prueba al terminar. Ejecutar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr`.
- [ ] `README.md` documenta `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y los ajustes del dashboard (Confirm email desactivado, contraseña mínima de 8).
- [ ] Existe `supabase/migrations/<version>_create_profiles.sql`, y `list_migrations` del MCP muestra la misma versión.
- [ ] `public.profiles` tiene RLS activo, una única política (`select` para `anon` y `authenticated`) y el trigger `on_auth_user_created`.
- [ ] `get_advisors` (security) no muestra avisos sobre `profiles` ni sobre `handle_new_user`.
- [ ] `lib/supabase/database.types.ts` existe e incluye la tabla `profiles`.
- [ ] Registrarse con un usuario `Px_Kai`, un email nuevo y una contraseña de 8 o más caracteres redirige a `/games`. En `auth.users` aparece el usuario y en `profiles` la fila con `username = 'px_kai'`.
- [ ] Tras el registro, la nav muestra `▸ PX_KAI` y `SALIR` en escritorio y en el panel móvil, y no muestra `Iniciar Sesión`.
- [ ] Registrarse con un username ya existente muestra `[ERR] ESE USUARIO YA ESTÁ EN USO.` y no crea ningún usuario en `auth.users`.
- [ ] Registrarse con un email ya existente muestra `[ERR] YA EXISTE UNA CUENTA CON ESE CORREO.`
- [ ] Registrarse con un username `ab` o `px kai` muestra el error `bad_username` y no llama a Supabase Auth.
- [ ] Una contraseña de 7 caracteres muestra `[ERR] LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES.`
- [ ] Iniciar sesión con credenciales correctas redirige a `/games` con la nav actualizada. Con una contraseña incorrecta muestra `[ERR] CORREO O CONTRASEÑA INCORRECTOS.`
- [ ] Cada error aplica `shake` a `.auth-card` y conserva los valores de los campos.
- [ ] Durante el envío, el botón muestra `▶  CONECTANDO…` y está deshabilitado.
- [ ] El tab INICIAR SESIÓN muestra solo Correo y Contraseña. El tab CREAR CUENTA muestra Usuario, Correo y Contraseña.
- [ ] Recargar `/games` con sesión mantiene la sesión.
- [ ] Visitar `/login` con sesión redirige a `/games`.
- [ ] `SALIR` cierra la sesión, redirige a `/` y la nav vuelve a mostrar `Iniciar Sesión`.
- [ ] `JUGAR COMO INVITADO` lleva a `/games` sin crear sesión.
- [ ] Un usuario con sesión no ve `Iniciar Sesión` ni un instante al cargar la página (placeholder de `<Suspense>`).
- [ ] Ninguna clave `service_role` / `sb_secret_` aparece en el repo ni en `.env.local`. Solo se usa la publishable key.
- [ ] A 375px, `/login` no tiene scroll horizontal y el panel móvil muestra el estado de sesión correcto.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/`, `/games` ni `/login`.
- [ ] Los usuarios de prueba creados durante la validación se han borrado.

---

## Decisiones

- **Sí:** esta spec cubre la base técnica y la autenticación. Juegos, puntuaciones y rankings van en specs propias. Cada spec deja la app funcional.
- **Sí:** solo email y contraseña. Encaja con el formulario actual. OAuth necesita apps de GitHub/Google y rutas de callback.
- **Sí:** `public.profiles` con `username` único, creada por un trigger `security definer`. El username es consultable y servirá de base para los rankings.
- **No:** guardar el username solo en `user_metadata`. No se puede consultar desde otras tablas ni garantizar que sea único.
- **Sí:** iniciar sesión con email en los dos tabs. Supabase no inicia sesión con username, y resolverlo exigiría una función que expone emails.
- **Sí:** username de 3 a 16 caracteres `[a-z0-9_]`, guardado en minúsculas, con un `check` en la base de datos y la misma validación en el servidor.
- **Sí:** el username se comprueba antes de llamar a `signUp`, para dar un error claro. La constraint `unique` sigue siendo la autoridad en las carreras.
- **Sí:** Confirm email desactivado. El registro entra al instante y el SMTP incluido en Supabase permite muy pocos emails por hora. La confirmación llegará con SMTP propio en otra spec.
- **Sí:** contraseña mínima de 8 caracteres, configurada en Supabase y validada también en el servidor.
- **Sí:** Server Actions con `useActionState` para `signIn`, `signUp` y `signOut`. Las cookies se escriben en el servidor, no hace falta un cliente de navegador y se sigue el patrón de la SPEC 03.
- **No:** `lib/supabase/client.ts` en esta spec. Nada lo usa todavía. Se crea cuando una feature lo necesite.
- **Sí:** `proxy.ts` para refrescar la sesión y redirigir `/login` con sesión. Es la convención de Next 16 (sustituye a `middleware.ts`) y evita leer cookies en la página.
- **Sí:** `getClaims()` en lugar de `getSession()` en el servidor. Verifica el JWT y no confía en la cookie tal cual.
- **Sí:** publishable key (`sb_publishable_…`) en lugar de la anon key legacy, como recomienda Supabase. No se usa ninguna secret key.
- **Sí:** el estado de sesión de la nav es un Server Component en `<Suspense>`, pasado como slot a la `Nav` cliente. Es el patrón de Cache Components, y la `Nav` sigue siendo cliente por `usePathname`.
- **Sí:** errores en una línea roja `[ERR]` con `shake`. Mantiene la estética de terminal y no hace falta CSS por campo.
- **No:** errores bajo cada campo. Más CSS y más estado para pocos casos.
- **Sí:** las rutas siguen sin protegerse y el modo invitado se mantiene. La protección tendrá sentido cuando existan puntuaciones.
- **Sí:** migraciones SQL versionadas en `supabase/migrations/`, aplicadas con el MCP. Son reproducibles y revisables sin montar el stack local.
- **No:** Supabase CLI con Docker. Es más infraestructura de la que esta spec necesita.
- **Sí:** tipos generados en `lib/supabase/database.types.ts`, que se regeneran con cada migración.

---

## Riesgos

| Riesgo                                                                                                                                                      | Mitigación                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los ajustes de Auth (Confirm email, contraseña mínima) no se pueden cambiar por MCP. Si se olvidan, el registro pide confirmar el email y no inicia sesión. | Se documentan en el README y el paso 1 pide al usuario que los cambie antes de seguir. Un criterio de aceptación comprueba que el registro entra directamente. |
| Si el trigger `handle_new_user` falla, Supabase devuelve un error genérico (`Database error saving new user`).                                              | El username se comprueba antes en el servidor. El caso residual se registra con `console.error` y se muestra como `unknown`.                                   |
| La API de `proxy.ts`, de Server Actions o la integración de `@supabase/ssr` con Next 16.4 y Cache Components pueden diferir de lo conocido.                 | El paso 1 obliga a leer `node_modules/next/dist/docs/` y la documentación de Supabase (`search_docs`) antes de escribir código.                                |
| Leer cookies fuera de un `<Suspense>` rompe el prerender con `cacheComponents`.                                                                             | Solo `NavAccount` lee la sesión en el render, y siempre dentro de `<Suspense>`. La redirección de `/login` vive en el proxy. `npm run build` lo valida.        |
| Después de `signIn` o `signOut`, la nav puede quedarse con el estado anterior.                                                                              | `revalidatePath("/", "layout")` antes de `redirect`. Hay un criterio de aceptación para la nav tras cada acción.                                               |
| Un `@keyframes shake` añadido por la SPEC 03 puede chocar con el de esta spec.                                                                              | Buscarlo en `globals.css` antes de añadirlo. Si existe, se reutiliza.                                                                                          |
| Desajuste entre el archivo de migración y el historial remoto.                                                                                              | El nombre del archivo usa la versión que devuelve `list_migrations`. Hay un criterio de aceptación que lo comprueba.                                           |
| Los usuarios de prueba se quedan en el proyecto remoto.                                                                                                     | El paso 8 incluye borrarlos, y un criterio de aceptación lo comprueba.                                                                                         |

---

## Lo que **no** entra en esta spec

- OAuth (Google, GitHub).
- Confirmación de email y SMTP propio.
- Recuperar o cambiar la contraseña, editar el username o borrar la cuenta.
- Login con username.
- Juegos, puntuaciones, rankings o Salón de la Fama en Supabase.
- Proteger rutas.
- Cliente de Supabase para el navegador.
- Supabase CLI local.
- Rate limiting propio.
- Tests automatizados.

Cada uno de estos puntos, si llega, va en su propia spec.
