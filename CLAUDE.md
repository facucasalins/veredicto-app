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
  effective_status del ad + del adset + de la campaña y devuelve `"ACTIVE"` solo si todo entrega —
  pidiendo TODOS los `effective_status`, porque el edge `/ads` excluye ARCHIVED por default y los
  anuncios archivados con spend quedaban sin estado; si
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
- `lib/tiendanube.js` — `listStores()`, `getStoreRevenue(name, since, until, criterio?)`,
  `getStoreDaily(...)` (porDia + nuevos/recurrentes + `sinCliente`), `getCustomerSplit(...)` (chat),
  `getTopProducts(...)`, `getStockProducts(...)`. Header de auth es `Authentication: bearer <token>`
  (NO "Authorization") + `User-Agent` obligatorio. El endpoint `/orders` sin filtro devuelve TODO
  (abiertas + archivadas `closed` + canceladas). **UN barrido por (tienda, rango)**: `sweepOrders`
  trae las órdenes una vez (páginas de 50, 6 en vuelo — la latencia de TN es lineal en órdenes por
  página, ~65 ms/orden medido) y arma un agregado que sirve para AMBOS criterios; revenue/daily/split
  son vistas sobre él. Cache 5 min en memoria + Upstash (`nusa:tn:orders:<store>:<since>:<until>`),
  dedup de llamadas concurrentes (`_inflight`), cola de concurrencia POR TIENDA compartida, timeout
  25 s y reintentos con backoff en 429/5xx (`x-rate-limit-reset`). Rate limit de TN: balde de 40 que
  drena a 2/seg (×10 en planes Next/Evolution). Si una página falla tras reintentar → `parcial:true`
  + `paginasFallidas` (NO se cachea; la banda lo muestra en rojo). Tope `ORDER_CAP` 6.000 órdenes →
  `RANGO_MUY_GRANDE` (daily); el summary cae a un barrido liviano sin `customer` (tope doble).
  **Criterio de VENTA configurable por tienda** (campo `ventas` en `TIENDANUBE_STORES`, toggle
  "VENTA =" en la banda): `"pagadas"` (default, como el panel de stats de TN: solo
  `payment_status === "paid"`) o `"no_canceladas"` (conteo interno de clientes como MoraShop: toda
  orden no cancelada, pagada o pendiente). Las de pago **anulado (voided)** no son venta bajo ningún
  criterio. Devuelve siempre el desglose (`facturacionPagada/Pendiente`, `anuladas`). El criterio se
  propaga a TODO: MER, objetivo del mes, vista Cliente, cerebro (snapshot con `criterio_venta`), Plan
  y chat (system + tools `tiendanube_resumen` y `tiendanube_productos`, incluido el top de productos).
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
- `lib/google.js` — cliente de la **Google Ads API** (REST + GAQL vía `searchStream`, bajo la MCC).
  Auth: refresh token OAuth → access token cacheado ~50 min en memoria. `gEnabled()`,
  `getAccounts()` (cuentas cliente ENABLED no-manager, ids prefijados **`g:`**, mismo dropdown que
  Meta/TikTok), `getAds(customerId, range)` (misma forma de fila que Meta; `range` = keyword GAQL o
  `{since,until}` → BETWEEN; **incluye PMax**: cada asset group con spend entra como fila propia,
  ids `ag:<id>`, nombre "PMax · campaña · asset group"), `getAdStatuses` (cadena ad + ad group +
  campaña → ACTIVE / ADSET_PAUSED / CAMPAIGN_PAUSED; también asset groups), **`getAccountSpend`**
  (spend/conversiones a nivel customer, con `porDia` — mismo contrato que TikTok),
  **`getChannelAudiences`** (adset_id → canal de la campaña: Búsqueda/PMax/Shopping/Display/Video —
  hace de "audiencia" porque Google no tiene Hot/Tibio/LAL) y **`getAdsetBudgets`** (mismo contrato
  que Meta/TikTok; en Google el budget vive SIEMPRE en la campaña → todas las unidades son "CBO"),
  `isGoogle(id)`/`gId(id)`. Los nombres de Google (RSA/PMax) NO llevan nomenclatura → cada anuncio
  es su propia fila (fingerprint = nombre completo; `/api/ads` y el chat pisan `nombre:"nd"` con el
  nombre real) y SIN cruce con Sheet. Cerebro/Plan/chat FUNCIONAN con Google (prompts
  platform-aware; `/api/tracking` devuelve null — el pixel es de Meta); `SinGoogle` solo gatea las
  pestañas creativas (Generar/Embudo/Qué grabar), que dependen de nomenclatura/hooks.
- `lib/multi.js` — helpers de la **vista combinada** (varias cuentas de ads a la vez, ej. Meta +
  Google de la misma marca): `platformOf(id)` (por prefijo), `spendOf(id, since, until)` y
  `spendDailyOf(...)` (branchean a Meta/TikTok/Google), `parseAccounts(searchParams)` (lee
  `accounts=a,b` + `curs=USD,ARS` — params PARALELOS porque los ids llevan ":"; cae a
  `account`+`accCur` si no vienen). Lo consumen summary/daily de Tienda Nube y el Plan.
- `lib/ga4.js` — cliente de la **GA4 Data API** (runReport, REST). PILOTO: `gaEnabled()`/`gaDemo()`,
  `propertyFor(account, store)` (mapea propiedad por `GA4_PROPERTIES`), `getResumen` (sesiones/
  usuarios/embudo carrito→checkout→compra/CR/ticket), `getCanales` (venta por canal
  `sessionDefaultChannelGroup` — descompone la brecha MER vs ROAS pixel: orgánico vs pago) y
  `getDaily`. **`GA4_DEMO=1` = modo demo** (datos de muestra marcados `demo:true`, para ver el
  módulo sin conectar nada). Reusa el OAuth client de Google Ads pero el refresh token necesita
  TAMBIÉN el scope `analytics.readonly` (el actual solo tiene `adwords` → regenerarlo con ambos;
  puede ir en `GOOGLE_OAUTH_REFRESH_TOKEN` para no pisar el de Ads). OJO: métricas escritas contra
  la doc SIN probar contra una propiedad real — verificar al conectar la primera. Lo consume
  `/api/ga4` (degrada con `{off:true}`) → banda `Ga4Band` en el front + `trafico_sitio_ga4` en el
  snapshot del cerebro.
- `lib/store.js` — storage server-side en **Upstash Redis** (REST, sin dependencias): `storeEnabled()`,
  `kvGet(key)`, `kvSet(key, value, ttlSec?)`, `kvDel(key)`, `kvMget(keys)` (un request). Para historiales/conversaciones compartidos. Sin env vars degrada
  (el front sigue en localStorage). Lo consume `/api/history` (GET/POST, scopeado por sesión, claves
  `nusa:<kind>:<account>`, kinds: `hist_an`/`hist_plan`/`hist_test`/`chat`).
- `lib/conciencia.js` — **nivel de conciencia (Schwartz)** de cada creativo, juzgado SOLO por el
  gancho: 5 producto+oferta · 4 producto · 3 solución · 2 problema · 1 inconsciente.
  `classifyRows(rows, tab)` → `{niveles: {fingerprint → {nivel, fuente, motivador, motivadorTipo,
  confianza, razon?}}, cache, claude}`. Tres fuentes en orden: override manual (Upstash
  `nusa:nivel_override:<tab>:<fp>`) > `reglas()` duras sobre el Sheet (regex de oferta en
  `texto_gancho`, cta+oferta, Urgencia+Escasez → 5; Lanzamiento/Comparativo/Testimonial o ángulo
  Novedad/Social_Proof/Autoridad → 4; Aspiracional/Storytelling/Entretenimiento sin oferta → 1) >
  Claude (tandas de 20, rúbrica textual, `razon` antes de `nivel`, cache `nusa:nivel:<tab>:<fp>`
  sin TTL + memoria). Desvíos calibrados (Juanita/Shark, sep 2026): el regex de 5 no aplica en
  Comparativo/Testimonial (precio = objeción), y el 4 por ángulo solo no aplica sobre categorías
  de nivel 1 (va a Claude). Sin API key o sin Upstash degrada. `classifyRows(rows, tab,
  {maxBatches:2})`: hasta 2 tandas de 20 por llamada y devuelve `pendientes` (fuente "pendiente");
  el front (`clasificarTodo`) itera hasta cubrir todo. Una tanda que falla se reintenta partiéndose
  a la mitad; si igual falla → fuente "nd" + motivo `claude_fallo` (botón ↻ reintentar); sin API
  key → motivo `sin_claude`. Lo consumen las rutas
  `app/api/conciencia/{clasificar,override,proximo-test}` (auth compartida en `_auth.js`:
  sesión + `canSeeAccount` de account+extras + `tab` contra `sess.tabs`) y la pestaña **ÁNGULOS**
  de page.jsx (`Angulos`: matriz nivel × etapa con estado de celda — frío SOLO por hook rate,
  medio/caliente por ROAS o costo/conv ±15% vs mediana —, lectura determinista, motivadores
  probados, próximo test con "Armar brief" → `prefill` de Generar; historial `hist_test`).
  La matriz reparte cada creativo POR CONJUNTO (`breakdown`, con `impresiones`/`video3s`/`thruplay`
  por conjunto) según la audiencia real (`etapaAud` = `AUD_POS`): no por su audiencia dominante.
  Solo entran creativos CON fila en el Sheet; lo sin Sheet (catálogos) va al desglose "sin nivel"
  del header. Videos "⚠ sin reproducciones" (`sinRepro`: formato de video, >5.000 impresiones,
  <2% de 3 s — Meta no los cuenta como video) se marcan (también en el PANEL) y quedan fuera de
  las medianas de hook/hold y del veredicto en frío (investigado: son `object_type VIDEO` con
  `video_id`, pero `video_play_actions` ~0,3% en todas las ubicaciones → problema del creativo;
  filtro en el PANEL y columna `video_valido` en el CSV). **Piso de celda**: veredicto solo con ≥3
  creativos y ≥5% del spend de su columna (`colSpend`), confianza alta ≥6 y ≥10%; TOTAL no juzga.
  **`contextoAngulos(filas, u, msg)`** arma el
  contexto que comparten PRÓXIMO TEST y GENERAR → Ángulos nuevos: sin los "sin reproducciones",
  inventario completo de motivadores, "voz" (8 mejores ganchos por hook rate en frío + 5 mejores
  por venta en caliente) y motivadores/formatos por celda. `/api/conciencia/proximo-test` valida
  diversidad (3 motivadorTipo distintos, sin motivador repetido ni saturado con 3+ creativos) y
  pide UNA corrección si falla; devuelve `advertencia` si sigue rota. `GEN_TIPOS.angulos` exige 5
  tipos + Oferta, cercano/diferencia y `descarte` por ángulo. La clasificación se comparte entre
  pestañas vía `conciencia` en App (`{key, data}`).
- `lib/voz.js` — **voz real de las clientas** por marca (Upstash `nusa:voz:<tab>`): motivadores
  {id, tipo Dolor|Deseo|Objecion|Ocasion|Identidad, frase_literal, resumen, fuente, fecha,
  veces_visto}. `extraerVoz(texto, existentes)` (Claude: motivadores con frase literal citada +
  `mismo_que` para dedup), `cruzarVoz(tab, voz, motivadoresCreativos)` (match contra los
  motivadores detectados en creativos, cacheado en `nusa:voz_cruce:<tab>` por firma del set),
  `leerVoz`/`guardarVoz`/`nuevoItem`. Ruta `/api/voz` (POST con `action`: listar | extraer |
  guardar | manual | editar | borrar | cruzar; auth de `conciencia/_auth`). UI: sección **VOZ DE LAS
  CLIENTAS** en ÁNGULOS (`VozClientas`); `vozPayload` arma `{sin_creativo, probados}` que reciben
  PRÓXIMO TEST y GENERAR → ángulos como contexto obligatorio (priorizar backlog; lo inventado va
  marcado `verificado_con_clientas:false`). Sin Upstash: guardar → 409, queda en la vista.
  **Seguimiento de tests** (page.jsx, `hist_test`): cada hipótesis lleva `estado` (propuesta →
  aprobada → grabada → en_pauta → evaluada), `creativos` (fingerprints/texto vinculados al pasar a
  en pauta, `creativosDe` matchea contra el panel), `fecha_pauta` y `evaluacion` (`evaluarHipotesis`
  contra el `benchmark` guardado al proponer: hook/hold en frío o niveles 1-2, CTR + costo LPV en
  3-4, ROAS/CPA o costo/conv vs umbral en 5 → cumplio | no_cumplio | sin_data). Auto a los 30 días
  de en pauta. `TestsTabla` lista todo; el cerebro recibe `tests_en_curso`/`tests_evaluados` en el
  snapshot (los comenta en SEGUIMIENTO) y `/proximo-test` recibe `tests_evaluados` para no repetir
  una hipótesis que falló.
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
- `app/api/conciencia/*` — `clasificar` (POST rows con campos del Sheet → niveles), `override`
  (POST/DELETE, requiere Upstash → 409 si no; guarda también `nivel_previo`/`fuente_previa` — lo
  automático antes de la corrección — que `classifyRows` devuelve en la entrada override y la
  sección **CALIBRACIÓN** de ÁNGULOS usa para coincidencia global/por fuente/por nivel, matriz de
  confusión 5×5, aviso de reglas fallando <80% con 20+ overrides y CSV de overrides = set de
  entrenamiento del prompt v3 de Gemini), `proximo-test` (POST matriz + motivadores + receta →
  3 hipótesis JSON de Claude, mode-aware). Ver `lib/conciencia.js`.
- `app/api/video` — "▶ ver video": `?account=&ad=` → 302 a la vista previa oficial del anuncio
  (`getAdPreviewUrl` en `lib/meta.js`: `/{ad}/previews` → src del iframe, abre sin login; fallback
  post → Administrador). Cada fila de `buildRows` lleva `adId` (anuncio de más spend del creativo).
  Solo Meta; el link vence a las ~24 h así que se resuelve al clic.
- `app/api/export` + `lib/export.js` — "⬇ CSV": `?account=&preset=|since=&until=&nivel=anuncio|
  conjunto|campana` → descarga (Content-Disposition) de los resultados del período: misma data que
  `/api/ads` (insights + estado + audiencia real + tipo) sin Sheet ni nomenclatura, por anuncio o
  agregada por conjunto/campaña (ROAS recompuesto desde spend×roas). Excel es-AR (`;`, coma
  decimal, BOM). Montos en moneda de la cuenta. Meta/TikTok/Google; `accounts=` → todas las cuentas
  de la vista en un archivo (`_combinado`). Por anuncio: nomenclatura (`parseName`), etapa de embudo
  (`audEmbudoPos`), video p50/tiempo promedio/hook rate/hold rate, estado SIEMPRE con valor.
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
- **Vista COMBINADA (Meta + Google juntas)**: al lado del selector de cliente hay un select
  **"➕ combinar cuenta…"** que suma cuentas extra a la vista (chips con ✕ para sacarlas; quedan
  recordadas por cuenta principal en localStorage `nusa_extras_<account>`). El front fetchea
  `/api/ads` POR CUENTA en paralelo y mergea client-side: cada fila queda tagueada con `plat`
  (meta|google|tiktok → badge M/G/TT en Panel y Top cards cuando hay mezcla; el TOP ADS DEL MES
  suma botones TODAS/META/GOOGLE/TIKTOK a la derecha del header que re-cortan el top 6 sobre el
  ranking completo `stats.topPool` — sin eso, filtrar los 6 ya elegidos dejaría 1 card; al lado
  hay un checkbox **DPA** que destildado saca los catálogos de Meta (`fmt:"DPA"`) del ranking —
  aparece en CUALQUIER vista, también cuenta sola, si hay DPAs con spend ≥ piso) y `_acc` (la cuenta,
  para convertir moneda POR CUENTA — una vista puede mezclar Meta en USD con Google en ARS). La
  inversión se muestra con desglose por plataforma (KPIs del Dash/Panel y banda de Tienda Nube), y
  el **MER pasa a ser multi-canal de verdad** (facturación ÷ suma de TODAS las plataformas
  visibles). summary/daily/plan aceptan `accounts`+`curs`; el chat recibe `extras`+`extrasCur` en
  el body y sus tools devuelven los datos POR PLATAFORMA + total; el cerebro recibe
  `plataforma:"mixta (...)"` + `inversion_por_plataforma`. Las unidades del Plan van prefijadas
  `[Meta]`/`[Google]` y puede recomendar mover plata ENTRE plataformas. Las pestañas creativas
  (Generar/Embudo/Qué grabar/Biblioteca) trabajan solo sobre las filas no-Google (`withVCreative`);
  se gatean con `SinGoogle` únicamente si TODA la vista es Google (`soloGoogle`).
- **COMPARAR (opcional)**: checkbox "⇄ COMPARAR" en la banda de selectores del header (junto a
  cuenta/planilla/tienda). Apagado por default → no aparece NADA de comparación. Al tildarlo
  aparece ahí mismo el selector del segundo rango (default **"período anterior equivalente"**:
  misma cantidad de días, ventana inmediatamente anterior — calculado client-side con
  `presetToRange` importado de `lib/dates.js`, que es puro; también presets y fechas custom) y se
  comparan TRES lugares: los **KPIs del Dashboard** (delta % por KPI), la **banda de Tienda Nube**
  (facturación, inversión, MER, CAC y margen de contribución — `tnSummaryCmp`/`tnDetailCmp`, dos
  fetches extra de summary/daily con el rango comparado) y la **banda de GOOGLE ANALYTICS**
  (sesiones, compras, CR del sitio y % compras pagas — `ga4Cmp`, un fetch extra de `/api/ga4`
  con since/until del rango comparado). Colores: verde = mejora, rojo = empeora;
  **invertido** para CPA/costo por conv/CAC donde bajar es bueno; inversión neutra/gris. Respeta
  la vista combinada (compara la SUMA de las cuentas visibles, con conversión de moneda por
  cuenta) y el modo mensajes. El fetch de ads de comparación va aparte (`dataCmp`/`statsCmp` en
  page.jsx, sin Sheet ni veredictos — los KPIs no los necesitan).
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
  para juzgar Meta mandan el ROAS del pixel y las ventas atribuidas. **Memoria de lecturas**: cada
  lectura se guarda en el historial con una `foto` compacta de métricas (inversión, ROAS pixel,
  MER, facturación, CR sitio) + `modo`; la próxima lectura de esa cuenta manda las últimas 3 como
  `lecturas_anteriores` y el prompt devuelve el campo extra `seguimiento` (autoevaluación: qué
  recomendó, antes → ahora, acertó o no). Lo renderiza `AnalisisOut` como bloque SEGUIMIENTO.
  Las tasas comparan mejor que los totales porque los períodos pueden diferir (la foto lleva su
  `periodo`).
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
- `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`,
  `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_MCC_ID` (+ `GOOGLE_ADS_API_VERSION` opcional, default
  v24) — Google Ads. Sin esto (o si la API falla) el dropdown no muestra cuentas de Google.
- `GA4_PROPERTIES` (JSON `[{name, property_id, account?, store?}]`), `GOOGLE_OAUTH_REFRESH_TOKEN`
  (refresh token con scopes adwords + analytics.readonly; si falta usa GOOGLE_ADS_REFRESH_TOKEN)
  y `GA4_DEMO=1` (modo demo con datos de muestra) — Google Analytics 4 (piloto).
- `CRON_SECRET` (protege el cron diario de alertas), `RESEND_API_KEY` + `ALERTAS_EMAIL`
  (destinos separados por coma) + `ALERTAS_FROM` (opcional) — alertas proactivas
  (`lib/alertas.js` + `/api/alertas` + cron en `vercel.json` 11:00 UTC). In-app: banner al PIE
  de la página (solo admin), filtrado a la cuenta seleccionada — cada alerta lleva `id` (cuenta
  de ads) y/o `store`; sin ambos es global (ej. token caído) y se ve en cualquier cuenta. El
  MAIL sigue siendo el digest de TODOS los clientes. **Salud del cron**: Vercel manda
  `Authorization: Bearer CRON_SECRET` SOLO si la env var existe (sin ella el cron caía al 401 en
  silencio); la ruta reconoce el user-agent `vercel-cron`, registra cada intento en
  `nusa:alertas:cron` (`registrarCorrida`) y `alertaCronCaido` inyecta una alerta global crítica
  si el último chequeo tiene >48 h, con la causa. GET devuelve `cron: {secret, ultimo_intento}`. Sin Resend quedan solo in-app; sin Upstash
  no se persisten (solo "chequear ahora" en vivo).
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — historiales/conversaciones server-side
  (los inyecta sola la integración Upstash del Marketplace de Vercel; opcional, sin esto queda
  localStorage). Alias legacy soportados: `KV_REST_API_URL`/`KV_REST_API_TOKEN`.

**Gotcha Vercel:** cambiar una env var NO redeploya solo → Deployments → último → ⋯ → Redeploy.

**Versión visible:** el header muestra "V 1.N ▮▮▮" (donde estaba "HQ") — N = número del último PR
mergeado, derivado en build de `VERCEL_GIT_COMMIT_MESSAGE` en `next.config.js` (automático, no se
bumpea a mano). Local/branch muestra el SHA corto o "dev". Sirve para confirmar de un vistazo que
prod corre el último merge.

## Cómo trabajar

- **CHANGELOG.md**: cada PR suma su entrada ("V 1.N — título" con bullets) ANTES de mergearse.
  N = número del PR; es el mismo que la app muestra en el header.

- **NO correr `npm run build` con el dev server (`npm run dev`) corriendo**: pisan el mismo `.next`
  y el browser rompe con "Cannot find module './XXX.js'". Si pasa: `pkill -f "next dev"; rm -rf .next;
  npm run dev`. Para verificar build, bajá el dev primero.
- El usuario a veces edita en **GitHub web**: chequeá `git fetch`/`git status` antes de editar.

## Pendientes / roadmap

- **TikTok Ads**: el código YA está (`lib/tiktok.js` + branches en rutas) pero falta el acceso:
  crear la app de developer en business-api.tiktok.com (scopes read de Ads/Reporting), esperar la
  aprobación, autorizar con el Business Center y cargar las env vars. Al conectar el primer token,
  VERIFICAR los nombres de métricas del reporte (no se pudieron probar sin token).
- **Google Ads**: v2 YA integrada (panel/veredictos + PMax + canal como audiencia + cerebro/Plan/
  chat + vista combinada, ver `lib/google.js`). Pendiente: keywords/términos de búsqueda como
  dimensión propia, y mapear el embudo (hoy los canales de Google no entran a `audEmbudoPos`).
- **Vincular las cuentas de Google sueltas a la MCC**: el usuario OAuth accede a ~15 cuentas pero
  solo las que cuelgan de la MCC aparecen en el panel. La vinculación por API está BLOQUEADA
  porque el developer token tiene acceso **Explorer (read-only)** — las mutaciones piden Basic.
  Opciones: (a) vincular a mano desde Google Ads (MCC Agencia Powr → Cuentas → Vincular cuenta
  existente, con el ID de cada cuenta) o (b) pedir **Basic access** en API Center y correr
  `node scripts/link-google-accounts.mjs <ids...>` (invita desde la MCC y acepta desde cada
  cuenta; ya probado hasta el punto del bloqueo).
- **GA4 (funcionando en local, falta prod)**: `lib/ga4.js` + `/api/ga4` + banda + cerebro,
  VERIFICADO contra propiedades reales (jul 2026 — métricas OK sin ajustes; el usuario accede a
  12 propiedades: morashop.ar 252454981, Juanitashoes 355886412, LegART, ADBlick, etc.). El token
  con scopes `adwords`+`analytics.readonly` ya está en `.env.local` local
  (`GOOGLE_OAUTH_REFRESH_TOKEN`, generado con `scripts/ga4-auth.mjs` — OJO: requiere
  `http://localhost:53682/callback` como redirect URI del OAuth client, y las APIs
  analyticsadmin + analyticsdata habilitadas en el proyecto). Para PROD: copiar
  `GOOGLE_OAUTH_REFRESH_TOKEN` y `GA4_PROPERTIES` de `.env.local` a Vercel + redeploy.
  **Confiabilidad medida** (Juanita, 30 días): compras GA4 694 vs 682 no-canceladas TN (+1,8%),
  revenue GA4 $107,3M vs $113,7M pagadas TN (−5,6%) → totales muy confiables. CAVEAT morashop.ar:
  46% de las compras caen en canal "Unassigned" (purchase sin sesión atribuida) → ahí el MIX por
  canal es débil hasta arreglar el tagging; los totales sirven igual.
- **Refresh del token de Meta**: regenerarlo como **"Sin vencimiento"** en Meta Business → Usuarios
  del sistema (evita el bajón de los ~60 días).
- Sumar más tiendas/usuarios a medida que entren clientes. Eventual: hashear passwords.
