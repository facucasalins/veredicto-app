// lib/conciencia.js
// Nivel de conciencia (Schwartz) de cada creativo, juzgado SOLO por el gancho (primeros 3 s):
//   5 = producto + oferta (precio, descuento, cuotas, promo, escasez de stock)
//   4 = producto/modelo concreto nombrado, o responde una objeción sobre él
//   3 = tipo de producto o atributo/beneficio, sin nombrar el modelo
//   2 = dolor, situación u ocasión del espectador, sin producto
//   1 = identidad, humor, meme, estilo de vida o estética
// Tres fuentes, en este orden: (a) override manual del usuario (Upstash), (b) reglas duras sobre
// el Sheet (sin IA), (c) Claude para lo que las reglas no resuelven (batch, cacheado en Upstash
// sin TTL + memoria). Sin API key o sin Upstash degrada: reglas solas, el resto "nd".
//
// Desvíos de las reglas del spec, calibrados contra Juanita Shoes y Shark (sep 2026):
//   - El regex de nivel 5 NO aplica si la categoría es Comparativo/Testimonial: ahí el "$20.000"
//     del gancho es una objeción de precio, no una oferta (PrecioVsCalidad → 4, no 5).
//   - El nivel 4 por ÁNGULO solo (Novedad/Social_Proof/Autoridad) no aplica sobre categorías
//     Aspiracional/Storytelling/Entretenimiento: un meme etiquetado Social_Proof no es "producto
//     nombrado" → queda sin resolver y lo decide Claude por el gancho (MemeShark 11.31.39 → 1).

import { storeEnabled, kvMget, kvSet } from "@/lib/store";

export const NIVEL_LABEL = { 5: "Producto + oferta", 4: "Producto", 3: "Solución", 2: "Problema", 1: "Inconsciente" };
export const MOTIVADOR_TIPOS = ["Dolor", "Deseo", "Objecion", "Ocasion", "Identidad", "Oferta"];

const RE5 = /\$|%|cuota|3x2|2x1|sale|descuento|\boff\b|oferta|precio|liquidaci|hot (sale|juanita|shark)/i;
const CAT4 = ["Lanzamiento", "Comparativo", "Testimonial"];
const ANG4 = ["Novedad", "Social_Proof", "Autoridad"];
const CAT1 = ["Aspiracional", "Storytelling", "Entretenimiento"];
const ANG1 = ["Estilo_Vida", "nd", ""];
const isTrue = (v) => /^(true|s[ií]|1|yes|verdadero)$/i.test(String(v == null ? "" : v).trim());
const sinOferta = (o) => { const s = String(o || "").trim().toLowerCase(); return !s || s === "sin_oferta" || s === "nd"; };
const corto = (s, n = 80) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

// Campos del Sheet que usa la clasificación (el front manda solo esto por fila).
export const CAMPOS = ["texto_gancho", "gancho_analisis", "prim", "angulo", "oferta", "resumen", "marca", "cta_0a3s", "publico"];

// (b) Reglas duras. Devuelve {nivel, motivador, motivadorTipo} o null (sin resolver).
export function reglas(s = {}) {
  const gancho = String(s.texto_gancho || "");
  const prim = String(s.prim || "nd"), ang = String(s.angulo || "nd"), oferta = s.oferta;
  const n5 = (RE5.test(gancho) && !["Comparativo", "Testimonial"].includes(prim))
    || (isTrue(s.cta_0a3s) && !sinOferta(oferta))
    || (prim === "Urgencia" && ang === "Escasez");
  if (n5) return { nivel: 5, motivadorTipo: "Oferta", motivador: corto(!sinOferta(oferta) ? oferta : gancho) };
  const n4 = CAT4.includes(prim) || (ANG4.includes(ang) && !CAT1.includes(prim));
  if (n4) return { nivel: 4, motivadorTipo: ang === "Social_Proof" || prim === "Testimonial" ? "Objecion" : "Deseo", motivador: corto(gancho !== "nd" ? gancho : prim) };
  const n1 = CAT1.includes(prim) && sinOferta(oferta) && ANG1.includes(ang);
  if (n1) return { nivel: 1, motivadorTipo: "Identidad", motivador: corto(gancho !== "nd" ? gancho : prim) };
  return null;
}

// (c) Claude: batch de hasta 40 creativos, JSON puro. `razon` va ANTES de `nivel` (razonar antes de etiquetar).
const RUBRICA = `Juzgá SOLO los primeros 3 segundos (el gancho). Ignorá ofertas o CTAs del cierre.
5 = el gancho abre con precio, descuento, cuotas, promo o escasez de stock.
4 = el gancho nombra el producto o modelo concreto ("las Alondra", "volvió Petra",
    "esta remera aguantó 20 lavados"), o responde una objeción sobre él.
3 = el gancho habla del TIPO de producto o de un atributo/beneficio sin nombrar el
    modelo ("una texana para todos los días", "si usás straps", "botas 2 en 1").
2 = el gancho abre con un dolor, situación u ocasión del espectador, sin producto
    ("no sabés qué ponerte", "te critican por usar botas en verano",
    "te aburriste de tus botas"). En moda/fitness la ocasión de uso y el look cuentan como problema.
1 = identidad, humor, meme, estilo de vida o estética, sin producto concreto ni dolor
    ("el paraíso de las que amamos los zapatos", "POV: alternás con el mamado").
motivador = el dolor, deseo, objeción, ocasión o identidad concreta que toca el gancho,
en una frase corta y específica de la marca. No repitas la categoría.`;

const SYSTEM = `Sos analista de creativos de Meta Ads para ecommerce en Argentina. Clasificás el NIVEL DE CONCIENCIA (Schwartz) de cada creativo según su gancho.

${RUBRICA}

Aclaraciones: "nombrar el producto" (nivel 4) incluye MOSTRARLO como protagonista en pantalla en los primeros 3 s (unboxing, haul o prueba de una prenda/calzado de la marca, según gancho_analisis) aunque no se diga el nombre del modelo; NO cuenta si el producto es solo decorado de una escena de estilo de vida, humor o identidad (eso es nivel 1).

Respondé EXCLUSIVAMENTE un array JSON (sin texto alrededor, sin markdown), un objeto por creativo, en este orden de campos:
{"fingerprint": string, "razon": string (≤120 chars, tu razonamiento ANTES de decidir), "nivel": 1-5, "motivador": string (≤80 chars), "motivadorTipo": "Dolor"|"Deseo"|"Objecion"|"Ocasion"|"Identidad"|"Oferta", "confianza": "alta"|"media"|"baja"}
Si texto_gancho es "nd" o vacío, usá gancho_analisis y resumen_200c para inferir el gancho.`;

const _mem = {}; // L1 por lambda: key → resultado de Claude
const keyNivel = (tab, fp) => `nusa:nivel:${tab}:${fp}`;
const keyOverride = (tab, fp) => `nusa:nivel_override:${tab}:${fp}`;

// Reintenta la tanda 2 veces (3 intentos). Si el fallo es determinista (un creativo que rompe el
// JSON, salida demasiado larga) repetir igual no sirve: a partir del 2º intento la tanda se parte a
// la mitad, así el problema queda acotado a pocos creativos y el resto se clasifica.
async function claudeBatch(items, intento = 1) {
  try {
    const res = await claudeBatchOnce(items);
    // salida cortada (max_tokens) o creativos que Claude salteó: los que faltan van en tanda más chica
    const faltan = items.filter((it) => !res[it.fingerprint]);
    if (faltan.length && faltan.length < items.length && intento < 3) {
      console.error(`[conciencia] ${faltan.length} de ${items.length} sin clasificar en la tanda; reintento en tanda chica`);
      const extra = await claudeBatch(faltan, intento + 1).catch(() => ({}));
      return { ...res, ...extra };
    }
    return res;
  } catch (e) {
    console.error(`[conciencia] tanda de ${items.length} falló (intento ${intento}/3):`, e.message);
    if (intento >= 3) throw e;
    await new Promise((r) => setTimeout(r, 1500 * intento));
    if (items.length <= 3) return claudeBatch(items, intento + 1);
    const mid = Math.ceil(items.length / 2);
    const [a, b] = await Promise.all([claudeBatch(items.slice(0, mid), intento + 1).catch(() => ({})), claudeBatch(items.slice(mid), intento + 1).catch(() => ({}))]);
    return { ...a, ...b };
  }
}
async function claudeBatchOnce(items) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !items.length) return {};
  const input = items.map((it) => ({
    fingerprint: it.fingerprint, texto_gancho: it.texto_gancho || "nd", gancho_analisis: it.gancho_analisis || "nd",
    categoria_primaria: it.prim || "nd", angulo_de_venta: it.angulo || "nd", oferta_detalles: it.oferta || "nd",
    resumen_200c: it.resumen || "nd", marca: it.marca || "nd",
  }));
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 10000, system: SYSTEM, messages: [{ role: "user", content: "Creativos:\n" + JSON.stringify(input) }] }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || "Error de Claude");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  let arr;
  if (data.stop_reason === "max_tokens") {
    // salida cortada: rescatamos los objetos completos (el resto queda pendiente para la próxima carga)
    console.error("[conciencia] claude cortó por max_tokens con", items.length, "creativos; rescato lo completo");
    arr = (text.match(/\{[^{}]*\}/g) || []).map((o) => { try { return JSON.parse(o); } catch { return null; } }).filter(Boolean);
  } else {
    const a = text.indexOf("["), b = text.lastIndexOf("]");
    arr = JSON.parse(text.slice(a, b + 1));
  }
  const out = {};
  for (const x of Array.isArray(arr) ? arr : []) {
    const nivel = Math.min(5, Math.max(1, parseInt(x.nivel, 10) || 0));
    if (!x.fingerprint || !nivel) continue;
    out[x.fingerprint] = { nivel, motivador: corto(x.motivador), motivadorTipo: MOTIVADOR_TIPOS.includes(x.motivadorTipo) ? x.motivadorTipo : "Deseo", confianza: ["alta", "media", "baja"].includes(x.confianza) ? x.confianza : "media", razon: corto(x.razon, 120) };
  }
  return out;
}

// rows: [{fingerprint, ...CAMPOS}] (filas del panel con Sheet). Devuelve objeto fingerprint →
// {nivel, fuente: override|regla|claude|pendiente|nd, motivo?, motivador, motivadorTipo, confianza, razon?}.
//   fuente "pendiente" = no se llegó a mandar a Claude en ESTA llamada (tope `maxBatches` por
//     llamada, para no pasar el timeout del serverless): el front vuelve a llamar con esos.
//   fuente "nd" + motivo "claude_fallo" = Claude falló 3 veces con esa tanda (reintentar a mano).
//   fuente "nd" + motivo "sin_claude" = sin ANTHROPIC_API_KEY: las reglas no matchearon y no hay IA.
// `cache:false` en el resultado avisa que sin Upstash la clasificación por Claude se repite.
export async function classifyRows(rows, tab, { maxBatches = 2 } = {}) {
  const fps = rows.map((r) => r.fingerprint).filter(Boolean);
  const out = {};
  const upstash = storeEnabled();
  let overrides = [], cached = [];
  if (upstash && fps.length) {
    try { overrides = await kvMget(fps.map((fp) => keyOverride(tab, fp))); } catch { overrides = []; }
    try { cached = await kvMget(fps.map((fp) => keyNivel(tab, fp))); } catch { cached = []; }
  }
  const pendientes = [];
  rows.forEach((r, i) => {
    const fp = r.fingerprint; if (!fp) return;
    const ov = overrides[i];
    if (ov && ov.nivel) { out[fp] = { nivel: ov.nivel, fuente: "override", motivador: ov.motivador || "", motivadorTipo: ov.motivadorTipo || "", confianza: "alta" }; return; }
    const rg = reglas(r);
    if (rg) { out[fp] = { ...rg, fuente: "regla", confianza: "alta" }; return; }
    const c = cached[i] || _mem[keyNivel(tab, fp)];
    if (c && c.nivel) { out[fp] = { ...c, fuente: "claude" }; return; }
    pendientes.push(r);
  });
  // Claude en tandas de 20 (con 40 y razonamiento por creativo la salida pasaba max_tokens), hasta
  // `maxBatches` por llamada; el resto queda "pendiente" y el front vuelve a pedir.
  const TANDA = 20;
  const conClaude = !!process.env.ANTHROPIC_API_KEY;
  const quedan = [];
  for (let i = 0, b = 0; i < pendientes.length; i += TANDA, b++) {
    const tanda = pendientes.slice(i, i + TANDA);
    if (!conClaude) { for (const r of tanda) out[r.fingerprint] = { nivel: null, fuente: "nd", motivo: "sin_claude", motivador: "", motivadorTipo: "", confianza: "baja" }; continue; }
    if (b >= maxBatches) { for (const r of tanda) { out[r.fingerprint] = { nivel: null, fuente: "pendiente", motivador: "", motivadorTipo: "", confianza: "baja" }; quedan.push(r.fingerprint); } continue; }
    let res = null;
    try { res = await claudeBatch(tanda); } catch { res = null; }
    for (const r of tanda) {
      const c = res && res[r.fingerprint];
      if (!c) { out[r.fingerprint] = { nivel: null, fuente: "nd", motivo: "claude_fallo", motivador: "", motivadorTipo: "", confianza: "baja" }; continue; }
      out[r.fingerprint] = { ...c, fuente: "claude" };
      _mem[keyNivel(tab, r.fingerprint)] = c;
      if (upstash) kvSet(keyNivel(tab, r.fingerprint), c).catch(() => {});
    }
  }
  return { niveles: out, pendientes: quedan, cache: upstash, claude: conClaude };
}

export { keyOverride };
