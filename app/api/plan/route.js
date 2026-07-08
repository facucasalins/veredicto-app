import { cookies } from "next/headers";
import { getAds, getAdsetBudgets } from "@/lib/meta";
import { isTikTok, ttId, getAds as ttGetAds, getAdsetBudgets as ttGetAdsetBudgets } from "@/lib/tiktok";
import { isGoogle, gId, getAds as gGetAds, getAdsetBudgets as gGetAdsetBudgets } from "@/lib/google";
import { parseAccounts, platformOf } from "@/lib/multi";
import { getStoreRevenue } from "@/lib/tiendanube";
import { convertMonto } from "@/lib/fx";
import { presetToRange } from "@/lib/dates";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SYSTEM = `Sos un media buyer senior y planificador de presupuestos para ecommerce en Argentina. Hablás en español rioplatense (vos), directo. Te paso un resumen YA CALCULADO del MES EN CURSO de una cuenta de ads (el campo "plataforma" te dice cuál: Meta, TikTok o Google — o una COMBINACIÓN, ej. "Meta + Google": ahí la inversión es la suma de todas y cada unidad viene prefijada [Meta]/[Google] para que sepas dónde vive; podés recomendar mover plata ENTRE plataformas si los números lo justifican): la meta de facturación, lo facturado hasta hoy (MTD), la inversión, el MER, los días que faltan, y las UNIDADES DE PRESUPUESTO reales (cada una es un adset si la campaña es ABO, o una campaña si es CBO; en Google el budget vive SIEMPRE en la campaña, así que todas las unidades son campañas/CBO) con su budget diario actual, spend del mes, ROAS, ventas y estado.

CONTEXTO CLAVE SOBRE EL MER — NO LO USES PARA PROYECTAR:
La facturación de la tienda la empujan VARIOS canales (Meta, Google, TikTok, orgánico, recompra). Acá ves la inversión de la(s) plataforma(s) del resumen — nunca de TODOS los canales (orgánico, email y recompra no aparecen) — así que el MER (facturación total ÷ inversión visible) sigue inflado por lo que no ves. Con plataforma combinada el MER es MÁS honesto que con una sola, pero igual: si proyectás "facturación extra = inversión extra × MER" estás asumiendo que las plataformas visibles generan todo, y eso es FALSO. El MER te sirve solo como contexto de salud general y para detectar tendencia, nunca como multiplicador.

CÓMO PROYECTAR (en su lugar): usá la data ATRIBUIDA por la plataforma a nivel unidad — el ROAS y las ventas de cada unidad son lo que la plataforma efectivamente atribuye a esa plata. Facturación incremental esperada ≈ Σ (inversión extra en la unidad × ROAS esperado de esa unidad en el escenario). El ROAS esperado NUNCA es el actual al escalar: aplicale decaimiento por saturación según el escenario y el tamaño del salto de budget (saltos chicos ~10-20% degradan poco; duplicar budget degrada mucho).

Tu tarea: armar un plan para llegar a la meta, en TRES escenarios — PESIMISTA, NORMAL y OPTIMISTA — que se diferencian por cuánto asumís que decae el ROAS de cada unidad al escalar:
- Pesimista: decaimiento fuerte (auction saturada, fatiga creativa). Escalar rinde bastante menos que el ROAS actual.
- Normal: decaimiento moderado, el esperable al subir budget con creativos sanos.
- Optimista: las unidades top tienen margen real y el ROAS casi aguanta.

REGLAS DURAS:
- Usá SOLO los números del resumen. No inventes. Cada acción se apoya en un número (citalo: ROAS, budget, spend).
- Proyectá SIEMPRE desde el ROAS por unidad con decaimiento, NUNCA desde el MER (ver arriba). La facturacion_proyectada del escenario = facturado MTD + ritmo actual por los días restantes + el incremental de tus acciones.
- Concentrá la inversión en las unidades más eficientes CON margen; recomendá DESINVERTIR/reasignar lo que sangra (ROAS bajo, mucho spend). Mové budget de lo malo a lo bueno antes de pedir plata nueva.
- Para cada acción decí la unidad, su nivel (ABO/CBO), y el budget diario de→a (o pausar). Recordá que faltan N días: la inversión extra total = extra diario × días restantes.
- Si ni el escenario optimista llega a la meta CON la inversión de esta plataforma sola, decilo con honestidad y aclará que el resto debe venir de los otros canales que acá no ves.
- SÉ CONCISO: máximo 5 acciones por escenario (las de mayor impacto), "porque" en una frase corta. Máximo 4 ítems en desinversión.

SI modo="mensajes" (campañas de mensajería): NO hay facturación, ROAS ni meta de plata. El resultado son CONVERSACIONES y la eficiencia es el COSTO POR CONVERSACIÓN (menor = mejor). El plan es de OPTIMIZACIÓN: cómo escalar conversaciones manteniendo o bajando el costo por conversación. Los 3 escenarios se diferencian por cómo asumís que se comporta el costo por conversación al escalar (sube por saturación / se mantiene / baja). Concentrá budget en las unidades con costo por conversación más bajo y margen; desinvertí las de costo alto o sin conversaciones. En vez de "facturacion_proyectada" y "alcanza_meta", devolvé "conversaciones_proyectadas" (cuántas conversaciones proyectás al cierre del mes en ese escenario).

Devolvé EXCLUSIVAMENTE JSON válido sin markdown ni backticks.
- modo ventas: {"resumen":"...","escenarios":[{"nombre":"Pesimista","supuesto":"breve","inversion_extra_diaria":N,"inversion_extra_total":N,"facturacion_proyectada":N,"alcanza_meta":true|false,"acciones":[{"unidad":"nombre","nivel":"ABO|CBO","accion":"subir|bajar|pausar|mantener","de":N,"a":N,"porque":"breve, con número"}]},{"nombre":"Normal",...},{"nombre":"Optimista",...}],"desinversion":["..."]}
- modo mensajes: igual pero cada escenario con "conversaciones_proyectadas":N en vez de "facturacion_proyectada" y "alcanza_meta".`;

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const cuentas = parseAccounts(searchParams); // [{id, cur}] — una o varias (vista combinada Meta+Google)
  const store = searchParams.get("store");
  const goal = +(searchParams.get("goal") || 0);
  const modo = searchParams.get("modo") || "ventas";
  const count = searchParams.get("count"); // criterio de venta de la tienda: pagadas | no_canceladas
  const msg = modo === "mensajes";
  if (!cuentas.length) return Response.json({ error: "falta account" }, { status: 400 });
  if (!msg && !goal) return Response.json({ error: "definí la meta del mes primero" }, { status: 400 });

  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  for (const c of cuentas) {
    if (!canSeeAccount(sess, c.id)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });

  const { since, until } = presetToRange("this_month");
  const now = new Date();
  const diasMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const diasTrans = now.getDate();
  const diasRestan = Math.max(0, diasMes - diasTrans);

  try {
    // Una entrada por cuenta (vista combinada: Meta + Google de la misma marca). Si una plataforma
    // falla, seguimos con las otras.
    const [tienda, ...fetches] = await Promise.all([
      store ? getStoreRevenue(store, since, until, count).catch(() => null) : Promise.resolve(null),
      ...cuentas.map((c) => {
        const tt = isTikTok(c.id), gg = isGoogle(c.id);
        return Promise.all([
          tt ? ttGetAds(ttId(c.id), since, until) : gg ? gGetAds(gId(c.id), { since, until }) : getAds(c.id, "this_month", { since, until }),
          (tt ? ttGetAdsetBudgets(ttId(c.id)) : gg ? gGetAdsetBudgets(gId(c.id)) : getAdsetBudgets(c.id)).catch(() => ({})),
        ]).then(([ads, budgets]) => ({ c, ads, budgets })).catch(() => ({ c, ads: [], budgets: {} }));
      }),
    ]);

    // Conversión de moneda POR CUENTA: si una cuenta está en USD y la tienda en pesos, TODA su
    // plata (inversión, budgets, spend, costo/conv) se convierte al dólar oficial — igual que el
    // resto del panel. Los ratios (ROAS) y conteos no se tocan.
    const tCur = String((tienda && tienda.moneda) || "ARS").toUpperCase();
    const rates = {};
    for (const c of cuentas) {
      if (!c.cur || c.cur === tCur || rates[c.cur] != null) continue;
      try { const cv = await convertMonto(1, c.cur, tCur); if (cv.rate) rates[c.cur] = cv.monto; } catch { rates[c.cur] = null; }
    }

    // Agregamos por unidad de presupuesto (adset si ABO, campaña si CBO; en Google siempre la
    // campaña). En mensajes solo cuentan las campañas de mensajería. Con varias plataformas cada
    // unidad va prefijada [Meta]/[Google]/[TikTok] para que el plan diga dónde vive cada budget.
    const multi = cuentas.length > 1;
    const units = {};
    let inversion = 0, revenueAds = 0, convTotal = 0;
    let notaMoneda = null;
    for (const { c, ads, budgets } of fetches) {
      const plat = platformOf(c.id);
      const rate = c.cur !== tCur && rates[c.cur] ? rates[c.cur] : 1;
      if (rate !== 1) notaMoneda = `la plata de ${plat} está convertida de ${c.cur} a ${tCur} al dólar oficial ($${Math.round(rate)})`;
      for (const a of ads) {
        const b = budgets[a.adset_id];
        const esMsg = b && b.tipo === "mensajes";
        if (msg ? !esMsg : esMsg) continue; // filtramos por modo
        inversion += a.spend * rate; revenueAds += a.spend * rate * a.roas; convTotal += (a.conversaciones || 0);
        const key2 = plat + "‖" + (b ? b.unidad : "adset:" + a.adset_id);
        if (!units[key2]) units[key2] = { nombre: (multi ? "[" + plat + "] " : "") + ((b && b.unidad_nombre) || a.adset || "?"), nivel: (b && b.nivel) || "?", campania: (b && b.campaign) || a.campaign || "", budget_diario: b && b.budget_diario != null ? Math.round(b.budget_diario * rate) : null, spend: 0, revenue: 0, ventas: 0, conversaciones: 0, activa: false };
        const u = units[key2];
        u.spend += a.spend * rate; u.revenue += a.spend * rate * a.roas; u.ventas += a.ventas; u.conversaciones += (a.conversaciones || 0);
        if (b && b.status === "ACTIVE") u.activa = true;
      }
    }

    const inversionConv = Math.round(inversion);
    const facturacion = tienda ? tienda.facturacion : Math.round(revenueAds);
    const mer = inversionConv ? +(facturacion / inversionConv).toFixed(2) : null;
    const proyeccion = diasTrans ? Math.round(facturacion / diasTrans * diasMes) : facturacion;

    const unidades = Object.values(units)
      .map((u) => ({ nombre: u.nombre, nivel: u.nivel, campania: u.campania, budget_diario: u.budget_diario, spend_mtd: Math.round(u.spend), activa: u.activa, ...(msg ? { conversaciones: Math.round(u.conversaciones), costo_conv: u.conversaciones ? +(u.spend / u.conversaciones).toFixed(2) : 0 } : { roas: u.spend ? +(u.revenue / u.spend).toFixed(1) : 0, ventas: Math.round(u.ventas) }) }))
      .sort((a, b) => b.spend_mtd - a.spend_mtd).slice(0, 25);

    const plataforma = cuentas.map((c) => platformOf(c.id)).join(" + ");
    const snapshot = msg ? {
      modo, plataforma, dias_transcurridos: diasTrans, dias_del_mes: diasMes, dias_restantes: diasRestan,
      conversaciones_mtd: convTotal, inversion_mtd: inversionConv, costo_conv: convTotal ? +(inversion / convTotal).toFixed(2) : 0,
      ...(notaMoneda ? { moneda: tCur, nota_moneda: notaMoneda } : {}),
      proyeccion_conversaciones: diasTrans ? Math.round(convTotal / diasTrans * diasMes) : convTotal,
      unidades,
    } : {
      modo, plataforma, meta: goal, facturacion_mtd: facturacion, inversion_mtd: inversionConv, mer,
      fuente_facturacion: tienda ? "tienda" : plataforma.toLowerCase() + " (atribuida por la plataforma)",
      ...(notaMoneda ? { moneda: tCur, nota_moneda: notaMoneda } : {}),
      dias_transcurridos: diasTrans, dias_del_mes: diasMes, dias_restantes: diasRestan,
      proyeccion_sin_cambios: proyeccion, gap_vs_meta: Math.round(goal - proyeccion),
      unidades,
    };

    const prompt = "Resumen del mes en curso (JSON):\n" + JSON.stringify(snapshot, null, 1) + "\n\nArmá el plan en los 3 escenarios.";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 4500, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await r.json();
    if (data.error) return Response.json({ error: data.error.message || "Error de Claude" }, { status: 500 });
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const plan = JSON.parse(text.replace(/```json|```/g, "").trim());
    return Response.json({ plan, snapshot });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
