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
    .map((c) => ({ id: String(c.id), name: c.descriptiveName || String(c.id), currency: c.currencyCode }));
}

// Insights a nivel anuncio para una cuenta (mismo shape que lib/meta.js).
// range: keyword GAQL, ej. LAST_30_DAYS, LAST_7_DAYS, THIS_MONTH.
export async function getAds(customerId, range = "LAST_30_DAYS") {
  const rows = await gaql(customerId, `
    SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
           ad_group.name, campaign.name,
           metrics.cost_micros, metrics.impressions,
           metrics.conversions, metrics.conversions_value
    FROM ad_group_ad
    WHERE segments.date DURING ${range}
      AND metrics.cost_micros > 0`);
  return rows.map((r) => {
    const ad = r.adGroupAd?.ad || {};
    const m = r.metrics || {};
    const spend = num(m.costMicros) / 1e6;
    const value = num(m.conversionsValue);
    return {
      id: String(ad.id),
      name: ad.name || `${ad.type || "AD"} ${ad.id}`, // muchos formatos de Google no llevan nombre
      adset: r.adGroup?.name || "",
      campaign: r.campaign?.name || "",
      spend,
      roas: spend > 0 ? value / spend : 0,
      ventas: num(m.conversions),
      impressions: num(m.impressions),
    };
  });
}
