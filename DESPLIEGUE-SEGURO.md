# Despliegue seguro — AHIVOYAPP

Guía corta para desplegar la app en Vercel sin filtrar claves ni dejar el
endpoint de IA abierto al abuso.

## 1. Variables de entorno (Vercel → Settings → Environment Variables)

Configura estas tres. Sin ellas la app no funciona en producción.

| Variable | ¿Pública? | De dónde sale |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí (va al navegador) | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí (va al navegador) | Supabase → Project Settings → API |
| `GEMINI_API_KEY` | **NO — solo servidor** | Google AI Studio → Get API key |

> ⚠️ **La clave de Gemini nunca debe llevar el prefijo `NEXT_PUBLIC_`.** Ese
> prefijo hace que Next.js la incruste en el JavaScript del navegador, donde
> cualquiera podría leerla. `GEMINI_API_KEY` solo se usa en el servidor
> (`src/app/api/analyze/route.ts`) y ahí debe quedarse.

Opcional: `GEMINI_MODEL` para fijar un modelo específico (por defecto la app
prueba varios en cadena si uno se agota).

## 2. Activar RLS en Supabase (CRÍTICO)

La `ANON_KEY` es pública **a propósito** — es segura únicamente si Row Level
Security (RLS) está activo, porque RLS es lo que impide que un usuario vea o
toque los datos de otro.

- Ejecuta `supabase/schema.sql` completo en Supabase → SQL Editor → Run.
  Ese script crea las tablas y **activa RLS con políticas `auth.uid()`** en
  todas ellas (perfil, comidas, agua, peso, sueño, entrenamientos, etc.).
- Para confirmarlo: Supabase → Table Editor → cada tabla debe mostrar el
  candado "RLS enabled". Si alguna aparece sin RLS, vuelve a correr el script.

## 3. Secretos y git

- `.env.local` está en `.gitignore` (`.env*`). **Nunca** lo subas al repo.
- El único archivo de entorno versionado es `.env.local.example`, que es una
  plantilla vacía (sin valores reales). Está bien que esté en git.
- Si alguna vez expones una clave por error: rótala de inmediato (genera una
  nueva en Google AI Studio / Supabase) — cambiarla invalida la filtrada.

## 4. Protección del endpoint de IA (ya implementada en el código)

`/api/analyze` es el único endpoint que gasta la cuota de Gemini. Está
protegido para que nadie externo pueda abusarlo:

- **Autenticación**: exige un token de sesión de Supabase válido. El cliente
  lo adjunta (`Authorization: Bearer`) y el servidor lo verifica con
  `auth.getUser` antes de llamar a Gemini. Sin token o con token inválido
  responde `401`.
- **Rate limit**: 30 análisis por minuto y por usuario (best-effort en
  memoria; para un límite estricto multi-instancia se podría usar Upstash
  Redis más adelante).
- **Límites de tamaño**: como red de seguridad contra payloads maliciosos.
  Los usuarios normales no los alcanzan porque la app **comprime las fotos**
  automáticamente en el navegador antes de enviarlas (se reducen a ~1600px de
  lado y unos cientos de KB), así se puede subir cualquier foto del celular
  sin ver "imagen demasiado grande".
- **Validación** del `mode` recibido del cliente.

## 5. Pasos de despliegue

1. `git push` a la rama conectada con Vercel (normalmente `main`).
2. En Vercel, confirma que las 3 variables de entorno estén configuradas
   (Production, Preview y Development si vas a usar previews).
3. Verifica que `supabase/schema.sql` ya se corrió en tu proyecto de Supabase
   (RLS activo).
4. Deploy. Prueba: registro de usuario → escanear una comida → chat con el
   coach. Si el escaneo responde, Gemini está bien conectado.

## Checklist rápido antes de publicar

- [ ] `GEMINI_API_KEY` configurada **sin** `NEXT_PUBLIC_`.
- [ ] Las dos variables `NEXT_PUBLIC_SUPABASE_*` configuradas.
- [ ] `schema.sql` ejecutado → RLS activo en todas las tablas.
- [ ] `.env.local` NO está en el repo (verifica con `git ls-files | grep env`).
- [ ] Probaste registro + escaneo + coach en la URL de producción.
