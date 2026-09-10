import { cookies } from "next/headers";
import { runChecks, guardarAlertas, leerAlertas, enviarEmail, registrarCorrida, leerCorrida, alertaCronCaido } from "@/lib/alertas";
import { SESSION_COOKIE, verifySession, authDisabled } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Centro de alertas. GET con Bearer CRON_SECRET (el cron diario de Vercel) → corre los chequeos,
// guarda en Upstash y manda el mail. GET con sesión de ADMIN → devuelve lo último guardado.
// POST con sesión de ADMIN → "chequear ahora" (corre en vivo, guarda y devuelve).
// Las alertas son de TODOS los clientes → solo admin (los usuarios cliente no ven esto).

async function correr() {
  const alertas = await runChecks();
  await guardarAlertas(alertas).catch(() => {});
  const mail = await enviarEmail(alertas).catch(() => false);
  return { t: new Date().toISOString(), alertas, mail };
}

export async function GET(req) {
  // Cron de Vercel: manda Authorization: Bearer <CRON_SECRET> (SOLO si la env var está seteada en
  // Vercel; sin ella el request llega sin credencial y caía al 401 de sesión en silencio — así se
  // "perdió" el cron del 27/7). Vercel identifica sus crons con user-agent "vercel-cron/1.0".
  const auth = req.headers.get("authorization") || "";
  const esCron = /vercel-cron/i.test(req.headers.get("user-agent") || "");
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) {
    try { const r = await correr(); await registrarCorrida({ ok: true, alertas: r.alertas.length, mail: !!r.mail }); return Response.json(r); }
    catch (e) { await registrarCorrida({ ok: false, error: e.message }); return Response.json({ error: e.message }, { status: 500 }); }
  }
  if (esCron) {
    // llegó el cron pero sin credencial válida: lo registramos con causa clara y NO corremos
    // (correr sin auth dejaría que cualquiera dispare mails con un user-agent falso)
    const error = process.env.CRON_SECRET ? "Bearer inválido: el CRON_SECRET del request no coincide con el de Vercel" : "CRON_SECRET no configurada en Vercel";
    console.error("[alertas] cron rechazado:", error);
    await registrarCorrida({ ok: false, error });
    return Response.json({ error }, { status: 500 });
  }
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!sess.admin) return Response.json({ alertas: [] }); // clientes: sin centro de alertas
  try {
    const [stored, corrida] = await Promise.all([leerAlertas(), leerCorrida()]);
    const base = stored || { t: null, alertas: [] };
    const caido = alertaCronCaido(base.t, corrida);
    return Response.json({ ...base, alertas: caido ? [caido, ...base.alertas] : base.alertas, cron: { secret: !!process.env.CRON_SECRET, ultimo_intento: corrida || null } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST() {
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess || !sess.admin) return Response.json({ error: "Solo admin" }, { status: 403 });
  try { return Response.json(await correr()); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
