import { cookies } from "next/headers";
import { demografia } from "@/lib/demografia";
import { parseAccounts } from "@/lib/multi";
import { getDolarOficial } from "@/lib/fx";
import { presetToRange } from "@/lib/dates";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Pestaña DEMOGRAFÍA: performance por edad / género / zona / ubicación (lib/demografia.js, el
// mismo cálculo que usa la tool meta_demografia del chat). Acepta la vista combinada
// (accounts=a,b + curs=USD,ARS): suma las cuentas de Meta y avisa cuáles no tienen estos cortes.
// Montos en pesos: las cuentas en USD se convierten al dólar oficial, igual que el resto del panel.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const cuentas = parseAccounts(searchParams);
  if (!cuentas.length) return Response.json({ error: "falta account" }, { status: 400 });
  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  for (const c of cuentas) {
    if (!canSeeAccount(sess, c.id)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });
  }

  const qsSince = searchParams.get("since"), qsUntil = searchParams.get("until");
  const { since, until } = qsSince && qsUntil ? { since: qsSince, until: qsUntil } : presetToRange(searchParams.get("preset") || "last_30d");
  const corte = searchParams.get("corte") || "edad_genero";
  const filtro = { campania: searchParams.get("campania") || "", creativo: searchParams.get("creativo") || "" };

  let dolar = null, fx = null;
  if (cuentas.some((c) => c.cur === "USD")) {
    try { const d = await getDolarOficial(); dolar = d.rate; fx = { rate: d.rate, fuente: d.fuente }; }
    catch { fx = { error: true }; } // degrada: montos de cuentas USD sin convertir, el front avisa
  }
  try {
    const out = await demografia({ cuentas, corte, since, until, filtro, rateOf: (cur) => (cur === "USD" && dolar ? dolar : 1) });
    return Response.json({ ...out, ...(fx ? { fx } : {}) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
