import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

// Sesión + cuenta(s) + pestaña del Sheet. Devuelve { sess } o { error: Response }.
export async function autorizar(body) {
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return { error: Response.json({ error: "No autorizado" }, { status: 401 }) };
  const cuentas = [body.account, ...(Array.isArray(body.extras) ? body.extras : [])].filter(Boolean);
  if (!cuentas.length) return { error: Response.json({ error: "falta account" }, { status: 400 }) };
  for (const c of cuentas) if (!canSeeAccount(sess, c)) return { error: Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 }) };
  if (!body.tab) return { error: Response.json({ error: "falta tab" }, { status: 400 }) };
  if (!sess.admin && Array.isArray(sess.tabs) && sess.tabs.length && !sess.tabs.includes(body.tab)) return { error: Response.json({ error: "Sin acceso a esta planilla" }, { status: 403 }) };
  return { sess };
}
