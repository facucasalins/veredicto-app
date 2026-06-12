import { cookies } from "next/headers";
import { kvGet, kvSet, storeEnabled } from "@/lib/store";
import { SESSION_COOKIE, verifySession, authDisabled, hashPassword, getUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ABM de usuarios de clientes (pestaña USUARIOS, solo admin). Viven en Upstash (`nusa:users`) con
// password HASHEADA (PBKDF2) — nunca guardamos ni devolvemos texto plano. Los admin de respaldo
// siguen en APP_USERS (env) y NO se administran desde acá (solo se listan como referencia).

const KEY = "nusa:users";
const normU = (u) => String(u || "").trim().toLowerCase();

async function adminSession() {
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return { error: "No autorizado", status: 401 };
  if (!sess.admin) return { error: "Solo admin", status: 403 };
  return { sess };
}

export async function GET() {
  const a = await adminSession();
  if (a.error) return Response.json({ error: a.error }, { status: a.status });
  if (!storeEnabled()) return Response.json({ enabled: false, users: [] });
  try {
    const users = (await kvGet(KEY)) || [];
    // nunca exponemos hash/salt al front
    const safe = (Array.isArray(users) ? users : []).map((u) => ({ u: u.u, admin: !!u.admin, accounts: u.accounts || [], tabs: u.tabs || [], updated: u.updated || null }));
    const envUsers = getUsers().map((u) => u.u); // solo nombres, como referencia (se editan por env)
    return Response.json({ enabled: true, users: safe, envUsers });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const a = await adminSession();
  if (a.error) return Response.json({ error: a.error }, { status: a.status });
  if (!storeEnabled()) return Response.json({ error: "Upstash no está configurado" }, { status: 400 });

  let body = {};
  try { body = await req.json(); } catch {}
  const action = body.action;
  const u = normU(body.u);
  if (!u) return Response.json({ error: "falta el usuario" }, { status: 400 });
  if (getUsers().some((x) => normU(x.u) === u)) return Response.json({ error: "Ese usuario vive en APP_USERS (env) — editalo ahí" }, { status: 400 });

  try {
    const users = ((await kvGet(KEY)) || []).filter((x) => x && x.u);
    const idx = users.findIndex((x) => normU(x.u) === u);

    if (action === "delete") {
      if (idx < 0) return Response.json({ error: "no existe" }, { status: 404 });
      users.splice(idx, 1);
      await kvSet(KEY, users);
      return Response.json({ ok: true, users: users.length });
    }

    if (action === "upsert") {
      const prev = idx >= 0 ? users[idx] : null;
      if (!prev && !body.p) return Response.json({ error: "usuario nuevo: falta la contraseña" }, { status: 400 });
      if (body.p && String(body.p).length < 8) return Response.json({ error: "contraseña muy corta (mínimo 8)" }, { status: 400 });
      const cred = body.p ? await hashPassword(body.p) : { hash: prev.hash, salt: prev.salt };
      const entry = {
        u,
        hash: cred.hash, salt: cred.salt,
        admin: !!body.admin,
        accounts: Array.isArray(body.accounts) ? body.accounts.map(String) : (prev ? prev.accounts : []),
        tabs: Array.isArray(body.tabs) ? body.tabs.map(String) : (prev ? prev.tabs : []),
        updated: new Date().toISOString(),
      };
      if (idx >= 0) users[idx] = entry; else users.push(entry);
      await kvSet(KEY, users);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
