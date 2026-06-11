// lib/tiendanube.js
// Cliente de la API de Tienda Nube (Nuvemshop). Cada tienda tiene su propio access_token + store_id,
// que cargás en la env var TIENDANUBE_STORES (JSON). NO todos los clientes tienen Tienda Nube: si no
// hay tiendas configuradas, el selector queda vacío y el panel se ve exactamente igual que hoy.
//
// Env:
//   TIENDANUBE_STORES = [{ "name":"Juanita Shoes", "store_id":"123456", "token":"xx␣...", "account":"1097898049077633" }]
//        name      → etiqueta para el dropdown
//        store_id  → id de la tienda en Tienda Nube
//        token     → access_token de esa tienda
//        account   → (opcional) id de cuenta de Meta asociada, para sugerir el cruce
//   TIENDANUBE_UA     = User-Agent (Tienda Nube lo exige). Default: "NUSA App (permutas.dev@gmail.com)"
//
// Auth: header `Authentication: bearer <token>` (ojo: el header es "Authentication", no "Authorization").

const API = "https://api.tiendanube.com/v1";

function stores() {
  try { const s = JSON.parse(process.env.TIENDANUBE_STORES || "[]"); return Array.isArray(s) ? s : []; }
  catch { return []; }
}

// Solo etiquetas (nunca exponemos tokens al front). `ventas` = criterio de conteo del cliente:
// "pagadas" (default, como el panel de stats de TN) o "no_canceladas" (como cuentan internamente
// algunos clientes, ej. MoraShop: toda orden no cancelada es venta — menos las de pago anulado).
export function listStores() {
  return stores().map((s) => ({ name: s.name, account: s.account || null, ventas: s.ventas === "no_canceladas" ? "no_canceladas" : "pagadas" }));
}

function findStore(name) {
  return stores().find((s) => s.name === name) || null;
}

async function tnGet(store, path) {
  const ua = process.env.TIENDANUBE_UA || "NUSA App (permutas.dev@gmail.com)";
  const res = await fetch(`${API}/${store.store_id}${path}`, {
    headers: { Authentication: `bearer ${store.token}`, "User-Agent": ua, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TiendaNube ${res.status}: ${await res.text()}`);
  return res.json();
}

// Suma la facturación de la tienda en el rango. Pagina hasta agotar (200 por página).
// El endpoint /orders SIN filtro de status devuelve TODO: abiertas, archivadas (closed) y
// canceladas — las archivadas siempre estuvieron, no hay que pedirlas aparte.
//
// `criterio` = qué cuenta como VENTA (definición del cliente, configurable por tienda):
//   "pagadas"        → solo payment_status === "paid" (como el panel de estadísticas de TN)
//   "no_canceladas"  → toda orden no cancelada, pagada o pendiente (como cuenta MoraShop
//                      internamente) — EXCEPTO las de pago anulado (voided), que no son venta
//                      bajo ningún criterio.
// Si no se pasa, usa el default de la tienda (`ventas` en TIENDANUBE_STORES) o "pagadas".
export async function getStoreRevenue(name, since, until, criterio = null) {
  const store = findStore(name);
  if (!store) throw new Error(`Tienda "${name}" no configurada`);
  const crit = criterio === "pagadas" || criterio === "no_canceladas"
    ? criterio
    : (store.ventas === "no_canceladas" ? "no_canceladas" : "pagadas");
  const min = `${since}T00:00:00-03:00`;
  const max = `${until}T23:59:59-03:00`;
  let pagF = 0, pagN = 0, penF = 0, penN = 0, anuN = 0, moneda = null;
  // tope de seguridad para no loopear infinito si algo sale mal
  for (let page = 1; page <= 50; page++) {
    const qs = `?created_at_min=${encodeURIComponent(min)}&created_at_max=${encodeURIComponent(max)}` +
      `&per_page=200&page=${page}&fields=id,total,currency,status,payment_status`;
    let data;
    try { data = await tnGet(store, `/orders${qs}`); } catch (e) {
      if (page === 1) throw e; // si falla la primera, propagá; si falla una página posterior, cortá con lo que haya
      break;
    }
    if (!Array.isArray(data) || data.length === 0) break;
    for (const o of data) {
      if (o.status === "cancelled") continue;
      const t = parseFloat(o.total) || 0;
      if (!moneda && o.currency) moneda = o.currency;
      if (o.payment_status === "paid") { pagF += t; pagN += 1; }
      else if (o.payment_status === "voided") { anuN += 1; } // pago anulado: no es venta nunca
      else { penF += t; penN += 1; }                          // no cancelada, sin pagar => pendiente
    }
    if (data.length < 200) break;
  }
  const todas = crit === "no_canceladas";
  const facturacion = todas ? pagF + penF : pagF;
  const orders = todas ? pagN + penN : pagN;
  return {
    criterio: crit,
    facturacion: Math.round(facturacion),  // titular según el criterio del cliente
    orders,
    ticket: orders ? Math.round(facturacion / orders) : 0,
    facturacionPagada: Math.round(pagF), ordersPagadas: pagN,
    facturacionPendiente: Math.round(penF), ordersPendientes: penN,
    anuladas: anuN,
    moneda: moneda || "ARS",
    account: store.account || null,
  };
}

// Top productos vendidos (line items de las órdenes que cuentan como VENTA según el criterio de
// la tienda — mismo criterio que la facturación) en un rango. Agrega por nombre de producto:
// unidades + facturación. Para el chat de la cuenta.
// Pagina EN PARALELO (tandas de 5): rangos largos en tiendas grandes son 15+ páginas y en serie
// se comen el timeout del serverless.
export async function getTopProducts(name, since, until, limit = 10, criterio = null) {
  const store = findStore(name);
  if (!store) throw new Error(`Tienda "${name}" no configurada`);
  const crit = criterio === "pagadas" || criterio === "no_canceladas"
    ? criterio
    : (store.ventas === "no_canceladas" ? "no_canceladas" : "pagadas");
  const min = `${since}T00:00:00-03:00`;
  const max = `${until}T23:59:59-03:00`;
  const pageQs = (page) => `?created_at_min=${encodeURIComponent(min)}&created_at_max=${encodeURIComponent(max)}` +
    `&per_page=200&page=${page}&fields=id,status,payment_status,products`;
  const agg = {};
  const sumar = (data) => {
    for (const o of data) {
      if (o.status === "cancelled" || o.payment_status === "voided") continue; // anuladas nunca
      if (crit === "pagadas" && o.payment_status !== "paid") continue;          // según criterio
      for (const p of o.products || []) {
        // el nombre en line items suele ser string; en otros endpoints es objeto {es:...}
        const nm = (typeof p.name === "object" && p.name ? Object.values(p.name)[0] : p.name) || "¿sin nombre?";
        const qty = parseFloat(p.quantity) || 0;
        const rev = (parseFloat(p.price) || 0) * qty;
        if (!agg[nm]) agg[nm] = { producto: nm, unidades: 0, facturacion: 0 };
        agg[nm].unidades += qty; agg[nm].facturacion += rev;
      }
    }
  };
  // tandas de 5 páginas en paralelo; cortamos cuando una tanda trae una página corta o vacía
  for (let base = 1; base <= 50; base += 5) {
    const pages = [base, base + 1, base + 2, base + 3, base + 4];
    const results = await Promise.all(pages.map((p) =>
      tnGet(store, `/orders${pageQs(p)}`).catch((e) => { if (p === 1) throw e; return []; })
    ));
    let done = false;
    for (const data of results) {
      const arr = Array.isArray(data) ? data : [];
      sumar(arr);
      if (arr.length < 200) done = true;
    }
    if (done) break;
  }
  return Object.values(agg)
    .map((p) => ({ ...p, unidades: Math.round(p.unidades), facturacion: Math.round(p.facturacion) }))
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, Math.min(+limit || 10, 50));
}
