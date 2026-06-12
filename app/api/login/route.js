import { authenticate, makeSessionToken, sessionCookieHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const user = await authenticate(body.user, body.pass);
  if (!user) return Response.json({ error: "Usuario o contraseña inválidos" }, { status: 401 });
  const token = await makeSessionToken(user);
  return new Response(JSON.stringify({ ok: true, admin: !!user.admin }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookieHeader(token) },
  });
}
