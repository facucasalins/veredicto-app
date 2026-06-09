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

// Solo etiquetas (nunca exponemos tokens al front).
export function listStores() {
  return stores().map((s) => ({ name: s.name, account: s.account || null }));
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
// Cuenta órdenes no canceladas; reporta también las pagadas por separado.
export async function getStoreRevenue(name, since, until) {
  const store = findStore(name);
  if (!store) throw new Error(`Tienda "${name}" no configurada`);
  const min = `${since}T00:00:00-03:00`;
  const max = `${until}T23:59:59-03:00`;
  let page = 1, facturacion = 0, facturacionPagada = 0, orders = 0, ordersPagadas = 0, moneda = null;
  // tope de seguridad para no loopear infinito si algo sale mal
  for (; page <= 50; page++) {
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
      facturacion += t; orders += 1;
      if (!moneda && o.currency) moneda = o.currency;
      if (o.payment_status === "paid") { facturacionPagada += t; ordersPagadas += 1; }
    }
    if (data.length < 200) break;
  }
  return {
    facturacion: Math.round(facturacion),
    facturacionPagada: Math.round(facturacionPagada),
    orders, ordersPagadas,
    ticket: orders ? Math.round(facturacion / orders) : 0,
    moneda: moneda || "ARS",
    account: store.account || null,
  };
}
