// Regenera el refresh token de Google con los scopes de Ads + Analytics (GA4), con el flujo
// OAuth de loopback: imprime la URL de consentimiento, levanta un mini server local que captura
// el redirect y canjea el code por el refresh token. NO toca el token de Ads existente: el nuevo
// va a GOOGLE_OAUTH_REFRESH_TOKEN (lib/ga4.js lo prefiere si está).
// Uso: node scripts/ga4-auth.mjs  → abrir la URL que imprime, autorizar, listo.
import { readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

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

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPES = ["https://www.googleapis.com/auth/adwords", "https://www.googleapis.com/auth/analytics.readonly"];
const OUT = new URL("../.ga4-token.json", import.meta.url); // resultado (gitignoreado por patrón .*)

const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT,
  response_type: "code",
  scope: SCOPES.join(" "),
  access_type: "offline",
  prompt: "consent", // fuerza refresh token nuevo aunque ya haya consentimiento previo
});

console.log("\n=== ABRIR ESTA URL Y AUTORIZAR ===\n");
console.log(url);
console.log("\n(esperando el redirect en " + REDIRECT + " ...)\n");

createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  if (u.pathname !== "/callback") { res.writeHead(404).end(); return; }
  const code = u.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" }).end("<h3>Faltó el code — " + (u.searchParams.get("error") || "") + "</h3>");
    return;
  }
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT }),
    });
    const j = await r.json();
    if (!j.refresh_token) throw new Error(JSON.stringify(j).slice(0, 300));
    writeFileSync(OUT, JSON.stringify({ refresh_token: j.refresh_token, scope: j.scope, t: new Date().toISOString() }, null, 2));
    console.log("✓ refresh token nuevo guardado en .ga4-token.json (scopes: " + j.scope + ")");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end("<h2>✓ Listo — ya podés volver a la terminal/chat. Esta pestaña se puede cerrar.</h2>");
    setTimeout(() => process.exit(0), 500);
  } catch (e) {
    console.error("✗ canje falló:", e.message);
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" }).end("<h3>✗ " + e.message + "</h3>");
  }
}).listen(PORT);
