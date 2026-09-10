import { autorizar } from "../_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST {account, extras?, tab, modo, matriz, motivadores, voz, receta, umbral, marca?, publico?, accountName?, ...}
// → { hipotesis: [ {descarte:[{idea,motivo}×2], nivel_objetivo, motivadorTipo, motivador, motivador_cercano,
//      diferencia, por_que, etapa_audiencia_sugerida, hook_ejemplo, formato_sugerido, metrica_de_exito,
//      cantidad_de_videos} ×3 ] }
// La matriz (niveles × etapa con estado, motivadores y formatos por celda), el inventario COMPLETO
// de motivadores y la "voz" (ganchos literales) vienen del front SIN los creativos "sin
// reproducciones". Claude elige QUÉ probar; acá validamos diversidad y motivadores saturados.
const PERSONA = `Sos director creativo y estratega de respuesta directa para ecommerce en Argentina. Escribís en español rioplatense, tratando de "vos", directo y concreto. Dominás Meta Ads, el scroll en mobile y los niveles de conciencia de Schwartz (5 producto+oferta · 4 producto · 3 solución · 2 problema · 1 inconsciente). Trabajás SIEMPRE sobre lo que la marca ya probó: la matriz, el inventario de motivadores y los ganchos literales que te paso son la evidencia.`;

const TIPOS = ["Dolor", "Ocasion", "Identidad", "Objecion", "Deseo", "Oferta"];
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const SYSTEM = (msg) => `${PERSONA}

Te paso la MATRIZ nivel de conciencia × etapa de audiencia (frío/medio/caliente) de una marca, con el estado de cada celda (sin_probar | sin_data | ganadora | perdedora | neutra), su spend, ${msg ? "costo por conversación" : "ROAS/CPA"}, hook rate y hold rate medianos, y los MOTIVADORES y FORMATOS de gancho que ya se usaron en cada celda con su cantidad; el INVENTARIO COMPLETO de motivadores ya probados (motivador, tipo, niveles, creativos, hook rate, ${msg ? "costo/conv" : "ROAS"}); la VOZ de la marca (ganchos literales de los mejores creativos); la receta ganadora; y el umbral del cliente.

Devolvé EXACTAMENTE 3 hipótesis de test, en JSON puro (sin markdown): {"hipotesis": [ {...}, {...}, {...} ]} con estos campos EN ESTE ORDEN por hipótesis (razoná antes de proponer):
- "descarte": [{"idea": "...", "motivo": "ya probada | fuera de voz | mismo tipo que otra"}, {"idea": "...", "motivo": "..."}] — 2 ideas que consideraste y descartaste
- "nivel_objetivo": 1-5
- "motivadorTipo": "Dolor" | "Ocasion" | "Identidad" | "Objecion" | "Deseo"
- "motivador": string ≤ 80 chars, ESPECÍFICO de esta marca y su público (producto, público y jerga reales)
- "motivador_cercano": el motivador YA PROBADO más cercano del inventario (textual) o "ninguno"
- "diferencia": en qué se diferencia tu motivador de ese, 1 frase
- "por_que": 1-2 frases que CITAN la celda de la matriz que lo justifica (ej: "nivel 2 × frío está sin probar", "nivel 4 × medio es ganadora con 20% del spend", "nivel 5 × caliente es perdedora")
- "etapa_audiencia_sugerida": "frio" | "medio" | "caliente"
- "hook_ejemplo": 1 línea, el gancho de los primeros 3 s — tiene que SONAR a los ganchos literales de la voz de la marca (mismo registro, largo y jerga), no a un manifiesto
- "formato_sugerido": string corto (ej: "POV selfie", "unboxing", "meme con texto", "demo en uso")
- "metrica_de_exito": según el nivel — 1-2: hook rate y hold rate vs la mediana de la marca; 3-4: CTR y costo por LPV; 5: ${msg ? "costo por conversación" : "ROAS/CPA"} vs el umbral del cliente. Poné el número de referencia que te paso.
- "cantidad_de_videos": 2-4
- "verificado_con_clientas": true si el motivador sale de la VOZ REAL de las clientas (citá la frase en "frase_clienta"), false si lo inventaste vos
- "frase_clienta": la frase literal de la clienta que lo respalda, o ""

REGLAS (no negociables):
0. VOZ DE LAS CLIENTAS: si te paso "voz_clientas", sus motivadores "sin_creativo" (dijeron ellas y NADIE grabó todavía) tienen PRIORIDAD sobre inventar. Solo inventá si el backlog no alcanza para 3 hipótesis distintas, y marcá lo inventado con verificado_con_clientas:false.
1. NUNCA propongas como "nuevo" un nivel + motivador que ya figura ganador en la matriz o en el inventario.
2. PROHIBIDO proponer un motivador que ya tenga 3 o más creativos probados en el inventario (ni reformulado). Cada hipótesis nombra el motivador probado más cercano y dice en qué se diferencia.
3. DIVERSIDAD: las 3 hipótesis usan motivadorTipo DISTINTOS entre sí y ningún motivador se repite.
4. CELDA LLENA: si en la celda objetivo un formato o un motivador ya tiene 3+ creativos, no lo propongas; la hipótesis tiene que ser sobre un motivador NUEVO, no sobre un formato.
5. Priorizá celdas SIN PROBAR en frío (es donde se descubre público nuevo), después celdas sin data.
6. PROHIBIDO juzgar niveles 1-3 por ${msg ? "costo por conversación" : "ROAS"}: se juzgan por hook rate, hold rate y CTR.
7. Los motivadores tienen que sonar a ESTA marca. Si el inventario ya tocó un motivador, proponé uno vecino pero distinto.
8. Modo ${msg ? "MENSAJES: la conversión es la conversación iniciada (WhatsApp/IG), no la compra" : "VENTAS: la conversión es la compra"}.`;

async function pedir(key, system, messages) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 8000, system, messages }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || "Error de Claude");
  if (data.stop_reason && data.stop_reason !== "end_turn") throw new Error("Claude no completó la respuesta (" + data.stop_reason + ")");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  const j = JSON.parse(text.slice(a, b + 1));
  return { text, hip: (Array.isArray(j.hipotesis) ? j.hipotesis : []).slice(0, 3) };
}

// Chequeo duro de las reglas 2 y 3. Devuelve la lista de problemas (vacía si está bien).
function validar(hip, saturados) {
  const problemas = [];
  const tipos = hip.map((h) => h.motivadorTipo), mots = hip.map((h) => norm(h.motivador));
  if (new Set(tipos).size < hip.length) problemas.push("las hipótesis repiten motivadorTipo (" + tipos.join(", ") + ")");
  if (new Set(mots).size < hip.length) problemas.push("las hipótesis repiten motivador");
  for (const h of hip) { if (!TIPOS.includes(h.motivadorTipo)) problemas.push(`motivadorTipo inválido: ${h.motivadorTipo}`); const m = norm(h.motivador); const s = saturados.find((x) => x === m || (m.length > 12 && (x.includes(m) || m.includes(x)))); if (s) problemas.push(`"${h.motivador}" ya tiene 3+ creativos probados`); }
  return problemas;
}

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });
  let body = {};
  try { body = await req.json(); } catch {}
  const auth = await autorizar(body);
  if (auth.error) return auth.error;
  const msg = body.modo === "mensajes";
  const motivadores = Array.isArray(body.motivadores) ? body.motivadores : [];
  const saturados = motivadores.filter((m) => (m.creativos || 0) >= 3).map((m) => norm(m.motivador));
  const ctx = {
    marca: body.accountName || body.marca || "", marca_detectada: body.marca || "nd", publico_inferido: body.publico || "nd",
    periodo: body.periodo || "", umbral: body.umbral || {}, receta_ganadora: body.receta || {},
    matriz: body.matriz || {}, motivadores_probados: motivadores, motivadores_PROHIBIDOS_3_o_mas_creativos: motivadores.filter((m) => (m.creativos || 0) >= 3).map((m) => m.motivador),
    voz_de_la_marca: body.voz || {}, voz_clientas: body.voz_clientas || { sin_creativo: [], probados: [] }, referencias: body.referencias || {}, lectura: body.lectura || [],
    nota: body.excluidos_sin_reproducciones ? `${body.excluidos_sin_reproducciones} creativos "sin reproducciones" (bug de Meta) fueron excluidos de todo esto.` : undefined,
  };
  try {
    const messages = [{ role: "user", content: "Contexto de la marca (JSON):\n" + JSON.stringify(ctx, null, 1) + "\n\nDevolvé las 3 hipótesis en el formato pedido." }];
    let { text, hip } = await pedir(key, SYSTEM(msg), messages);
    let problemas = hip.length === 3 ? validar(hip, saturados) : ["no devolvió 3 hipótesis"];
    if (problemas.length) {
      // una corrección: le mostramos qué rompió y pedimos las 3 de nuevo
      messages.push({ role: "assistant", content: text }, { role: "user", content: "Tu respuesta rompe estas reglas: " + problemas.join("; ") + ". Devolvé las 3 hipótesis de nuevo, corregidas, en el mismo formato JSON. Los 3 motivadorTipo tienen que ser distintos, ningún motivador repetido ni saturado (3+ creativos)." });
      const r2 = await pedir(key, SYSTEM(msg), messages);
      hip = r2.hip; problemas = hip.length === 3 ? validar(hip, saturados) : ["no devolvió 3 hipótesis"];
    }
    if (!hip.length) return Response.json({ error: "Claude no devolvió hipótesis" }, { status: 500 });
    return Response.json({ hipotesis: hip, ...(problemas.length ? { advertencia: "Reglas no cumplidas tras la corrección: " + problemas.join("; ") } : {}) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
