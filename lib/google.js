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

// Lista las cuentas cliente (no manager) activas bajo la MCC.
export async function getAccounts() {
  const rows = await gaql(mccId(), `
    SELECT customer_client.id, customer_client.descriptive_name,
           customer_client.currency_code, customer_client.status, customer_client.manager
    FROM customer_client
    WHERE customer_client.level <= 1`);
  return rows
    .map((r) => r.customerClient)
    .filter((c) => c && !c.manager && c.status === "ENABLED")
    .map((c) => ({ id: "g:" + c.id, name: "🔍 " + (c.descriptiveName || String(c.id)), currency: c.currencyCode, platform: "google" }));
}

// Insights a nivel anuncio para una cuenta (mismo shape que lib/meta.js).
// range: keyword GAQL (ej. LAST_30_DAYS, THIS_MONTH) o un objeto { since, until } con fechas
// YYYY-MM-DD, para los rangos personalizados del panel (→ BETWEEN en GAQL).
// OJO: ad_group_ad NO incluye Performance Max (PMax corre con asset groups, no con anuncios) —
// el spend de PMax no aparece a nivel anuncio.
export async function getAds(customerId, range = "LAST_30_DAYS") {
  const period = range && typeof range === "object" && range.since && range.until
    ? `segments.date BETWEEN '${range.since}' AND '${range.until}'`
    : `segments.date DURING ${range}`;
  const rows = await gaql(customerId, `
    SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
           ad_group.id, ad_group.name, campaign.name,
           metrics.cost_micros, metrics.impressions,
           metrics.conversions, metrics.conversions_value
    FROM ad_group_ad
    WHERE ${period}
      AND metrics.cost_micros > 0`);
  return rows.map((r) => {
    const ad = r.adGroupAd?.ad || {};
    const m = r.metrics || {};
    const spend = num(m.costMicros) / 1e6;
    const value = num(m.conversionsValue);
    return {
      id: String(ad.id),
      name: ad.name || `${ad.type || "AD"} ${ad.id}`, // muchos formatos de Google no llevan nombre
      adset_id: String(r.adGroup?.id || ""),
      adset: r.adGroup?.name || "",
      campaign: r.campaign?.name || "",
      spend,
      roas: spend > 0 ? value / spend : 0,
      ventas: num(m.conversions),
      conversaciones: 0, // Google no tiene campañas de mensajería (todo tipo "ventas")
      impressions: num(m.impressions),
    };
  });
}

// Estado de entrega REAL por anuncio mirando la CADENA completa (mismo contrato que
// meta.getAdStatuses): "ACTIVE" solo si el anuncio, su ad group y su campaña están ENABLED;
// si lo apagado está arriba devuelve CAMPAIGN_PAUSED / ADSET_PAUSED.
export async function getAdStatuses(customerId) {
  const rows = await gaql(customerId, `
    SELECT ad_group_ad.ad.id, ad_group_ad.status, ad_group.status, campaign.status
    FROM ad_group_ad`);
  const map = {};
  for (const r of rows) {
    const id = String(r.adGroupAd?.ad?.id || "");
    if (!id) continue;
    map[id] = r.campaign?.status !== "ENABLED" ? "CAMPAIGN_PAUSED"
      : r.adGroup?.status !== "ENABLED" ? "ADSET_PAUSED"
      : r.adGroupAd?.status === "ENABLED" ? "ACTIVE" : "PAUSED";
  }
  return map;
}
