import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, authDisabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

// El "cerebro" read-only: recibe un resumen YA CALCULADO de la cuenta y devuelve diagnóstico +
// acciones. Claude solo interpreta los números que le pasamos, no inventa ni recalcula nada.
const SYSTEM = `Sos un media buyer senior y estratega de growth para ecommerce en Argentina. Hablás en español rioplatense (vos), directo y sin vueltas. Te paso un resumen YA CALCULADO de una cuenta de Meta Ads (más facturación de tienda si la hay). Tu trabajo es LEER esos números y decir qué está pasando y qué hacer para mejorar las campañas.

REGLAS DURAS:
- Usá EXCLUSIVAMENTE los números del resumen. NO inventes datos, NO estimes lo que no está, NO recalcules.
- Cada afirmación y cada acción tiene que apoyarse en un número concreto del resumen (citalo).
- Sé accionable y específico: "subí ~25% el budget del adset/campaña donde corre X", "pausá Y", "iterá Z probando W". Nada de consejos genéricos de manual.
- Conectá las piezas: si hay MER, comparalo con el ROAS del pixel (la brecha = venta que el pixel no atribuye). Mirá concentración de audiencias (¿una sola carga todo?), saturación de ángulos, qué sangra (mucho spend, poco ROAS), qué escalar.
- Si algo no se puede afirmar con los datos, decilo ("falta data para X"), no lo inventes.
- ESTADO (CRÍTICO): cada vez que menciones un anuncio específico, decí si está ACTIVO o PAUSADO.
  · Si un ítem de "sangrando" trae ya_pausado:true → YA ESTÁ PAUSADO: NO recomiendes pausarlo; sugerí archivarlo o iterar una variante. Solo recomendá pausar lo que sigue activo.
  · Para "qué escalar / qué replicar", usá "top_activos" (creativos que TODAVÍA corren). NO recomiendes escalar ni tomar como receta un ganador histórico/estacional que ya está pausado (ej: un HotSale apagado) — su ROAS alto es del pasado y no es accionable. Si la receta_ganadora viene con activa:false, aclarालo y basá la recomendación en top_activos.
- Priorizá: máximo 5 acciones, ordenadas por impacto. SÉ CONCISO: cada campo en 1-2 oraciones, sin relleno. Máximo 4 ítems en explorar y 4 en riesgos.

Devolvé EXCLUSIVAMENTE un JSON válido (sin markdown ni backticks) con esta forma:
{"titular":"una línea con el diagnóstico central","diagnostico":"2 a 4 oraciones contando la historia que cuentan los números","acciones":[{"prioridad":"alta|media|baja","accion":"qué hacer, concreto","porque":"el número que lo justifica"}],"explorar":["ángulo/hook/audiencia sin explotar que probarías y por qué"],"riesgos":["lo que está sangrando o en riesgo, con su número"]}`;

export async function POST(req) {
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });

  let snapshot = {};
  try { ({ snapshot } = await req.json()); } catch {}
  if (!snapshot || !Object.keys(snapshot).length) return Response.json({ error: "falta snapshot" }, { status: 400 });

  const prompt = "Resumen de la cuenta (JSON):\n" + JSON.stringify(snapshot, null, 1) + "\n\nLeé estos números y devolvé el análisis en el formato pedido.";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 2600,
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    if (data.error) return Response.json({ error: data.error.message || "Error de Claude" }, { status: 500 });
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const clean = text.replace(/```json|```/g, "").trim();
    return Response.json({ analysis: JSON.parse(clean) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
