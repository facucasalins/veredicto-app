// lib/store.js
// Storage server-side en Upstash Redis (REST API, sin dependencias) para historiales de
// Análisis/Plan y conversaciones del chat — compartidos entre máquinas y usuarios de la cuenta.
//
// Degradación elegante: sin env vars → storeEnabled() false y el front sigue en localStorage
// como siempre. Se puede pushear sin que Upstash esté conectado.
//
// Env (las inyecta sola la integración de Vercel Marketplace al conectar la base al proyecto):
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//   (alias legacy de Vercel KV: KV_REST_API_URL / KV_REST_API_TOKEN — soportamos ambos)

function cfg() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

export function storeEnabled() { return !!cfg(); }

// GET de un valor JSON. null si la clave no existe o no parsea.
export async function kvGet(key) {
  const c = cfg();
  if (!c) throw new Error("Storage no configurado");
  const res = await fetch(`${c.url}/GET/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${c.token}` },
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(j.error || `Upstash ${res.status}`);
  if (j.result == null) return null;
  try { return JSON.parse(j.result); } catch { return null; }
}

// SET de un valor JSON. Va por POST body (no por URL) para aguantar historiales grandes.
export async function kvSet(key, value) {
  const c = cfg();
  if (!c) throw new Error("Storage no configurado");
  const res = await fetch(`${c.url}/SET/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}` },
    body: JSON.stringify(value),
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(j.error || `Upstash ${res.status}`);
  return j.result;
}
