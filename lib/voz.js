// lib/voz.js
// Inventario de VOZ REAL de las clientas: motivadores que dijeron ellas (comentarios de posts,
// chats de WhatsApp, preguntas de MeLi, reseñas), no los que infiere Claude de los creativos.
// Por marca (pestaña del Sheet), en Upstash `nusa:voz:<tab>`:
//   [{ id, tipo: Dolor|Deseo|Objecion|Ocasion|Identidad, frase_literal (cómo lo dijo la clienta),
//      resumen, fuente: comentarios|whatsapp|meli|resenas|manual, fecha, veces_visto }]
// Claude hace dos cosas acá, siempre con dedup: (1) EXTRAER motivadores de texto crudo, citando
// la frase literal y diciendo si "es el mismo que #id" (suma veces_visto en vez de crear);
// (2) CRUZAR cada motivador guardado contra los motivadores detectados en los creativos (match
// cacheado en `nusa:voz_cruce:<tab>`), para saber si ya fue probado y con qué resultado.
// Sin Upstash: extraer y cruzar funcionan, guardar devuelve 409 (nada persiste).

import { storeEnabled, kvGet, kvSet } from "@/lib/store";

export const VOZ_TIPOS = ["Dolor", "Deseo", "Objecion", "Ocasion", "Identidad"];
export const VOZ_FUENTES = ["comentarios", "whatsapp", "meli", "resenas", "manual"];
const keyVoz = (tab) => `nusa:voz:${tab}`;
const keyCruce = (tab) => `nusa:voz_cruce:${tab}`;
const corto = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export async function leerVoz(tab) {
  if (!storeEnabled()) return [];
  const v = await kvGet(keyVoz(tab)).catch(() => null);
  return Array.isArray(v) ? v : [];
}
export async function guardarVoz(tab, lista) {
  if (!storeEnabled()) { const e = new Error("Sin Upstash no se puede guardar la voz de las clientas"); e.code = 409; throw e; }
  await kvSet(keyVoz(tab), lista.slice(0, 500));
  return lista;
}
export function nuevoItem(x) {
  return { id: uid(), tipo: VOZ_TIPOS.includes(x.tipo) ? x.tipo : "Deseo", frase_literal: corto(x.frase_literal, 240), resumen: corto(x.resumen, 120), fuente: VOZ_FUENTES.includes(x.fuente) ? x.fuente : "manual", fecha: new Date().toISOString().slice(0, 10), veces_visto: Math.max(1, parseInt(x.veces_visto, 10) || 1) };
}

async function claude(system, user, max_tokens = 6000) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Falta ANTHROPIC_API_KEY");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens, system, messages: [{ role: "user", content: user }] }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Error de Claude");
  if (d.stop_reason && d.stop_reason !== "end_turn") throw new Error("Claude no completó (" + d.stop_reason + ")");
  const text = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  return JSON.parse(text.slice(a, b + 1));
}

// (1) Extraer motivadores de texto crudo. Devuelve propuestas (NO guarda): el usuario acepta/edita.
const SYS_EXTRAER = `Sos analista de investigación de clientes para una marca de ecommerce en Argentina. Te paso TEXTO CRUDO escrito por clientas (comentarios de posts, chats de WhatsApp, preguntas de MercadoLibre, reseñas) y el INVENTARIO de motivadores ya guardados.

Tu tarea: extraer los MOTIVADORES DE COMPRA que aparecen — el dolor, deseo, objeción, ocasión o identidad concreta — citando la FRASE LITERAL con la que lo dijo la clienta (copiala textual, con sus errores; no la mejores). Reglas:
- Un motivador = una idea. Si varias clientas dicen lo mismo con otras palabras, es UN motivador: elegí la frase más representativa y contá en veces_visto cuántas lo dijeron.
- Si un motivador YA está en el inventario (misma idea, aunque con otras palabras), NO lo crees: devolvelo con "mismo_que": el id del inventario, así se suma veces_visto.
- Ignorá saludos, pedidos de precio sin contexto, spam y lo que no revela un motivo de compra o freno.
- Entre 3 y 12 motivadores por texto; si el texto no da, menos.
- tipo: Dolor (algo que sufre) | Deseo (algo que quiere lograr/sentir) | Objecion (freno o duda antes de comprar) | Ocasion (momento/evento de uso) | Identidad (cómo se ve a sí misma / a qué grupo pertenece).

Devolvé EXCLUSIVAMENTE JSON: {"motivadores":[{"tipo":"...","frase_literal":"...","resumen":"≤120 chars, en tercera persona","veces_visto":n,"mismo_que":"id del inventario o null"}]}`;
export async function extraerVoz(texto, existentes) {
  const inv = existentes.map((e) => ({ id: e.id, tipo: e.tipo, resumen: e.resumen, frase_literal: e.frase_literal }));
  const j = await claude(SYS_EXTRAER, "INVENTARIO YA GUARDADO:\n" + JSON.stringify(inv) + "\n\nTEXTO CRUDO:\n" + String(texto).slice(0, 12000));
  const ids = new Set(existentes.map((e) => e.id));
  return (Array.isArray(j.motivadores) ? j.motivadores : []).slice(0, 15).map((m) => ({
    tipo: VOZ_TIPOS.includes(m.tipo) ? m.tipo : "Deseo", frase_literal: corto(m.frase_literal, 240), resumen: corto(m.resumen, 120),
    veces_visto: Math.max(1, parseInt(m.veces_visto, 10) || 1), mismo_que: m.mismo_que && ids.has(String(m.mismo_que)) ? String(m.mismo_que) : null,
  })).filter((m) => m.frase_literal);
}

// (2) Cruzar la voz guardada contra los motivadores detectados en los creativos. Cache por item de
// voz + firma del set de motivadores (si cambian los creativos, se recruza). Devuelve {vozId → motivador|null}.
const SYS_CRUZAR = `Te paso motivadores REALES de clientas (voz) y motivadores DETECTADOS en los creativos que ya corrieron. Para cada motivador de voz decí si alguno de los creativos ya toca ESA MISMA idea (mismo dolor/deseo/objeción/ocasión/identidad, aunque con otras palabras). Sé estricto: parecido de tema no es lo mismo que la misma idea. Devolvé EXCLUSIVAMENTE JSON: {"cruce":[{"voz_id":"...","motivador_creativo":"texto exacto del motivador detectado o null"}]}`;
export async function cruzarVoz(tab, voz, motivadoresCreativos) {
  if (!voz.length) return {};
  const set = [...new Set(motivadoresCreativos.map((m) => String(m.motivador || "")).filter(Boolean))].sort();
  const firma = set.length + ":" + set.join("|").length;
  let cache = {};
  if (storeEnabled()) { const c = await kvGet(keyCruce(tab)).catch(() => null); if (c && c.firma === firma) cache = c.map || {}; }
  const faltan = voz.filter((v) => !(v.id in cache));
  if (faltan.length && set.length) {
    const j = await claude(SYS_CRUZAR, "VOZ:\n" + JSON.stringify(faltan.map((v) => ({ voz_id: v.id, tipo: v.tipo, resumen: v.resumen, frase: v.frase_literal }))) + "\n\nMOTIVADORES DETECTADOS EN CREATIVOS:\n" + JSON.stringify(set), 4000);
    const setS = new Set(set);
    for (const x of Array.isArray(j.cruce) ? j.cruce : []) if (x.voz_id) cache[x.voz_id] = x.motivador_creativo && setS.has(x.motivador_creativo) ? x.motivador_creativo : null;
    for (const v of faltan) if (!(v.id in cache)) cache[v.id] = null;
    if (storeEnabled()) kvSet(keyCruce(tab), { firma, map: cache }).catch(() => {});
  } else if (faltan.length) { for (const v of faltan) cache[v.id] = null; }
  const out = {}; for (const v of voz) out[v.id] = cache[v.id] ?? null;
  return out;
}
