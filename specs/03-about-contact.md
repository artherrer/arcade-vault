# SPEC 03 — Página Acerca de con formulario de contacto vía Resend

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-19
> **Objetivo:** Añadir `/about` con el diseño de `references/resources/templates/home-about/about.jsx` y enviar su formulario de contacto por email con Resend desde una Server Action.

---

## Por qué existe esta spec

La SPEC 02 portó la Home y dejó fuera Acerca de. En la plantilla, el formulario de contacto es solo visual: valida en el cliente y muestra un terminal de éxito. Aquí pasa a enviar un email real con Resend. Es el primer código de servidor con un secreto (`RESEND_API_KEY`) y la primera entrada de datos de usuarios anónimos. Por eso hacen falta validación en servidor, un honeypot y un estado de error que la plantilla no define.

---

## Alcance

**Entra:**

- Ruta `/about` (`app/about/page.tsx`, Server Component) con los textos y el orden de `about.jsx`:
  1. **Hero:** kicker `▸ ACERCA DE`, título `ACERCA DE ARCADE VAULT`, párrafo de misión y `highlight-row` con 3 highlights (HEART magenta, BROWSER cian, PLANT verde) y sus iconos pixel.
  2. **Divisor** `about-divider` con 24 píxeles animados (`.reveal`).
  3. **Contacto** (`.reveal`): intro (`▸ CONTACTO`, `CONTÁCTANOS`, subtítulo, 3 tips con LED) y el formulario.
- Formulario de contacto (`components/contact-form.tsx`, cliente) con los campos NOMBRE, CORREO ELECTRÓNICO y MENSAJE, más un honeypot oculto.
- Estados del formulario:
  - **Edición:** el formulario de la plantilla.
  - **Inválido:** si falta algún campo, la animación `shake` (400 ms) y no se envía nada. Se comprueba en el cliente antes de enviar, y la Server Action repite la comprobación.
  - **Enviando:** el botón muestra `▶  TRANSMITIENDO…` y queda deshabilitado.
  - **Éxito:** el terminal `VAULT-OS // TERMINAL` de la plantilla con `GRACIAS, <NOMBRE>.` y el botón `ENVIAR OTRO MENSAJE`, que vacía el formulario y vuelve a Edición.
  - **Error:** el mismo terminal, con la última línea en rojo, `[ERR] TRANSMISIÓN FALLIDA. INTÉNTALO DE NUEVO EN UNOS MINUTOS.`, y el botón `REINTENTAR`. Ese botón vuelve a Edición y conserva lo escrito.
- Server Action `sendContact` (`app/about/actions.ts`) que:
  - valida en el servidor;
  - descarta el envío en silencio si el honeypot trae contenido;
  - envía el email con el SDK `resend`.
- Email en texto plano:
  - `from` = `CONTACT_FROM_EMAIL`;
  - `to` = `CONTACT_TO_EMAIL`;
  - `replyTo` = correo del usuario;
  - asunto `[ARCADE VAULT] Mensaje de <nombre>`;
  - cuerpo con nombre, correo y mensaje.
- Variables de entorno `RESEND_API_KEY`, `CONTACT_TO_EMAIL` y `CONTACT_FROM_EMAIL`. En desarrollo, `CONTACT_FROM_EMAIL=onboarding@resend.dev`. Se documentan en `README.md`.
- Nav: el enlace «Acerca de» (`/about`) pasa a ser el último enlace en escritorio y en el panel móvil. Está activo solo en `/about`.
- Portar a `app/globals.css` el bloque `/* ===== ABOUT PAGE ===== */` de `home-about/styles.css` sin cambiar las reglas existentes. Añadir una única regla nueva, `.term-body .error`, para la línea de error en rojo con el estilo de `.term-body .success`.
- `HighlightIcon` en `components/home-art.tsx`, junto a `FeatureIcon`.
- Reutilizar `components/reveal-observer.tsx` (SPEC 02) para los `.reveal`.
- Validación visual con Playwright MCP contra `references/resources/templates/home-about/arcade-vault-standalone.html`.

**Fuera de alcance (para specs futuras):**

- Rate limiting, CAPTCHA o Turnstile.
- Dominio propio verificado en Resend. Con `onboarding@resend.dev`, Resend solo entrega al correo de la cuenta de Resend.
- Plantilla HTML del email o `@react-email`.
- Guardar los mensajes en una base de datos.
- Email de confirmación al usuario.
- CSS del bloque `GAMEPAD` y sus variantes de tema.
- Cambios en otras pantallas más allá de la nav.
- Tests automatizados, porque no hay test runner.

---

## Modelo de datos

No hay persistencia. Los únicos tipos nuevos son el estado de la Server Action y los límites de validación, en `app/about/actions.ts`:

```ts
export type ContactState =
  | { status: "idle" }
  | { status: "invalid" }               // faltan campos o no cumplen los límites → shake
  | { status: "sent"; name: string }    // name ya recortado (trim); el terminal lo muestra en mayúsculas
  | { status: "error" };                // falta configuración o Resend devolvió error

const LIMITS = { name: 60, email: 254, msg: 2000 } as const;

export async function sendContact(prev: ContactState, formData: FormData): Promise<ContactState>;
```

Campos del `FormData`: `name`, `email`, `msg` y el honeypot `website`.

Reglas de validación (servidor):

- Los tres campos son obligatorios después de `trim()` y no superan `LIMITS`.
- `email` cumple `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- Si `website` no está vacío, se devuelve `{ status: "sent", name }` sin llamar a Resend, para que un bot no detecte el filtro.
- Si falta alguna variable de entorno o `resend.emails.send` devuelve `error`, se hace `console.error` en el servidor y se devuelve `{ status: "error" }`. El detalle nunca llega al cliente.

Las constantes decorativas (3 highlights y 3 tips) se quedan como datos locales en `app/about/page.tsx`, igual que en la SPEC 02.

---

## Plan de implementación

1. **CSS.** Copiar el bloque ABOUT PAGE de `home-about/styles.css` a `app/globals.css`. Antes de pegar cada selector (sobre todo `.divider`, `@keyframes shake`, `.btn.press`, `.kicker`), comprobar que no existe ya. Añadir `.term-body .error`. `npm run build` pasa.
2. **Iconos.** Añadir `HighlightIcon` (`HEART`, `BROWSER`, `PLANT`) a `components/home-art.tsx`, portado a TSX con atributos válidos (`strokeWidth`, etc.).
3. **Página estática.** Crear `app/about/page.tsx` con `<RevealObserver />`, el hero, el divisor y la intro de contacto. Poner un placeholder donde irá el formulario. Prueba manual: `/about` se ve como la plantilla, salvo el formulario.
4. **Nav.** En `components/nav.tsx`, añadir «Acerca de» como último enlace en escritorio y móvil, con `isAbout = pathname === "/about"`. Prueba manual: el enlace navega y se marca activo.
5. **Formulario visual.** Crear `components/contact-form.tsx` (`"use client"`):
   - inputs controlados como en la plantilla;
   - honeypot `website` oculto con `aria-hidden`, `tabIndex={-1}` y `autoComplete="off"`;
   - `shake` en el cliente si falta algún campo;
   - terminal de éxito y de error.
   El envío todavía no está conectado. Montarlo en `/about`.
6. **Dependencia y entorno.**
   - Ejecutar `npm install resend`.
   - Crear `.env.local` (ya ignorado por `.env*`) con las tres variables.
   - Documentar las variables en `README.md`, en español. Explicar que con `onboarding@resend.dev` solo se entrega al correo de la cuenta de Resend.
   - Leer `node_modules/next/dist/docs/01-app/` sobre Server Actions / `useActionState` antes del paso 7.
7. **Server Action.** Crear `app/about/actions.ts` (`"use server"`) con `sendContact`, según el modelo de datos. Instanciar `new Resend(process.env.RESEND_API_KEY)` dentro de la función, solo si la key existe.
8. **Conectar.** En `contact-form.tsx`, usar `useActionState(sendContact, { status: "idle" })` con `<form action={formAction}>`:
   - `isPending` deshabilita el botón y muestra `▶  TRANSMITIENDO…`;
   - `invalid` dispara `shake`;
   - `sent` y `error` muestran el terminal.
   `ENVIAR OTRO MENSAJE` y `REINTENTAR` vuelven a Edición con un estado local de vista. Solo `ENVIAR OTRO MENSAJE` vacía los campos. Prueba manual: con una key válida, el email llega al buzón de la cuenta de Resend. Con una key inválida, aparece el terminal de error.
9. **Validación con Playwright MCP.** Con `npm run dev` levantado:
   - Abrir `/about` y la página Acerca de del standalone a 1440×900 y a 375×812.
   - Hacer scroll completo, capturar la página completa de ambos y corregir las diferencias.
   - Probar los estados de envío vacío (shake), éxito y error (`RESEND_API_KEY` inválida).
   - Revisar la consola.
   - Ejecutar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] `/about` muestra, en este orden, el hero, el divisor de 24 píxeles y la sección de contacto, con los textos de `about.jsx`.
- [ ] El hero muestra 3 highlights (magenta, cian, verde), cada uno con su icono SVG.
- [ ] Tras hacer scroll hasta el final de `/about`, el divisor y la sección de contacto tienen la clase `in`.
- [ ] La nav muestra «Inicio», «Biblioteca», «Salón de la Fama» y «Acerca de» en escritorio y en el panel móvil.
- [ ] «Acerca de» está activo en `/about` y no lo está en `/`, `/games` ni `/hall-of-fame`.
- [ ] Enviar con cualquier campo vacío aplica `shake` al formulario y no hace ninguna petición de Server Action.
- [ ] Durante el envío, el botón muestra `▶  TRANSMITIENDO…` y está deshabilitado.
- [ ] Con las variables válidas, enviar el formulario muestra el terminal de éxito con `GRACIAS, <NOMBRE EN MAYÚSCULAS>.`. El buzón de la cuenta de Resend recibe un email con el asunto `[ARCADE VAULT] Mensaje de <nombre>` y `Reply-To` igual al correo introducido.
- [ ] `ENVIAR OTRO MENSAJE` vuelve al formulario con los tres campos vacíos.
- [ ] Con `RESEND_API_KEY` inválida o ausente, enviar muestra el terminal con la línea `[ERR] TRANSMISIÓN FALLIDA. INTÉNTALO DE NUEVO EN UNOS MINUTOS.` en rojo, y el servidor registra el error con `console.error`.
- [ ] `REINTENTAR` vuelve al formulario con los tres campos tal como estaban.
- [ ] Un envío con el honeypot `website` relleno muestra éxito y no llega ningún email.
- [ ] Un mensaje de más de 2000 caracteres enviado directamente a la acción devuelve `invalid` y no se envía ningún email.
- [ ] `RESEND_API_KEY` no aparece en ningún bundle cliente (`grep -r "re_" .next/static` no encuentra la key).
- [ ] Las tres variables están documentadas en `README.md`.
- [ ] Las capturas de Playwright de `/about` y del standalone coinciden en layout, colores y textos a 1440px y a 375px.
- [ ] A 375px, `/about` no tiene scroll horizontal y `contact-grid` pasa a una columna.
- [ ] La consola del navegador no muestra errores ni avisos de hidratación en `/about`.

---

## Decisiones

- **Sí:** Server Action con `useActionState`. La API key se queda en el servidor, no hay endpoint público extra y es el patrón nativo de React 19 y Next 16.
- **No:** Route Handler `POST /api/contact`. Añade más código y una superficie HTTP que nadie más consume.
- **Sí:** el destino y el remitente en variables de entorno. Así se cambian sin tocar el código cuando haya un dominio verificado.
- **Sí:** `onboarding@resend.dev` como remitente por ahora. No hay dominio verificado, y la limitación de entrega queda documentada.
- **Sí:** `replyTo` igual al correo del usuario, para que responder desde el buzón le llegue directamente.
- **Sí:** el estado de error como variante del terminal con `REINTENTAR`. Mantiene la estética y no pierde lo escrito.
- **No:** un mensaje de error suelto bajo el botón o un `shake` con texto. El `shake` ya significa «faltan datos», y mezclarlo con un fallo de red confundiría.
- **Sí:** validación en servidor y honeypot. Es la protección mínima para un formulario anónimo, sin infraestructura extra.
- **No:** rate limiting. Con almacenamiento en memoria no funciona en serverless, y uno externo amplía el alcance. Va en otra spec.
- **Sí:** el honeypot responde con éxito falso, para no dar señal al bot.
- **Sí:** email en texto plano, sin `@react-email`. Es un buzón interno y basta.
- **Sí:** inputs controlados, como en la plantilla. React 19 resetea los formularios no controlados tras una action, y eso rompería `REINTENTAR`.
- **Sí:** validación también en el cliente, para mantener el `shake` instantáneo de la plantilla sin esperar al servidor. La del servidor sigue siendo la que manda.
- **Sí:** `HighlightIcon` en `components/home-art.tsx`. Ya es el archivo de iconos pixel y así no se crea uno nuevo para un solo componente.
- **Sí:** la página es un Server Component y solo el formulario es cliente, igual que en la SPEC 02.
- **Sí:** las variables se documentan en `README.md` y no en `.env.example`. `.gitignore` ignora `.env*` y no hace falta tocarlo.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Con `onboarding@resend.dev`, los emails a un `CONTACT_TO_EMAIL` distinto del correo de la cuenta de Resend fallan. | Está documentado en el README. Mientras tanto, `CONTACT_TO_EMAIL` debe ser el correo de la cuenta. El fallo se ve como terminal de error, no como un falso éxito. |
| Spam masivo sin rate limit agota la cuota de Resend. | El honeypot y los límites de longitud lo reducen. El rate limiting queda anotado como spec futura. |
| Fuga de `RESEND_API_KEY` al cliente. | Solo se lee en `actions.ts` (`"use server"`), sin el prefijo `NEXT_PUBLIC_`. Un criterio de aceptación lo comprueba en `.next/static`. |
| Un selector de ABOUT PAGE (`.divider`, `@keyframes shake`, `.btn.press`) choca con uno existente en `globals.css`. | Buscar cada selector antes de pegarlo. Si existe y difiere, se escala al usuario en vez de sobrescribirlo. |
| La API de Server Actions o `useActionState` difiere en Next 16.4. | El paso 6 obliga a leer `node_modules/next/dist/docs/` antes de escribir la acción. |
| Los `.reveal` quedan con `opacity: 0` si el observer falla. | Se reutiliza el `RevealObserver` ya probado en la SPEC 02, y un criterio de aceptación comprueba la clase `in`. |

---

## Lo que **no** entra en esta spec

- Rate limiting, CAPTCHA o Turnstile.
- Dominio verificado en Resend.
- Email HTML o `@react-email`.
- Persistencia de mensajes.
- Email de confirmación al usuario.
- CSS de GAMEPAD.
- Cambios en otras pantallas más allá de la nav.
- Tests automatizados.

Cada uno de estos puntos, si llega, va en su propia spec.
