import { cookies } from "next/headers";
import { listStores } from "@/lib/tiendanube";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // admin / login desactivado → todas. Cliente → solo las tiendas cuya `account` puede ver.
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ stores: [] });
  try {
    let stores = listStores();
    if (!sess.admin) stores = stores.filter((s) => s.account && canSeeAccount(sess, s.account));
    return Response.json({ stores });
  } catch (e) {
    return Response.json({ stores: [], error: e.message }); // degradación: dropdown vacío, panel anda igual
  }
}
