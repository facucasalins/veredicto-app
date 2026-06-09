import { cookies } from "next/headers";
import { getStoreRevenue } from "@/lib/tiendanube";
import { getAccountSpend } from "@/lib/meta";
import { presetToRange } from "@/lib/dates";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Facturación de la tienda (Tienda Nube) vs inversión en Meta, sobre el MISMO rango.
// MER (Marketing Efficiency Ratio) = facturación total / inversión en Meta.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const store = searchParams.get("store");
  const account = searchParams.get("account");
  const preset = searchParams.get("preset") || "last_30d";
  if (!store) return Response.json({ error: "falta store" }, { status: 400 });

  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (account && !canSeeAccount(sess, account)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });

  const { since, until } = presetToRange(preset);
  try {
    const tienda = await getStoreRevenue(store, since, until);
    let inversion = 0, roasMeta = 0, ventasMeta = 0;
    if (account) {
      try { const m = await getAccountSpend(account, since, until); inversion = m.spend; roasMeta = m.roasMeta; ventasMeta = m.ventasMeta; }
      catch { /* si Meta falla, mostramos solo facturación */ }
    }
    const mer = inversion ? +(tienda.facturacion / inversion).toFixed(2) : null;
    const merPagada = inversion ? +(tienda.facturacionPagada / inversion).toFixed(2) : null;
    return Response.json({ since, until, inversion, roasMeta, ventasMeta, mer, merPagada, ...tienda });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
