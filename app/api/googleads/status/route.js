import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { SESSION_COOKIE, verifySession, authDisabled } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Estado de campañas de Google Ads (solo lectura): campañas ACTIVAS por cuenta cliente de la MCC
// y su gasto de un día. Acceso: sesión de la app O header `x-nusa-key` (= env NUSA_READ_KEY).
// Esta ruta solo hace consultas GAQL (SELECT); no modifica nada en Google Ads.
// GET /api/googleads/status[?date=YYYY-MM-DD]   (default: ayer, hora Argentina)

const V = process.env.GOOGLE_ADS_API_VERSION || "v24";
const BASE = `https://googleads.googleapis.com/${V}`;

function keyOk(req) {
  const want = process.env.NUSA_READ_KEY || "";
  const got = req.headers.get("x-nusa-key") || "";
  if (!want || want.length < 16 || got.length !== want.length) return false;
  try { return timingSafeEqual(Buffer.from(got), Buffer.from(want)); } catch { return false; }
}

const env = (n) => { const v = process.env[n]; if (!v) throw new Error(`Falta ${n}`); return v; };
const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : 0; };

async function accessToken() {
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
  if (!j.access_token) throw new Error("No se pudo renovar el token de Google");
  return j.access_token;
}

async function gaql(token, customerId, query) {
  const r = await fetch(`${BASE}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "developer-token": env("GOOGLE_ADS_DEVELOPER_TOKEN"),
      "login-customer-id": env("GOOGLE_ADS_MCC_ID").replace(/-/g, ""),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json();
  if (j.error || (Array.isArray(j) && j[0]?.error)) throw new Error((j.error || j[0].error).message || "Error de Google Ads");
  return (Array.isArray(j) ? j : [j]).flatMap((c) => c.results || []);
}

const ayerAR = () => {
  const d = new Date(Date.now() - 3 * 3600 * 1000 - 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

export async function GET(req) {
  if (!keyOk(req)) {
    const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
    if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const fecha = searchParams.get("date") || ayerAR();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return Response.json({ error: "date debe ser YYYY-MM-DD" }, { status: 400 });

  try {
    const token = await accessToken();
    const mcc = env("GOOGLE_ADS_MCC_ID").replace(/-/g, "");
    const clientes = (await gaql(token, mcc, `
      SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code,
             customer_client.status, customer_client.manager
      FROM customer_client`))
      .map((r) => r.customerClient)
      .filter((c) => c && !c.manager);

    const cuentas = await Promise.all(clientes.map(async (c) => {
      const base = { id: String(c.id), nombre: c.descriptiveName || String(c.id), moneda: c.currencyCode, estado: c.status };
      if (c.status !== "ENABLED") return { ...base, campanasActivas: [], gastoTotal: 0 };
      try {
        const [camps, gasto] = await Promise.all([
          gaql(token, String(c.id), `
            SELECT campaign.id, campaign.name, campaign.status, campaign.primary_status,
                   campaign.advertising_channel_type
            FROM campaign WHERE campaign.status = 'ENABLED'`),
          gaql(token, String(c.id), `
            SELECT campaign.id, metrics.cost_micros
            FROM campaign WHERE segments.date = '${fecha}'`),
        ]);
        const costo = {};
        for (const r of gasto) costo[String(r.campaign?.id)] = (costo[String(r.campaign?.id)] || 0) + num(r.metrics?.costMicros) / 1e6;
        const campanasActivas = camps.map((r) => ({
          id: String(r.campaign.id), nombre: r.campaign.name, canal: r.campaign.advertisingChannelType,
          estadoEntrega: r.campaign.primaryStatus || null, gasto: Math.round((costo[String(r.campaign.id)] || 0) * 100) / 100,
        }));
        return { ...base, campanasActivas, gastoTotal: Math.round(campanasActivas.reduce((a, x) => a + x.gasto, 0) * 100) / 100 };
      } catch (e) {
        return { ...base, campanasActivas: [], gastoTotal: 0, error: e.message };
      }
    }));
    return Response.json({ fecha, cuentas });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
