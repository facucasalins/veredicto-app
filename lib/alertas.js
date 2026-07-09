// Motor de ALERTAS PROACTIVAS: chequeos diarios por cliente que avisan cuando algo se rompe o
// se degrada — la app deja de esperar que entres a mirar. Lo corre el cron de Vercel
// (/api/alertas con el CRON_SECRET) o el botón "chequear ahora" del admin. Las alertas se
// guardan en Upstash (centro de alertas in-app) y, si hay RESEND_API_KEY + ALERTAS_EMAIL, se
// mandan también por mail. El canal es enchufable: WhatsApp (Meta Cloud API) se suma después
// sobre esta misma interfaz sin tocar los chequeos.
//
// Chequeos v1 (baratos y robustos — cada uno degrada solo si su fuente falla):
// 1. Cuenta de Meta con estado problemático (pago pendiente, inhabilitada, ...) — CRÍTICO.
// 2. Inversión de AYER en cero en una cuenta que venía invirtiendo (Meta y Google) — CRÍTICO.
// 3. ROAS pixel de los últimos 7 días cayó >30% contra los 7 anteriores — AVISO.
// 4. CR del sitio (GA4) de los últimos 7 días cayó >30% contra los 7 anteriores — AVISO.
import { getAccounts as metaGetAccounts, getAccountSpend } from "@/lib/meta";
import { gEnabled, getAccounts as gGetAccounts, getAccountSpend as gGetAccountSpend } from "@/lib/google";
import { gaEnabled, gaDemo, getDaily as gaGetDaily } from "@/lib/ga4";
import { storeEnabled, kvGet, kvSet } from "@/lib/store";

const ymd = (d) => d.toISOString().slice(0, 10);
const diasAtras = (n) => { const d = new Date(); const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); u.setUTCDate(u.getUTCDate() - n); return ymd(u); };

// Corre todos los chequeos y devuelve la lista de alertas [{ nivel, cuenta, titulo, detalle }].
// nivel: "critico" | "aviso". Cada bloque tiene su propio catch: un chequeo caído no tira el resto.
export async function runChecks() {
  const alertas = [];
  const ayer = diasAtras(1);
  const s7 = diasAtras(7), s14 = diasAtras(14), s8 = diasAtras(8);

  // Cuentas de ads (Meta con status crudo + Google). Si Meta falla entera, ESO es una alerta.
  let metaAccs = [];
  try { metaAccs = await metaGetAccounts(); }
  catch (e) { alertas.push({ nivel: "critico", cuenta: "Meta", titulo: "No se pudo consultar Meta", detalle: "El token de sistema puede estar vencido: " + e.message.slice(0, 120) }); }
  let gAccs = [];
  if (gEnabled()) { try { gAccs = await gGetAccounts(); } catch { /* Google caído: los demás chequeos siguen */ } }

  // 1. Estado problemático (getAccounts ya etiqueta "⚠ nombre — motivo" y conserva status ≠ 1)
  for (const a of metaAccs) {
    if (a.status !== 1 && a.status !== undefined) {
      alertas.push({ nivel: "critico", cuenta: a.name.replace(/^⚠ /, ""), titulo: "Cuenta de Meta con problema", detalle: a.name + " — Meta puede estar frenando la entrega de anuncios." });
    }
  }

  // 2 y 3. Por cuenta activa: spend de ayer vs promedio previo, y ROAS 7d vs 7d anteriores.
  const cuentas = [
    ...metaAccs.filter((a) => a.status === 1 || a.status === undefined).map((a) => ({ id: a.id, name: a.name, spend: (s, u) => getAccountSpend(a.id, s, u) })),
    ...gAccs.map((a) => ({ id: a.id, name: a.name, spend: (s, u) => gGetAccountSpend(String(a.id).replace(/^g:/, ""), s, u) })),
  ];
  await Promise.all(cuentas.map(async (c) => {
    try {
      const [hoy7, prev7, deAyer] = await Promise.all([
        c.spend(s7, ayer),
        c.spend(s14, s8),
        c.spend(ayer, ayer),
      ]);
      // inversión cortada: ayer $0 con un promedio previo real (> $1000/día equivalente)
      const prom = hoy7.spend / 7;
      if (deAyer.spend === 0 && prom > 1000) {
        alertas.push({ nivel: "critico", cuenta: c.name, titulo: "Sin inversión ayer", detalle: `Ayer gastó $0 cuando venía invirtiendo ~$${Math.round(prom).toLocaleString("es-AR")}/día. ¿Campañas apagadas, budget agotado o problema de pago?` });
      }
      // ROAS pixel desplomado: 7d vs 7d anteriores, con spend real en ambas ventanas
      if (hoy7.spend > 5000 && prev7.spend > 5000 && prev7.roasMeta > 0) {
        const caida = (prev7.roasMeta - hoy7.roasMeta) / prev7.roasMeta;
        if (caida > 0.3) {
          alertas.push({ nivel: "aviso", cuenta: c.name, titulo: "ROAS cayendo fuerte", detalle: `ROAS ${hoy7.roasMeta.toFixed(1)}x en los últimos 7 días vs ${prev7.roasMeta.toFixed(1)}x la semana anterior (−${Math.round(caida * 100)}%).` });
        }
      }
    } catch { /* una cuenta caída no frena el barrido */ }
  }));

  // 4. CR del sitio (GA4): 7d vs 7d anteriores por propiedad mapeada.
  if (gaEnabled() && !gaDemo()) {
    let props = [];
    try { props = JSON.parse(process.env.GA4_PROPERTIES || "[]"); } catch {}
    await Promise.all(props.map(async (p) => {
      try {
        const dias = await gaGetDaily(p.property_id, s14, ayer);
        const b = (desde, hasta) => dias.filter((d) => d.fecha >= desde && d.fecha <= hasta).reduce((acc, d) => ({ s: acc.s + d.sesiones, c: acc.c + d.compras }), { s: 0, c: 0 });
        const cur = b(s7, ayer), prev = b(s14, s8);
        if (cur.s > 500 && prev.s > 500 && prev.c / prev.s > 0) {
          const crCur = cur.c / cur.s, crPrev = prev.c / prev.s;
          const caida = (crPrev - crCur) / crPrev;
          if (caida > 0.3) {
            alertas.push({ nivel: "aviso", cuenta: p.name, titulo: "Conversión del sitio cayendo", detalle: `CR ${(crCur * 100).toFixed(2)}% en los últimos 7 días vs ${(crPrev * 100).toFixed(2)}% la semana anterior (−${Math.round(caida * 100)}%). Si el tráfico se mantuvo, el problema es el SITIO (checkout, stock, precios), no la pauta.` });
          }
        }
      } catch { /* GA4 caído para esta propiedad: seguimos */ }
    }));
  }

  return alertas.sort((a, b) => (a.nivel === "critico" ? 0 : 1) - (b.nivel === "critico" ? 0 : 1));
}

// Guarda el resultado del barrido en Upstash (para el centro de alertas in-app). Degrada sin KV.
export async function guardarAlertas(alertas) {
  if (!storeEnabled()) return false;
  await kvSet("nusa:alertas:latest", { t: new Date().toISOString(), alertas });
  return true;
}
export async function leerAlertas() {
  if (!storeEnabled()) return null;
  return kvGet("nusa:alertas:latest");
}

// Canal de salida: email vía Resend (fetch directo, sin dependencias). Degrada sin env vars.
// Para sumar WhatsApp después: otra función acá con la Cloud API de Meta y listo.
export async function enviarEmail(alertas) {
  const key = process.env.RESEND_API_KEY;
  const to = (process.env.ALERTAS_EMAIL || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!key || !to.length || !alertas.length) return false;
  const item = (a) => `<li style="margin-bottom:10px"><b style="color:${a.nivel === "critico" ? "#C5362B" : "#C2861F"}">${a.nivel === "critico" ? "🔴" : "🟡"} ${a.titulo}</b> — ${a.cuenta}<br/><span style="color:#555">${a.detalle}</span></li>`;
  const html = `<div style="font-family:sans-serif;max-width:640px"><h2>NUSA APP — ${alertas.length} alerta${alertas.length !== 1 ? "s" : ""} hoy</h2><ul style="padding-left:18px">${alertas.map(item).join("")}</ul><p style="color:#888;font-size:12px">Chequeo automático diario · entrá al panel para el detalle.</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERTAS_FROM || "NUSA APP <onboarding@resend.dev>",
      to,
      subject: `⚠ NUSA: ${alertas.filter((a) => a.nivel === "critico").length} crítica(s), ${alertas.filter((a) => a.nivel === "aviso").length} aviso(s)`,
      html,
    }),
  });
  return r.ok;
}
