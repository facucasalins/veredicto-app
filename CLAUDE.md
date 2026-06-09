# CLAUDE.md — NUSA APP (repo: veredicto-app)

Contexto para retomar el proyecto. Leé esto antes de tocar nada.

## Qué es

Panel **Next.js 14** (App Router, `"use client"`) que se deploya en **Vercel**. Lee cuentas de
**Meta Ads** vía Marketing API (token de Sistema), arma un veredicto por creativo
(Escalar / Mantener / Pausar / Observación) y tiene encima una capa de IA con **Claude**: un
**analista read-only** ("cerebro") que diagnostica la cuenta, un **generador** (hooks/guion/copy/
ángulos) y un **mapa de hooks probados/sin-probar**. Opcionalmente cruza un **Google Sheet** de
análisis de Gemini y la **facturación de Tienda Nube**. Idioma: **español rioplatense (vos)**,
respuestas concisas.

## Archivos clave

- `lib/meta.js` — cliente Marketing API. `getAccounts()`, `getAds(account, preset, range?)` (range
  `{since,until}` para fechas custom), `getAccountSpend(account, since, until)` (spend a nivel cuenta,
  modo Tienda Nube), **`getAdsetTargeting(account)`** (targeting REAL de cada adset, 1 call paginada)
  y **`getAdStatuses(account)`** (effective_status por ad → activo/pausado).
- `lib/nomenclatura.js` — parser del nombre + armado de filas. `buildRows(ads, audMap?, statusMap?)`
  agrupa por **fingerprint de tiempo** `(HH.MM.SS)`; cada fila: `id`, `ang`, `sec`, `split`, `aud`,
  `hook`, `fmt`, `spend`, `roas`, `cpa`, `ventas`, `activa` (true/false/null), `breakdown` (campaña/
  adset/aud). **`classifyTargeting(adset)`** clasifica la audiencia desde el targeting real
  (Retargeting Hot/Tibio por intención de las audiencias custom, Lookalike+%, Advantage+, Amplio/
  Intereses, Mensajería). `parseAudience(nombre)` queda como **fallback** si no hay targeting.
- `lib/sheet.js` — cruza el Google Sheet (cuenta de servicio, JWT RS256). Cruce por `(HH.MM.SS)` de
  `nuevo_nombre`. `listTabs()`, `enrichWithSheet(rows, tab)`. Degrada: sin tab devuelve `sheet:null`.
- `lib/auth.js` — login por cliente. Cookie firmada HMAC-SHA256 con **Web Crypto** (Edge + Node).
  Usuarios en `APP_USERS`. `authenticate`, `makeSessionToken`, `verifySession`, `canSeeAccount`,
  `authDisabled`.
- `lib/tiendanube.js` — `listStores()` y `getStoreRevenue(name, since, until)`. Header de auth es
  `Authentication: bearer <token>` (NO "Authorization") + `User-Agent` obligatorio.
- `lib/dates.js` — `presetToRange(preset)` → `{since, until}`. Alinea Meta y Tienda Nube al mismo período.
- `middleware.js` — protege las páginas (redirige a `/login`). Las rutas `/api` hacen su propia
  verificación (JSON 401/403) y quedan fuera del matcher.
- `app/page.jsx` — TODO el front en un archivo grande (CSS embebido). Componentes: Cliente, Dash,
  **Analisis** (el cerebro), Hoy, Top, Panel, **Biblioteca** (Tus Ganadores + mapa probado/sin-probar),
  **Generar** (4 tipos + modo Iterar/Explorar). NO reescribir entero; editar quirúrgico.
- `app/api/*` — `accounts` (filtra por sesión), `ads` (insights + targeting + estado en paralelo,
  cruza Sheet), `login`, `logout`, `sheets/tabs`, `tiendanube/{stores,summary}`, `copy` (generador),
  **`analyze`** (cerebro), **`match-hooks`** (cruce de hooks reales vs biblioteca).

Alias de imports: `@/lib/...` (en `jsconfig.json`).

## Features y degradación elegante

Cada feature se activa por env var; si falta, queda apagada y el panel se ve como antes. Se puede
pushear a `main` sin romper prod.

- **Login por cliente** (`APP_USERS`, `SESSION_SECRET`): sin `APP_USERS` el login está DESACTIVADO
  (app abierta). Con usuarios: admin ve todo, el resto solo sus cuentas. Header con usuario + "salir".
- **Tienda Nube** (`TIENDANUBE_STORES`, `TIENDANUBE_UA`): selector 🛒 solo si hay tiendas. Muestra
  banda **Facturación (tienda) vs Inversión (Meta) + MER** (mismo período). El objetivo del mes del
  Dashboard también toma la facturación de la tienda.
- **Audiencias desde targeting real**: la clasificación sale del spec de Meta, no del nombre del
  conjunto (Hot/Tibio por intención de las audiencias). Fallback al nombre si falla.
- **Estado activo/pausado**: cada creativo muestra `⏸ PAUSADA` si su `effective_status` no es ACTIVE.
  El cerebro recibe `ya_pausado` para no recomendar pausar lo ya pausado.
- **Cerebro (`/api/analyze`)**: analista read-only con Claude Sonnet 4.6. Recibe un resumen YA
  CALCULADO (rankings, MER vs ROAS pixel, veredictos, qué sangra, receta, umbral) y devuelve
  diagnóstico + acciones priorizadas. On-demand (botón "Pedir lectura"), grounded, ~2-3¢ por lectura.
- **Generador (`/api/copy`)**: hooks / guion / copy / ángulos desde la receta ganadora, con modo
  **Iterar** (escalar lo que funciona) o **Explorar** (salir de la caja). Sonnet 4.6.
- **Biblioteca**: pestaña **★ Tus Ganadores** (hooks reales del cliente top por ROAS, data pura) y
  **mapa probado/sin-probar** (`/api/match-hooks`: Claude cruza tus hooks reales vs los 271 templates).
- **Cruce con Sheet** (`tab`): enriquece cada creativo con la metadata de Gemini.
- **Token Meta vencido**: cartel claro en el panel (antes dropdown vacío silencioso).

## Variables de entorno

`.env.local` (local, en `.gitignore`) y Vercel (prod).

- `META_SYSTEM_TOKEN`, `META_API_VERSION` — Meta Marketing API.
- `GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY` (private_key con `\n`), `SHEET_ID` — Google Sheets.
- `APP_USERS` (JSON `[{u,p,admin?,accounts?}]`), `SESSION_SECRET` — login.
- `TIENDANUBE_STORES` (JSON `[{name,store_id,token,account?}]`), `TIENDANUBE_UA`.
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (`claude-sonnet-4-6`) — generador, cerebro y match-hooks.

**Gotcha Vercel:** cambiar una env var NO redeploya solo → Deployments → último → ⋯ → Redeploy.

## Cómo trabajar

- **NO correr `npm run build` con el dev server (`npm run dev`) corriendo**: pisan el mismo `.next`
  y el browser rompe con "Cannot find module './XXX.js'". Si pasa: `pkill -f "next dev"; rm -rf .next;
  npm run dev`. Para verificar build, bajá el dev primero.
- El usuario a veces edita en **GitHub web**: chequeá `git fetch`/`git status` antes de editar.

## Pendientes / roadmap

- **TikTok Ads**: misma estructura que Meta (otro `lib/tiktok.js` + auth). Le da al cerebro visión
  cross-plataforma.
- **Snapshots históricos + GA4**: para que el cerebro razone sobre tendencia y causas full-funnel.
- **Refresh del token de Meta**: regenerarlo como **"Sin vencimiento"** en Meta Business → Usuarios
  del sistema (evita el bajón de los ~60 días).
- Sumar más tiendas/usuarios a medida que entren clientes. Eventual: hashear passwords.
