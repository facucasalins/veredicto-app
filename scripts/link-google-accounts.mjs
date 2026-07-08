// Vincula cuentas de Google Ads sueltas a la MCC (GOOGLE_ADS_MCC_ID) en dos pasos por API:
// 1) crea la invitación desde la MCC (customer_client_link PENDING) y 2) la acepta desde la
// cuenta cliente (customer_manager_link → ACTIVE) — funciona porque el usuario del refresh token
// tiene acceso directo a las cuentas. Al quedar ACTIVE, la cuenta aparece sola en el panel
// (getAccounts lista lo que cuelga de la MCC). Reversible: se desvincula desde Google Ads cuando
// quieras. Uso: node scripts/link-google-accounts.mjs <customer_id> [<customer_id> ...]
import { readFileSync } from "node:fs";

// Toma las env vars de .env.local si no están en el ambiente. Busca junto al script y, si el
// repo es un worktree (no tiene .env.local porque está gitignoreado), en el checkout principal.
for (const p of ["../.env.local", "../../../../.env.local"]) {
  try {
    const envFile = readFileSync(new URL(p, import.meta.url), "utf8");
    for (const line of envFile.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    break;
  } catch {}
}

const V = process.env.GOOGLE_ADS_API_VERSION || "v24";
const BASE = `https://googleads.googleapis.com/${V}`;
const MCC = process.env.GOOGLE_ADS_MCC_ID.replace(/-/g, "");

const ids = process.argv.slice(2).map((x) => x.replace(/-/g, ""));
if (!ids.length) { console.error("Uso: node scripts/link-google-accounts.mjs <customer_id> ..."); process.exit(1); }

const tokR = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  }),
});
const tok = (await tokR.json()).access_token;
if (!tok) { console.error("No se pudo renovar el access token"); process.exit(1); }

const headers = (login) => ({
  Authorization: `Bearer ${tok}`,
  "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  "login-customer-id": login,
  "Content-Type": "application/json",
});
const errMsg = (j) => {
  const e = j.error || (Array.isArray(j) && j[0]?.error);
  if (!e) return null;
  const det = e.details?.[0]?.errors?.[0]?.message;
  return det || e.message || JSON.stringify(e).slice(0, 200);
};

async function gaql(cid, login, query) {
  const r = await fetch(`${BASE}/customers/${cid}/googleAds:searchStream`, {
    method: "POST", headers: headers(login), body: JSON.stringify({ query }),
  });
  const j = await r.json();
  const e = errMsg(j);
  if (e) throw new Error(e);
  return (Array.isArray(j) ? j : [j]).flatMap((c) => c.results || []);
}

for (const cid of ids) {
  let nombre = cid;
  try {
    const c = await gaql(cid, cid, "SELECT customer.descriptive_name FROM customer");
    nombre = c[0]?.customer?.descriptiveName || cid;
  } catch { /* seguimos con el id */ }
  process.stdout.write(`${nombre} (${cid}): `);
  try {
    // Paso 1: invitación desde la MCC (si ya existe un link pendiente/activo, Google lo dice y seguimos)
    const inv = await fetch(`${BASE}/customers/${MCC}/customerClientLinks:mutate`, {
      method: "POST", headers: headers(MCC),
      body: JSON.stringify({ operation: { create: { clientCustomer: `customers/${cid}`, status: "PENDING" } } }),
    });
    const invJ = await inv.json();
    const invErr = errMsg(invJ);
    if (invErr && !/ALREADY|DUPLICATE|already/i.test(invErr)) throw new Error("invitación: " + invErr);

    // Paso 2: buscar el link pendiente del lado del cliente y aceptarlo
    const links = await gaql(cid, cid, `
      SELECT customer_manager_link.resource_name, customer_manager_link.manager_customer,
             customer_manager_link.status
      FROM customer_manager_link`);
    const activo = links.find((l) => l.customerManagerLink?.managerCustomer === `customers/${MCC}` && l.customerManagerLink?.status === "ACTIVE");
    if (activo) { console.log("ya estaba vinculada ✓"); continue; }
    const pend = links.find((l) => l.customerManagerLink?.managerCustomer === `customers/${MCC}` && l.customerManagerLink?.status === "PENDING");
    if (!pend) throw new Error("no apareció la invitación pendiente (¿el usuario no es admin de la cuenta?)");
    const acc = await fetch(`${BASE}/customers/${cid}/customerManagerLinks:mutate`, {
      method: "POST", headers: headers(cid),
      body: JSON.stringify({ operations: [{ update: { resourceName: pend.customerManagerLink.resourceName, status: "ACTIVE" }, updateMask: "status" }] }),
    });
    const accJ = await acc.json();
    const accErr = errMsg(accJ);
    if (accErr) throw new Error("aceptación: " + accErr);
    console.log("vinculada a la MCC ✓");
  } catch (e) {
    console.log("✗ " + e.message);
  }
}
