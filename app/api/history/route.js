import { cookies } from "next/headers";
import { kvGet, kvSet, storeEnabled } from "@/lib/store";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Historiales server-side (Upstash): lecturas del cerebro, planes y conversaciones del chat,
// por cuenta. Mismo scopeo que el resto de la app: solo ves los historiales de cuentas a las
// que tu sesión tiene acceso. Sin Upstash configurado devuelve enabled:false y el front sigue
// en localStorage (degradación elegante).

// kind → tope de items. En hist_* lo más nuevo va PRIMERO (slice del frente); en chat los
// mensajes van en orden y lo más nuevo está al FINAL (slice de la cola).
const KINDS = { hist_an: 15, hist_plan: 15, chat: 30 };
const capear = (kind, items) => kind === "chat" ? items.slice(-KINDS[kind]) : items.slice(0, KINDS[kind]);

async function auth(account) {
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return { error: "No autorizado", status: 401 };
  if (!account || !canSeeAccount(sess, account)) return { error: "Sin acceso a esta cuenta", status: 403 };
  return {};
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind"), account = searchParams.get("account");
  if (!KINDS[kind]) return Response.json({ error: "kind inválido" }, { status: 400 });
  const a = await auth(account);
  if (a.error) return Response.json({ error: a.error }, { status: a.status });
  if (!storeEnabled()) return Response.json({ enabled: false, items: null });
  try {
    const items = await kvGet(`nusa:${kind}:${account}`);
    return Response.json({ enabled: true, items: Array.isArray(items) ? items : [] });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const { kind, account, items } = body;
  if (!KINDS[kind]) return Response.json({ error: "kind inválido" }, { status: 400 });
  if (!Array.isArray(items)) return Response.json({ error: "faltan items" }, { status: 400 });
  const a = await auth(account);
  if (a.error) return Response.json({ error: a.error }, { status: a.status });
  if (!storeEnabled()) return Response.json({ enabled: false });
  const capped = capear(kind, items);
  // tope de tamaño: un historial no debería pesar ni cerca de esto (límite request Upstash: 1MB)
  if (JSON.stringify(capped).length > 400000) return Response.json({ error: "historial demasiado grande" }, { status: 413 });
  try {
    await kvSet(`nusa:${kind}:${account}`, capped);
    return Response.json({ enabled: true, saved: capped.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
