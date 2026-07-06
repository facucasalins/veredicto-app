import { cookies } from "next/headers";
import { getStoreDaily } from "@/lib/tiendanube";
import { getAccountSpendDaily } from "@/lib/meta";
import { isTikTok, ttId, getAccountSpend as ttGetAccountSpend } from "@/lib/tiktok";
import { convertMonto } from "@/lib/fx";
import { presetToRange } from "@/lib/dates";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Detalle diario para la banda del Dashboard: CAC (inversión / clientes NUEVOS de la tienda) y la
// serie día por día que cruza inversión (Meta/TikTok), facturación (Tienda Nube), órdenes y
// visitas. Se pide APARTE del summary para no frenar la banda: el barrido con customer embebido
// es lento y acá puede tardar; el front pinta la banda primero y esto llega después.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const store = searchParams.get("store");
  const account = searchParams.get("account");
  const accCur = (searchParams.get("accCur") || "").toUpperCase();
  const count = searchParams.get("count");
  const preset = searchParams.get("preset") || "last_30d";
  if (!store) return Response.json({ error: "falta store" }, { status: 400 });

  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (account && !canSeeAccount(sess, account)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });

  const qsSince = searchParams.get("since"), qsUntil = searchParams.get("until");
  const { since, until } = qsSince && qsUntil ? { since: qsSince, until: qsUntil } : presetToRange(preset);
  try {
    const [tienda, plataforma] = await Promise.all([
      getStoreDaily(store, since, until, count),
      account
        ? (isTikTok(account) ? ttGetAccountSpend(ttId(account), since, until, true) : getAccountSpendDaily(account, since, until)).catch(() => null)
        : Promise.resolve(null),
    ]);
    // Conversión de moneda: misma regla que el MER (dólar oficial). Un solo rate para todo el rango.
    let rate = 1, fx = null;
    const tCur = (tienda.moneda || "ARS").toUpperCase();
    if (account && accCur && accCur !== tCur && plataforma) {
      try { const c = await convertMonto(1, accCur, tCur); if (c.rate) { rate = c.rate; fx = { rate: c.rate, fuente: c.fuente }; } }
      catch { fx = { error: true }; }
    }
    const metaByDay = {};
    for (const d of plataforma || []) metaByDay[d.fecha] = d;
    const dias = tienda.porDia.map((d) => {
      const m = metaByDay[d.fecha] || {};
      return {
        fecha: d.fecha,
        facturacion: d.facturacion,
        ordenes: d.ordenes,
        inversion: Math.round((m.spend || 0) * rate),
        visitas: m.visitas != null ? m.visitas : null, // TikTok no reporta visitas → null
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
