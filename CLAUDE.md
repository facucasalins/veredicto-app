# CLAUDE.md — NUSA APP (repo: veredicto-app)

Contexto para retomar el proyecto. Leé esto antes de tocar nada.

## Qué es

Panel **Next.js 14** (App Router, `"use client"`) que se deploya en **Vercel**. Lee cuentas de
**Meta Ads** vía Marketing API (token de Sistema) y arma un veredicto por creativo
(Escalar / Mantener / Pausar / Observación). Opcionalmente cruza un **Google Sheet** de análisis
de Gemini y la **facturación de Tienda Nube**. El idioma del proyecto y de la comunicación es
**español rioplatense (vos)**, respuestas concisas.

## Archivos clave

- `lib/meta.js` — cliente Marketing API: `getAccounts()`, `getAds(accountId, datePreset)` y
  `getAccountSpend(accountId, since, until)` (spend a nivel cuenta para el modo Tienda Nube).
- `lib/nomenclatura.js` — parsea el nombre del anuncio y arma las filas. `buildRows(ads)` agrupa el
  mismo creativo por **fingerprint de tiempo** `(HH.MM.SS)`; cada fila tiene `id` = fingerprint
  (`"concepto (HH.MM.SS)"`), `ang`, `sec`, `split`, `aud`, `hook`, `fmt`, `spend`, `roas`, `cpa`, `ventas`.
- `lib/sheet.js` — cruza el Google Sheet (cuenta de servicio, JWT RS256 con `crypto`). Cruce por el
  token `(HH.MM.SS)` de la columna `nuevo_nombre`. `listTabs()` y `enrichWithSheet(rows, tabName)`.
  Degrada elegante: sin tab o si falla, devuelve filas con `sheet: null`.
- `lib/auth.js` — login por cliente. Cookie firmada HMAC-SHA256 con **Web Crypto** (sirve en Edge y
  Node, sin deps ni `import crypto`). Usuarios en env `APP_USERS`. Helpers: `authenticate`,
  `makeSessionToken`, `verifySession`, `canSeeAccount`, `authDisabled`.
- `lib/tiendanube.js` — cliente Tienda Nube. `listStores()` (solo etiquetas, nunca tokens) y
  `getStoreRevenue(name, since, until)` (pagina órdenes, suma facturación). Header de auth es
  `Authentication: bearer <token>` (ojo, NO "Authorization") + `User-Agent` obligatorio.
- `lib/dates.js` — `presetToRange(preset)` → `{since, until}`. Alinea el rango de Meta y Tienda Nube
  para que facturación e inversión sean comparables sobre el mismo período.
- `middleware.js` — protege las páginas (redirige a `/login` si no hay sesión válida). Las rutas
  `/api` quedan fuera del matcher y hacen su propia verificación (devuelven JSON 401/403).
- `app/page.jsx` — TODO el front en un solo archivo grande (CSS embebido + componentes
  Cliente/Dash/Hoy/Top/Panel/Biblioteca/Generar). NO reescribir entero; editar quirúrgico.
- `app/login/page.jsx` — formulario de login.
- `app/api/*` — `accounts` (filtra por sesión), `ads` (autoriza cuenta + cruza Sheet), `login`,
  `logout`, `sheets/tabs`, `tiendanube/stores`, `tiendanube/summary`, `copy`.

Convención de imports: alias `@/lib/...` (configurado en `jsconfig.json`).

## Features y degradación elegante

Cada feature se activa por env var; si la var no está, la feature queda apagada y el panel se ve
como antes. Esto permite pushear a `main` sin romper prod (las features prenden recién al cargar la
env var en Vercel + Redeploy).

- **Login por cliente** (`APP_USERS`, `SESSION_SECRET`): sin `APP_USERS` el login está DESACTIVADO y
  la app queda abierta (comportamiento default). Con usuarios: admin ve todas las cuentas; el resto
  solo las de su lista `accounts`. El header muestra usuario + botón "salir".
- **Tienda Nube** (`TIENDANUBE_STORES`, `TIENDANUBE_UA`): el selector 🛒 SOLO aparece si hay tiendas
  configuradas. Al elegir una, aparece una banda arriba con **Facturación (tienda) vs Inversión
  (Meta) + MER** (facturación ÷ inversión, mismo período). El MER capta venta que el pixel no
  atribuye — clave para clientes con objetivo mensajes / no-pixel.
- **Cruce con Sheet** (`tab` en el selector "pestaña sheet"): enriquece cada creativo con la
  metadata de Gemini.
- **Token Meta vencido**: el panel muestra un cartel claro (antes era un dropdown vacío silencioso).

## Variables de entorno

`.env.local` (local) y Vercel (prod). `.env.local` está en `.gitignore`.

- `META_SYSTEM_TOKEN`, `META_API_VERSION` — Meta Marketing API.
- `GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY` (private_key con `\n` literales), `SHEET_ID` — Google Sheets.
- `APP_USERS` — JSON: `[{ "u":"facu","p":"clave","admin":true },
  { "u":"juani","p":"clave","accounts":["1097898049077633"] }]`.
- `SESSION_SECRET` — string largo aleatorio para firmar la cookie de sesión.
- `TIENDANUBE_STORES` — JSON: `[{ "name":"Juanita Shoes","store_id":"469424","token":"xxx",
  "account":"1097898049077633" }]`.
- `TIENDANUBE_UA` — User-Agent para Tienda Nube (default: `NUSA App (permutas.dev@gmail.com)`).

**Gotcha Vercel:** cambiar una env var NO redeploya solo → Deployments → último → ⋯ → Redeploy.

## Cómo trabajar

- **NO correr `npm run build` con el dev server (`npm run dev`) corriendo**: pisan el mismo `.next`
  y el browser rompe con "Cannot find module './XXX.js'". Si pasa: `pkill -f "next dev"; rm -rf .next;
  npm run dev`. Para verificar build, bajá el dev primero.
- El usuario a veces edita archivos en **GitHub web**: chequeá `git fetch` / `git status` antes de
  editar para no desfasarte de `origin/main`.

## Pendientes más adelante

- **Refresh del token de Meta**: el robusto es regenerarlo como **"Sin vencimiento"** en Meta
  Business → Usuarios del sistema (evita el bajón de los ~60 días). Automatización con cron + KV
  quedó descartada por frágil/sobrada en Vercel Hobby.
- Sumar más tiendas a `TIENDANUBE_STORES` a medida que entren clientes con Tienda Nube.
- Cargar usuarios reales en `APP_USERS` para prender el login por cliente.
- Eventual: hashear passwords (hoy van en texto plano en la env, herramienta interna).
