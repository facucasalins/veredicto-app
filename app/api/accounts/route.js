import { cookies } from "next/headers";
import { getAccounts } from "@/lib/meta";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // Sesión: si el login está desactivado (sin APP_USERS) => admin (ve todo, comportamiento actual).
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    const all = await getAccounts();
    const accounts = all.filter((a) => canSeeAccount(sess, a.id));
    const me = authDisabled() ? null : { u: sess.u, admin: !!sess.admin };
    return Response.json({ accounts, me });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
