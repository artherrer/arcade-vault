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
## Supabase

La app usa Supabase para la autenticación (email y contraseña) y la tabla `public.profiles`.

### Variables de entorno

Crea un archivo `.env.local` en la raíz con:

| Variable                               | Descripción                                                        |
| -------------------------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto (`https://<ref>.supabase.co`).                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key del proyecto (`sb_publishable_…`).                 |

Las dos se encuentran en el dashboard de Supabase, en **Project Settings → API Keys**. Usa solo la publishable key: nunca pongas una secret key (`sb_secret_…`) ni la `service_role` en el proyecto.

### Ajustes del dashboard

Estos ajustes no se pueden cambiar desde el código y hay que hacerlos a mano en **Authentication → Sign In / Providers → Email**:

- **Confirm email:** desactivado. Así el registro inicia sesión al instante.
- **Minimum password length:** `8`.

### Migraciones

Las migraciones SQL están versionadas en `supabase/migrations/`. Los tipos de la base de datos se generan en `lib/supabase/database.types.ts` y se regeneran con cada migración.
