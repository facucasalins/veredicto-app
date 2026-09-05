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
//
// ─── Cómo pega a la API (y por qué) ────────────────────────────────────────────────────────────
// Tienda Nube limita por tienda con un balde de 40 requests que se vacía a 2/seg (x10 en planes
// Next/Evolution). Antes la banda hacía TRES barridos completos de /orders al mismo tiempo (summary
// en serie, daily y tendencia en paralelo) y las páginas que caían con 429 se reemplazaban por []
// en silencio → facturación/clientes nuevos bajos o en cero, de forma intermitente. Ahora:
//   1. UN barrido por (tienda, rango): `sweepOrders` trae las órdenes UNA vez con el customer
//      embebido y arma un agregado que sirve para AMBOS criterios de venta. getStoreRevenue /
//      getStoreDaily / getCustomerSplit son vistas sobre ese agregado (un solo pase de páginas
//      alimenta la banda, el CAC, el gráfico y el chat).
//   2. Cache del agregado: memoria (L1, por lambda) + Upstash (L2, compartida) 5 minutos. Cambiar
//      de pestaña, togglear el criterio o COMPARAR no vuelve a pegarle a la API.
//   3. `tnFetch` reintenta 429/5xx con backoff (lee x-rate-limit-reset), tiene timeout, y pasa por
//      una cola de concurrencia POR TIENDA compartida entre todas las funciones (antes cada barrido
//      abría 8 a la vez → 24 en vuelo).
//   4. Si una página sigue fallando después de reintentar, el resultado sale marcado `parcial:true`
//      con `paginasFallidas` (y NO se cachea) — nunca más un número silenciosamente incompleto.

import { storeEnabled, kvGet, kvSet } from "@/lib/store";

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

function resolveCriterio(store, criterio) {
  return criterio === "pagadas" || criterio === "no_canceladas"
    ? criterio
    : (store.ventas === "no_canceladas" ? "no_canceladas" : "pagadas");
}

// ─── Transporte: cola por tienda + reintentos + timeout ────────────────────────────────────────

// Medido contra una tienda real (sep 2026): la latencia de /orders es LINEAL en la cantidad de
// órdenes de la página (~65 ms por orden + ~0,5 s fijos; 200 con customer = ~14 s, 50 = ~3,5 s), así
// que 6 páginas de 50 en paralelo terminan 4× antes que las mismas 300 órdenes en páginas de 200.
// A 6 en vuelo × ~3,5 s cada una son ~1,7 req/s sostenidos: por debajo del drenaje de 2/s del
// balde básico, así que ni las tiendas del plan chico deberían ver 429 (y si lo ven, se reintenta).
const MAX_CONC = 6;      // requests en vuelo por tienda (todas las funciones comparten la cola)
const PER_PAGE = 50;     // órdenes por página del barrido (ver medición arriba)
const TIMEOUT_MS = 25000;
const RETRIES = 3;       // reintentos ante 429 / 5xx / red

const _slots = {}; // store_id → { activos, cola: [resolve] }
function withSlot(storeId, fn) {
  const s = _slots[storeId] || (_slots[storeId] = { activos: 0, cola: [] });
  const run = async () => {
    s.activos += 1;
    try { return await fn(); }
    finally {
      s.activos -= 1;
      const next = s.cola.shift();
      if (next) next();
    }
  };
  if (s.activos < MAX_CONC) return run();
  return new Promise((resolve, reject) => { s.cola.push(() => run().then(resolve, reject)); });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET a la API. Reintenta 429/5xx/red con backoff exponencial (si TN manda x-rate-limit-reset lo
// respeta, tope 8s). Devuelve { data, total } (total = x-total-count, para saber cuántas páginas
// hay ANTES de paginar a ciegas).
async function tnFetch(store, path) {
  const ua = process.env.TIENDANUBE_UA || "NUSA App (permutas.dev@gmail.com)";
  const url = `${API}/${store.store_id}${path}`;
  const headers = { Authentication: `bearer ${store.token}`, "User-Agent": ua, "Content-Type": "application/json" };
  let lastErr = null;
  for (let intento = 0; intento <= RETRIES; intento++) {
    let res;
    try {
      res = await withSlot(store.store_id, () => fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) }));
    } catch (e) {
      lastErr = new Error(`TiendaNube sin respuesta (${e.name === "TimeoutError" ? "timeout" : e.message})`);
      if (intento < RETRIES) { await sleep(500 * 2 ** intento); continue; }
      throw lastErr;
    }
    if (res.status === 429 || res.status >= 500) {
      const reset = parseInt(res.headers.get("x-rate-limit-reset") || "0", 10); // ms hasta que se vacía el balde
      const wait = Math.min(Math.max(reset > 0 ? reset : 0, 500 * 2 ** intento), 8000);
      lastErr = new Error(res.status === 429 ? "TiendaNube 429: límite de consultas" : `TiendaNube ${res.status}`);
      if (intento < RETRIES) { await sleep(wait); continue; }
      throw lastErr;
    }
    if (!res.ok) throw new Error(`TiendaNube ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { data: await res.json(), total: parseInt(res.headers.get("x-total-count") || "0", 10) };
  }
  throw lastErr || new Error("TiendaNube: error desconocido");
}

const tnGet = async (store, path) => (await tnFetch(store, path)).data;

// ─── Barrido único de órdenes (cacheado) ───────────────────────────────────────────────────────
//
// Agregado compacto que sirve para ambos criterios. Todo lo que es "pag" cuenta payment_status=paid;
// "pen" es no cancelada sin pagar (pendiente); "anu" es pago anulado (voided, no es venta nunca).
// Las canceladas se descartan en el barrido.
//   {
//     since, until, moneda, total (órdenes según x-total-count), paginas, paginasFallidas, parcial,
//     pagF, pagN, penF, penN, anuN,
//     dias: { "YYYY-MM-DD": [pagF, pagN, penF, penN] },                (fecha local Argentina)
//     cust: [ [nuevo(0|1), pagF, pagN, penF, penN], ... ],              (uno por cliente, dedup por id)
//     sinCliente: [pagF, pagN, penF, penN],                              (órdenes sin customer: invitados)
//   }
// La regla nuevo/recurrente: alta del customer (`customer.created_at`) dentro del rango → NUEVO;
// anterior al inicio → RECURRENTE. Se resuelve en el barrido (el rango es parte de la clave de cache).

const ORDER_CAP = 6000;       // órdenes máx. por barrido completo (light: el doble); arriba → RANGO_MUY_GRANDE
const CACHE_TTL_MS = 5 * 60 * 1000;
const _mem = {};              // L1: key → { t, agg }
const _inflight = {};         // key → Promise del barrido en curso (summary y daily llegan juntos → UN barrido)

function cacheKey(store, since, until) { return `nusa:tn:orders:${store.store_id}:${since}:${until}`; }

async function cacheGet(key) {
  const m = _mem[key];
  if (m && Date.now() - m.t < CACHE_TTL_MS) return m.agg;
  if (storeEnabled()) {
    try { const agg = await kvGet(key); if (agg) { _mem[key] = { t: Date.now(), agg }; return agg; } } catch { /* sin cache compartida, seguimos */ }
  }
  return null;
}
async function cacheSet(key, agg) {
  _mem[key] = { t: Date.now(), agg };
  if (storeEnabled()) {
    try { await kvSet(key, agg, Math.round(CACHE_TTL_MS / 1000)); } catch { /* best effort */ }
  }
}

// `light:true` → barrido SIN customer ni fecha (páginas mucho más livianas, tope de páginas el
// doble): fallback de getStoreRevenue cuando el rango excede PAGE_CAP — la facturación del titular
// sigue saliendo aunque el CAC/gráfico no entren. Cache aparte.
async function sweepOrders(store, since, until, opts = {}) {
  const key = cacheKey(store, since, until) + (opts.light ? ":light" : "");
  const cached = await cacheGet(key);
  if (cached) return cached;
  // Dedup de llamadas concurrentes en la misma lambda: la segunda se cuelga de la promesa de la primera.
  if (!_inflight[key]) {
    _inflight[key] = sweepOrdersUncached(store, since, until, key, opts).finally(() => { delete _inflight[key]; });
  }
  return _inflight[key];
}

async function sweepOrdersUncached(store, since, until, key, { light = false } = {}) {

  const min = `${since}T00:00:00-03:00`;
  const max = `${until}T23:59:59-03:00`;
  const sinceTs = new Date(min).getTime();
  const fields = light ? "id,total,currency,status,payment_status" : "id,total,currency,status,payment_status,created_at,customer";
  const cap = light ? ORDER_CAP * 2 : ORDER_CAP;
  const pageQs = (page) => `?created_at_min=${encodeURIComponent(min)}&created_at_max=${encodeURIComponent(max)}` +
    `&per_page=${PER_PAGE}&page=${page}&fields=${fields}`;

  const agg = { since, until, moneda: null, total: 0, paginas: 0, paginasFallidas: 0, parcial: false, pagF: 0, pagN: 0, penF: 0, penN: 0, anuN: 0, dias: {}, cust: [], sinCliente: [0, 0, 0, 0] };
  const custMap = {}; // id → [nuevo, pagF, pagN, penF, penN]
  const sumar = (data) => {
    if (!Array.isArray(data)) return;
    for (const o of data) {
      if (o.status === "cancelled") continue;
      const t = parseFloat(o.total) || 0;
      if (!agg.moneda && o.currency) agg.moneda = o.currency;
      const ps = o.payment_status;
      if (ps === "voided") { agg.anuN += 1; continue; } // pago anulado: no es venta bajo ningún criterio
      const pag = ps === "paid";
      if (pag) { agg.pagF += t; agg.pagN += 1; } else { agg.penF += t; agg.penN += 1; }
      if (light) continue; // sin created_at ni customer: solo totales
      // fecha local Argentina: created_at viene UTC; corremos -3h y cortamos el día
      const f = new Date(new Date(o.created_at).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
      const d = agg.dias[f] || (agg.dias[f] = [0, 0, 0, 0]);
      if (pag) { d[0] += t; d[1] += 1; } else { d[2] += t; d[3] += 1; }
      const c = o.customer;
      const bucket = c && c.id && c.created_at
        ? (custMap[c.id] || (custMap[c.id] = [new Date(c.created_at).getTime() >= sinceTs ? 1 : 0, 0, 0, 0, 0]))
        : null;
      const target = bucket || agg.sinCliente;
      const off = bucket ? 1 : 0; // el bucket de cliente lleva el flag "nuevo" adelante
      if (pag) { target[off + 0] += t; target[off + 1] += 1; } else { target[off + 2] += t; target[off + 3] += 1; }
    }
  };

  // Primera tanda (MAX_CONC páginas a la vez) sin esperar el conteo: la página 1 trae x-total-count
  // y con eso sabemos si el rango entra y cuántas páginas más faltan. Si falla la página 1 se propaga.
  const primeras = [];
  for (let p = 1; p <= MAX_CONC; p++) primeras.push(p);
  const first = await Promise.all(primeras.map((p) => tnFetch(store, `/orders${pageQs(p)}`).catch((e) => { if (p === 1) throw e; return null; })));
  agg.total = first[0].total || (Array.isArray(first[0].data) ? first[0].data.length : 0);
  const pages = Math.max(1, Math.ceil(agg.total / PER_PAGE));
  agg.paginas = pages;
  if (agg.total > cap) {
    const err = new Error(`La tienda "${store.name}" tiene ~${agg.total} órdenes en ese rango — demasiado para una sola consulta. Acotá el período.`);
    err.code = "RANGO_MUY_GRANDE";
    throw err;
  }
  first.forEach((r, i) => {
    if (i + 1 > pages) return;                       // páginas pedidas de más (rango chico): vienen vacías
    if (r === null) { agg.paginasFallidas += 1; return; }
    sumar(r.data);
  });
  // Resto de páginas: todas a la cola por tienda (MAX_CONC las serializa; tnFetch reintenta).
  const rest = [];
  for (let p = MAX_CONC + 1; p <= pages; p++) rest.push(p);
  const results = await Promise.all(rest.map((p) => tnGet(store, `/orders${pageQs(p)}`).catch(() => null)));
  for (const data of results) {
    if (data === null) { agg.paginasFallidas += 1; continue; }
    sumar(data);
  }
  agg.parcial = agg.paginasFallidas > 0;
  agg.light = light;
  agg.cust = Object.values(custMap);
  agg.moneda = agg.moneda || "ARS";
  agg.dias = Object.fromEntries(Object.entries(agg.dias).map(([f, v]) => [f, v.map((x, i) => (i % 2 === 0 ? Math.round(x * 100) / 100 : x))]));
  if (!agg.parcial) await cacheSet(key, agg); // lo incompleto no se cachea: la próxima carga reintenta
  return agg;
}

// Metadatos de completitud que viajan en todas las respuestas (el front avisa si es parcial).
function meta(agg) {
  return { parcial: agg.parcial, paginasFallidas: agg.paginasFallidas, paginas: agg.paginas, ordenesTotal: agg.total };
}

// ─── Vistas sobre el barrido ───────────────────────────────────────────────────────────────────

// Facturación de la tienda en el rango según `criterio`:
//   "pagadas"        → solo payment_status === "paid" (como el panel de estadísticas de TN)
//   "no_canceladas"  → toda orden no cancelada, pagada o pendiente (como cuenta MoraShop
//                      internamente) — EXCEPTO las de pago anulado (voided).
// Si no se pasa, usa el default de la tienda (`ventas` en TIENDANUBE_STORES) o "pagadas".
export async function getStoreRevenue(name, since, until, criterio = null) {
  const store = findStore(name);
  if (!store) throw new Error(`Tienda "${name}" no configurada`);
  const crit = resolveCriterio(store, criterio);
  // Barrido completo (compartido con daily/chat); si el rango es demasiado grande para ese, el
  // liviano (solo totales) — antes el summary paginaba 50 páginas EN SERIE y se comía el timeout.
  let agg;
  try { agg = await sweepOrders(store, since, until); }
  catch (e) { if (e.code !== "RANGO_MUY_GRANDE") throw e; agg = await sweepOrders(store, since, until, { light: true }); }
  const todas = crit === "no_canceladas";
  const facturacion = todas ? agg.pagF + agg.penF : agg.pagF;
  const orders = todas ? agg.pagN + agg.penN : agg.pagN;
  return {
    criterio: crit,
    facturacion: Math.round(facturacion),  // titular según el criterio del cliente
    orders,
    ticket: orders ? Math.round(facturacion / orders) : 0,
    facturacionPagada: Math.round(agg.pagF), ordersPagadas: agg.pagN,
    facturacionPendiente: Math.round(agg.penF), ordersPendientes: agg.penN,
    anuladas: agg.anuN,
    moneda: agg.moneda,
    account: store.account || null,
    ...meta(agg),
  };
}

// Detalle diario + clientes (para la banda del Dashboard: CAC y el gráfico día por día):
//   porDia   → [{fecha, facturacion, ordenes}] según el criterio (días sin ventas en 0, rango
//              completo since→until para que el gráfico no tenga huecos)
//   nuevos / recurrentes → clientes dedup por id; su facturación del período va a su segmento
//   sinCliente → órdenes que no traen customer (checkout como invitado): no entran al split
export async function getStoreDaily(name, since, until, criterio = null) {
  const store = findStore(name);
  if (!store) throw new Error(`Tienda "${name}" no configurada`);
  const crit = resolveCriterio(store, criterio);
  const agg = await sweepOrders(store, since, until);
  const todas = crit === "no_canceladas";
  const pick = (v, off = 0) => (todas ? { f: v[off] + v[off + 2], n: v[off + 1] + v[off + 3] } : { f: v[off], n: v[off + 1] });

  let nuevosN = 0, nuevosF = 0, recurN = 0, recurF = 0;
  for (const c of agg.cust) {
    const { f, n } = pick(c, 1);
    if (!n) continue; // el cliente no tiene órdenes bajo este criterio
    if (c[0]) { nuevosN += 1; nuevosF += f; } else { recurN += 1; recurF += f; }
  }
  const sc = pick(agg.sinCliente);
  const porDia = [];
  for (let d = new Date(since + "T12:00:00Z"); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const f = d.toISOString().slice(0, 10);
    if (f > until) break;
    const x = agg.dias[f] ? pick(agg.dias[f]) : { f: 0, n: 0 };
    porDia.push({ fecha: f, facturacion: Math.round(x.f), ordenes: x.n });
    if (porDia.length > 400) break; // tope de seguridad
  }
  return {
    criterio: crit,
    porDia,
    moneda: agg.moneda,
    nuevos: { clientes: nuevosN, facturacion: Math.round(nuevosF) },
    recurrentes: { clientes: recurN, facturacion: Math.round(recurF) },
    sinCliente: { ordenes: sc.n, facturacion: Math.round(sc.f) },
    account: store.account || null,
    ...meta(agg),
  };
}

// Clientes NUEVOS vs RECURRENTES en el rango (para el chat). La API NO da un flag listo: lo
// derivamos del `customer` EMBEBIDO en cada orden (alcanza con read_orders). Regla: RECURRENTE si su
// alta (`customer.created_at`) es ANTERIOR al inicio del período; NUEVO si se dio de alta adentro.
// (Descartamos `customer_type` —viene vacío— y `first_interaction` —se pisa con la orden actual—.)
export async function getCustomerSplit(name, since, until, criterio = null) {
  const store = findStore(name);
  if (!store) throw new Error(`Tienda "${name}" no configurada`);
  const crit = resolveCriterio(store, criterio);
  const agg = await sweepOrders(store, since, until);
  const todas = crit === "no_canceladas";
  const pick = (v, off = 0) => (todas ? { f: v[off] + v[off + 2], n: v[off + 1] + v[off + 3] } : { f: v[off], n: v[off + 1] });
  let nuevosN = 0, nuevosF = 0, nuevosO = 0, recurN = 0, recurF = 0, recurO = 0;
  for (const c of agg.cust) {
    const { f, n } = pick(c, 1);
    if (!n) continue;
    if (c[0]) { nuevosN += 1; nuevosF += f; nuevosO += n; } else { recurN += 1; recurF += f; recurO += n; }
  }
  const sc = pick(agg.sinCliente);
  const tot = nuevosN + recurN;
  const pct = (n) => (tot ? Math.round((n / tot) * 100) : 0);
  return {
    criterio: crit,
    clientes_totales: tot,
    nuevos:      { clientes: nuevosN, ordenes: nuevosO, facturacion: Math.round(nuevosF), pct: pct(nuevosN) },
    recurrentes: { clientes: recurN, ordenes: recurO, facturacion: Math.round(recurF), pct: pct(recurN) },
    ordenes_sin_cliente: sc.n, facturacion_sin_cliente: Math.round(sc.f),
    account: store.account || null,
    ...meta(agg),
  };
}

// ─── Otras consultas (chat) ────────────────────────────────────────────────────────────────────

// Pagina en tandas por la cola de la tienda; corta cuando una tanda trae una página corta o vacía.
// Si falla la página 1 propaga; una posterior que falla tras reintentos se reporta en `fallidas`.
async function sweepPages(store, pageQs, sumar) {
  let fallidas = 0;
  for (let base = 1; base <= 50; base += 5) {
    const pages = [base, base + 1, base + 2, base + 3, base + 4];
    const results = await Promise.all(pages.map((p) =>
      tnGet(store, pageQs(p)).catch((e) => { if (p === 1) throw e; fallidas += 1; return []; })
    ));
    let done = false;
    for (const data of results) {
      const arr = Array.isArray(data) ? data : [];
      sumar(arr);
      if (arr.length < 200) done = true;
    }
    if (done) break;
  }
  return fallidas;
}

// Top productos vendidos (line items de las órdenes que cuentan como VENTA según el criterio) en un
// rango. Agrega por nombre de producto: unidades + facturación. Necesita el campo `products`, que
// no viaja en el barrido de la banda → barrido propio (solo lo pide el chat).
export async function getTopProducts(name, since, until, limit = 10, criterio = null) {
  const store = findStore(name);
  if (!store) throw new Error(`Tienda "${name}" no configurada`);
  const crit = resolveCriterio(store, criterio);
  const min = `${since}T00:00:00-03:00`;
  const max = `${until}T23:59:59-03:00`;
  const pageQs = (page) => `/orders?created_at_min=${encodeURIComponent(min)}&created_at_max=${encodeURIComponent(max)}` +
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
  await sweepPages(store, pageQs, sumar);
  return Object.values(agg)
    .map((p) => ({ ...p, unidades: Math.round(p.unidades), facturacion: Math.round(p.facturacion) }))
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, Math.min(+limit || 10, 50));
}

// Stock por producto (inventario). Lee /products (NO /orders) y suma el stock de todas las variantes
// de cada producto. Para detectar overstock: "qué tengo parado en depósito que necesito rotar".
// Requiere el scope `read_products` en el token de la tienda; si no lo tiene, la API tira 401/403 y
// se propaga el error (el chat lo muestra como "no disponible").
//
// OJO con el stock null: en Tienda Nube, una variante con manejo de stock DESACTIVADO devuelve
// `stock: null` (vende ilimitado). Esos productos NO son "overstock" — los marcamos `sin_control`
// y los dejamos fuera del ranking numérico (no tienen un número real para comparar).
//
// `orden`: "mas" (default, más stock primero — para rotar) o "menos" (menos stock primero — quiebre).
export async function getStockProducts(name, limit = 10, orden = "mas") {
  const store = findStore(name);
  if (!store) throw new Error(`Tienda "${name}" no configurada`);
  const pageQs = (page) => `/products?per_page=200&page=${page}&fields=id,name,variants`;
  const prods = [];
  let sinControl = 0;
  const sumar = (data) => {
    if (!Array.isArray(data)) return;
    for (const p of data) {
      const nm = (typeof p.name === "object" && p.name ? Object.values(p.name)[0] : p.name) || "¿sin nombre?";
      const vars = Array.isArray(p.variants) ? p.variants : [];
      let stock = 0, hayControl = false;
      for (const v of vars) {
        if (v.stock === null || v.stock === undefined) continue; // variante sin manejo de stock
        hayControl = true;
        stock += parseInt(v.stock, 10) || 0;
      }
      if (!hayControl) { sinControl += 1; continue; } // producto sin control de stock → no rankea
      prods.push({ producto: nm, stock, variantes: vars.length });
    }
  };
  await sweepPages(store, pageQs, sumar);
  const asc = orden === "menos";
  prods.sort((a, b) => (asc ? a.stock - b.stock : b.stock - a.stock));
  return {
    orden: asc ? "menos" : "mas",
    productos_sin_control_stock: sinControl, // los que venden ilimitado (no entran al ranking)
    productos: prods.slice(0, Math.min(+limit || 10, 50)),
  };
}
