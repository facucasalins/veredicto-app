import { keyOverride, MOTIVADOR_TIPOS } from "@/lib/conciencia";
import { storeEnabled, kvSet, kvDel } from "@/lib/store";
import { autorizar } from "../_auth";

export const dynamic = "force-dynamic";

// POST {account, tab, fingerprint, nivel, motivador?, motivadorTipo?} → guarda el override manual.
// DELETE (mismo body sin nivel) → lo borra. Sin Upstash no hay dónde guardar (409).
async function leer(req) { try { return await req.json(); } catch { return {}; } }

export async function POST(req) {
  const body = await leer(req);
  const auth = await autorizar(body);
  if (auth.error) return auth.error;
  const nivel = parseInt(body.nivel, 10);
  if (!body.fingerprint || !(nivel >= 1 && nivel <= 5)) return Response.json({ error: "fingerprint y nivel 1-5 requeridos" }, { status: 400 });
  if (!storeEnabled()) return Response.json({ error: "Sin Upstash no se pueden guardar overrides" }, { status: 409 });
  // nivel_previo / fuente_previa (regla|claude) = lo que dijo la clasificación automática antes del
  // override: es el set de calibración (sección CALIBRACIÓN de ÁNGULOS y CSV de entrenamiento).
  const np = parseInt(body.nivel_previo, 10);
  const ov = { nivel, motivador: String(body.motivador || "").slice(0, 80), motivadorTipo: MOTIVADOR_TIPOS.includes(body.motivadorTipo) ? body.motivadorTipo : "",
    nivel_previo: np >= 1 && np <= 5 ? np : null, fuente_previa: ["regla", "claude"].includes(body.fuente_previa) ? body.fuente_previa : (body.fuente_previa ? "nd" : null), t: Date.now() };
  try { await kvSet(keyOverride(String(body.tab), String(body.fingerprint)), ov); return Response.json({ ok: true, override: ov }); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(req) {
  const body = await leer(req);
  const auth = await autorizar(body);
  if (auth.error) return auth.error;
  if (!body.fingerprint) return Response.json({ error: "falta fingerprint" }, { status: 400 });
  if (!storeEnabled()) return Response.json({ error: "Sin Upstash no hay overrides" }, { status: 409 });
  try { await kvDel(keyOverride(String(body.tab), String(body.fingerprint))); return Response.json({ ok: true }); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
