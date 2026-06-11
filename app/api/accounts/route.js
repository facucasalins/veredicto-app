import { cookies } from "next/headers";
import { getAccounts } from "@/lib/meta";
import { getAccounts as getTikTokAccounts, ttEnabled } from "@/lib/tiktok";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // Sesión: si el login está desactivado (sin APP_USERS) => admin (ve todo, comportamiento actual).
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    // Meta + TikTok en el mismo dropdown. TikTok degrada: sin env vars (o si su API falla) la
    // lista queda solo con Meta, como siempre. Ids de TikTok prefijados "tt:".
    const [meta, tiktok] = await Promise.all([
      getAccounts(),
      ttEnabled() ? getTikTokAccounts().catch(() => []) : Promise.resolve([]),
    ]);
    const accounts = [...meta, ...tiktok].filter((a) => canSeeAccount(sess, a.id));
    const me = authDisabled() ? null : { u: sess.u, admin: !!sess.admin };
    return Response.json({ accounts, me });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
