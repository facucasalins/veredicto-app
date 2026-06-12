import { cookies } from "next/headers";
import { listStores } from "@/lib/tiendanube";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // admin / login desactivado → todas. Cliente → las tiendas asignadas explícitamente al usuario
  // (campo `stores` del panel USUARIOS) o cuya `account` de Meta puede ver (compat con scopeo viejo).
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ stores: [] });
  try {
    let stores = listStores();
    if (!sess.admin) {
      const mias = (sess.stores || []).map(String);
      stores = stores.filter((s) => mias.includes(s.name) || (s.account && canSeeAccount(sess, s.account)));
    }
    return Response.json({ stores });
  } catch (e) {
    return Response.json({ stores: [], error: e.message }); // degradación: dropdown vacío, panel anda igual
  }
}
