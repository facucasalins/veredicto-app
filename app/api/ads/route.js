import { cookies } from "next/headers";
import { getAds } from "@/lib/meta";
import { buildRows, buildAudienceRows } from "@/lib/nomenclatura";
import { enrichWithSheet } from "@/lib/sheet";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("account");
  const preset = searchParams.get("preset") || "last_30d";
  const tab = searchParams.get("tab"); // pestaña del Sheet elegida en el panel (puede venir vacía)
  const since = searchParams.get("since"); // rango personalizado (opcional)
  const until = searchParams.get("until");
  const range = since && until ? { since, until } : null;
  if (!account) return Response.json({ error: "falta account" }, { status: 400 });
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!canSeeAccount(sess, account)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });
  try {
    const ads = await getAds(account, preset, range);
    let rows = buildRows(ads);
    rows = await enrichWithSheet(rows, tab); // si hay pestaña, cruza el Sheet; si no, devuelve las rows igual
    return Response.json({ rows, audiencias: buildAudienceRows(ads) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
