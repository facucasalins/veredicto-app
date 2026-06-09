import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, authDisabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Cruza los hooks REALES que el cliente ya usó contra la biblioteca de templates, para marcar
// qué patrones ya probó y cuáles no. Estricto: ante la duda, no marca como probado (así el
// "sin probar" queda como un backlog confiable de experimentos).
const SYSTEM = `Sos analista de creativos publicitarios. Te paso (1) los HOOKS REALES que un cliente ya usó, numerados [i], y (2) una BIBLIOTECA de templates de hooks (patrones con huecos como "(beneficio)" o "[nicho]"). Para CADA hook real, identificá a qué template(s) de la biblioteca se parece en ESTRUCTURA e INTENCIÓN (no en palabras exactas). Sé estricto: si un hook real no sigue claramente el patrón de ningún template, devolvé ids vacío. Un hook real puede matchear más de un template.

Para CADA hook real que matchee, dá una razón BREVE (máx ~12 palabras) de por qué encaja con ese/esos templates (qué estructura o intención comparten).

Devolvé EXCLUSIVAMENTE JSON válido sin markdown ni backticks, usando el índice i de cada hook real: {"matches":[{"i":<índice del hook real>,"ids":[<id template>, ...],"razon":"<por qué, breve>"}]}`;

export async function POST(req) {
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });

  let realHooks = [], library = [];
  try { ({ realHooks = [], library = [] } = await req.json()); } catch {}
  if (!realHooks.length || !library.length) return Response.json({ error: "faltan hooks o biblioteca" }, { status: 400 });

  const prompt = "HOOKS REALES DEL CLIENTE (índice · texto):\n" + realHooks.map((h, i) => `[${h.i != null ? h.i : i}] ${h.text != null ? h.text : h}`).join("\n") +
    "\n\nBIBLIOTECA (id · template):\n" + library.map((l) => l.id + " · " + l.text).join("\n") +
    "\n\nMapeá cada hook real (por su índice) a su(s) template(s) de la biblioteca.";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 3200, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await r.json();
    if (data.error) return Response.json({ error: data.error.message || "Error de Claude" }, { status: 500 });
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    const probados = Array.from(new Set((parsed.matches || []).flatMap((m) => m.ids || [])));
    return Response.json({ probados, matches: parsed.matches || [] });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
