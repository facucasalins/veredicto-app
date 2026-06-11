import { cookies } from "next/headers";
import { getStoreRevenue } from "@/lib/tiendanube";
import { getAccountSpend } from "@/lib/meta";
import { isTikTok, ttId, getAccountSpend as ttGetAccountSpend } from "@/lib/tiktok";
import { convertMonto } from "@/lib/fx";
import { presetToRange } from "@/lib/dates";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Facturación de la tienda (Tienda Nube) vs inversión en Meta, sobre el MISMO rango.
// MER (Marketing Efficiency Ratio) = facturación total / inversión en Meta.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const store = searchParams.get("store");
  const account = searchParams.get("account");
  const accCur = (searchParams.get("accCur") || "").toUpperCase(); // moneda de la cuenta de Meta (USD/ARS)
  const count = searchParams.get("count"); // criterio de venta: pagadas | no_canceladas (default: el de la tienda)
  const preset = searchParams.get("preset") || "last_30d";
  if (!store) return Response.json({ error: "falta store" }, { status: 400 });

  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (account && !canSeeAccount(sess, account)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });

  const qsSince = searchParams.get("since"), qsUntil = searchParams.get("until");
  const { since, until } = qsSince && qsUntil ? { since: qsSince, until: qsUntil } : presetToRange(preset);
  try {
    const tienda = await getStoreRevenue(store, since, until, count);
    let inversion = 0, roasMeta = 0, ventasMeta = 0;
    if (account) {
      try {
        const m = isTikTok(account) ? await ttGetAccountSpend(ttId(account), since, until) : await getAccountSpend(account, since, until);
        inversion = m.spend; roasMeta = m.roasMeta; ventasMeta = m.ventasMeta;
      } catch { /* si la plataforma falla, mostramos solo facturación */ }
    }
    // Si la cuenta de Meta y la tienda están en monedas distintas (típico: Meta en USD, tienda en
    // ARS), convertimos la inversión a la moneda de la tienda con el dólar oficial. Si no se puede
    // cotizar, degradamos: mostramos el MER sin convertir y avisamos con fx.error.
    const tCur = (tienda.moneda || "ARS").toUpperCase();
    let invForMer = inversion, fx = null;
    if (account && inversion && accCur && accCur !== tCur) {
      try {
        const c = await convertMonto(inversion, accCur, tCur);
        if (c.rate) { invForMer = c.monto; fx = { from: accCur, to: tCur, rate: c.rate, fuente: c.fuente, fecha: c.fecha, inversionConvertida: Math.round(c.monto) }; }
      } catch { fx = { error: true, from: accCur, to: tCur }; }
    }
    // facturacion ya es solo lo pagado → este MER es el real (venta cobrada / inversión).
    const mer = invForMer ? +(tienda.facturacion / invForMer).toFixed(2) : null;
    return Response.json({ since, until, inversion, inversionConv: Math.round(invForMer), accCur, fx, roasMeta, ventasMeta, mer, ...tienda });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
