import { cookies } from "next/headers";
import { getAdPreviewUrl } from "@/lib/meta";
import { isTikTok } from "@/lib/tiktok";
import { isGoogle } from "@/lib/google";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// "Ver video": el front abre /api/video?account=..&ad=.. en una pestaña nueva y acá redirigimos a la
// vista previa oficial del anuncio (video incluido). Se resuelve AL CLIC porque el link de Meta
// vence a las ~24 h. Solo Meta (Google/TikTok no tienen vista previa acá).
const html = (msg, status = 200) => new Response(
  `<!doctype html><meta charset="utf-8"><title>NUSA</title><body style="font-family:monospace;padding:40px;background:#1A1A17;color:#E9DEC8"><p>${msg}</p><p><a href="javascript:window.close()" style="color:#F4C24A">cerrar pestaña</a></p></body>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("account") || "";
  const ad = searchParams.get("ad") || "";
  if (!account || !/^\d+$/.test(ad)) return html("Falta el anuncio.", 400);
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return html("Sesión vencida — volvé a entrar a la app.", 401);
  if (!canSeeAccount(sess, account)) return html("Sin acceso a esta cuenta.", 403);
  if (isTikTok(account) || isGoogle(account)) return html("La vista previa solo está disponible para anuncios de Meta.", 400);
  try {
    const { url } = await getAdPreviewUrl(account, ad);
    return Response.redirect(url, 302);
  } catch (e) {
    return html("No se pudo abrir la vista previa: " + String(e.message || e), 502);
  }
}
