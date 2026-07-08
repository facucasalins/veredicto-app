import { cookies } from "next/headers";
import { getStoreDaily } from "@/lib/tiendanube";
import { parseAccounts, spendDailyOf } from "@/lib/multi";
import { convertMonto } from "@/lib/fx";
import { presetToRange } from "@/lib/dates";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Detalle diario para la banda del Dashboard: CAC (inversión / clientes NUEVOS de la tienda) y la
// serie día por día que cruza inversión (Meta/TikTok/Google — con la vista combinada suma TODAS
// las cuentas elegidas), facturación (Tienda Nube), órdenes y visitas. Se pide APARTE del summary
// para no frenar la banda: el barrido con customer embebido es lento y acá puede tardar; el front
// pinta la banda primero y esto llega después.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const store = searchParams.get("store");
  const cuentas = parseAccounts(searchParams); // [{id, cur}] — una o varias (vista combinada)
  const count = searchParams.get("count");
  const preset = searchParams.get("preset") || "last_30d";
  if (!store) return Response.json({ error: "falta store" }, { status: 400 });

  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  for (const c of cuentas) {
    if (!canSeeAccount(sess, c.id)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });
  }

  const qsSince = searchParams.get("since"), qsUntil = searchParams.get("until");
  const { since, until } = qsSince && qsUntil ? { since: qsSince, until: qsUntil } : presetToRange(preset);
  try {
    const [tienda, ...series] = await Promise.all([
      getStoreDaily(store, since, until, count),
      ...cuentas.map((c) => spendDailyOf(c.id, since, until).catch(() => null)),
    ]);
    // Conversión de moneda POR CUENTA: misma regla que el MER (dólar oficial). Un rate por moneda.
    const tCur = (tienda.moneda || "ARS").toUpperCase();
    const rates = {};
    let fx = null;
    for (const c of cuentas) {
      if (!c.cur || c.cur === tCur || rates[c.cur] != null) continue;
      try { const conv = await convertMonto(1, c.cur, tCur); if (conv.rate) { rates[c.cur] = conv.rate; fx = { rate: conv.rate, fuente: conv.fuente }; } }
      catch { rates[c.cur] = null; fx = { error: true }; }
    }
    // Sumamos las series por fecha. Las visitas son LPV del pixel de Meta: si ninguna cuenta las
    // trae (Google/TikTok degradan sin visitas) el día queda null, no 0.
    const byDay = {};
    cuentas.forEach((c, i) => {
      const rate = c.cur !== tCur && rates[c.cur] ? rates[c.cur] : 1;
      for (const d of series[i] || []) {
        const acc = byDay[d.fecha] || (byDay[d.fecha] = { spend: 0, ventas: 0, visitas: null });
        acc.spend += (d.spend || 0) * rate;
        acc.ventas += d.ventas || 0;
        if (d.visitas != null) acc.visitas = (acc.visitas || 0) + d.visitas;
      }
    });
    const dias = tienda.porDia.map((d) => {
      const m = byDay[d.fecha] || {};
      return {
        fecha: d.fecha,
        facturacion: d.facturacion,
        ordenes: d.ordenes,
        inversion: Math.round(m.spend || 0),
        visitas: m.visitas != null ? m.visitas : null,
        ventasPixel: m.ventas || 0,
      };
    });
    const invTotal = dias.reduce((s, d) => s + d.inversion, 0);
    const cac = tienda.nuevos.clientes ? Math.round(invTotal / tienda.nuevos.clientes) : null;
    return Response.json({
      since, until, criterio: tienda.criterio, fx,
      cac,
      clientesNuevos: tienda.nuevos.clientes,
      clientesRecurrentes: tienda.recurrentes.clientes,
      factNuevos: tienda.nuevos.facturacion,
      dias,
    });
  } catch (e) {
    return Response.json({ error: e.message, code: e.code || null }, { status: e.code === "RANGO_MUY_GRANDE" ? 422 : 500 });
  }
}
