import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { SESSION_COOKIE, verifySession, authDisabled } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Unidades TOTALES vendidas por tienda en un rango (solo lectura).
// Acceso: sesión de la app (como el resto) O header x-nusa-key igual a la env NUSA_READ_KEY
// (para tareas automáticas que no tienen cookie). Esta ruta solo lee órdenes: no escribe nada.
// GET /api/tiendanube/units?store=Shark&since=YYYY-MM-DD&until=YYYY-MM-DD[&count=pagadas|no_canceladas]

const API = "https://api.tiendanube.com/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function keyOk(req) {
  const want = process.env.NUSA_READ_KEY || "";
  const got = req.headers.get("x-nusa-key") || "";
  if (!want || want.length < 16 || got.length !== want.length) return false;
  try { return timingSafeEqual(Buffer.from(got), Buffer.from(want)); } catch { return false; }
}

function findStore(name) {
  try { const s = JSON.parse(process.env.TIENDANUBE_STORES || "[]"); return (Array.isArray(s) ? s : []).find((x) => x.name === name) || null; }
  catch { return null; }
}

async function tnGet(store, path) {
  const ua = process.env.TIENDANUBE_UA || "NUSA App (permutas.dev@gmail.com)";
  const headers = { Authentication: `bearer ${store.token}`, "User-Agent": ua, "Content-Type": "application/json" };
  for (let i = 0; i <= 3; i++) {
    let res;
    try { res = await fetch(`${API}/${store.store_id}${path}`, { headers, cache: "no-store", signal: AbortSignal.timeout(25000) }); }
    catch (e) { if (i < 3) { await sleep(500 * 2 ** i); continue; } throw e; }
    if (res.status === 429 || res.status >= 500) { if (i < 3) { await sleep(Math.min(500 * 2 ** i, 8000)); continue; } throw new Error(`TiendaNube ${res.status}`); }
    if (res.status === 404) return []; // página fuera de rango
    if (!res.ok) throw new Error(`TiendaNube ${res.status}`);
    return res.json();
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("store");
  const since = searchParams.get("since"), until = searchParams.get("until");
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(since || "") || !/^\d{4}-\d{2}-\d{2}$/.test(until || ""))
    return Response.json({ error: "faltan store, since, until (YYYY-MM-DD)" }, { status: 400 });

  if (!keyOk(req)) {
    const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
    if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const store = findStore(name);
  if (!store) return Response.json({ error: "tienda no configurada" }, { status: 404 });
  const crit = searchParams.get("count") === "no_canceladas" ? "no_canceladas"
    : searchParams.get("count") === "pagadas" ? "pagadas"
    : (store.ventas === "no_canceladas" ? "no_canceladas" : "pagadas");

  const min = encodeURIComponent(`${since}T00:00:00-03:00`), max = encodeURIComponent(`${until}T23:59:59-03:00`);
  const qs = (p) => `/orders?created_at_min=${min}&created_at_max=${max}&per_page=100&page=${p}&fields=id,status,payment_status,total,currency,products`;
  let unidades = 0, ordenes = 0, facturacion = 0, moneda = null, fallidas = 0, paginas = 0;
  try {
    for (let base = 1; base <= 100; base += 4) {
      const res = await Promise.all([base, base + 1, base + 2, base + 3].map((p) => tnGet(store, qs(p)).catch((e) => { if (p === 1) throw e; fallidas += 1; return []; })));
      let fin = false;
      for (const arr of res) {
        const data = Array.isArray(arr) ? arr : [];
        if (data.length) paginas += 1;
        if (data.length < 100) fin = true;
        for (const o of data) {
          if (o.status === "cancelled" || o.payment_status === "voided") continue;
          if (crit === "pagadas" && o.payment_status !== "paid") continue;
          if (!moneda && o.currency) moneda = o.currency;
          ordenes += 1; facturacion += parseFloat(o.total) || 0;
          for (const p of o.products || []) unidades += parseFloat(p.quantity) || 0;
        }
      }
      if (fin) break;
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
  return Response.json({ store: name, since, until, criterio: crit, unidades: Math.round(unidades), ordenes, facturacion: Math.round(facturacion), moneda: moneda || "ARS", parcial: fallidas > 0, paginasFallidas: fallidas });
}
