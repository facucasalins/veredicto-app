// lib/export.js
// Exportación a CSV de los resultados de una cuenta en un período: una fila por ANUNCIO (con su
// campaña y conjunto), o agregado por CONJUNTO o por CAMPAÑA. Trabaja sobre la forma de fila que
// devuelven getAds de Meta/TikTok/Google (misma forma) + los mapas de estado/audiencia/tipo que ya
// arma /api/ads. Sin dependencias.
//
// Formato pensado para Excel en español (es-AR): separador `;`, decimales con COMA, BOM UTF-8 al
// inicio (sin el BOM Excel muestra "Ã±" en vez de "ñ"). Google Sheets lo abre igual.
//
// Montos en la MONEDA DE LA CUENTA (columna `moneda`): acá no convertimos — el panel convierte
// USD→ARS para pensar en pesos, pero un export es un registro y conviene que coincida con lo que
// muestra el Administrador de anuncios.

const SEP = ";";

const cell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const dec = (n, d = 2) => (isFinite(n) ? n.toFixed(d).replace(".", ",") : "");
const int = (n) => (isFinite(n) ? String(Math.round(n)) : "");
const div = (a, b) => (b ? a / b : 0);

const ESTADO = { ACTIVE: "activo", PAUSED: "pausado", ADSET_PAUSED: "conjunto pausado", CAMPAIGN_PAUSED: "campaña pausada" };

// Suma las métricas sumables de un grupo de anuncios (ventas, spend, embudo). ROAS se recompone
// desde la facturación atribuida (spend × roas) — el promedio simple de ROAS estaría mal.
function agregar(ads) {
  const g = { spend: 0, revenue: 0, ventas: 0, conversaciones: 0, impressions: 0, linkClicks: 0, lpv: 0, viewContent: 0, addToCart: 0, checkout: 0, video3s: 0, thruplay: 0, video100: 0, ads: 0, activos: 0 };
  for (const a of ads) {
    g.spend += a.spend || 0; g.revenue += (a.spend || 0) * (a.roas || 0);
    g.ventas += a.ventas || 0; g.conversaciones += a.conversaciones || 0; g.impressions += a.impressions || 0;
    g.linkClicks += a.linkClicks || 0; g.lpv += a.lpv || 0; g.viewContent += a.viewContent || 0; g.addToCart += a.addToCart || 0; g.checkout += a.checkout || 0;
    g.video3s += a.video3s || 0; g.thruplay += a.thruplay || 0; g.video100 += a.video100 || 0;
    g.ads += 1; if (a._estado === "ACTIVE") g.activos += 1;
  }
  g.roas = div(g.revenue, g.spend);
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
  ["video_100%", (g) => int(g.video100)],
];

// ads: filas de getAds. maps: { statusMap, audMap, tipoMap } (los de /api/ads; pueden venir vacíos).
// nivel: "anuncio" | "conjunto" | "campana". meta: { cuenta, moneda, since, until, plataforma }.
export function buildCsv(ads, nivel, maps = {}, meta = {}) {
  const { statusMap = {}, audMap = {}, tipoMap = {} } = maps;
  const base = { cuenta: meta.cuenta || "", plataforma: meta.plataforma || "Meta", desde: meta.since || "", hasta: meta.until || "", moneda: meta.moneda || "" };
  const enriched = ads.map((a) => ({ ...a, _estado: statusMap[a.id] || null, _aud: audMap[a.adset_id] || "", _tipo: tipoMap[a.adset_id] || "ventas" }));

  let header, rows;
  if (nivel === "campana") {
    const by = {};
    for (const a of enriched) { const k = a.campaign_id || a.campaign; (by[k] || (by[k] = { campaign_id: a.campaign_id, campaign: a.campaign, conjuntos: new Set(), ads: [] })).ads.push(a); by[k].conjuntos.add(a.adset_id || a.adset); }
    header = ["campana", "campaign_id", "conjuntos", "anuncios", "anuncios_activos", ...METRICAS.map(([h]) => h)];
    rows = Object.values(by).map((c) => { const g = agregar(c.ads); return [c.campaign, c.campaign_id, c.conjuntos.size, g.ads, g.activos, ...METRICAS.map(([, f]) => f(g))]; });
  } else if (nivel === "conjunto") {
    const by = {};
    for (const a of enriched) { const k = a.adset_id || (a.campaign + "‖" + a.adset); (by[k] || (by[k] = { campaign_id: a.campaign_id, campaign: a.campaign, adset_id: a.adset_id, adset: a.adset, aud: a._aud, tipo: a._tipo, ads: [] })).ads.push(a); }
    header = ["campana", "campaign_id", "conjunto", "adset_id", "audiencia", "tipo", "anuncios", "anuncios_activos", ...METRICAS.map(([h]) => h)];
    rows = Object.values(by).map((c) => { const g = agregar(c.ads); return [c.campaign, c.campaign_id, c.adset, c.adset_id, c.aud, c.tipo, g.ads, g.activos, ...METRICAS.map(([, f]) => f(g))]; });
  } else {
    // por anuncio: alcance/frecuencia y clasificaciones de calidad solo tienen sentido acá
    // (reach no se suma entre anuncios; los rankings son por anuncio)
    header = ["campana", "campaign_id", "conjunto", "adset_id", "anuncio", "ad_id", "estado", "audiencia", "tipo", ...METRICAS.map(([h]) => h), "alcance", "frecuencia", "calidad", "tasa_interaccion", "tasa_conversion"];
    rows = enriched.map((a) => [a.campaign, a.campaign_id, a.adset, a.adset_id, a.name, a.id, a._estado ? (ESTADO[a._estado] || a._estado.toLowerCase()) : "", a._aud, a._tipo,
      ...METRICAS.map(([, f]) => f(a)), int(a.reach), dec(a.frequency, 1), a.calidad || "", a.interaccion || "", a.conversion || ""]);
  }
  // orden: más spend primero (índice de spend = primera métrica)
  const spendIdx = header.indexOf("spend");
  rows.sort((x, y) => parseFloat(String(y[spendIdx]).replace(",", ".")) - parseFloat(String(x[spendIdx]).replace(",", ".")));

  const fullHeader = [...Object.keys(base), ...header];
  const lines = [fullHeader.map(cell).join(SEP), ...rows.map((r) => [...Object.values(base), ...r].map(cell).join(SEP))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export const NIVELES = ["anuncio", "conjunto", "campana"];
