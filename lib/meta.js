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

// Trae insights a nivel anuncio (spend, roas, compras) para una cuenta.
export async function getAds(accountId, datePreset = "last_30d") {
  const fields = ["ad_id", "ad_name", "adset_name", "spend", "purchase_roas", "actions", "impressions"].join(",");
  const url = `${GRAPH}/${V}/act_${accountId}/insights?level=ad&fields=${fields}&date_preset=${datePreset}&limit=500&access_token=${encodeURIComponent(token())}`;
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "Error de Meta");
  return (j.data || []).map((d) => {
    let purchases = 0;
    if (Array.isArray(d.actions)) {
      const p = d.actions.find((a) => ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type));
      if (p) purchases = num(p.value);
    }
    const roas = Array.isArray(d.purchase_roas) && d.purchase_roas[0] ? num(d.purchase_roas[0].value) : 0;
    return { id: d.ad_id, name: d.ad_name || "", adset: d.adset_name || "", spend: num(d.spend), roas, ventas: purchases, impressions: num(d.impressions) };
  });
}
