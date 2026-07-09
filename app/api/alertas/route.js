import { cookies } from "next/headers";
import { runChecks, guardarAlertas, leerAlertas, enviarEmail } from "@/lib/alertas";
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
  // Cron de Vercel: manda Authorization: Bearer <CRON_SECRET> (si la env var está seteada).
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) {
    try { return Response.json(await correr()); }
    catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
  }
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!sess.admin) return Response.json({ alertas: [] }); // clientes: sin centro de alertas
  try {
    const stored = await leerAlertas();
    return Response.json(stored || { t: null, alertas: [] });
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
