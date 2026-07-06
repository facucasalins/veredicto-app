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
  modo Tienda Nube), **`getAdsetTargeting(account)`** (targeting REAL de cada adset + objetivo
  declarado `optimization_goal`/`promoted_object`, 1 call paginada),
  **`getAdStatuses(account)`** (estado de entrega por ad mirando la CADENA completa: pide el
  effective_status del ad + del adset + de la campaña y devuelve `"ACTIVE"` solo si todo entrega; si
  el conjunto o la campaña de arriba están apagados devuelve `ADSET_PAUSED`/`CAMPAIGN_PAUSED`, porque
  el effective_status del ad solo no siempre refleja al padre) y **`getAdsetBudgets(account)`**
  (budget real por adset/campaña; detecta ABO vs CBO; para el Plan). `getAds` extrae `ventas` (compras)
  y `conversaciones` (`messaging_conversation_started_7d`, para campañas de mensajes). TODAS las
  llamadas paginan siguiendo `paging.next` — sin eso Meta corta en `limit` y el panel mostraría una
  foto incompleta SIN avisar (pasaba en `getAds` con >500 anuncios).
- `lib/nomenclatura.js` — parser del nombre + armado de filas. `buildRows(ads, audMap?, statusMap?,
  tipoMap?, goalMap?)` agrupa por **fingerprint de tiempo** `(HH.MM.SS)`; cada fila: `id`, `ang`, `sec`,
  `split`, `aud`, `hook`, `fmt`, `spend`, `roas`, `cpa`, `ventas`, `conversaciones`, `costoConv`, `tipo`
  (ventas|mensajes), `activa` (true/false/null), `breakdown` (campaña/adset/aud), y para el rol de
  embudo: **`audPos`** (posición 0–2 de la audiencia PONDERADA POR SPEND — un creativo en varias
  audiencias no pierde la señal; graduada Hot 2 / Tibio 1.5 / LAL 1 / frío 0 con `audEmbudoPos`),
  **`audMix`** (plata repartida entre frío y remate sin dominante → el front muestra "±") y
  **`goalPos`** (etapa declarada del adset vía **`goalEmbudo(adset)`**; en e-commerce ~90% optimiza
  PURCHASE así que NO asigna el rol — solo lo techea en `rolEmbudo` de page.jsx: tráfico/awareness →
  frío, ATC/checkout → medio). OJO: "catálogo" NO es keyword de ángulo (es formato, no mensaje —
  un DPA sobre retargeting Hot es remate; decide la audiencia). Validado contra las 4 cuentas reales
  (jul 2026). **`classifyTargeting(adset)`** clasifica la audiencia desde el targeting real
  (Retargeting Hot/Tibio por intención de las audiencias custom, Lookalike+%, Advantage+,
  Amplio/Intereses, Mensajería). **`targetingTipo(adset)`** marca ventas|mensajes por
  optimization_goal/destination_type. `parseAudience(nombre)` queda como **fallback**.
- `lib/sheet.js` — cruza el Google Sheet (cuenta de servicio, JWT RS256). Cruce por `(HH.MM.SS)` de
  `nuevo_nombre`. `listTabs()`, `enrichWithSheet(rows, tab)`. Degrada: sin tab devuelve `sheet:null`.
  **Normalización v1→v2 al leer** (el Sheet NO se toca, los videos viejos no se re-procesan):
  `normCat` unifica vocabulario (Educacional→Educativo); `gancho_familia`/`gancho_formato`/`marca_detectada`
  son columnas nuevas del prompt Gemini v2 (`docs/gemini-prompt-v2.md`, lo llena n8n) con fallback
  derivado del `tipo_gancho` viejo (Pregunta→Ruptura, Dato/Número→Evidencia, ...; lo ambiguo "nd").
  El Top Performers tiene la dimensión **Familia** (Ruptura/Evidencia/Pérdida/Identidad — la misma
  taxonomía que la Biblioteca).
- `lib/auth.js` — login por cliente con DOS fuentes: **APP_USERS** (env, texto plano) = admin de
  RESPALDO (nunca te quedás afuera; manda ante mismo usuario) y **Upstash** (`nusa:users`, passwords
  **hasheadas PBKDF2-SHA256 100k iter** vía Web Crypto) = usuarios de clientes, administrados desde
  la pestaña **USUARIOS** de la app (solo admin, `/api/users` ABM) sin env vars ni redeploy. Cookie
  firmada HMAC-SHA256 (Edge + Node). `authenticate` (async), `hashPassword`, `makeSessionToken`,
  `verifySession`, `canSeeAccount`, `authDisabled` (el gate de login sigue dependiendo SOLO de que
  APP_USERS tenga al menos un usuario).
- `lib/tiendanube.js` — `listStores()`, `getStoreRevenue(name, since, until, criterio?)` y
  `getTopProducts(...)`. Header de auth es `Authentication: bearer <token>` (NO "Authorization") +
  `User-Agent` obligatorio. El endpoint `/orders` sin filtro devuelve TODO (abiertas + archivadas
  `closed` + canceladas). **Criterio de VENTA configurable por tienda** (campo `ventas` en
  `TIENDANUBE_STORES`, toggle "VENTA =" en la banda): `"pagadas"` (default, como el panel de stats
  de TN: solo `payment_status === "paid"`) o `"no_canceladas"` (conteo interno de clientes como
  MoraShop: toda orden no cancelada, pagada o pendiente). Las de pago **anulado (voided)** no son
  venta bajo ningún criterio. Devuelve siempre el desglose (`facturacionPagada/Pendiente`, `anuladas`).
  El criterio se propaga a TODO: MER, objetivo del mes, vista Cliente, cerebro (snapshot con
  `criterio_venta`), Plan y chat (system + tools `tiendanube_resumen` y `tiendanube_productos`,
  incluido el top de productos — `getTopProducts` acepta el mismo `criterio`).
- `lib/dates.js` — `presetToRange(preset)` → `{since, until}`. Alinea Meta y Tienda Nube al mismo período.
- `lib/tiktok.js` — cliente de la **TikTok Marketing API** (Business API v1.3), espejo de `lib/meta.js`:
  `ttEnabled()`, `getAccounts()` (ids prefijados **`tt:`**, conviven con Meta en el mismo dropdown),
  `getAds(adv, since, until)` (misma forma de fila → buildRows/Sheet funcionan igual), `getAccountSpend`
  (con `porDia`), `getAdStatuses` (mapea secondary_status → ACTIVE/ADSET_PAUSED/CAMPAIGN_PAUSED),
  `getAdgroupAudiences` (clasificación básica), `getAdsetBudgets` (ABO/CBO vía budget_optimize_on),
  `isTikTok(id)`/`ttId(id)`. Las rutas (`accounts/ads/plan/chat/tiendanube-summary`) branchean por el
  prefijo. Sin env vars degrada (solo Meta). TikTok no tiene modo mensajes (todo `tipo:"ventas"`).
  OJO: métricas escritas contra la doc SIN probar contra la API real (falta el token) — la primera
  conexión puede necesitar ajuste fino de nombres (`complete_payment_roas`, `complete_payment`).
- `lib/store.js` — storage server-side en **Upstash Redis** (REST, sin dependencias): `storeEnabled()`,
  `kvGet(key)`, `kvSet(key, value)`. Para historiales/conversaciones compartidos. Sin env vars degrada
  (el front sigue en localStorage). Lo consume `/api/history` (GET/POST, scopeado por sesión, claves
  `nusa:<kind>:<account>`, kinds: `hist_an`/`hist_plan`/`chat`).
- `lib/fx.js` — cotización del **dólar oficial** (Argentina) para no mezclar monedas cuando la cuenta de
  Meta está en USD. `getDolarOficial()` (PROMEDIO de compra y venta = medio del spread, cache en memoria
  ~1h) y `convertMonto(monto, from, to)` (solo ARS↔USD). Fuente: dolarapi.com, fallback criptoya.com.
  Se expone al front por `/api/fx`. Sin red degrada: se muestran los montos sin convertir y avisa.
- `middleware.js` — protege las páginas (redirige a `/login`). Las rutas `/api` hacen su propia
  verificación (JSON 401/403) y quedan fuera del matcher.
- `app/page.jsx` — TODO el front en un archivo grande (CSS embebido). Componentes: Cliente, Dash,
  **Analisis** (cerebro), **Plan** (cómo llegar al objetivo), Hoy, Top, Panel, **Biblioteca**
  (Tus Ganadores + mapa probado/sin-probar), **Generar** (4 tipos + modo Iterar/Explorar). Toggle
  **MEDIR: Ventas | Mensajes** (`modo`) que filtra y cambia la métrica de toda la app, y toggle
  **MONEDA CUENTA: Pesos | USD** (`accCur`, auto-detectado del `currency` de Meta, override manual).
  NO reescribir entero; editar quirúrgico. `money()` muestra 2 decimales en montos < 100 no enteros (USD).
- `app/api/*` — `accounts` (filtra por sesión), `ads` (insights + targeting + estado en paralelo,
  cruza Sheet, arma tipoMap), `login`, `logout`, `sheets/tabs` (scopeada por `tabs` de sesión),
  `tiendanube/{stores,summary}` (stores scopeadas por cuenta), `copy` (generador), **`analyze`**
  (cerebro), **`match-hooks`** (hooks reales vs biblioteca), **`plan`** (escenarios para el objetivo,
  budget real ABO/CBO). Las rutas de IA son mode-aware (ventas/mensajes).

Alias de imports: `@/lib/...` (en `jsconfig.json`).

## Features y degradación elegante

Cada feature se activa por env var; si falta, queda apagada y el panel se ve como antes. Se puede
pushear a `main` sin romper prod.

- **Login por cliente** (`APP_USERS`, `SESSION_SECRET`): sin `APP_USERS` el login está DESACTIVADO
  (app abierta). Con usuarios: admin ve todo, el resto solo sus cuentas. Header con usuario + "salir".
  Los usuarios de CLIENTES se administran desde la pestaña **USUARIOS** (solo admin): alta/edición/
  borrado, generador de contraseñas, checkboxes de cuentas y pestañas del Sheet. Viven en Upstash
  hasheados — no se ven ni recuperan, solo se resetean. `APP_USERS` queda como respaldo del admin.
- **Tienda Nube** (`TIENDANUBE_STORES`, `TIENDANUBE_UA`): selector 🛒 solo si hay tiendas. Muestra
  banda **Facturación (tienda) vs Inversión (Meta) + MER + CAC + Margen de contribución** (mismo
  período) y un desplegable **"VER DÍA POR DÍA"** con gráfico (inversión/facturación/órdenes/visitas).
  El **CAC** = inversión / clientes NUEVOS reales de la tienda (no CPA pixel) — sale de
  `/api/tiendanube/daily`, que llama `getStoreDaily` (UN barrido de /orders con customer embebido →
  porDia + split nuevos/recurrentes; PAGE_CAP 22 → error RANGO_MUY_GRANDE en rangos enormes) y se
  fetchea APARTE del summary para no frenar la banda. El **margen de contribución** = facturación ×
  margen bruto % (input en el cell, localStorage `nusa_margen_<tienda>`) − inversión. El gráfico
  (`TnDaily` en page.jsx) son 3 paneles apilados con mismo eje x (nunca doble eje y), paleta validada
  contra el fondo #1A1A17 (inversión #4E97D1 / facturación #35A276 / órdenes #BD8722 / visitas
  #A97FD1), crosshair + tooltip y tabla plegada. Las visitas son LPV del pixel (fallback link clicks,
  campos nuevos de `getAccountSpendDaily`); TikTok degrada sin visitas. El objetivo del mes del
  Dashboard también toma la facturación de la tienda.
- **Moneda de la cuenta** (toggle "MONEDA CUENTA", `accCur`): se detecta solo el `currency` de la cuenta
  de Meta (override manual Pesos/USD). Si está en **USD**, TODA la plata de Meta se convierte a **pesos**
  al dólar oficial (`lib/fx.js`, promedio compra/venta) para que el panel entero piense y se cargue en
  pesos: spend, CPA, costo/conv, KPIs del Dashboard, Top Performers (incluye **audiencias** y el
  **breakdown** del acordeón), umbral, MER, cerebro y Plan. La conversión de la data de anuncios es
  client-side (factor `fxRate` sobre `data` → `dataConv` y `audiencias` → `audConv`, usa `/api/fx`)
  así el toggle es instantáneo; el MER y el Plan convierten server-side (el Plan con o SIN tienda, en
  ambos modos). Antes el MER mezclaba monedas (88.000x). El umbral (CPA máx, piso de spend) se carga
  en pesos. Sin cotización degrada a USD y avisa. La conversión aplica en ambos modos (en mensajes
  convierte el costo/conv); el toggle de override solo se muestra en Ventas.
- **Modo Ventas / Mensajes** (toggle "MEDIR" en el header): cada anuncio se clasifica por el objetivo
  del adset. En **Ventas** se excluyen las campañas de mensajes (y al revés). En **Mensajes** toda la
  métrica cambia a **conversaciones iniciadas** y **costo por conversación** (sin ROAS/MER/facturación):
  veredicto, umbral (Costo x conv máx), KPIs, Top, Hoy, Panel, Cliente, cerebro y Plan se adaptan.
  El objetivo de facturación se oculta en mensajes. Estos clientes usan solo Meta + Sheet (sin Tienda Nube).
- **Plan (`/api/plan`)**: cómo llegar al objetivo del mes. Lee el budget real por unidad (adset si ABO,
  campaña si CBO) del mes en curso y devuelve 3 escenarios (pesimista/normal/optimista) de cuánto/dónde
  invertir + desinversión. Proyecta desde el **ROAS por unidad con decaimiento por saturación** — NUNCA
  desde el MER: la facturación la empujan varios canales (Google/TikTok/orgánico) y acá solo se ve Meta,
  así que el MER está inflado y solo sirve de contexto. En modo mensajes optimiza conversaciones/costo.
- **Historial de Análisis y Plan**: cada lectura del cerebro y cada plan quedan guardados con fecha.
  Acordeón abajo de la lectura fresca, lo más nuevo arriba; al abrir renderiza con los mismos
  componentes (`AnalisisOut` / `PlanOut`). Sirve para auditar qué dijo y qué decisiones se tomaron.
  **Persistencia híbrida** (`useHistSync` + `/api/history`): localStorage siempre (cache/fallback) y,
  si Upstash está conectado, también server-side → compartido entre máquinas/usuarios de la cuenta.
  Si el server tiene data manda el server; si está vacío y el browser tiene historial viejo, lo migra
  solo. Lo mismo aplica a las conversaciones del chat (PREGUNTAR).
- **Chat de la cuenta (`/api/chat`, pestaña PREGUNTAR)**: asistente COMPLETO de la cuenta elegida —
  datos en lenguaje natural Y generación creativa (guiones/hooks/copys/ángulos PARA esa marca,
  fundados en su receta ganadora + planilla + biblioteca). Loop de **tool-use** (máx 6 vueltas) con
  herramientas read-only scopeadas: `meta_resumen` (spend cuenta, opcional día por día; platform-aware
  Meta/TikTok), `meta_anuncios` (rows con estado/audiencia, top 100 por spend), `estructura_campanas`
  (campañas→conjuntos con ABO/CBO, budgets y performance — para opinar sobre estructura/reformas),
  `tiendanube_resumen`/`tiendanube_productos` (con el criterio de venta del cliente),
  `biblioteca_hooks` (los 271 templates de `lib/hooks.js`, filtrable por familia) y `sheet_analisis`
  (análisis cualitativo de la pestaña elegida). **Capado doble**: el prompt rechaza con respuesta fija
  lo que no sea de la cuenta (conocimiento general, otras marcas, buscar afuera), y las únicas tools
  que existen consultan esa cuenta (account validado con `canSeeAccount`). Montos en pesos (misma
  regla que el panel). Conversación por cliente en localStorage+Upstash (tope 30 mensajes).
- **Audiencias desde targeting real**: la clasificación sale del spec de Meta, no del nombre del
  conjunto (Hot/Tibio por intención de las audiencias). Fallback al nombre si falla.
- **Estado activo/pausado**: cada creativo muestra `⏸ PAUSADA` si su `effective_status` no es ACTIVE.
  El cerebro recibe `ya_pausado` para no recomendar pausar lo ya pausado.
- **Cerebro (`/api/analyze`)**: analista read-only con Claude Sonnet 4.6. Recibe un resumen YA
  CALCULADO (rankings, MER vs ROAS pixel, veredictos, qué sangra, receta, umbral) y devuelve
  diagnóstico + acciones priorizadas. On-demand (botón "Pedir lectura"), grounded, ~2-3¢ por lectura.
  El prompt es **multi-canal-aware** (igual que el Plan): el MER incluye Google/TikTok/orgánico, así
  que tiene prohibido acreditarle a Meta toda la brecha MER vs ROAS pixel o proyectar con el MER —
  para juzgar Meta mandan el ROAS del pixel y las ventas atribuidas.
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
- `TIENDANUBE_STORES` (JSON `[{name,store_id,token,account?,ventas?}]` — `ventas`:
  `"pagadas"`|`"no_canceladas"`, criterio de venta default de esa tienda), `TIENDANUBE_UA`.
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (`claude-sonnet-4-6`) — generador, cerebro, match-hooks y chat.
- `TIKTOK_ACCESS_TOKEN`, `TIKTOK_APP_ID`, `TIKTOK_SECRET` (+ `TIKTOK_ADVERTISERS` JSON opcional para
  limitar cuentas) — TikTok Ads. Sin esto, el dropdown muestra solo Meta.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — historiales/conversaciones server-side
  (los inyecta sola la integración Upstash del Marketplace de Vercel; opcional, sin esto queda
  localStorage). Alias legacy soportados: `KV_REST_API_URL`/`KV_REST_API_TOKEN`.

**Gotcha Vercel:** cambiar una env var NO redeploya solo → Deployments → último → ⋯ → Redeploy.

## Cómo trabajar

- **NO correr `npm run build` con el dev server (`npm run dev`) corriendo**: pisan el mismo `.next`
  y el browser rompe con "Cannot find module './XXX.js'". Si pasa: `pkill -f "next dev"; rm -rf .next;
  npm run dev`. Para verificar build, bajá el dev primero.
- El usuario a veces edita en **GitHub web**: chequeá `git fetch`/`git status` antes de editar.

## Pendientes / roadmap

- **TikTok Ads**: el código YA está (`lib/tiktok.js` + branches en rutas) pero falta el acceso:
  crear la app de developer en business-api.tiktok.com (scopes read de Ads/Reporting), esperar la
  aprobación, autorizar con el Business Center y cargar las env vars. Al conectar el primer token,
  VERIFICAR los nombres de métricas del reporte (no se pudieron probar sin token).
- **Google Ads**: mismo patrón que TikTok; requiere developer token de Google Ads API (aprobación lenta).
- **Snapshots históricos + GA4**: para que el cerebro razone sobre tendencia y causas full-funnel.
- **Refresh del token de Meta**: regenerarlo como **"Sin vencimiento"** en Meta Business → Usuarios
  del sistema (evita el bajón de los ~60 días).
- Sumar más tiendas/usuarios a medida que entren clientes. Eventual: hashear passwords.
