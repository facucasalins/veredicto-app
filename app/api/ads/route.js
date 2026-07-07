import { cookies } from "next/headers";
import { getAds, getAdsetTargeting, getAdStatuses } from "@/lib/meta";
import { isTikTok, ttId, getAds as ttGetAds, getAdStatuses as ttGetAdStatuses, getAdgroupAudiences } from "@/lib/tiktok";
import { isGoogle, gId, getAds as gGetAds, getAdStatuses as gGetAdStatuses } from "@/lib/google";
import { presetToRange } from "@/lib/dates";
import { buildRows, buildAudienceRows, classifyTargeting, targetingTipo, goalEmbudo } from "@/lib/nomenclatura";
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
    let ads, audMap = {}, tipoMap = {}, goalMap = {}, statuses;
    if (isTikTok(account)) {
      // TikTok: misma forma de fila que Meta (buildRows y el cruce con Sheet funcionan igual,
      // porque dependen del nombre del anuncio). TikTok necesita fechas explícitas → presetToRange.
      // Su API limita el rango del reporte → "maximum" se acota a ~1 año.
      const adv = ttId(account);
      const r = range || presetToRange(preset === "maximum" ? "last_90d" : preset);
      if (preset === "maximum" && !range) { const d = new Date(); d.setUTCDate(d.getUTCDate() - 364); r.since = d.toISOString().slice(0, 10); }
      const [ttAds, aud, st] = await Promise.all([
        ttGetAds(adv, r.since, r.until),
        getAdgroupAudiences(adv).catch(() => ({})),
        ttGetAdStatuses(adv).catch(() => null),
      ]);
      ads = ttAds; audMap = aud; statuses = st;
      for (const a of ads) tipoMap[a.adset_id] = "ventas"; // TikTok: sin campañas de mensajería
    } else if (isGoogle(account)) {
      // Google Ads: los nombres (RSA, PMax) NO llevan nuestra nomenclatura → sin fingerprint cada
      // anuncio queda como su propia fila y el cruce con el Sheet no aplica (se saltea más abajo).
      // Sin clasificación de audiencias todavía: el desglose cae al nombre del ad group. Todo tipo
      // "ventas" (Google no tiene modo mensajes). PMax no reporta a nivel anuncio (queda afuera).
      const cid = gId(account);
      const r = range || presetToRange(preset);
      const [gAds, st] = await Promise.all([
        gGetAds(cid, r),
        gGetAdStatuses(cid).catch(() => null),
      ]);
      ads = gAds; statuses = st;
      for (const a of ads) tipoMap[a.adset_id] = "ventas";
    } else {
      // Insights + targeting real en paralelo. Si el targeting falla, audMap queda vacío y se cae
      // al parseo del nombre del conjunto (degradación elegante).
      const [mAds, targeting, st] = await Promise.all([
        getAds(account, preset, range),
        getAdsetTargeting(account).catch(() => ({})),
        getAdStatuses(account).catch(() => null),
      ]);
      ads = mAds; statuses = st;
      for (const id in targeting) { const lbl = classifyTargeting(targeting[id]); if (lbl) audMap[id] = lbl; tipoMap[id] = targetingTipo(targeting[id]); const gp = goalEmbudo(targeting[id]); if (gp != null) goalMap[id] = gp; }
    }
    const statusMap = statuses && Object.keys(statuses).length ? statuses : null;
    let rows = buildRows(ads, audMap, statusMap, tipoMap, goalMap); // goalMap vacío en TikTok/Google → sin techo, degrada
    if (isGoogle(account)) {
      // Sin nomenclatura, label() devuelve "nd" para todos → usamos el nombre real del anuncio
      // (el fingerprint ES el nombre completo cuando no hay timestamp). Y el Sheet no se cruza.
      rows = rows.map((r) => (r.nombre === "nd" ? { ...r, nombre: r.id } : r));
    } else {
      rows = await enrichWithSheet(rows, tab); // si hay pestaña, cruza el Sheet; si no, devuelve las rows igual
    }
    return Response.json({ rows, audiencias: buildAudienceRows(ads, audMap) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
