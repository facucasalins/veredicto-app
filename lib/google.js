// Cliente de la Google Ads API (REST + GAQL, server-side).
// Auth: refresh token permanente -> access tokens de ~1h renovados solos.
// Env vars: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET,
//           GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_MCC_ID (sin guiones).
const V = process.env.GOOGLE_ADS_API_VERSION || "v24";
const BASE = `https://googleads.googleapis.com/${V}`;

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} en las variables de entorno`);
  return v;
}

const mccId = () => env("GOOGLE_ADS_MCC_ID").replace(/-/g, "");
const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : 0; };

// Ids prefijados "g:" para convivir con Meta y TikTok ("tt:") en el mismo dropdown de cuentas.
export const isGoogle = (id) => String(id || "").startsWith("g:");
export const gId = (id) => String(id || "").replace(/^g:/, "");

// Sin las env vars la feature queda apagada y el dropdown muestra solo Meta/TikTok (degradación
// elegante, mismo contrato que ttEnabled).
export function gEnabled() {
  return !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET && process.env.GOOGLE_ADS_REFRESH_TOKEN && process.env.GOOGLE_ADS_MCC_ID);
}

// Cache del access token en memoria del proceso (dura ~1h, renovamos a los 50 min).
let _token = null;
let _tokenExp = 0;

async function getAccessToken() {
  if (_token && Date.now() < _tokenExp) return _token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env("GOOGLE_ADS_CLIENT_ID"),
      client_secret: env("GOOGLE_ADS_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_ADS_REFRESH_TOKEN"),
    }),
    cache: "no-store",
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(j.error_description || "No se pudo renovar el access token de Google");
  _token = j.access_token;
  _tokenExp = Date.now() + 50 * 60 * 1000;
  return _token;
}

// Ejecuta una query GAQL contra una cuenta via searchStream.
async function gaql(customerId, query) {
  const token = await getAccessToken();
  const r = await fetch(`${BASE}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "developer-token": env("GOOGLE_ADS_DEVELOPER_TOKEN"),
      "login-customer-id": mccId(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  const j = await r.json();
  if (j.error || (Array.isArray(j) && j[0]?.error)) {
    const e = j.error || j[0].error;
    throw new Error(e.message || "Error de Google Ads");
  }
  // searchStream devuelve un array de chunks, cada uno con results[].
  return (Array.isArray(j) ? j : [j]).flatMap((chunk) => chunk.results || []);
}

// Lista las cuentas cliente (no manager) activas bajo la MCC — a CUALQUIER profundidad, así una
// sub-MCC intermedia no esconde cuentas.
export async function getAccounts() {
  const rows = await gaql(mccId(), `
    SELECT customer_client.id, customer_client.descriptive_name,
           customer_client.currency_code, customer_client.status, customer_client.manager
    FROM customer_client`);
  return rows
    .map((r) => r.customerClient)
    .filter((c) => c && !c.manager && c.status === "ENABLED")
    .map((c) => ({ id: "g:" + c.id, name: "🔍 " + (c.descriptiveName || String(c.id)), currency: c.currencyCode, platform: "google" }));
}

// Cláusula de período GAQL: keyword (LAST_30_DAYS, THIS_MONTH) o { since, until } → BETWEEN.
function periodClause(range) {
  return range && typeof range === "object" && range.since && range.until
    ? `segments.date BETWEEN '${range.since}' AND '${range.until}'`
    : `segments.date DURING ${range}`;
}

// Insights a nivel anuncio para una cuenta (mismo shape que lib/meta.js).
// range: keyword GAQL (ej. LAST_30_DAYS, THIS_MONTH) o un objeto { since, until } con fechas
// YYYY-MM-DD, para los rangos personalizados del panel (→ BETWEEN en GAQL).
// PMax no tiene anuncios (corre con asset groups) → se trae aparte de asset_group y cada asset
// group entra como una fila más (id/adset_id prefijados "ag:"), así su spend SÍ aparece en el panel.
// Y hay canales que NO reportan ni a nivel anuncio ni ad group (Smart campaigns: métricas solo a
// nivel campaña — validado contra cuentas reales, jul 2026): toda campaña con spend que no quedó
// cubierta por las filas de arriba entra como UNA fila propia (id/adset_id "camp:<id>"), para que
// el panel nunca esconda plata invertida.
export async function getAds(customerId, range = "LAST_30_DAYS") {
  const period = periodClause(range);
  const [rows, pmax, camps] = await Promise.all([
    gaql(customerId, `
      SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
             ad_group.id, ad_group.name, campaign.id, campaign.name,
             metrics.cost_micros, metrics.impressions,
             metrics.conversions, metrics.conversions_value
      FROM ad_group_ad
      WHERE ${period}
        AND metrics.cost_micros > 0`),
    gaql(customerId, `
      SELECT asset_group.id, asset_group.name, campaign.id, campaign.name,
             metrics.cost_micros, metrics.impressions,
             metrics.conversions, metrics.conversions_value
      FROM asset_group
      WHERE ${period}
        AND metrics.cost_micros > 0`).catch(() => []), // sin PMax (o sin permiso): seguimos con anuncios
    gaql(customerId, `
      SELECT campaign.id, campaign.name, campaign.advertising_channel_type,
             metrics.cost_micros, metrics.impressions,
             metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE ${period}
        AND metrics.cost_micros > 0`).catch(() => []),
  ]);
  const covered = new Set(); // campañas cuyo spend ya está en filas de anuncio/asset group
  const fila = (id, name, adsetId, adsetName, campaignName, m) => {
    const spend = num(m.costMicros) / 1e6;
    const value = num(m.conversionsValue);
    return {
      id, name,
      adset_id: adsetId,
      adset: adsetName,
      campaign: campaignName,
      spend,
      roas: spend > 0 ? value / spend : 0,
      ventas: num(m.conversions),
      conversaciones: 0, // Google no tiene campañas de mensajería (todo tipo "ventas")
      impressions: num(m.impressions),
    };
  };
  const ads = rows.map((r) => {
    const ad = r.adGroupAd?.ad || {};
    covered.add(String(r.campaign?.id));
    // muchos formatos de Google no llevan nombre → cae al tipo + id
    return fila(String(ad.id), ad.name || `${ad.type || "AD"} ${ad.id}`,
      String(r.adGroup?.id || ""), r.adGroup?.name || "", r.campaign?.name || "", r.metrics || {});
  });
  for (const r of pmax) {
    const ag = r.assetGroup || {};
    covered.add(String(r.campaign?.id));
    ads.push(fila("ag:" + ag.id, `PMax · ${r.campaign?.name || ""} · ${ag.name || ag.id}`,
      "ag:" + ag.id, ag.name || "", r.campaign?.name || "", r.metrics || {}));
  }
  for (const r of camps) {
    const c = r.campaign || {};
    if (covered.has(String(c.id))) continue;
    const canal = channelLabel(c.advertisingChannelType);
    ads.push(fila("camp:" + c.id, `${canal} · ${c.name || c.id}`,
      "camp:" + c.id, c.name || "", c.name || "", r.metrics || {}));
  }
  return ads;
}

// Spend/ventas a nivel CUENTA en un rango; con porDia=true desglosa día por día (mismo contrato
// que tiktok.getAccountSpend — "roasMeta" acá es el ROAS de conversiones de Google). Agrega desde
// el recurso customer, así que incluye TODO el spend de la cuenta (también PMax).
export async function getAccountSpend(customerId, since, until, porDia = false) {
  const rows = await gaql(customerId, `
    SELECT ${porDia ? "segments.date, " : ""}metrics.cost_micros, metrics.conversions, metrics.conversions_value
    FROM customer
    WHERE segments.date BETWEEN '${since}' AND '${until}'${porDia ? " ORDER BY segments.date" : ""}`);
  if (porDia) {
    return rows.map((r) => ({
      fecha: String(r.segments?.date || ""),
      spend: num(r.metrics?.costMicros) / 1e6,
      ventas: Math.round(num(r.metrics?.conversions)),
    }));
  }
  // searchStream puede partir en chunks → sumamos por las dudas (sin segmentar es una sola fila)
  let spend = 0, ventas = 0, value = 0;
  for (const r of rows) {
    const m = r.metrics || {};
    spend += num(m.costMicros) / 1e6; ventas += num(m.conversions); value += num(m.conversionsValue);
  }
  return { spend: Math.round(spend), roasMeta: spend > 0 ? +(value / spend).toFixed(2) : 0, ventasMeta: Math.round(ventas) };
}

// Etiquetas legibles del tipo de campaña — hacen de "audiencia" en el panel: Google no clasifica
// Hot/Tibio/LAL como Meta, la señal útil acá es el CANAL por el que entra la plata.
const CHANNEL_LABEL = {
  SEARCH: "Búsqueda", PERFORMANCE_MAX: "PMax", SHOPPING: "Shopping", DISPLAY: "Display",
  VIDEO: "Video/YouTube", DEMAND_GEN: "Demand Gen", SMART: "Smart", LOCAL: "Local",
  MULTI_CHANNEL: "Multi-canal",
};
const channelLabel = (t) => CHANNEL_LABEL[String(t || "").toUpperCase()] || String(t || "") || "nd";

// Mapa adset_id → etiqueta de canal (equivalente al audMap de Meta/TikTok; mismas claves que las
// filas de getAds: ad group id, "ag:" + asset group id, o "camp:" + campaign id del fallback).
export async function getChannelAudiences(customerId) {
  const [ags, asgs, camps] = await Promise.all([
    gaql(customerId, `
      SELECT ad_group.id, campaign.advertising_channel_type
      FROM ad_group WHERE ad_group.status != 'REMOVED'`),
    gaql(customerId, `SELECT asset_group.id FROM asset_group`).catch(() => []),
    gaql(customerId, `SELECT campaign.id, campaign.advertising_channel_type FROM campaign`).catch(() => []),
  ]);
  const map = {};
  for (const r of ags) map[String(r.adGroup?.id)] = channelLabel(r.campaign?.advertisingChannelType);
  for (const r of asgs) map["ag:" + r.assetGroup?.id] = "PMax";
  for (const r of camps) map["camp:" + r.campaign?.id] = channelLabel(r.campaign?.advertisingChannelType);
  return map;
}

// Budget real por unidad (mismo contrato que meta.getAdsetBudgets / tiktok). En Google el budget
// vive SIEMPRE en la campaña (campaign_budget) → todas las unidades son "CBO" y la unidad es la
// campaña. Claves del mapa = adset_id de las filas de getAds (ad group id o "ag:" + asset group id).
export async function getAdsetBudgets(customerId) {
  const [camps, adgroups, assetGroups] = await Promise.all([
    gaql(customerId, `
      SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
             campaign_budget.amount_micros
      FROM campaign WHERE campaign.status != 'REMOVED'`),
    gaql(customerId, `
      SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id
      FROM ad_group WHERE ad_group.status != 'REMOVED'`).catch(() => []),
    gaql(customerId, `
      SELECT asset_group.id, asset_group.name, asset_group.status, campaign.id
      FROM asset_group`).catch(() => []),
  ]);
  const campMap = {};
  for (const r of camps) {
    const c = r.campaign || {};
    campMap[String(c.id)] = {
      name: c.name || "", status: c.status,
      canal: channelLabel(c.advertisingChannelType),
      budget: num(r.campaignBudget?.amountMicros) / 1e6,
    };
  }
  const map = {};
  const unit = (adsetId, adsetName, adsetStatus, campId) => {
    const c = campMap[campId];
    if (!c) return; // campaña REMOVED: sus grupos no son unidades accionables
    map[adsetId] = {
      tipo: "ventas",
      adset: adsetName,
      campaign_id: campId,
      campaign: c.name,
      nivel: "CBO",
      unidad: "camp:" + campId,
      unidad_nombre: c.name + " (" + c.canal + ")",
      budget_diario: c.budget > 0 ? Math.round(c.budget) : null,
      budget_total: null,
      status: c.status === "ENABLED" && adsetStatus === "ENABLED" ? "ACTIVE" : "PAUSED",
    };
  };
  for (const r of adgroups) unit(String(r.adGroup?.id), r.adGroup?.name || "", r.adGroup?.status, String(r.campaign?.id));
  for (const r of assetGroups) unit("ag:" + r.assetGroup?.id, r.assetGroup?.name || "", r.assetGroup?.status, String(r.campaign?.id));
  // filas fallback a nivel campaña (Smart y otros canales sin reporte por anuncio)
  for (const campId in campMap) unit("camp:" + campId, campMap[campId].name, "ENABLED", campId);
  return map;
}

// Estado de entrega REAL por anuncio mirando la CADENA completa (mismo contrato que
// meta.getAdStatuses): "ACTIVE" solo si el anuncio, su ad group y su campaña están ENABLED;
// si lo apagado está arriba devuelve CAMPAIGN_PAUSED / ADSET_PAUSED. También cubre los asset
// groups de PMax ("ag:<id>") y las campañas del fallback de getAds ("camp:<id>").
export async function getAdStatuses(customerId) {
  const [rows, asgs, camps] = await Promise.all([
    gaql(customerId, `
      SELECT ad_group_ad.ad.id, ad_group_ad.status, ad_group.status, campaign.status
      FROM ad_group_ad`),
    gaql(customerId, `
      SELECT asset_group.id, asset_group.status, campaign.status
      FROM asset_group`).catch(() => []),
    gaql(customerId, `SELECT campaign.id, campaign.status FROM campaign`).catch(() => []),
  ]);
  const map = {};
  for (const r of rows) {
    const id = String(r.adGroupAd?.ad?.id || "");
    if (!id) continue;
    map[id] = r.campaign?.status !== "ENABLED" ? "CAMPAIGN_PAUSED"
      : r.adGroup?.status !== "ENABLED" ? "ADSET_PAUSED"
      : r.adGroupAd?.status === "ENABLED" ? "ACTIVE" : "PAUSED";
  }
  for (const r of asgs) {
    const id = String(r.assetGroup?.id || "");
    if (!id) continue;
    map["ag:" + id] = r.campaign?.status !== "ENABLED" ? "CAMPAIGN_PAUSED"
      : r.assetGroup?.status === "ENABLED" ? "ACTIVE" : "PAUSED";
  }
  for (const r of camps) {
    const id = String(r.campaign?.id || "");
    if (!id) continue;
    map["camp:" + id] = r.campaign?.status === "ENABLED" ? "ACTIVE" : "CAMPAIGN_PAUSED";
  }
  return map;
}
