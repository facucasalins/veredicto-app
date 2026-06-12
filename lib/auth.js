// lib/auth.js
// Login por cliente con DOS fuentes de usuarios:
//   1. APP_USERS (env, passwords en texto plano): el/los admin de RESPALDO. Si Upstash se cae o
//      borrás usuarios por error, nunca te quedás afuera de tu propia app. Manda sobre Upstash.
//   2. Upstash (clave `nusa:users`, passwords HASHEADAS con PBKDF2): los usuarios de clientes,
//      administrados desde la pestaña USUARIOS de la app (solo admin) — sin env vars ni redeploy.
// La sesión es una cookie firmada con HMAC-SHA256 vía Web Crypto, así funciona tanto en el
// middleware (Edge) como en las rutas API (Node) sin dependencias ni `import crypto`.
//
// Env:
//   APP_USERS      → JSON: [{ "u":"facu","p":"clave","admin":true }, ...]
//                    admin:true ve todas las cuentas; si no, ve solo las de `accounts` (ids de Meta).
//   SESSION_SECRET → secreto para firmar la cookie (poné cualquier string largo y aleatorio).
//
// IMPORTANTE: si APP_USERS está vacío o sin definir, el login queda DESACTIVADO y la app se ve igual
// (acceso abierto). El gate prende recién al cargar al menos el admin en APP_USERS; los usuarios de
// Upstash solo se consultan cuando el login está activo.

import { kvGet, storeEnabled } from "./store";

const enc = new TextEncoder();
const COOKIE = "nusa_session";
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 días

export const SESSION_COOKIE = COOKIE;

export function getUsers() {
  try { const u = JSON.parse(process.env.APP_USERS || "[]"); return Array.isArray(u) ? u : []; }
  catch { return []; }
}

// Sin usuarios configurados => login desactivado (comportamiento actual, acceso abierto como admin).
export function authDisabled() { return getUsers().length === 0; }

// --- passwords hasheadas (usuarios de Upstash) ---
// PBKDF2-SHA256, 100k iteraciones, salt aleatorio por usuario. Web Crypto puro (Edge + Node).
const ITER = 100000;

export async function hashPassword(pass, saltB64 = null) {
  const salt = saltB64 ? fromB64url(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(String(pass)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, key, 256);
  return { salt: b64url(salt), hash: b64url(bits) };
}

async function verifyPassword(pass, salt, hash) {
  try { const h = await hashPassword(pass, salt); return h.hash === hash; } catch { return false; }
}

// Usuarios de Upstash: [{u, salt, hash, admin?, accounts?, tabs?}]. Si Upstash no está o falla, [].
export async function getStoreUsers() {
  if (!storeEnabled()) return [];
  try { const v = await kvGet("nusa:users"); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Login: primero APP_USERS (respaldo, texto plano, manda ante mismo usuario), después Upstash (hash).
export async function authenticate(user, pass) {
  const envUser = getUsers().find((x) => x.u === user && String(x.p) === String(pass));
  if (envUser) return envUser;
  const su = (await getStoreUsers()).find((x) => x.u === user);
  if (su && su.hash && su.salt && (await verifyPassword(pass, su.salt, su.hash))) return su;
  return null;
}

// --- cookie firmada (HMAC-SHA256) ---
function b64url(bytes) {
  const arr = typeof bytes === "string" ? enc.encode(bytes) : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(s) {
  const norm = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
async function hmacKey() {
  const secret = process.env.SESSION_SECRET || "dev-secret-cambiame";
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

export async function makeSessionToken(user) {
  return signSession({ u: user.u, admin: !!user.admin, accounts: user.accounts || [], tabs: user.tabs || [], exp: Date.now() + TTL_MS });
}

export function sessionCookieHeader(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(TTL_MS / 1000)}${secure}`;
}
export function clearCookieHeader() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ¿La cuenta de Meta `id` es visible para esta sesión? admin/auth-desactivado => todas.
export function canSeeAccount(sess, id) {
  if (!sess) return false;
  if (sess.admin) return true;
  return (sess.accounts || []).map(String).includes(String(id));
}
