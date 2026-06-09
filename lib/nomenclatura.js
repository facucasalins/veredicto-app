// Parser de la nomenclatura del nombre del anuncio + audiencia del conjunto + armado de filas.
// Anuncio: "09-04-26 - VID - HookTexana - Demostrativo - 8 pts - (17.21.53) - Juanita Shoes"
// Conjunto: "AN · JS · RMKT (Hot)" / "AN · JS · LAL 1% Compradores" / "AN · JS · Advantage+"
const CATEGORIAS = ["Demostrativo", "Lanzamiento", "Urgencia", "Transaccional", "Comparativo", "Aspiracional", "Educativo", "Reseña", "Testimonial", "Reseñas"];
const FORMATOS = ["VID", "IMG", "GIF", "CAR", "EST", "STORY", "REEL"];

export function parseName(name = "") {
  const clean = String(name).replace(/\s*-\s*Copia\s*$/i, "").trim();
  if (/cat[aá]logo/i.test(clean)) {
    return { tipo: "catalogo", angulo: "Catálogo", concepto: clean.replace(/^cat[aá]logo\s+din[aá]mico\s*-?\s*/i, "").trim() || "Catálogo", formato: "DPA", fecha: null, fingerprint: clean };
  }
  const parts = clean.split(" - ").map((s) => s.trim());
  const tsPart = parts.find((p) => /^\(\d{1,2}\.\d{2}\.\d{2}\)$/.test(p));
  const ts = tsPart ? tsPart.replace(/[()]/g, "") : null;
  const angulo = parts.find((p) => CATEGORIAS.some((c) => c.toLowerCase() === p.toLowerCase())) || "nd";
  const fi = parts.findIndex((p) => FORMATOS.some((f) => f.toLowerCase() === p.toLowerCase()));
  const formato = fi >= 0 ? parts[fi].toUpperCase() : "nd";
  const concepto = fi >= 0 && parts[fi + 1] ? parts[fi + 1] : "nd";
  const fecha = /^\d{2}-\d{2}-\d{2}$/.test(parts[0]) ? parts[0] : null;
  const fingerprint = ts ? `${concepto} (${ts})` : clean;
  return { tipo: "video", angulo, concepto, formato, fecha, fingerprint };
}

// Clasifica la audiencia desde el nombre del conjunto (último segmento, normalizado).
export function parseAudience(adsetName = "") {
  const s = String(adsetName).trim();
  if (!s) return "nd";
  const parts = s.split(/[·|]/).map((x) => x.trim()).filter(Boolean);
  let seg = (parts.length ? parts[parts.length - 1] : s).trim();
  seg = seg.replace(/^(iniciar pago|add to cart|agregar al carrito|view content|ver contenido|lead|tr[aá]fico)\s+/i, "").trim();
  const low = seg.toLowerCase();
  if (/\b(rmkt|retarget|remarket)\b/.test(low)) { const m = seg.match(/\(([^)]+)\)/); return m ? "Retargeting (" + m[1].trim() + ")" : "Retargeting"; }
  if (/visitant|web\s*\d+\s*d|vis\.?\s*web|add ?to ?cart|carrito/.test(low)) return "Retargeting (Web)";
  if (/\b(lal|lookalike|similar)\b/.test(low)) { const m = seg.match(/(\d+\s*%)/); return m ? "Lookalike " + m[1].replace(/\s+/g, "") : "Lookalike"; }
  if (/advantage/.test(low)) return "Advantage+";
  if (/amplio|inter[eé]s|interes/.test(low)) return "Amplio/Intereses";
  if (/whatsapp|mensaj|interacci[oó]n|reply|replies|\bdm\b/.test(low)) return "Mensajería";
  if (/broad|abierto/.test(low)) return "Amplio";
  return seg || "nd";
}

// Clasifica la audiencia desde el TARGETING REAL del adset (no del nombre). Regla acordada:
// dentro de Retargeting, "gana la intención más alta presente" (si toca alguna audiencia de
// alta intención → Hot; si solo toca tráfico/engagement → Tibio). Intereses manda sobre
// Advantage+ (si hay intereses cargados, el buyer está targeteando por interés).
const HOT_RE = /view\s*content|viewcontent|add\s*to\s*cart|addtocart|initiate\s*checkout|initiatecheckout|checkout|purchase|compra|carrito|\bpago\b/i;
const LAL_RE = /\blal\b|look\s*-?\s*alike|similar/i;

export function classifyTargeting(adset) {
  if (!adset) return null;
  const t = adset.targeting || {};
  const opt = String(adset.optimization_goal || "").toUpperCase();
  const dest = String(adset.destination_type || "").toUpperCase();
  if (/WHATSAPP|MESSENGER|MESSAGE/.test(dest) || /CONVERSATIONS|REPLIES|MESSAGE/.test(opt)) return "Mensajería";
  const ca = (t.custom_audiences || []).map((c) => c.name || "");
  if (ca.length) {
    if (ca.some((n) => LAL_RE.test(n))) {
      const pct = ca.map((n) => (n.match(/(\d+(?:[.,]\d+)?)\s*%/) || [])[1]).find(Boolean);
      return pct ? `Lookalike ${pct.replace(",", ".")}%` : "Lookalike";
    }
    return ca.some((n) => HOT_RE.test(n)) ? "Retargeting (Hot)" : "Retargeting (Tibio)";
  }
  const hasInterests = Array.isArray(t.flexible_spec) && t.flexible_spec.some((f) => (f.interests || []).length);
  if (hasInterests) return "Amplio/Intereses";
  const adv = t.targeting_automation && t.targeting_automation.advantage_audience;
  if (adv === 1 || adv === "1") return "Advantage+";
  return "Amplio";
}

// Audiencia de un anuncio: targeting real (audMap por adset_id) y, si no está, el nombre del conjunto.
function audOf(a, audMap) {
  return (audMap && audMap[a.adset_id]) || parseAudience(a.adset);
}

function label(p) {
  if (p.tipo === "catalogo") return "Catálogo · " + p.concepto;
  return [p.concepto, p.angulo].filter((x) => x && x !== "nd").join(" · ") || "nd";
}

// Agrega placements del MISMO creativo (mismo fingerprint). Audiencia = la dominante (o "varias").
export function buildRows(ads, audMap, statusMap) {
  const m = {};
  for (const a of ads) {
    const p = parseName(a.name);
    const k = p.fingerprint;
    if (!m[k]) m[k] = { id: k, nombre: label(p), ang: p.angulo, sec: "—", split: "100/0", hook: p.concepto, fmt: p.formato, spend: 0, revenue: 0, ventas: 0, placements: 0, activos: 0, tipo: p.tipo, audSpend: {}, bk: {} };
    const g = m[k];
    g.spend += a.spend; g.revenue += a.spend * a.roas; g.ventas += a.ventas; g.placements += 1;
    if (statusMap && statusMap[a.id] === "ACTIVE") g.activos += 1;
    const aud = audOf(a, audMap);
    g.audSpend[aud] = (g.audSpend[aud] || 0) + a.spend;
    // desglose por campaña + adset + audiencia real (para el acordeón de composición del ranking)
    const camp = a.campaign || "—", adset = a.adset || "—", bk = camp + " ‖ " + adset;
    if (!g.bk[bk]) g.bk[bk] = { campaign: camp, adset, aud, spend: 0, revenue: 0, ventas: 0 };
    g.bk[bk].spend += a.spend; g.bk[bk].revenue += a.spend * a.roas; g.bk[bk].ventas += a.ventas;
  }
  return Object.values(m).map((g) => {
    const roas = g.spend ? g.revenue / g.spend : 0;
    const cpa = g.ventas ? g.spend / g.ventas : 0;
    const sorted = Object.entries(g.audSpend).sort((x, y) => y[1] - x[1]);
    const aud = sorted.length === 0 ? "nd" : (sorted.length > 1 && sorted[0][1] < g.spend * 0.6 ? "varias" : sorted[0][0]);
    const breakdown = Object.values(g.bk)
      .map((b) => ({ campaign: b.campaign, adset: b.adset, aud: b.aud, spend: Math.round(b.spend), ventas: Math.round(b.ventas), roas: b.spend ? +(b.revenue / b.spend).toFixed(2) : 0 }))
      .sort((a, b) => b.spend - a.spend);
    // activa: null si no sabemos el estado (sin statusMap); true/false si lo sabemos.
    const activa = statusMap ? g.activos > 0 : null;
    return { id: g.id, nombre: g.nombre, ang: g.ang, sec: g.sec, split: g.split, aud, hook: g.hook, fmt: g.fmt, spend: Math.round(g.spend), roas: +roas.toFixed(2), ventas: Math.round(g.ventas), cpa: Math.round(cpa), placements: g.placements, activos: g.activos, activa, breakdown };
  }).sort((a, b) => b.spend - a.spend);
}

// Agrega a nivel ANUNCIO por audiencia (el mismo creativo corre en varias audiencias).
export function buildAudienceRows(ads, audMap) {
  const m = {};
  for (const a of ads) {
    const key = audOf(a, audMap);
    if (!m[key]) m[key] = { key, spend: 0, revenue: 0, ventas: 0, n: 0 };
    const g = m[key];
    g.spend += a.spend; g.revenue += a.spend * a.roas; g.ventas += a.ventas; g.n += 1;
  }
  return Object.values(m).map((g) => ({ key: g.key, spend: Math.round(g.spend), revenue: Math.round(g.revenue), ventas: Math.round(g.ventas), n: g.n })).sort((a, b) => b.spend - a.spend);
}
