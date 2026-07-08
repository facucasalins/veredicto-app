import { cookies } from "next/headers";
import { getStoreRevenue } from "@/lib/tiendanube";
import { parseAccounts, spendOf, platformOf } from "@/lib/multi";
import { convertMonto } from "@/lib/fx";
import { presetToRange } from "@/lib/dates";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Facturación de la tienda (Tienda Nube) vs inversión en ads, sobre el MISMO rango.
// MER (Marketing Efficiency Ratio) = facturación total / inversión en ads.
// Acepta UNA cuenta (account+accCur, como siempre) o VARIAS (accounts=a,b + curs=USD,ARS — la
// vista combinada Meta+Google): la inversión es la SUMA de todas y el MER deja de estar inflado
// por los canales que antes no se veían.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const store = searchParams.get("store");
  const cuentas = parseAccounts(searchParams); // [{id, cur}]
  const count = searchParams.get("count"); // criterio de venta: pagadas | no_canceladas (default: el de la tienda)
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
    const [tienda, ...spends] = await Promise.all([
      getStoreRevenue(store, since, until, count),
      ...cuentas.map((c) => spendOf(c.id, since, until).catch(() => null)), // si una plataforma falla, seguimos con el resto
    ]);
    const tCur = (tienda.moneda || "ARS").toUpperCase();

    // Conversión por CUENTA: cada una puede estar en otra moneda (típico: Meta en USD, tienda en
    // ARS). Cotizamos una vez por moneda distinta. Sin cotización degradamos sin convertir y
    // avisamos con fx.error.
    const rates = {}; // cur → factor a moneda de la tienda
    let fx = null;
    for (const c of cuentas) {
      if (!c.cur || c.cur === tCur || rates[c.cur] != null) continue;
      try {
        const conv = await convertMonto(1, c.cur, tCur);
        if (conv.rate) { rates[c.cur] = conv.monto; fx = { from: c.cur, to: tCur, rate: conv.rate, fuente: conv.fuente, fecha: conv.fecha }; }
      } catch { rates[c.cur] = null; fx = { error: true, from: c.cur, to: tCur }; }
    }

    let inversion = 0, invForMer = 0, revenue = 0, ventasMeta = 0;
    const porPlataforma = [];
    cuentas.forEach((c, i) => {
      const s = spends[i];
      if (!s) return;
      const rate = c.cur !== tCur && rates[c.cur] ? rates[c.cur] : 1;
      inversion += s.spend;
      invForMer += s.spend * rate;
      revenue += s.spend * rate * (s.roasMeta || 0);
      ventasMeta += s.ventasMeta || 0;
      porPlataforma.push({ account: c.id, plataforma: platformOf(c.id), inversion: Math.round(s.spend * rate), ventas: s.ventasMeta || 0, roas: s.roasMeta || 0 });
    });
    if (fx && !fx.error) fx.inversionConvertida = Math.round(invForMer);
    const roasMeta = invForMer ? +(revenue / invForMer).toFixed(2) : 0;

    // facturacion ya es solo lo pagado → este MER es el real (venta cobrada / inversión).
    const mer = invForMer ? +(tienda.facturacion / invForMer).toFixed(2) : null;
    return Response.json({
      since, until, inversion, inversionConv: Math.round(invForMer),
      accCur: cuentas[0]?.cur || "", fx, roasMeta, ventasMeta, mer,
      ...(porPlataforma.length > 1 ? { porPlataforma } : {}),
      ...tienda,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
