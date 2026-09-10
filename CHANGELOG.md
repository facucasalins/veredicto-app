# CHANGELOG — NUSA APP

Registro de cambios por versión. **V 1.N = número del PR mergeado** — es el mismo número que la
app muestra en el header ("V 1.N ▮▮▮"), así se confirma de un vistazo qué versión corre en prod.
Regla de la casa: cada PR suma su entrada acá ANTES de mergearse.

## V 1.34 — ÁNGULOS: saneamiento (PR A) — batch completo, piso de celda, cron de alertas, videos sin reproducciones
- **Clasificación en rondas**: `/api/conciencia/clasificar` procesa hasta 2 tandas de 20 por
  llamada (no pasa el timeout del serverless) y devuelve `pendientes`; el front vuelve a pedir
  solo esos hasta cubrir todo (Juanita 90 d: 154 creativos en 2 rondas). Una tanda que falla se
  reintenta 2 veces partiéndose a la mitad (un creativo que rompe el JSON ya no tira 20). Lo que
  no llegó queda **"pendiente"** (no "nd") y lo que Claude falló, "Claude no respondió", ambos
  con botón **↻ reintentar** en el header. "regla sin match" queda solo para cuando no hay API key.
- **Piso de celda**: veredicto ganadora/perdedora solo con ≥3 creativos Y ≥5% del spend de su
  columna; debajo, "sin data" con el motivo. Etiqueta de **confianza** junto al veredicto: alta
  (≥6 creativos y ≥10% de la columna) · media (cumple el piso) · baja (sin veredicto).
- **Columna TOTAL**: solo spend, % y cantidad de creativos (sin ROAS ni hook).
- **Cron de alertas** (la banda decía "chequeo 27/7"): causa — Vercel manda el Bearer del cron
  SOLO si `CRON_SECRET` está seteada; sin ella el request caía al 401 de sesión en silencio. Ahora
  la ruta reconoce el user-agent `vercel-cron`, registra cada intento en Upstash
  (`nusa:alertas:cron`, ok/error) y responde 500 con la causa. **Alerta nueva in-app**: "Cron de
  alertas sin correr hace más de 48 h" (global, crítica) con el diagnóstico (falta CRON_SECRET /
  último intento falló / nunca llegó) y qué tocar en Vercel. GET devuelve `cron: {secret, ultimo_intento}`.
  **Acción manual pendiente en Vercel**: cargar `CRON_SECRET` y confirmar el cron en Settings → Cron Jobs.
- **Videos sin reproducciones**: filtro "⚠ solo sin reproducciones (N)" en el PANEL y columna
  `video_valido` (true/false; vacío en no-video) en el CSV por anuncio. Investigación con la API:
  los 3 anuncios marcados son `object_type VIDEO` con `video_id` (igual que los sanos), pero
  `video_play_actions` da ~0,3% de las impresiones en TODAS las ubicaciones (un sano da ~95%).
  Meta los sirve como video y no los reproduce: problema del creativo, no del placement → re-subir.

## V 1.33 — Pestaña ÁNGULOS (nivel de conciencia × etapa × performance)
- Nueva pestaña **ÁNGULOS** (entre EMBUDO y PANEL): clasifica cada creativo con Sheet en un
  **nivel de conciencia** (Schwartz, juzgado SOLO por el gancho: 5 producto+oferta · 4 producto ·
  3 solución · 2 problema · 1 inconsciente) y lo cruza con la etapa de su audiencia (frío/medio/
  caliente = `rolEmbudo`) y su performance.
- **Clasificación** (`lib/conciencia.js` + `/api/conciencia/clasificar`), tres fuentes en orden:
  override manual (Upstash) > reglas duras sobre el Sheet (sin IA) > Claude en tandas de 20 con
  rúbrica y `razon` antes del `nivel` (cache en Upstash sin TTL + memoria). Sin API key o sin
  Upstash degrada (reglas solas; sin cache se avisa en el header del mapa).
- **MAPA**: matriz niveles × etapa con spend, % del spend, ROAS/CPA (mensajes: costo/conv), hook y
  hold rate medianos y cantidad de creativos. Estado de celda: sin probar / sin data / ganadora /
  perdedora — en **frío** SOLO por hook rate vs la mediana (±15%), nunca por ROAS; en medio y
  caliente por ROAS (o costo/conv). Click en la celda → lista de creativos con select de
  **override** de nivel (guarda vía `/api/conciencia/override`, se refleja al instante).
- **LECTURA**: 3-5 bullets deterministas (plantillas + números, sin IA). **MOTIVADORES PROBADOS**:
  inventario tipo → motivador con creativos, spend, ROAS, hook mediano y niveles.
- **PRÓXIMO TEST** (`/api/conciencia/proximo-test`): 3 hipótesis de Claude citando la celda que las
  justifica (prioriza celdas sin probar en frío; nunca repite un ganador; prohibido juzgar 1-3 por
  ROAS). "Armar brief" salta a GENERAR con tipo hooks + modo Explorar + el contexto precargado
  (`prefill` en Generar). Historial `hist_test` con `useHistSync`.
- Banda amarilla si el período es < 60 días. Sin planilla elegida: "Elegí una planilla". Vista
  combinada: Meta + TikTok (Google afuera).
- Soporte: `gancho_analisis` en el cruce del Sheet, `thruplay` por creativo en `buildRows` (hold
  rate), `kvDel`/`kvMget` en `lib/store.js`, kind `hist_test` en `/api/history`.
- **Matriz por CONJUNTO, no por audiencia dominante**: cada creativo reparte su spend entre sus
  conjuntos (`breakdown`, que ahora trae impresiones, video 3 s y ThruPlay por conjunto) según la
  audiencia real de cada uno — un creativo en Advantage+ y en RMKT aporta a frío Y a caliente.
  "Creativos" de la celda = cuántos tuvieron spend ahí; hook/hold de la celda salen de los
  conjuntos de esa etapa. Fila de totales por etapa al pie. Verificado (Juanita 30 d): frío ~$944k,
  medio ~$300k, caliente ~$1,9M, nivel 5 × frío ~$574k con 27 creativos.
- **"⚠ sin reproducciones"**: videos con más de 5.000 impresiones y menos de 2% de hook rate (Meta
  no los cuenta como video, bug conocido) se marcan en la celda y en el PANEL, y quedan FUERA de las
  medianas de hook/hold (celda y vista) y del veredicto ganadora/perdedora en frío.
- **Desglose "sin nivel"** en el header: cuánto spend quedó sin nivel y por qué — sin fila en el
  Sheet (fuera de la matriz; típico catálogos DPA), Claude no respondió, regla sin match — con
  la acción para corregirlo.
- **PRÓXIMO TEST y GENERAR → Ángulos nuevos, con el mismo contexto** (`contextoAngulos`): los
  creativos "sin reproducciones" quedan FUERA del payload entero; va el inventario COMPLETO de
  motivadores probados (motivador, tipo, niveles, creativos, hook, ROAS/costo); la "voz de la
  marca" (texto_gancho literal de los 8 mejores por hook rate en frío y los 5 mejores por venta en
  caliente); y por celda los motivadores y formatos ya usados con su cantidad.
- Reglas duras en ambos: prohibido proponer un motivador con 3+ creativos probados (la ruta lo
  valida y pide corrección una vez); cada propuesta nombra el motivador probado más cercano y en
  qué se diferencia; diversidad obligatoria (3 hipótesis con motivadorTipo distintos; 6 ángulos =
  Dolor, Ocasión, Identidad, Objeción, Deseo + Oferta, sin repetir motivador); celda llena (3+
  creativos con ese formato/motivador) → motivador nuevo, no formato; `descarte` con 2 ideas
  consideradas y por qué se descartaron, ANTES de la propuesta. Los hooks tienen que sonar a los
  ganchos literales, no a un manifiesto.
- GENERAR reusa la clasificación de ÁNGULOS si es del mismo período (estado compartido en App);
  si no, la pide sola. Tarjetas muestran tipo, más cercano/diferencia y el descarte plegado.
- Calibrado contra Juanita Shoes (30 días: 17/17 esperados) y Shark (10/11; FitTecnico queda en 3
  por rúbrica). Dos desvíos documentados de las reglas del spec: precio dentro de un Comparativo
  no es nivel 5, y ángulo Social_Proof sobre Entretenimiento va a Claude en vez de a 4.
## V 1.32 — ⬇ CSV: descargar los resultados del período
- Selector **⬇ CSV…** al lado del período (header): baja un archivo con los resultados de la
  cuenta en el rango elegido (presets o fechas personalizadas) **por anuncio** (con su campaña y
  conjunto), **por conjunto** o **por campaña**. En la vista combinada, una opción por cuenta.
- Columnas: campaña/conjunto/anuncio con sus ids, estado, audiencia real, tipo (ventas/mensajes),
  spend, impresiones, clics, CTR, CPM, CPC, ventas, facturación atribuida, ROAS, CPA,
  conversaciones, costo/conv, embudo (LPV, VC, ATC, checkout), video (3s, ThruPlay, 100%). Por
  anuncio suma alcance, frecuencia y las clasificaciones de calidad de Meta. ROAS agregado
  recompuesto desde la facturación (no promedio simple). Orden: más spend primero.
- Formato Excel es-AR: separador `;`, decimales con coma, BOM UTF-8. Montos en la moneda de la
  cuenta (columna `moneda`), como el Administrador. Meta, TikTok y Google (misma forma de fila).
- `/api/export` (`lib/export.js`): sesión + `canSeeAccount`, `Content-Disposition` para que el
  browser lo baje directo. `getAds` de Meta ahora trae `campaign_id`.
- Por anuncio suma la **nomenclatura** (fingerprint = el `HH.MM.SS`, fecha, concepto, ángulo,
  formato — con `parseName`, el mismo parser del panel; vacías en Google/catálogos) y la
  **etapa de embudo** (frio | medio | caliente, misma regla que `audPos`; también por conjunto).
- Video: `video_p50`, `video_tiempo_promedio_s`, `hook_rate_%` (3s ÷ impresiones) y `hold_rate_%`
  (ThruPlay ÷ 3s). Campos nuevos en `getAds` de Meta.
- **Estado siempre con valor** (activo | pausado | archivado | sin_dato). Causa del vacío: el edge
  `/ads` de Meta EXCLUYE los archivados por default (117 de 436 anuncios con spend en 30 días eran
  ARCHIVED). `getAdStatuses` ahora pide todos los estados → también el panel deja de tratarlos
  como "sin dato".
- Vista combinada: el CSV incluye TODAS las cuentas de la vista (Google/TikTok con su
  `plataforma` y `moneda`), sufijo `_combinado` en el nombre del archivo.

## V 1.31 — "▶ ver video": abrir el anuncio en una pestaña nueva
- Chip **▶ ver video** al lado del nombre del creativo en el TOP ADS DEL MES, en el desplegable
  por creativo de TOP PERFORMERS y en la tabla del PANEL. Abre en pestaña nueva la vista previa
  oficial del anuncio (el video se reproduce ahí), sin buscarlo a mano en el Administrador.
- Cómo: cada creativo lleva `adId` (el anuncio con más spend del grupo); `/api/video` resuelve al
  clic `/{ad}/previews` de Meta y redirige (302). El link de Meta vence a las ~24 h, por eso no se
  guarda. La URL directa del archivo (`video.source`) NO está permitida para el token de Sistema.
  Fallback: el post (`effective_object_story_id`) y, último, el anuncio en el Administrador.
- Solo Meta: en Google/TikTok el chip no aparece. Verifica sesión y `canSeeAccount`.
## V 1.30 — Tienda Nube: un solo barrido, cache y sin datos silenciosamente incompletos
- **Causa raíz de la lentitud y de "no me carga nuevos vs recurrentes"**: la banda hacía TRES
  barridos completos de `/orders` a la vez (summary en serie, daily y tendencia en paralelo, ×2 con
  COMPARAR) contra el rate limit de Tienda Nube (balde de 40, 2/seg). Las páginas que caían con 429
  se reemplazaban por `[]` en silencio → clientes nuevos/recurrentes bajos o en cero, intermitente.
- **Un barrido por (tienda, rango)**: `sweepOrders` trae las órdenes UNA vez y arma un agregado que
  sirve para ambos criterios de venta; summary, daily (CAC + gráfico) y el chat son vistas sobre él.
  Las llamadas concurrentes en la misma lambda comparten la misma promesa.
- **Cache 5 min** (memoria + Upstash si está conectado): togglear criterio/COMPARAR o cambiar de
  pestaña ya no vuelve a pegarle a la API. El resultado parcial NO se cachea.
- **Páginas de 50 con 6 en vuelo** (medido: la latencia de TN es lineal en órdenes por página,
  ~65 ms/orden) → Juanita 30 días pasó de ~30 s a ~11 s con números idénticos. Cola de concurrencia
  POR TIENDA compartida entre todas las funciones, timeout 25 s y reintentos con backoff en 429/5xx
  (respeta `x-rate-limit-reset`).
- **Aviso de datos parciales**: si una página sigue fallando tras reintentar, la respuesta viaja con
  `parcial:true` + `paginasFallidas` y la banda lo muestra en rojo en vez de un número bajo mudo.
  El CAC también aclara las órdenes sin cliente (checkout invitado) y cuándo no aplica.
- Summary en rangos enormes (>6.000 órdenes) cae a un barrido liviano sin `customer` (antes
  paginaba 50 páginas en serie). `kvSet` acepta TTL. `maxDuration` 120 en summary/daily.

## V 1.29 — Banda Tienda Nube: ajuste manual de inversión (resta)
- **Botón "− AJUSTAR INVERSIÓN"** en el head de la banda, a la derecha del toggle VENTA =: para
  descontar lo gastado en campañas que NO son del objetivo ventas de la tienda (ej. mayorista).
  El monto se resta de inversión, MER, CAC y margen de contribución; la card de inversión muestra
  "· −$X ajuste" y una nota al pie deja la cuenta clara.
- Con ⇄ COMPARAR activo hay un segundo campo para el período comparado, así los deltas comparan
  justo. Monto y estado guardados por tienda en el browser (localStorage, como el margen bruto).
- Solo afecta la banda: el resto del panel (Dashboard, cerebro, Plan) sigue con la inversión completa.

## V 1.28 — PREGUNTAR: no más timeouts
- El chat tiraba seguido "la consulta tardó demasiado y se cortó": la ruta tenía un tope de 60s,
  más bajo que el default de Vercel (300s) — y una respuesta creativa larga tarda 1-2 minutos
  sola. Ahora el chat tiene los 5 minutos completos.
- Herramientas en paralelo: cuando Claude pide varias fuentes en la misma vuelta (anuncios +
  planilla + biblioteca), se consultan a la vez en vez de una atrás de otra.

## V 1.27 — PREGUNTAR: respuestas largas sin cortar
- El chat quedaba a mitad de frase en respuestas largas: la llamada a Claude estaba capada en
  `max_tokens: 2000`. Ahora 8000 (sin costo extra en respuestas normales — se paga por token
  usado, no por el tope) y, si igual llegara al límite, avisa "…me quedé sin espacio, decime
  seguí" en vez de cortar en silencio.

## V 1.26 — Toggle DPA en Top Ads
- **Checkbox "DPA" en TOP ADS DEL MES**: a la derecha del header (aparece en cualquier vista —
  combinada o cuenta sola — si hay catálogos de Meta con spend ≥ piso). Destildado saca los DPA
  del ranking y re-corta el top 6, para ver limpio qué rinde fuera del catálogo. Solo aplica a
  los catálogos de Meta — en Google el equivalente (PMax/Shopping) se filtra con los botones
  de plataforma.

## V 1.25 — Inversión manual de TikTok (por período) sumada a la banda de Tienda Nube
- Mientras no haya acceso a la API de TikTok, botón **🎵 TIKTOK** en el header, a la derecha del
  selector de período: se carga a mano lo invertido en ese período (en USD) y se convierte al
  **dólar oficial de hoy** (mismo `/api/fx` de siempre, promedio compra/venta). Con ⇄ COMPARAR
  activo aparece un segundo campo en la fila del período comparado, así cada período lleva SU
  monto y los deltas de la banda comparan justo.
- El monto convertido se SUMA a las cuatro métricas de la banda — inversión (la etiqueta pasa a
  "ADS" y el desglose muestra "TT $X manual"), MER, CAC y margen de contribución — y a sus deltas.
  Nota al pie con la cuenta completa (USD × cotización = $ por período).
- No toca NADA más: ni APIs, ni panel, ni cerebro/Plan/chat. Los montos y el estado del botón
  quedan guardados por tienda en el browser (localStorage, igual que el margen bruto). Si algún
  día se conecta una cuenta tt: real, el botón se esconde solo para no contar la inversión dos veces.

## V 1.24 — La banda de Google Analytics también compara + filtro de plataforma en Top Ads
- Con el checkbox ⇄ COMPARAR activo, la banda de GA4 muestra deltas vs el período comparado en
  sesiones, compras del embudo, conversión del sitio y % de compras pagas (verde = mejora,
  rojo = empeora; el % pagas es neutro), más el rango comparado en el encabezado.
- **Filtro de plataforma en TOP ADS DEL MES** (solo vista combinada): botones TODAS / META /
  GOOGLE / TIKTOK arriba a la derecha de la sección. En una vista Meta+Google el ranking por
  ROAS suele quedar dominado por una plataforma; el filtro re-corta el top 6 sobre el ranking
  completo, así "META" muestra los 6 mejores de Meta (no 1 sobreviviente). En cuentas de una
  sola plataforma no aparece nada.

## V 1.23 — Motor de decisión: GA4 en el chat, MER pauta, Tendencia 4 semanas y ALERTAS
- **El cerebro se acuerda de sus lecturas y se autoevalúa**: cada lectura guarda una "foto" de las
  métricas del momento (inversión, ROAS pixel, MER, facturación, CR del sitio) junto con lo que
  recomendó; la próxima lectura de esa cuenta recibe las últimas 3 y devuelve un bloque
  **SEGUIMIENTO** — qué recomendó la vez pasada, cómo se movieron los números desde entonces
  (antes → ahora) y si acertó o se equivocó, para corregir el rumbo antes de recomendar de nuevo.
- **ALERTAS PROACTIVAS**: cron diario de Vercel (11:00 UTC / 8am AR) que chequea todos los
  clientes y avisa cuando algo se rompe o degrada: cuenta de Meta con problema (pago pendiente/
  inhabilitada), inversión de ayer en $0 en cuenta que venía invirtiendo, ROAS 7d cayendo >30%
  vs los 7 anteriores, CR del sitio (GA4) cayendo >30%. Centro de alertas in-app (banner al pie
  de la página, solo admin, con "chequear ahora"; muestra SOLO las alertas de la cuenta
  seleccionada — las globales tipo token caído se ven siempre) + email opcional vía Resend
  (`RESEND_API_KEY` +
  `ALERTAS_EMAIL`; canal enchufable — WhatsApp se puede sumar sobre la misma interfaz).
  Requiere `CRON_SECRET` en Vercel para el cron.
- **MER TOTAL · PAUTA en la misma card**: los dos números juntos y grandes ("14.03x · 7.0x
  pauta") con el % de compras pagas como sub-línea.
- **Chat con GA4** (`ga4_trafico`): PREGUNTAR ahora cruza Analytics — sesiones por canal, embudo
  del sitio, conversión, venta orgánica vs paga (con serie diaria opcional). Solo aparece si la
  cuenta tiene propiedad GA4 mapeada.
- **MER de la pauta** en la banda de Tienda Nube: debajo del MER blended, "pauta sola ≈ Nx · M%
  de compras pagas (GA4)" — el retorno de la plata invertida sin el empuje de orgánico/directo/
  email. El cerebro lo recibe como `mer_pauta_estimado`.
- **TENDENCIA 4 SEMANAS** (Dashboard + cerebro): la "película" — tabla semana a semana (últimos
  28 días, la última en curso) con inversión, ventas pixel, facturación, MER, sesiones y CR del
  sitio; celdas verdes/rojas contra la semana anterior. Ruta nueva `/api/tendencia`
  (multi-cuenta + TN + GA4, degrada por fuente). El cerebro recibe `tendencia_semanal` y
  prioriza rachas sobre fotos.
- CHANGELOG.md (este archivo) como registro permanente de cambios.

## V 1.22 — Versión visible en el header
- "V 1.N ▮▮▮" donde estaba "HQ": N se deriva solo del último PR mergeado
  (`VERCEL_GIT_COMMIT_MESSAGE` en build). Local muestra "dev".

## V 1.21 — Cuentas de Meta con problemas visibles
- Las cuentas con estado problemático (pago pendiente, inhabilitada, revisión de riesgo, etc.)
  aparecen en el dropdown como "⚠ Nombre — motivo" en vez de desaparecer en silencio.

## V 1.20 — Header prolijo + GA4 piloto
- Subtítulo de la marca en dos líneas, usuario/salir abajo, panel de selectores estirado al ancho
  libre con campos que crecen.
- **GA4 piloto**: banda "📈 GOOGLE ANALYTICS" (sesiones de todos los canales, embudo del sitio,
  conversión, venta por canal) + `trafico_sitio_ga4` al cerebro + modo demo (`GA4_DEMO=1`).
  Verificado con datos reales: compras GA4 vs Tienda Nube ±2%, revenue −6%.

## V 1.19 — COMPARAR en la banda de Tienda Nube
- Con el checkbox ⇄ activo comparan también facturación, inversión, MER, CAC y margen (deltas
  coloreados; CAC invertido — bajar es bueno).

## V 1.18 — Módulo COMPARAR (opcional)
- Checkbox "⇄ COMPARAR" en el header: segundo período (default "anterior equivalente") y delta %
  por KPI del Dashboard. Apagado por default, respeta vista combinada y modo mensajes.

## V 1.17 — Google Ads v2 + vista combinada Meta+Google
- **Google Ads v2**: PMax (asset groups) y Smart campaigns (fallback a nivel campaña — antes su
  spend no se veía), canal como audiencia, cerebro/Plan/chat habilitados para Google.
- **Vista combinada**: "➕ combinar cuenta…" — Meta + Google juntas con badges M/G, conversión de
  moneda por cuenta, MER multi-canal real, Plan que mueve plata entre plataformas y chat que
  responde por plataforma.

## V 1.16 — Google Ads como segunda fuente (v1)
- Cuentas de Google (🔍) en el dropdown vía MCC: panel, veredictos, Top y Qué hacer hoy.
