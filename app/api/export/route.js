import { cookies } from "next/headers";
import { getAccounts, getAds, getAdsetTargeting, getAdStatuses } from "@/lib/meta";
import { isTikTok, ttId, getAds as ttGetAds, getAdStatuses as ttGetAdStatuses, getAdgroupAudiences } from "@/lib/tiktok";
import { isGoogle, gId, getAds as gGetAds, getAdStatuses as gGetAdStatuses, getChannelAudiences } from "@/lib/google";
import { presetToRange } from "@/lib/dates";
import { classifyTargeting, targetingTipo } from "@/lib/nomenclatura";
import { buildCsv, NIVELES } from "@/lib/export";
import { platformOf } from "@/lib/multi";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // rangos largos en cuentas grandes: insights paginados + estados

// Descarga CSV de los resultados de la cuenta en el período: ?account=&preset=|since=&until=
// &nivel=anuncio|conjunto|campana. Misma data que /api/ads (insights + estado + audiencia real),
// sin nomenclatura ni Sheet: una fila por anuncio con su campaña/conjunto, o agregada. El browser
// lo baja como archivo (Content-Disposition). Montos en la moneda de la cuenta.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("account");
  const preset = searchParams.get("preset") || "last_30d";
  const nivel = NIVELES.includes(searchParams.get("nivel")) ? searchParams.get("nivel") : "anuncio";
  const qsSince = searchParams.get("since"), qsUntil = searchParams.get("until");
  const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
  if (!account) return Response.json({ error: "falta account" }, { status: 400 });
  if ((qsSince || qsUntil) && !(okDate(qsSince) && okDate(qsUntil))) return Response.json({ error: "fechas inválidas" }, { status: 400 });
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!canSeeAccount(sess, account)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });

  const range = qsSince && qsUntil ? { since: qsSince, until: qsUntil } : presetToRange(preset);
  try {
    let ads, statusMap = {}, audMap = {}, tipoMap = {}, moneda = "", nombre = account;
    if (isTikTok(account)) {
      const adv = ttId(account);
      const [a, aud, st] = await Promise.all([ttGetAds(adv, range.since, range.until), getAdgroupAudiences(adv).catch(() => ({})), ttGetAdStatuses(adv).catch(() => ({}))]);
      ads = a; audMap = aud || {}; statusMap = st || {};
    } else if (isGoogle(account)) {
      const cid = gId(account);
      const [a, aud, st] = await Promise.all([gGetAds(cid, range), getChannelAudiences(cid).catch(() => ({})), gGetAdStatuses(cid).catch(() => ({}))]);
      ads = a; audMap = aud || {}; statusMap = st || {};
    } else {
      const [a, targeting, st, cuentas] = await Promise.all([
        getAds(account, preset, qsSince && qsUntil ? range : null),
        getAdsetTargeting(account).catch(() => ({})),
        getAdStatuses(account).catch(() => ({})),
        getAccounts().catch(() => []),
      ]);
      ads = a; statusMap = st || {};
      for (const id in targeting) { const lbl = classifyTargeting(targeting[id]); if (lbl) audMap[id] = lbl; tipoMap[id] = targetingTipo(targeting[id]); }
      const c = (cuentas || []).find((x) => String(x.id) === String(account));
      if (c) { moneda = c.currency || ""; nombre = c.name || account; }
    }
    const csv = buildCsv(ads, nivel, { statusMap, audMap, tipoMap }, { cuenta: nombre, moneda, since: range.since, until: range.until, plataforma: platformOf(account) });
    const safe = String(nombre).replace(/[^\w.-]+/g, "_").slice(0, 40);
    const filename = `nusa_${safe}_${nivel}_${range.since}_${range.until}.csv`;
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
