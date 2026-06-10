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

// Trae insights a nivel anuncio (spend, roas, compras) para una cuenta.
// Si pasás range = { since, until } usa ese rango exacto (modo personalizado); si no, el date_preset.
export async function getAds(accountId, datePreset = "last_30d", range = null) {
  const fields = ["ad_id", "ad_name", "adset_id", "adset_name", "campaign_name", "spend", "purchase_roas", "actions", "impressions"].join(",");
  const period = range && range.since && range.until
    ? `time_range=${encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }))}`
    : `date_preset=${datePreset}`;
  const url = `${GRAPH}/${V}/act_${accountId}/insights?level=ad&fields=${fields}&${period}&limit=500&access_token=${encodeURIComponent(token())}`;
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "Error de Meta");
  return (j.data || []).map((d) => {
    let purchases = 0, conversaciones = 0;
    if (Array.isArray(d.actions)) {
      const p = d.actions.find((a) => ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type));
      if (p) purchases = num(p.value);
      // mensajes: conversaciones iniciadas (campañas de mensajería)
      const c = d.actions.find((a) => a.action_type === "onsite_conversion.messaging_conversation_started_7d");
      if (c) conversaciones = num(c.value);
    }
    const roas = Array.isArray(d.purchase_roas) && d.purchase_roas[0] ? num(d.purchase_roas[0].value) : 0;
    return { id: d.ad_id, name: d.ad_name || "", adset_id: d.adset_id || "", adset: d.adset_name || "", campaign: d.campaign_name || "", spend: num(d.spend), roas, ventas: purchases, conversaciones, impressions: num(d.impressions) };
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
