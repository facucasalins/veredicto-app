// Cliente de la Google Analytics 4 Data API (runReport, REST). PILOTO.
//
// Qué suma GA4 al panel: la foto FULL-FUNNEL del sitio que ninguna plataforma de ads ve —
// sesiones REALES de todos los canales (orgánico, directo, email, paid search, paid social),
// el embudo del sitio (sesión → carrito → checkout → compra) con sus tasas, y de qué canal
// viene la venta. Con eso la brecha MER vs ROAS pixel por fin se puede DESCOMPONER (cuánto es
// orgánico vs pago) en vez de estar prohibido atribuirla.
//
// Auth: mismo OAuth client que Google Ads, pero el refresh token tiene que incluir el scope
// https://www.googleapis.com/auth/analytics.readonly (el actual solo tiene adwords → hay que
// regenerarlo pidiendo AMBOS scopes; se puede guardar en GOOGLE_OAUTH_REFRESH_TOKEN o pisar
// GOOGLE_ADS_REFRESH_TOKEN si se mintió con los dos).
//
// Env vars:
// - GA4_PROPERTIES: JSON [{ name, property_id, account?, store? }] — mapea cada propiedad GA4
//   a una cuenta de ads y/o tienda del panel (property_id numérico, sin "properties/").
// - GA4_DEMO=1 → MODO DEMO: devuelve datos de muestra realistas (marcados demo:true) para ver
//   el módulo en la app sin conectar nada. Sin GA4_PROPERTIES ni GA4_DEMO la feature queda
//   apagada y el panel se ve como antes (misma degradación que TikTok/Google).
//
// OJO: métricas escritas contra la doc de la Data API v1beta SIN probar contra una propiedad
// real (falta el scope) — al conectar la primera, verificar nombres (sessions, totalUsers,
// addToCarts, checkouts, transactions, purchaseRevenue, sessionDefaultChannelGroup).

const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : 0; };

export function gaDemo() { return !!process.env.GA4_DEMO; }

export function gaEnabled() {
  if (gaDemo()) return true;
  return !!(process.env.GA4_PROPERTIES &&
    process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET &&
    (process.env.GOOGLE_OAUTH_REFRESH_TOKEN || process.env.GOOGLE_ADS_REFRESH_TOKEN));
}

function properties() {
  try { return JSON.parse(process.env.GA4_PROPERTIES || "[]"); } catch { return []; }
}

// Propiedad GA4 para la vista actual: matchea por tienda o por cuenta de ads; si hay una sola,
// esa. null = no hay propiedad para este cliente (el front no muestra nada).
export function propertyFor(account, store) {
  const props = properties();
  if (gaDemo() && !props.length) return { name: "DEMO", property_id: "0" };
  const hit = props.find((p) => (store && p.store === store) || (account && String(p.account) === String(account)));
  return hit || (props.length === 1 ? props[0] : null);
}

// Access token con el scope de Analytics (cache ~50 min, mismo esquema que lib/google.js).
let _token = null;
let _tokenExp = 0;
async function getAccessToken() {
  if (_token && Date.now() < _tokenExp) return _token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || process.env.GOOGLE_ADS_REFRESH_TOKEN,
    }),
    cache: "no-store",
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(j.error_description || "No se pudo renovar el access token de Google (GA4)");
  _token = j.access_token;
  _tokenExp = Date.now() + 50 * 60 * 1000;
  return _token;
}

async function runReport(propertyId, body) {
  const token = await getAccessToken();
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "Error de GA4");
  return j;
}

const METRICS = ["sessions", "totalUsers", "addToCarts", "checkouts", "transactions", "purchaseRevenue"];
const parseRow = (row) => {
  const m = {};
  METRICS.forEach((k, i) => { m[k] = num(row?.metricValues?.[i]?.value); });
  return m;
};
const shape = (m) => ({
  sesiones: Math.round(m.sessions),
  usuarios: Math.round(m.totalUsers),
  carritos: Math.round(m.addToCarts),
  checkouts: Math.round(m.checkouts),
  compras: Math.round(m.transactions),
  revenue: Math.round(m.purchaseRevenue),
  // tasas del embudo (sobre sesiones; GA4 las reporta así — orientativas, no dedupe usuarios)
  cr: m.sessions ? +((m.transactions / m.sessions) * 100).toFixed(2) : 0,
  tasa_carrito: m.sessions ? +((m.addToCarts / m.sessions) * 100).toFixed(2) : 0,
  ticket: m.transactions ? Math.round(m.purchaseRevenue / m.transactions) : 0,
});

// Totales del sitio en el rango: sesiones, embudo (carrito/checkout/compra) y revenue de GA4.
export async function getResumen(propertyId, since, until) {
  if (gaDemo()) return DEMO_RESUMEN;
  const j = await runReport(propertyId, {
    dateRanges: [{ startDate: since, endDate: until }],
    metrics: METRICS.map((name) => ({ name })),
  });
  return shape(parseRow(j.rows?.[0]));
}

// Desglose por canal (sessionDefaultChannelGroup): de dónde vienen las sesiones y las COMPRAS.
// Esto es lo que descompone la brecha MER vs ROAS pixel: cuánta venta es orgánica/directa/email
// vs paga — hoy el panel no lo puede ver con ninguna otra fuente.
export async function getCanales(propertyId, since, until) {
  if (gaDemo()) return DEMO_CANALES;
  const j = await runReport(propertyId, {
    dateRanges: [{ startDate: since, endDate: until }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: METRICS.map((name) => ({ name })),
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });
  return (j.rows || []).map((row) => ({ canal: row.dimensionValues?.[0]?.value || "?", ...shape(parseRow(row)) }));
}

// Serie diaria (para cruzar con inversión/facturación en el gráfico): sesiones y compras por día.
export async function getDaily(propertyId, since, until) {
  if (gaDemo()) return DEMO_DAILY(since, until);
  const j = await runReport(propertyId, {
    dateRanges: [{ startDate: since, endDate: until }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "transactions" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  return (j.rows || []).map((row) => ({
    fecha: String(row.dimensionValues?.[0]?.value || "").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
    sesiones: Math.round(num(row.metricValues?.[0]?.value)),
    compras: Math.round(num(row.metricValues?.[1]?.value)),
  }));
}

// ── MODO DEMO: números de muestra realistas para un ecommerce mediano argentino ──
const DEMO_RESUMEN = {
  sesiones: 48230, usuarios: 39480, carritos: 3860, checkouts: 1930, compras: 869,
  revenue: 74500000, cr: 1.8, tasa_carrito: 8.0, ticket: 85731,
};
const DEMO_CANALES = [
  { canal: "Paid Social", sesiones: 21700, usuarios: 18400, carritos: 1750, checkouts: 830, compras: 355, revenue: 29800000, cr: 1.64, tasa_carrito: 8.06, ticket: 83944 },
  { canal: "Organic Search", sesiones: 9650, usuarios: 8300, carritos: 890, checkouts: 470, compras: 235, revenue: 21400000, cr: 2.44, tasa_carrito: 9.22, ticket: 91064 },
  { canal: "Direct", sesiones: 7960, usuarios: 6200, carritos: 640, checkouts: 330, compras: 152, revenue: 13100000, cr: 1.91, tasa_carrito: 8.04, ticket: 86184 },
  { canal: "Paid Search", sesiones: 4820, usuarios: 4100, carritos: 350, checkouts: 170, compras: 78, revenue: 6400000, cr: 1.62, tasa_carrito: 7.26, ticket: 82051 },
  { canal: "Email", sesiones: 2400, usuarios: 1900, carritos: 160, checkouts: 90, compras: 38, revenue: 2900000, cr: 1.58, tasa_carrito: 6.67, ticket: 76316 },
  { canal: "Referral", sesiones: 1700, usuarios: 1450, carritos: 70, checkouts: 40, compras: 11, revenue: 900000, cr: 0.65, tasa_carrito: 4.12, ticket: 81818 },
];
function DEMO_DAILY(since, until) {
  const out = [];
  const s = new Date(since + "T00:00:00Z"), u = new Date(until + "T00:00:00Z");
  for (let d = new Date(s), i = 0; d <= u; d.setUTCDate(d.getUTCDate() + 1), i++) {
    const base = 1500 + Math.round(400 * Math.sin(i / 2)) + (d.getUTCDay() === 0 ? -300 : 0);
    out.push({ fecha: d.toISOString().slice(0, 10), sesiones: base, compras: Math.round(base * 0.018) });
  }
  return out;
}
