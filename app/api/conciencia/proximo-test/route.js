import { autorizar } from "../_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST {account, extras?, tab, modo, matriz, motivadores, receta, umbral, marca?, publico?, accountName?}
// → { hipotesis: [ {nivel_objetivo, motivador, por_que, etapa_audiencia_sugerida, hook_ejemplo,
//      formato_sugerido, metrica_de_exito, cantidad_de_videos} ×3 ] }
// La matriz (niveles × etapa con estado de celda) y el inventario de motivadores ya vienen
// calculados del front: Claude solo elige QUÉ probar y lo justifica citando la celda.
const PERSONA = `Sos director creativo y estratega de respuesta directa para ecommerce en Argentina. Escribís en español rioplatense, tratando de "vos", directo y concreto. Dominás Meta Ads, el scroll en mobile y los niveles de conciencia de Schwartz (5 producto+oferta · 4 producto · 3 solución · 2 problema · 1 inconsciente). Trabajás SIEMPRE sobre lo que la marca ya probó: la matriz y los motivadores que te paso son la evidencia.`;

const SYSTEM = (msg) => `${PERSONA}

Te paso la MATRIZ nivel de conciencia × etapa de audiencia (frío/medio/caliente) de una marca, con el estado de cada celda (sin_probar | sin_data | ganadora | perdedora | neutra), su spend, ${msg ? "costo por conversación" : "ROAS/CPA"}, hook rate y hold rate medianos; el INVENTARIO de motivadores ya probados; la receta ganadora; y el umbral del cliente.

Devolvé EXACTAMENTE 3 hipótesis de test, en JSON puro (sin markdown): {"hipotesis": [ {...}, {...}, {...} ]} con estos campos por hipótesis:
- "nivel_objetivo": 1-5
- "motivador": string ≤ 80 chars, ESPECÍFICO de esta marca y su público (usá marca, publico y los motivadores ya probados como contraste — nunca genérico)
- "por_que": 1-2 frases que CITAN la celda de la matriz que lo justifica (ej: "nivel 2 × frío está sin probar", "nivel 4 × medio es ganadora con 20% del spend", "nivel 5 × caliente es perdedora")
- "etapa_audiencia_sugerida": "frio" | "medio" | "caliente"
- "hook_ejemplo": 1 línea, el gancho de los primeros 3 s, en el tono de la marca
- "formato_sugerido": string corto (ej: "POV selfie", "unboxing", "meme con texto", "demo en uso")
- "metrica_de_exito": según el nivel — 1-2: hook rate y hold rate vs la mediana de la marca; 3-4: CTR y costo por LPV; 5: ${msg ? "costo por conversación" : "ROAS/CPA"} vs el umbral del cliente. Poné el número de referencia que te paso.
- "cantidad_de_videos": 2-4

REGLAS (no negociables):
1. NUNCA propongas como "nuevo" un nivel + motivador que ya figura ganador en la matriz o en el inventario.
2. Priorizá celdas SIN PROBAR en frío (es donde se descubre público nuevo), después celdas sin data.
3. PROHIBIDO juzgar niveles 1-3 por ${msg ? "costo por conversación" : "ROAS"}: se juzgan por hook rate, hold rate y CTR.
4. Máximo 3 hipótesis, distintas entre sí (nivel o motivador distinto).
5. Los motivadores tienen que sonar a ESTA marca: producto, público y jerga reales. Si el inventario ya tocó un motivador, proponé uno vecino pero distinto.
6. Modo ${msg ? "MENSAJES: la conversión es la conversación iniciada (WhatsApp/IG), no la compra" : "VENTAS: la conversión es la compra"}.`;

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });
  let body = {};
  try { body = await req.json(); } catch {}
  const auth = await autorizar(body);
  if (auth.error) return auth.error;
  const msg = body.modo === "mensajes";
  const ctx = {
    marca: body.accountName || body.marca || "", marca_detectada: body.marca || "nd", publico_inferido: body.publico || "nd",
    periodo: body.periodo || "", umbral: body.umbral || {}, receta_ganadora: body.receta || {},
    matriz: body.matriz || {}, motivadores_probados: body.motivadores || [], lectura: body.lectura || [],
  };
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 3000, system: SYSTEM(msg), messages: [{ role: "user", content: "Contexto de la marca (JSON):\n" + JSON.stringify(ctx, null, 1) + "\n\nDevolvé las 3 hipótesis en el formato pedido." }] }),
    });
    const data = await r.json();
    if (data.error) return Response.json({ error: data.error.message || "Error de Claude" }, { status: 500 });
    if (data.stop_reason && data.stop_reason !== "end_turn") return Response.json({ error: "Claude no completó la respuesta (" + data.stop_reason + ")" }, { status: 500 });
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    const j = JSON.parse(text.slice(a, b + 1));
    const hip = (Array.isArray(j.hipotesis) ? j.hipotesis : []).slice(0, 3);
    if (!hip.length) return Response.json({ error: "Claude no devolvió hipótesis" }, { status: 500 });
    return Response.json({ hipotesis: hip });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
