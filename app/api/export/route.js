import { cookies } from "next/headers";
import { getAccounts, getAds, getAdsetTargeting, getAdStatuses } from "@/lib/meta";
import { isTikTok, ttId, getAds as ttGetAds, getAdStatuses as ttGetAdStatuses, getAdgroupAudiences } from "@/lib/tiktok";
import { isGoogle, gId, getAds as gGetAds, getAdStatuses as gGetAdStatuses, getChannelAudiences } from "@/lib/google";
import { presetToRange } from "@/lib/dates";
import { classifyTargeting, targetingTipo } from "@/lib/nomenclatura";
import { buildCsv, NIVELES } from "@/lib/export";
import { parseAccounts, platformOf } from "@/lib/multi";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // rangos largos en cuentas grandes: insights paginados + estados

// Descarga CSV de los resultados del período: ?accounts=a,b&curs=ARS,USD (o account=) &preset=|
// since=&until= &nivel=anuncio|conjunto|campana. Misma data que /api/ads (insights + estado +
// audiencia real), sin Sheet: una fila por anuncio con su campaña/conjunto (+ nomenclatura y etapa
// de embudo), o agregada. Con varias cuentas (vista combinada) van TODAS en el mismo archivo, cada
// fila con su plataforma y moneda. El browser lo baja como archivo (Content-Disposition).

// Data de UNA cuenta, por plataforma (misma lógica que /api/ads, sin Sheet ni nomenclatura).
async function cargar(c, range, preset, usarPreset) {
  const id = c.id;
  let ads, statusMap = {}, audMap = {}, tipoMap = {}, moneda = c.cur || "", nombre = id;
  if (isTikTok(id)) {
    const adv = ttId(id);
    const [a, aud, st] = await Promise.all([ttGetAds(adv, range.since, range.until), getAdgroupAudiences(adv).catch(() => ({})), ttGetAdStatuses(adv).catch(() => ({}))]);
    ads = a; audMap = aud || {}; statusMap = st || {};
  } else if (isGoogle(id)) {
    const cid = gId(id);
    const [a, aud, st] = await Promise.all([gGetAds(cid, range), getChannelAudiences(cid).catch(() => ({})), gGetAdStatuses(cid).catch(() => ({}))]);
    ads = a; audMap = aud || {}; statusMap = st || {};
  } else {
    const [a, targeting, st, cuentas] = await Promise.all([
      getAds(id, preset, usarPreset ? null : range),
      getAdsetTargeting(id).catch(() => ({})),
      getAdStatuses(id).catch(() => ({})),
      getAccounts().catch(() => []),
    ]);
    ads = a; statusMap = st || {};
    for (const k in targeting) { const lbl = classifyTargeting(targeting[k]); if (lbl) audMap[k] = lbl; tipoMap[k] = targetingTipo(targeting[k]); }
    const acc = (cuentas || []).find((x) => String(x.id) === String(id));
    if (acc) { moneda = acc.currency || moneda; nombre = acc.name || id; } // la moneda REAL de Meta manda sobre la que dice el front
  }
  return { ads, maps: { statusMap, audMap, tipoMap }, meta: { cuenta: nombre, moneda, since: range.since, until: range.until, plataforma: platformOf(id) } };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const cuentas = parseAccounts(searchParams); // [{id, cur}] — una o varias
  const preset = searchParams.get("preset") || "last_30d";
  const nivel = NIVELES.includes(searchParams.get("nivel")) ? searchParams.get("nivel") : "anuncio";
  const qsSince = searchParams.get("since"), qsUntil = searchParams.get("until");
  const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
  if (!cuentas.length) return Response.json({ error: "falta account" }, { status: 400 });
  if ((qsSince || qsUntil) && !(okDate(qsSince) && okDate(qsUntil))) return Response.json({ error: "fechas inválidas" }, { status: 400 });
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  for (const c of cuentas) if (!canSeeAccount(sess, c.id)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });

  const usarPreset = !(qsSince && qsUntil);
  const range = usarPreset ? presetToRange(preset) : { since: qsSince, until: qsUntil };
  try {
    const grupos = await Promise.all(cuentas.map((c) => cargar(c, range, preset, usarPreset)));
    const csv = buildCsv(grupos, nivel);
    const safe = String(grupos[0].meta.cuenta).replace(/[^\w.-]+/g, "_").slice(0, 40);
    const filename = `nusa_${safe}${grupos.length > 1 ? "_combinado" : ""}_${nivel}_${range.since}_${range.until}.csv`;
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
