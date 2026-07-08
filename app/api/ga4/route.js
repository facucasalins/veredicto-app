import { cookies } from "next/headers";
import { gaEnabled, gaDemo, propertyFor, getResumen, getCanales } from "@/lib/ga4";
import { presetToRange } from "@/lib/dates";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Tráfico y embudo del SITIO desde GA4 (piloto): sesiones reales de todos los canales, embudo
// sesión→carrito→checkout→compra y desglose por canal (orgánico/directo/email/paid). Degrada:
// sin GA4 configurado devuelve { off: true } y el front no muestra nada.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("account");
  const store = searchParams.get("store");
  const preset = searchParams.get("preset") || "last_30d";
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (account && !canSeeAccount(sess, account)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });

  if (!gaEnabled()) return Response.json({ off: true });
  const prop = propertyFor(account, store);
  if (!prop) return Response.json({ off: true }); // sin propiedad mapeada para este cliente

  const qsSince = searchParams.get("since"), qsUntil = searchParams.get("until");
  const { since, until } = qsSince && qsUntil ? { since: qsSince, until: qsUntil } : presetToRange(preset);
  try {
    const [resumen, canales] = await Promise.all([
      getResumen(prop.property_id, since, until),
      getCanales(prop.property_id, since, until).catch(() => []),
    ]);
    return Response.json({ since, until, demo: gaDemo(), propiedad: prop.name || prop.property_id, resumen, canales });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
