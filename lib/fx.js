// lib/fx.js
// Cotización del dólar oficial (Argentina) para convertir cuentas de Meta en USD a pesos y poder
// cruzarlas contra la facturación de Tienda Nube (ARS) sin mezclar monedas. Si las dos monedas
// coinciden no se usa; si difieren, convertimos la inversión de Meta a la moneda de la tienda.
//
// Fuente: dolarapi.com (oficial BNA). Fallback: criptoya.com. Cache en memoria ~1h (la cotización
// del oficial se mueve poco y no queremos pegarle a la API en cada request). Usamos el PROMEDIO de
// compra y venta (el medio del spread), p. ej. compra 1410 + venta 1460 → 1435.

let cache = null; // { rate, compra, venta, fuente, fecha, ts }
const TTL = 60 * 60 * 1000; // 1 hora

const mid = (compra, venta) => {
  const c = parseFloat(compra), v = parseFloat(venta);
  const okC = isFinite(c) && c > 0, okV = isFinite(v) && v > 0;
  if (okC && okV) return { rate: (c + v) / 2, compra: c, venta: v }; // promedio del spread
  if (okV) return { rate: v, compra: null, venta: v };
  if (okC) return { rate: c, compra: c, venta: null };
  return null;
};

async function fromDolarApi() {
  const r = await fetch("https://dolarapi.com/v1/dolares/oficial", { cache: "no-store" });
  if (!r.ok) throw new Error("dolarapi " + r.status);
  const j = await r.json();
  const m = mid(j.compra, j.venta);
  if (!m) throw new Error("dolarapi sin cotización");
  return { ...m, fuente: "dólar oficial (BNA)", fecha: j.fechaActualizacion || null };
}

async function fromCriptoya() {
  const r = await fetch("https://criptoya.com/api/dolar", { cache: "no-store" });
  if (!r.ok) throw new Error("criptoya " + r.status);
  const j = await r.json();
  const o = j && j.oficial ? j.oficial : {};
  const m = mid(o.bid ?? o.price, o.ask ?? o.price);
  if (!m) throw new Error("criptoya sin oficial");
  return { ...m, fuente: "dólar oficial", fecha: null };
}

// Pesos por 1 USD (venta del oficial). Cacheado; si las dos fuentes fallan, propaga el error
// (el caller decide degradar y mostrar el MER sin convertir, avisando que no pudo cotizar).
export async function getDolarOficial() {
  if (cache && Date.now() - cache.ts < TTL) return cache;
  let res;
  try { res = await fromDolarApi(); }
  catch { res = await fromCriptoya(); }
  cache = { ...res, ts: Date.now() };
  return cache;
}

// Convierte un monto de `from` a `to` usando el dólar oficial (solo ARS<->USD; otras quedan sin
// tocar). Devuelve { monto, rate, fuente, fecha } o, si no hace falta convertir, rate null.
export async function convertMonto(monto, from, to) {
  const f = String(from || "").toUpperCase(), t = String(to || "").toUpperCase();
  if (!f || !t || f === t) return { monto, rate: null, fuente: null, fecha: null };
  const d = await getDolarOficial();
  if (f === "USD" && t === "ARS") return { monto: monto * d.rate, rate: d.rate, fuente: d.fuente, fecha: d.fecha };
  if (f === "ARS" && t === "USD") return { monto: monto / d.rate, rate: d.rate, fuente: d.fuente, fecha: d.fecha };
  return { monto, rate: null, fuente: null, fecha: null }; // par no soportado: no tocamos
}
