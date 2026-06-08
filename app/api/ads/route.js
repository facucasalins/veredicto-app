import { getAds } from "@/lib/meta";
import { buildRows, buildAudienceRows } from "@/lib/nomenclatura";
export const dynamic = "force-dynamic";
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("account");
  const preset = searchParams.get("preset") || "last_30d";
  if (!account) return Response.json({ error: "falta account" }, { status: 400 });
  try {
    const ads = await getAds(account, preset);
    return Response.json({ rows: buildRows(ads), audiencias: buildAudienceRows(ads) });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
