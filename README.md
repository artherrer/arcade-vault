## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```
## Variables de entorno

El formulario de contacto de `/about` envía los mensajes por email con [Resend](https://resend.com). Crea un archivo `.env.local` en la raíz (está ignorado por git) con:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxx          # API key de Resend (solo servidor, nunca NEXT_PUBLIC_)
CONTACT_TO_EMAIL=tu-correo@ejemplo.com  # buzón que recibe los mensajes
CONTACT_FROM_EMAIL=onboarding@resend.dev # remitente
```

Mientras no haya un dominio verificado en Resend, el remitente es `onboarding@resend.dev`. Con ese remitente Resend **solo entrega al correo de tu cuenta de Resend**, así que `CONTACT_TO_EMAIL` debe ser ese correo. Si falta alguna variable, el formulario muestra el terminal de error y el servidor registra el motivo en consola.
