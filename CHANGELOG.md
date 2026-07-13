# CHANGELOG — NUSA APP

Registro de cambios por versión. **V 1.N = número del PR mergeado** — es el mismo número que la
app muestra en el header ("V 1.N ▮▮▮"), así se confirma de un vistazo qué versión corre en prod.
Regla de la casa: cada PR suma su entrada acá ANTES de mergearse.

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
