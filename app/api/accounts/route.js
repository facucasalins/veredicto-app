import { cookies } from "next/headers";
import { getAccounts } from "@/lib/meta";
import { getAccounts as getTikTokAccounts, ttEnabled } from "@/lib/tiktok";
import { getAccounts as getGoogleAccounts, gEnabled } from "@/lib/google";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // Sesión: si el login está desactivado (sin APP_USERS) => admin (ve todo, comportamiento actual).
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    // Meta + TikTok + Google en el mismo dropdown. Cada plataforma degrada: sin env vars (o si su
    // API falla) desaparece de la lista y queda el resto. Ids prefijados: TikTok "tt:", Google "g:".
    const [meta, tiktok, google] = await Promise.all([
      getAccounts(),
      ttEnabled() ? getTikTokAccounts().catch(() => []) : Promise.resolve([]),
      gEnabled() ? getGoogleAccounts().catch(() => []) : Promise.resolve([]),
    ]);
    const accounts = [...meta, ...tiktok, ...google].filter((a) => canSeeAccount(sess, a.id));
    const me = authDisabled() ? null : { u: sess.u, admin: !!sess.admin };
    return Response.json({ accounts, me });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
