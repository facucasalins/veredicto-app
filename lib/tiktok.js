// lib/tiktok.js
// Cliente de la TikTok Marketing API (Business API v1.3), espejo de lib/meta.js. Read-only.
//
// Degradación elegante: sin env vars, ttEnabled() es false y la app no muestra cuentas de TikTok
// (todo sigue como antes). Las cuentas TikTok viven en el MISMO dropdown que las de Meta, con id
// prefijado "tt:<advertiser_id>" — las rutas branchean por ese prefijo.
//
// Env:
//   TIKTOK_ACCESS_TOKEN — token de larga vida (autorización del Business Center)
//   TIKTOK_APP_ID, TIKTOK_SECRET — credenciales de la app de developer (para listar advertisers)
//   TIKTOK_ADVERTISERS — (opcional) JSON ["id1","id2"] para limitar qué cuentas se muestran
//
// OJO: los nombres de métricas/campos se escribieron contra la doc v1.3 SIN poder probar contra
// la API real (falta el token). En la primera conexión real pueden necesitar ajuste fino.

const BASE = "https://business-api.tiktok.com/open_api/v1.3";

export function ttEnabled() {
  return !!(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_APP_ID && process.env.TIKTOK_SECRET);
}
const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : 0; };

// GET con query params; arrays van como JSON string (así lo pide TikTok). Respuesta {code,message,data}.
async function tt(path, params = {}) {
  const qs = new URLSearchParams();
  for (const k in params) {
    const v = params[k];
    if (v == null) continue;
    qs.set(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
  }
  const r = await fetch(`${BASE}${path}?${qs}`, {
    headers: { "Access-Token": process.env.TIKTOK_ACCESS_TOKEN || "" },
    cache: "no-store",
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`TikTok ${j.code}: ${j.message || "error"}`);
  return j.data || {};
}

// Pagina un endpoint de listado (data.list + data.page_info.total_page).
async function ttPaged(path, params, maxPages = 20) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const d = await tt(path, { ...params, page, page_size: params.page_size || 1000 });
    out.push(...(d.list || []));
    const tp = d.page_info && d.page_info.total_page;
    if (!tp || page >= tp) break;
  }
  return out;
}

// Advertisers autorizados al token (+ moneda y nombre vía /advertiser/info/).
// Ids con prefijo "tt:" para convivir con Meta en el mismo dropdown.
export async function getAccounts() {
  if (!ttEnabled()) return [];
  const d = await tt("/oauth2/advertiser/get/", { app_id: process.env.TIKTOK_APP_ID, secret: process.env.TIKTOK_SECRET });
  let ids = (d.list || []).map((a) => String(a.advertiser_id));
  try {
    const only = JSON.parse(process.env.TIKTOK_ADVERTISERS || "[]");
    if (Array.isArray(only) && only.length) ids = ids.filter((id) => only.map(String).includes(id));
  } catch { /* filtro opcional malformado: mostramos todos */ }
  if (!ids.length) return [];
  const info = await tt("/advertiser/info/", { advertiser_ids: ids.slice(0, 100) });
  return (info.list || []).map((a) => ({
    id: "tt:" + a.advertiser_id,
    name: "🎵 " + (a.name || a.advertiser_name || a.advertiser_id),
    currency: a.currency || "USD",
    status: 1,
    platform: "tiktok",
  }));
}

// Insights a nivel ANUNCIO en un rango {since,until}. Misma forma de fila que meta.getAds, así
// buildRows/nomenclatura funcionan sin cambios (el cruce por (HH.MM.SS) depende solo del nombre).
// TikTok no tiene "conversaciones de WhatsApp" → conversaciones siempre 0 (modo Mensajes no aplica).
export async function getAds(advertiserId, since, until) {
  const rows = await ttPaged("/report/integrated/get/", {
    advertiser_id: advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_AD",
    dimensions: ["ad_id"],
    metrics: ["spend", "impressions", "complete_payment_roas", "complete_payment", "ad_name", "adgroup_id", "adgroup_name", "campaign_name"],
    start_date: since,
    end_date: until,
  });
  return rows.map((r) => {
    const m = r.metrics || {};
    return {
      id: String((r.dimensions || {}).ad_id || ""),
      name: m.ad_name || "",
      adset_id: String(m.adgroup_id || ""),
      adset: m.adgroup_name || "",
      campaign: m.campaign_name || "",
      spend: num(m.spend),
      roas: num(m.complete_payment_roas),
      ventas: Math.round(num(m.complete_payment)),
      conversaciones: 0,
      impressions: num(m.impressions),
    };
  }).filter((r) => r.spend > 0 || r.impressions > 0);
}

// Spend/ventas a nivel CUENTA en un rango; con porDia=true desglosa día por día. Para el chat.
export async function getAccountSpend(advertiserId, since, until, porDia = false) {
  const params = {
    advertiser_id: advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_ADVERTISER",
    dimensions: porDia ? ["advertiser_id", "stat_time_day"] : ["advertiser_id"],
    metrics: ["spend", "complete_payment_roas", "complete_payment"],
    start_date: since,
    end_date: until,
  };
  const rows = await ttPaged("/report/integrated/get/", params);
  if (porDia) {
    return rows.map((r) => ({
      fecha: String((r.dimensions || {}).stat_time_day || "").slice(0, 10),
      spend: num((r.metrics || {}).spend),
      ventas: Math.round(num((r.metrics || {}).complete_payment)),
    })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  const m = (rows[0] || {}).metrics || {};
  return { spend: Math.round(num(m.spend)), roasMeta: num(m.complete_payment_roas), ventasMeta: Math.round(num(m.complete_payment)) };
}

// Estado de entrega REAL por anuncio, mirando la cadena (mismo contrato que meta.getAdStatuses):
// "ACTIVE" solo si entrega; si lo apagado está arriba devuelve CAMPAIGN_PAUSED / ADSET_PAUSED.
// TikTok lo resuelve solo con secondary_status del ad (ya refleja la cadena).
export async function getAdStatuses(advertiserId) {
  const ads = await ttPaged("/ad/get/", { advertiser_id: advertiserId, fields: ["ad_id", "operation_status", "secondary_status"] });
  const map = {};
  for (const a of ads) {
    const sec = String(a.secondary_status || "").toUpperCase();
    let status;
    if (/DELIVERY_OK/.test(sec)) status = "ACTIVE";
    else if (/CAMPAIGN_DISABLE|CAMPAIGN_PAUSED/.test(sec)) status = "CAMPAIGN_PAUSED";
    else if (/ADGROUP_DISABLE|ADGROUP_PAUSED/.test(sec)) status = "ADSET_PAUSED";
    else status = sec || (a.operation_status === "ENABLE" ? "ACTIVE" : "PAUSED");
    map[String(a.ad_id)] = status;
  }
  return map;
}

// Adgroups con budget + clasificación de audiencia básica. Devuelve { adgroups, campaigns }.
async function getAdgroupsRaw(advertiserId) {
  const [adgroups, campaigns] = await Promise.all([
    ttPaged("/adgroup/get/", { advertiser_id: advertiserId, fields: ["adgroup_id", "adgroup_name", "campaign_id", "budget", "budget_mode", "operation_status", "optimization_goal", "audience_ids", "interest_category_ids", "auto_targeting_enabled"] }),
    ttPaged("/campaign/get/", { advertiser_id: advertiserId, fields: ["campaign_id", "campaign_name", "budget", "budget_mode", "operation_status", "budget_optimize_on"] }),
  ]);
  return { adgroups, campaigns };
}

// Clasificación de audiencia desde el targeting real del adgroup (versión TikTok, más simple que
// la de Meta: sin nombres de audiencias custom no podemos separar Hot/Tibio).
function classifyAdgroup(g) {
  if (Array.isArray(g.audience_ids) && g.audience_ids.length) return "Custom/Retargeting";
  if (Array.isArray(g.interest_category_ids) && g.interest_category_ids.length) return "Amplio/Intereses";
  if (g.auto_targeting_enabled) return "Smart+ (auto)";
  return "Amplio";
}

// Mapa adgroup_id → etiqueta de audiencia (equivalente al audMap de Meta).
export async function getAdgroupAudiences(advertiserId) {
  const { adgroups } = await getAdgroupsRaw(advertiserId);
  const map = {};
  for (const g of adgroups) map[String(g.adgroup_id)] = classifyAdgroup(g);
  return map;
}

// Budget real por unidad (mismo contrato que meta.getAdsetBudgets): ABO = budget en el adgroup,
// CBO = budget en la campaña (budget_optimize_on). Para el Plan.
export async function getAdsetBudgets(advertiserId) {
  const { adgroups, campaigns } = await getAdgroupsRaw(advertiserId);
  const camp = {};
  for (const c of campaigns) camp[String(c.campaign_id)] = c;
  const map = {};
  for (const g of adgroups) {
    const c = camp[String(g.campaign_id)] || {};
    const cbo = !!c.budget_optimize_on;
    const daily = (x, mode) => (String(mode || "").toUpperCase() === "BUDGET_MODE_DAY" && num(x) > 0 ? Math.round(num(x)) : null);
    const total = (x, mode) => (String(mode || "").toUpperCase() === "BUDGET_MODE_TOTAL" && num(x) > 0 ? Math.round(num(x)) : null);
    map[String(g.adgroup_id)] = {
      tipo: "ventas",
      adset: g.adgroup_name || "",
      campaign_id: String(g.campaign_id || ""),
      campaign: c.campaign_name || "",
      nivel: cbo ? "CBO" : "ABO",
      unidad: cbo ? "camp:" + (g.campaign_id || "") : "adset:" + g.adgroup_id,
      unidad_nombre: cbo ? (c.campaign_name || "") : (g.adgroup_name || ""),
      budget_diario: cbo ? daily(c.budget, c.budget_mode) : daily(g.budget, g.budget_mode),
      budget_total: cbo ? total(c.budget, c.budget_mode) : total(g.budget, g.budget_mode),
      status: g.operation_status === "ENABLE" ? "ACTIVE" : "PAUSED",
    };
  }
  return map;
}

// Helpers de prefijo: "tt:123" ↔ "123"
export const isTikTok = (accountId) => String(accountId || "").startsWith("tt:");
export const ttId = (accountId) => String(accountId || "").replace(/^tt:/, "");
