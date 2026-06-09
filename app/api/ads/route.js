import { getAds } from "@/lib/meta";
import { buildRows, buildAudienceRows } from "@/lib/nomenclatura";
import { enrichWithSheet } from "@/lib/sheet";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("account");
  const preset = searchParams.get("preset") || "last_30d";
  const tab = searchParams.get("tab"); // pestaña del Sheet elegida en el panel (puede venir vacía)
  if (!account) return Response.json({ error: "falta account" }, { status: 400 });
  try {
    const ads = await getAds(account, preset);
    let rows = buildRows(ads);
    rows = await enrichWithSheet(rows, tab); // si hay pestaña, cruza el Sheet; si no, devuelve las rows igual
    return Response.json({ rows, audiencias: buildAudienceRows(ads) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
