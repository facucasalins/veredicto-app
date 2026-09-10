// lib/export.js
// Exportación a CSV de los resultados de una o varias cuentas en un período: una fila por ANUNCIO
// (con su campaña y conjunto), o agregado por CONJUNTO o por CAMPAÑA. Trabaja sobre la forma de
// fila que devuelven getAds de Meta/TikTok/Google (misma forma) + los mapas de estado/audiencia/
// tipo que ya arma /api/ads. Las columnas de nomenclatura salen de parseName (el MISMO parser del
// panel) y la etapa de embudo de audEmbudoPos (la misma regla que audPos).
//
// Formato pensado para Excel en español (es-AR): separador `;`, decimales con COMA, BOM UTF-8 al
// inicio (sin el BOM Excel muestra "Ã±" en vez de "ñ"). Google Sheets lo abre igual.
//
// Montos en la MONEDA DE LA CUENTA (columna `moneda`): acá no convertimos — el panel convierte
// USD→ARS para pensar en pesos, pero un export es un registro y conviene que coincida con lo que
// muestra el Administrador de anuncios.

import { parseName, audEmbudoPos } from "@/lib/nomenclatura";

const SEP = ";";

const cell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const dec = (n, d = 2) => (isFinite(n) ? n.toFixed(d).replace(".", ",") : "");
const int = (n) => (isFinite(n) ? String(Math.round(n)) : "");
const div = (a, b) => (b ? a / b : 0);
const pct = (a, b) => (b ? dec(div(a, b) * 100) : ""); // vacío si no hay denominador

// Estado exportado, SIEMPRE con valor: activo | pausado | archivado | sin_dato.
// "pausado" agrupa todo lo que no entrega y no está archivado (pausado por el anuncio, por el
// conjunto o la campaña, rechazado, en revisión, con problemas...).
const estadoTxt = (s) => !s ? "sin_dato" : s === "ACTIVE" ? "activo" : (s === "ARCHIVED" || s === "DELETED") ? "archivado" : "pausado";

// Etapa de embudo desde la audiencia (misma regla que audPos del panel): Hot/Tibio → caliente,
// Lookalike → medio, Advantage+/Amplio/Intereses → frío. Sin señal (Mensajería, nd) → vacío.
const etapaTxt = (aud) => { const p = audEmbudoPos(aud); return p == null ? "" : p >= 1.5 ? "caliente" : p >= 1 ? "medio" : "frio"; };

// Nomenclatura del nombre del anuncio (solo Meta/TikTok: Google no la usa → columnas vacías).
const NOM_VACIA = { fingerprint: "", fecha: "", concepto: "", angulo: "", formato: "" };
function nomenclatura(name, plataforma) {
  if (plataforma === "Google") return NOM_VACIA;
  const p = parseName(name);
  const ts = (p.fingerprint.match(/\((\d{1,2}\.\d{2}\.\d{2})\)/) || [])[1] || ""; // catálogos: sin (HH.MM.SS) → vacío
  return { fingerprint: ts, fecha: p.fecha || "", concepto: p.concepto, angulo: p.angulo, formato: p.formato };
}

// Suma las métricas sumables de un grupo de anuncios (ventas, spend, embudo). ROAS se recompone
// desde la facturación atribuida (spend × roas) — el promedio simple de ROAS estaría mal. El tiempo
// promedio de video se pondera por impresiones.
function agregar(ads) {
  const g = { spend: 0, revenue: 0, ventas: 0, conversaciones: 0, impressions: 0, linkClicks: 0, lpv: 0, viewContent: 0, addToCart: 0, checkout: 0, video3s: 0, thruplay: 0, video50: 0, video100: 0, avgW: 0, avgImp: 0, ads: 0, activos: 0 };
  for (const a of ads) {
    g.spend += a.spend || 0; g.revenue += (a.spend || 0) * (a.roas || 0);
    g.ventas += a.ventas || 0; g.conversaciones += a.conversaciones || 0; g.impressions += a.impressions || 0;
    g.linkClicks += a.linkClicks || 0; g.lpv += a.lpv || 0; g.viewContent += a.viewContent || 0; g.addToCart += a.addToCart || 0; g.checkout += a.checkout || 0;
    g.video3s += a.video3s || 0; g.thruplay += a.thruplay || 0; g.video50 += a.video50 || 0; g.video100 += a.video100 || 0;
    if (a.videoAvgTime > 0 && a.impressions > 0) { g.avgW += a.videoAvgTime * a.impressions; g.avgImp += a.impressions; }
    g.ads += 1; if (a._estado === "ACTIVE") g.activos += 1;
  }
  g.roas = div(g.revenue, g.spend);
  g.videoAvgTime = g.avgImp ? g.avgW / g.avgImp : null;
  return g;
}

// Columnas de métricas comunes a los tres niveles (a partir de un agregado o de un ad).
const METRICAS = [
  ["spend", (g) => dec(g.spend)],
  ["impresiones", (g) => int(g.impressions)],
  ["clics_link", (g) => int(g.linkClicks)],
  ["ctr_%", (g) => dec(div(g.linkClicks, g.impressions) * 100)],
  ["cpm", (g) => dec(div(g.spend, g.impressions) * 1000)],
  ["cpc", (g) => dec(div(g.spend, g.linkClicks))],
  ["ventas", (g) => int(g.ventas)],
  ["facturacion_atribuida", (g) => dec(g.spend * (g.roas || 0))],
  ["roas", (g) => dec(g.roas)],
  ["cpa", (g) => dec(div(g.spend, g.ventas))],
  ["conversaciones", (g) => int(g.conversaciones)],
  ["costo_por_conversacion", (g) => dec(div(g.spend, g.conversaciones))],
  ["landing_page_views", (g) => int(g.lpv)],
  ["view_content", (g) => int(g.viewContent)],
  ["add_to_cart", (g) => int(g.addToCart)],
  ["initiate_checkout", (g) => int(g.checkout)],
  ["video_3s", (g) => int(g.video3s)],
  ["thruplay", (g) => int(g.thruplay)],
  ["video_p50", (g) => int(g.video50)],
  ["video_tiempo_promedio_s", (g) => (g.videoAvgTime > 0 ? dec(g.videoAvgTime) : "")],
  ["video_100%", (g) => int(g.video100)],
  ["hook_rate_%", (g) => pct(g.video3s, g.impressions)], // 3s / impresiones: cuántos frenan el scroll
  ["hold_rate_%", (g) => pct(g.thruplay, g.video3s)],    // ThruPlay / 3s: cuántos se quedan
];
// "sin reproducciones": video con >5.000 impresiones y <2% de reproducciones de 3 s — Meta lo sirve
// como VIDEO (object_type VIDEO, verificado) pero casi no lo reproduce en NINGUNA ubicación (~0,3%
// vs ~95% en un video sano). Problema del creativo, no del placement. Solo formatos de video.
const VIDEO_FMTS = ["VID", "REEL", "STORY"];
const videoValido = (a, formato) => (!VIDEO_FMTS.includes(String(formato || "").toUpperCase()) ? "" : ((a.impressions || 0) > 5000 && (a.video3s || 0) / a.impressions < 0.02 ? "false" : "true"));
const MH = METRICAS.map(([h]) => h);
const MV = (g) => METRICAS.map(([, f]) => f(g));

const BASE = ["cuenta", "plataforma", "desde", "hasta", "moneda"];
const HEADERS = {
  campana:  [...BASE, "campana", "campaign_id", "conjuntos", "anuncios", "anuncios_activos", ...MH],
  conjunto: [...BASE, "campana", "campaign_id", "conjunto", "adset_id", "audiencia", "etapa_embudo", "tipo", "anuncios", "anuncios_activos", ...MH],
  // por anuncio: alcance/frecuencia y clasificaciones de calidad solo tienen sentido acá
  // (reach no se suma entre anuncios; los rankings son por anuncio)
  anuncio:  [...BASE, "campana", "campaign_id", "conjunto", "adset_id", "anuncio", "fingerprint", "fecha", "concepto", "angulo", "formato", "ad_id", "estado", "audiencia", "etapa_embudo", "tipo", ...MH, "video_valido", "alcance", "frecuencia", "calidad", "tasa_interaccion", "tasa_conversion"],
};

// Filas de UNA cuenta. ads: filas de getAds. maps: { statusMap, audMap, tipoMap }.
// meta: { cuenta, moneda, since, until, plataforma }. Devuelve arrays alineados con HEADERS[nivel].
function filasCuenta(ads, nivel, maps = {}, meta = {}) {
  const { statusMap = {}, audMap = {}, tipoMap = {} } = maps;
  const plataforma = meta.plataforma || "Meta";
  const base = [meta.cuenta || "", plataforma, meta.since || "", meta.until || "", meta.moneda || ""];
  const enriched = ads.map((a) => ({ ...a, _estado: statusMap[a.id] || null, _aud: audMap[a.adset_id] || "", _tipo: tipoMap[a.adset_id] || "ventas" }));
  if (nivel === "campana") {
    const by = {};
    for (const a of enriched) { const k = a.campaign_id || a.campaign; (by[k] || (by[k] = { campaign_id: a.campaign_id, campaign: a.campaign, conjuntos: new Set(), ads: [] })).ads.push(a); by[k].conjuntos.add(a.adset_id || a.adset); }
    return Object.values(by).map((c) => { const g = agregar(c.ads); return [...base, c.campaign, c.campaign_id, c.conjuntos.size, g.ads, g.activos, ...MV(g)]; });
  }
  if (nivel === "conjunto") {
    const by = {};
    for (const a of enriched) { const k = a.adset_id || (a.campaign + "‖" + a.adset); (by[k] || (by[k] = { campaign_id: a.campaign_id, campaign: a.campaign, adset_id: a.adset_id, adset: a.adset, aud: a._aud, tipo: a._tipo, ads: [] })).ads.push(a); }
    return Object.values(by).map((c) => { const g = agregar(c.ads); return [...base, c.campaign, c.campaign_id, c.adset, c.adset_id, c.aud, etapaTxt(c.aud), c.tipo, g.ads, g.activos, ...MV(g)]; });
  }
  return enriched.map((a) => { const n = nomenclatura(a.name, plataforma); return [...base, a.campaign, a.campaign_id, a.adset, a.adset_id, a.name, n.fingerprint, n.fecha, n.concepto, n.angulo, n.formato, a.id, estadoTxt(a._estado), a._aud, etapaTxt(a._aud), a._tipo,
    ...MV(a), videoValido(a, n.formato), int(a.reach), dec(a.frequency, 1), a.calidad || "", a.interaccion || "", a.conversion || ""]; });
}

// grupos: [{ ads, maps, meta }] — una entrada por cuenta (la vista combinada manda varias).
// Todas las filas comparten el header del nivel; orden: más spend primero, cruzando cuentas.
export function buildCsv(grupos, nivel) {
  const header = HEADERS[nivel] || HEADERS.anuncio;
  const rows = grupos.flatMap((g) => filasCuenta(g.ads, nivel, g.maps, g.meta));
  const spendIdx = header.indexOf("spend");
  rows.sort((x, y) => parseFloat(String(y[spendIdx]).replace(",", ".")) - parseFloat(String(x[spendIdx]).replace(",", ".")));
  const lines = [header.map(cell).join(SEP), ...rows.map((r) => r.map(cell).join(SEP))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export const NIVELES = ["anuncio", "conjunto", "campana"];
