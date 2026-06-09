import { cookies } from "next/headers";
import { listTabs } from "@/lib/sheet";
import { SESSION_COOKIE, verifySession, authDisabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // admin / login desactivado → todas las pestañas. Cliente → solo las de su lista `tabs` (sin ella, ninguna).
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ tabs: [] });
  try {
    let tabs = await listTabs();
    if (!sess.admin) { const allow = (sess.tabs || []).map(String); tabs = tabs.filter((t) => allow.includes(t.title)); }
    return Response.json({ tabs });
  } catch (e) {
    return Response.json({ tabs: [], error: e.message }); // si falla, dropdown vacío y el panel anda igual
  }
}
