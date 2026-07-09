import { cookies } from "next/headers";
import { parseAccounts, spendDailyOf } from "@/lib/multi";
import { getStoreDaily } from "@/lib/tiendanube";
import { gaEnabled, propertyFor, getDaily as gaGetDaily } from "@/lib/ga4";
import { convertMonto } from "@/lib/fx";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // el barrido de órdenes de TN puede ser lento en tiendas grandes

// TENDENCIA: la "película" de la cuenta — 4 bloques de 7 días (el más nuevo termina hoy) con
// inversión (todas las cuentas de la vista, moneda convertida por cuenta), facturación/órdenes de
// la tienda, MER, y sesiones/compras/CR del sitio (GA4). Una foto dice cómo estás; esto dice si
// venís mejorando o cayendo — que es lo que decide. Degrada por fuente: sin tienda no hay
// facturación/MER; sin GA4 no hay CR; con solo ads igual sirve (inversión + ventas pixel).
const SEMANAS = 4;

const ymd = (d) => d.toISOString().slice(0, 10);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const cuentas = parseAccounts(searchParams); // [{id, cur}]
  const store = searchParams.get("store");
  const count = searchParams.get("count");
  if (!cuentas.length) return Response.json({ error: "falta account" }, { status: 400 });

  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  for (const c of cuentas) {
    if (!canSeeAccount(sess, c.id)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });
  }

  // 4 bloques de 7 días contiguos, el último termina HOY (el bloque actual está en curso — el
  // front lo marca como parcial).
  const hoy = new Date();
  const end = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (SEMANAS * 7 - 1));
  const since = ymd(start), until = ymd(end);
  const bloqueDe = (fecha) => {
    const d = new Date(fecha + "T00:00:00Z");
    const idx = Math.floor((d - start) / 86400000 / 7);
    return idx >= 0 && idx < SEMANAS ? idx : null;
  };

  const gaProp = gaEnabled() ? propertyFor(cuentas[0].id, store) : null;
  try {
    const [tienda, ga4, ...series] = await Promise.all([
      store ? getStoreDaily(store, since, until, count).catch(() => null) : Promise.resolve(null),
      gaProp ? gaGetDaily(gaProp.property_id, since, until).catch(() => null) : Promise.resolve(null),
      ...cuentas.map((c) => spendDailyOf(c.id, since, until).catch(() => null)),
    ]);

    // Conversión por cuenta a la moneda de la tienda (o ARS): mismo criterio que summary/daily.
    const tCur = String((tienda && tienda.moneda) || "ARS").toUpperCase();
    const rates = {};
    for (const c of cuentas) {
      if (!c.cur || c.cur === tCur || rates[c.cur] != null) continue;
      try { const cv = await convertMonto(1, c.cur, tCur); if (cv.rate) rates[c.cur] = cv.rate; } catch { rates[c.cur] = null; }
    }

    const semanas = Array.from({ length: SEMANAS }, (_, i) => {
      const d0 = new Date(start); d0.setUTCDate(start.getUTCDate() + i * 7);
      const d1 = new Date(d0); d1.setUTCDate(d0.getUTCDate() + 6);
      return { desde: ymd(d0), hasta: ymd(d1), inversion: 0, ventas_pixel: 0, facturacion: null, ordenes: null, mer: null, sesiones: null, compras_ga4: null, cr: null };
    });

    cuentas.forEach((c, i) => {
      const rate = c.cur !== tCur && rates[c.cur] ? rates[c.cur] : 1;
      for (const d of series[i] || []) {
        const b = bloqueDe(d.fecha);
        if (b == null) continue;
        semanas[b].inversion += (d.spend || 0) * rate;
        semanas[b].ventas_pixel += d.ventas || 0;
      }
    });
    if (tienda) {
      for (const s of semanas) { s.facturacion = 0; s.ordenes = 0; }
      for (const d of tienda.porDia || []) {
        const b = bloqueDe(d.fecha);
        if (b == null) continue;
        semanas[b].facturacion += d.facturacion || 0;
        semanas[b].ordenes += d.ordenes || 0;
      }
    }
    if (ga4) {
      for (const s of semanas) { s.sesiones = 0; s.compras_ga4 = 0; }
      for (const d of ga4) {
        const b = bloqueDe(d.fecha);
        if (b == null) continue;
        semanas[b].sesiones += d.sesiones || 0;
        semanas[b].compras_ga4 += d.compras || 0;
      }
    }
    for (const s of semanas) {
      s.inversion = Math.round(s.inversion);
      if (s.facturacion != null && s.inversion) s.mer = +(s.facturacion / s.inversion).toFixed(2);
      if (s.sesiones) s.cr = +((s.compras_ga4 / s.sesiones) * 100).toFixed(2);
    }
    return Response.json({ since, until, moneda: tCur, semana_actual_parcial: true, semanas });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
