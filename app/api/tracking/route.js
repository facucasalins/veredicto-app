import { cookies } from "next/headers";
import { getTrackingHealth } from "@/lib/meta";
import { isTikTok } from "@/lib/tiktok";
import { isGoogle } from "@/lib/google";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Salud del pixel/tracking de la cuenta de Meta (fase 2A: lo que el token de Sistema puede leer —
// inventario, si dispara, advanced matching). EMQ/dedup/CAPI (fase 2B) requieren permiso aparte.
// Lo consume el cerebro (Analisis) para sumar "salud de tracking" al diagnóstico. Degrada a null.
export async function GET(req) {
  const account = new URL(req.url).searchParams.get("account");
  if (!account) return Response.json({ error: "falta account" }, { status: 400 });
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!canSeeAccount(sess, account)) return Response.json({ error: "Sin acceso" }, { status: 403 });
  if (isTikTok(account) || isGoogle(account)) return Response.json({ tracking: null }); // el pixel es de Meta
  try {
    return Response.json({ tracking: await getTrackingHealth(account) });
  } catch (e) {
    // sin acceso al pixel o token caído → el cerebro sigue sin salud de tracking
    return Response.json({ tracking: null, nota: e.message });
  }
}
