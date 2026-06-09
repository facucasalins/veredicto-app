// lib/sheet.js
// Cruza el Google Sheet de análisis de Gemini contra las filas del panel (buildRows),
// leyendo el workbook por la API de Google Sheets (la app lo lee sola, sin publicar CSV,
// y el Sheet queda privado). Auth = cuenta de servicio (JWT firmado, sin dependencias).
//
// LLAVE DE CRUCE: el fingerprint de tiempo (HH.MM.SS) que vive en `nuevo_nombre` del Sheet
// y en el nombre del anuncio de Meta. NO usamos la columna `timestamp` (Sheets la corrompió
// convirtiendo valores como "13.03.27" en fechas reales). El cruce queda scopeado por pestaña:
// leemos una sola pestaña por vez, así dos creativos de marcas distintas con el mismo
// HH.MM.SS nunca chocan. La pestaña la elegís a mano en el panel (listTabs() llena el dropdown).
//
// Env: GOOGLE_SA_EMAIL, GOOGLE_SA_KEY (private_key del JSON), SHEET_ID (el id del workbook).

import crypto from "crypto";

// Nombres exactos de las columnas en el header (fila 2 de cada pestaña).
// La llave admite alias por las dudas (probamos en orden).
const COL = {
  nombre: ["nuevo_nombre", "nombre_archivo", "nombre"], // llave de cruce
  // --- núcleo creativo (rankeable) ---
  tipo_gancho: "tipo_gancho",
  angulo: "angulo_de_venta",
  estructura: "estructura_narrativa",
  formato: "formato_video",
  duracion: "duracion_s",
  scroll: "scroll_stopper_score",
  cta: "cta_0a3s",
  // --- secundario (rankeable) ---
  emocion: "emocion_predominante",
  produccion: "estilo_produccion",
  branding: "branding_intensidad",
  publico: "publico_inferido",
  // --- split (ventaja sobre Zora; hoy casi todo 100/0, prende solo al poblarse) ---
  prim: "categoria_primaria",
  sec: "categoria_secundaria",
  split: "categoria_split",
  // --- solo detalle de la tarjeta (NO rankear, alta cardinalidad) ---
  texto_gancho: "texto_gancho",
  resumen: "resumen_200c",
  oferta: "oferta_detalles",
};

// ---------- Auth: cuenta de servicio -> access token (cacheado en memoria) ----------
function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

let _tok = { value: null, exp: 0 };

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_tok.value && now < _tok.exp - 60) return _tok.value;
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = (process.env.GOOGLE_SA_KEY || "").replace(/\\n/g, "\n"); // env guarda \n literales
  if (!email || !key) throw new Error("Faltan GOOGLE_SA_EMAIL / GOOGLE_SA_KEY en el env.");
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const sig = b64url(signer.sign(key));
  const jwt = `${header}.${claim}.${sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`OAuth ${res.status}: ${await res.text()}`);
  const j = await res.json();
  _tok = { value: j.access_token, exp: now + (j.expires_in || 3600) };
  return _tok.value;
}

async function sheetsGet(path) {
  const id = process.env.SHEET_ID;
  if (!id) throw new Error("Falta SHEET_ID en el env.");
  const tok = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}${path}`, {
    headers: { Authorization: `Bearer ${tok}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------- Lectura ----------
// Lista las pestañas visibles (para llenar el dropdown del panel).
export async function listTabs() {
  const j = await sheetsGet("?fields=sheets.properties(sheetId,title,hidden)");
  return (j.sheets || [])
    .map((s) => s.properties || {})
    .filter((p) => !p.hidden && p.title)
    .map((p) => ({ title: p.title, gid: p.sheetId }));
}

// Lee todas las filas de una pestaña (array de arrays).
async function readTab(title) {
  const range = encodeURIComponent(`'${String(title).replace(/'/g, "''")}'`);
  const j = await sheetsGet(`/values/${range}`);
  return j.values || [];
}

// ---------- Helpers ----------
// Saca el token (HH.MM.SS) de cualquier texto. Es el ID único del creativo.
export function extractTs(s = "") {
  const m = String(s).match(/\((\d{1,2}\.\d{2}\.\d{2})\)/);
  return m ? m[1] : null;
}

// Coma decimal AR -> número. "8,5" -> 8.5 ; 8 -> 8 ; "" -> null.
function num(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// "70/30" -> { prim: 0.7, sec: 0.3 }. Vacío o "100/0" -> { prim: 1, sec: 0 }.
function parseSplit(s) {
  const m = String(s).match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  if (!m) return { prim: 1, sec: 0 };
  const a = +m[1], b = +m[2], t = (a + b) || 100;
  return { prim: a / t, sec: b / t };
}

function pick(headerIdx, names, row) {
  const arr = Array.isArray(names) ? names : [names];
  for (const n of arr) {
    const j = headerIdx[n.toLowerCase().trim()];
    if (j != null && row[j] != null && String(row[j]).trim() !== "") return String(row[j]).trim();
  }
  return "";
}

// ---------- Index + merge ----------
// Construye Map<ts, meta> desde una pestaña.
export async function buildSheetIndex(tabName) {
  const rows = await readTab(tabName);
  // GOTCHA 1: fila 1 = agrupador ("Operativo / Clasificación / ..."), fila 2 = header real,
  //           datos desde la fila 3.
  if (rows.length < 3) return new Map();
  const header = rows[1].map((h) => String(h).toLowerCase().trim());
  const headerIdx = {};
  header.forEach((h, j) => { if (headerIdx[h] == null) headerIdx[h] = j; });

  const idx = new Map();
  for (const r of rows.slice(2)) {
    const nombre = pick(headerIdx, COL.nombre, r);
    const ts = extractTs(nombre);
    if (!ts) continue; // sin fingerprint no cruza (ej: catálogo dinámico)
    const split = pick(headerIdx, COL.split, r) || "100/0";
    idx.set(ts, {
      ts, nombre,
      // núcleo (rankeable)
      tipo_gancho:  pick(headerIdx, COL.tipo_gancho, r) || "nd",
      angulo:       pick(headerIdx, COL.angulo, r) || "nd",
      estructura:   pick(headerIdx, COL.estructura, r) || "nd",
      formato:      pick(headerIdx, COL.formato, r) || "nd",
      duracion_s:   num(pick(headerIdx, COL.duracion, r)),
      scroll_score: num(pick(headerIdx, COL.scroll, r)),
      cta_0a3s:     pick(headerIdx, COL.cta, r) || "nd",
      // secundario (rankeable)
      emocion:      pick(headerIdx, COL.emocion, r) || "nd",
      produccion:   pick(headerIdx, COL.produccion, r) || "nd",
      branding:     pick(headerIdx, COL.branding, r) || "nd",
      publico:      pick(headerIdx, COL.publico, r) || "nd",
      // split
      prim:   pick(headerIdx, COL.prim, r) || "nd",
      sec:    pick(headerIdx, COL.sec, r) || "nd",
      split,
      splitW: parseSplit(split),
      // detalle (no rankear)
      texto_gancho: pick(headerIdx, COL.texto_gancho, r) || "",
      resumen:      pick(headerIdx, COL.resumen, r) || "",
      oferta:       pick(headerIdx, COL.oferta, r) || "",
    });
  }
  return idx;
}

// Enriquece las filas del panel con la metadata del Sheet, cruzando por ts.
// El Sheet manda sobre lo parseado del nombre cuando hay dato real.
export function mergeSheet(rows, idx) {
  return rows.map((row) => {
    const ts = extractTs(row.id); // row.id = "concepto (HH.MM.SS)"
    const meta = ts ? idx.get(ts) : null;
    if (!meta) return { ...row, sheet: null };
    return {
      ...row,
      ang:    meta.prim !== "nd" ? meta.prim : row.ang,
      sec:    meta.sec  !== "nd" ? meta.sec : "—",
      split:  meta.split,
      splitW: meta.splitW, // {prim, sec} para el ranking ponderado (hoy 1/0; prende solo)
      sheet:  meta,        // núcleo + secundario + detalle vive acá
    };
  });
}

// Atajo: lee la pestaña + cruza. Si algo falla, el panel sigue andando solo con data de Meta.
export async function enrichWithSheet(rows, tabName) {
  if (!tabName) return rows.map((r) => ({ ...r, sheet: null }));
  try {
    const idx = await buildSheetIndex(tabName);
    return mergeSheet(rows, idx);
  } catch (e) {
    console.error("[sheet] cruce omitido:", e.message);
    return rows.map((r) => ({ ...r, sheet: null }));
  }
}
