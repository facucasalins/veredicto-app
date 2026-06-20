// Cliente de la Meta Marketing API usando el token de Sistema (server-side).
const GRAPH = "https://graph.facebook.com";
const V = process.env.META_API_VERSION || "v21.0";

function token() {
  const t = process.env.META_SYSTEM_TOKEN;
  if (!t) throw new Error("Falta META_SYSTEM_TOKEN en las variables de entorno");
  return t;
}
const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : 0; };

// Lista las cuentas publicitarias a las que el usuario del sistema tiene acceso.
export async function getAccounts() {
  const fields = "account_id,name,currency,account_status";
  const url = `${GRAPH}/${V}/me/adaccounts?fields=${fields}&limit=200&access_token=${encodeURIComponent(token())}`;
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "Error de Meta");
  return (j.data || [])
    .map((a) => ({ id: a.account_id, name: a.name || a.account_id, currency: a.currency, status: a.account_status }))
    .filter((a) => a.status === 1 || a.status === undefined);
}

// Spend e ingresos a nivel CUENTA en un rango concreto { since, until } (para el modo Tienda Nube:
// inversión total en Meta vs facturación de la tienda, ambos sobre el mismo período exacto).
export async function getAccountSpend(accountId, since, until) {
  const tr = encodeURIComponent(JSON.stringify({ since, until }));
  const fields = ["spend", "purchase_roas", "actions"].join(",");
  const url = `${GRAPH}/${V}/act_${accountId}/insights?level=account&fields=${fields}&time_range=${tr}&access_token=${encodeURIComponent(token())}`;
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "Error de Meta");
  const row = (j.data || [])[0] || {};
  const spend = num(row.spend);
  const roas = Array.isArray(row.purchase_roas) && row.purchase_roas[0] ? num(row.purchase_roas[0].value) : 0;
  let purchases = 0;
  if (Array.isArray(row.actions)) {
    const p = row.actions.find((a) => ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type));
    if (p) purchases = num(p.value);
  }
  return { spend: Math.round(spend), roasMeta: roas, ventasMeta: Math.round(purchases) };
}

// Spend y ventas a nivel cuenta DÍA POR DÍA (time_increment=1) en un rango. Para el chat de la
// cuenta ("¿cuánto consume por día?"). Paginado.
export async function getAccountSpendDaily(accountId, since, until) {
  const tr = encodeURIComponent(JSON.stringify({ since, until }));
  let url = `${GRAPH}/${V}/act_${accountId}/insights?level=account&fields=spend,actions&time_increment=1&time_range=${tr}&limit=500&access_token=${encodeURIComponent(token())}`;
  const out = [];
  for (let i = 0; i < 10 && url; i++) {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || "Error de Meta (daily)");
    for (const row of j.data || []) {
      let ventas = 0;
      if (Array.isArray(row.actions)) {
        const p = row.actions.find((a) => ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type));
        if (p) ventas = num(p.value);
      }
      out.push({ fecha: row.date_start, spend: num(row.spend), ventas: Math.round(ventas) });
    }
    url = j.paging && j.paging.next ? j.paging.next : null;
  }
  return out;
}

// Estado de entrega REAL de cada anuncio (ACTIVE = entregando; el resto = pausado/archivado/etc).
// OJO: el effective_status del ANUNCIO no siempre refleja que el conjunto o la campaña de arriba
// estén pausados (un anuncio prendido puede no entregar porque su adset/campaña está apagado). Por
// eso pedimos también el effective_status del adset y de la campaña y devolvemos "ACTIVE" SOLO si
// toda la cadena entrega; si algo arriba está apagado, devolvemos el motivo (ADSET_PAUSED /
// CAMPAIGN_PAUSED). Sirve para no recomendar "pausá X" sobre algo que ya está (efectivamente) pausado.
export async function getAdStatuses(accountId) {
  const fields = "id,effective_status,adset%7Beffective_status%7D,campaign%7Beffective_status%7D";
  let url = `${GRAPH}/${V}/act_${accountId}/ads?fields=${fields}&limit=500&access_token=${encodeURIComponent(token())}`;
  const map = {};
  for (let i = 0; i < 20 && url; i++) {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || "Error de Meta (ads status)");
    for (const a of j.data || []) {
      const adS = a.effective_status;
      const asS = a.adset && a.adset.effective_status;
      const cS = a.campaign && a.campaign.effective_status;
      let status;
      if (adS !== "ACTIVE") status = adS;                  // el anuncio en sí no está activo
      else if (cS && cS !== "ACTIVE") status = "CAMPAIGN_PAUSED"; // campaña apagada arriba
      else if (asS && asS !== "ACTIVE") status = "ADSET_PAUSED";  // conjunto apagado arriba
      else status = "ACTIVE";                              // toda la cadena entrega
      map[a.id] = status;
    }
    url = j.paging && j.paging.next ? j.paging.next : null;
  }
  return map;
}

// Presupuesto REAL de cada adset: detecta ABO (budget en el adset) vs CBO (budget en la campaña).
// Budgets vienen en centavos → dividimos por 100. La "unidad de presupuesto" accionable es el
// adset (ABO) o la campaña (CBO). Para el plan de inversión.
export async function getAdsetBudgets(accountId) {
  const fields = "id,name,daily_budget,lifetime_budget,effective_status,optimization_goal,destination_type,campaign{id,name,daily_budget,lifetime_budget}".replace(/{/g, "%7B").replace(/}/g, "%7D");
  let url = `${GRAPH}/${V}/act_${accountId}/adsets?fields=${fields}&limit=200&access_token=${encodeURIComponent(token())}`;
  const map = {};
  for (let i = 0; i < 15 && url; i++) {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || "Error de Meta (budgets)");
    for (const a of j.data || []) {
      const c = a.campaign || {};
      const cbo = !a.daily_budget && !a.lifetime_budget && !!(c.daily_budget || c.lifetime_budget);
      const cents = (x) => (x ? Math.round(+x / 100) : null);
      const opt = String(a.optimization_goal || "").toUpperCase(), dest = String(a.destination_type || "").toUpperCase();
      const tipo = (opt === "CONVERSATIONS" || /MESSAG|WHATSAPP|MESSENGER/.test(dest)) ? "mensajes" : "ventas";
      map[a.id] = {
        tipo,
        adset: a.name || "",
        campaign_id: c.id || "",
        campaign: c.name || "",
        nivel: cbo ? "CBO" : "ABO",
        unidad: cbo ? "camp:" + (c.id || "") : "adset:" + a.id,
        unidad_nombre: cbo ? (c.name || "") : (a.name || ""),
        budget_diario: cbo ? cents(c.daily_budget) : cents(a.daily_budget),
        budget_total: cbo ? cents(c.lifetime_budget) : cents(a.lifetime_budget),
        status: a.effective_status,
      };
    }
    url = j.paging && j.paging.next ? j.paging.next : null;
  }
  return map;
}

// Trae insights a nivel anuncio (spend, roas, compras) para una cuenta. PAGINADO: sin seguir
// paging.next, Meta corta en `limit` y el panel mostraría una foto incompleta SIN avisar (cuentas
// grandes o rangos largos tipo "maximum" superan los 500 anuncios fácil).
// Si pasás range = { since, until } usa ese rango exacto (modo personalizado); si no, el date_preset.
export async function getAds(accountId, datePreset = "last_30d", range = null) {
  // quality_ranking / engagement_rate_ranking / conversion_rate_ranking: la "clasificación de
  // calidad" de Meta (vs competencia por la misma audiencia). Solo se llena con ≥500 impresiones;
  // si no, viene UNKNOWN. Diagnóstico de creativo, gratis (mismo call de insights).
  // + embudo completo: reach/frequency (fatiga), inline_link_clicks (CTR) y video views 3s/ThruPlay
  // (hook/hold rate). El resto del embudo (landing/VC/ATC/checkout/compra) sale del array actions.
  const fields = ["ad_id", "ad_name", "adset_id", "adset_name", "campaign_name", "spend", "purchase_roas", "actions", "impressions", "reach", "frequency", "inline_link_clicks", "video_thruplay_watched_actions", "video_p100_watched_actions", "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking"].join(",");
  const period = range && range.since && range.until
    ? `time_range=${encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }))}`
    : `date_preset=${datePreset}`;
  let url = `${GRAPH}/${V}/act_${accountId}/insights?level=ad&fields=${fields}&${period}&limit=500&access_token=${encodeURIComponent(token())}`;
  const data = [];
  for (let i = 0; i < 20 && url; i++) {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || "Error de Meta");
    data.push(...(j.data || []));
    url = j.paging && j.paging.next ? j.paging.next : null;
  }
  return data.map((d) => {
    const acts = Array.isArray(d.actions) ? d.actions : [];
    // suma el primer action_type presente de la lista (cubre alias omni_/pixel de Meta)
    const act = (...types) => { const a = acts.find((x) => types.includes(x.action_type)); return a ? num(a.value) : 0; };
    const vidArr = (arr) => Array.isArray(arr) && arr[0] ? num(arr[0].value) : 0; // video_*_watched_actions
    const purchases = act("purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase");
    const conversaciones = act("onsite_conversion.messaging_conversation_started_7d"); // campañas de mensajería
    const roas = Array.isArray(d.purchase_roas) && d.purchase_roas[0] ? num(d.purchase_roas[0].value) : 0;
    // normalizamos UNKNOWN/vacío a null (no es un valor, es "sin datos suficientes")
    const rk = (v) => v && v !== "UNKNOWN" ? v : null;
    return {
      id: d.ad_id, name: d.ad_name || "", adset_id: d.adset_id || "", adset: d.adset_name || "", campaign: d.campaign_name || "",
      spend: num(d.spend), roas, ventas: purchases, conversaciones, impressions: num(d.impressions),
      calidad: rk(d.quality_ranking), interaccion: rk(d.engagement_rate_ranking), conversion: rk(d.conversion_rate_ranking),
      // embudo (conteos; reach NO se puede sumar entre ads — frequency viene deduplicada por ad)
      reach: num(d.reach), frequency: num(d.frequency), linkClicks: num(d.inline_link_clicks),
      video3s: act("video_view"), thruplay: vidArr(d.video_thruplay_watched_actions), video100: vidArr(d.video_p100_watched_actions),
      lpv: act("landing_page_view", "omni_landing_page_view"),
      viewContent: act("view_content", "omni_view_content", "offsite_conversion.fb_pixel_view_content"),
      addToCart: act("add_to_cart", "omni_add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"),
      checkout: act("initiate_checkout", "omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout"),
    };
  });
}

// Trae el targeting REAL de cada adset (audiencias custom, lookalikes, intereses, Advantage+).
// Una sola llamada paginada por cuenta; el cruce con anuncios se hace por adset_id. Si falla,
// el panel cae al parseo del NOMBRE del conjunto (parseAudience), así nada se rompe.
export async function getAdsetTargeting(accountId) {
  const fields = "id,name,targeting,optimization_goal,destination_type";
  let url = `${GRAPH}/${V}/act_${accountId}/adsets?fields=${fields}&limit=200&access_token=${encodeURIComponent(token())}`;
  const map = {};
  for (let i = 0; i < 15 && url; i++) {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || "Error de Meta (adsets)");
    for (const a of j.data || []) map[a.id] = a;
    url = j.paging && j.paging.next ? j.paging.next : null;
  }
  return map;
}

// Salud del pixel/tracking — lo que el token de Sistema SÍ puede leer (el OBJETO pixel del ad
// account). EMQ por evento, dedup y server/browser de CAPI quedan FUERA: requieren asignar el
// system user al dataset en Events Manager (con el token actual /stats y /event_quality dan
// Permission Denied). Eso es la fase 2B. Acá: inventario, si dispara, advanced matching y match
// rate aproximado — alcanza para detectar pixel muerto, pixel duplicado y matching apagado.
export async function getTrackingHealth(accountId) {
  const fields = "id,name,last_fired_time,is_unavailable,enable_automatic_matching,automatic_matching_fields,match_rate_approx";
  const url = `${GRAPH}/${V}/act_${accountId}/adspixels?fields=${fields}&access_token=${encodeURIComponent(token())}`;
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "Error de Meta (pixels)");
  const now = Date.now();
  const pixels = (j.data || []).map((p) => {
    const dias = p.last_fired_time ? Math.round((now - new Date(p.last_fired_time).getTime()) / 86400000) : null;
    return {
      nombre: p.name || p.id,
      dias_sin_disparar: dias,                  // null = nunca disparó (pixel muerto)
      disparando: dias != null && dias <= 2,    // actividad en las últimas 48h
      advanced_matching: !!p.enable_automatic_matching,
      campos_matching: (p.automatic_matching_fields || []).length,
      match_rate_aprox: p.match_rate_approx != null && +p.match_rate_approx >= 0 ? +(+p.match_rate_approx).toFixed(2) : null, // Meta devuelve -1 = no disponible
      no_disponible: !!p.is_unavailable,
    };
  });
  const vivos = pixels.filter((p) => p.disparando);
  return {
    total_pixels: pixels.length,
    multiples_pixels: pixels.length > 1,                      // varios pixels = atribución dispersa
    pixels_sin_disparar: pixels.filter((p) => !p.disparando).length, // muertos/inactivos
    advanced_matching_off: vivos.some((p) => !p.advanced_matching),  // algún pixel vivo sin matching
    pixels,
    emq_capi_disponible: false, // fase 2B: requiere permiso del system user sobre el dataset
  };
}
