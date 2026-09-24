import { classifyRows, CAMPOS } from "@/lib/conciencia";
import { autorizar } from "../_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // hasta N tandas de 40 creativos a Claude en frío

// POST {account, extras?, tab, rows:[{fingerprint, ...campos del Sheet}]} → { niveles: {fp → clasificación}, cache, claude }
export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const auth = await autorizar(body);
  if (auth.error) return auth.error;
  const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 400).map((r) => {
    const o = { fingerprint: String(r.fingerprint || "").slice(0, 120) };
    for (const k of CAMPOS) o[k] = r[k] == null ? "" : String(r[k]).slice(0, 600);
    return o;
  }).filter((r) => r.fingerprint);
  try {
    return Response.json(await classifyRows(rows, String(body.tab)));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
